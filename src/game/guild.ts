/**
 * The Guild — persistent settlement layer around every run.
 * Founded once, upgraded between runs, kept in localStorage.
 */
import { RUN_CONFIG, resetConfig } from "./config";
import { divisionOf, dungeonSpecForLevel, initLeague, LeagueState, MAX_LEVEL, playerClub, resetPlayerClub } from "./league";
import { ACADEMY_COST } from "./recruitment";
import { Character } from "./types";

export type BuildingId =
  | "recruitment" | "barracks" | "training" | "pedigree" | "vault" | "infirmary" | "smithy" | "academy";

export interface Grave {
  name: string;
  epitaph: string;
  depth: number;
  cause: string;
}

export interface MetaRun {
  seed: string;
  depth: number;
  outcome: "wipe" | "retired";
  /** gross gold the run banked, before the league fee */
  banked: number;
  /** league fee taken off that fixture's gold */
  fee: number;
  /** roster upkeep paid this fixture, taken off after the fee */
  wages: number;
  /** what actually landed in the treasury — can be negative (debt) */
  net: number;
  party: string[];
  when: number;
}

export interface Guild {
  version: 4;
  name: string | null; // null → not yet founded
  sigil: string;
  gold: number;
  renown: number;
  materials: number;
  buildings: Record<BuildingId, number>;
  runs: MetaRun[];
  graveyard: Grave[];
  bestDepth: number;
  bestBanked: number;
  totalBanked: number;
  retires: number;
  founded: number;
  /** the club's standing in the dungeon league — see game/league.ts */
  league: LeagueState;
  /** signed, persistent roster — carries between runs until they die or are released */
  roster: Character[];
  disbandments: number;
  /** best (lowest-numbered) league level ever reached — never improves on relegation, gates the priciest buildings */
  bestLeagueLevel: number;
  /** fixtures played since founding/the last rebuild — distinguishes "just founded, roster's empty" from "was staffed, got wiped" */
  fixturesThisIncarnation: number;
}

export interface Building {
  id: BuildingId;
  name: string;
  glyph: string;
  blurb: string;
  max: number;
  /** gold to raise from `level` to `level + 1`; null when maxed */
  cost: (level: number) => number;
  /** one-line effect summary at a level */
  effect: (level: number) => string;
  /** locked? return the reason, else null */
  gate?: (g: Guild) => string | null;
}

const W_BY_TIER = [3, 5, 8, 11, 14, 17, 20];
const FLOOR_BY_TIER = [3, 5, 7, 8];

const BANK_BY_TIER = [200, 400, 800, 1600, 100000];

/**
 * Every building level past the first is gated on club tenure as well as
 * gold — how many seasons you've competed, and the best (lowest-numbered)
 * league level you've ever reached — so the top tiers of infrastructure are
 * a multi-season, multi-promotion investment, not just a bank balance.
 */
const PROGRESS_REQ: Record<number, { season: number; level: number }> = {
  2: { season: 2, level: MAX_LEVEL },
  3: { season: 4, level: 6 },
  4: { season: 6, level: 4 },
  5: { season: 9, level: 3 },
  6: { season: 12, level: 1 },
};

function progressGate(nextLevel: number, g: Guild): string | null {
  const req = PROGRESS_REQ[nextLevel];
  if (!req) return null;
  if (g.league.season < req.season) return `Reach Season ${req.season}`;
  if (g.bestLeagueLevel > req.level) return `Reach Level ${req.level} first`;
  return null;
}

/** effect(l) = the effect with l levels built (l = 0 → base state) */
export const BUILDINGS: Building[] = [
  {
    id: "recruitment",
    name: "Recruitment Hall",
    glyph: "‡",
    blurb: "Scouting reach. How many prospects the Market turns up per visit.",
    max: 5,
    cost: (l) => [500, 1200, 2600, 5200, 9800][l] ?? 0,
    effect: (l) => `Market shows ${3 + l} prospects`,
    gate: (g) => progressGate(buildingLevel(g, "recruitment") + 1, g),
  },
  {
    id: "barracks",
    name: "Barracks",
    glyph: "▚",
    blurb: "Bunks. Each one lets a bigger warband go down.",
    max: 3,
    cost: (l) => [2500, 7700, 19000][l] ?? 0,
    effect: (l) => `Party size X ${3 + l}`,
    gate: (g) => {
      const need = [6, 11, 16][g.buildings.barracks] ?? 99;
      return progressGate(buildingLevel(g, "barracks") + 1, g) ?? (g.bestDepth >= need ? null : `Reach Deep ${need} first`);
    },
  },
  {
    id: "training",
    name: "Training Yard",
    glyph: "✕",
    blurb: "Drill posts. Raises the ceiling on how far a delver can level.",
    max: 6,
    cost: (l) => [900, 2000, 3900, 7700, 14700, 26000][l] ?? 0,
    effect: (l) => `Level cap W ${W_BY_TIER[Math.min(l, 6)]}`,
    gate: (g) => progressGate(buildingLevel(g, "training") + 1, g),
  },
  {
    id: "pedigree",
    name: "Recruit Pedigree",
    glyph: "❦",
    blurb: "Better stock through the gate. Raises the worst a rolled stat can be.",
    max: 3,
    cost: (l) => [1050, 2800, 6300][l] ?? 0,
    effect: (l) => `Min stat ${FLOOR_BY_TIER[Math.min(l, 3)]}` + (l >= 3 ? " · +1 key stat" : ""),
    gate: (g) => progressGate(buildingLevel(g, "pedigree") + 1, g),
  },
  {
    id: "smithy",
    name: "Smithy",
    glyph: "⚒",
    blurb: "Issue kit at the gate. Newly drafted delvers carry Guild arms.",
    max: 3,
    cost: (l) => [1400, 4200, 10500][l] ?? 0,
    effect: (l) => ["No issue", "+1 AC", "+1 AC · keen weapon", "+1 AC · keen · +2 HP/lvl"][Math.min(l, 3)],
    gate: (g) => progressGate(buildingLevel(g, "smithy") + 1, g),
  },
  {
    id: "vault",
    name: "The Vault",
    glyph: "◈",
    blurb: "Strongroom. Caps how much a single extraction can send to the surface.",
    max: 4,
    cost: (l) => [700, 1900, 4500, 10500][l] ?? 0,
    effect: (l) => `Bank ${BANK_BY_TIER[Math.min(l, 4)] >= 100000 ? "any amount" : BANK_BY_TIER[Math.min(l, 4)] + "g"} / shaft`,
    gate: (g) => progressGate(buildingLevel(g, "vault") + 1, g),
  },
  {
    id: "infirmary",
    name: "Infirmary",
    glyph: "✚",
    blurb: "Cots and poultices. Survivors mend faster; the downed hang on longer.",
    max: 2,
    cost: (l) => [1750, 5250][l] ?? 0,
    effect: (l) => ["No infirmary", "Death saves at advantage", "Death saves at advantage · 40% post-floor heal"][Math.min(l, 2)],
    gate: (g) => progressGate(buildingLevel(g, "infirmary") + 1, g),
  },
  {
    id: "academy",
    name: "The Sump School",
    glyph: "❋",
    blurb: "The club's own training pipeline. Cheap graduates, never dries up, always a rung below the Market's best.",
    max: 3,
    cost: (l) => [900, 2450, 5600][l] ?? 0,
    effect: (l) => `Graduate stat floor ${l >= 3 ? "close to" : "well below"} a normal recruit's` + (l === 0 ? " (unbuilt — still usable, worst quality)" : ""),
    gate: (g) => progressGate(buildingLevel(g, "academy") + 1, g),
  },
];

export const SIGILS = ["⛓", "✦", "☗", "⚔", "☠", "◆", "✠", "⚜", "✜", "❖"];

const KEY = "gordion-guild-v2";
const LEGACY = "gordion-meta-v1";
export const SAVE_SLOTS = [1, 2, 3] as const;
export type SaveSlot = (typeof SAVE_SLOTS)[number];

function keyForSlot(slot: number): string {
  return `${KEY}-slot${slot}`;
}

/** which slot loadGuild()/saveGuild() read and write — set once from the main menu */
let activeSlot: SaveSlot = 1;
export function setActiveSlot(slot: SaveSlot): void {
  activeSlot = slot;
}
export function getActiveSlot(): SaveSlot {
  return activeSlot;
}

function blankGuild(): Guild {
  return {
    version: 4,
    name: null,
    sigil: SIGILS[0],
    gold: 0,
    renown: 0,
    materials: 0,
    buildings: { recruitment: 0, barracks: 0, training: 0, pedigree: 0, vault: 0, infirmary: 0, smithy: 0, academy: 0 },
    runs: [],
    graveyard: [],
    bestDepth: 0,
    bestBanked: 0,
    totalBanked: 0,
    retires: 0,
    founded: 0,
    league: initLeague("Unnamed Club"),
    roster: [],
    disbandments: 0,
    bestLeagueLevel: MAX_LEVEL,
    fixturesThisIncarnation: 0,
  };
}

/**
 * One-time migration: a save from before multiple slots existed (plain
 * `gordion-guild-v2`, no slot suffix) becomes Slot 1, so nobody's progress
 * vanishes the first time this build loads. No-ops instantly on every
 * later call once that key is gone.
 */
function migrateLegacySingleSave(): void {
  try {
    if (localStorage.getItem(keyForSlot(1)) !== null) return; // slot 1 already has its own save
    const old = localStorage.getItem(KEY);
    if (old !== null) {
      localStorage.setItem(keyForSlot(1), old);
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

function readSlotRaw(slot: number): Guild | null {
  try {
    const raw = localStorage.getItem(keyForSlot(slot));
    if (!raw) return null;
    const g: Guild = { ...blankGuild(), ...JSON.parse(raw), version: 4 };
    // pre-league-rework saves carry an incompatible `league` shape — reinit rather
    // than patch it field-by-field (no real stakes yet, this is a playtest save)
    if (!g.league || typeof g.league.season !== "number") g.league = initLeague(g.name ?? "Unnamed Club");
    return g;
  } catch {
    return null;
  }
}

export function loadGuildSlot(slot: SaveSlot): Guild {
  migrateLegacySingleSave();
  const g = readSlotRaw(slot);
  if (g) return g;
  // only Slot 1 inherits the pre-slots v1 meta save (there's no slot to guess for it otherwise)
  if (slot === 1) {
    try {
      const old = localStorage.getItem(LEGACY);
      if (old) {
        const m = JSON.parse(old);
        const blank = blankGuild();
        blank.runs = m.runs ?? [];
        blank.graveyard = m.graveyard ?? [];
        blank.bestDepth = m.bestDepth ?? 0;
        blank.bestBanked = m.bestBanked ?? 0;
        blank.totalBanked = m.totalBanked ?? 0;
        blank.gold = Math.round((m.totalBanked ?? 0) * 0.25);
        localStorage.setItem(keyForSlot(1), JSON.stringify(blank));
        return blank;
      }
    } catch {
      /* ignore */
    }
  }
  return blankGuild();
}

/** loads/saves whichever slot setActiveSlot() last selected */
export function loadGuild(): Guild {
  return loadGuildSlot(activeSlot);
}

export function saveGuild(g: Guild): void {
  try {
    localStorage.setItem(keyForSlot(activeSlot), JSON.stringify(g));
  } catch {
    /* private mode */
  }
}

export interface SlotSummary {
  slot: SaveSlot;
  exists: boolean;
  name: string | null;
  sigil: string;
  gold: number;
  bestDepth: number;
  leagueLevel: number;
  disbandments: number;
  founded: number;
}

/** a lightweight peek at every slot, for the main menu — never touches the active slot */
export function listSlotSummaries(): SlotSummary[] {
  migrateLegacySingleSave();
  return SAVE_SLOTS.map((slot) => {
    const g = readSlotRaw(slot);
    if (!g || !g.name) return { slot, exists: false, name: null, sigil: SIGILS[0], gold: 0, bestDepth: 0, leagueLevel: MAX_LEVEL, disbandments: 0, founded: 0 };
    return {
      slot,
      exists: true,
      name: g.name,
      sigil: g.sigil,
      gold: g.gold,
      bestDepth: g.bestDepth,
      leagueLevel: divisionOf(g.league).level,
      disbandments: g.disbandments,
      founded: g.founded,
    };
  });
}

export function deleteSlotSave(slot: SaveSlot): void {
  try {
    localStorage.removeItem(keyForSlot(slot));
  } catch {
    /* ignore */
  }
}

export function foundGuild(g: Guild, name: string, sigil: string): void {
  g.name = name.slice(0, 28) || "The Gordion Pit";
  g.sigil = sigil;
  g.founded = Date.now();
  g.gold += 200; // founding grant
  const player = g.league.clubs.find((c) => c.isPlayer);
  if (player) player.name = g.name;
  saveGuild(g);
}

export function buildingLevel(g: Guild, id: BuildingId): number {
  return g.buildings[id] ?? 0;
}

export function upgradeCost(g: Guild, id: BuildingId): number | null {
  const b = BUILDINGS.find((x) => x.id === id)!;
  const lvl = buildingLevel(g, id);
  if (lvl >= b.max) return null;
  return b.cost(lvl);
}

export function upgradeBlocked(g: Guild, id: BuildingId): string | null {
  const b = BUILDINGS.find((x) => x.id === id)!;
  return b.gate ? b.gate(g) : null;
}

export function doUpgrade(g: Guild, id: BuildingId): boolean {
  const cost = upgradeCost(g, id);
  if (cost === null || upgradeBlocked(g, id) || g.gold < cost) return false;
  g.gold -= cost;
  g.buildings[id] = buildingLevel(g, id) + 1;
  applyGuildToConfig(g);
  saveGuild(g);
  return true;
}

/** push the Guild's effects into RUN_CONFIG for the next run */
export function applyGuildToConfig(g: Guild): void {
  resetConfig();
  const b = g.buildings;
  RUN_CONFIG.draftPool = 3 + b.recruitment;
  RUN_CONFIG.mulligans = 1 + (b.recruitment >= 2 ? 1 : 0);
  RUN_CONFIG.partySize = 3 + b.barracks;
  RUN_CONFIG.levelCap = W_BY_TIER[Math.min(b.training, W_BY_TIER.length - 1)];
  RUN_CONFIG.statFloor = FLOOR_BY_TIER[Math.min(b.pedigree, FLOOR_BY_TIER.length - 1)];
  RUN_CONFIG.primaryBonus = b.pedigree >= 3 ? 1 : 0;
  RUN_CONFIG.gearTier = b.smithy;
  RUN_CONFIG.bankCap = BANK_BY_TIER[Math.min(b.vault, 4)];
  RUN_CONFIG.startPatched = true;
  RUN_CONFIG.deathSaveEdge = b.infirmary >= 1;
  RUN_CONFIG.postFloorHeal = b.infirmary >= 2 ? 0.4 : 0.25;
  // this season's dungeon: every club at your league level plays the same
  // fixed-length, level-scaled descent
  const spec = dungeonSpecForLevel(divisionOf(g.league).level);
  RUN_CONFIG.dungeonFloors = spec.floors;
  RUN_CONFIG.dungeonDepthStart = spec.depthStart;
}

export function recordRun(
  g: Guild,
  run: {
    seed: string;
    depth: number;
    outcome: "wipe" | "retired";
    banked: number;
    fee: number;
    wages: number;
    net: number;
    party: string[];
  },
  graves: Grave[],
): void {
  g.runs.unshift({ ...run, when: Date.now() });
  g.runs = g.runs.slice(0, 40);
  g.graveyard.unshift(...graves);
  g.graveyard = g.graveyard.slice(0, 80);
  g.bestDepth = Math.max(g.bestDepth, run.depth);
  g.bestBanked = Math.max(g.bestBanked, run.banked);
  g.totalBanked += Math.max(0, run.banked);
  g.bestLeagueLevel = Math.min(g.bestLeagueLevel, divisionOf(g.league).level);
  g.fixturesThisIncarnation += 1;
  // wages can push this negative — a club can go into debt, same as any club that can't make payroll
  g.gold += run.net;
  if (run.outcome === "retired") {
    g.retires += 1;
    g.renown += 5 + run.depth;
  }
  saveGuild(g);
}

const SEVERE_DEBT = -300;

/**
 * Is the club in trouble? Any one of four conditions forces a rebuild:
 *  - total wipe: nobody survived a fixture, there's no one left to field
 *    (guarded on `fixturesThisIncarnation` so a freshly founded/rebuilt
 *    club — roster empty because it hasn't signed anyone yet — never
 *    trips this)
 *  - gridlock: short on roster, and too broke to cover even the Sump
 *    School's flat fee for the gap — no route back to a fieldable squad,
 *    ever, since nothing earns gold without playing a fixture first
 *  - severe debt: too far underwater on wages to ever dig out
 *  - financial collapse: broke, and the last three fixtures were losses
 * Safe to call proactively (e.g. every time the Settlement screen loads),
 * not just right after a fixture resolves — a building purchase can create
 * the gridlock condition just as easily as a bad run can.
 */
export function checkDisbandment(g: Guild): string | null {
  if (g.fixturesThisIncarnation > 0 && g.roster.length === 0) {
    return "The roster was wiped out — there's no one left to field.";
  }
  const short = Math.max(0, RUN_CONFIG.partySize - g.roster.length);
  if (short > 0 && g.gold < ACADEMY_COST * short) {
    return "The roster is short and the treasury can't cover even the Sump School's fees — there's no way to field a full squad again.";
  }
  if (g.gold <= SEVERE_DEBT) return "The club is too deep in debt on wages to ever make payroll again.";
  const player = playerClub(g.league);
  const recent = player.form.slice(-3);
  if (g.gold <= 0 && recent.length >= 3 && recent.every((r) => r === "L")) {
    return "Broke, and three straight fixtures lost — the club can't make payroll.";
  }
  return null;
}

/**
 * Force a rebuild: the roster is gone, most of the treasury is gone, the
 * club drops to the bottom division and its league record resets. Guild
 * history — the graveyard, past runs, best depth — is kept; the Pit
 * remembers, even when a club doesn't survive it. Gold is floored at
 * enough to bootstrap a full roster through the Sump School alone —
 * exactly the same guarantee a freshly founded club gets — so a rebuild
 * can never immediately re-trigger the gridlock condition it was meant
 * to escape.
 */
export function disbandAndRebuild(g: Guild, newName: string): void {
  g.roster = [];
  g.gold = Math.max(Math.round(g.gold * 0.2), ACADEMY_COST * RUN_CONFIG.partySize);
  g.renown = Math.round(g.renown * 0.5);
  g.disbandments += 1;
  g.fixturesThisIncarnation = 0;
  g.name = newName.slice(0, 28) || "The Gordion Pit";
  resetPlayerClub(g.league, g.name);
  saveGuild(g);
}
