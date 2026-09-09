/**
 * Flat-top hexagon math on axial coordinates (q, r). Cube coord s = -q - r.
 * Reference: redblobgames.com/grids/hexagons
 */

export interface Hex {
  q: number;
  r: number;
}

export function hex(q: number, r: number): Hex {
  return { q, r };
}

export function key(h: Hex): string {
  return `${h.q},${h.r}`;
}

export function fromKey(k: string): Hex {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
}

export function eq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function add(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function sub(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r };
}

/** pointy list of the 6 axial directions, clockwise from east */
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function neighbor(h: Hex, dir: number): Hex {
  return add(h, DIRECTIONS[((dir % 6) + 6) % 6]);
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => add(h, d));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/** all hexes within `radius` of center (inclusive), center first */
export function withinRange(center: Hex, radius: number): Hex[] {
  const out: Hex[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      out.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  out.sort((a, b) => distance(center, a) - distance(center, b));
  return out;
}

export function ring(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const results: Hex[] = [];
  let h = add(center, { q: DIRECTIONS[4].q * radius, r: DIRECTIONS[4].r * radius });
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(h);
      h = neighbor(h, i);
    }
  }
  return results;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cubeRound(q: number, r: number, s: number): Hex {
  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  else rs = -rq - rr;
  return { q: rq, r: rr };
}

/** hexes crossed by the line from a to b (both endpoints included) */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [a];
  const as = -a.q - a.r;
  const bs = -b.q - b.r;
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // nudge to avoid landing exactly on edges
    out.push(
      cubeRound(
        lerp(a.q, b.q, t) + 1e-6,
        lerp(a.r, b.r, t) + 1e-6,
        lerp(as, bs, t) - 2e-6,
      ),
    );
  }
  return out;
}

// ---- pixel conversion (flat-top) ----

export interface Layout {
  size: number;
  originX: number;
  originY: number;
}

export function hexToPixel(h: Hex, l: Layout): { x: number; y: number } {
  const x = l.size * (1.5 * h.q);
  const y = l.size * (Math.sqrt(3) * (h.r + h.q / 2));
  return { x: x + l.originX, y: y + l.originY };
}

export function pixelToHex(px: number, py: number, l: Layout): Hex {
  const x = (px - l.originX) / l.size;
  const y = (py - l.originY) / l.size;
  const q = (2 / 3) * x;
  const r = (-1 / 3) * x + (Math.sqrt(3) / 3) * y;
  return cubeRound(q, r, -q - r);
}

/** the 6 corner offsets for a flat-top hex of a given size */
export function hexCorners(l: Layout): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push({ x: l.size * Math.cos(angle), y: l.size * Math.sin(angle) });
  }
  return pts;
}
