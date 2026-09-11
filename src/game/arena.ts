import { RNG } from "../core/rng";
import { Hex, distance, eq, fromKey, key, neighbors } from "../core/hex";
import { HexGrid, Terrain } from "../core/grid";
import { unitFromBoss, unitFromMonster } from "./units";
import { bossForDepth, MONSTERS } from "./data";
import { FloorKind, MonsterDef, Objective, Unit } from "./types";

export interface Arena {
  grid: HexGrid;
  enemies: Unit[];
  objective: Objective;
  deployZone: Hex[];
  biome: string;
}

const BIOMES = ["the Quarry", "the Bone Warren", "the Fungal Deep", "the Flooded Vault", "the Ashfall Gallery"];

export function generateArena(
  rng: RNG,
  depth: number,
  kind: FloorKind,
  partySize: number,
): Arena {
  const biome = rng.pick(BIOMES);
  const w = 9 + Math.min(4, Math.floor(depth / 3)) + Math.max(0, partySize - 3) + (kind === "boss" ? 3 : 0);
  const h = 8 + Math.min(3, Math.floor(depth / 4)) + Math.max(0, partySize - 3) + (kind === "boss" ? 2 : 0);
  const grid = new HexGrid(w, h);
  const cells = grid.all();

  // ---- elevation: a few ridges
  const peaks = rng.int(2, 4);
  for (let i = 0; i < peaks; i++) {
    const c = rng.pick(cells);
    const height = rng.int(1, 2);
    for (const t of cells) {
      const d = distance({ q: t.q, r: t.r }, { q: c.q, r: c.r });
      if (d <= height) t.elevation = Math.max(t.elevation, height - d + 1);
      t.elevation = Math.min(2, t.elevation);
    }
  }

  // ---- terrain scatter
  const scatter = (terrain: Terrain, count: number, clumpChance = 0): void => {
    for (let i = 0; i < count; i++) {
      const c = rng.pick(cells);
      if (c.feature) continue;
      c.terrain = terrain;
      if (rng.chance(clumpChance)) {
        for (const n of grid.neighbors({ q: c.q, r: c.r })) {
          if (!n.feature && rng.chance(0.5)) n.terrain = terrain;
        }
      }
    }
  };
  scatter("wall", rng.int(3, 6), 0.6);
  scatter("rubble", rng.int(2, 5), 0.4);
  scatter("difficult", rng.int(3, 7), 0.3);
  if (rng.chance(0.4)) scatter("water", rng.int(2, 4), 0.5);
  if (depth >= 2 && rng.chance(0.45)) {
    // a chasm seam
    const startR = rng.int(1, h - 2);
    for (let q = -2; q < w; q++) {
      const t = grid.get({ q, r: startR + (rng.chance(0.4) ? 1 : 0) });
      if (t && !t.feature) t.terrain = "chasm";
    }
  }

  // ---- deploy zone: left edge column band
  const deployZone: Hex[] = [];
  for (const t of cells) {
    if (t.q <= Math.min(...cells.map((c) => c.q)) + 1) {
      t.terrain = t.terrain === "wall" || t.terrain === "chasm" ? "open" : t.terrain;
      t.hazard = null;
      t.feature = "deploy";
      deployZone.push({ q: t.q, r: t.r });
    }
  }
  deployZone.sort((a, b) => a.r - b.r || a.q - b.q);

  // ---- hazards
  const hazardCount = 2 + Math.floor(depth / 2);
  const hazKinds = depth >= 4 ? (["acid", "spikes", "fire"] as const) : (["acid", "spikes"] as const);
  for (let i = 0; i < hazardCount; i++) {
    const c = rng.pick(cells);
    if (c.feature || c.terrain === "wall" || c.terrain === "chasm") continue;
    c.hazard = { kind: rng.pick(hazKinds), ttl: -1 };
  }

  // ---- objective + enemies
  const farCells = cells
    .filter((t) => !t.feature && t.terrain !== "wall" && t.terrain !== "chasm")
    .sort((a, b) => b.q - a.q);
  const enemies: Unit[] = [];
  const used = new Set<string>();

  let objective: Objective;
  if (kind === "boss") {
    const bd = bossForDepth(depth);
    const spot = farCells[0] ?? { q: w - 2, r: Math.floor(h / 2) };
    used.add(key(spot));
    enemies.push(unitFromBoss(bd, spot));
    objective = { kind: "slay", description: `bring down ${bd.name}` };
  } else {
    const budget = enemyBudget(depth, kind);
    const roster = pickRoster(rng, depth, kind, budget);
    for (const def of roster) {
      let placed: Hex | null = null;
      const wantsHigh = def.archetype === "archer";
      const pool = [...farCells].sort((a, b) =>
        wantsHigh ? b.elevation - a.elevation || b.q - a.q : b.q - a.q,
      );
      for (const t of pool) {
        const hh = { q: t.q, r: t.r };
        if (used.has(key(hh))) continue;
        if (deployZone.some((d) => distance(d, hh) <= 2)) continue;
        placed = hh;
        break;
      }
      if (!placed) placed = { q: farCells[0].q, r: farCells[0].r };
      used.add(key(placed));
      enemies.push(unitFromMonster(def, placed, depthHpScale(depth)));
    }

    if (kind === "extraction") {
      const exHexes = cells
        .filter((t) => t.terrain !== "wall" && t.terrain !== "chasm")
        .sort((a, b) => b.q - a.q)
        .slice(0, 3)
        .map((t) => ({ q: t.q, r: t.r }));
      for (const e of exHexes) grid.set(e, { feature: "extract", hazard: null });
      objective = {
        kind: "extract",
        description: `reach the extraction point (far side) with your survivors`,
        extractHexes: exHexes,
      };
    } else {
      objective = {
        kind: "slay",
        description: kind === "elite" ? "kill the pit champion and its handlers" : "kill everything down here",
      };
    }
  }

  // clear hazards/walls off enemy tiles
  for (const e of enemies) {
    const t = grid.get(e.pos);
    if (t) {
      if (t.terrain === "wall" || t.terrain === "chasm") t.terrain = "open";
      t.hazard = null;
    }
  }

  // ---- guarantee winnability: deploy zone must have a walkable path to
  // every enemy (and every extraction point) — walls/chasm/scatter can
  // otherwise wall off a whole side of the map into a dead softlock
  const targets = enemies.map((e) => e.pos).concat(objective.extractHexes ?? []);
  ensureConnectivity(grid, deployZone, targets);

  return { grid, enemies, objective, deployZone, biome };
}

/**
 * Walls, the chasm seam, and clumped terrain scatter can — rarely but
 * definitely — wall off the deploy zone from an enemy or an extraction
 * point entirely, producing a softlock (neither side can ever reach the
 * other). After all terrain is placed, flood-fill from the deploy zone
 * over walkable tiles; for anything still unreachable, carve the shortest
 * possible corridor of walls/chasm back open until it is. Cheap (board is
 * a few hundred tiles) and only ever touches terrain that would otherwise
 * strand a target, so it never changes an already-winnable floor.
 */
function ensureConnectivity(grid: HexGrid, deployZone: Hex[], targets: Hex[]): void {
  const passable = (h: Hex): boolean => {
    const t = grid.get(h);
    return !!t && t.terrain !== "wall" && t.terrain !== "chasm";
  };
  const floodFromDeploy = (): Set<string> => {
    const seen = new Set<string>();
    const queue: Hex[] = [];
    for (const d of deployZone) {
      if (passable(d) && !seen.has(key(d))) {
        seen.add(key(d));
        queue.push(d);
      }
    }
    let i = 0;
    while (i < queue.length) {
      const cur = queue[i++];
      for (const n of neighbors(cur)) {
        if (!grid.has(n) || seen.has(key(n)) || !passable(n)) continue;
        seen.add(key(n));
        queue.push(n);
      }
    }
    return seen;
  };

  for (const target of targets) {
    if (!grid.has(target)) continue;
    const reached = floodFromDeploy();
    if (reached.has(key(target))) continue;

    // multi-source BFS from the reached region over ALL tiles (terrain
    // ignored) to find the shortest possible carve path to the target
    const cameFrom = new Map<string, string | null>();
    const queue: Hex[] = [];
    for (const k of reached) {
      cameFrom.set(k, null);
      queue.push(fromKey(k));
    }
    let hit: Hex | null = null;
    let i = 0;
    while (i < queue.length) {
      const cur = queue[i++];
      if (eq(cur, target)) {
        hit = cur;
        break;
      }
      for (const n of neighbors(cur)) {
        if (!grid.has(n)) continue;
        const nk = key(n);
        if (cameFrom.has(nk)) continue;
        cameFrom.set(nk, key(cur));
        queue.push(n);
      }
    }
    if (!hit) continue; // board isn't contiguous — shouldn't happen, nothing sane to carve

    // walk back from the target to the reached frontier, opening anything blocking
    let ck: string | null = key(hit);
    while (ck && !reached.has(ck)) {
      const t = grid.get(fromKey(ck));
      if (t && (t.terrain === "wall" || t.terrain === "chasm")) {
        t.terrain = "open";
        t.hazard = null;
      }
      ck = cameFrom.get(ck) ?? null;
    }
  }
}

function enemyBudget(depth: number, kind: FloorKind): number {
  let b = 60 + depth * 22;
  if (kind === "elite") b *= 1.15;
  if (kind === "extraction") b *= 0.7;
  return Math.round(b);
}

function depthHpScale(depth: number): number {
  return 1 + Math.max(0, depth - 3) * 0.08;
}

function defCost(d: MonsterDef): number {
  return d.hp + d.tier * 20 + (d.archetype === "elite" ? 60 : 0);
}

function pickRoster(rng: RNG, depth: number, kind: FloorKind, budget: number): MonsterDef[] {
  const maxTier = depth <= 3 ? 1 : 2;
  const pool = Object.values(MONSTERS).filter(
    (m) => m.tier <= maxTier && m.archetype !== "elite",
  );
  const out: MonsterDef[] = [];
  let spent = 0;

  if (kind === "elite") {
    out.push(MONSTERS.chained_gladiator);
    spent += defCost(MONSTERS.chained_gladiator);
  }

  let guard = 0;
  while (spent < budget && out.length < 9 && guard++ < 40) {
    const def = rng.pick(pool);
    if (spent + defCost(def) > budget + 25) {
      if (out.length >= 2) break;
    }
    out.push(def);
    spent += defCost(def);
  }
  if (!out.length) out.push(MONSTERS.scavenger, MONSTERS.pit_rat);
  return out;
}
