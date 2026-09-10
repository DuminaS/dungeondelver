import "./style.css";
import { Hex, eq, key } from "./core/hex";
import { AbilityKey, ABILITIES, Character, Unit } from "./game/types";
import { CLASSES, FEATURES, RACES, TRAITS } from "./game/data";
import { RUN_CONFIG } from "./game/config";
import {
  BUILDINGS,
  Guild,
  applyGuildToConfig,
  buildingLevel,
  doUpgrade,
  foundGuild,
  loadGuild,
  recordRun,
  SIGILS,
  upgradeBlocked,
  upgradeCost,
} from "./game/guild";
import { Run, EncounterReport } from "./game/descent";
import { Encounter } from "./game/encounter";
import { BoardView } from "./ui/render";
import { CONDITION_ICON, icon, logStyle, stat } from "./ui/icons";
import { crest } from "./ui/crests";

const VERSION = __APP_VERSION__;
document.getElementById("build-badge")!.textContent = VERSION;

type Phase = "found" | "settlement" | "draft" | "descent" | "encounter" | "aftermath" | "debrief";

const app = document.getElementById("app")!;
let guild: Guild = loadGuild();
applyGuildToConfig(guild);
let phase: Phase = guild.name ? "settlement" : "found";
let run: Run | null = null;
let enc: Encounter | null = null;
let board: BoardView | null = null;
let report: EncounterReport | null = null;

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

// ---------------------------------------------------------------- helpers

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function attrChip(k: AbilityKey, v: number, primary: boolean): string {
  const tone = v >= 15 ? "good" : v <= 8 ? "bad" : "";
  return `<div class="attr ${tone} ${primary ? "key" : ""}"><i>${k}</i>${v}</div>`;
}

function weaponLabel(c: Character): string {
  return `${c.weapon.dice}${c.weapon.ranged ? `·r${c.weapon.range}` : ""}`;
}

function characterCard(c: Character, opts: { pick?: boolean } = {}): string {
  const cls = CLASSES[c.classId];
  const race = RACES[c.raceId];
  const traits = c.traitIds
    .map((id) => {
      const t = TRAITS[id];
      return t ? `<span class="tag ${t.kind}" title="${esc(t.text)}">${esc(t.name)}</span>` : "";
    })
    .join("");
  return `
  <div class="ucard ${opts.pick ? "ucard--pick" : "ucard--player"}" data-id="${c.id}" title="${esc(cls.blurb)}">
    <div class="ucard__head">
      ${crest(c.classId, "sm")}
      <div style="flex:1;min-width:0">
        <div class="ucard__name">${esc(c.name)}</div>
        <div class="ucard__kind">${esc(race.name)} ${esc(cls.name)}</div>
      </div>
      <span class="ucard__lvl">L${c.level}</span>
    </div>
    <div class="statrow">
      ${stat("hp", c.maxHp)} ${stat("def", c.ac)} ${stat("move", c.speed)} ${stat("atk", weaponLabel(c))}
    </div>
    <div class="attrs">${ABILITIES.map((k) => attrChip(k, c.abilities[k], k === cls.primary)).join("")}</div>
    ${traits ? `<div class="taglist">${traits}</div>` : `<div class="sub">— no traits —</div>`}
  </div>`;
}

function render(): void {
  const map: Record<Phase, () => void> = {
    found: renderFound,
    settlement: renderSettlement,
    draft: renderDraft,
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

    <div class="pit-panel" id="pit">
      <div class="pit-void"></div>
      <div class="pit-copy">
        <div class="eyebrow">The Descent</div>
        <h2 style="color:var(--gold);font-size:22px">Assemble an expedition</h2>
        <p class="sub">Draft ${RUN_CONFIG.partySize} from a pool of ${RUN_CONFIG.draftPool} · level cap ${RUN_CONFIG.levelCap}${RUN_CONFIG.gearTier ? " · Guild arms issued" : ""}</p>
        <button class="primary big" id="descend-btn">${icon("extract")} Into the Pit</button>
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
  run = new Run(undefined, guild.name ?? "The Gordion Pit");
  phase = "draft";
  render();
}

// ---------------------------------------------------------------- draft

function renderDraft(): void {
  if (!run) return;
  const need = run.partySize - run.state.party.length;
  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <div><div class="eyebrow">Draft — pick ${need} more of ${run.partySize}</div><h1>Your warband</h1></div>
      <span class="sub">seed <span class="kbd">${esc(run.state.seed)}</span></span>
    </div>
    <p class="sub">Every pick re-rolls the whole pool. You can't wait for a card to come back.</p>

    <div class="row">
      <button id="mull" ${run.mulligansLeft > 0 ? "" : "disabled"}>${icon("round")} Mulligan (${run.mulligansLeft})</button>
      <button id="adroll" title="A rewarded ad in the shipped game — free here">${icon("star")} Reroll — watch ad</button>
    </div>

    <h2>Pool</h2>
    <div class="cards" id="pool">${run.pool.map((c) => characterCard(c, { pick: true })).join("")}</div>

    <h2>Warband · ${run.state.party.length}/${run.partySize}</h2>
    <div class="cards">${run.state.party.map((c) => characterCard(c)).join("") || '<p class="sub">— empty —</p>'}</div>

    ${run.draftComplete ? `<div class="row"><button class="primary" id="descend">${icon("chevron")} Descend into the Pit</button></div>` : ""}
  </div>`;

  document.getElementById("pool")!.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest(".ucard") as HTMLElement | null;
    if (!el || !run) return;
    run.pickRecruit(el.dataset.id!);
    render();
  });
  document.getElementById("mull")?.addEventListener("click", () => {
    if (run!.mulligan()) render();
  });
  document.getElementById("adroll")?.addEventListener("click", () => {
    run!.adReroll();
    flashToast("▶ Ad placeholder — pool re-rolled (free in playtest)");
    render();
  });
  document.getElementById("descend")?.addEventListener("click", () => {
    run!.beginDescent();
    phase = "descent";
    render();
  });
}

// ---------------------------------------------------------------- descent

function renderDescent(): void {
  if (!run) return;
  const st = run.state;
  const extractionHere = st.depth > 0 && run.currentFloor?.kind === "extraction";
  const kindIcon: Record<string, string> = { combat: icon("atk"), elite: icon("star"), extraction: icon("extract") };

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
        <div class="ucard ucard--pick" data-idx="${i}">
          <div class="ucard__head">
            <div><div class="ucard__name">${esc(c.label)}</div>
              <div class="ucard__kind">${kindIcon[c.kind] ?? ""} ${esc(c.biome)}</div></div>
            <span class="pill pill--threat" title="threat">${icon("skull").repeat(c.threat)}</span>
          </div>
          ${c.modifiers.length ? `<div class="taglist">${c.modifiers.map((m) => `<span class="tag">${esc(m)}</span>`).join("")}</div>` : ""}
          <div class="sub">${esc(c.blurb)}</div>
        </div>`,
        )
        .join("")}
    </div>

    <h2>Warband</h2>
    <div class="cards">${st.party.map((c) => characterCard(c)).join("")}</div>
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
    report = { won: true, deaths: [], levelUps: [], loot: bonus, xpEach: 0 };
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

  if (enc.phase === "won" || enc.phase === "lost") {
    teardownEncounter();
    const won = enc.phase === "won";
    setTimeout(() => {
      report = run!.resolveEncounter();
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
      ${r.levelUps.length ? `<p class="log__line t-good">${icon("star")}<span>Level up: ${r.levelUps.map((l) => `${esc(l.name)} → L${l.to}`).join(", ")}</span></p>` : `<p class="sub">No level-ups this floor.</p>`}
    </div>
    <h2>Warband</h2>
    <div class="cards">${run.state.party.map((c) => characterCard(c)).join("")}</div>
    <div class="row"><button class="primary" id="go">${icon("chevron")} Onward</button></div>
  </div>`;
  document.getElementById("go")!.addEventListener("click", () => {
    enc = null;
    phase = "descent";
    render();
  });
}

function finishRun(): void {
  if (!run) return;
  const st = run.state;
  const outcome = st.outcome ?? "wipe";
  recordRun(
    guild,
    { seed: st.seed, depth: st.depth, outcome, banked: st.bankedGold, party: st.party.map((c) => c.name) },
    st.graveyard,
  );
  applyGuildToConfig(guild);
  teardownEncounter();
  phase = "debrief";
  render();
}

function renderDebrief(): void {
  if (!run) return;
  const st = run.state;
  const retired = st.outcome === "retired";
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">${retired ? "Extraction" : "Wipe"}</div><h1>${retired ? "The warband retires" : "The Deep keeps them"}</h1></div>
    <div class="panel col">
      <div class="statrow">
        ${stat("chevron", `Deep ${st.depth}`, "", "reached")}
        ${stat("check", `+${st.bankedGold}g`, "gold", "to the treasury")}
        ${!retired ? stat("loot", `${st.gold}g`, "bad", "lost with the bodies") : ""}
      </div>
      <p class="sub">${retired ? `Everyone got out.${report ? ` Retirement bonus +${report.loot}g.` : ""}` : `Only what was banked at a shaft made it up.`}
      Treasury now <b>${guild.gold}g</b>.</p>
      ${st.graveyard.length ? `<h3>Fallen this run</h3><div class="col" style="gap:6px">${st.graveyard.map((x) => `<div class="grave"><div class="n">${esc(x.name)} · Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub">${esc(x.cause)}</div></div>`).join("")}</div>` : ""}
    </div>
    <div class="row"><button class="primary" id="home">${icon("extract")} Back to the Pit</button></div>
  </div>`;
  document.getElementById("home")!.addEventListener("click", () => {
    run = null;
    enc = null;
    report = null;
    phase = "settlement";
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
    phase = "settlement";
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
