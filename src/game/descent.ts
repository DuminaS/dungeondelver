import { RNG, randomSeed } from "../core/rng";
import { Character, FloorCandidate, FloorKind, RunState } from "./types";
import { epitaphFor, grantXp, makeCharacter, xpValue } from "./character";
import { generateArena } from "./arena";
import { Encounter } from "./encounter";
import { unitFromCharacter } from "./units";
import { MONSTERS } from "./data";
import { RUN_CONFIG } from "./config";

// legacy defaults (used only as fallbacks in UI text before a run exists)
export const DRAFT_POOL_SIZE = 3;
export const PARTY_SIZE = 3;

export class Run {
  state: RunState;
  private rng: RNG;
  private draftRng: RNG;
  private encRngSeed = 0;
  pool: Character[] = [];
  lastEncounter: Encounter | null = null;
  currentFloor: FloorCandidate | null = null;
  readonly draftPool = RUN_CONFIG.draftPool;
  readonly partySize = RUN_CONFIG.partySize;
  mulligansLeft = RUN_CONFIG.mulligans;

  constructor(seed?: string, guildName = "The Gordion Pit") {
    const s = seed ?? randomSeed();
    this.rng = new RNG(s);
    this.draftRng = this.rng.fork("draft");
    this.state = {
      seed: s,
      guildName,
      party: [],
      graveyard: [],
      depth: 0,
      gold: 0,
      bankedGold: 0,
      xpPool: 0,
      inventory: [],
      nextFloors: [],
      over: false,
    };
    this.rollPool();
  }

  // ---------------------------------------------------------------- draft

  get draftComplete(): boolean {
    return this.state.party.length >= this.partySize;
  }

  rollPool(): void {
    this.pool = [];
    const seen = new Set<string>();
    let guard = 0;
    while (this.pool.length < this.draftPool && guard++ < 80) {
      const c = makeCharacter(this.draftRng);
      const sig = `${c.raceId}:${c.classId}`;
      if (seen.has(sig) && this.pool.length < this.draftPool - 1) continue;
      seen.add(sig);
      this.pool.push(c);
    }
  }

  /** free mulligan — re-roll the whole current pool */
  mulligan(): boolean {
    if (this.mulligansLeft <= 0 || this.draftComplete) return false;
    this.mulligansLeft--;
    this.rollPool();
    return true;
  }

  /** monetised re-roll (ad-gated in production; free in the playtest) */
  adReroll(): void {
    this.rollPool();
  }

  pickRecruit(id: string): boolean {
    if (this.draftComplete) return false;
    const c = this.pool.find((p) => p.id === id);
    if (!c) return false;
    const taken = new Set(this.state.party.map((p) => p.name));
    if (taken.has(c.name)) {
      const roman = ["II", "III", "IV", "V"];
      let n = 0;
      while (taken.has(`${c.name} ${roman[n]}`) && n < roman.length - 1) n++;
      c.name = `${c.name} ${roman[n]}`;
    }
    this.state.party.push(c);
    if (!this.draftComplete) this.rollPool(); // FULL re-roll after every pick
    return true;
  }

  // ---------------------------------------------------------------- descent

  beginDescent(): void {
    this.state.depth = 0;
    this.revealNextFloors();
  }

  private revealNextFloors(): void {
    const depth = this.state.depth + 1;
    const rng = this.rng.fork(`floors:${depth}`);
    const count = 2 + (rng.chance(0.35) ? 1 : 0);
    const cands: FloorCandidate[] = [];
    const kinds: FloorKind[] = [];

    // guaranteed extraction option every 3rd floor (and never on floor 1)
    if (depth > 1 && depth % 3 === 0) kinds.push("extraction");
    // elite chance grows with depth
    if (rng.chance(Math.min(0.5, 0.15 + depth * 0.04))) kinds.push("elite");
    while (kinds.length < count) kinds.push("combat");
    // if we over-filled, trim to count but keep extraction if present
    const trimmed = kinds.slice(0, count);
    if (kinds.includes("extraction") && !trimmed.includes("extraction")) trimmed[trimmed.length - 1] = "extraction";

    for (const kind of rng.shuffle(trimmed)) {
      cands.push(this.makeCandidate(rng.fork(`cand:${cands.length}`), depth, kind));
    }
    this.state.nextFloors = cands;
  }

  private makeCandidate(rng: RNG, depth: number, kind: FloorKind): FloorCandidate {
    const biome = rng.pick(["the Quarry", "the Bone Warren", "the Fungal Deep", "the Flooded Vault", "the Ashfall Gallery"]);
    const modPool = ["Darkness", "Unstable ground", "Elite pack", "Rich veins", "Thin air", "Rime"];
    const mods = rng.chance(0.5) ? [rng.pick(modPool)] : [];
    const avgLvl = this.avgPartyLevel();
    const threat = Math.max(1, Math.min(5, Math.round(1 + depth * 0.4 - avgLvl * 0.3 + (kind === "elite" ? 1.5 : 0))));
    const label =
      kind === "extraction"
        ? "Extraction Shaft"
        : kind === "elite"
          ? "Gladiator Pit"
          : rng.pick(["Warren", "Gallery", "Crawlway", "Sump", "Deadfall"]);
    const blurb =
      kind === "extraction"
        ? "A rope-lift to the surface. Bank your haul, retire the team, or press on."
        : kind === "elite"
          ? "A chained champion and its handlers. Rich loot on the corpse."
          : "Another room, another objective, another way to die.";
    return { kind, depth, biome, threat, modifiers: mods, seedTag: rng.seed, label, blurb };
  }

  avgPartyLevel(): number {
    if (!this.state.party.length) return 1;
    return this.state.party.reduce((s, c) => s + c.level, 0) / this.state.party.length;
  }

  /** enter a chosen floor: returns an Encounter, or null if it's extraction */
  enterFloor(candidate: FloorCandidate): Encounter | null {
    this.currentFloor = candidate;
    this.state.depth = candidate.depth;
    if (candidate.kind === "extraction") {
      this.lastEncounter = null;
      return null;
    }
    const encRng = this.rng.fork(`enc:${candidate.depth}:${this.encRngSeed++}`);
    const arena = generateArena(encRng, candidate.depth, candidate.kind, this.state.party.length);
    const players = this.state.party
      .filter((c) => c.hp > 0)
      .map((c) => unitFromCharacter(c, arena.deployZone[0]));
    const enc = new Encounter({
      grid: arena.grid,
      players,
      enemies: arena.enemies,
      objective: arena.objective,
      rng: encRng,
      depth: candidate.depth,
      deployZone: arena.deployZone,
    });
    this.lastEncounter = enc;
    return enc;
  }

  /** apply the outcome of the last encounter to the run */
  resolveEncounter(): EncounterReport {
    const enc = this.lastEncounter;
    const report: EncounterReport = { won: false, deaths: [], levelUps: [], loot: 0, xpEach: 0 };
    if (!enc) return report;
    report.won = enc.phase === "won";

    // map units back to characters
    const byChar = new Map<string, (typeof enc.units)[number]>();
    for (const u of enc.units) if (u.charId) byChar.set(u.charId, u);

    // deaths
    for (const c of [...this.state.party]) {
      const u = byChar.get(c.id);
      if (u && !u.alive) {
        const cause = u.causeOfDeath ?? "killed in the Deep";
        this.state.party = this.state.party.filter((x) => x.id !== c.id);
        this.state.graveyard.push({
          name: c.name,
          epitaph: epitaphFor(c, cause),
          depth: this.state.depth,
          cause,
        });
        report.deaths.push(c.name);
        // salvage the weapon
        this.state.inventory.push(c.weapon.name);
      } else if (u) {
        c.hp = Math.max(1, u.hp || 1);
        c.kills += u.kills;
        c.floorsSurvived = this.state.depth;
      }
    }

    // post-floor breather: everyone still alive recovers a quarter of max HP
    if (enc.phase === "won") {
      for (const c of this.state.party) {
        c.hp = Math.min(c.maxHp, c.hp + Math.ceil(c.maxHp * RUN_CONFIG.postFloorHeal));
      }
    }

    if (!report.won) {
      this.state.over = true;
      this.state.outcome = "wipe";
      return report;
    }

    // XP: per-kill value pooled and split by each survivor's share of kills,
    // plus a flat objective share to every survivor (PROGRESSION.md §2.1).
    const survivors = this.state.party;
    const slainEnemies = enc.units.filter((u) => u.team === "enemy" && !u.alive);
    const totalKillXp = slainEnemies.reduce((s, u) => {
      const defId = u.tags.find((t) => t.startsWith("def:"))?.slice(4);
      const def = defId ? MONSTERS[defId] : null;
      return s + (def ? xpValue(def.tier, def.hp) : 25);
    }, 0);
    const totalKills = survivors.reduce((s, c) => s + (byChar.get(c.id)?.kills ?? 0), 0) || 1;
    const objShare = Math.round(30 + this.state.depth * 25);

    for (const c of survivors) {
      const myKills = byChar.get(c.id)?.kills ?? 0;
      const award = Math.round((totalKillXp * myKills) / totalKills) + objShare;
      const gained = grantXp(c, award);
      report.xpEach = objShare;
      if (gained > 0) report.levelUps.push({ name: c.name, count: gained });
    }

    // loot
    const loot = Math.round((15 + this.state.depth * 8) * (this.currentFloor?.kind === "elite" ? 1.8 : 1) * this.rng.fork(`loot:${this.state.depth}`).range(0.7, 1.4));
    this.state.gold += loot;
    report.loot = loot;

    // reset per-floor character flags handled at unit creation next floor
    this.revealNextFloors();
    return report;
  }

  // ---------------------------------------------------------------- extraction

  get bankCap(): number {
    return RUN_CONFIG.bankCap;
  }

  bankGold(): number {
    const moved = Math.min(this.state.gold, RUN_CONFIG.bankCap);
    this.state.bankedGold += moved;
    this.state.gold -= moved;
    this.revealNextFloors();
    return moved;
  }

  retire(): { bonus: number; survivors: string[] } {
    const survivors = this.state.party.map((c) => c.name);
    const bonus = Math.round(this.state.gold + this.state.bankedGold * 0.1 + this.state.depth * 40 + survivors.length * 60);
    this.state.bankedGold += this.state.gold + bonus;
    this.state.gold = 0;
    this.state.over = true;
    this.state.outcome = "retired";
    return { bonus, survivors };
  }
}

export interface EncounterReport {
  won: boolean;
  deaths: string[];
  levelUps: { name: string; count: number }[];
  loot: number;
  xpEach: number;
}
