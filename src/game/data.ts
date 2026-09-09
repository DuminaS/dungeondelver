import { RaceDef, ClassDef, TraitDef, MonsterDef, RaceId, ClassId } from "./types";

// ---------------------------------------------------------------- races

export const RACES: Record<RaceId, RaceDef> = {
  human: {
    id: "human",
    name: "Human",
    mods: { STR: 1, DEX: 1, CON: 1 },
    speed: 6,
    blurb: "Flexible. +1 STR/DEX/CON. Free extra trait.",
    traits: [],
  },
  dwarf: {
    id: "dwarf",
    name: "Dwarf",
    mods: { CON: 2, WIS: 1 },
    speed: 5,
    blurb: "+2 CON, +1 WIS. Poison-tough, steady on their feet.",
    traits: ["stoneblood"],
  },
  elf: {
    id: "elf",
    name: "Elf",
    mods: { DEX: 2, INT: 1 },
    speed: 7,
    blurb: "+2 DEX, +1 INT. Fast, keen-eyed.",
    traits: ["keen_eyed"],
  },
  halforc: {
    id: "halforc",
    name: "Half-Orc",
    mods: { STR: 2, CON: 1 },
    speed: 6,
    blurb: "+2 STR, +1 CON. Relentless — shrugs off the first killing blow each floor.",
    traits: ["relentless"],
  },
};

export const RACE_WEIGHTS: [RaceId, number][] = [
  ["human", 30],
  ["dwarf", 18],
  ["elf", 18],
  ["halforc", 14],
];

// ---------------------------------------------------------------- classes

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    primary: "STR",
    baseArmor: 5, // 10 + dex(cap 2) + 5  ~= chain shirt + shield
    dexCap: 2,
    weapon: { name: "Longsword", dice: "1d8", ranged: false, range: 1, ability: "STR" },
    skills: ["Athletics", "Intimidation"],
    blurb: "Front line. Second Wind self-heal; Power Attack for big swings; Extra Attack at 5.",
    features: {
      1: ["second_wind", "power_attack"],
      2: ["action_surge"],
      3: ["fighter_grit"],
      5: ["extra_attack"],
    },
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    primary: "DEX",
    baseArmor: 2,
    dexCap: 6,
    weapon: { name: "Shortsword", dice: "1d6", ranged: false, range: 1, ability: "DEX" },
    skills: ["Stealth", "Sleight of Hand"],
    blurb: "Flanker. Sneak Attack when an ally flanks the target; Cunning Action to dart away.",
    features: {
      1: ["sneak_attack", "cunning_action"],
      3: ["uncanny_dodge"],
      5: ["sneak_attack_2"],
    },
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    primary: "DEX",
    baseArmor: 3,
    dexCap: 3,
    weapon: { name: "Longbow", dice: "1d8", ranged: true, range: 9, ability: "DEX", twoHanded: true },
    skills: ["Survival", "Perception"],
    blurb: "Ranged control. Hunter's Mark stacks damage on one target; Extra Attack at 5.",
    features: {
      1: ["hunters_mark"],
      3: ["colossus_slayer"],
      5: ["extra_attack"],
    },
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    primary: "WIS",
    baseArmor: 4,
    dexCap: 2,
    weapon: { name: "Sacred Flame", dice: "1d8", ranged: true, range: 6, ability: "WIS" },
    skills: ["Religion", "Medicine"],
    blurb: "Support. Cure Wounds to patch allies; Bless the party; radiant bolts at range.",
    features: {
      1: ["cure_wounds", "sacred_flame"],
      2: ["bless"],
      3: ["radiant_scaling"],
    },
  },
};

export const CLASS_WEIGHTS: [ClassId, number][] = [
  ["fighter", 30],
  ["rogue", 25],
  ["ranger", 25],
  ["cleric", 20],
];

/** feature id -> short label for the action bar / tooltips */
export const FEATURES: Record<string, { name: string; text: string }> = {
  second_wind: { name: "Second Wind", text: "Bonus action: heal 1d10 + level. Once per encounter." },
  power_attack: { name: "Power Attack", text: "Attack at -2 to hit for +4 damage." },
  action_surge: { name: "Action Surge", text: "Take one extra Action. Once per encounter." },
  fighter_grit: { name: "Grit", text: "+2 max HP per level." },
  extra_attack: { name: "Extra Attack", text: "Your Attack action makes two attacks." },
  sneak_attack: { name: "Sneak Attack", text: "+1d6 damage when an ally is adjacent to your target." },
  sneak_attack_2: { name: "Sneak Attack +", text: "Sneak Attack die becomes 2d6." },
  cunning_action: { name: "Cunning Action", text: "Bonus action: Dash or Disengage." },
  uncanny_dodge: { name: "Uncanny Dodge", text: "Reaction: halve one hit against you." },
  hunters_mark: { name: "Hunter's Mark", text: "Bonus action: mark a target for +1d6 damage from you." },
  colossus_slayer: { name: "Colossus Slayer", text: "+1d8 vs. a target already below full HP (1/turn)." },
  cure_wounds: { name: "Cure Wounds", text: "Action: touch an ally, heal 1d8 + WIS. 3/encounter." },
  sacred_flame: { name: "Sacred Flame", text: "Ranged radiant attack (your basic attack)." },
  bless: { name: "Bless", text: "Bonus action: you and adjacent allies get +1d4 to hit for 3 rounds." },
  radiant_scaling: { name: "Radiant Focus", text: "Sacred Flame deals 2d8." },
  // racial
  stoneblood: { name: "Stoneblood", text: "Advantage on saves vs. poison; -1 incoming from hazards." },
  keen_eyed: { name: "Keen-Eyed", text: "+1 to hit with ranged attacks 3+ hexes away." },
  relentless: { name: "Relentless", text: "First hit that would drop you to 0 each floor leaves you at 1." },
};

// ---------------------------------------------------------------- traits

export const TRAITS: Record<string, TraitDef> = {
  ironhide: {
    id: "ironhide",
    name: "Ironhide",
    kind: "boon",
    text: "+2 max HP per level, -1 Speed.",
    apply: (c) => {
      c.maxHp += 2 * c.level;
      c.speed -= 1;
    },
  },
  fleet: {
    id: "fleet",
    name: "Fleet",
    kind: "boon",
    text: "+1 Speed.",
    apply: (c) => {
      c.speed += 1;
    },
  },
  bloodscent: {
    id: "bloodscent",
    name: "Bloodscent",
    kind: "boon",
    text: "+2 to hit and +2 damage vs. enemies below half HP.",
  },
  giantblood: {
    id: "giantblood",
    name: "Giantblood",
    kind: "boon",
    text: "Counts as larger: Shove and knock-down land more easily. -1 AC.",
    apply: (c) => {
      c.ac -= 1;
    },
  },
  lucky: {
    id: "lucky",
    name: "Lucky",
    kind: "quirk",
    text: "Once per floor, reroll one of your d20s. (auto-used on a natural 1)",
  },
  zealot: {
    id: "zealot",
    name: "Zealot",
    kind: "boon",
    text: "+2 damage while above three-quarters HP.",
  },
  coward: {
    id: "coward",
    name: "Coward's Instinct",
    kind: "quirk",
    text: "First time below 25% HP each floor: immediately Disengage and half-move away (auto).",
  },
  frail: {
    id: "frail",
    name: "Frail",
    kind: "bane",
    text: "-3 max HP per level.",
    apply: (c) => {
      c.maxHp = Math.max(c.level, c.maxHp - 3 * c.level);
    },
  },
  greenhorn: {
    id: "greenhorn",
    name: "Greenhorn",
    kind: "bane",
    text: "-2 initiative.",
  },
  brittle: {
    id: "brittle",
    name: "Brittle Bones",
    kind: "bane",
    text: "Take +1 damage from every hit.",
  },
  heirloom: {
    id: "heirloom",
    name: "Heirloom Bearer",
    kind: "quirk",
    text: "Starts with a keen weapon: +1 to hit, crits on 19-20.",
    apply: (c) => {
      if (!c.weapon.name.startsWith("Keen ")) {
        c.weapon = { ...c.weapon, name: `Keen ${c.weapon.name}` };
      }
    },
  },
  stoneblood: {
    id: "stoneblood",
    name: "Stoneblood",
    kind: "boon",
    text: "Advantage vs. poison; -1 damage from hazards.",
  },
  keen_eyed: {
    id: "keen_eyed",
    name: "Keen-Eyed",
    kind: "boon",
    text: "+1 to hit with ranged attacks at 3+ hexes.",
  },
  relentless: {
    id: "relentless",
    name: "Relentless",
    kind: "boon",
    text: "Once per floor, a killing blow leaves you at 1 HP instead.",
  },
};

/** traits eligible for the random roll (racial ones are added separately) */
export const ROLLABLE_TRAITS: string[] = [
  "ironhide",
  "fleet",
  "bloodscent",
  "giantblood",
  "lucky",
  "zealot",
  "coward",
  "frail",
  "greenhorn",
  "brittle",
  "heirloom",
];

// ---------------------------------------------------------------- monsters

export const MONSTERS: Record<string, MonsterDef> = {
  pit_rat: {
    id: "pit_rat",
    name: "Pit Rat",
    archetype: "skirmisher",
    hp: 6,
    ac: 12,
    toHit: 4,
    weapon: { name: "bite", dice: "1d4", ranged: false, range: 1, ability: "DEX" },
    damageBonus: 1,
    speed: 6,
    initiative: 2,
    tags: ["beast", "pack"],
    tier: 1,
  },
  scavenger: {
    id: "scavenger",
    name: "Scavenger",
    archetype: "brute",
    hp: 11,
    ac: 12,
    toHit: 3,
    weapon: { name: "cleaver", dice: "1d6", ranged: false, range: 1, ability: "STR" },
    damageBonus: 2,
    speed: 6,
    initiative: 1,
    tags: ["humanoid"],
    tier: 1,
  },
  slinger: {
    id: "slinger",
    name: "Cave Slinger",
    archetype: "archer",
    hp: 8,
    ac: 12,
    toHit: 4,
    weapon: { name: "sling", dice: "1d6", ranged: true, range: 7, ability: "DEX" },
    damageBonus: 1,
    speed: 5,
    initiative: 3,
    tags: ["humanoid"],
    tier: 1,
  },
  thrall: {
    id: "thrall",
    name: "Fungal Thrall",
    archetype: "brute",
    hp: 13,
    ac: 11,
    toHit: 3,
    weapon: { name: "slam", dice: "1d6", ranged: false, range: 1, ability: "STR" },
    damageBonus: 1,
    speed: 4,
    initiative: 0,
    tags: ["deep", "plant"],
    tier: 1,
    onDeath: "gas",
  },
  rime_hound: {
    id: "rime_hound",
    name: "Rime Hound",
    archetype: "brute",
    hp: 16,
    ac: 13,
    toHit: 5,
    weapon: { name: "frost bite", dice: "2d6", ranged: false, range: 1, ability: "STR" },
    damageBonus: 0,
    speed: 8,
    initiative: 3,
    tags: ["beast", "pack"],
    tier: 2,
  },
  bone_archer: {
    id: "bone_archer",
    name: "Bone Archer",
    archetype: "archer",
    hp: 12,
    ac: 13,
    toHit: 5,
    weapon: { name: "warbow", dice: "1d8", ranged: true, range: 9, ability: "DEX" },
    damageBonus: 2,
    speed: 6,
    initiative: 2,
    tags: ["undead"],
    tier: 2,
  },
  chained_gladiator: {
    id: "chained_gladiator",
    name: "Chained Gladiator",
    archetype: "elite",
    hp: 40,
    ac: 15,
    toHit: 6,
    weapon: { name: "greataxe", dice: "1d12", ranged: false, range: 1, ability: "STR" },
    damageBonus: 4,
    speed: 6,
    initiative: 2,
    tags: ["humanoid", "champion"],
    tier: 2,
  },
};

// ---------------------------------------------------------------- names

const NAME_FIRST = [
  "Kerr", "Vosk", "Mirel", "Dunn", "Halsa", "Bryn", "Oda", "Threa", "Gallo", "Sef",
  "Rurik", "Mave", "Tolin", "Esk", "Wren", "Bael", "Corvi", "Nix", "Hodd", "Sair",
];
const NAME_LAST = [
  "the Debtor", "Coalfoot", "Ninefingers", "Ashborn", "of the Rope", "Gravewise", "Sorrowes",
  "Pitborn", "Emberhand", "the Marked", "Coinless", "Rimewalk", "Hollowen", "Deepsent", "Chainbroke",
  "the Unpaid", "Lowe", "Blackbile", "Corpsemarch", "the Fourth", "Grimmet", "Vane", "Underhill",
];

export function makeName(rngPick: <T>(a: readonly T[]) => T): string {
  return `${rngPick(NAME_FIRST)} ${rngPick(NAME_LAST)}`;
}
