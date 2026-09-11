import { RNG } from "../core/rng";
import {
  Abilities,
  AbilityKey,
  ABILITIES,
  Character,
  ClassId,
  CLASS_IDS,
  mod,
  RaceId,
} from "./types";
import {
  Admission,
  admissionFor,
  CLASSES,
  CLASS_WEIGHTS,
  makeName,
  RACES,
  RACE_WEIGHTS,
  ROLLABLE_TRAITS,
  TRAITS,
} from "./data";
import { RUN_CONFIG } from "./config";

/** absolute ceiling; the Guild's Training Yard sets the live cap in RUN_CONFIG */
export const LEVEL_CAP = 20;
const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000,
  100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];

export function xpForLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)];
}

export function profBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

const STAT_PRIORITY: Record<ClassId, AbilityKey[]> = {
  fighter: ["STR", "CON", "DEX", "WIS", "CHA", "INT"],
  rogue: ["DEX", "CON", "WIS", "INT", "CHA", "STR"],
  ranger: ["DEX", "WIS", "CON", "STR", "INT", "CHA"],
  cleric: ["WIS", "CON", "STR", "CHA", "INT", "DEX"],
  barbarian: ["STR", "CON", "DEX", "WIS", "CHA", "INT"],
  paladin: ["STR", "CON", "CHA", "WIS", "DEX", "INT"],
  monk: ["DEX", "WIS", "CON", "STR", "INT", "CHA"],
  bard: ["CHA", "DEX", "CON", "WIS", "INT", "STR"],
  druid: ["WIS", "CON", "DEX", "INT", "CHA", "STR"],
  sorcerer: ["CHA", "CON", "DEX", "WIS", "INT", "STR"],
  warlock: ["CHA", "CON", "DEX", "WIS", "INT", "STR"],
  wizard: ["INT", "CON", "DEX", "WIS", "CHA", "STR"],
  artificer: ["INT", "CON", "DEX", "WIS", "CHA", "STR"],
};

function rollStatArray(rng: RNG): number[] {
  const rolls: number[] = [];
  for (let i = 0; i < 6; i++) {
    const dice = [rng.int(1, 6), rng.int(1, 6), rng.int(1, 6), rng.int(1, 6)].sort((a, b) => a - b);
    rolls.push(dice[1] + dice[2] + dice[3]);
  }
  return rolls.sort((a, b) => b - a);
}

function assignStats(rng: RNG, classId: ClassId, floorOverride?: number): Abilities {
  const arr = rollStatArray(rng);
  const prio = STAT_PRIORITY[classId];
  const out = {} as Abilities;
  const floor = floorOverride ?? RUN_CONFIG.statFloor;
  prio.forEach((k, i) => {
    out[k] = Math.max(floor, arr[i]);
  });
  if (RUN_CONFIG.primaryBonus) out[prio[0]] += RUN_CONFIG.primaryBonus;
  return out;
}

/** upkeep the club pays per fixture this chaindiver is on the books — scales with level and raw stat quality */
export function salaryFor(c: Character): number {
  const statSum = ABILITIES.reduce((s, k) => s + c.abilities[k], 0);
  return Math.max(4, Math.round(6 + c.level * 5 + (statSum - 60) * 0.6));
}

function avgHitDie(die: number): number {
  return die / 2 + 1;
}

/** how many character levels each taken class has, in first-taken order */
export function classLevelsOf(c: Character): Partial<Record<ClassId, number>> {
  const out: Partial<Record<ClassId, number>> = {};
  for (const id of c.levelHistory) out[id] = (out[id] ?? 0) + 1;
  return out;
}

/** the class with the most levels (ties go to whichever was taken first) */
export function primaryClassOf(c: Character): ClassId {
  const counts = classLevelsOf(c);
  let best: ClassId = c.levelHistory[0] ?? c.classId;
  let bestN = 0;
  for (const id of c.levelHistory) {
    const n = counts[id] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  return best;
}

/** classes this character could take their next level in: known ones (free) + eligible new ones */
export function eligibleClasses(c: Character): { classId: ClassId; known: boolean; admission: Admission }[] {
  const counts = classLevelsOf(c);
  return CLASS_IDS.filter((id) => (counts[id] ?? 0) > 0 || admissionFor(c, id).met).map((id) => ({
    classId: id,
    known: (counts[id] ?? 0) > 0,
    admission: admissionFor(c, id),
  }));
}

/** "Fighter" for a single-classer, "Fighter / Rogue" once multiclassed */
export function classHeaderLabel(c: Character): string {
  const order = [...new Set(c.levelHistory)];
  return order.length <= 1 ? CLASSES[c.classId].name : order.map((id) => CLASSES[id].name).join(" / ");
}

/** "Fighter 3 / Rogue 2" — full level split */
export function classLabel(c: Character): string {
  const counts = classLevelsOf(c);
  const order = [...new Set(c.levelHistory)];
  return order.map((id) => `${CLASSES[id].name} ${counts[id]}`).join(" / ");
}

/** (re)compute all derived stats from race/class-levels/traits */
export function recompute(c: Character): void {
  const race = RACES[c.raceId];
  if (c.levelHistory.length === 0) c.levelHistory = [c.classId];
  c.level = c.levelHistory.length;
  c.classId = primaryClassOf(c);
  const primaryCls = CLASSES[c.classId];

  // base weapon from the starting class unless a trait replaced it; never reassigned after
  const weapon = c.weapon ?? { ...primaryCls.weapon };
  c.weapon = weapon;

  // features accumulate per class, gated by THAT class's own level (5e multiclass rule) —
  // a Fighter 5 / Wizard 1 has Extra Attack but only a Wizard's 1st-level features.
  c.featureIds = [];
  const seen: Partial<Record<ClassId, number>> = {};
  for (const clsId of c.levelHistory) {
    seen[clsId] = (seen[clsId] ?? 0) + 1;
    for (const f of CLASSES[clsId].features[seen[clsId]!] ?? []) c.featureIds.push(f);
  }
  for (const t of race.traits) if (!c.featureIds.includes(t)) c.featureIds.push(t);

  // HP: only the very first character level rolls max; every level after — even a
  // first level in a brand new class — uses that class's average (5e multiclass rule).
  const conMod = mod(c.abilities.CON);
  let maxHp = 0;
  c.levelHistory.forEach((clsId, i) => {
    const die = CLASSES[clsId].hitDie;
    maxHp += i === 0 ? die + conMod : Math.max(1, Math.round(avgHitDie(die) + conMod));
  });
  if (c.featureIds.includes("fighter_grit") || c.featureIds.includes("barb_toughness")) maxHp += 2 * c.level;
  c.maxHp = Math.max(1, maxHp);

  // AC: the best armour model you're proficient in across every class you've taken
  const dexMod = mod(c.abilities.DEX);
  const wisMod = mod(c.abilities.WIS);
  let ac = 10 + dexMod;
  for (const clsId of new Set(c.levelHistory)) {
    const cls = CLASSES[clsId];
    const option =
      clsId === "monk"
        ? 10 + dexMod + wisMod
        : clsId === "barbarian"
          ? 10 + dexMod + conMod
          : 10 + Math.min(dexMod, cls.dexCap) + cls.baseArmor;
    ac = Math.max(ac, option);
  }
  c.ac = ac;
  if (c.featureIds.includes("barkskin")) c.ac += 1;
  if (c.featureIds.includes("infused_armor")) c.ac += 1;

  c.speed = race.speed;
  c.skills = [...new Set(c.levelHistory.flatMap((id) => CLASSES[id].skills))];

  // static trait effects
  for (const id of c.traitIds) {
    const t = TRAITS[id];
    if (t?.apply) t.apply(c);
  }

  if (c.hp > c.maxHp) c.hp = c.maxHp;
  c.salary = salaryFor(c);
}

export function toHit(c: Character): number {
  const ab = c.weapon.ability;
  let bonus = profBonus(c.level) + mod(c.abilities[ab]);
  if (c.weapon.name.startsWith("Keen ")) bonus += 1;
  return bonus;
}

export function damageBonus(c: Character): number {
  return mod(c.abilities[c.weapon.ability]);
}

let idCounter = 0;
export function makeCharacter(rng: RNG, opts?: { classId?: ClassId; raceId?: RaceId; statFloor?: number }): Character {
  const raceId = opts?.raceId ?? rng.weighted(RACE_WEIGHTS);
  const classId = opts?.classId ?? rng.weighted(CLASS_WEIGHTS);
  const abilities = assignStats(rng, classId, opts?.statFloor);

  // race mods
  const race = RACES[raceId];
  for (const k of ABILITIES) abilities[k] += race.mods[k] ?? 0;

  // traits: 0-2 rolled, plus an extra roll for humans
  const traitCount = rng.weighted([
    [0, 20],
    [1, 45],
    [2, 35],
  ]) + (raceId === "human" ? 1 : 0);
  const traitIds = rng.sample(ROLLABLE_TRAITS, traitCount);
  // Smithy issue: Guild kit on every recruit
  const gear = ["guild_arms", "guild_edge", "guild_rations"];
  for (let i = 0; i < RUN_CONFIG.gearTier && i < gear.length; i++) traitIds.push(gear[i]);

  const c: Character = {
    id: `c${idCounter++}`,
    name: makeName((a) => rng.pick(a)),
    raceId,
    classId,
    level: 1,
    xp: 0,
    levelHistory: [classId],
    pendingLevelUps: 0,
    abilities,
    traitIds,
    maxHp: 1,
    hp: 1,
    speed: race.speed,
    ac: 10,
    weapon: { ...CLASSES[classId].weapon },
    featureIds: [],
    skills: [],
    kills: 0,
    floorsSurvived: 0,
    injuries: [],
    salary: 0,
  };
  recompute(c);
  c.hp = c.maxHp;
  return c;
}

/**
 * Grant xp. Levels earned queue up as `pendingLevelUps` rather than applying
 * immediately — the player assigns each one to a class via applyLevelUp()
 * (the Aftermath screen's "choose advancement" step). Returns levels earned.
 */
export function grantXp(c: Character, amount: number): number {
  c.xp += amount;
  const cap = Math.min(LEVEL_CAP, RUN_CONFIG.levelCap);
  let gained = 0;
  let committed = c.levelHistory.length + c.pendingLevelUps;
  while (committed < cap && c.xp >= xpForLevel(committed + 1)) {
    committed++;
    gained++;
  }
  c.pendingLevelUps += gained;
  return gained;
}

/** resolve one pending level-up into the given class. Returns false if none pending. */
export function applyLevelUp(c: Character, classId: ClassId): boolean {
  if (c.pendingLevelUps <= 0) return false;
  c.levelHistory.push(classId);
  c.pendingLevelUps -= 1;
  const before = c.hp;
  recompute(c);
  // a fresh level always feels like a second wind: heal to at least half of what you gained
  c.hp = Math.min(c.maxHp, Math.max(before + Math.ceil(c.maxHp / 2), before));
  return true;
}

export function xpValue(monsterTier: number, monsterHp: number): number {
  return 20 + monsterTier * 25 + Math.floor(monsterHp / 2);
}

export interface FeatureSource {
  id: string;
  source: string;
  /** the class that granted it, if source is a class (not race) */
  classId?: ClassId;
}

/** every class feature this character has, tagged with which class/level granted it */
export function featureSources(c: Character): FeatureSource[] {
  const out: FeatureSource[] = [];
  const known = new Set<string>();
  const seen: Partial<Record<ClassId, number>> = {};
  for (const clsId of c.levelHistory) {
    seen[clsId] = (seen[clsId] ?? 0) + 1;
    for (const f of CLASSES[clsId].features[seen[clsId]!] ?? []) {
      if (known.has(f)) continue;
      known.add(f);
      out.push({ id: f, source: `${CLASSES[clsId].name} · L${seen[clsId]}`, classId: clsId });
    }
  }
  const race = RACES[c.raceId];
  for (const t of race.traits) {
    if (known.has(t)) continue;
    known.add(t);
    out.push({ id: t, source: `${race.name} (race)` });
  }
  return out;
}

export function statLine(c: Character): string {
  return ABILITIES.map((k) => `${k} ${c.abilities[k]}`).join("  ");
}

export function epitaphFor(c: Character, cause: string): string {
  const t = c.traitIds[0] ? TRAITS[c.traitIds[0]] : null;
  if (t?.id === "coward") return "Ran from everything. It caught up.";
  if (t?.id === "zealot") return "Believed, right up until the end.";
  if (t?.id === "lucky") return "Luck is a finite resource.";
  if (t?.id === "bloodscent") return "Chased the wounded thing one hex too far.";
  if (cause.includes("acid")) return "Dissolved on Deep " + c.floorsSurvived + ".";
  if (cause.includes("fell") || cause.includes("chasm")) return "The Pit took what it was owed.";
  return `${classLabel(c)}. ${c.kills} kills. Deep ${c.floorsSurvived}.`;
}
