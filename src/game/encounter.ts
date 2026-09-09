import { RNG } from "../core/rng";
import { Hex, distance, eq, key, neighbors } from "../core/hex";
import { HexGrid, HazardKind } from "../core/grid";
import { Condition, ConditionKind, Objective, Unit } from "./types";
import { FEATURES } from "./data";

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
  needsTarget: "ally" | "enemy" | "none" | "hex";
  kind: "action" | "bonus";
}

export type EncPhase = "deploy" | "player" | "enemy" | "won" | "lost";

interface AttackOpts {
  toHitMod?: number;
  dmgMod?: number;
  note?: string;
  noCrit?: boolean;
  extraDice?: string;
}

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

  usesLeft(u: Unit, id: string, max: number): number {
    return max - (u.featUses[id] ?? 0);
  }
  private spend(u: Unit, id: string): void {
    u.featUses[id] = (u.featUses[id] ?? 0) + 1;
  }

  private levelOf(u: Unit): number {
    return Math.max(1, 1 + Math.floor((u.maxHp - 10) / 6));
  }

  private healUnit(healer: Unit, target: Unit, amount: number): void {
    amount = Math.max(1, Math.round(amount));
    if (target.downed) {
      target.downed = false;
      target.hp = amount;
      target.deathFail = 0;
      target.deathSuccess = 0;
      this.say(`${healer.name} drags ${target.name} back up (+${amount}).`);
    } else {
      target.hp = Math.min(target.maxHp, target.hp + amount);
      this.say(`${healer.name} heals ${target.name} for ${amount}.`);
    }
    this.emit();
  }

  private attackSequence(u: Unit, targetId: string, count: number, opts: AttackOpts): void {
    for (let i = 0; i < count; i++) {
      let cur = this.units.find((x) => x.id === targetId && x.alive);
      if (!cur) {
        cur = this.attackTargets(u)[0];
        if (!cur) break;
      }
      this.resolveAttack(u, cur, opts);
      u.sneakUsedThisTurn = true;
      u.colossusUsedThisTurn = true;
      if (this.checkEnd()) return;
    }
  }

  teleport(h: Hex): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.bonusUsed) return false;
    if (!u.featureIds.includes("misty_step") || this.usesLeft(u, "misty_step", 1) <= 0) return false;
    const t = this.grid.get(h);
    if (!t || t.terrain === "wall" || t.terrain === "chasm" || this.unitAt(h)) return false;
    if (distance(u.pos, h) > 6) return false;
    u.bonusUsed = true;
    this.spend(u, "misty_step");
    u.pos = { ...h };
    this.say(`${u.name} blinks across the floor.`);
    this.afterPlayerAction(u);
    return true;
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

  /**
   * UI helper (no state change): every hex a living enemy could reach and
   * then attack into next turn — the board's "don't stand here" wash.
   */
  threatenedHexes(): Set<string> {
    const out = new Set<string>();
    const tiles = this.grid.all();
    for (const e of this.units.filter((u) => u.team === "enemy" && u.alive && !u.downed)) {
      const reach = this.grid.reachable(e.pos, e.speed, this.occupied(e));
      const from = [key(e.pos), ...reach.keys()].map((k) => {
        const [q, r] = k.split(",").map(Number);
        return { q, r };
      });
      const rng = e.weapon.range;
      for (const f of from) {
        if (rng === 1) {
          for (const n of neighbors(f)) out.add(key(n));
        } else {
          for (const t of tiles) {
            if (distance(f, { q: t.q, r: t.r }) <= rng) out.add(key({ q: t.q, r: t.r }));
          }
        }
      }
    }
    return out;
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
    if (this.hasCondition(attacker, "mocked")) dis++;
    if (!ranged && this.hasCondition(attacker, "reckless")) adv++;
    if (this.hasCondition(target, "reckless")) adv++;

    let bonus = 0;
    if (this.hasCondition(attacker, "blessed")) bonus += 2; // avg of 1d4, previewed as +2
    if (this.hasCondition(attacker, "inspired")) bonus += 3; // avg of 1d6
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
    const ranged = attacker.weapon.range > 1;
    if (attacker.featureIds.includes("bloodscent") && target.hp <= target.maxHp / 2) flat += 2;
    if (attacker.featureIds.includes("zealot")) flat += 2; // "while healthy" — simplified: always on
    if (this.hasCondition(attacker, "raging") && !ranged) flat += 2;
    if (attacker.featureIds.includes("font_of_magic") && ranged) flat += 1;
    if (attacker.featureIds.includes("agonizing_blast")) flat += 2;
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
  doAttack(targetId: string, opts?: { powerAttack?: boolean; extraDice?: string; note?: string }): boolean {
    const u = this.active;
    if (!u || this.phase !== "player" || u.actionUsed) return false;
    const target = this.units.find((x) => x.id === targetId && x.alive);
    if (!target || !this.attackTargets(u).includes(target)) return false;
    u.actionUsed = true;
    const swings = u.featureIds.includes("extra_attack") ? 2 : 1;
    for (let i = 0; i < swings; i++) {
      let cur = this.units.find((x) => x.id === targetId && x.alive);
      if (!cur) {
        cur = this.attackTargets(u)[0];
        if (!cur) break;
      }
      this.resolveAttack(u, cur, {
        toHitMod: opts?.powerAttack ? -2 : 0,
        dmgMod: opts?.powerAttack ? 4 : 0,
        // smite / big riders land on the first swing only
        extraDice: i === 0 ? opts?.extraDice : undefined,
        note: opts?.note ?? (opts?.powerAttack ? "power attack" : undefined),
      });
      u.sneakUsedThisTurn = true;
      u.colossusUsedThisTurn = true;
      if (this.checkEnd()) return true;
    }
    this.afterPlayerAction(u);
    return true;
  }

  private resolveAttack(attacker: Unit, target: Unit, opts: AttackOpts = {}): void {
    const { mode, bonus, targetAc } = this.attackParams(attacker, target);
    let face = this.rng.d20(mode);
    if (face === 1 && attacker.featureIds.includes("lucky") && !attacker.luckUsedThisFloor) {
      attacker.luckUsedThisFloor = true;
      const nf = this.rng.d20("flat");
      this.say(`${attacker.name} spends their luck: rerolls a 1 → ${nf}.`);
      face = nf;
    }
    const keen = attacker.weapon.name.startsWith("Keen ");
    const blessBonus = this.hasCondition(attacker, "blessed") ? this.rng.roll("1d4") : 0;
    const inspBonus = this.hasCondition(attacker, "inspired") ? this.rng.roll("1d6") : 0;
    if (inspBonus) this.removeCondition(attacker, "inspired");
    const previewBonus = (this.hasCondition(attacker, "blessed") ? 2 : 0) + (inspBonus ? 3 : 0);
    const total =
      face + attacker.toHit + bonus - previewBonus + blessBonus + inspBonus + (opts.toHitMod ?? 0);
    const isCrit = !opts.noCrit && (face === 20 || (keen && face === 19));
    const isMiss = face === 1;
    const noteStr = opts.note ? ` (${opts.note})` : "";

    if (isMiss || (!isCrit && total < targetAc)) {
      this.say(`${attacker.name} misses ${target.name}${noteStr}.`);
      this.emit();
      return;
    }

    // base weapon dice, upgraded by passive "scaling" features
    let baseDice = attacker.weapon.dice;
    if (attacker.featureIds.includes("radiant_scaling") && attacker.weapon.name === "Sacred Flame") baseDice = "2d8";
    if (attacker.featureIds.includes("sorc_scaling")) baseDice = "2d8";
    if (attacker.featureIds.includes("fire_scaling")) baseDice = "2d10";

    const [dc, ds] = parseDice(baseDice);
    let dmg = 0;
    const critDice = isCrit ? dc * 2 : dc;
    for (let i = 0; i < critDice; i++) dmg += this.rng.int(1, ds);
    dmg += attacker.damageBonus + (opts.dmgMod ?? 0);

    if (opts.extraDice) {
      const [xc, xs] = parseDice(opts.extraDice);
      for (let i = 0; i < (isCrit ? xc * 2 : xc); i++) dmg += this.rng.int(1, xs);
    }

    const sit = this.situationalDamage(attacker, target);
    dmg += sit.flat;
    for (const spec of sit.dice) {
      const [ec, es] = parseDice(spec);
      for (let i = 0; i < (isCrit ? ec * 2 : ec); i++) dmg += this.rng.int(1, es);
    }
    if (target.featureIds.includes("brittle")) dmg += 1;
    dmg = Math.max(1, dmg);

    this.say(
      `${attacker.name} ${isCrit ? "CRITS" : "hits"} ${target.name} for ${dmg}${noteStr}.` +
        (mode !== "flat" ? ` [${mode}]` : ""),
    );
    this.applyDamage(target, dmg, `slain by ${attacker.name}`, attacker);
    if (target.alive && attacker.weapon.name === "Vicious Mockery") {
      this.addCondition(target, { kind: "mocked", duration: 1 });
    }
    this.emit();
  }

  private applyDamage(target: Unit, amount: number, cause: string, source: Unit | null): void {
    if (!target.alive || amount <= 0) return;
    if (target.featureIds.includes("stoneblood") && cause.includes("acid")) amount = Math.max(1, amount - 1);
    if (this.hasCondition(target, "raging") && cause.startsWith("slain by")) amount = Math.max(1, Math.ceil(amount / 2));
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

    const inRangeEnemy = this.attackTargets(u).length > 0;
    const hurtAllyNear = (r: number) =>
      this.allies(u).some((a) => distance(a.pos, u.pos) <= r && (a.hp < a.maxHp || a.downed));

    if (f.includes("rage"))
      out.push({ id: "rage", name: `Rage (${this.usesLeft(u, "rage", 2)})`, text: FEATURES.rage.text,
        enabled: !u.bonusUsed && !this.hasCondition(u, "raging") && this.usesLeft(u, "rage", 2) > 0,
        needsTarget: "none", kind: "bonus" });
    if (f.includes("reckless"))
      out.push({ id: "reckless", name: "Reckless", text: FEATURES.reckless.text,
        enabled: !this.hasCondition(u, "reckless"), needsTarget: "none", kind: "bonus" });
    if (f.includes("divine_smite"))
      out.push({ id: "divine_smite", name: `Smite (${this.usesLeft(u, "divine_smite", 2)})`, text: FEATURES.divine_smite.text,
        enabled: !u.actionUsed && inRangeEnemy && this.usesLeft(u, "divine_smite", 2) > 0,
        needsTarget: "enemy", kind: "action" });
    if (f.includes("lay_on_hands"))
      out.push({ id: "lay_on_hands", name: `Lay on Hands (${this.usesLeft(u, "lay_on_hands", 2)})`, text: FEATURES.lay_on_hands.text,
        enabled: !u.actionUsed && this.usesLeft(u, "lay_on_hands", 2) > 0 && this.allies(u).some((a) => distance(a.pos, u.pos) === 1 && (a.hp < a.maxHp || a.downed)),
        needsTarget: "ally", kind: "action" });
    if (f.includes("martial_strike"))
      out.push({ id: "martial_strike", name: "Martial Strike", text: FEATURES.martial_strike.text,
        enabled: !u.bonusUsed && inRangeEnemy, needsTarget: "enemy", kind: "bonus" });
    if (f.includes("flurry"))
      out.push({ id: "flurry", name: `Flurry (${this.usesLeft(u, "flurry", 3)})`, text: FEATURES.flurry.text,
        enabled: !u.bonusUsed && inRangeEnemy && this.usesLeft(u, "flurry", 3) > 0, needsTarget: "enemy", kind: "bonus" });
    if (f.includes("patient_defense"))
      out.push({ id: "patient_defense", name: "Patient Defense", text: FEATURES.patient_defense.text,
        enabled: !u.bonusUsed, needsTarget: "none", kind: "bonus" });
    if (f.includes("inspire"))
      out.push({ id: "inspire", name: `Inspire (${this.usesLeft(u, "inspire", 3)})`, text: FEATURES.inspire.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "inspire", 3) > 0 && this.allies(u).length > 0, needsTarget: "ally", kind: "bonus" });
    if (f.includes("healing_word"))
      out.push({ id: "healing_word", name: `Healing Word (${this.usesLeft(u, "healing_word", 2)})`, text: FEATURES.healing_word.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "healing_word", 2) > 0 && hurtAllyNear(6), needsTarget: "ally", kind: "bonus" });
    if (f.includes("flash_repair"))
      out.push({ id: "flash_repair", name: `Flash Repair (${this.usesLeft(u, "flash_repair", 2)})`, text: FEATURES.flash_repair.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "flash_repair", 2) > 0 && hurtAllyNear(6), needsTarget: "ally", kind: "bonus" });
    if (f.includes("wild_shape"))
      out.push({ id: "wild_shape", name: `Wild Shape (${this.usesLeft(u, "wild_shape", 1)})`, text: FEATURES.wild_shape.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "wild_shape", 1) > 0, needsTarget: "none", kind: "bonus" });
    if (f.includes("fiendish_vigor"))
      out.push({ id: "fiendish_vigor", name: `Fiendish Vigor (${this.usesLeft(u, "fiendish_vigor", 2)})`, text: FEATURES.fiendish_vigor.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "fiendish_vigor", 2) > 0, needsTarget: "none", kind: "bonus" });
    if (f.includes("hex"))
      out.push({ id: "hex", name: u.markTargetId ? "Move Hex" : "Hex", text: FEATURES.hex.text,
        enabled: !u.bonusUsed && this.enemiesOf(u).length > 0, needsTarget: "enemy", kind: "bonus" });
    if (f.includes("quickened"))
      out.push({ id: "quickened", name: `Quicken (${this.usesLeft(u, "quickened", 2)})`, text: FEATURES.quickened.text,
        enabled: !u.bonusUsed && inRangeEnemy && this.usesLeft(u, "quickened", 2) > 0, needsTarget: "enemy", kind: "bonus" });
    if (f.includes("magic_missile"))
      out.push({ id: "magic_missile", name: `Magic Missile (${this.usesLeft(u, "magic_missile", 2)})`, text: FEATURES.magic_missile.text,
        enabled: !u.actionUsed && this.usesLeft(u, "magic_missile", 2) > 0 && this.losEnemies(u, 12).length > 0, needsTarget: "enemy", kind: "action" });
    if (f.includes("alchemist_fire"))
      out.push({ id: "alchemist_fire", name: `Alch. Fire (${this.usesLeft(u, "alchemist_fire", 3)})`, text: FEATURES.alchemist_fire.text,
        enabled: !u.actionUsed && this.usesLeft(u, "alchemist_fire", 3) > 0 && this.losEnemies(u, 6).length > 0, needsTarget: "enemy", kind: "action" });
    if (f.includes("misty_step"))
      out.push({ id: "misty_step", name: `Misty Step (${this.usesLeft(u, "misty_step", 1)})`, text: FEATURES.misty_step.text,
        enabled: !u.bonusUsed && this.usesLeft(u, "misty_step", 1) > 0, needsTarget: "hex", kind: "bonus" });
    if (f.includes("arcane_shield"))
      out.push({ id: "arcane_shield", name: "Shield", text: FEATURES.arcane_shield.text,
        enabled: !u.bonusUsed && !this.hasCondition(u, "dodging"), needsTarget: "none", kind: "bonus" });
    return out;
  }

  /** enemies with LOS within range (for spell targeting) */
  losEnemies(u: Unit, range: number): Unit[] {
    return this.enemiesOf(u).filter(
      (e) => distance(u.pos, e.pos) <= range && this.grid.hasLineOfSight(u.pos, e.pos),
    );
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
      case "rage": {
        if (u.bonusUsed || this.hasCondition(u, "raging") || this.usesLeft(u, "rage", 2) <= 0) return false;
        u.bonusUsed = true;
        this.spend(u, "rage");
        this.addCondition(u, { kind: "raging", duration: -1 });
        this.say(`${u.name} flies into a rage.`);
        break;
      }
      case "reckless": {
        if (this.hasCondition(u, "reckless")) return false;
        this.addCondition(u, { kind: "reckless", duration: 1 });
        this.say(`${u.name} throws caution aside.`);
        break;
      }
      case "divine_smite": {
        if (!target || u.actionUsed || this.usesLeft(u, "divine_smite", 2) <= 0) return false;
        this.spend(u, "divine_smite");
        return this.doAttack(target.id, { extraDice: "2d8", note: "smite" });
      }
      case "lay_on_hands": {
        if (!target || u.actionUsed || this.usesLeft(u, "lay_on_hands", 2) <= 0) return false;
        if (distance(target.pos, u.pos) !== 1) return false;
        u.actionUsed = true;
        this.spend(u, "lay_on_hands");
        this.healUnit(u, target, this.rng.roll("1d8") + 4);
        break;
      }
      case "martial_strike": {
        if (!target || u.bonusUsed) return false;
        u.bonusUsed = true;
        this.attackSequence(u, target.id, 1, {});
        break;
      }
      case "flurry": {
        if (!target || u.bonusUsed || this.usesLeft(u, "flurry", 3) <= 0) return false;
        u.bonusUsed = true;
        this.spend(u, "flurry");
        this.say(`${u.name} unleashes a flurry.`);
        this.attackSequence(u, target.id, 2, {});
        break;
      }
      case "patient_defense": {
        if (u.bonusUsed) return false;
        u.bonusUsed = true;
        this.addCondition(u, { kind: "dodging", duration: 1 });
        this.say(`${u.name} settles into a guard.`);
        break;
      }
      case "arcane_shield": {
        if (u.bonusUsed) return false;
        u.bonusUsed = true;
        this.addCondition(u, { kind: "dodging", duration: 1 });
        this.say(`${u.name} throws up a shield.`);
        break;
      }
      case "inspire": {
        if (!target || u.bonusUsed || this.usesLeft(u, "inspire", 3) <= 0) return false;
        if (distance(target.pos, u.pos) > 8) return false;
        u.bonusUsed = true;
        this.spend(u, "inspire");
        this.addCondition(target, { kind: "inspired", duration: 3 });
        this.say(`${u.name} spurs ${target.name} on.`);
        break;
      }
      case "healing_word":
      case "flash_repair": {
        const max = 2;
        if (!target || u.bonusUsed || this.usesLeft(u, id, max) <= 0) return false;
        if (distance(target.pos, u.pos) > 6) return false;
        u.bonusUsed = true;
        this.spend(u, id);
        const die = id === "flash_repair" ? "1d8" : "1d4";
        this.healUnit(u, target, this.rng.roll(die) + Math.max(1, u.damageBonus));
        break;
      }
      case "wild_shape": {
        if (u.bonusUsed || this.usesLeft(u, "wild_shape", 1) <= 0) return false;
        u.bonusUsed = true;
        this.spend(u, "wild_shape");
        this.healUnit(u, u, this.rng.roll("1d10") + this.levelOf(u));
        u.weapon = { name: "Beast Claws", dice: "1d10", ranged: false, range: 1, ability: u.weapon.ability };
        this.say(`${u.name} shifts into a snarling beast.`);
        break;
      }
      case "fiendish_vigor": {
        if (u.bonusUsed || this.usesLeft(u, "fiendish_vigor", 2) <= 0) return false;
        u.bonusUsed = true;
        this.spend(u, "fiendish_vigor");
        this.healUnit(u, u, this.rng.roll("1d10"));
        break;
      }
      case "hex": {
        if (!target || u.bonusUsed) return false;
        u.markTargetId = target.id;
        u.bonusUsed = true;
        this.say(`${u.name} hexes ${target.name}.`);
        break;
      }
      case "quickened": {
        if (!target || u.bonusUsed || this.usesLeft(u, "quickened", 2) <= 0) return false;
        if (!this.losEnemies(u, u.weapon.range).includes(target)) return false;
        u.bonusUsed = true;
        this.spend(u, "quickened");
        this.say(`${u.name} rushes a second spell.`);
        this.attackSequence(u, target.id, 1, {});
        break;
      }
      case "magic_missile": {
        if (!target || u.actionUsed || this.usesLeft(u, "magic_missile", 2) <= 0) return false;
        if (!this.losEnemies(u, 12).includes(target)) return false;
        u.actionUsed = true;
        this.spend(u, "magic_missile");
        const dmg = this.rng.roll("3d4") + 3;
        this.say(`${u.name}'s missiles strike ${target.name} for ${dmg} (auto).`);
        this.applyDamage(target, dmg, `slain by ${u.name}`, u);
        break;
      }
      case "alchemist_fire": {
        if (!target || u.actionUsed || this.usesLeft(u, "alchemist_fire", 3) <= 0) return false;
        if (!this.losEnemies(u, 6).includes(target)) return false;
        u.actionUsed = true;
        this.spend(u, "alchemist_fire");
        const dmg = this.rng.roll("2d6");
        this.say(`${u.name} hurls fire at ${target.name} for ${dmg}.`);
        this.applyDamage(target, dmg, `burned by ${u.name}`, u);
        if (target.alive) this.addCondition(target, { kind: "burning", duration: 2 });
        break;
      }
      case "misty_step":
        return false; // handled via teleport() from the hex click
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
