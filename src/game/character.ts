import { RNG } from "../core/rng";
import {
  Abilities,
  AbilityKey,
  ABILITIES,
  Character,
  ClassId,
  mod,
  RaceId,
} from "./types";
import {
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

function assignStats(rng: RNG, classId: ClassId): Abilities {
  const arr = rollStatArray(rng);
  const prio = STAT_PRIORITY[classId];
  const out = {} as Abilities;
  prio.forEach((k, i) => {
    out[k] = Math.max(RUN_CONFIG.statFloor, arr[i]);
  });
  if (RUN_CONFIG.primaryBonus) out[prio[0]] += RUN_CONFIG.primaryBonus;
  return out;
}

function avgHitDie(die: number): number {
  return die / 2 + 1;
}

/** (re)compute all derived stats from race/class/level/traits */
export function recompute(c: Character): void {
  const race = RACES[c.raceId];
  const cls = CLASSES[c.classId];

  // base weapon from class unless a trait replaced it (heirloom); keep name if renamed
  const weapon = c.weapon ?? { ...cls.weapon };
  c.weapon = weapon;

  // features up to current level
  c.featureIds = [];
  for (let l = 1; l <= c.level; l++) {
    for (const f of cls.features[l] ?? []) c.featureIds.push(f);
  }
  for (const t of race.traits) if (!c.featureIds.includes(t)) c.featureIds.push(t);

  const conMod = mod(c.abilities.CON);
  let maxHp = cls.hitDie + conMod;
  for (let l = 2; l <= c.level; l++) maxHp += Math.max(1, Math.round(avgHitDie(cls.hitDie) + conMod));
  if (c.featureIds.includes("fighter_grit") || c.featureIds.includes("barb_toughness")) maxHp += 2 * c.level;
  c.maxHp = Math.max(1, maxHp);

  const dexMod = mod(c.abilities.DEX);
  const wisMod = mod(c.abilities.WIS);
  if (c.classId === "monk") c.ac = 10 + dexMod + wisMod;
  else if (c.classId === "barbarian") c.ac = 10 + dexMod + conMod;
  else c.ac = 10 + Math.min(dexMod, cls.dexCap) + cls.baseArmor;
  if (c.featureIds.includes("barkskin")) c.ac += 1;
  if (c.featureIds.includes("infused_armor")) c.ac += 1;

  c.speed = race.speed;
  c.skills = [...cls.skills];

  // static trait effects
  for (const id of c.traitIds) {
    const t = TRAITS[id];
    if (t?.apply) t.apply(c);
  }

  if (c.hp > c.maxHp) c.hp = c.maxHp;
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
export function makeCharacter(rng: RNG, opts?: { classId?: ClassId; raceId?: RaceId }): Character {
  const raceId = opts?.raceId ?? rng.weighted(RACE_WEIGHTS);
  const classId = opts?.classId ?? rng.weighted(CLASS_WEIGHTS);
  const abilities = assignStats(rng, classId);

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
  };
  recompute(c);
  c.hp = c.maxHp;
  return c;
}

/** grant xp; returns number of levels gained */
export function grantXp(c: Character, amount: number): number {
  c.xp += amount;
  let gained = 0;
  const cap = Math.min(LEVEL_CAP, RUN_CONFIG.levelCap);
  while (c.level < cap && c.xp >= xpForLevel(c.level + 1)) {
    c.level += 1;
    gained += 1;
  }
  if (gained) {
    const before = c.hp;
    recompute(c);
    // level-up second wind: heal half the max, min the HP gained
    c.hp = Math.min(c.maxHp, Math.max(before + Math.ceil(c.maxHp / 2), before));
  }
  return gained;
}

export function xpValue(monsterTier: number, monsterHp: number): number {
  return 20 + monsterTier * 25 + Math.floor(monsterHp / 2);
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
  return `${CLASSES[c.classId].name}. ${c.kills} kills. Deep ${c.floorsSurvived}.`;
}
