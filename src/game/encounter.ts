import { RNG } from "../core/rng";
import { Hex, distance, eq, key, neighbors } from "../core/hex";
import { HexGrid, HazardKind } from "../core/grid";
import { Condition, ConditionKind, Objective, Unit } from "./types";

export interface AttackPreview {
  target: Unit;
  chance: number; // 0..1
  mode: "flat" | "adv" | "dis";
  minDmg: number;
  maxDmg: number;
  inRange: boolean;
  hasLos: boolean;
}

export interface FeatureButton {
  id: string;
  name: string;
  text: string;
  enabled: boolean;
  reason?: string;
  needsTarget: "ally" | "enemy" | "none";
  kind: "action" | "bonus";
}

export type EncPhase = "deploy" | "player" | "enemy" | "won" | "lost";

const HAZARD_ENTER: Record<HazardKind, { dice: string; note: string }> = {
  acid: { dice: "1d6", note: "acid" },
  spikes: { dice: "1d4", note: "spikes" },
  fire: { dice: "1d6", note: "fire" },
  gas: { dice: "1d4", note: "gas" },
};

export class Encounter {
  grid: HexGrid;
  units: Unit[];
  objective: Objective;
  rng: RNG;
  depth: number;

  phase: EncPhase = "deploy";
  round = 1;
  turnOrder: string[] = [];
  turnIdx = 0;
  log: string[] = [];
  onChange: (() => void) | null = null;

  // deployment
  deployZone: Hex[] = [];
  toDeploy: Unit[] = [];

  constructor(opts: {
    grid: HexGrid;
    players: Unit[];
    enemies: Unit[];
    objective: Objective;
    rng: RNG;
    depth: number;
    deployZone: Hex[];
  }) {
    this.grid = opts.grid;
    this.units = [...opts.enemies];
    this.objective = opts.objective;
    this.rng = opts.rng;
    this.depth = opts.depth;
    this.deployZone = opts.deployZone;
    this.toDeploy = [...opts.players];
    this.say(objectiveText(opts.objective, opts.depth));
  }

  private say(s: string): void {
    this.log.push(s);
    if (this.log.length > 200) this.log.shift();
  }

  emit(): void {
    this.onChange?.();
  }

  // ---------------------------------------------------------------- helpers

  occupied(except?: Unit): Set<string> {
    const s = new Set<string>();
    for (const u of this.units) {
      if (u === except) continue;
      if (u.alive) s.add(key(u.pos));
    }
    return s;
  }

  unitAt(h: Hex): Unit | undefined {
    return this.units.find((u) => u.alive && eq(u.pos, h));
  }

  get active(): Unit | null {
    if (this.phase !== "player" && this.phase !== "enemy") return null;
    const id = this.turnOrder[this.turnIdx];
    return this.units.find((u) => u.id === id) ?? null;
  }

  allies(u: Unit): Unit[] {
    return this.units.filter((x) => x.team === u.team && x.alive && x !== u);
  }

  enemiesOf(u: Unit): Unit[] {
    return this.units.filter((x) => x.team !== u.team && x.alive);
  }

  hasCondition(u: Unit, k: ConditionKind): boolean {
    return u.conditions.some((c) => c.kind === k);
  }

  addCondition(u: Unit, c: Condition): void {
    const existing = u.conditions.find((x) => x.kind === c.kind);
    if (existing) existing.duration = Math.max(existing.duration, c.duration);
    else u.conditions.push({ ...c });
  }

  removeCondition(u: Unit, k: ConditionKind): void {
    u.conditions = u.conditions.filter((c) => c.kind !== k);
  }

  moveBudget(u: Unit): number {
    const base = u.dashed ? u.speed * 2 : u.speed;
    return Math.max(0, base - u.movedThisTurn);
  }

  // ---------------------------------------------------------------- deployment

  placeNext(h: Hex): boolean {
    if (this.phase !== "deploy" || !this.toDeploy.length) return false;
    if (!this.deployZone.some((d) => eq(d, h))) return false;
    if (this.unitAt(h)) return false;
    const u = this.toDeploy.shift()!;
    u.pos = { ...h };
    this.units.push(u);
    if (!this.toDeploy.length) this.startCombat();
    this.emit();
    return true;
  }

  autoDeploy(): void {
    const free = this.deployZone.filter((h) => !this.unitAt(h));
    while (this.toDeploy.length && free.length) {
      const h = free.shift()!;
      const u = this.toDeploy.shift()!;
      u.pos = { ...h };
      this.units.push(u);
    }
    if (!this.toDeploy.length) this.startCombat();
    this.emit();
  }

  private startCombat(): void {
    for (const u of this.units) {
      u.initiative = this.rng.int(1, 20) + Math.floor((u.speed - 6) / 2) + (u.archetype === "archer" ? 2 : 0);
    }
    this.turnOrder = this.units
      .filter((u) => u.alive)
      .sort((a, b) => b.initiative - a.initiative || (a.team === "player" ? -1 : 1))
      .map((u) => u.id);
    this.round = 1;
    this.turnIdx = -1;
    this.phase = "player";
    this.say(`— Round 1 —`);
    this.beginNextTurn();
  }

  // ---------------------------------------------------------------- turn flow

  private beginNextTurn(): void {
    for (let guard = 0; guard < 200; guard++) {
      this.turnIdx++;
      if (this.turnIdx >= this.turnOrder.length) {
        this.endRound();
        if (this.phase === "won" || this.phase === "lost") return;
        this.turnIdx = 0;
      }
      const u = this.units.find((x) => x.id === this.turnOrder[this.turnIdx]);
      if (!u || !u.alive) continue;

      // reset per-turn budget
      u.movedThisTurn = 0;
      u.actionUsed = false;
      u.bonusUsed = false;
      u.dashed = false;
      u.sneakUsedThisTurn = false;
      u.colossusUsedThisTurn = false;
      this.removeCondition(u, "disengaged");

      // start-of-turn hazard + conditions
      this.startOfTurnEffects(u);
      if (this.checkEnd()) return;
      if (!u.alive) continue;

      if (u.downed) {
        this.rollDeathSave(u);
        if (this.checkEnd()) return;
        continue;
      }

      this.phase = u.team === "player" ? "player" : "enemy";
      if (u.team === "enemy") this.computeIntent(u);
      else this.refreshEnemyIntents();
      this.emit();
      return;
    }
  }

  endTurn(): void {
    const u = this.active;
    if (!u) return;
    if (u.team === "player") this.say(`${u.name} ends turn.`);
    // decay this unit's blessed/dodging that last "until next turn"
    this.beginNextTurn();
  }

  private endRound(): void {
    // hazard ttl decay + fire spread + gas dissipate
    for (const t of this.grid.all()) {
      if (!t.hazard) continue;
      if (t.hazard.ttl > 0) {
        t.hazard.ttl--;
        if (t.hazard.ttl === 0) t.hazard = null;
      }
    }
    this.round++;
    this.say(`— Round ${this.round} —`);
    this.refreshEnemyIntents();
  }

  private startOfTurnEffects(u: Unit): void {
    const t = this.grid.get(u.pos);
    if (t?.hazard) {
      if (t.hazard.kind === "acid") this.applyDamage(u, this.rng.roll("1d6"), "stood in acid", null);
      if (t.hazard.kind === "fire") {
        this.applyDamage(u, this.rng.roll("1d6"), "stood in fire", null);
        this.addCondition(u, { kind: "burning", duration: 2 });
      }
      if (t.hazard.kind === "gas") {
        this.applyDamage(u, this.rng.roll("1d4"), "choked on gas", null);
        this.addCondition(u, { kind: "poisoned", duration: 1 });
      }
    }
    for (const c of [...u.conditions]) {
      if (c.kind === "burning") this.applyDamage(u, this.rng.roll("1d6"), "burning", null);
      if (c.kind === "bleeding") this.applyDamage(u, c.amount ?? 2, "bleeding", null);
      if (c.duration > 0) {
        c.duration--;
        if (c.duration === 0) this.removeCondition(u, c.kind);
      }
    }
  }

  // ---------------------------------------------------------------- movement

  moveOptions(u: Unit): Map<string, number> {
    return this.grid.reachable(u.pos, this.moveBudget(u), this.occupied(u));
  }

  pathTo(u: Unit, h: Hex): Hex[] | null {
    return this.grid.findPath(u.pos, h, this.occupied(u));
  }

  /** move active player unit to hex if reachable; resolves OAs + hazards */
  moveTo(h: Hex): boolean {
    const u = this.active;
    if (!u || this.phase !== "player") return false;
    const reach = this.moveOptions(u);
    if (!reach.has(key(h))) return false;
    const path = this.pathTo(u, h);
    if (!path) return false;
    const cost = reach.get(key(h))!;
    this.moveAlongPath(u, path, cost);
    this.afterPlayerAction(u);
    return true;
  }

  private moveAlongPath(u: Unit, path: Hex[], cost: number): void {
    // provoke OAs from adjacent enemies at the start hex (unless disengaged)
    const startAdjEnemies = this.enemiesOf(u).filter(
      (e) => distance(e.pos, path[0]) === 1 && !e.reactionUsed && !this.hasCondition(u, "disengaged"),
    );
    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      u.pos = { ...step };
      const t = this.grid.get(step);
      if (t?.hazard && (t.hazard.kind === "spikes" || t.hazard.kind === "acid" || t.hazard.kind === "fire")) {
        const h = HAZARD_ENTER[t.hazard.kind];
        this.applyDamage(u, this.rng.roll(h.dice), `walked into ${h.note}`, null);
        if (t.hazard.kind === "fire") this.addCondition(u, { kind: "burning", duration: 2 });
        if (!u.alive) break;
      }
    }
    u.movedThisTurn += cost;
    // OAs now that the unit has left
    for (const e of startAdjEnemies) {
      if (!u.alive) break;
      if (distance(e.pos, u.pos) > 1 && e.alive && !e.reactionUsed) {
        this.say(`${e.name} takes a swing at ${u.name} (opportunity).`);
        e.reactionUsed = true;
        this.resolveAttack(e, u, { note: "opportunity" });
      }
    }
    this.emit();
  }

  // ---------------------------------------------------------------- attacks

  attackPreview(attacker: Unit, target: Unit): AttackPreview {
    const w = attacker.weapon;
    const range = w.range;
    const dist = distance(attacker.pos, target.pos);
    const inRange = dist <= range && (range === 1 ? dist === 1 : true);
    const hasLos = range === 1 ? dist === 1 : this.grid.hasLineOfSight(attacker.pos, target.pos);
    const { mode, bonus, targetAc } = this.attackParams(attacker, target);
    const need = targetAc - (attacker.toHit + bonus);
    let chance = clamp01((21 - need) / 20);
    if (mode === "adv") chance = 1 - (1 - chance) ** 2;
    if (mode === "dis") chance = chance ** 2;
    const [dc, ds] = parseDice(w.dice);
    const sit = this.situationalDamage(attacker, target);
    const flat = attacker.damageBonus + sit.flat;
    let minExtra = 0;
    let maxExtra = 0;
    for (const spec of sit.dice) {
      const [ec, es] = parseDice(spec);
      minExtra += ec;
      maxExtra += ec * es;
    }
    return {
      target,
      chance,
      mode,
      minDmg: Math.max(1, dc + flat + minExtra),
      maxDmg: dc * ds + flat + maxExtra,
      inRange,
      hasLos,
    };
  }

  private attackParams(attacker: Unit, target: Unit): { mode: "flat" | "adv" | "dis"; bonus: number; targetAc: number } {
    let adv = 0;
    let dis = 0;
    const ranged = attacker.weapon.range > 1;
    const ta = this.grid.get(attacker.pos);
    const tt = this.grid.get(target.pos);
    if (ranged && ta && tt) {
      if (ta.elevation > tt.elevation) adv++;
      if (tt.elevation > ta.elevation + 1) dis++;
    }
    if (this.hasCondition(target, "prone")) {
      if (ranged) dis++;
      else adv++;
    }
    if (this.hasCondition(target, "dodging")) dis++;
    if (this.hasCondition(attacker, "prone")) dis++;

    let bonus = 0;
    if (this.hasCondition(attacker, "blessed")) bonus += 2; // avg of 1d4, previewed as +2
    if (attacker.featureIds.includes("keen_eyed") && ranged && distance(attacker.pos, target.pos) >= 3) bonus += 1;
    if (attacker.featureIds.includes("bloodscent") && target.hp <= target.maxHp / 2) bonus += 2;

    let targetAc = target.ac;
    if (ranged) targetAc += this.grid.coverBonus(attacker.pos, target.pos);

    const mode = adv > dis ? "adv" : dis > adv ? "dis" : "flat";
    return { mode, bonus, targetAc };
  }

  private situationalDamage(attacker: Unit, target: Unit): { flat: number; dice: string[] } {
    let flat = 0;
    const dice: string[] = [];
    if (attacker.featureIds.includes("bloodscent") && target.hp <= target.maxHp / 2) flat += 2;
    if (attacker.featureIds.includes("zealot")) flat += 2; // "while healthy" — simplified: always on
    if (attacker.markTargetId === target.id) dice.push("1d6");
    if (
      (attacker.featureIds.includes("sneak_attack") || attacker.featureIds.includes("sneak_attack_2")) &&
      !attacker.sneakUsedThisTurn &&
      this.allies(attacker).some((a) => distance(a.pos, target.pos) === 1)
    ) {
      dice.push(attacker.featureIds.includes("sneak_attack_2") ? "2d6" : "1d6");
    }
    if (
      attacker.featureIds.includes("colossus_slayer") &&
      !attacker.colossusUsedThisTurn &&
      target.hp < target.maxHp
    ) {
      dice.push("1d8");
    }
    return { flat, dice };
  }

  attackTargets(u: Unit): Unit[] {
    const w = u.weapon;
    return this.enemiesOf(u).filter((e) => {
      const d = distance(u.pos, e.pos);
      if (w.range === 1) return d === 1;
      return d <= w.range && this.grid.hasLineOfSight(u.pos, e.pos);
    });
  }

  /** player: perform the Attack action against target (handles Extra Attack) */
  doAttack(targetId: string, opts?: { powerAttack?: boolean }): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    const target = this.units.find((x) => x.id === targetId && x.alive);
    if (!target || !this.attackTargets(u).includes(target)) return false;
    u.actionUsed = true;
    const swings = u.featureIds.includes("extra_attack") ? 2 : 1;
    for (let i = 0; i < swings; i++) {
      let cur = this.units.find((x) => x.id === targetId && x.alive);
      if (!cur) {
        // target dead: redirect a leftover swing to another in-range enemy
        cur = this.attackTargets(u)[0];
        if (!cur) break;
      }
      this.resolveAttack(u, cur, {
        toHitMod: opts?.powerAttack ? -2 : 0,
        dmgMod: opts?.powerAttack ? 4 : 0,
        note: opts?.powerAttack ? "power attack" : undefined,
      });
      u.sneakUsedThisTurn = true;
      u.colossusUsedThisTurn = true;
    }
    this.afterPlayerAction(u);
    return true;
  }

  private resolveAttack(
    attacker: Unit,
    target: Unit,
    opts: { toHitMod?: number; dmgMod?: number; note?: string; noCrit?: boolean } = {},
  ): void {
    const { mode, bonus, targetAc } = this.attackParams(attacker, target);
    let face = this.rng.d20(mode);
    // Lucky trait: reroll a natural 1 once per floor
    if (face === 1 && attacker.featureIds.includes("lucky") && !attacker.luckUsedThisFloor) {
      attacker.luckUsedThisFloor = true;
      const nf = this.rng.d20("flat");
      this.say(`${attacker.name} spends their luck: rerolls a 1 → ${nf}.`);
      face = nf;
    }
    const keen = attacker.weapon.name.startsWith("Keen ");
    const blessBonus = this.hasCondition(attacker, "blessed") ? this.rng.roll("1d4") : 0;
    const total = face + attacker.toHit + bonus - (this.hasCondition(attacker, "blessed") ? 2 : 0) + blessBonus + (opts.toHitMod ?? 0);
    const isCrit = !opts.noCrit && (face === 20 || (keen && face === 19));
    const isMiss = face === 1;
    const noteStr = opts.note ? ` (${opts.note})` : "";

    if (isMiss || (!isCrit && total < targetAc)) {
      this.say(`${attacker.name} misses ${target.name}${noteStr}. [${face}+${attacker.toHit + bonus + (opts.toHitMod ?? 0)} vs AC ${targetAc}]`);
      this.emit();
      return;
    }

    const [dc, ds] = parseDice(attacker.weapon.dice);
    let dmg = 0;
    const critDice = isCrit ? dc * 2 : dc;
    for (let i = 0; i < critDice; i++) dmg += this.rng.int(1, ds);
    dmg += attacker.damageBonus + (opts.dmgMod ?? 0);

    const sit = this.situationalDamage(attacker, target);
    dmg += sit.flat;
    for (const spec of sit.dice) {
      const [ec, es] = parseDice(spec);
      const rolls = isCrit ? ec * 2 : ec;
      for (let i = 0; i < rolls; i++) dmg += this.rng.int(1, es);
    }
    if (target.featureIds.includes("brittle")) dmg += 1;
    dmg = Math.max(1, dmg);

    this.say(
      `${attacker.name} ${isCrit ? "CRITS" : "hits"} ${target.name} for ${dmg}${noteStr}.` +
        (mode !== "flat" ? ` [${mode}]` : ""),
    );
    this.applyDamage(target, dmg, `slain by ${attacker.name}`, attacker);
    this.emit();
  }

  private applyDamage(target: Unit, amount: number, cause: string, source: Unit | null): void {
    if (!target.alive || amount <= 0) return;
    if (target.featureIds.includes("stoneblood") && cause.includes("acid")) amount = Math.max(1, amount - 1);
    target.hp -= amount;

    // half-orc Relentless
    if (target.hp <= 0 && target.featureIds.includes("relentless") && !target.relentlessUsed) {
      target.relentlessUsed = true;
      target.hp = 1;
      this.say(`${target.name} refuses to fall — Relentless leaves them at 1 HP.`);
    }

    if (target.hp <= 0) {
      const overkill = -target.hp >= target.maxHp;
      target.hp = 0;
      target.causeOfDeath = cause;
      if (target.team === "enemy" || overkill || this.objectiveNoDowned()) {
        target.alive = false;
        target.downed = false;
        this.say(`${target.name} is ${target.team === "enemy" ? "destroyed" : "killed"}.`);
        if (source && source.team === "player") source.kills += 1;
        this.onUnitDeath(target);
      } else {
        target.downed = true;
        this.say(`${target.name} goes down!`);
      }
    } else {
      // Coward's Instinct
      if (
        target.team === "player" &&
        target.featureIds.includes("coward") &&
        !target.cowardTriggered &&
        target.hp <= target.maxHp * 0.25
      ) {
        target.cowardTriggered = true;
        this.cowardScramble(target);
      }
    }
    this.checkEnd();
  }

  private objectiveNoDowned(): boolean {
    return false; // hook for Abyssal covenant
  }

  private onUnitDeath(u: Unit): void {
    const defTag = u.tags.find((t) => t.startsWith("def:"));
    if (defTag === "def:thrall") {
      for (const h of [u.pos, ...neighbors(u.pos)]) {
        const t = this.grid.get(h);
        if (t && t.terrain !== "wall" && t.terrain !== "chasm") t.hazard = { kind: "gas", ttl: 3 };
      }
      this.say(`The ${u.name} bursts — spores fill the air.`);
    }
    // turnOrder is left intact; beginNextTurn() skips !alive units.
  }

  private cowardScramble(u: Unit): void {
    const foes = this.enemiesOf(u);
    let best: Hex | null = null;
    let bestScore = minDist(u.pos, foes);
    for (const n of neighbors(u.pos)) {
      const t = this.grid.get(n);
      if (!t || t.terrain === "wall" || t.terrain === "chasm" || this.unitAt(n) || t.hazard) continue;
      const s = minDist(n, foes);
      if (s > bestScore) {
        bestScore = s;
        best = n;
      }
    }
    if (best) {
      u.pos = { ...best };
      this.addCondition(u, { kind: "disengaged", duration: 1 });
      this.say(`${u.name}'s nerve breaks — they scramble back a step.`);
    }
  }

  private rollDeathSave(u: Unit): void {
    const roll = this.rng.int(1, 20);
    if (roll === 20) {
      u.downed = false;
      u.hp = Math.max(1, Math.floor(u.maxHp * 0.1));
      u.deathSuccess = 0;
      u.deathFail = 0;
      this.say(`${u.name} claws back to consciousness (nat 20)!`);
    } else if (roll >= 10) {
      u.deathSuccess++;
      this.say(`${u.name} steadies (death save ${u.deathSuccess}/3).`);
      if (u.deathSuccess >= 3) {
        this.say(`${u.name} stabilizes — out of the fight but breathing.`);
        u.deathSuccess = 0;
      }
    } else {
      u.deathFail++;
      this.say(`${u.name} fades (death fail ${u.deathFail}/3).`);
      if (u.deathFail >= 3) {
        u.alive = false;
        u.downed = false;
        this.say(`${u.name} is dead.`);
        this.onUnitDeath(u);
      }
    }
  }

  // ---------------------------------------------------------------- features

  featureButtons(u: Unit): FeatureButton[] {
    const out: FeatureButton[] = [];
    const f = u.featureIds;
    if (f.includes("second_wind"))
      out.push({
        id: "second_wind",
        name: "Second Wind",
        text: "Heal 1d10 + level.",
        enabled: !u.bonusUsed && !u.secondWindUsed && u.hp < u.maxHp,
        needsTarget: "none",
        kind: "bonus",
      });
    if (f.includes("power_attack"))
      out.push({
        id: "power_attack",
        name: "Power Attack",
        text: "Attack: -2 hit, +4 damage.",
        enabled: !u.actionUsed && this.attackTargets(u).length > 0,
        needsTarget: "enemy",
        kind: "action",
      });
    if (f.includes("action_surge"))
      out.push({
        id: "action_surge",
        name: "Action Surge",
        text: "Refresh your Action.",
        enabled: !u.surgeUsed && u.actionUsed,
        needsTarget: "none",
        kind: "bonus",
      });
    if (f.includes("cunning_action"))
      out.push({
        id: "cunning_dash",
        name: "Cunning: Dash",
        text: "Bonus action Dash.",
        enabled: !u.bonusUsed && !u.dashed,
        needsTarget: "none",
        kind: "bonus",
      });
    if (f.includes("cunning_action"))
      out.push({
        id: "cunning_disengage",
        name: "Cunning: Disengage",
        text: "Bonus action Disengage.",
        enabled: !u.bonusUsed,
        needsTarget: "none",
        kind: "bonus",
      });
    if (f.includes("hunters_mark"))
      out.push({
        id: "hunters_mark",
        name: u.markTargetId ? "Move Mark" : "Hunter's Mark",
        text: "+1d6 damage vs. marked target.",
        enabled: !u.bonusUsed && this.enemiesOf(u).length > 0,
        needsTarget: "enemy",
        kind: "bonus",
      });
    if (f.includes("cure_wounds"))
      out.push({
        id: "cure_wounds",
        name: `Cure Wounds (${u.cureUses})`,
        text: "Heal an adjacent ally 1d8 + WIS.",
        enabled: !u.actionUsed && u.cureUses > 0 && this.allies(u).some((a) => distance(a.pos, u.pos) === 1 && a.hp < a.maxHp),
        needsTarget: "ally",
        kind: "action",
      });
    if (f.includes("bless"))
      out.push({
        id: "bless",
        name: "Bless",
        text: "+1d4 to hit for you & adjacent allies (3 rds).",
        enabled: !u.bonusUsed,
        needsTarget: "none",
        kind: "bonus",
      });
    return out;
  }

  useFeature(id: string, targetId?: string): boolean {
    const u = this.active;
    if (!u || this.phase !== "player") return false;
    const target = targetId ? this.units.find((x) => x.id === targetId && x.alive) : null;
    switch (id) {
      case "second_wind": {
        if (u.bonusUsed || u.secondWindUsed) return false;
        const lvl = 1 + Math.floor((u.maxHp - 10) / 6);
        const heal = this.rng.roll("1d10") + Math.max(1, lvl);
        u.hp = Math.min(u.maxHp, u.hp + heal);
        u.bonusUsed = true;
        u.secondWindUsed = true;
        this.say(`${u.name} catches their breath: +${heal} HP.`);
        break;
      }
      case "power_attack": {
        if (!target) return false;
        return this.doAttack(target.id, { powerAttack: true });
      }
      case "action_surge": {
        if (u.surgeUsed || !u.actionUsed) return false;
        u.surgeUsed = true;
        u.bonusUsed = true;
        u.actionUsed = false;
        this.say(`${u.name} surges — another Action!`);
        break;
      }
      case "cunning_dash": {
        if (u.bonusUsed) return false;
        u.dashed = true;
        u.bonusUsed = true;
        this.say(`${u.name} darts ahead (Dash).`);
        break;
      }
      case "cunning_disengage": {
        if (u.bonusUsed) return false;
        this.addCondition(u, { kind: "disengaged", duration: 1 });
        u.bonusUsed = true;
        this.say(`${u.name} disengages.`);
        break;
      }
      case "hunters_mark": {
        if (!target || u.bonusUsed) return false;
        u.markTargetId = target.id;
        u.bonusUsed = true;
        this.say(`${u.name} marks ${target.name}.`);
        break;
      }
      case "cure_wounds": {
        if (!target || u.actionUsed || u.cureUses <= 0) return false;
        if (distance(target.pos, u.pos) !== 1) return false;
        const heal = this.rng.roll("1d8") + 2;
        target.hp = Math.min(target.maxHp, target.hp + heal);
        if (target.downed) {
          target.downed = false;
          target.hp = heal;
          target.deathFail = 0;
          target.deathSuccess = 0;
        }
        u.cureUses--;
        u.actionUsed = true;
        this.say(`${u.name} heals ${target.name} for ${heal}.`);
        break;
      }
      case "bless": {
        if (u.bonusUsed) return false;
        u.bonusUsed = true;
        for (const a of [u, ...this.allies(u).filter((x) => distance(x.pos, u.pos) <= 1)]) {
          this.addCondition(a, { kind: "blessed", duration: 3 });
        }
        this.say(`${u.name} calls a blessing on the line.`);
        break;
      }
      default:
        return false;
    }
    this.afterPlayerAction(u);
    return true;
  }

  // basic actions
  dash(): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    u.actionUsed = true;
    u.dashed = true;
    this.say(`${u.name} dashes.`);
    this.afterPlayerAction(u);
    return true;
  }

  dodge(): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    u.actionUsed = true;
    this.addCondition(u, { kind: "dodging", duration: 1 });
    this.say(`${u.name} takes the Dodge action.`);
    this.afterPlayerAction(u);
    return true;
  }

  disengage(): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    u.actionUsed = true;
    this.addCondition(u, { kind: "disengaged", duration: 1 });
    this.say(`${u.name} disengages.`);
    this.afterPlayerAction(u);
    return true;
  }

  shoveTargets(u: Unit): Unit[] {
    return this.enemiesOf(u).filter((e) => distance(u.pos, e.pos) === 1);
  }

  shove(targetId: string): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    const target = this.units.find((x) => x.id === targetId && x.alive);
    if (!target || distance(u.pos, target.pos) !== 1) return false;
    u.actionUsed = true;
    const atk = this.rng.int(1, 20) + Math.floor(u.damageBonus) + (u.featureIds.includes("giantblood") ? 2 : 0);
    const def = this.rng.int(1, 20) + Math.floor(target.damageBonus);
    if (atk >= def) {
      const dir = { q: target.pos.q - u.pos.q, r: target.pos.r - u.pos.r };
      const dest = { q: target.pos.q + dir.q, r: target.pos.r + dir.r };
      const t = this.grid.get(dest);
      if (t && !this.unitAt(dest) && t.terrain !== "wall") {
        if (t.terrain === "chasm") {
          this.say(`${u.name} shoves ${target.name} into the chasm!`);
          this.applyDamage(target, target.maxHp * 2, "fell into a chasm", u);
        } else {
          target.pos = { ...dest };
          this.say(`${u.name} shoves ${target.name} back a hex.`);
          if (t.hazard) this.startOfTurnEffects(target);
        }
      } else {
        this.addCondition(target, { kind: "prone", duration: 1 });
        this.say(`${u.name} knocks ${target.name} prone.`);
      }
    } else {
      this.say(`${u.name} fails to shove ${target.name}.`);
    }
    this.afterPlayerAction(u);
    return true;
  }

  private afterPlayerAction(_u: Unit): void {
    if (this.checkEnd()) return;
    this.emit();
  }

  // ---------------------------------------------------------------- enemy AI

  refreshEnemyIntents(): void {
    for (const e of this.units.filter((u) => u.team === "enemy" && u.alive && !u.downed)) {
      this.computeIntent(e);
    }
    this.emit();
  }

  private computeIntent(e: Unit): void {
    const targets = this.pickTargetsFor(e);
    if (!targets.length) {
      e.intent = { kind: "wait", note: "waiting" };
      return;
    }
    const target = targets[0];
    const w = e.weapon;
    const dist = distance(e.pos, target.pos);
    if ((w.range === 1 && dist === 1) || (w.range > 1 && dist <= w.range && this.grid.hasLineOfSight(e.pos, target.pos))) {
      e.intent = { kind: "attack", targetId: target.id, note: `attacks ${target.name}` };
    } else {
      const spot = this.bestApproach(e, target);
      e.intent = { kind: "move", targetId: target.id, toHex: spot ?? target.pos, note: `moves on ${target.name}` };
    }
  }

  private pickTargetsFor(e: Unit): Unit[] {
    let pool = this.units.filter((u) => u.team === "player" && u.alive && !u.downed);
    if (!pool.length) pool = this.units.filter((u) => u.team === "player" && u.alive);
    return pool
      .map((u) => {
        let score = 100 - (u.hp / u.maxHp) * 60;
        score -= distance(e.pos, u.pos) * 3;
        const reach = e.dashed ? e.speed * 2 : e.speed;
        const canEngage =
          e.weapon.range === 1
            ? distance(e.pos, u.pos) <= reach + 1
            : distance(e.pos, u.pos) <= e.weapon.range + reach && this.grid.hasLineOfSight(e.pos, u.pos);
        if (canEngage) score += 25;
        if (u.hp <= 6) score += 20;
        return { u, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((x) => x.u);
  }

  private bestApproach(e: Unit, target: Unit): Hex | null {
    const budget = e.speed;
    const reach = this.grid.reachable(e.pos, budget, this.occupied(e));
    reach.set(key(e.pos), 0);
    let best: Hex | null = null;
    let bestScore = -Infinity;
    for (const k of reach.keys()) {
      const h = { q: parseInt(k.split(",")[0], 10), r: parseInt(k.split(",")[1], 10) };
      const t = this.grid.get(h);
      if (!t) continue;
      const d = distance(h, target.pos);
      let score = -d * 10;
      if (e.weapon.range > 1) {
        // archers: want to be in range + LOS, prefer elevation, avoid adjacency
        const inRange = d <= e.weapon.range && this.grid.hasLineOfSight(h, target.pos);
        score = (inRange ? 100 : -d * 10) + t.elevation * 8 - (d === 1 ? 30 : 0);
      } else {
        if (d === 1) score += 50;
      }
      if (t.hazard) score -= 40;
      if (score > bestScore) {
        bestScore = score;
        best = h;
      }
    }
    return best;
  }

  /** run the whole active enemy's turn; returns true if still enemy phase after */
  runEnemyTurn(): void {
    const e = this.active;
    if (!e || this.phase !== "enemy") return;

    const targets = this.pickTargetsFor(e);
    if (!targets.length) {
      this.say(`${e.name} finds no one to fight.`);
      this.endTurn();
      return;
    }
    const target = targets[0];
    const w = e.weapon;

    const canHitNow = () => {
      const d = distance(e.pos, target.pos);
      if (w.range === 1) return d === 1;
      return d <= w.range && this.grid.hasLineOfSight(e.pos, target.pos);
    };

    // reposition if needed
    if (!canHitNow()) {
      const spot = this.bestApproach(e, target);
      if (spot && !eq(spot, e.pos)) {
        const reach = this.grid.reachable(e.pos, e.speed, this.occupied(e));
        const cost = reach.get(key(spot)) ?? 0;
        const path = this.grid.findPath(e.pos, spot, this.occupied(e));
        if (path) this.moveAlongPath(e, path, cost);
      }
      if (this.checkEnd()) return;
      if (!e.alive) {
        this.endTurn();
        return;
      }
      // still can't reach? dash
      if (!canHitNow() && !e.dashed) {
        e.dashed = true;
        e.actionUsed = true;
        const spot2 = this.bestApproach(e, target);
        if (spot2 && !eq(spot2, e.pos)) {
          const reach2 = this.grid.reachable(e.pos, e.speed, this.occupied(e));
          const cost2 = reach2.get(key(spot2)) ?? 0;
          const path2 = this.grid.findPath(e.pos, spot2, this.occupied(e));
          if (path2) this.moveAlongPath(e, path2, cost2);
        }
        this.say(`${e.name} closes the distance.`);
      }
    }

    if (this.checkEnd()) return;

    // shove-to-hazard opportunity for melee
    if (canHitNow() && w.range === 1 && !e.actionUsed) {
      const dir = { q: target.pos.q - e.pos.q, r: target.pos.r - e.pos.r };
      const behind = this.grid.get({ q: target.pos.q + dir.q, r: target.pos.r + dir.r });
      if (behind && (behind.terrain === "chasm" || behind.hazard) && this.rng.chance(0.6)) {
        e.actionUsed = true;
        const atk = this.rng.int(1, 20) + e.damageBonus;
        const def = this.rng.int(1, 20) + target.damageBonus;
        if (atk >= def) {
          if (behind.terrain === "chasm") {
            this.say(`${e.name} shoves ${target.name} into the chasm!`);
            this.applyDamage(target, target.maxHp * 2, "shoved into a chasm", e);
          } else {
            target.pos = { q: target.pos.q + dir.q, r: target.pos.r + dir.r };
            this.say(`${e.name} shoves ${target.name} into the ${behind.hazard!.kind}!`);
            this.startOfTurnEffects(target);
          }
        } else {
          this.say(`${e.name} tries to shove ${target.name} and fails.`);
        }
        if (this.checkEnd()) return;
        this.endTurn();
        return;
      }
    }

    if (canHitNow() && !e.actionUsed) {
      e.actionUsed = true;
      const swings = e.archetype === "elite" ? 2 : 1;
      for (let i = 0; i < swings; i++) {
        const cur = this.units.find((x) => x.id === target.id && x.alive && !x.downed) ?? target;
        if (!cur.alive) break;
        this.resolveAttack(e, cur, {});
        if (this.checkEnd()) return;
      }
    } else if (!canHitNow()) {
      this.say(`${e.name} advances.`);
    }

    if (this.checkEnd()) return;
    this.endTurn();
  }

  // ---------------------------------------------------------------- end states

  checkEnd(): boolean {
    if (this.phase === "won" || this.phase === "lost") return true;
    const playersStanding = this.units.filter((u) => u.team === "player" && u.alive && !u.downed);
    const playersAlive = this.units.filter((u) => u.team === "player" && u.alive);
    const enemiesAlive = this.units.filter((u) => u.team === "enemy" && u.alive);

    if (playersAlive.length === 0) {
      this.phase = "lost";
      this.say("The party is wiped.");
      this.emit();
      return true;
    }

    if (this.objective.kind === "slay") {
      if (enemiesAlive.length === 0) {
        this.phase = "won";
        this.say("Floor cleared.");
        this.emit();
        return true;
      }
    } else if (this.objective.kind === "extract") {
      const zone = this.objective.extractHexes ?? [];
      if (
        playersStanding.length > 0 &&
        playersStanding.every((u) => zone.some((h) => eq(h, u.pos)))
      ) {
        // stabilize & extract any downed
        for (const d of this.units.filter((u) => u.team === "player" && u.downed)) {
          d.downed = false;
          d.hp = 1;
        }
        this.phase = "won";
        this.say("Extraction reached — everyone who can run, runs.");
        this.emit();
        return true;
      }
    }
    if (playersStanding.length === 0) {
      // all remaining players are downed with no one to help
      this.phase = "lost";
      this.say("No one left standing. The Deep keeps them.");
      this.emit();
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------- pure helpers

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function parseDice(spec: string): [number, number] {
  const m = /^(\d*)d(\d+)/.exec(spec);
  if (!m) return [0, 0];
  return [m[1] ? parseInt(m[1], 10) : 1, parseInt(m[2], 10)];
}

function minDist(h: Hex, foes: Unit[]): number {
  return foes.length ? Math.min(...foes.map((f) => distance(h, f.pos))) : 99;
}

function objectiveText(o: Objective, depth: number): string {
  return `Deep ${depth}. Objective: ${o.description}`;
}
