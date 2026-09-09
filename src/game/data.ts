import { AbilityKey, RaceDef, ClassDef, TraitDef, MonsterDef, RaceId, ClassId, WeaponDef } from "./types";

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

const W = (name: string, dice: string, ability: AbilityKey, range = 1, twoHanded = false): WeaponDef => ({
  name,
  dice,
  ranged: range > 1,
  range,
  ability,
  twoHanded,
});

export const CLASSES: Record<ClassId, ClassDef> = {
  fighter: {
    id: "fighter", name: "Fighter", hitDie: 10, primary: "STR", baseArmor: 5, dexCap: 2,
    weapon: W("Longsword", "1d8", "STR"),
    skills: ["Athletics", "Intimidation"],
    blurb: "Front line. Second Wind heal, Power Attack for big swings, Action Surge, Extra Attack at 5.",
    features: { 1: ["second_wind", "power_attack"], 2: ["action_surge"], 3: ["fighter_grit"], 5: ["extra_attack"] },
  },
  rogue: {
    id: "rogue", name: "Rogue", hitDie: 8, primary: "DEX", baseArmor: 2, dexCap: 6,
    weapon: W("Shortsword", "1d6", "DEX"),
    skills: ["Stealth", "Sleight of Hand"],
    blurb: "Flanker. Sneak Attack when an ally flanks the target; Cunning Action to dart away.",
    features: { 1: ["sneak_attack", "cunning_action"], 3: ["uncanny_dodge"], 5: ["sneak_attack_2"] },
  },
  ranger: {
    id: "ranger", name: "Ranger", hitDie: 10, primary: "DEX", baseArmor: 3, dexCap: 4,
    weapon: W("Longbow", "1d8", "DEX", 9, true),
    skills: ["Survival", "Perception"],
    blurb: "Ranged control. Hunter's Mark stacks damage; Colossus Slayer; Extra Attack at 5.",
    features: { 1: ["hunters_mark"], 3: ["colossus_slayer"], 5: ["extra_attack"] },
  },
  cleric: {
    id: "cleric", name: "Cleric", hitDie: 8, primary: "WIS", baseArmor: 5, dexCap: 2,
    weapon: W("Sacred Flame", "1d8", "WIS", 6),
    skills: ["Religion", "Medicine"],
    blurb: "Armoured support. Cure Wounds, Bless the line, radiant bolts at range.",
    features: { 1: ["cure_wounds", "sacred_flame"], 2: ["bless"], 3: ["radiant_scaling"] },
  },
  barbarian: {
    id: "barbarian", name: "Barbarian", hitDie: 12, primary: "STR", baseArmor: 0, dexCap: 6,
    weapon: W("Greataxe", "1d12", "STR", 1, true),
    skills: ["Athletics", "Survival"],
    blurb: "Rage to halve incoming blows and hit harder. Reckless Attack. Unarmored (CON). Extra Attack at 5.",
    features: { 1: ["rage"], 2: ["reckless"], 3: ["barb_toughness"], 5: ["extra_attack"] },
  },
  paladin: {
    id: "paladin", name: "Paladin", hitDie: 10, primary: "STR", baseArmor: 7, dexCap: 0,
    weapon: W("Longsword", "1d8", "STR"),
    skills: ["Religion", "Persuasion"],
    blurb: "Plate wall. Lay on Hands to heal, Divine Smite for burst radiant. Bless at 3. Extra Attack at 5.",
    features: { 1: ["lay_on_hands"], 2: ["divine_smite"], 3: ["bless"], 5: ["extra_attack"] },
  },
  monk: {
    id: "monk", name: "Monk", hitDie: 8, primary: "DEX", baseArmor: 0, dexCap: 6,
    weapon: W("Fists", "1d6", "DEX"),
    skills: ["Acrobatics", "Stealth"],
    blurb: "Unarmored (WIS), fast. Martial Strike as a bonus attack, Flurry of Blows, Patient Defense. Extra Attack at 5.",
    features: { 1: ["martial_strike"], 2: ["patient_defense"], 3: ["flurry"], 5: ["extra_attack"] },
  },
  bard: {
    id: "bard", name: "Bard", hitDie: 8, primary: "CHA", baseArmor: 3, dexCap: 3,
    weapon: W("Vicious Mockery", "1d6", "CHA", 6),
    skills: ["Persuasion", "Deception"],
    blurb: "Ranged jeers that leave a target off-balance. Inspire an ally, Healing Word from range.",
    features: { 1: ["inspire"], 3: ["healing_word"], 5: ["cutting_words"] },
  },
  druid: {
    id: "druid", name: "Druid", hitDie: 8, primary: "WIS", baseArmor: 3, dexCap: 3,
    weapon: W("Produce Flame", "1d8", "WIS", 6),
    skills: ["Nature", "Survival"],
    blurb: "Flame at range, Healing Word for the party, Wild Shape to heal up and grow claws. Barkskin at 3.",
    features: { 1: ["healing_word"], 2: ["wild_shape"], 3: ["barkskin"] },
  },
  sorcerer: {
    id: "sorcerer", name: "Sorcerer", hitDie: 6, primary: "CHA", baseArmor: 0, dexCap: 6,
    weapon: W("Chaos Bolt", "1d10", "CHA", 8),
    skills: ["Arcana", "Deception"],
    blurb: "Raw blasting. Font of Magic (+1 ranged), Quickened Spell for a bonus-action bolt, bigger dice at 5.",
    features: { 1: ["font_of_magic"], 2: ["quickened"], 5: ["sorc_scaling"] },
  },
  warlock: {
    id: "warlock", name: "Warlock", hitDie: 8, primary: "CHA", baseArmor: 2, dexCap: 4,
    weapon: W("Eldritch Blast", "1d10", "CHA", 10),
    skills: ["Arcana", "Intimidation"],
    blurb: "One relentless beam. Hex a target for +1d6, Fiendish Vigor to shrug damage, twin beam at 5.",
    features: { 1: ["hex"], 2: ["fiendish_vigor", "agonizing_blast"], 5: ["extra_attack"] },
  },
  wizard: {
    id: "wizard", name: "Wizard", hitDie: 6, primary: "INT", baseArmor: 0, dexCap: 6,
    weapon: W("Firebolt", "1d10", "INT", 10),
    skills: ["Arcana", "Investigation"],
    blurb: "Fragile artillery. Magic Missile that never misses, Misty Step to blink away, Shield, 2d10 bolt at 5.",
    features: { 1: ["magic_missile"], 2: ["misty_step"], 3: ["arcane_shield"], 5: ["fire_scaling"] },
  },
  artificer: {
    id: "artificer", name: "Artificer", hitDie: 8, primary: "INT", baseArmor: 3, dexCap: 3,
    weapon: W("Repeating Shot", "1d8", "INT", 8),
    skills: ["Investigation", "Perception"],
    blurb: "Gadget support. Alchemist's Fire to ignite a target, infused armour (+1 AC), Flash Repair heals.",
    features: { 1: ["alchemist_fire"], 2: ["infused_armor"], 3: ["flash_repair"] },
  },
};

export const CLASS_WEIGHTS: [ClassId, number][] = [
  ["fighter", 12], ["rogue", 11], ["ranger", 11], ["cleric", 9],
  ["barbarian", 10], ["paladin", 8], ["monk", 9], ["bard", 8],
  ["druid", 8], ["sorcerer", 8], ["warlock", 8], ["wizard", 9], ["artificer", 7],
];

/** feature id -> short label for the action bar / tooltips */
export const FEATURES: Record<string, { name: string; text: string }> = {
  second_wind: { name: "Second Wind", text: "Bonus: heal 1d10 + level. Once per encounter." },
  power_attack: { name: "Power Attack", text: "Action: attack at -2 to hit for +4 damage." },
  action_surge: { name: "Action Surge", text: "Bonus: refresh your Action. Once per encounter." },
  fighter_grit: { name: "Grit", text: "Passive: +2 max HP per level." },
  extra_attack: { name: "Extra Attack", text: "Passive: your Attack action strikes twice." },
  sneak_attack: { name: "Sneak Attack", text: "+1d6 when an ally is adjacent to your target." },
  sneak_attack_2: { name: "Sneak Attack+", text: "Sneak Attack die becomes 2d6." },
  cunning_action: { name: "Cunning Action", text: "Bonus: Dash or Disengage." },
  uncanny_dodge: { name: "Uncanny Dodge", text: "Passive: better at slipping big hits." },
  hunters_mark: { name: "Hunter's Mark", text: "Bonus: mark a target for +1d6 from you." },
  colossus_slayer: { name: "Colossus Slayer", text: "+1d8 vs. a hurt target (1/turn)." },
  cure_wounds: { name: "Cure Wounds", text: "Action: touch an ally, heal 1d8 + WIS. 3/enc." },
  sacred_flame: { name: "Sacred Flame", text: "Your ranged radiant attack." },
  bless: { name: "Bless", text: "Bonus: you & adjacent allies +1d4 to hit for 3 rounds." },
  radiant_scaling: { name: "Radiant Focus", text: "Passive: Sacred Flame deals 2d8." },
  rage: { name: "Rage", text: "Bonus: +2 melee damage, halve physical hits taken. 2/enc." },
  reckless: { name: "Reckless Attack", text: "This turn your melee attacks have advantage — and so do attacks against you." },
  barb_toughness: { name: "Toughness", text: "Passive: +2 max HP per level." },
  lay_on_hands: { name: "Lay on Hands", text: "Action: heal an adjacent ally 1d8 + 4. 2/enc." },
  divine_smite: { name: "Divine Smite", text: "Action: attack with +2d8 radiant. 2/enc." },
  martial_strike: { name: "Martial Strike", text: "Bonus: one unarmed attack." },
  patient_defense: { name: "Patient Defense", text: "Bonus: Dodge." },
  flurry: { name: "Flurry of Blows", text: "Bonus: two unarmed attacks. 3/enc." },
  inspire: { name: "Inspire", text: "Bonus: an ally gains +1d6 to their next attack. 3/enc." },
  healing_word: { name: "Healing Word", text: "Bonus: heal an ally within 6 for 1d4 + mod (revives downed). 2/enc." },
  wild_shape: { name: "Wild Shape", text: "Bonus: heal 1d10 + level and fight with 1d10 claws. 1/enc." },
  barkskin: { name: "Barkskin", text: "Passive: +1 AC." },
  font_of_magic: { name: "Font of Magic", text: "Passive: +1 ranged damage." },
  quickened: { name: "Quickened Spell", text: "Bonus: one ranged attack. 2/enc." },
  sorc_scaling: { name: "Sorcerous Burst", text: "Passive: your bolt deals 2d8." },
  hex: { name: "Hex", text: "Bonus: hex a target for +1d6 from you." },
  fiendish_vigor: { name: "Fiendish Vigor", text: "Bonus: gain 1d10 HP. 2/enc." },
  agonizing_blast: { name: "Agonizing Blast", text: "Passive: +2 blast damage." },
  magic_missile: { name: "Magic Missile", text: "Action: 3d4 + 3 force to one target in sight. Never misses. 2/enc." },
  misty_step: { name: "Misty Step", text: "Bonus: blink to any hex within 6. 1/enc." },
  arcane_shield: { name: "Shield", text: "Bonus: +4 AC until your next turn." },
  fire_scaling: { name: "Empowered Bolt", text: "Passive: Firebolt deals 2d10." },
  alchemist_fire: { name: "Alchemist's Fire", text: "Action: 2d6 fire + Burning to a target within 6. 3/enc." },
  infused_armor: { name: "Infused Armour", text: "Passive: +1 AC." },
  flash_repair: { name: "Flash Repair", text: "Bonus: heal an ally within 6 for 1d8 + INT. 2/enc." },
  cutting_words: { name: "Cutting Words", text: "Passive: Vicious Mockery also leaves the target off-balance." },
  // racial
  stoneblood: { name: "Stoneblood", text: "Advantage vs. poison; -1 from hazards." },
  keen_eyed: { name: "Keen-Eyed", text: "+1 ranged to hit at 3+ hexes." },
  relentless: { name: "Relentless", text: "Once per floor, a killing blow leaves you at 1 HP." },
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
