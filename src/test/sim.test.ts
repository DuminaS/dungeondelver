import { describe, it, expect } from "vitest";
import { RNG } from "../core/rng";
import { distance, hex, line, withinRange } from "../core/hex";
import { Run } from "../game/descent";
import { Encounter } from "../game/encounter";
import { key } from "../core/hex";

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = new RNG("ash-lantern-207");
    const b = new RNG("ash-lantern-207");
    const seqA = Array.from({ length: 20 }, () => a.int(1, 100));
    const seqB = Array.from({ length: 20 }, () => b.int(1, 100));
    expect(seqA).toEqual(seqB);
  });
  it("differs across seeds", () => {
    const a = Array.from({ length: 20 }, (_, i) => new RNG("x").int(0, 9) + i);
    const b = Array.from({ length: 20 }, (_, i) => new RNG("y").int(0, 9) + i);
    expect(a).not.toEqual(b);
  });
  it("dice specs parse", () => {
    const r = new RNG("d");
    for (let i = 0; i < 200; i++) {
      const v = r.roll("2d6+1");
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(13);
    }
  });
});

describe("hex", () => {
  it("distance basics", () => {
    expect(distance(hex(0, 0), hex(0, 0))).toBe(0);
    expect(distance(hex(0, 0), hex(3, 0))).toBe(3);
    expect(distance(hex(0, 0), hex(-2, 2))).toBe(2);
  });
  it("line endpoints", () => {
    const l = line(hex(0, 0), hex(4, -2));
    expect(l[0]).toEqual(hex(0, 0));
    expect(l[l.length - 1]).toEqual(hex(4, -2));
    expect(l.length).toBe(5);
  });
  it("withinRange count", () => {
    expect(withinRange(hex(0, 0), 1).length).toBe(7);
    expect(withinRange(hex(0, 0), 2).length).toBe(19);
  });
});

/** dumb but legal auto-player: pick the obvious move each turn */
function autoPlayEncounter(enc: Encounter): void {
  if (enc.phase === "deploy") enc.autoDeploy();
  let guard = 0;
  while ((enc.phase === "player" || enc.phase === "enemy") && guard++ < 2000) {
    if (enc.phase === "enemy") {
      enc.runEnemyTurn();
      continue;
    }
    const u = enc.active;
    if (!u) {
      enc.endTurn();
      continue;
    }
    // exercise a class feature ~half the time
    const feats = enc.featureButtons(u).filter((f) => f.enabled);
    if (feats.length && guard % 2 === 0) {
      const f = feats[(guard >> 1) % feats.length];
      const tgt =
        f.needsTarget === "enemy"
          ? enc.enemiesOf(u)[0]?.id
          : f.needsTarget === "ally"
            ? enc.allies(u)[0]?.id
            : undefined;
      if (f.needsTarget === "hex") {
        for (const n of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          if (enc.teleport({ q: u.pos.q + n[0], r: u.pos.r + n[1] })) break;
        }
      } else if (f.needsTarget === "area") {
        const center = f.selfCentered ? u.pos : (enc.enemiesOf(u)[0]?.pos ?? u.pos);
        enc.areaFeature(f.id, center);
      } else if (f.needsTarget === "none" || tgt) {
        enc.useFeature(f.id, tgt);
      }
      continue;
    }
    const targets = enc.attackTargets(u);
    if (targets.length && !u.actionUsed) {
      targets.sort((a, b) => a.hp - b.hp);
      enc.doAttack(targets[0].id);
      continue;
    }
    // move toward nearest enemy
    const foes = enc.units.filter((x) => x.team === "enemy" && x.alive);
    if (foes.length && enc.moveBudget(u) > 0) {
      const reach = enc.moveOptions(u);
      let best: string | null = null;
      let bestD = Infinity;
      for (const k of reach.keys()) {
        const [q, r] = k.split(",").map(Number);
        const d = Math.min(...foes.map((f) => distance({ q, r }, f.pos)));
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      if (best && bestD < Infinity) {
        const [q, r] = best.split(",").map(Number);
        const moved = enc.moveTo({ q, r });
        if (moved) continue;
      }
    }
    enc.endTurn();
  }
}

describe("full run simulation", () => {
  it("plays several seeded runs to completion without throwing", () => {
    for (const seed of ["ash-1", "bone-22", "coin-333", "deep-4", "ember-55"]) {
      const run = new Run(seed);
      expect(run.pool.length).toBeGreaterThan(0);
      while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
      expect(run.state.party.length).toBe(3);
      run.beginDescent();

      let floors = 0;
      while (!run.state.over && floors < 12) {
        floors++;
        const cand = run.state.nextFloors[0];
        const enc = run.enterFloor(cand);
        if (enc === null) {
          // extraction: just bank and continue for the sim
          run.bankGold();
          continue;
        }
        autoPlayEncounter(enc);
        expect(["won", "lost"]).toContain(enc.phase);
        const rep = run.resolveEncounter();
        expect(rep).toBeTruthy();
      }
      // run either ended or we hit the floor cap; party invariants hold
      for (const c of run.state.party) {
        expect(c.hp).toBeGreaterThan(0);
        expect(c.hp).toBeLessThanOrEqual(c.maxHp);
        expect(c.level).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("every class generates a valid recruit and can fight", async () => {
    const { makeCharacter } = await import("../game/character");
    const { CLASS_IDS } = await import("../game/types");
    const { generateArena } = await import("../game/arena");
    const { unitFromCharacter } = await import("../game/units");
    for (const classId of CLASS_IDS) {
      const rng = new RNG(`cls-${classId}`);
      const c = makeCharacter(rng, { classId });
      expect(c.classId).toBe(classId);
      expect(c.maxHp).toBeGreaterThan(0);
      expect(c.ac).toBeGreaterThanOrEqual(8);
      expect(c.weapon.dice).toMatch(/\d*d\d+/);
      const arena = generateArena(rng.fork("a"), 2, "combat", 1);
      const enc = new Encounter({
        grid: arena.grid,
        players: [unitFromCharacter(c, arena.deployZone[0])],
        enemies: arena.enemies,
        objective: arena.objective,
        rng: rng.fork("e"),
        depth: 2,
        deployZone: arena.deployZone,
      });
      enc.autoDeploy();
      autoPlayEncounter(enc);
      expect(["won", "lost"]).toContain(enc.phase);
    }
  });

  it("grid pathfinding never returns a path through walls", () => {
    const run = new Run("wall-check");
    while (!run.draftComplete) run.pickRecruit(run.pool[0].id);
    run.beginDescent();
    const enc = run.enterFloor(run.state.nextFloors[0])!;
    enc.autoDeploy();
    for (const u of enc.units) {
      const reach = enc.moveOptions(u);
      for (const k of reach.keys()) {
        const [q, r] = k.split(",").map(Number);
        const t = enc.grid.get({ q, r });
        expect(t).toBeDefined();
        expect(t!.terrain === "wall" || t!.terrain === "chasm").toBe(false);
      }
      void key;
    }
  });
});
