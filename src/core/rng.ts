/**
 * Seeded, deterministic PRNG. Everything random in the game routes through an
 * instance of this so a run is reproducible from its seed (DESIGN.md §1 pillar 6).
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  private next: () => number;
  readonly seed: string;

  constructor(seed: string | number) {
    this.seed = String(seed);
    const gen = xmur3(this.seed);
    this.next = mulberry32(gen());
  }

  /** float in [0, 1) */
  float(): number {
    return this.next();
  }

  /** float in [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(min + this.next() * (max - min + 1));
  }

  /** true with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** weighted pick: entries are [item, weight] */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = this.next() * total;
    for (const [item, w] of entries) {
      roll -= w;
      if (roll < 0) return item;
    }
    return entries[entries.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** sample n distinct elements */
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr.slice()).slice(0, Math.min(n, arr.length));
  }

  /** roll `count` dice of `sides`, plus flat modifier */
  dice(count: number, sides: number, mod = 0): number {
    let total = mod;
    for (let i = 0; i < count; i++) total += this.int(1, sides);
    return total;
  }

  /** parse and roll "2d6+1" / "d20" / "1d8-1" */
  roll(spec: string): number {
    const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(spec.trim());
    if (!m) throw new Error(`bad dice spec: ${spec}`);
    return this.dice(m[1] ? parseInt(m[1], 10) : 1, parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : 0);
  }

  /** d20 with optional advantage/disadvantage; returns the raw d20 face used */
  d20(mode: "flat" | "adv" | "dis" = "flat"): number {
    const a = this.int(1, 20);
    if (mode === "flat") return a;
    const b = this.int(1, 20);
    return mode === "adv" ? Math.max(a, b) : Math.min(a, b);
  }

  /** fork a child RNG deterministically from this one (for sub-systems) */
  fork(tag: string): RNG {
    return new RNG(`${this.seed}:${tag}:${this.int(0, 2 ** 30)}`);
  }
}

/** human-friendly seed words */
const SEED_WORDS = [
  "ash", "bone", "coin", "deep", "ember", "fang", "grave", "hollow", "iron", "knot",
  "lantern", "maw", "night", "ochre", "pit", "quench", "rime", "salt", "throat", "umbra",
  "vault", "wound", "yolk", "zeal", "chain", "delve", "gloom", "husk", "moth", "rust",
];

export function randomSeed(): string {
  const r = new RNG(String(Date.now() + Math.random()));
  return `${r.pick(SEED_WORDS)}-${r.pick(SEED_WORDS)}-${r.int(100, 999)}`;
}
