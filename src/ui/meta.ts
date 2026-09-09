export interface MetaRun {
  seed: string;
  depth: number;
  outcome: "wipe" | "retired";
  banked: number;
  party: string[];
  when: number;
}

export interface Meta {
  runs: MetaRun[];
  graveyard: { name: string; epitaph: string; depth: number; cause: string }[];
  bestDepth: number;
  bestBanked: number;
  totalBanked: number;
}

const KEY = "gordion-meta-v1";

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { runs: [], graveyard: [], bestDepth: 0, bestBanked: 0, totalBanked: 0, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { runs: [], graveyard: [], bestDepth: 0, bestBanked: 0, totalBanked: 0 };
}

export function saveMeta(m: Meta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode / blocked — fine */
  }
}

export function recordRun(
  m: Meta,
  run: { seed: string; depth: number; outcome: "wipe" | "retired"; banked: number; party: string[] },
  graves: { name: string; epitaph: string; depth: number; cause: string }[],
): Meta {
  m.runs.unshift({ ...run, when: Date.now() });
  m.runs = m.runs.slice(0, 30);
  m.graveyard.unshift(...graves);
  m.graveyard = m.graveyard.slice(0, 60);
  m.bestDepth = Math.max(m.bestDepth, run.depth);
  m.bestBanked = Math.max(m.bestBanked, run.banked);
  m.totalBanked += Math.max(0, run.banked);
  saveMeta(m);
  return m;
}
