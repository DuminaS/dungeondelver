import { Hex } from "../core/hex";
import { Character, MonsterDef, Unit, mod } from "./types";
import { damageBonus, toHit } from "./character";

let uid = 0;

export function unitFromCharacter(c: Character, pos: Hex): Unit {
  return {
    id: `u${uid++}`,
    team: "player",
    name: c.name,
    pos,
    maxHp: c.maxHp,
    hp: c.hp,
    ac: c.ac,
    speed: c.speed,
    toHit: toHit(c),
    weapon: { ...c.weapon },
    damageBonus: damageBonus(c),
    initiative: 0,
    charId: c.id,
    tags: [c.raceId, c.classId],
    conditions: [],
    movedThisTurn: 0,
    actionUsed: false,
    bonusUsed: false,
    reactionUsed: false,
    dashed: false,
    alive: c.hp > 0,
    downed: false,
    deathSuccess: 0,
    deathFail: 0,
    kills: 0,
    featureIds: [...c.featureIds, ...c.traitIds],
    secondWindUsed: false,
    surgeUsed: false,
    cureUses: 3,
    featUses: {},
    markTargetId: null,
    intent: null,
  };
}

export function unitFromMonster(m: MonsterDef, pos: Hex, hpScale = 1): Unit {
  return {
    id: `u${uid++}`,
    team: "enemy",
    name: m.name,
    pos,
    maxHp: Math.round(m.hp * hpScale),
    hp: Math.round(m.hp * hpScale),
    ac: m.ac,
    speed: m.speed,
    toHit: m.toHit,
    weapon: { ...m.weapon },
    damageBonus: m.damageBonus,
    initiative: 0,
    archetype: m.archetype,
    tags: [...m.tags, `def:${m.id}`],
    conditions: [],
    movedThisTurn: 0,
    actionUsed: false,
    bonusUsed: false,
    reactionUsed: false,
    dashed: false,
    alive: true,
    downed: false,
    deathSuccess: 0,
    deathFail: 0,
    kills: 0,
    featureIds: [],
    secondWindUsed: false,
    surgeUsed: false,
    cureUses: 0,
    featUses: {},
    markTargetId: null,
    intent: null,
  };
}

export function abilityMod(score: number): number {
  return mod(score);
}
