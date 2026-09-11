/**
 * The League — the competitive layer around the run.
 *
 * A run *is* a fixture: your club enters the Pit, and however it ends
 * (extraction or wipe) is reported to the table alongside every rival
 * club's own (lightly simulated) fixture that round, across all four
 * divisions. Ranking within a division is:
 *   1. clears   2. gold earned   3. net gold after the league fee
 *   4. squad health   5. reputation
 * Every `SEASON_LENGTH` fixtures the season settles: top of your
 * division promotes, bottom relegates, and every club's season-to-date
 * numbers reset (career totals persist). League standing is purely
 * bookkeeping on top of runs that already happened — it never touches
 * combat, XP, or leveling.
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

export const SEASON_LENGTH = 6; // fixtures per season before promotion/relegation settles
const RIVALS_PER_DIVISION = 5;
export const PROMOTE_SLOTS = 2; // top N of a division promote (except from the top division)
export const RELEGATE_SLOTS = 2; // bottom N relegate (except from the bottom division)

function divisionByTier(tier: number): Division {
  return DIVISIONS.find((d) => d.tier === tier) ?? DIVISIONS[DIVISIONS.length - 1];
}

export function divisionById(id: string): Division {
  return DIVISIONS.find((d) => d.id === id) ?? DIVISIONS[0];
}

export interface ClubStanding {
  id: string;
  name: string;
  isPlayer: boolean;
  divisionId: string;
  strength: number; // 0..1, hidden pull on a rival's sim — unused for the player
  // season-to-date
  clears: number;
  losses: number;
  floorsCleared: number;
  goldEarned: number;
  feePaid: number;
  netGold: number;
  points: number;
  squadHealth: number; // player: live roster size; rival: a slow-moving flavor stat
  reputation: number; // player: guild renown; rival: a slow-moving flavor stat
  form: ("W" | "L")[]; // last <=5 fixture results, oldest first
  // career (survives season resets and promotion/relegation)
  careerClears: number;
  careerGoldEarned: number;
  seasonsPlayed: number;
}

export interface LeagueState {
  season: number;
  round: number; // total fixtures played this season, across every division
  clubs: ClubStanding[]; // every club in every division, each stamped with its own divisionId
}

const RIVAL_NAMES = [
  "The Ashfall Wardens", "Cinderhold Regulars", "The Bonepickers", "Grimspar Company",
  "The Hollow Chain", "Rustlatch Crew", "Duskmarch Company", "The Saltmaw Guard",
  "Ironveil Retainers", "The Wraithgate Nine", "Emberwrack Irregulars", "The Ninefinger Trade",
  "Coalbrook Diggers", "The Sump Runners", "Gravehollow Band", "The Chained Oath",
  "Quenchfire Crew", "The Marrow Pickets", "Farrowdeep Company", "The Rimefall Watch",
];

function blankStanding(
  id: string,
  name: string,
  isPlayer: boolean,
  divisionId: string,
  strength: number,
  seedStat: number,
): ClubStanding {
  return {
    id,
    name,
    isPlayer,
    divisionId,
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
    careerClears: 0,
    careerGoldEarned: 0,
    seasonsPlayed: 0,
  };
}

/**
 * A fresh league, seeded once when a club first enters: every division gets
 * its own small pool of rival clubs (rivals stay parked in their home
 * division — only the player's club is ever promoted/relegated), and the
 * player's club starts at the bottom of the pyramid.
 */
export function initLeague(clubName: string): LeagueState {
  const rng = new RNG(`league-init:${clubName}:${Date.now()}`);
  const pool = rng.shuffle(RIVAL_NAMES);
  const clubs: ClubStanding[] = [blankStanding("player", clubName, true, DIVISIONS[0].id, 0.5, 3)];
  let n = 0;
  for (const div of DIVISIONS) {
    for (let i = 0; i < RIVALS_PER_DIVISION; i++) {
      const name = pool[n++ % pool.length];
      clubs.push(blankStanding(`rival:${div.id}:${i}`, name, false, div.id, rng.range(0.2, 0.9), rng.int(3, 6)));
    }
  }
  return { season: 1, round: 0, clubs };
}

export function playerClub(league: LeagueState): ClubStanding {
  return league.clubs.find((c) => c.isPlayer)!;
}

/** the division the player's club currently competes in */
export function divisionOf(league: LeagueState): Division {
  return divisionById(playerClub(league).divisionId);
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
  c.careerGoldEarned += gross;
  if (cleared) {
    c.clears += 1;
    c.careerClears += 1;
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

function compareClubs(a: ClubStanding, b: ClubStanding): number {
  return (
    b.clears - a.clears ||
    b.goldEarned - a.goldEarned ||
    b.netGold - a.netGold ||
    b.squadHealth - a.squadHealth ||
    b.reputation - a.reputation
  );
}

/** clubs of one division, ranked by the league's priority order, 1st place first */
export function standings(league: LeagueState, divisionId: string): ClubStanding[] {
  return league.clubs.filter((c) => c.divisionId === divisionId).sort(compareClubs);
}

/** the player's rank within their own division's table */
export function playerRank(league: LeagueState): number {
  const div = divisionOf(league);
  return standings(league, div.id).findIndex((c) => c.isPlayer) + 1;
}

function settleSeason(league: LeagueState): { promoted: boolean; relegated: boolean; newDivisionId: string } {
  const player = playerClub(league);
  const table = standings(league, player.divisionId);
  const rank = table.findIndex((c) => c.isPlayer) + 1;
  const tier = divisionById(player.divisionId).tier;

  let promoted = false;
  let relegated = false;
  if (rank <= PROMOTE_SLOTS && tier > 1) {
    player.divisionId = divisionByTier(tier - 1).id;
    promoted = true;
  } else if (rank > table.length - RELEGATE_SLOTS && tier < DIVISIONS.length) {
    player.divisionId = divisionByTier(tier + 1).id;
    relegated = true;
  }

  league.season += 1;
  for (const c of league.clubs) {
    c.seasonsPlayed += 1;
    c.clears = 0;
    c.losses = 0;
    c.floorsCleared = 0;
    c.goldEarned = 0;
    c.feePaid = 0;
    c.netGold = 0;
    c.points = 0;
    c.form = [];
  }
  return { promoted, relegated, newDivisionId: player.divisionId };
}

/**
 * Report the player's just-finished run as this round's fixture, and roll a
 * synthetic fixture for every rival club (in every division, so the whole
 * pyramid stays alive) so the tables keep moving. Settles the season —
 * promotion/relegation + a stat reset — every SEASON_LENGTH fixtures.
 */
export function recordFixture(
  league: LeagueState,
  result: { cleared: boolean; floorsCleared: number; goldEarned: number; squadHealth: number; reputation: number },
): { fee: number; net: number; seasonEnded: boolean; promoted: boolean; relegated: boolean; newDivisionId: string } {
  const player = playerClub(league);
  const div = divisionById(player.divisionId);
  league.round += 1;
  const rng = new RNG(`league:${league.season}:${league.round}`);

  const before = player.feePaid;
  applyFixture(player, div.feePct, result.cleared, result.floorsCleared, Math.max(0, result.goldEarned));
  player.squadHealth = result.squadHealth;
  player.reputation = result.reputation;
  const fee = player.feePaid - before;
  const net = Math.max(0, result.goldEarned) - fee;

  for (const c of league.clubs) {
    if (c.isPlayer) continue;
    const cd = divisionById(c.divisionId);
    const fx = simulateRivalFixture(rng.fork(c.id), c.strength);
    applyFixture(c, cd.feePct, fx.cleared, fx.floors, fx.gross);
    // reputation/squad drift slowly so the tables aren't static between visits
    c.reputation = Math.max(0, c.reputation + (fx.cleared ? rng.int(1, 4) : -rng.int(0, 2)));
    c.squadHealth = Math.max(2, Math.min(6, c.squadHealth + (rng.chance(0.15) ? (fx.cleared ? 1 : -1) : 0)));
  }

  const seasonEnded = league.round % SEASON_LENGTH === 0;
  if (seasonEnded) {
    const { promoted, relegated, newDivisionId } = settleSeason(league);
    return { fee, net, seasonEnded, promoted, relegated, newDivisionId };
  }
  return { fee, net, seasonEnded, promoted: false, relegated: false, newDivisionId: player.divisionId };
}

/**
 * Reset the league for a rebuilt club after disbandment: the player's club
 * drops to the bottom division, its season-to-date and career fixture stats
 * clear, and every rival keeps playing undisturbed (the pyramid doesn't
 * pause for your collapse).
 */
export function resetPlayerClub(league: LeagueState, newName: string): void {
  const player = playerClub(league);
  player.name = newName;
  player.divisionId = DIVISIONS[0].id;
  player.clears = 0;
  player.losses = 0;
  player.floorsCleared = 0;
  player.goldEarned = 0;
  player.feePaid = 0;
  player.netGold = 0;
  player.points = 0;
  player.form = [];
  player.careerClears = 0;
  player.careerGoldEarned = 0;
  player.reputation = 0;
}
