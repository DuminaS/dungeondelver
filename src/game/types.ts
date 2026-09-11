import { Hex } from "../core/hex";

export type AbilityKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export const ABILITIES: AbilityKey[] = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];

export type Abilities = Record<AbilityKey, number>;

export function mod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export type ClassId =
  | "fighter" | "rogue" | "ranger" | "cleric"
  | "barbarian" | "paladin" | "monk" | "bard"
  | "druid" | "sorcerer" | "warlock" | "wizard" | "artificer";
export const CLASS_IDS: ClassId[] = [
  "fighter", "rogue", "ranger", "cleric",
  "barbarian", "paladin", "monk", "bard",
  "druid", "sorcerer", "warlock", "wizard", "artificer",
];
export type RaceId = "human" | "dwarf" | "elf" | "halforc";

export interface RaceDef {
  id: RaceId;
  name: string;
  mods: Partial<Abilities>;
  speed: number;
  blurb: string;
  /** passive trait ids granted by race */
  traits: string[];
}

export interface ClassDef {
  id: ClassId;
  name: string;
  hitDie: number;
  primary: AbilityKey;
  /** starting AC model */
  baseArmor: number; // added to 10 + dexMod(capped)
  dexCap: number; // max dex mod counted toward AC
  weapon: WeaponDef;
  skills: string[];
  blurb: string;
  /** feature ids unlocked at [classLevel] */
  features: Record<number, string[]>;
}

export interface WeaponDef {
  name: string;
  dice: string; // "1d8"
  ranged: boolean;
  range: number; // hexes; 1 = melee
  ability: AbilityKey; // stat used for attack/damage
  twoHanded?: boolean;
}

export interface TraitDef {
  id: string;
  name: string;
  kind: "boon" | "bane" | "quirk";
  text: string;
  apply?: (c: Character) => void; // static stat edits at generation
}

export interface Character {
  id: string;
  name: string;
  raceId: RaceId;
  /** primary class — the one with the most levels; kept in sync by recompute() */
  classId: ClassId;
  level: number;
  xp: number;
  /** one entry per character level, in the order taken: ["fighter","fighter","rogue",...] */
  levelHistory: ClassId[];
  /** levels earned but not yet assigned to a class — resolved via a level-up choice */
  pendingLevelUps: number;
  abilities: Abilities;
  traitIds: string[];
  // derived / mutable
  maxHp: number;
  hp: number;
  speed: number;
  ac: number;
  weapon: WeaponDef;
  featureIds: string[];
  skills: string[];
  // run stats
  kills: number;
  floorsSurvived: number;
  injuries: string[];
  /** upkeep the club pays per fixture — kept in sync by recompute() */
  salary: number;
  // per-encounter resources
  secondWindUsed?: boolean;
  markTargetId?: string | null;
}

export type Team = "player" | "enemy";

export type ConditionKind =
  | "prone"
  | "dodging"
  | "disengaged"
  | "blessed"
  | "poisoned"
  | "burning"
  | "bleeding"
  | "raging"
  | "reckless"
  | "mocked"
  | "inspired";

export interface Condition {
  kind: ConditionKind;
  /** rounds left; -1 = until removed explicitly */
  duration: number;
  amount?: number;
}

export interface Unit {
  id: string;
  team: Team;
  name: string;
  pos: Hex;
  // stats snapshot
  maxHp: number;
  hp: number;
  ac: number;
  speed: number;
  toHit: number;
  weapon: WeaponDef;
  damageBonus: number;
  initiative: number;
  elevationBonus?: number;
  // linkage
  charId?: string; // for player units
  archetype?: EnemyArchetype;
  tags: string[];
  conditions: Condition[];
  // per-turn budget
  movedThisTurn: number;
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  dashed: boolean;
  // state
  alive: boolean;
  downed: boolean;
  deathSuccess: number;
  deathFail: number;
  kills: number;
  causeOfDeath?: string;
  // abilities available (feature ids) for player units
  featureIds: string[];
  secondWindUsed: boolean;
  surgeUsed: boolean;
  cureUses: number;
  /** consumed count per limited feature id */
  featUses: Record<string, number>;
  markTargetId?: string | null;
  sneakUsedThisTurn?: boolean;
  colossusUsedThisTurn?: boolean;
  luckUsedThisFloor?: boolean;
  cowardTriggered?: boolean;
  relentlessUsed?: boolean;
  intent?: UnitIntent | null;
  boss?: BossState | null;
}

export interface BossState {
  defId: string;
  /** index of the last phase entered (0 = still on the opening phase) */
  phase: number;
  /** round number the last big move was telegraphed/used */
  lastMoveRound: number;
  telegraph: { moveId: string; hexes: Hex[]; name: string } | null;
}

export interface UnitIntent {
  kind: "attack" | "move" | "wait";
  targetId?: string;
  toHex?: Hex;
  note: string;
}

export type EnemyArchetype = "brute" | "archer" | "skirmisher" | "elite";

export interface MonsterDef {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  hp: number;
  ac: number;
  toHit: number;
  weapon: WeaponDef;
  damageBonus: number;
  speed: number;
  initiative: number;
  tags: string[];
  tier: number;
  /** special: burst hazard on death */
  onDeath?: "gas";
}

export interface BossMoveDef {
  id: string;
  name: string;
  /** shown when the move is telegraphed, a round before it lands */
  telegraphText: string;
  /** every how many rounds this boss attempts a big move */
  cooldown: number;
  /** hexes within this range of the blast centre are hit */
  radius: number;
  centerOn: "self" | "target";
  damage: string; // dice
  push?: boolean;
}

export interface BossPhaseDef {
  /** this phase begins once HP drops to/under this fraction of max */
  hpPct: number;
  text: string;
  addAdds?: string[]; // monster ids to summon on transition
  hazard?: "acid" | "spikes" | "fire" | "gas";
  /** a small permanent buff applied the moment this phase begins ("it gets faster/angrier") */
  statBuff?: { toHit?: number; damageBonus?: number };
}

export interface BossDef {
  id: string;
  name: string;
  depth: number; // the Deep this boss is tuned for
  hp: number;
  ac: number;
  toHit: number;
  weapon: WeaponDef;
  damageBonus: number;
  speed: number;
  initiative: number;
  tags: string[];
  moves: BossMoveDef[];
  phases: BossPhaseDef[];
  blurb: string;
}

export type ObjectiveKind = "slay" | "extract";

export interface Objective {
  kind: ObjectiveKind;
  description: string;
  /** for extract: hexes that count */
  extractHexes?: Hex[];
}

export type FloorKind = "combat" | "elite" | "boss" | "extraction";

export interface FloorCandidate {
  kind: FloorKind;
  depth: number;
  biome: string;
  threat: number; // 1..5
  modifiers: string[];
  seedTag: string;
  label: string;
  blurb: string;
}

export interface RunState {
  seed: string;
  guildName: string;
  party: Character[];
  graveyard: { name: string; epitaph: string; depth: number; cause: string }[];
  depth: number;
  gold: number;
  bankedGold: number;
  xpPool: number; // shown but xp is per-character
  inventory: string[]; // salvaged weapon names for flavor
  nextFloors: FloorCandidate[];
  over: boolean;
  outcome?: "wipe" | "retired";
}
