/**
 * Per-run knobs derived from the Guild's building levels (see guild.ts).
 * A single mutable object because only one run exists at a time; the Guild
 * layer calls applyGuildToConfig() before a run starts.
 */
export interface RunConfig {
  draftPool: number; // N — recruits shown at once
  partySize: number; // X — warband size
  levelCap: number; // W — hard level ceiling
  statFloor: number; // lowest a rolled ability can be
  primaryBonus: number; // flat bump to the class's key stat
  gearTier: number; // 0–3 — flat kit bonuses on new recruits
  mulligans: number; // free whole-pool re-rolls in the draft
  bankCap: number; // most gold one extraction can send up
  startPatched: boolean; // recruits start at full HP (Infirmary)
  deathSaveEdge: boolean; // roll death saves at advantage (Infirmary 1)
  postFloorHeal: number; // fraction of max HP recovered after a floor
}

export const RUN_CONFIG: RunConfig = {
  draftPool: 3,
  partySize: 3,
  levelCap: 6,
  statFloor: 3,
  primaryBonus: 0,
  gearTier: 0,
  mulligans: 1,
  bankCap: 100000,
  startPatched: true,
  deathSaveEdge: false,
  postFloorHeal: 0.25,
};

export function resetConfig(): void {
  Object.assign(RUN_CONFIG, {
    draftPool: 3,
    partySize: 3,
    levelCap: 6,
    statFloor: 3,
    primaryBonus: 0,
    gearTier: 0,
    mulligans: 1,
    bankCap: 100000,
    startPatched: true,
  deathSaveEdge: false,
  postFloorHeal: 0.25,
  });
}
