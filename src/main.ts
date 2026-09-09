import "./style.css";
import { Hex, key } from "./core/hex";
import { Character } from "./game/types";
import { statLine } from "./game/character";
import { CLASSES, FEATURES, RACES, TRAITS } from "./game/data";
import { Run, EncounterReport, PARTY_SIZE, DRAFT_POOL_SIZE } from "./game/descent";
import { Encounter } from "./game/encounter";
import { BoardView } from "./ui/render";
import { loadMeta, Meta, recordRun } from "./ui/meta";

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

// encounter interaction state
let pendingFeature: { id: string; needs: "ally" | "enemy" | "none" } | null = null;
let enemyTimer: number | null = null;

// ---------------------------------------------------------------- helpers

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function traitTag(id: string): string {
  const t = TRAITS[id];
  if (!t) return "";
  return `<span class="tag ${t.kind}" title="${esc(t.text)}">${esc(t.name)}</span>`;
}

function characterCard(c: Character, opts: { pick?: boolean } = {}): string {
  const cls = CLASSES[c.classId];
  const race = RACES[c.raceId];
  const feats = [...new Set([...c.featureIds])]
    .filter((f) => FEATURES[f])
    .map((f) => `<span class="tag" title="${esc(FEATURES[f].text)}">${esc(FEATURES[f].name)}</span>`)
    .join(" ");
  return `
  <div class="card ${opts.pick ? "pick" : ""}" data-id="${c.id}">
    <div class="spread">
      <span class="name">${esc(c.name)}</span>
      <span class="sub">Lv ${c.level}</span>
    </div>
    <div class="sub">${esc(race.name)} ${esc(cls.name)} · HP ${c.hp}/${c.maxHp} · AC ${c.ac} · Spd ${c.speed} · ${esc(c.weapon.name)} ${esc(c.weapon.dice)}${c.weapon.ranged ? ` (rng ${c.weapon.range})` : ""}</div>
    <div class="stat-grid">
      ${statLine(c).split("  ").map((s) => { const [k, v] = s.split(" "); return `<span><b>${k}</b> ${v}</span>`; }).join("")}
    </div>
    <div>${c.traitIds.map(traitTag).join(" ") || '<span class="sub">no traits</span>'}</div>
    ${feats ? `<div class="sub">${feats}</div>` : ""}
    <div class="sub muted">${esc(cls.blurb)}</div>
  </div>`;
}

function render(): void {
  if (phase === "title") return renderTitle();
  if (phase === "draft") return renderDraft();
  if (phase === "descent") return renderDescent();
  if (phase === "encounter") return renderEncounter();
  if (phase === "aftermath") return renderAftermath();
  if (phase === "gameover") return renderGameOver();
}

// ---------------------------------------------------------------- title

function renderTitle(): void {
  const g = meta.graveyard.slice(0, 6);
  app.innerHTML = `
  <div class="wrap center col">
    <h1>DEPTHDIVER</h1>
    <p class="muted">The Gordion Pit — the knot no one could untie, so they started cutting <i>down</i> through it.
    Roll a warband of nobodies, draft ${PARTY_SIZE}, and see how deep they get before the Deep keeps them.</p>

    <div class="panel col">
      <label class="col" style="gap:4px">
        <span class="sub">Run seed (leave blank for random)</span>
        <div class="row">
          <input type="text" id="seed" placeholder="ash-lantern-207" />
          <button class="primary" id="start">Enter the Pit</button>
        </div>
      </label>
      <p class="sub muted">Same seed + same picks = the same run, every time.</p>
    </div>

    <div class="panel">
      <h2>How it works</h2>
      <ul class="muted">
        <li><b>Draft:</b> ${DRAFT_POOL_SIZE} recruits at a time. Pick one — the whole pool re-rolls. Repeat until you have ${PARTY_SIZE}.</li>
        <li><b>Each floor</b> is a hex fight. On your turn a unit gets a <span class="kbd">Move</span>, an <span class="kbd">Action</span> and maybe a <span class="kbd">Bonus</span>. Click a hex to move, click a marked enemy to attack.</li>
        <li>Enemy <span style="color:#a5342b">dashed red lines</span> show what each one will do next turn. High ground = better shots. Shove things into chasms.</li>
        <li><b>Elevation dots</b> mark high tiles. <b>≈</b> acid · <b>^</b> spikes · <b>*</b> fire · <b>~</b> gas · <b>↑</b> extraction.</li>
        <li><b>Permadeath.</b> Down isn't dead if an ally reaches you — but the run only banks what you carry to an Extraction Shaft.</li>
      </ul>
    </div>

    ${meta.runs.length ? `
    <div class="panel">
      <h2>The Gordion Pit — records</h2>
      <p class="sub">Deepest: <b>Deep ${meta.bestDepth}</b> · Richest bank: <b>${meta.bestBanked}g</b> · Total banked: <b>${meta.totalBanked}g</b> · Runs: ${meta.runs.length}</p>
      ${g.length ? `<h3 class="sub">Hall of the Dead</h3>${g.map((x) => `<div class="grave"><div class="n">${esc(x.name)} — Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub muted">${esc(x.cause)}</div></div>`).join("")}` : ""}
    </div>` : ""}

    <p class="sub muted">build ${esc(VERSION)}</p>
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
      <h1>Draft your warband</h1>
      <span class="sub">seed <span class="kbd">${esc(run.state.seed)}</span></span>
    </div>
    <p class="muted">Pick <b>${need}</b> more. Every pick re-rolls the whole pool — you can't wait for a card to come back.</p>

    <h2>Pool</h2>
    <div class="cards" id="pool">
      ${run.pool.map((c) => characterCard(c, { pick: true })).join("")}
    </div>

    <h2>Warband (${run.state.party.length}/${PARTY_SIZE})</h2>
    <div class="cards" id="party">
      ${run.state.party.map((c) => characterCard(c)).join("") || '<p class="muted">empty</p>'}
    </div>

    ${run.draftComplete ? `<div class="row"><button class="primary" id="descend">Descend into the Pit →</button></div>` : ""}
  </div>`;

  document.getElementById("pool")!.addEventListener("click", (e) => {
    const cardEl = (e.target as HTMLElement).closest(".card") as HTMLElement | null;
    if (!cardEl || !run) return;
    run.pickRecruit(cardEl.dataset.id!);
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
  const cands = st.nextFloors;
  const extractionHere = st.depth > 0 && run.currentFloor?.kind === "extraction";

  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <h1>Deep ${st.depth} → choose the way down</h1>
      <span class="sub">${esc(st.guildName)} · seed <span class="kbd">${esc(st.seed)}</span></span>
    </div>
    <div class="panel row" style="gap:22px">
      <span>Carrying <b>${st.gold}g</b></span>
      <span class="muted">Banked <b>${st.bankedGold}g</b></span>
      <span class="muted">Party ${st.party.length}/${PARTY_SIZE}</span>
      <span class="muted">Avg level ${run.avgPartyLevel().toFixed(1)}</span>
    </div>

    ${extractionHere ? renderExtractionPanel() : ""}

    <div class="cards">
      ${cands
        .map(
          (c, i) => `
        <div class="card pick" data-idx="${i}">
          <div class="spread"><span class="name">${esc(c.label)}</span><span class="tag threat">${"☠".repeat(c.threat)}</span></div>
          <div class="sub">Deep ${c.depth} · ${esc(c.biome)} · ${c.kind}</div>
          <div>${c.modifiers.map((m) => `<span class="tag">${esc(m)}</span>`).join(" ") || '<span class="sub muted">no visible modifiers</span>'}</div>
          <div class="sub muted">${esc(c.blurb)}</div>
        </div>`,
        )
        .join("")}
    </div>

    <h2>Warband</h2>
    <div class="cards">${st.party.map((c) => characterCard(c)).join("")}</div>
  </div>`;

  document.querySelectorAll<HTMLElement>(".card[data-idx]").forEach((elm) => {
    elm.addEventListener("click", () => {
      const cand = run!.state.nextFloors[parseInt(elm.dataset.idx!, 10)];
      const e = run!.enterFloor(cand);
      if (e === null) {
        // extraction floor: stay on descent screen, show the panel
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
  <div class="panel col" style="border-color:#d8a24a">
    <h2>Extraction Shaft</h2>
    <p class="muted">Use it, send it, or lose it.</p>
    <div class="row">
      <button id="ex-bank" ${st.gold <= 0 ? "disabled" : ""}>Bank ${st.gold}g &amp; press on</button>
      <button class="primary" id="ex-retire">Retire the warband (end run, cash out)</button>
    </div>
    <p class="sub muted">Retire: every survivor gets out alive, everything banks with a depth bonus, and the run ends. Pressing on keeps the gold on your bodies — lose it all if you wipe before the next shaft.</p>
  </div>`;
}

function wireExtractionButtons(): void {
  document.getElementById("ex-bank")?.addEventListener("click", () => {
    const moved = run!.bankGold();
    flashToast(`Banked ${moved}g to the surface.`);
    render();
  });
  document.getElementById("ex-retire")?.addEventListener("click", () => {
    const { bonus, survivors } = run!.retire();
    report = { won: true, deaths: [], levelUps: [], loot: bonus, xpEach: 0 };
    void survivors;
    finishRun();
  });
}

// ---------------------------------------------------------------- encounter

function renderEncounter(): void {
  if (!enc) return;
  app.innerHTML = `
  <div class="wrap col">
    <div class="spread">
      <h1>Deep ${enc.depth}</h1>
      <span class="sub">${esc(enc.objective.description)}</span>
    </div>
    <div class="enc-layout">
      <div id="board-holder"><canvas id="board"></canvas></div>
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
  if (enemyTimer) {
    clearTimeout(enemyTimer);
    enemyTimer = null;
  }
}

function onHexHover(h: Hex | null): void {
  if (!enc || !board) return;
  board.pathPreview = [];
  if (h && enc.phase === "player" && enc.active) {
    const reach = board.reachable;
    if (reach.has(key(h)) && !enc.unitAt(h)) {
      const p = enc.pathTo(enc.active, h);
      if (p) board.pathPreview = p;
    }
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
  const target = enc.unitAt(h);

  if (pendingFeature) {
    const wantEnemy = pendingFeature.needs === "enemy";
    if (target && (wantEnemy ? target.team === "enemy" : target.team === "player")) {
      if (pendingFeature.id === "__shove") {
        if (enc.shoveTargets(u).includes(target)) enc.shove(target.id);
      } else {
        enc.useFeature(pendingFeature.id, target.id);
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
  if (!target && board.reachable.has(key(h))) {
    enc.moveTo(h);
    return;
  }
}

function refreshEncounter(): void {
  if (!enc || !board || phase !== "encounter") return;

  // overlays
  board.deploy = enc.phase === "deploy" ? enc.deployZone : [];
  if (enc.phase === "player" && enc.active) {
    board.reachable = enc.moveOptions(enc.active);
    board.attackable = new Set(enc.attackTargets(enc.active).map((t) => key(t.pos)));
  } else {
    board.reachable = new Map();
    board.attackable = new Set();
  }
  board.draw();

  renderHud();
  renderLog();

  // phase transitions
  if (enc.phase === "won" || enc.phase === "lost") {
    teardownEncounter();
    const won = enc.phase === "won";
    setTimeout(() => {
      report = run!.resolveEncounter();
      if (won && !run!.state.over) {
        phase = "aftermath";
      } else {
        finishRun();
        return;
      }
      render();
    }, 700);
    return;
  }

  if (enc.phase === "enemy") {
    if (enemyTimer) clearTimeout(enemyTimer);
    enemyTimer = window.setTimeout(() => {
      if (!enc || enc.phase !== "enemy") return;
      enc.runEnemyTurn();
      refreshEncounter();
    }, 520);
  }
}

function renderHud(): void {
  if (!enc) return;
  const hud = document.getElementById("hud")!;
  const active = enc.active;

  if (enc.phase === "deploy") {
    hud.innerHTML = `
      <div class="panel col">
        <h2>Deploy</h2>
        <p class="sub muted">Click a green tile to place the next of your ${enc.toDeploy.length + enc.units.filter((u) => u.team === "player").length} fighters. You see every enemy and their intent before you commit.</p>
        <button class="primary" id="auto">Auto-deploy the rest</button>
      </div>
      ${enemyList()}`;
    document.getElementById("auto")?.addEventListener("click", () => {
      enc!.autoDeploy();
      refreshEncounter();
    });
    return;
  }

  const turnLabel =
    enc.phase === "player" ? `Your turn — ${esc(active?.name ?? "")}` : enc.phase === "enemy" ? "Enemy turn…" : "";

  hud.innerHTML = `
    <div class="panel col">
      <div class="spread"><h2 style="margin:0">${turnLabel}</h2><span class="pill">Round ${enc.round}</span></div>
      ${active && active.team === "player" ? playerControls(active) : '<p class="sub muted">Watch the red lines.</p>'}
    </div>
    <div class="col">${unitCards()}</div>`;

  if (active && active.team === "player") wirePlayerControls();
}

function playerControls(u: import("./game/types").Unit): string {
  const e = enc!;
  const moveLeft = e.moveBudget(u);
  const feats = e.featureButtons(u);
  const shoveT = e.shoveTargets(u);
  const b = (id: string, label: string, on: boolean, cls = "") =>
    `<button data-act="${id}" class="${cls}" ${on ? "" : "disabled"}>${label}</button>`;

  return `
    <div class="budget">
      <span class="${moveLeft <= 0 ? "used" : ""}">Move ${moveLeft}</span>
      <span class="${u.actionUsed ? "used" : ""}">Action</span>
      <span class="${u.bonusUsed ? "used" : ""}">Bonus</span>
      ${u.conditions.map((c) => `<span class="pill">${c.kind}</span>`).join("")}
    </div>
    <div class="actionbar">
      ${b("attack-hint", "Attack (click enemy)", !u.actionUsed && e.attackTargets(u).length > 0)}
      ${b("dash", "Dash", !u.actionUsed)}
      ${b("disengage", "Disengage", !u.actionUsed)}
      ${b("dodge", "Dodge", !u.actionUsed)}
      ${shoveT.length ? b("shove", `Shove (${shoveT.length})`, !u.actionUsed) : ""}
    </div>
    ${feats.length ? `<div class="actionbar">${feats.map((f) => `<button data-feat="${f.id}" data-needs="${f.needsTarget}" ${f.enabled ? "" : "disabled"} title="${esc(f.text)}">${esc(f.name)}</button>`).join("")}</div>` : ""}
    <div class="row" style="margin-top:6px">
      <button class="primary" data-act="end">End turn</button>
      <button class="danger" data-act="giveup">Abandon run</button>
    </div>
    ${pendingFeature ? `<p class="sub" style="color:#d8a24a">Pick a ${pendingFeature.needs} target on the board…</p>` : ""}`;
}

function wirePlayerControls(): void {
  const hud = document.getElementById("hud")!;
  hud.querySelectorAll<HTMLElement>("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!enc) return;
      const a = btn.dataset.act!;
      if (a === "dash") enc.dash();
      else if (a === "disengage") enc.disengage();
      else if (a === "dodge") enc.dodge();
      else if (a === "end") enc.endTurn();
      else if (a === "shove") {
        const t = enc.shoveTargets(enc.active!);
        if (t.length === 1) enc.shove(t[0].id);
        else pendingFeature = { id: "__shove", needs: "enemy" };
      } else if (a === "giveup") {
        if (confirm("Abandon the run? Everyone carrying loot loses it.")) {
          enc.phase = "lost";
          refreshEncounter();
          return;
        }
      }
      refreshEncounter();
    });
  });
  hud.querySelectorAll<HTMLElement>("[data-feat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!enc) return;
      const id = btn.dataset.feat!;
      const needs = btn.dataset.needs as "ally" | "enemy" | "none";
      if (needs === "none") {
        enc.useFeature(id);
        refreshEncounter();
      } else {
        pendingFeature = { id, needs };
        refreshEncounter();
      }
    });
  });
}

function unitCards(): string {
  if (!enc) return "";
  return enc.units
    .filter((u) => u.alive || u.downed)
    .sort((a, b) => (a.team === b.team ? 0 : a.team === "player" ? -1 : 1))
    .map((u) => {
      const frac = u.hp / u.maxHp;
      const cls = frac > 0.5 ? "" : frac > 0.25 ? "hurt" : "crit";
      const isActive = enc!.active?.id === u.id;
      return `
      <div class="unit-card ${u.team} ${isActive ? "active" : ""} ${u.downed ? "downed" : ""}">
        <div class="spread">
          <b>${esc(u.name)}</b>
          <span class="sub">${u.hp}/${u.maxHp}${u.downed ? " · DOWN" : ""}</span>
        </div>
        <div class="hpbar ${cls}"><i style="width:${Math.max(0, frac * 100)}%"></i></div>
        <div class="sub muted">AC ${u.ac} · ${esc(u.weapon.name)}${u.team === "enemy" && u.intent ? ` · ${esc(u.intent.note)}` : ""}</div>
      </div>`;
    })
    .join("");
}

function enemyList(): string {
  if (!enc) return "";
  return `<div class="col">${unitCards()}</div>`;
}

function renderLog(): void {
  const logEl = document.getElementById("log");
  if (!logEl || !enc) return;
  logEl.innerHTML = enc.log
    .slice(-40)
    .reverse()
    .map((l) => `<p>${esc(l)}</p>`)
    .join("");
}

// ---------------------------------------------------------------- aftermath

function renderAftermath(): void {
  if (!run || !report) return;
  const r = report;
  app.innerHTML = `
  <div class="wrap center col">
    <h1>Deep ${run.state.depth} cleared</h1>
    <div class="panel col">
      ${r.deaths.length ? `<p style="color:#a5342b"><b>Lost:</b> ${r.deaths.map(esc).join(", ")} — their gear was salvaged.</p>` : `<p class="muted">No deaths.</p>`}
      <p><b>+${r.loot}g</b> looted (carrying ${run.state.gold}g).</p>
      ${r.levelUps.length ? `<p><b>Level up:</b> ${r.levelUps.map((l) => `${esc(l.name)} → Lv ${l.to}`).join(", ")}</p>` : `<p class="muted">No level-ups this floor.</p>`}
    </div>
    <h2>Warband</h2>
    <div class="cards">${run.state.party.map((c) => characterCard(c)).join("")}</div>
    <div class="row"><button class="primary" id="go">Onward →</button></div>
  </div>`;
  document.getElementById("go")!.addEventListener("click", () => {
    enc = null;
    phase = "descent";
    render();
  });
}

// ---------------------------------------------------------------- game over

function finishRun(): void {
  if (!run) return;
  const st = run.state;
  const outcome = st.outcome ?? "wipe";
  const banked = outcome === "retired" ? st.bankedGold : st.bankedGold; // wiped: only what was banked earlier
  meta = recordRun(
    meta,
    { seed: st.seed, depth: st.depth, outcome, banked, party: st.party.map((c) => c.name) },
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
    <h1>${retired ? "The warband retires" : "The Deep keeps them"}</h1>
    <div class="panel col">
      <p>Reached <b>Deep ${st.depth}</b>.</p>
      <p>${retired ? `Everyone got out. Banked <b>${st.bankedGold}g</b> total${report ? ` (retirement bonus +${report.loot}g)` : ""}.` : `Wiped. Only the <b>${st.bankedGold}g</b> sent up earlier survives. ${st.gold}g lost with the bodies.`}</p>
      ${st.graveyard.length ? `<h3 class="sub">Fallen this run</h3>${st.graveyard.map((x) => `<div class="grave"><div class="n">${esc(x.name)} — Deep ${x.depth}</div><div class="e">${esc(x.epitaph)}</div><div class="sub muted">${esc(x.cause)}</div></div>`).join("")}` : ""}
    </div>
    <div class="panel">
      <h3 class="sub">The Gordion Pit</h3>
      <p class="sub">Deepest ever: Deep ${meta.bestDepth} · Richest bank: ${meta.bestBanked}g · Total banked across all runs: ${meta.totalBanked}g</p>
    </div>
    <div class="row">
      <button class="primary" id="again">New run</button>
      <button id="title">Back to title</button>
    </div>
  </div>`;
  document.getElementById("again")!.addEventListener("click", () => {
    run = new Run();
    enc = null;
    report = null;
    phase = "draft";
    render();
  });
  document.getElementById("title")!.addEventListener("click", () => {
    run = null;
    enc = null;
    phase = "title";
    render();
  });
}

// ---------------------------------------------------------------- toast

// dev shortcut: ?dev=enc[&seed=xxx] jumps straight into a deployed encounter
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
        const reach = [...e.moveOptions(u).keys()];
        let best: string | null = null, bd = Infinity;
        for (const k of reach) {
          const [q, r] = k.split(",").map(Number);
          const d = Math.min(...foes.map((f) => Math.abs(f.pos.q - q) + Math.abs(f.pos.r - r)));
          if (d < bd) { bd = d; best = k; }
        }
        if (best) { const [q, r] = best.split(",").map(Number); moved = e.moveTo({ q, r }); }
      }
      if (!moved) e.endTurn();
    }
    enc = e;
    phase = e.phase === "won" || e.phase === "lost" ? "encounter" : "encounter";
  }
  return true;
}

function flashToast(msg: string): void {
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText =
    "position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#1b1714;border:1px solid #d8a24a;color:#e7ddd0;padding:8px 16px;border-radius:5px;z-index:9998;font-size:13px";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

maybeDevJump();
render();
