/**
 * The League — the competitive layer around the run.
 *
 * A run *is* a fixture: your club enters the Pit, and however it ends
 * (extraction or wipe) is reported to the table alongside every rival
 * club's own (lightly simulated) fixture that round. Ranking is:
 *   1. clears   2. gold earned   3. net gold after the league fee
 *   4. squad health   5. reputation
 * League standing is purely bookkeeping on top of runs that already
 * happened — it never touches combat, XP, or leveling.
 */
import { RNG } from "../core/rng";

export interface Division {
  id: string;
  name: string;
  tier: number; // 1 = top flight
  /** cut of a fixture's gold the league takes, 0..1 */
  feePct: number;
}

// tier 4 (entry) -> tier 1 (top): fee rises with prestige, same as prize money would
export const DIVISIONS: Division[] = [
  { id: "salvage", name: "Salvage Rounds", tier: 4, feePct: 0.1 },
  { id: "prospect", name: "Prospect Wards", tier: 3, feePct: 0.14 },
  { id: "lowerpit", name: "Lower Pit Circuit", tier: 2, feePct: 0.18 },
  { id: "deepvault", name: "Deep Vault League", tier: 1, feePct: 0.22 },
];

export function divisionOf(league: LeagueState): Division {
  return DIVISIONS.find((d) => d.id === league.divisionId) ?? DIVISIONS[0];
}

export interface ClubStanding {
  id: string;
  name: string;
  isPlayer: boolean;
  strength: number; // 0..1, hidden pull on a rival's sim — unused for the player
  clears: number;
  losses: number;
  floorsCleared: number;
  goldEarned: number;
  feePaid: number;
  netGold: number;
  points: number;
  squadHealth: number; // player: live party size; rival: a slow-moving flavor stat
  reputation: number; // player: guild renown; rival: a slow-moving flavor stat
  form: ("W" | "L")[]; // last <=5 fixture results, oldest first
}

export interface LeagueState {
  divisionId: string;
  round: number;
  clubs: ClubStanding[];
}

const RIVAL_NAMES = [
  "The Ashfall Wardens",
  "Cinderhold Regulars",
  "The Bonepickers",
  "Grimspar Company",
  "The Hollow Chain",
  "Rustlatch Crew",
];

function blankStanding(id: string, name: string, isPlayer: boolean, strength: number, seedStat: number): ClubStanding {
  return {
    id,
    name,
    isPlayer,
    strength,
    clears: 0,
    losses: 0,
    floorsCleared: 0,
    goldEarned: 0,
    feePaid: 0,
    netGold: 0,
    points: 0,
    squadHealth: seedStat,
    reputation: 0,
    form: [],
  };
}

/** a fresh league, seeded once when a club first enters — rivals get a random hidden strength */
export function initLeague(clubName: string): LeagueState {
  const rng = new RNG(`league-init:${clubName}:${Date.now()}`);
  const clubs: ClubStanding[] = [blankStanding("player", clubName, true, 0.5, 3)];
  for (const name of rng.sample(RIVAL_NAMES, 5)) {
    clubs.push(blankStanding(`rival:${name}`, name, false, rng.range(0.25, 0.85), rng.int(3, 6)));
  }
  return { divisionId: DIVISIONS[0].id, round: 0, clubs };
}

function pushForm(c: ClubStanding, win: boolean): void {
  c.form.push(win ? "W" : "L");
  if (c.form.length > 5) c.form.shift();
}

function applyFixture(c: ClubStanding, feePct: number, cleared: boolean, floors: number, gross: number): void {
  const fee = Math.round(gross * feePct);
  const net = gross - fee;
  c.floorsCleared += floors;
  c.goldEarned += gross;
  c.feePaid += fee;
  c.netGold += net;
  if (cleared) {
    c.clears += 1;
    c.points += 3;
  } else {
    c.losses += 1;
  }
  pushForm(c, cleared);
}

function simulateRivalFixture(rng: RNG, strength: number): { cleared: boolean; floors: number; gross: number } {
  const cleared = rng.chance(0.3 + strength * 0.45);
  const floors = cleared ? rng.int(3, 9) : rng.int(1, 4);
  const gross = Math.round((35 + floors * 16) * (0.65 + strength * 0.7) * rng.range(0.75, 1.3));
  return { cleared, floors, gross };
}

/**
 * Report the player's just-finished run as this round's fixture, and roll a
 * synthetic fixture for every rival club so the table keeps moving. Returns
 * the fee/net split for the player's own fixture (for the debrief screen).
 */
export function recordFixture(
  league: LeagueState,
  result: { cleared: boolean; floorsCleared: number; goldEarned: number; squadHealth: number; reputation: number },
): { fee: number; net: number } {
  const div = divisionOf(league);
  league.round += 1;
  const rng = new RNG(`league:${league.divisionId}:${league.round}`);

  const player = league.clubs.find((c) => c.isPlayer)!;
  const before = player.feePaid;
  applyFixture(player, div.feePct, result.cleared, result.floorsCleared, Math.max(0, result.goldEarned));
  player.squadHealth = result.squadHealth;
  player.reputation = result.reputation;
  const fee = player.feePaid - before;
  const net = Math.max(0, result.goldEarned) - fee;

  for (const c of league.clubs) {
    if (c.isPlayer) continue;
    const fx = simulateRivalFixture(rng.fork(c.id), c.strength);
    applyFixture(c, div.feePct, fx.cleared, fx.floors, fx.gross);
    // reputation/squad drift slowly so the table isn't static between visits
    c.reputation = Math.max(0, c.reputation + (fx.cleared ? rng.int(1, 4) : -rng.int(0, 2)));
    c.squadHealth = Math.max(2, Math.min(6, c.squadHealth + (rng.chance(0.15) ? (fx.cleared ? 1 : -1) : 0)));
  }

  return { fee, net };
}

function compareClubs(a: ClubStanding, b: ClubStanding): number {
  return (
    b.clears - a.clears ||
    b.goldEarned - a.goldEarned ||
    b.netGold - a.netGold ||
    b.squadHealth - a.squadHealth ||
    b.reputation - a.reputation
  );
}

/** clubs ranked by the league's priority order, 1st place first */
export function standings(league: LeagueState): ClubStanding[] {
  return [...league.clubs].sort(compareClubs);
}

export function playerRank(league: LeagueState): number {
  return standings(league).findIndex((c) => c.isPlayer) + 1;
}
