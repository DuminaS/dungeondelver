import "./style.css";
import { Hex, eq, key } from "./core/hex";
import { AbilityKey, ABILITIES, Character, ClassId, CLASS_IDS, Unit } from "./game/types";
import { admissionFor, BOSSES, CLASSES, FEATURES, RACES, TRAITS } from "./game/data";
import {
  applyLevelUp,
  classHeaderLabel,
  classLabel,
  classLevelsOf,
  featureSources,
  FeatureSource,
  grantXp,
  makeCharacter,
  primaryClassOf,
} from "./game/character";
import { RUN_CONFIG } from "./game/config";
import {
  BUILDINGS,
  Guild,
  applyGuildToConfig,
  buildingLevel,
  checkDisbandment,
  disbandAndRebuild,
  doUpgrade,
  foundGuild,
  loadGuild,
  recordRun,
  saveGuild,
  SIGILS,
  upgradeBlocked,
  upgradeCost,
} from "./game/guild";
import { ClubStanding, MAX_LEVEL, PROMOTE_SLOTS, RELEGATE_SLOTS, SEASON_LENGTH, divisionOf, divisionsAtLevel, playerRank, recordFixture, standings } from "./game/league";
import { MarketRecruit, rollAcademyProspect, rollMarket } from "./game/recruitment";
import { Run, EncounterReport } from "./game/descent";
import { Encounter } from "./game/encounter";
import { BoardView } from "./ui/render";
import { CONDITION_ICON, icon, logStyle, stat } from "./ui/icons";
import { crest } from "./ui/crests";
import { classAccent } from "./ui/classColor";
import { RNG } from "./core/rng";

const VERSION = __APP_VERSION__;
document.getElementById("build-badge")!.textContent = VERSION;

type Phase = "found" | "settlement" | "standings" | "market" | "disband" | "descent" | "encounter" | "aftermath" | "debrief";

const app = document.getElementById("app")!;
let guild: Guild = loadGuild();
applyGuildToConfig(guild);
let phase: Phase = guild.name ? "settlement" : "found";
let run: Run | null = null;
let enc: Encounter | null = null;
let board: BoardView | null = null;
let report: EncounterReport | null = null;
let fixtureResult: {
  cleared: boolean;
  gross: number;
  fee: number;
  wages: number;
  net: number;
  seasonEnded: boolean;
  promoted: boolean;
  relegated: boolean;
  newDivisionId: string;
  divisionName: string;
  feePct: number;
} | null = null;
let standingsReturnPhase: Phase = "settlement";
let pendingDisbandReason: string | null = null;
let marketRng = 0;
let marketPool: MarketRecruit[] = [];
let academyRng = 0;
let academyProspect: MarketRecruit | null = null;

// ---- encounter interaction ----
type Armed =
  | { t: "move"; hex: Hex }
  | { t: "target"; id: string; unitId: string } // id: __attack | __shove | <feature>
  | { t: "hex"; id: string; hex: Hex }; // id: __teleport | <area feature>
let armed: Armed | null = null;
let picking: { id: string; needs: "enemy" | "ally" | "hex" | "area" } | null = null;
let enemyTimer: number | null = null;

app.addEventListener(
  "error",
  (e) => {
    const t = e.target as HTMLElement;
    if (t?.classList?.contains("crest-img")) t.classList.add("crest-img--dead");
  },
  true,
);

// ---- character sheet overlay: openable from anywhere via a [data-sheet]/.peek click ----
const sheetRoot = document.createElement("div");
sheetRoot.id = "sheet-root";
sheetRoot.hidden = true;
document.body.appendChild(sheetRoot);
let sheetCharId: string | null = null;

function findCharacter(id: string): Character | null {
  return (
    run?.state.party.find((c) => c.id === id) ??
    run?.pool.find((c) => c.id === id) ??
    guild.roster.find((c) => c.id === id) ??
    marketPool.find((m) => m.character.id === id)?.character ??
    (academyProspect?.character.id === id ? academyProspect.character : null) ??
    null
  );
}
function openSheet(id: string): void {
  sheetCharId = id;
  renderSheet();
}
function closeSheet(): void {
  sheetCharId = null;
  sheetRoot.hidden = true;
  sheetRoot.innerHTML = "";
}

// capture phase: a .peek button always opens the sheet and never triggers whatever's under it
app.addEventListener(
  "click",
  (e) => {
    const peek = (e.target as HTMLElement).closest(".peek") as HTMLElement | null;
    if (peek?.dataset.sheet) {
      e.stopPropagation();
      openSheet(peek.dataset.sheet);
    }
  },
  true,
);
// bubble phase: whole-card click for cards rendered with { sheet: true }
app.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest("[data-sheet]") as HTMLElement | null;
  if (el?.dataset.sheet) openSheet(el.dataset.sheet);
});

// ---------------------------------------------------------------- helpers

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function attrChip(k: AbilityKey, v: number, accent?: string): string {
  const tone = v >= 15 ? "good" : v <= 8 ? "bad" : "";
  return `<div class="attr ${tone} ${accent ? "key" : ""}"${accent ? ` style="--accent:${accent}"` : ""}><i>${k}</i>${v}</div>`;
}

/** the colour of the first class (in draft order) that claims `k` as its key stat */
function statAccentFor(c: Character, k: AbilityKey): string | undefined {
  for (const id of new Set(c.levelHistory)) {
    if (CLASSES[id].primary === k) return classAccent(id);
  }
  return undefined;
}

function weaponLabel(c: Character): string {
  return `${c.weapon.dice}${c.weapon.ranged ? `·r${c.weapon.range}` : ""}`;
}

function characterCard(c: Character, opts: { pick?: boolean; sheet?: boolean; footer?: string } = {}): string {
  const cls = CLASSES[c.classId];
  const race = RACES[c.raceId];
  const accent = classAccent(primaryClassOf(c));
  const traits = c.traitIds
    .map((id) => {
      const t = TRAITS[id];
      return t ? `<span class="tag ${t.kind}" title="${esc(t.text)}">${esc(t.name)}</span>` : "";
    })
    .join("");
  const clickAttr = opts.sheet ? ` data-sheet="${c.id}"` : "";
  return `
  <div class="ucard ${opts.pick ? "ucard--pick" : ""} ${opts.sheet ? "ucard--sheet" : ""}" data-id="${c.id}"${clickAttr} style="--card-accent:${accent}" title="${opts.sheet ? "View sheet" : esc(cls.blurb)}">
    <div class="ucard__head">
      ${crest(c.classId, "sm")}
      <div style="flex:1;min-width:0">
        <div class="ucard__name">${esc(c.name)}</div>
        <div class="ucard__kind">${esc(race.name)} ${esc(classHeaderLabel(c))}</div>
      </div>
      <span class="ucard__lvl">L${c.level}${c.pendingLevelUps ? `<i class="lvlpip">+${c.pendingLevelUps}</i>` : ""}</span>
      <button class="peek" data-sheet="${c.id}" title="View sheet">${icon("rng")}</button>
    </div>
    <div class="statrow">
      ${stat("hp", c.maxHp)} ${stat("def", c.ac)} ${stat("move", c.speed)} ${stat("atk", weaponLabel(c))}
    </div>
    <div class="attrs">${ABILITIES.map((k) => attrChip(k, c.abilities[k], statAccentFor(c, k))).join("")}</div>
    ${traits ? `<div class="taglist">${traits}</div>` : `<div class="sub">— no traits —</div>`}
    ${opts.footer ?? ""}
  </div>`;
}

// ---------------------------------------------------------------- character sheet

function abilityCard(c: Character, k: AbilityKey): string {
  const v = c.abilities[k];
  const m = Math.floor((v - 10) / 2);
  const tone = v >= 15 ? "good" : v <= 8 ? "bad" : "";
  const accent = statAccentFor(c, k);
  return `<div class="ab-card ${accent ? "ab-card--primary" : ""} ${tone ? `ab-card--${tone}` : ""}"${accent ? ` style="--accent:${accent}"` : ""}>
    <span class="ab-card__k">${k}</span>
    <span class="ab-card__v">${v}</span>
    <span class="ab-card__m">${m >= 0 ? "+" : ""}${m}</span>
  </div>`;
}

function classFeatureCard(fs: FeatureSource): string {
  const def = FEATURES[fs.id];
  if (!def) return "";
  const isRace = fs.source.endsWith("(race)");
  const accent = fs.classId ? classAccent(fs.classId) : null;
  return `<details class="fx fx--${isRace ? "race" : "class"}"${accent ? ` style="--accent:${accent}"` : ""}>
    <summary><span class="fx__ic">${icon(isRace ? "chevron" : "star")}</span><span class="fx__name">${esc(def.name)}</span><span class="fx__src">${esc(fs.source)}</span></summary>
    <p class="fx__text">${esc(def.text)}</p>
  </details>`;
}

function traitCard(id: string): string {
  const t = TRAITS[id];
  if (!t) return "";
  return `<details class="fx fx--${t.kind}">
    <summary><span class="fx__ic">${icon(t.kind === "boon" ? "buff" : t.kind === "bane" ? "debuff" : "star")}</span><span class="fx__name">${esc(t.name)}</span><span class="fx__src">Trait · ${t.kind}</span></summary>
    <p class="fx__text">${esc(t.text)}</p>
  </details>`;
}

function classPathLane(c: Character, classId: ClassId, isPrimary: boolean): string {
  const counts = classLevelsOf(c);
  const n = counts[classId] ?? 0;
  const cls = CLASSES[classId];
  const accent = classAccent(classId);
  const dots = Array.from({ length: n }, () => `<span class="lane__dot"></span>`).join("");
  const feats: string[] = [];
  for (let l = 1; l <= n; l++) feats.push(...(cls.features[l] ?? []).map((id) => FEATURES[id]?.name).filter(Boolean) as string[]);
  return `<div class="lane ${isPrimary ? "lane--primary" : ""}" style="--accent:${accent}">
    <div class="lane__head">
      ${crest(classId, "sm")}
      <div style="flex:1"><b>${esc(cls.name)}</b> <span class="sub">Level ${n}</span></div>
      ${isPrimary ? `<span class="pill">Primary</span>` : ""}
    </div>
    <div class="lane__dots">${dots}</div>
    ${feats.length ? `<div class="sub">${feats.map(esc).join(" · ")}</div>` : ""}
  </div>`;
}

function multiclassTeaser(c: Character): string {
  const counts = classLevelsOf(c);
  const notKnown = CLASS_IDS.filter((id) => !(counts[id] ?? 0));
  if (!notKnown.length) return "";
  const openCount = notKnown.filter((id) => admissionFor(c, id).met).length;
  const rows = notKnown
    .map((id) => {
      const adm = admissionFor(c, id);
      const chips = adm.chips.map((ch) => `<span class="reqchip ${ch.met ? "reqchip--met" : ""}">${ch.met ? "✓" : "✕"} ${esc(ch.label)}</span>`).join("");
      return `<div class="mc-row ${adm.met ? "mc-row--open" : ""}" style="--accent:${classAccent(id)}">${crest(id, "xs")}<b>${esc(CLASSES[id].name)}</b><span class="reqchips">${chips}</span></div>`;
    })
    .join("");
  return `<details class="ledger">
    <summary>Multiclass paths — ${openCount} open of ${notKnown.length}</summary>
    <div class="col" style="gap:6px">${rows}</div>
  </details>`;
}

function renderSheet(): void {
  if (!sheetCharId) {
    sheetRoot.hidden = true;
    return;
  }
  const c = findCharacter(sheetCharId);
  if (!c) {
    closeSheet();
    return;
  }
  const race = RACES[c.raceId];
  const frac = c.hp / c.maxHp;
  const statusLabel = frac > 0.66 ? "Healthy" : frac > 0.33 ? "Wounded" : "Critical";
  const statusTone = frac > 0.66 ? "good" : frac > 0.33 ? "warn" : "bad";
  const lanes = [...new Set(c.levelHistory)];
  const primary = primaryClassOf(c);
  const accent = classAccent(primary);

  sheetRoot.hidden = false;
  sheetRoot.innerHTML = `
    <div class="sheet-backdrop" id="sheet-close"></div>
    <div class="sheet-panel" style="--accent:${accent}">
      <div class="sheet-banner"></div>
      <button class="sheet-x" id="sheet-x">${icon("x")}</button>
      <div class="sheet-head">
        ${crest(c.classId, "xl")}
        <div class="sheet-head__info">
          <div class="eyebrow">${esc(race.name)} · ${esc(classHeaderLabel(c))}</div>
          <h2>${esc(c.name)}</h2>
          <div class="row" style="gap:6px">
            <span class="pill" style="color:var(--accent);border-color:var(--accent)">Level ${c.level}</span>
            <span class="pill" style="color:var(--${statusTone});border-color:var(--${statusTone})">${statusLabel}</span>
          </div>
        </div>
      </div>

      <div class="statrow sheet-combat">
        ${stat("hp", `${c.hp}/${c.maxHp}`, statusTone)}
        ${stat("def", c.ac)}
        ${stat("move", c.speed)}
        ${stat("atk", `${c.weapon.name} ${c.weapon.dice}${c.weapon.ranged ? ` · r${c.weapon.range}` : ""}`)}
      </div>

      <h3>Abilities</h3>
      <div class="ability-grid">${ABILITIES.map((k) => abilityCard(c, k)).join("")}</div>

      ${c.skills.length ? `<h3>Skills</h3><div class="taglist">${c.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : ""}

      <h3>Traits &amp; Features</h3>
      <div class="fx-list">${featureSources(c).map(classFeatureCard).join("")}${c.traitIds.map(traitCard).join("")}</div>

      <h3>Class Path</h3>
      <div class="lanes">${lanes.map((id) => classPathLane(c, id, id === primary)).join("")}</div>
      ${multiclassTeaser(c)}
    </div>`;
  document.getElementById("sheet-close")!.addEventListener("click", closeSheet);
  document.getElementById("sheet-x")!.addEventListener("click", closeSheet);
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && sheetCharId) closeSheet();
});

function render(): void {
  const map: Record<Phase, () => void> = {
    found: renderFound,
    settlement: renderSettlement,
    standings: renderStandings,
    market: renderMarket,
    disband: renderDisband,
    descent: renderDescent,
    encounter: renderEncounter,
    aftermath: renderAftermath,
    debrief: renderDebrief,
  };
  map[phase]();
}

// ---------------------------------------------------------------- found the Pit

let foundSigil = SIGILS[0];
function renderFound(): void {
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">Found a concession</div><h1>Name the Pit</h1></div>
    <p class="muted">The Gordion Pit — the knot no one could untie, so they started cutting <i>down</i> through it.
    This is your settlement at its mouth. It stays with you across every run; the dungeon is always new.</p>
    <div class="panel col">
      <span class="eyebrow">The name over the gate</span>
      <input type="text" id="pit-name" maxlength="28" placeholder="The Gordion Pit" />
      <span class="eyebrow">Sigil</span>
      <div class="sigils" id="sigils">${SIGILS.map((s) => `<button class="sigil ${s === foundSigil ? "sigil--on" : ""}" data-s="${s}">${s}</button>`).join("")}</div>
      <div class="row"><button class="primary" id="found">${icon("check")} Found the Pit</button></div>
    </div>
  </div>`;
  document.getElementById("sigils")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-s]") as HTMLElement | null;
    if (!b) return;
    foundSigil = b.dataset.s!;
    renderFound();
  });
  document.getElementById("found")!.addEventListener("click", () => {
    const name = (document.getElementById("pit-name") as HTMLInputElement).value.trim();
    foundGuild(guild, name || "The Gordion Pit", foundSigil);
    applyGuildToConfig(guild);
    phase = "settlement";
    render();
  });
}

// ---------------------------------------------------------------- settlement

function renderSettlement(): void {
  const g = guild;
  const div = divisionOf(g.league);
  const rank = playerRank(g.league);
  const totalWages = g.roster.reduce((s, c) => s + c.salary, 0);
  const rosterFull = g.roster.length >= RUN_CONFIG.partySize;
  const buildingCard = (b: (typeof BUILDINGS)[number]): string => {
    const lvl = buildingLevel(g, b.id);
    const cost = upgradeCost(g, b.id);
    const blocked = upgradeBlocked(g, b.id);
    const dots = Array.from({ length: b.max }, (_, i) => (i < lvl ? "●" : "○")).join("");
    let action: string;
    if (cost === null) action = `<span class="pill">Maxed</span>`;
    else if (blocked) action = `<span class="pill" style="color:var(--bad);border-color:var(--bad)">🔒 ${esc(blocked)}</span>`;
    else
      action = `<button class="${g.gold >= cost ? "primary" : ""}" data-up="${b.id}" ${g.gold >= cost ? "" : "disabled"}>${icon("loot")} ${cost}g</button>`;
    return `
    <div class="bcard">
      <div class="bcard__head"><span class="bcard__glyph">${b.glyph}</span>
        <div><div class="bcard__name">${esc(b.name)}</div><div class="bcard__dots">${dots}</div></div>
      </div>
      <div class="sub">${esc(b.blurb)}</div>
      <div class="bcard__now">Now: ${esc(b.effect(lvl))}</div>
      ${cost !== null && !blocked ? `<div class="bcard__next">Next: ${esc(b.effect(lvl + 1))}</div>` : ""}
      <div class="bcard__act">${action}</div>
    </div>`;
  };

  app.innerHTML = `
  <div class="wrap col">
    <div class="settle-head">
      <div><div class="eyebrow">Settlement</div><h1>${esc(g.sigil)} ${esc(g.name ?? "The Gordion Pit")}</h1></div>
      <div class="statrow">
        ${stat("loot", `${g.gold}g`, "gold", "treasury")}
        ${stat("star", g.renown, "", "renown")}
        ${stat("check", `Deep ${g.bestDepth}`, "", "deepest ever")}
      </div>
    </div>

    <div class="panel league-strip" id="league-strip">
      <div>
        <div class="eyebrow">${esc(div.name)} · fee ${Math.round(div.feePct * 100)}% · season ${g.league.season}</div>
        <div class="league-strip__rank">Rank <b>#${rank}</b> of ${standings(g.league, div.id).length}</div>
      </div>
      <div class="row" style="gap:8px">
        <button id="view-market">${icon("loot")} Recruitment market</button>
        <button id="view-standings">${icon("star")} League table</button>
      </div>
    </div>

    <h2>Roster · ${g.roster.length}/${RUN_CONFIG.partySize}${g.roster.length ? ` · ${stat("loot", `${totalWages}g/fixture`, totalWages > g.gold ? "bad" : "", "wage bill")}` : ""}</h2>
    ${
      g.roster.length
        ? `<div class="cards">${g.roster.map((c) => characterCard(c, { sheet: true, footer: `<div class="sub mono">${icon("loot")} ${c.salary}g / fixture</div>` })).join("")}</div>`
        : `<p class="sub">No one under contract yet — sign your first squad at the Recruitment Market.</p>`
    }

    <div class="pit-panel ${rosterFull ? "" : "pit-panel--locked"}" id="pit">
      <div class="pit-void"></div>
      <div class="pit-copy">
        <div class="eyebrow">The Descent</div>
        <h2 style="color:var(--gold);font-size:22px">Assemble an expedition</h2>
        <p class="sub">${rosterFull ? `Full roster of ${RUN_CONFIG.partySize} ready to go — wages ${totalWages}g this fixture` : `${g.roster.length} of ${RUN_CONFIG.partySize} signed — sign ${RUN_CONFIG.partySize - g.roster.length} more at the Market before you can descend`} · level cap ${RUN_CONFIG.levelCap}${RUN_CONFIG.gearTier ? " · Guild arms issued" : ""}</p>
        <button class="primary big" id="descend-btn" ${rosterFull ? "" : "disabled"}>${icon("extract")} Into the Pit</button>
      </div>
    </div>

    <h2>Buildings</h2>
    <div class="buildings">${BUILDINGS.map(buildingCard).join("")}</div>

    <details class="ledger">
      <summary>The Ledger — ${g.runs.length} runs · ${g.graveyard.length} dead</summary>
      <div class="panel statrow">
        ${stat("loot", `${g.bestBanked}g`, "gold", "richest bank")}
        ${stat("loot", `${g.totalBanked}g`, "", "banked, all-time")}
        ${stat("extract", g.retires, "", "warbands retired")}
        ${stat("skull", g.graveyard.length, "bad", "the fallen")}
      </div>
      ${g.graveyard.length ? `<h3>Hall of the Dead</h3><div class="col" style="gap:6px">${g.graveyard.slice(0, 14).map((x) => `<div class="grave"><div class="n">${esc(x.name)} · Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub">${esc(x.cause)}</div></div>`).join("")}</div>` : ""}
      ${g.runs.length ? `<h3>Recent runs</h3><div class="col" style="gap:4px">${g.runs.slice(0, 10).map((r) => `<div class="sub mono">${r.outcome === "retired" ? "◈" : "☠"} Deep ${r.depth} · ${r.banked}g · ${r.party.map(esc).join(", ")}</div>`).join("")}</div>` : ""}
    </details>
  </div>`;

  document.getElementById("pit")!.addEventListener("click", startRun);
  document.getElementById("descend-btn")!.addEventListener("click", (e) => {
    e.stopPropagation();
    startRun();
  });
  document.getElementById("view-standings")!.addEventListener("click", (e) => {
    e.stopPropagation();
    standingsReturnPhase = "settlement";
    phase = "standings";
    render();
  });
  document.getElementById("view-market")!.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!marketPool.length) rerollMarket();
    phase = "market";
    render();
  });
  app.querySelectorAll<HTMLElement>("[data-up]").forEach((b) => {
    b.addEventListener("click", () => {
      if (doUpgrade(guild, b.dataset.up as never)) {
        flashToast("Built.");
        renderSettlement();
      }
    });
  });
}

function startRun(): void {
  applyGuildToConfig(guild);
  if (guild.roster.length < RUN_CONFIG.partySize) {
    flashToast(`Sign ${RUN_CONFIG.partySize - guild.roster.length} more at the Recruitment Market first.`);
    return;
  }
  run = new Run(undefined, guild.name ?? "The Gordion Pit", guild.roster);
  run.beginDescent();
  phase = "descent";
  render();
}

// ---------------------------------------------------------------- league standings

function formPips(c: ClubStanding): string {
  if (!c.form.length) return `<span class="sub">— no fixtures yet —</span>`;
  return c.form.map((r) => `<span class="formpip formpip--${r === "W" ? "w" : "l"}">${r}</span>`).join("");
}

function renderStandings(): void {
  const div = divisionOf(guild.league);
  const table = standings(guild.league, div.id);
  const rank = playerRank(guild.league);
  const elapsedThisSeason = guild.league.round - (guild.league.season - 1) * SEASON_LENGTH;
  const fixturesLeft = SEASON_LENGTH - elapsedThisSeason;

  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <div><div class="eyebrow">The League — Season ${guild.league.season}</div><h1>${esc(div.name)}</h1></div>
      <span class="sub">Level ${div.level} of ${MAX_LEVEL} · fee ${Math.round(div.feePct * 100)}% of gold earned per fixture · ${fixturesLeft} fixture${fixturesLeft === 1 ? "" : "s"} left this season</span>
    </div>

    <div class="ladder">${Array.from({ length: MAX_LEVEL }, (_, i) => MAX_LEVEL - i)
      .map((lvl) => {
        const groups = divisionsAtLevel(lvl);
        const here = groups.some((g) => g.id === div.id);
        return `<span class="ladder__rung ${here ? "ladder__rung--here" : ""}" title="Level ${lvl}">${esc(groups.map((g) => g.name).join(" / "))}</span>`;
      })
      .join(`<span class="ladder__arrow">${icon("chevron")}</span>`)}</div>

    <p class="sub">Top ${PROMOTE_SLOTS} of the table promote at season's end; bottom ${RELEGATE_SLOTS} relegate — except at the very top or bottom of the pyramid.</p>

    <div class="panel statrow">
      ${stat("star", `#${rank} of ${table.length}`, rank <= 2 ? "good" : rank >= table.length - 1 ? "bad" : "", "your rank")}
      ${stat("loot", `${guild.gold}g`, "gold", "treasury")}
      ${stat("check", table.find((c) => c.isPlayer)?.clears ?? 0, "", "career clears")}
    </div>

    <div class="standings-wrap">
      <table class="standings">
        <thead><tr>
          <th>#</th><th>Club</th><th>Clears</th><th>Gold</th><th>Net</th><th>Fee</th><th>Pts</th><th>Squad</th><th>Form</th>
        </tr></thead>
        <tbody>
          ${table
            .map((c, i) => {
              const rankTone = i === 0 ? "rank-gold" : i === 1 || i === 2 ? "rank-good" : i >= table.length - 2 ? "rank-bad" : "";
              return `
              <tr class="${c.isPlayer ? "standings__row--me" : ""}">
                <td class="mono ${rankTone}">${i + 1}</td>
                <td class="standings__club">${c.isPlayer ? `<span class="pill" style="color:var(--gold);border-color:var(--gold)">YOU</span> ` : ""}${esc(c.name)}</td>
                <td class="mono">${c.clears}</td>
                <td class="mono">${c.goldEarned}g</td>
                <td class="mono" style="color:var(--good)">${c.netGold}g</td>
                <td class="mono" style="color:var(--bad)">−${c.feePaid}g</td>
                <td class="mono">${c.points}</td>
                <td class="mono">${c.squadHealth}</td>
                <td class="formrow">${formPips(c)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="sub">Ranked by clears, then gold earned, then net gold after the league fee, then squad health, then reputation. Fixtures resolve once per run — every rival's row moves the moment you finish yours.</p>

    <div class="row"><button class="primary" id="standings-back">${icon("chevron")} Back</button></div>
  </div>`;

  document.getElementById("standings-back")!.addEventListener("click", () => {
    phase = standingsReturnPhase;
    render();
  });
}

// ---------------------------------------------------------------- recruitment market

function rerollMarket(): void {
  marketRng += 1;
  marketPool = rollMarket(new RNG(`market:${guild.founded}:${marketRng}`), RUN_CONFIG.draftPool);
}

function rerollAcademy(): void {
  academyRng += 1;
  academyProspect = rollAcademyProspect(new RNG(`academy:${guild.founded}:${academyRng}`), buildingLevel(guild, "academy"));
}

function riskTone(risk: MarketRecruit["risk"]): string {
  return risk === "Low" ? "good" : risk === "Medium" ? "warn" : "bad";
}

function riskTagClass(risk: MarketRecruit["risk"]): string {
  return riskTone(risk) === "good" ? "boon" : riskTone(risk) === "bad" ? "bane" : "quirk";
}

function renderMarket(): void {
  const g = guild;
  const full = g.roster.length >= RUN_CONFIG.partySize;
  const academyLvl = buildingLevel(g, "academy");
  if (!academyProspect) rerollAcademy();

  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <div><div class="eyebrow">${esc(g.name ?? "The Gordion Pit")}</div><h1>Recruitment Market</h1></div>
      <div class="statrow">${stat("loot", `${g.gold}g`, "gold", "treasury")}</div>
    </div>
    <p class="sub">There's no blind draft any more — every chaindiver on the books was signed here or trained up through the Sump School. The Market is expensive but exact; the School is cheap but never turns out anyone top-shelf.</p>

    <h2>Roster · ${g.roster.length}/${RUN_CONFIG.partySize}</h2>
    ${
      g.roster.length
        ? `<div class="cards" id="roster-cards">${g.roster
            .map((c) =>
              characterCard(c, {
                footer: `<div class="row" style="justify-content:space-between;align-items:center"><span class="sub mono">${icon("loot")} ${c.salary}g/fixture</span><button class="danger" data-release="${c.id}">${icon("x")} Release</button></div>`,
              }),
            )
            .join("")}</div>`
        : `<p class="sub">No one under contract yet.</p>`
    }

    <div class="spread">
      <h2>Prospects — the Market</h2>
      <button id="scout">${icon("round")} Scout again</button>
    </div>
    ${full ? `<p class="sub">${icon("threat")} Roster full — release someone before signing another.</p>` : ""}
    <div class="cards" id="market-cards">${marketPool
      .map((m) => {
        const affordable = g.gold >= m.price && !full;
        return characterCard(m.character, {
          footer: `
          <div class="row" style="justify-content:space-between;align-items:center">
            <span class="tag ${riskTagClass(m.risk)}">${esc(m.risk)} risk</span>
            <button class="${affordable ? "primary" : ""}" data-sign="${m.character.id}" ${affordable ? "" : "disabled"}>${icon("loot")} Sign — ${m.price}g</button>
          </div>`,
        });
      })
      .join("")}</div>

    <div class="spread">
      <h2>The Sump School — Level ${academyLvl}</h2>
      <button id="train-again">${icon("round")} Train another</button>
    </div>
    <p class="sub">The club's own pipeline. Always available, always cheap, always a rung below what the Market can offer — better funding narrows the gap, never closes it.</p>
    <div class="cards" id="academy-cards">${
      academyProspect
        ? characterCard(academyProspect.character, {
            footer: `
            <div class="row" style="justify-content:space-between;align-items:center">
              <span class="tag ${riskTagClass(academyProspect.risk)}">${esc(academyProspect.risk)} risk</span>
              <button class="${g.gold >= academyProspect.price && !full ? "primary" : ""}" id="train-sign" ${g.gold >= academyProspect.price && !full ? "" : "disabled"}>${icon("loot")} Train — ${academyProspect.price}g</button>
            </div>`,
          })
        : ""
    }</div>

    <div class="row"><button class="primary" id="market-back">${icon("chevron")} Back to the Pit</button></div>
  </div>`;

  document.getElementById("roster-cards")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-release]") as HTMLElement | null;
    if (!btn) return;
    const id = btn.dataset.release!;
    g.roster = g.roster.filter((c) => c.id !== id);
    saveGuild(g);
    flashToast("Released. Their contract's torn up.");
    renderMarket();
  });
  document.getElementById("market-cards")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-sign]") as HTMLElement | null;
    if (!btn) return;
    const id = btn.dataset.sign!;
    const m = marketPool.find((x) => x.character.id === id);
    if (!m || g.gold < m.price || g.roster.length >= RUN_CONFIG.partySize) return;
    g.gold -= m.price;
    g.roster.push(m.character);
    marketPool = marketPool.filter((x) => x.character.id !== id);
    saveGuild(g);
    flashToast(`${m.character.name} signed for ${m.price}g.`);
    renderMarket();
  });
  document.getElementById("scout")!.addEventListener("click", () => {
    rerollMarket();
    renderMarket();
  });
  document.getElementById("train-again")!.addEventListener("click", () => {
    rerollAcademy();
    renderMarket();
  });
  document.getElementById("train-sign")?.addEventListener("click", () => {
    if (!academyProspect || g.gold < academyProspect.price || g.roster.length >= RUN_CONFIG.partySize) return;
    g.gold -= academyProspect.price;
    g.roster.push(academyProspect.character);
    saveGuild(g);
    flashToast(`${academyProspect.character.name} graduates from the Sump School.`);
    academyProspect = null;
    renderMarket();
  });
  document.getElementById("market-back")!.addEventListener("click", () => {
    phase = "settlement";
    render();
  });
}

// ---------------------------------------------------------------- disbandment

let rebuildSigil = SIGILS[0];
function renderDisband(): void {
  const g = guild;
  const player = g.league.clubs.find((c) => c.isPlayer)!;
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">The club collapses</div><h1>${esc(g.name ?? "The Gordion Pit")} is finished</h1></div>
    <div class="panel col" style="border-color:var(--bad)">
      <p class="log__line t-bad">${icon("skull")}<span>${esc(pendingDisbandReason ?? "The club can't continue.")}</span></p>
      <div class="statrow">
        ${stat("check", `Deep ${g.bestDepth}`, "", "deepest ever reached")}
        ${stat("star", player.careerClears, "", "career clears")}
        ${stat("skull", g.graveyard.length, "bad", "names in the Hall of the Dead")}
      </div>
      <p class="sub">The roster disbands and most of the treasury is lost. The Ledger — records, the dead, past runs — survives; the club drops to the bottom of the pyramid (Level ${MAX_LEVEL}) and starts its league record fresh.</p>
    </div>

    <div class="panel col">
      <span class="eyebrow">Refound under a new name</span>
      <input type="text" id="rebuild-name" maxlength="28" placeholder="${esc(g.name ?? "The Gordion Pit")}" />
      <span class="eyebrow">Sigil</span>
      <div class="sigils" id="rebuild-sigils">${SIGILS.map((s) => `<button class="sigil ${s === rebuildSigil ? "sigil--on" : ""}" data-s="${s}">${s}</button>`).join("")}</div>
      <div class="row"><button class="primary" id="rebuild">${icon("check")} Rebuild</button></div>
    </div>
  </div>`;

  document.getElementById("rebuild-sigils")!.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("[data-s]") as HTMLElement | null;
    if (!b) return;
    rebuildSigil = b.dataset.s!;
    renderDisband();
  });
  document.getElementById("rebuild")!.addEventListener("click", () => {
    const name = (document.getElementById("rebuild-name") as HTMLInputElement).value.trim();
    disbandAndRebuild(g, name || g.name || "The Gordion Pit");
    g.sigil = rebuildSigil;
    saveGuild(g);
    applyGuildToConfig(g);
    pendingDisbandReason = null;
    phase = "settlement";
    render();
  });
}

// ---------------------------------------------------------------- descent

function renderDescent(): void {
  if (!run) return;
  const st = run.state;
  const extractionHere = st.depth > 0 && run.currentFloor?.kind === "extraction";
  const kindIcon: Record<string, string> = {
    combat: icon("atk"),
    elite: icon("star"),
    extraction: icon("extract"),
    boss: icon("boss"),
  };

  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <div><div class="eyebrow">${esc(st.guildName)}</div><h1>Deep ${st.depth} — the way down</h1></div>
      <span class="sub">seed <span class="kbd">${esc(st.seed)}</span></span>
    </div>
    <div class="panel statrow">
      ${stat("loot", `${st.gold}g`, "gold", "carrying")}
      ${stat("check", `${st.bankedGold}g`, "", "banked — safe")}
      ${stat("hp", `${st.party.length}/${run.partySize}`, "", "warband")}
      ${stat("star", run.avgPartyLevel().toFixed(1), "", "avg level")}
    </div>

    ${extractionHere ? renderExtractionPanel() : ""}

    <div class="cards">
      ${st.nextFloors
        .map(
          (c, i) => `
        <div class="ucard ucard--pick${c.kind === "boss" ? " ucard--boss" : ""}" data-idx="${i}">
          <div class="ucard__head">
            <div><div class="ucard__name">${esc(c.label)}</div>
              <div class="ucard__kind">${kindIcon[c.kind] ?? ""} ${esc(c.biome)}</div></div>
            ${
              c.kind === "boss"
                ? `<span class="pill pill--boss" title="boss">${icon("boss")} BOSS</span>`
                : `<span class="pill pill--threat" title="threat">${icon("skull").repeat(c.threat)}</span>`
            }
          </div>
          ${c.modifiers.length ? `<div class="taglist">${c.modifiers.map((m) => `<span class="tag">${esc(m)}</span>`).join("")}</div>` : ""}
          <div class="sub">${esc(c.blurb)}</div>
        </div>`,
        )
        .join("")}
    </div>

    <h2>Warband</h2>
    <div class="cards">${st.party.map((c) => characterCard(c, { sheet: true })).join("")}</div>
  </div>`;

  document.querySelectorAll<HTMLElement>(".ucard[data-idx]").forEach((el) => {
    el.addEventListener("click", () => {
      const cand = run!.state.nextFloors[parseInt(el.dataset.idx!, 10)];
      const e = run!.enterFloor(cand);
      if (e === null) {
        run!.currentFloor = cand;
        run!.state.depth = cand.depth;
        render();
        return;
      }
      enc = e;
      armed = null;
      picking = null;
      phase = "encounter";
      render();
    });
  });
  wireExtractionButtons();
}

function renderExtractionPanel(): string {
  const st = run!.state;
  const cap = run!.bankCap;
  return `
  <div class="panel panel--gold col">
    <h2>${icon("extract")} Extraction Shaft</h2>
    <p class="sub">Use it, send it, or lose it. The Vault takes up to ${cap >= 100000 ? "everything" : cap + "g"} per shaft.</p>
    <div class="row">
      <button id="ex-bank" ${st.gold <= 0 ? "disabled" : ""}>${icon("check")} Bank ${Math.min(st.gold, cap)}g, press on</button>
      <button class="primary" id="ex-retire">${icon("extract")} Retire — end the run</button>
    </div>
  </div>`;
}

function wireExtractionButtons(): void {
  document.getElementById("ex-bank")?.addEventListener("click", () => {
    flashToast(`Banked ${run!.bankGold()}g to the surface.`);
    render();
  });
  document.getElementById("ex-retire")?.addEventListener("click", () => {
    const { bonus } = run!.retire();
    report = { won: true, deaths: [], levelUps: [], loot: bonus, xpEach: 0, bossKilled: false };
    finishRun();
  });
}

// ---------------------------------------------------------------- encounter

function renderEncounter(): void {
  if (!enc) return;
  app.innerHTML = `
  <div class="wrap col">
    <div class="enc-top">
      <h1>Deep ${enc.depth}</h1>
      <span class="enc-obj">${icon(enc.objective.kind === "extract" ? "extract" : "atk")} ${esc(enc.objective.description)}</span>
    </div>
    <div id="boss-banner"></div>
    <div class="enc-layout">
      <div>
        <div id="board-holder"><canvas id="board"></canvas></div>
        <div class="legend">
          <span>${icon("move")} move</span><span>${icon("atk")} attack</span>
          <span><span class="sw" style="background:rgba(198,90,58,.4)"></span> threatened</span>
          <span><span class="sw" style="background:#93a14f"></span> acid</span>
          <span><span class="sw" style="background:#9a9384"></span> spikes</span>
          <span><span class="sw" style="background:#d5713a"></span> fire</span>
          <span><span class="sw" style="background:#9276b6"></span> gas</span>
          <span><span class="sw" style="background:rgba(220,60,50,.5);border:1px dashed rgba(220,60,50,.95)"></span> boss telegraph — will land here</span>
          <span>▲ high ground</span>
        </div>
      </div>
      <div class="hud" id="hud"></div>
    </div>
    <div class="log" id="log"></div>
  </div>`;

  const canvas = document.getElementById("board") as HTMLCanvasElement;
  board = new BoardView(canvas);
  board.cb.onHexClick = onHexClick;
  board.cb.onHexHover = onHexHover;
  board.setEncounter(enc);
  enc.onChange = () => refreshEncounter();

  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKey);
  refreshEncounter();
}

function onResize(): void {
  board?.fit();
}
function onKey(e: KeyboardEvent): void {
  if (phase !== "encounter" || !enc || enc.phase !== "player") return;
  if (e.key === " " || e.key === "Enter") {
    e.preventDefault();
    if (armed) executeArmed();
    else enc.endTurn();
    refreshEncounter();
  } else if (e.key === "Escape") {
    armed = null;
    picking = null;
    refreshEncounter();
  }
}

function teardownEncounter(): void {
  window.removeEventListener("resize", onResize);
  document.removeEventListener("keydown", onKey);
  if (enemyTimer) {
    clearTimeout(enemyTimer);
    enemyTimer = null;
  }
}

function onHexHover(h: Hex | null): void {
  if (!enc || !board) return;
  board.pathPreview = [];
  if (!armed && !picking && h && enc.phase === "player" && enc.active && board.reachable.has(key(h)) && !enc.unitAt(h)) {
    const p = enc.pathTo(enc.active, h);
    if (p) board.pathPreview = p;
  }
  board.draw();
}

function onHexClick(h: Hex): void {
  if (!enc || !board) return;
  if (enc.phase === "deploy") {
    enc.placeNext(h);
    return;
  }
  if (enc.phase !== "player" || !enc.active) return;
  const u = enc.active;
  const targetU = enc.unitAt(h);

  // second tap on the armed thing → confirm
  if (armed) {
    const confirm =
      (armed.t === "move" && eq(armed.hex, h)) ||
      (armed.t === "hex" && eq(armed.hex, h)) ||
      (armed.t === "target" && targetU?.id === armed.unitId);
    if (confirm) {
      executeArmed();
      return;
    }
  }

  // arm a new candidate for this tap
  if (picking) {
    if (picking.needs === "enemy" && targetU?.team === "enemy") {
      armed = { t: "target", id: picking.id, unitId: targetU.id };
    } else if (picking.needs === "ally" && targetU?.team === "player") {
      armed = { t: "target", id: picking.id, unitId: targetU.id };
    } else if (picking.needs === "hex" && !targetU) {
      armed = { t: "hex", id: "__teleport", hex: h };
    } else if (picking.needs === "area") {
      armed = { t: "hex", id: picking.id, hex: h };
    } else {
      armed = null;
    }
  } else if (targetU && targetU.team === "enemy" && enc.attackTargets(u).some((z) => z.id === targetU.id)) {
    armed = { t: "target", id: "__attack", unitId: targetU.id };
  } else if (!targetU && enc.moveOptions(u).has(key(h))) {
    armed = { t: "move", hex: h };
  } else {
    armed = null;
  }
  refreshEncounter();
}

function executeArmed(): void {
  if (!enc || !armed) return;
  const a = armed;
  armed = null;
  picking = null;
  if (a.t === "move") enc.moveTo(a.hex);
  else if (a.t === "target") {
    if (a.id === "__attack") enc.doAttack(a.unitId);
    else if (a.id === "__shove") enc.shove(a.unitId);
    else enc.useFeature(a.id, a.unitId);
  } else if (a.t === "hex") {
    if (a.id === "__teleport") enc.teleport(a.hex);
    else enc.areaFeature(a.id, a.hex);
  }
  refreshEncounter();
}

function refreshEncounter(): void {
  if (!enc || !board || phase !== "encounter") return;

  board.deploy = enc.phase === "deploy" ? enc.deployZone : [];
  board.armedMove = null;
  board.armedTargetId = null;
  board.armedArea = [];
  board.targetables = new Set();
  board.bossTelegraph = enc.units
    .filter((u) => u.alive && u.boss?.telegraph)
    .flatMap((u) => u.boss!.telegraph!.hexes);

  if (enc.phase === "player" && enc.active) {
    const u = enc.active;
    board.reachable = enc.moveOptions(u);
    board.attackable = new Set(enc.attackTargets(u).map((t) => key(t.pos)));
    board.threatened = enc.threatenedHexes();

    if (picking) {
      if (picking.needs === "enemy")
        board.targetables = new Set(
          (picking.id === "__attack" ? enc.attackTargets(u) : enc.enemiesOf(u)).map((z) => key(z.pos)),
        );
      else if (picking.needs === "ally")
        board.targetables = new Set([u, ...enc.allies(u)].map((z) => key(z.pos)));
    }
    const a = armed;
    if (a) {
      if (a.t === "move") {
        board.armedMove = a.hex;
        const p = enc.pathTo(u, a.hex);
        if (p) board.pathPreview = p;
      } else if (a.t === "target") {
        board.armedTargetId = a.unitId;
      } else if (a.t === "hex") {
        board.armedArea = a.id === "__teleport" ? [a.hex] : enc.areaHexes(a.id, a.hex);
      }
    }
  } else {
    board.reachable = new Map();
    board.attackable = new Set();
    board.threatened = enc.phase === "deploy" ? enc.threatenedHexes() : new Set();
  }
  board.draw();
  renderHud();
  renderLog();
  const bannerEl = document.getElementById("boss-banner");
  if (bannerEl) bannerEl.innerHTML = bossBanner();

  if (enc.phase === "won" || enc.phase === "lost") {
    teardownEncounter();
    const won = enc.phase === "won";
    setTimeout(() => {
      report = run!.resolveEncounter();
      if (report.bossKilled) {
        const gained = 25 + run!.state.depth;
        guild.renown += gained;
        saveGuild(guild);
        flashToast(`★ Boss down — +${gained} Renown`);
      }
      if (won && !run!.state.over) {
        phase = "aftermath";
        render();
      } else finishRun();
    }, 700);
    return;
  }
  if (enc.phase === "enemy") {
    if (enemyTimer) clearTimeout(enemyTimer);
    enemyTimer = window.setTimeout(() => {
      if (!enc || enc.phase !== "enemy") return;
      enc.runEnemyTurn();
      refreshEncounter();
    }, 480);
  }
}

function renderHud(): void {
  if (!enc) return;
  const hud = document.getElementById("hud")!;
  const active = enc.active;

  if (enc.phase === "deploy") {
    const placed = enc.units.filter((u) => u.team === "player").length;
    hud.innerHTML = `
      <div class="active-panel">
        <div class="active-panel__name">${icon("extract")} Deploy — ${placed}/${placed + enc.toDeploy.length}</div>
        <p class="sub">Tap a green tile per fighter. Every enemy and its plan is already visible — the red wash is where they can reach you.</p>
        <button class="primary" id="auto">${icon("check")} Auto-deploy</button>
      </div>
      <div class="roster">${roster()}</div>`;
    document.getElementById("auto")?.addEventListener("click", () => {
      enc!.autoDeploy();
      refreshEncounter();
    });
    return;
  }

  const cls = enc.phase === "player" ? "turnbar--player" : "turnbar--enemy";
  const who = enc.phase === "player" ? esc(active?.name ?? "") : "Enemy turn";
  hud.innerHTML = `
    <div class="turnbar ${cls}">
      <span class="turnbar__who">${who}</span>
      <span class="turnbar__round">${icon("round")} Round ${enc.round}</span>
    </div>
    ${armedBar()}
    ${active && active.team === "player" ? activePanel(active) : `<p class="hint">${icon("threat")} Watch the reticles.</p>`}
    <div class="roster">${roster()}</div>`;

  document.getElementById("confirm-btn")?.addEventListener("click", () => {
    executeArmed();
    refreshEncounter();
  });
  document.getElementById("cancel-btn")?.addEventListener("click", () => {
    armed = null;
    picking = null;
    refreshEncounter();
  });
  if (active && active.team === "player") wirePlayerControls();
}

function armedBar(): string {
  if (!enc || !enc.active) return "";
  const u = enc.active;
  let label = "";
  if (picking && !armed) {
    label = `<span class="hint">${icon("threat")} Tap ${picking.needs === "area" ? "the centre of the blast" : "a " + picking.needs} on the board</span>`;
    return `<div class="armbar">${label}<button id="cancel-btn">${icon("x")}</button></div>`;
  }
  const a = armed;
  if (!a) return "";
  if (a.t === "move") {
    const cost = enc.moveOptions(u).get(key(a.hex)) ?? 0;
    label = `${icon("move")} Move here — ${cost} of ${enc.moveBudget(u)}`;
  } else if (a.t === "target") {
    const tu = enc.units.find((z) => z.id === a.unitId);
    if (["__attack", "power_attack", "divine_smite", "cleave"].includes(a.id)) {
      const pv = tu ? enc.attackPreview(u, tu) : null;
      label = `${icon("atk")} ${a.id === "__attack" ? "Attack" : FEATNAME(a.id)} ${esc(tu?.name ?? "")}${pv ? ` — ${Math.round(pv.chance * 100)}% · ${pv.minDmg}–${pv.maxDmg}` : ""}`;
    } else {
      label = `${icon("star")} ${FEATNAME(a.id)} → ${esc(tu?.name ?? "")}`;
    }
  } else {
    if (a.id === "__teleport") label = `${icon("dash")} Blink here`;
    else {
      const hit = enc.units.filter((z) => z.alive && board!.armedArea.some((ah) => eq(ah, z.pos)));
      label = `${icon("star")} ${FEATNAME(a.id)} — ${hit.length} in the blast`;
    }
  }
  return `<div class="armbar armbar--live">
    <span>${label}</span>
    <span class="row" style="gap:4px">
      <button class="primary" id="confirm-btn">${icon("check")} Confirm</button>
      <button id="cancel-btn">${icon("x")}</button>
    </span>
  </div>`;
}

function FEATNAME(id: string): string {
  if (id === "__attack") return "Attack";
  if (id === "__shove") return "Shove";
  if (id === "__teleport") return "Misty Step";
  return FEATURES[id]?.name ?? id[0].toUpperCase() + id.slice(1).replace(/_/g, " ");
}

function bossBanner(): string {
  if (!enc) return "";
  const boss = enc.units.find((u) => u.boss && u.alive);
  if (!boss || !boss.boss) return "";
  const bd = BOSSES[boss.boss.defId];
  if (!bd) return "";
  const pct = Math.max(0, Math.round((boss.hp / boss.maxHp) * 100));
  const phase = boss.boss.phase;
  const phaseText = bd.phases[phase - 1]?.text ?? "";
  const tg = boss.boss.telegraph;
  return `
  <div class="boss-banner">
    <div class="boss-banner__row">
      <span class="boss-banner__name">${icon("boss")} ${esc(bd.name)}</span>
      <span class="boss-banner__phase">Phase ${phase + 1}${phase >= bd.phases.length ? " — last stand" : ""}</span>
      <span class="boss-banner__hp">${boss.hp}/${boss.maxHp} HP</span>
    </div>
    <div class="boss-banner__bar"><div class="boss-banner__fill" style="width:${pct}%"></div></div>
    ${phaseText ? `<div class="boss-banner__flavor">${esc(phaseText)}</div>` : ""}
    ${tg ? `<div class="boss-banner__telegraph">${icon("threat")} winding up ${esc(tg.name)} — get clear of the marked tiles</div>` : ""}
  </div>`;
}

function activePanel(u: Unit): string {
  const e = enc!;
  const move = e.moveBudget(u);
  const feats = e.featureButtons(u);
  const shoveN = e.shoveTargets(u).length;
  const canAttack = !u.actionUsed && e.attackTargets(u).length > 0;
  const btn = (act: string, ic: Parameters<typeof icon>[0], label: string, on: boolean, danger = false) =>
    `<button data-act="${act}" class="${danger ? "danger" : ""}" ${on ? "" : "disabled"}>${icon(ic)} ${label}</button>`;

  const conds = u.conditions
    .map((c) => {
      const m = CONDITION_ICON[c.kind];
      return m ? `<span class="cond cond--${m.tone}" title="${m.label}">${icon(m.icon)}</span>` : "";
    })
    .join("");

  return `
  <div class="active-panel">
    <div class="row" style="gap:10px;flex-wrap:nowrap">
      ${crest(unitClassId(u), "md")}
      <div style="flex:1;min-width:0">
        <div class="active-panel__name">${esc(u.name)}</div>
        <span class="conds">${conds}</span>
      </div>
    </div>
    <div class="statrow">
      ${stat("hp", `${u.hp}/${u.maxHp}`, u.hp <= u.maxHp * 0.25 ? "bad" : u.hp <= u.maxHp * 0.5 ? "warn" : "good")}
      ${stat("def", u.ac)}
      ${stat("atk", `${u.weapon.dice}${u.damageBonus >= 0 ? "+" : ""}${u.damageBonus}`)}
      ${u.weapon.range > 1 ? stat("rng", u.weapon.range) : ""}
    </div>
    <div class="pips">
      <span class="pip pip--move ${move > 0 ? "pip--on" : "pip--spent"}">${icon("move")} ${move}</span>
      <span class="pip ${u.actionUsed ? "pip--spent" : "pip--on"}">ACT</span>
      <span class="pip ${u.bonusUsed ? "pip--spent" : "pip--on"}">BON</span>
    </div>
    <div class="actiongrid">
      ${btn("attack", "atk", "Attack", canAttack)}
      ${btn("dash", "dash", "Dash", !u.actionUsed)}
      ${btn("disengage", "disengage", "Disengage", !u.actionUsed)}
      ${btn("dodge", "dodge", "Dodge", !u.actionUsed)}
      ${shoveN ? btn("shove", "shove", `Shove`, !u.actionUsed) : ""}
    </div>
    ${
      feats.length
        ? `<div class="actiongrid">${feats
            .map(
              (f) =>
                `<button data-feat="${f.id}" data-needs="${f.needsTarget}" data-self="${f.selfCentered ? 1 : 0}" ${f.enabled ? "" : "disabled"} title="${esc(f.text)}">${icon(f.kind === "bonus" ? "buff" : "star")} ${esc(f.name)}</button>`,
            )
            .join("")}</div>`
        : ""
    }
    <div class="row">
      <button class="primary" data-act="end">${icon("check")} End turn</button>
      ${btn("giveup", "x", "", true)}
    </div>
  </div>`;
}

function wirePlayerControls(): void {
  const hud = document.getElementById("hud")!;
  hud.querySelectorAll<HTMLElement>("[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      if (!enc || !enc.active) return;
      const a = b.dataset.act!;
      armed = null;
      if (a === "attack") picking = { id: "__attack", needs: "enemy" };
      else if (a === "shove") picking = { id: "__shove", needs: "enemy" };
      else if (a === "dash") { picking = null; enc.dash(); }
      else if (a === "disengage") { picking = null; enc.disengage(); }
      else if (a === "dodge") { picking = null; enc.dodge(); }
      else if (a === "end") { picking = null; enc.endTurn(); }
      else if (a === "giveup") {
        if (confirm("Abandon the run? Everything on your bodies is lost.")) {
          enc.phase = "lost";
        }
      }
      refreshEncounter();
    });
  });
  hud.querySelectorAll<HTMLElement>("[data-feat]").forEach((b) => {
    b.addEventListener("click", () => {
      if (!enc || !enc.active) return;
      const id = b.dataset.feat!;
      const needs = b.dataset.needs as "enemy" | "ally" | "none" | "hex" | "area";
      const self = b.dataset.self === "1";
      armed = null;
      picking = null;
      if (needs === "none") enc.useFeature(id);
      else if (needs === "area" && self) armed = { t: "hex", id, hex: { ...enc.active.pos } };
      else picking = { id, needs };
      refreshEncounter();
    });
  });
}

function roster(): string {
  if (!enc) return "";
  return enc.units
    .filter((u) => u.alive || u.downed)
    .sort((a, b) => (a.team === b.team ? 0 : a.team === "player" ? -1 : 1))
    .map((u) => {
      const frac = u.hp / u.maxHp;
      const hpCls = frac > 0.5 ? "" : frac > 0.25 ? "hpbar--hurt" : "hpbar--crit";
      const active = enc!.active?.id === u.id;
      const conds = u.conditions
        .map((c) => {
          const m = CONDITION_ICON[c.kind];
          return m ? `<span class="cond cond--${m.tone}" title="${m.label}">${icon(m.icon)}</span>` : "";
        })
        .join("");
      const intent =
        u.team === "enemy" && u.alive && u.intent && u.intent.kind !== "wait"
          ? `<span class="intent" title="${esc(u.intent.note)}">${icon(u.intent.kind === "attack" ? "atk" : "move")}${u.intent.targetId ? "→" + initialOf(u.intent.targetId) : ""}</span>`
          : "";
      return `
      <div class="urow urow--${u.team} ${active ? "urow--active" : ""} ${u.downed ? "urow--downed" : ""}">
        <span class="urow__bar"></span>
        <div class="urow__main">
          <div class="urow__line"><span class="urow__name">${esc(u.name)}</span><span class="conds">${conds}</span></div>
          ${u.downed ? `<div class="hint" style="font-size:10px">${icon("downed")} down — ${u.deathFail}/3</div>` : `<div class="hpbar ${hpCls}"><i style="width:${Math.max(0, frac * 100)}%"></i></div>`}
        </div>
        <div class="urow__side">
          <span class="urow__hp" style="color:${frac > 0.5 ? "var(--good)" : frac > 0.25 ? "var(--warn)" : "var(--bad)"}">${u.downed ? "—" : u.hp}</span>
          ${intent || `<span class="sub mono" style="font-size:10px">AC${u.ac}</span>`}
        </div>
      </div>`;
    })
    .join("");
}

function initialOf(unitId: string): string {
  const u = enc?.units.find((z) => z.id === unitId);
  return u ? (u.name[0] ?? "?").toUpperCase() : "?";
}
function unitClassId(u: Unit): string {
  return u.tags.find((t) => t in CLASSES) ?? "fighter";
}

function renderLog(): void {
  const el = document.getElementById("log");
  if (!el || !enc) return;
  el.innerHTML = enc.log
    .slice(-40)
    .reverse()
    .map((l) => {
      const s = logStyle(l);
      const ic = s.icon ? icon(s.icon) : `<span class="ic"></span>`;
      return `<div class="log__line ${s.tone ? "t-" + s.tone : ""}">${ic}<span>${esc(l.replace(/^—\s*/, ""))}</span></div>`;
    })
    .join("");
}

// ---------------------------------------------------------------- aftermath / debrief

function renderAftermath(): void {
  if (!run || !report) return;
  const r = report;
  const pending = run.state.party.filter((c) => c.pendingLevelUps > 0);
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">Aftermath</div><h1>Deep ${run.state.depth} cleared</h1></div>
    <div class="panel col">
      <div class="statrow">
        ${stat("loot", `+${r.loot}g`, "gold", "looted")}
        ${stat("check", `${run.state.gold}g`, "", "carrying")}
        ${r.deaths.length ? stat("skull", r.deaths.length, "bad", "lost") : stat("hp", run.state.party.length, "good", "all alive")}
      </div>
      ${r.deaths.length ? `<p class="log__line t-bad">${icon("skull")}<span>Lost: ${r.deaths.map(esc).join(", ")} — gear salvaged.</span></p>` : ""}
      ${r.levelUps.length ? `<p class="log__line t-good">${icon("star")}<span>Level up: ${r.levelUps.map((l) => `${esc(l.name)} +${l.count}`).join(", ")}</span></p>` : `<p class="sub">No level-ups this floor.</p>`}
    </div>

    ${pending.length ? `<h2>${icon("star")} Choose advancement — ${pending.reduce((s, c) => s + c.pendingLevelUps, 0)} level-up${pending.reduce((s, c) => s + c.pendingLevelUps, 0) > 1 ? "s" : ""} to assign</h2>
    <div class="col" id="lvlups">${pending.map(levelUpChooser).join("")}</div>` : ""}

    <h2>Warband</h2>
    <div class="cards">${run.state.party.map((c) => characterCard(c, { sheet: true })).join("")}</div>
    <div class="row">
      <button class="primary" id="go" ${pending.length ? "disabled" : ""}>${icon("chevron")} Onward</button>
      ${pending.length ? `<span class="hint">${icon("threat")} Assign every level before moving on</span>` : ""}
    </div>
  </div>`;
  wireLevelUpChooser();
  document.getElementById("go")!.addEventListener("click", () => {
    if (run!.state.party.some((c) => c.pendingLevelUps > 0)) return;
    enc = null;
    phase = "descent";
    render();
  });
}

function levelUpChooser(c: Character): string {
  const counts = classLevelsOf(c);
  const options = CLASS_IDS.map((id) => {
    const known = (counts[id] ?? 0) > 0;
    const adm = admissionFor(c, id);
    const cls = CLASSES[id];
    const label = known ? `${cls.name} ${(counts[id] ?? 0) + 1}` : cls.name;
    const chips = adm.chips.map((ch) => `${ch.met ? "✓" : "✗"} ${ch.label}`).join("  ·  ");
    const style = known ? ` style="--accent:${classAccent(id)}"` : "";
    return `<button data-lvl="${id}" class="${known ? "accent-btn" : ""}"${style} ${known || adm.met ? "" : "disabled"} title="${esc(known ? "Advance a class you already have." : chips)}">${crest(id, "xs")} ${esc(label)}</button>`;
  });
  return `
  <div class="panel lvlup" data-char="${c.id}">
    <div class="row" style="gap:10px;flex-wrap:nowrap">
      ${crest(c.classId, "sm")}
      <div style="flex:1;min-width:0">
        <b>${esc(c.name)}</b> <span class="sub">${esc(classLabel(c))} · level ${c.level} → ${c.level + 1}</span>
      </div>
      <span class="pill">${c.pendingLevelUps} pending</span>
    </div>
    <div class="actiongrid">${options.join("")}</div>
  </div>`;
}

function wireLevelUpChooser(): void {
  document.getElementById("lvlups")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-lvl]") as HTMLElement | null;
    const panel = (e.target as HTMLElement).closest("[data-char]") as HTMLElement | null;
    if (!btn || !panel || !run) return;
    const c = run.state.party.find((x) => x.id === panel.dataset.char);
    if (!c) return;
    if (applyLevelUp(c, btn.dataset.lvl as ClassId)) {
      flashToast(`${c.name} advances — now ${classLabel(c)}.`);
      renderAftermath();
    }
  });
}

function finishRun(): void {
  if (!run) return;
  const st = run.state;
  const outcome = st.outcome ?? "wipe";
  const cleared = outcome === "retired";
  // survivors carry over: healed up and kept on the books for next time
  guild.roster = st.party.map((c) => ({ ...c, hp: c.maxHp }));
  const wages = guild.roster.reduce((s, c) => s + c.salary, 0);
  const fixtureDiv = divisionOf(guild.league); // the division the fee was actually charged in
  const { fee, net, seasonEnded, promoted, relegated, newDivisionId } = recordFixture(guild.league, {
    cleared,
    floorsCleared: st.depth,
    goldEarned: st.bankedGold,
    squadHealth: guild.roster.length,
    reputation: guild.renown,
  });
  const netAfterWages = net - wages;
  fixtureResult = {
    cleared,
    gross: st.bankedGold,
    fee,
    wages,
    net: netAfterWages,
    seasonEnded,
    promoted,
    relegated,
    newDivisionId,
    divisionName: fixtureDiv.name,
    feePct: fixtureDiv.feePct,
  };
  recordRun(
    guild,
    { seed: st.seed, depth: st.depth, outcome, banked: st.bankedGold, fee, wages, net: netAfterWages, party: st.party.map((c) => c.name) },
    st.graveyard,
  );
  pendingDisbandReason = checkDisbandment(guild);
  applyGuildToConfig(guild);
  teardownEncounter();
  phase = "debrief";
  render();
}

function renderDebrief(): void {
  if (!run) return;
  const st = run.state;
  const retired = st.outcome === "retired";
  const fx = fixtureResult;
  const div = divisionOf(guild.league);
  const rank = playerRank(guild.league);
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">${retired ? "Extraction" : "Wipe"}</div><h1>${retired ? "The warband retires" : "The Deep keeps them"}</h1></div>
    <div class="panel col">
      <div class="statrow">
        ${stat("chevron", `Deep ${st.depth}`, "", "reached")}
        ${stat("check", `+${st.bankedGold}g`, "gold", "gross earned")}
        ${!retired ? stat("loot", `${st.gold}g`, "bad", "lost with the bodies") : ""}
      </div>
      <p class="sub">${retired ? `Everyone got out.${report ? ` Retirement bonus +${report.loot}g.` : ""}` : `Only what was banked at a shaft made it up.`}</p>
      ${st.graveyard.length ? `<h3>Fallen this run</h3><div class="col" style="gap:6px">${st.graveyard.map((x) => `<div class="grave"><div class="n">${esc(x.name)} · Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub">${esc(x.cause)}</div></div>`).join("")}</div>` : ""}
    </div>

    ${fx ? `
    <div class="panel col league-fixture">
      <div class="eyebrow">${esc(fx.divisionName)} — fixture result</div>
      <div class="statrow">
        ${stat(fx.cleared ? "check" : "skull", fx.cleared ? "CLEAR" : "LOSS", fx.cleared ? "good" : "bad", "fixture outcome")}
        ${stat("loot", `${fx.gross}g`, "gold", "gross earned")}
        ${stat("loot", `−${fx.fee}g`, "bad", `league fee (${Math.round(fx.feePct * 100)}%)`)}
        ${stat("loot", `−${fx.wages}g`, "bad", "roster wages")}
        ${stat(fx.net >= 0 ? "check" : "skull", `${fx.net >= 0 ? "+" : ""}${fx.net}g`, fx.net >= 0 ? "good" : "bad", "to the treasury")}
      </div>
      <p class="sub">Treasury now <b style="color:${guild.gold < 0 ? "var(--bad)" : "inherit"}">${guild.gold}g</b>${guild.gold < 0 ? " — in debt" : ""}. League rank: <b>#${rank}</b> of ${standings(guild.league, div.id).length} in ${esc(div.name)}.</p>
    </div>` : ""}

    ${
      fx?.promoted
        ? `<div class="panel col" style="border-color:var(--good)"><p class="log__line t-good">${icon("star")}<span>Season ${guild.league.season - 1} done — <b>promoted</b> to ${esc(div.name)}. The fee's steeper up here.</span></p></div>`
        : fx?.relegated
          ? `<div class="panel col" style="border-color:var(--bad)"><p class="log__line t-bad">${icon("skull")}<span>Season ${guild.league.season - 1} done — <b>relegated</b> to ${esc(div.name)}.</span></p></div>`
          : fx?.seasonEnded
            ? `<div class="panel col"><p class="sub">${icon("round")} Season ${guild.league.season - 1} done — the table's reset, you're holding your spot in ${esc(div.name)}.</p></div>`
            : ""
    }

    <div class="row">
      <button class="primary" id="home">${icon("extract")} Back to the Pit</button>
      <button id="debrief-standings">${icon("star")} League table</button>
    </div>
  </div>`;
  document.getElementById("home")!.addEventListener("click", () => {
    run = null;
    enc = null;
    report = null;
    fixtureResult = null;
    phase = pendingDisbandReason ? "disband" : "settlement";
    render();
  });
  document.getElementById("debrief-standings")!.addEventListener("click", () => {
    standingsReturnPhase = "debrief";
    phase = "standings";
    render();
  });
}

// ---------------------------------------------------------------- toast + dev

function flashToast(msg: string): void {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#1b1410;border:1px solid var(--gold);color:#ece0cd;padding:8px 15px;border-radius:5px;z-index:9998;font:13px/1.3 var(--font-mono);max-width:90vw;text-align:center";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}

function maybeDevJump(): boolean {
  const p = new URLSearchParams(location.search);
  const d = p.get("dev");
  if (d === "settle") {
    guild.name = guild.name ?? "Dev Pit";
    guild.gold = 9000;
    const player0 = guild.league.clubs.find((c) => c.isPlayer);
    if (player0) player0.name = guild.name;
    if (!guild.roster.length && p.get("empty") === null) {
      const rng = new RNG("dev-settle-roster");
      guild.roster = ["fighter", "cleric", "rogue"].map((cid) => makeCharacter(rng, { classId: cid as ClassId }));
    }
    phase = "settlement";
    return true;
  }
  if (d === "market") {
    guild.name = guild.name ?? "Dev Pit";
    guild.gold = 900;
    applyGuildToConfig(guild);
    const playerM = guild.league.clubs.find((c) => c.isPlayer);
    if (playerM) playerM.name = guild.name;
    if (!guild.roster.length) {
      const rng = new RNG("dev-market-roster");
      guild.roster = ["fighter", "cleric"].map((cid) => makeCharacter(rng, { classId: cid as ClassId }));
    }
    rerollMarket();
    phase = "market";
    return true;
  }
  if (d === "disband") {
    guild.name = guild.name ?? "Dev Pit";
    guild.gold = 12;
    guild.bestDepth = 6;
    guild.graveyard.push({ name: "Sair the Fourth", epitaph: "Chased the wounded thing one hex too far.", depth: 4, cause: "slain by The Warden" });
    guild.roster = [];
    pendingDisbandReason = "The roster was wiped out — there's no one left to field.";
    phase = "disband";
    return true;
  }
  if (d === "standings") {
    guild.name = guild.name ?? "Dev Pit";
    const player1 = guild.league.clubs.find((c) => c.isPlayer);
    if (player1) player1.name = guild.name;
    standingsReturnPhase = "settlement";
    phase = "standings";
    return true;
  }
  if (d === "debrief") {
    guild.name = guild.name ?? "Dev Pit";
    applyGuildToConfig(guild);
    const player2 = guild.league.clubs.find((c) => c.isPlayer);
    if (player2) player2.name = guild.name;
    if (p.get("releg")) {
      // climb a tier first so there's somewhere to fall from
      for (let i = 0; i < SEASON_LENGTH; i++) {
        recordFixture(guild.league, { cleared: true, floorsCleared: 20, goldEarned: 999999, squadHealth: 3, reputation: 0 });
      }
    }
    if (p.get("promo") || p.get("releg")) {
      const good = !!p.get("promo");
      for (let i = 0; i < SEASON_LENGTH - 1; i++) {
        recordFixture(guild.league, {
          cleared: good,
          floorsCleared: good ? 20 : 0,
          goldEarned: good ? 999999 : 0,
          squadHealth: 3,
          reputation: 0,
        });
      }
    }
    run = new Run(p.get("seed") || "debrief-seed", guild.name);
    while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
    run.beginDescent();
    run.state.gold = 240;
    if (p.get("wipe")) {
      run.state.over = true;
      run.state.outcome = "wipe";
    } else {
      run.retire();
    }
    finishRun();
    return true;
  }
  if (d === "sheet") {
    guild.name = guild.name ?? "Dev Pit";
    applyGuildToConfig(guild);
    RUN_CONFIG.levelCap = 8;
    run = new Run(p.get("seed") || "sheet-seed");
    while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
    run.beginDescent();
    run.state.party.forEach((c, i) => {
      grantXp(c, 50000);
      const leaveOne = i === 0 && p.get("pending") !== null;
      let g = 0;
      while (c.pendingLevelUps > (leaveOne ? 1 : 0) && g++ < 20) {
        const known = new Set(c.levelHistory);
        const branch = c.level >= 2 && known.size < 2 ? CLASS_IDS.find((id) => !known.has(id) && admissionFor(c, id).met) : undefined;
        applyLevelUp(c, branch ?? c.classId);
      }
    });
    report = { won: true, deaths: [], levelUps: [], loot: 40, xpEach: 0, bossKilled: false };
    phase = "aftermath";
    if (p.get("open")) openSheet(run.state.party[0].id);
    return true;
  }
  if (d === "boss") {
    applyGuildToConfig(guild);
    run = new Run(p.get("seed") || "boss-dev");
    while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
    run.beginDescent();
    const bossCand = { ...run.state.nextFloors[0], kind: "boss" as const, depth: 5, label: "Dev Boss Floor" };
    const e = run.enterFloor(bossCand);
    if (e) {
      e.autoDeploy();
      const rounds = parseInt(p.get("rounds") || "0", 10);
      for (let g = 0; g < rounds * 40 && (e.phase === "player" || e.phase === "enemy"); g++) {
        if (e.phase === "enemy") {
          e.runEnemyTurn();
          continue;
        }
        const u = e.active;
        if (!u) {
          e.endTurn();
          continue;
        }
        const t = e.attackTargets(u).sort((a, b) => a.hp - b.hp)[0];
        if (t && !u.actionUsed) {
          e.doAttack(t.id);
          continue;
        }
        const foes = e.units.filter((x) => x.team === "enemy" && x.alive);
        let moved = false;
        if (foes.length && e.moveBudget(u) > 0) {
          let best: string | null = null,
            bd = Infinity;
          for (const k of e.moveOptions(u).keys()) {
            const [q, r] = k.split(",").map(Number);
            const dd = Math.min(...foes.map((f) => Math.abs(f.pos.q - q) + Math.abs(f.pos.r - r)));
            if (dd < bd) {
              bd = dd;
              best = k;
            }
          }
          if (best) {
            const [q, r] = best.split(",").map(Number);
            moved = e.moveTo({ q, r });
          }
        }
        if (!moved) e.endTurn();
      }
      enc = e;
      phase = "encounter";
    }
    return true;
  }
  if (d !== "enc") return false;
  applyGuildToConfig(guild);
  run = new Run(p.get("seed") || "dev-seed");
  while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
  run.beginDescent();
  const e = run.enterFloor(run.state.nextFloors[0]);
  if (e) {
    e.autoDeploy();
    const rounds = parseInt(p.get("rounds") || "0", 10);
    for (let g = 0; g < rounds * 40 && (e.phase === "player" || e.phase === "enemy"); g++) {
      if (e.phase === "enemy") {
        e.runEnemyTurn();
        continue;
      }
      const u = e.active;
      if (!u) {
        e.endTurn();
        continue;
      }
      const t = e.attackTargets(u).sort((a, b) => a.hp - b.hp)[0];
      if (t && !u.actionUsed) {
        e.doAttack(t.id);
        continue;
      }
      const foes = e.units.filter((x) => x.team === "enemy" && x.alive);
      let moved = false;
      if (foes.length && e.moveBudget(u) > 0) {
        let best: string | null = null,
          bd = Infinity;
        for (const k of e.moveOptions(u).keys()) {
          const [q, r] = k.split(",").map(Number);
          const dd = Math.min(...foes.map((f) => Math.abs(f.pos.q - q) + Math.abs(f.pos.r - r)));
          if (dd < bd) {
            bd = dd;
            best = k;
          }
        }
        if (best) {
          const [q, r] = best.split(",").map(Number);
          moved = e.moveTo({ q, r });
        }
      }
      if (!moved) e.endTurn();
    }
    let guard2 = 0;
    while (e.phase === "enemy" && guard2++ < 30) e.runEnemyTurn();
    enc = e;
    phase = "encounter";
    if (p.get("arm") === "move" && e.phase === "player" && e.active) {
      const first = [...e.moveOptions(e.active).keys()][0];
      if (first) {
        const [q, r] = first.split(",").map(Number);
        armed = { t: "move", hex: { q, r } };
      }
    }
  }
  return true;
}

maybeDevJump();
render();
