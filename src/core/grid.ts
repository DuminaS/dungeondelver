import { Hex, key, fromKey, neighbors, distance, line, eq } from "./hex";

export type Terrain = "open" | "difficult" | "wall" | "water" | "chasm" | "rubble";
export type HazardKind = "acid" | "spikes" | "fire" | "gas";

export interface Hazard {
  kind: HazardKind;
  /** rounds remaining, or -1 for permanent */
  ttl: number;
}

export interface Tile {
  q: number;
  r: number;
  terrain: Terrain;
  elevation: number; // 0..2
  hazard: Hazard | null;
  /** feature markers used by objectives / generation */
  feature: "deploy" | "extract" | "chest" | null;
}

export const TERRAIN_MOVE_COST: Record<Terrain, number> = {
  open: 1,
  difficult: 2,
  rubble: 2,
  water: 2,
  wall: Infinity,
  chasm: Infinity,
};

export function blocksMove(t: Terrain): boolean {
  return t === "wall" || t === "chasm";
}

export function blocksSight(t: Terrain): boolean {
  return t === "wall";
}

export class HexGrid {
  readonly width: number;
  readonly height: number;
  private tiles = new Map<string, Tile>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // rectangular-ish axial map (offset so it renders as a rectangle)
    for (let r = 0; r < height; r++) {
      const qOffset = Math.floor(r / 2);
      for (let q = -qOffset; q < width - qOffset; q++) {
        this.tiles.set(key({ q, r }), {
          q,
          r,
          terrain: "open",
          elevation: 0,
          hazard: null,
          feature: null,
        });
      }
    }
  }

  get(h: Hex): Tile | undefined {
    return this.tiles.get(key(h));
  }

  has(h: Hex): boolean {
    return this.tiles.has(key(h));
  }

  all(): Tile[] {
    return [...this.tiles.values()];
  }

  set(h: Hex, patch: Partial<Tile>): void {
    const t = this.get(h);
    if (t) Object.assign(t, patch);
  }

  /** in-bounds neighbors */
  neighbors(h: Hex): Tile[] {
    const out: Tile[] = [];
    for (const n of neighbors(h)) {
      const t = this.get(n);
      if (t) out.push(t);
    }
    return out;
  }

  /**
   * cost to step from `a` into `b`. `occupied` hexes (other units) are impassable
   * for pathing but the destination check is handled by the caller.
   */
  stepCost(a: Hex, b: Hex, occupied: Set<string>): number {
    const tb = this.get(b);
    const ta = this.get(a);
    if (!tb || !ta) return Infinity;
    if (blocksMove(tb.terrain)) return Infinity;
    if (occupied.has(key(b))) return Infinity;
    let cost = TERRAIN_MOVE_COST[tb.terrain];
    const climb = tb.elevation - ta.elevation;
    if (climb > 0) cost += climb; // +1 per level climbed
    return cost;
  }

  /** A* shortest path from start to goal (goal excluded from occupied check) */
  findPath(start: Hex, goal: Hex, occupied: Set<string>): Hex[] | null {
    if (eq(start, goal)) return [start];
    const occ = new Set(occupied);
    occ.delete(key(goal));
    const frontier: { h: Hex; p: number }[] = [{ h: start, p: 0 }];
    const cameFrom = new Map<string, string | null>([[key(start), null]]);
    const costSoFar = new Map<string, number>([[key(start), 0]]);

    while (frontier.length) {
      frontier.sort((a, b) => a.p - b.p);
      const cur = frontier.shift()!.h;
      if (eq(cur, goal)) break;
      for (const next of neighbors(cur)) {
        if (!this.has(next)) continue;
        const step = this.stepCost(cur, next, occ);
        if (!isFinite(step)) continue;
        const newCost = costSoFar.get(key(cur))! + step;
        if (!costSoFar.has(key(next)) || newCost < costSoFar.get(key(next))!) {
          costSoFar.set(key(next), newCost);
          frontier.push({ h: next, p: newCost + distance(next, goal) });
          cameFrom.set(key(next), key(cur));
        }
      }
    }

    if (!cameFrom.has(key(goal))) return null;
    const path: Hex[] = [];
    let c: string | null = key(goal);
    while (c) {
      path.unshift(fromKey(c));
      c = cameFrom.get(c) ?? null;
    }
    return path;
  }

  /** Dijkstra: all hexes reachable from start within `budget` move points */
  reachable(start: Hex, budget: number, occupied: Set<string>): Map<string, number> {
    const dist = new Map<string, number>([[key(start), 0]]);
    const frontier: { h: Hex; d: number }[] = [{ h: start, d: 0 }];
    while (frontier.length) {
      frontier.sort((a, b) => a.d - b.d);
      const { h: cur, d } = frontier.shift()!;
      if (d > (dist.get(key(cur)) ?? Infinity)) continue;
      for (const next of neighbors(cur)) {
        if (!this.has(next)) continue;
        const step = this.stepCost(cur, next, occupied);
        if (!isFinite(step)) continue;
        const nd = d + step;
        if (nd <= budget && nd < (dist.get(key(next)) ?? Infinity)) {
          dist.set(key(next), nd);
          frontier.push({ h: next, d: nd });
        }
      }
    }
    dist.delete(key(start));
    return dist;
  }

  /**
   * Line of sight from a to b. Blocked by wall tiles between them, or by any
   * intervening tile whose elevation >= max(from,to)+1 (a ridge). Endpoints
   * are never blockers.
   */
  hasLineOfSight(a: Hex, b: Hex): boolean {
    const path = line(a, b);
    const ta = this.get(a);
    const tb = this.get(b);
    if (!ta || !tb) return false;
    const ridge = Math.max(ta.elevation, tb.elevation) + 1;
    for (let i = 1; i < path.length - 1; i++) {
      const t = this.get(path[i]);
      if (!t) return false;
      if (blocksSight(t.terrain)) return false;
      if (t.elevation >= ridge) return false;
    }
    return true;
  }

  /** number of cover blockers adjacent to `target` on the side facing `attacker` */
  coverBonus(attacker: Hex, target: Hex): number {
    const ta = this.get(target);
    if (!ta) return 0;
    let blockers = 0;
    for (const n of this.neighbors(target)) {
      // is n roughly between attacker and target?
      if (distance({ q: n.q, r: n.r }, attacker) < distance(target, attacker)) {
        if (n.terrain === "wall") blockers += 2;
        else if (n.terrain === "rubble") blockers += 1;
        else if (n.elevation > ta.elevation) blockers += 1;
      }
    }
    return Math.min(blockers, 5);
  }
}
