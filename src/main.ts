import "./style.css";
import { Hex, key } from "./core/hex";
import { AbilityKey, ABILITIES, Character, CLASS_IDS, Unit } from "./game/types";
import { CLASSES, RACES, TRAITS } from "./game/data";
import { Run, EncounterReport, PARTY_SIZE } from "./game/descent";
import { Encounter } from "./game/encounter";
import { BoardView } from "./ui/render";
import { loadMeta, Meta, recordRun } from "./ui/meta";
import { CONDITION_ICON, icon, logStyle, stat } from "./ui/icons";
import { crest } from "./ui/crests";

const VERSION = __APP_VERSION__;
document.getElementById("build-badge")!.textContent = VERSION;

type Phase = "title" | "draft" | "descent" | "encounter" | "aftermath" | "gameover";

const app = document.getElementById("app")!;
let phase: Phase = "title";
let run: Run | null = null;
let enc: Encounter | null = null;
let board: BoardView | null = null;
let report: EncounterReport | null = null;
let meta: Meta = loadMeta();

let pendingFeature: { id: string; needs: "ally" | "enemy" | "none" | "hex" } | null = null;
let enemyTimer: number | null = null;

// crest art that 404s / fails to decode -> fall back to the SVG role glyph
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
      ${stat("hp", c.maxHp)}
      ${stat("def", c.ac)}
      ${stat("move", c.speed)}
      ${stat("atk", weaponLabel(c))}
    </div>
    <div class="attrs">
      ${ABILITIES.map((k) => attrChip(k, c.abilities[k], k === cls.primary)).join("")}
    </div>
    ${traits ? `<div class="taglist">${traits}</div>` : `<div class="sub">— no traits —</div>`}
  </div>`;
}

function render(): void {
  ({ title: renderTitle, draft: renderDraft, descent: renderDescent, encounter: renderEncounter, aftermath: renderAftermath, gameover: renderGameOver })[phase]();
}

// ---------------------------------------------------------------- title

function renderTitle(): void {
  const g = meta.graveyard.slice(0, 6);
  app.innerHTML = `
  <div class="wrap center col">
    <div>
      <div class="eyebrow">A roguelike descent</div>
      <h1>Depthdiver</h1>
    </div>
    <p class="muted">The Gordion Pit — the knot no one could untie, so they started cutting <i>down</i> through it.
    Roll a warband of nobodies, draft ${PARTY_SIZE}, see how deep they get before the Deep keeps them.</p>
    <div class="crestrow crestrow--wrap">${CLASS_IDS.map((c) => crest(c, "md")).join("")}</div>
    <p class="eyebrow">13 classes · draft any of them</p>

    <div class="panel col">
      <span class="eyebrow">Run seed — blank for random</span>
      <div class="row">
        <input type="text" id="seed" placeholder="ash-lantern-207" />
        <button class="primary" id="start">${icon("extract")} Enter the Pit</button>
      </div>
      <p class="sub">Same seed + same picks = the same run.</p>
    </div>

    <div class="panel col">
      <h2>Board key</h2>
      <ul class="keyed">
        <li>${icon("move")}<span><b>Move</b> — hover a blue tile, click to go. Leaving an enemy's reach draws a free hit unless you Disengage.</span></li>
        <li>${icon("atk")}<span><b>Attack</b> — click an enemy inside the red brackets. High ground = better odds.</span></li>
        <li>${icon("threat")}<span><b>Red wash</b> — tiles an enemy can hit next turn. <b>Dashed line + reticle</b> — that enemy's plan.</span></li>
        <li>${icon("hazard")}<span><b>Hazards</b> — acid, spikes, fire, gas. <b>▲</b> marks high ground. <span style="color:var(--gold)">${icon("extract")}</span> is the way out.</span></li>
        <li>${icon("skull")}<span><b>Permadeath.</b> Downed isn't dead if an ally reaches them. The run banks only what you carry to an Extraction Shaft.</span></li>
      </ul>
    </div>

    ${meta.runs.length ? `
    <div class="panel col">
      <h2>The Gordion Pit — records</h2>
      <div class="statrow">
        ${stat("chevron", `Deep ${meta.bestDepth}`, "", "deepest")}
        ${stat("loot", `${meta.bestBanked}g`, "gold", "richest bank")}
        ${stat("loot", `${meta.totalBanked}g`, "", "total banked")}
        ${stat("skull", meta.graveyard.length, "bad", "the dead")}
      </div>
      ${g.length ? `<h3>Hall of the Dead</h3>${g.map((x) => `<div class="grave"><div class="n">${esc(x.name)} · Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub">${esc(x.cause)}</div></div>`).join("")}` : ""}
    </div>` : ""}
  </div>`;

  document.getElementById("start")!.addEventListener("click", () => {
    const seed = (document.getElementById("seed") as HTMLInputElement).value.trim() || undefined;
    run = new Run(seed);
    phase = "draft";
    render();
  });
}

// ---------------------------------------------------------------- draft

function renderDraft(): void {
  if (!run) return;
  const need = PARTY_SIZE - run.state.party.length;
  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <div><div class="eyebrow">Draft — pick ${need} more</div><h1>Your warband</h1></div>
      <span class="sub">seed <span class="kbd">${esc(run.state.seed)}</span></span>
    </div>
    <p class="sub">Every pick re-rolls the whole pool. You can't wait for a card to come back.</p>

    <h2>Pool</h2>
    <div class="cards" id="pool">${run.pool.map((c) => characterCard(c, { pick: true })).join("")}</div>

    <h2>Warband · ${run.state.party.length}/${PARTY_SIZE}</h2>
    <div class="cards">${run.state.party.map((c) => characterCard(c)).join("") || '<p class="sub">— empty —</p>'}</div>

    ${run.draftComplete ? `<div class="row"><button class="primary" id="descend">${icon("chevron")} Descend into the Pit</button></div>` : ""}
  </div>`;

  document.getElementById("pool")!.addEventListener("click", (e) => {
    const el = (e.target as HTMLElement).closest(".ucard") as HTMLElement | null;
    if (!el || !run) return;
    run.pickRecruit(el.dataset.id!);
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
      ${stat("hp", `${st.party.length}/${PARTY_SIZE}`, "", "warband")}
      ${stat("star", run.avgPartyLevel().toFixed(1), "", "avg level")}
    </div>

    ${extractionHere ? renderExtractionPanel() : ""}

    <div class="cards">
      ${st.nextFloors.map((c, i) => `
        <div class="ucard ucard--pick" data-idx="${i}">
          <div class="ucard__head">
            <div>
              <div class="ucard__name">${esc(c.label)}</div>
              <div class="ucard__kind">${kindIcon[c.kind] ?? ""} ${esc(c.biome)}</div>
            </div>
            <span class="pill pill--threat" title="threat">${icon("skull").repeat(c.threat)}</span>
          </div>
          ${c.modifiers.length ? `<div class="taglist">${c.modifiers.map((m) => `<span class="tag">${esc(m)}</span>`).join("")}</div>` : ""}
          <div class="sub">${esc(c.blurb)}</div>
        </div>`).join("")}
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
      phase = "encounter";
      render();
    });
  });
  wireExtractionButtons();
}

function renderExtractionPanel(): string {
  const st = run!.state;
  return `
  <div class="panel panel--gold col">
    <h2>${icon("extract")} Extraction Shaft</h2>
    <p class="sub">Use it, send it, or lose it. Press on and the gold rides on your bodies.</p>
    <div class="row">
      <button id="ex-bank" ${st.gold <= 0 ? "disabled" : ""}>${icon("check")} Bank ${st.gold}g, press on</button>
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
          <span>${icon("move")} move</span>
          <span>${icon("atk")} attack</span>
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

function onResize(): void { board?.fit(); }
function onKey(e: KeyboardEvent): void {
  if (phase !== "encounter" || !enc) return;
  if ((e.key === " " || e.key === "Enter") && enc.phase === "player") {
    e.preventDefault();
    enc.endTurn();
    refreshEncounter();
  }
}

function teardownEncounter(): void {
  window.removeEventListener("resize", onResize);
  document.removeEventListener("keydown", onKey);
  if (enemyTimer) { clearTimeout(enemyTimer); enemyTimer = null; }
}

function onHexHover(h: Hex | null): void {
  if (!enc || !board) return;
  board.pathPreview = [];
  if (h && enc.phase === "player" && enc.active && board.reachable.has(key(h)) && !enc.unitAt(h)) {
    const p = enc.pathTo(enc.active, h);
    if (p) board.pathPreview = p;
  }
  board.draw();
}

function onHexClick(h: Hex): void {
  if (!enc || !board) return;
  if (enc.phase === "deploy") { enc.placeNext(h); return; }
  if (enc.phase !== "player" || !enc.active) return;
  const u = enc.active;
  const target = enc.unitAt(h);

  if (pendingFeature) {
    if (pendingFeature.needs === "hex") {
      if (!target) enc.teleport(h);
    } else {
      const wantEnemy = pendingFeature.needs === "enemy";
      if (target && (wantEnemy ? target.team === "enemy" : target.team === "player")) {
        if (pendingFeature.id === "__shove") {
          if (enc.shoveTargets(u).includes(target)) enc.shove(target.id);
        } else if (pendingFeature.id === "__attack") {
          if (enc.attackTargets(u).includes(target)) enc.doAttack(target.id);
        } else {
          enc.useFeature(pendingFeature.id, target.id);
        }
      }
    }
    pendingFeature = null;
    refreshEncounter();
    return;
  }
  if (target && target.team === "enemy" && enc.attackTargets(u).includes(target)) {
    enc.doAttack(target.id);
    return;
  }
  if (!target && board.reachable.has(key(h))) enc.moveTo(h);
}

function refreshEncounter(): void {
  if (!enc || !board || phase !== "encounter") return;

  board.deploy = enc.phase === "deploy" ? enc.deployZone : [];
  if (enc.phase === "player" && enc.active) {
    board.reachable = enc.moveOptions(enc.active);
    board.attackable = new Set(enc.attackTargets(enc.active).map((t) => key(t.pos)));
    board.threatened = enc.threatenedHexes();
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
      if (won && !run!.state.over) { phase = "aftermath"; render(); }
      else finishRun();
    }, 700);
    return;
  }
  if (enc.phase === "enemy") {
    if (enemyTimer) clearTimeout(enemyTimer);
    enemyTimer = window.setTimeout(() => {
      if (!enc || enc.phase !== "enemy") return;
      enc.runEnemyTurn();
      refreshEncounter();
    }, 500);
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
        <p class="sub">Click a green tile per fighter. Every enemy and its plan is already visible — the red wash is where they can reach you.</p>
        <button class="primary" id="auto">${icon("check")} Auto-deploy</button>
      </div>
      <div class="roster">${roster()}</div>`;
    document.getElementById("auto")?.addEventListener("click", () => { enc!.autoDeploy(); refreshEncounter(); });
    return;
  }

  const cls = enc.phase === "player" ? "turnbar--player" : "turnbar--enemy";
  const who = enc.phase === "player" ? esc(active?.name ?? "") : "Enemy turn";
  hud.innerHTML = `
    <div class="turnbar ${cls}">
      <span class="turnbar__who">${who}</span>
      <span class="turnbar__round">${icon("round")} Round ${enc.round}</span>
    </div>
    ${active && active.team === "player" ? activePanel(active) : `<p class="hint">${icon("threat")} Watch the reticles.</p>`}
    <div class="roster">${roster()}</div>`;

  if (active && active.team === "player") wirePlayerControls();
}

function activePanel(u: Unit): string {
  const e = enc!;
  const move = e.moveBudget(u);
  const feats = e.featureButtons(u);
  const shoveN = e.shoveTargets(u).length;
  const canAttack = !u.actionUsed && e.attackTargets(u).length > 0;
  const btn = (act: string, ic: Parameters<typeof icon>[0], label: string, on: boolean, cls = "") =>
    `<button data-act="${act}" class="${cls}" ${on ? "" : "disabled"}>${icon(ic)} ${label}</button>`;

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
      ${shoveN ? btn("shove", "shove", `Shove ${shoveN}`, !u.actionUsed) : ""}
    </div>
    ${feats.length ? `<div class="actiongrid">${feats.map((f) => `<button data-feat="${f.id}" data-needs="${f.needsTarget}" ${f.enabled ? "" : "disabled"} title="${esc(f.text)}">${icon(f.kind === "bonus" ? "buff" : "star")} ${esc(f.name)}</button>`).join("")}</div>` : ""}
    <div class="row">
      <button class="primary" data-act="end">${icon("check")} End turn</button>
      <button class="danger" data-act="giveup" title="Abandon the run">${icon("x")}</button>
    </div>
    ${pendingFeature ? `<p class="hint">${icon("threat")} Pick a ${pendingFeature.needs} target on the board</p>` : ""}
  </div>`;
}

function wirePlayerControls(): void {
  const hud = document.getElementById("hud")!;
  hud.querySelectorAll<HTMLElement>("[data-act]").forEach((b) => {
    b.addEventListener("click", () => {
      if (!enc) return;
      const a = b.dataset.act!;
      if (a === "attack") { pendingFeature = { id: "__attack", needs: "enemy" }; }
      else if (a === "dash") enc.dash();
      else if (a === "disengage") enc.disengage();
      else if (a === "dodge") enc.dodge();
      else if (a === "end") enc.endTurn();
      else if (a === "shove") {
        const t = enc.shoveTargets(enc.active!);
        if (t.length === 1) enc.shove(t[0].id);
        else pendingFeature = { id: "__shove", needs: "enemy" };
      } else if (a === "giveup") {
        if (confirm("Abandon the run? Everything on your bodies is lost.")) {
          enc.phase = "lost";
          refreshEncounter();
          return;
        }
      }
      refreshEncounter();
    });
  });
  hud.querySelectorAll<HTMLElement>("[data-feat]").forEach((b) => {
    b.addEventListener("click", () => {
      if (!enc) return;
      const id = b.dataset.feat!;
      const needs = b.dataset.needs as "ally" | "enemy" | "none" | "hex";
      if (needs === "none") { enc.useFeature(id); refreshEncounter(); }
      else { pendingFeature = { id, needs }; refreshEncounter(); }
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
      const state = u.downed ? "urow--downed" : "";
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
      <div class="urow urow--${u.team} ${active ? "urow--active" : ""} ${state}">
        <span class="urow__bar"></span>
        <div class="urow__main">
          <div class="urow__line">
            <span class="urow__name">${esc(u.name)}</span>
            <span class="conds">${conds}</span>
          </div>
          ${u.downed ? `<div class="hint" style="font-size:10px">${icon("downed")} down — ${u.deathFail}/3</div>` : `<div class="hpbar ${hpCls}"><i style="width:${Math.max(0, frac * 100)}%"></i></div>`}
        </div>
        <div class="urow__side">
          <span class="urow__hp" style="color:${frac > 0.5 ? "var(--good)" : frac > 0.25 ? "var(--warn)" : "var(--bad)"}">${u.downed ? "—" : `${u.hp}`}</span>
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

// ---------------------------------------------------------------- aftermath

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
  document.getElementById("go")!.addEventListener("click", () => { enc = null; phase = "descent"; render(); });
}

// ---------------------------------------------------------------- game over

function finishRun(): void {
  if (!run) return;
  const st = run.state;
  const outcome = st.outcome ?? "wipe";
  meta = recordRun(
    meta,
    { seed: st.seed, depth: st.depth, outcome, banked: st.bankedGold, party: st.party.map((c) => c.name) },
    st.graveyard,
  );
  teardownEncounter();
  phase = "gameover";
  render();
}

function renderGameOver(): void {
  if (!run) return;
  const st = run.state;
  const retired = st.outcome === "retired";
  app.innerHTML = `
  <div class="wrap center col">
    <div><div class="eyebrow">${retired ? "Extraction" : "Wipe"}</div><h1>${retired ? "The warband retires" : "The Deep keeps them"}</h1></div>
    <div class="panel col">
      <div class="statrow">
        ${stat("chevron", `Deep ${st.depth}`, "", "reached")}
        ${stat("check", `${st.bankedGold}g`, "gold", "banked")}
        ${!retired ? stat("loot", `${st.gold}g`, "bad", "lost with the bodies") : ""}
      </div>
      <p class="sub">${retired
        ? `Everyone got out.${report ? ` Retirement bonus +${report.loot}g.` : ""}`
        : `Only what was sent up earlier survives.`}</p>
      ${st.graveyard.length ? `<h3>Fallen this run</h3>${st.graveyard.map((x) => `<div class="grave"><div class="n">${esc(x.name)} · Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub">${esc(x.cause)}</div></div>`).join("")}` : ""}
    </div>
    <div class="panel statrow">
      ${stat("chevron", `Deep ${meta.bestDepth}`, "", "deepest ever")}
      ${stat("loot", `${meta.bestBanked}g`, "gold", "richest bank")}
      ${stat("loot", `${meta.totalBanked}g`, "", "total banked")}
    </div>
    <div class="row">
      <button class="primary" id="again">${icon("round")} New run</button>
      <button id="title">Title</button>
    </div>
  </div>`;
  document.getElementById("again")!.addEventListener("click", () => {
    run = new Run(); enc = null; report = null; phase = "draft"; render();
  });
  document.getElementById("title")!.addEventListener("click", () => {
    run = null; enc = null; phase = "title"; render();
  });
}

// ---------------------------------------------------------------- toast + dev

function flashToast(msg: string): void {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#1b1410;border:1px solid var(--gold);color:#ece0cd;padding:8px 15px;border-radius:5px;z-index:9998;font:13px/1 var(--font-mono)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function maybeDevJump(): boolean {
  const p = new URLSearchParams(location.search);
  if (p.get("dev") !== "enc") return false;
  run = new Run(p.get("seed") || "dev-seed");
  while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
  run.beginDescent();
  const e = run.enterFloor(run.state.nextFloors[0]);
  if (e) {
    e.autoDeploy();
    const rounds = parseInt(p.get("rounds") || "0", 10);
    for (let g = 0; g < rounds * 40 && (e.phase === "player" || e.phase === "enemy"); g++) {
      if (e.phase === "enemy") { e.runEnemyTurn(); continue; }
      const u = e.active;
      if (!u) { e.endTurn(); continue; }
      const t = e.attackTargets(u).sort((a, b) => a.hp - b.hp)[0];
      if (t && !u.actionUsed) { e.doAttack(t.id); continue; }
      const foes = e.units.filter((x) => x.team === "enemy" && x.alive);
      let moved = false;
      if (foes.length && e.moveBudget(u) > 0) {
        let best: string | null = null, bd = Infinity;
        for (const k of e.moveOptions(u).keys()) {
          const [q, r] = k.split(",").map(Number);
          const d = Math.min(...foes.map((f) => Math.abs(f.pos.q - q) + Math.abs(f.pos.r - r)));
          if (d < bd) { bd = d; best = k; }
        }
        if (best) { const [q, r] = best.split(",").map(Number); moved = e.moveTo({ q, r }); }
      }
      if (!moved) e.endTurn();
    }
    enc = e;
    phase = "encounter";
  }
  return true;
}

maybeDevJump();
render();
