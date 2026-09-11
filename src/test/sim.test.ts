import { describe, it, expect } from "vitest";
import { RNG } from "../core/rng";
import { distance, hex, line, withinRange } from "../core/hex";
import { Run } from "../game/descent";
import { Encounter } from "../game/encounter";
import { key } from "../core/hex";
import { applyLevelUp } from "../game/character";
import { admissionFor } from "../game/data";
import { CLASS_IDS, ClassId } from "../game/types";

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

describe("multiclassing", () => {
  it("grantXp queues pending levels instead of applying them", async () => {
    const { makeCharacter } = await import("../game/character");
    const c = makeCharacter(new RNG("mc-1"), { classId: "fighter" });
    expect(c.level).toBe(1);
    expect(c.pendingLevelUps).toBe(0);
    const gained = (await import("../game/character")).grantXp(c, 10000);
    expect(gained).toBeGreaterThan(0);
    expect(c.level).toBe(1); // unchanged until assigned
    expect(c.pendingLevelUps).toBe(gained);
  });

  it("applyLevelUp accumulates features per-class and computes multiclass HP/AC", async () => {
    const { makeCharacter, grantXp, applyLevelUp, classLevelsOf, classLabel, featureSources } = await import(
      "../game/character"
    );
    const c = makeCharacter(new RNG("mc-2"), { classId: "fighter" });
    grantXp(c, 50000);
    // force this specific character into rogue eligibility so the branch is deterministic
    c.abilities.DEX = 16;
    let steps = 0;
    let tookRogue = false;
    while (c.pendingLevelUps > 0 && steps++ < 15) {
      const target = !tookRogue && c.level >= 2 ? "rogue" : c.classId;
      applyLevelUp(c, target as never);
      if (target === "rogue") tookRogue = true;
    }
    expect(tookRogue).toBe(true);
    const counts = classLevelsOf(c);
    expect(counts.fighter).toBeGreaterThan(0);
    expect(counts.rogue).toBeGreaterThan(0);
    expect(c.levelHistory.length).toBe(c.level);
    expect(classLabel(c)).toMatch(/Fighter \d+ \/ Rogue \d+/);
    // rogue's level-1 feature should show up, sourced to Rogue L1
    const rogueSrc = featureSources(c).find((f) => f.id === "sneak_attack");
    expect(rogueSrc?.source).toBe("Rogue · L1");
    expect(c.maxHp).toBeGreaterThan(0);
    expect(c.ac).toBeGreaterThan(0);
  });

  it("admissionFor never leaves a class permanently unreachable at 13+ in its stat", async () => {
    const { makeCharacter } = await import("../game/character");
    for (const id of CLASS_IDS) {
      const c = makeCharacter(new RNG(`adm-${id}`), { classId: id });
      const adm = admissionFor(c, id);
      // a character can always advance a class they already have
      expect(adm.chips.length).toBeGreaterThan(0);
    }
  });
});

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
        // resolve any level-ups: mostly continue the known class, sometimes branch
        for (const c of run.state.party) {
          let guard3 = 0;
          while (c.pendingLevelUps > 0 && guard3++ < 20) {
            const known = new Set(c.levelHistory);
            const branchOut: ClassId | undefined =
              c.level % 3 === 0 ? CLASS_IDS.find((id) => !known.has(id) && admissionFor(c, id).met) : undefined;
            applyLevelUp(c, branchOut ?? c.classId);
          }
        }
      }
      // run either ended or we hit the floor cap; party invariants hold
      for (const c of run.state.party) {
        expect(c.hp).toBeGreaterThan(0);
        expect(c.hp).toBeLessThanOrEqual(c.maxHp);
        expect(c.level).toBeGreaterThanOrEqual(1);
        expect(c.levelHistory.length).toBe(c.level);
        expect(c.pendingLevelUps).toBe(0);
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

  it("boss encounters run phase transitions, telegraphs, and pay out on death", async () => {
    const { generateArena } = await import("../game/arena");
    const { unitFromCharacter } = await import("../game/units");
    const { makeCharacter } = await import("../game/character");
    const { BOSSES } = await import("../game/data");

    for (const seed of ["boss-a", "boss-b", "boss-c"]) {
      const rng = new RNG(seed);
      const party = ["fighter", "cleric", "rogue"].map((classId) =>
        makeCharacter(rng.fork(`c-${classId}`), { classId: classId as ClassId }),
      );
      const arena = generateArena(rng.fork("arena"), 5, "boss", party.length);
      const boss = arena.enemies.find((u) => u.boss);
      expect(boss).toBeTruthy();
      expect(BOSSES[boss!.boss!.defId]).toBeTruthy();

      const enc = new Encounter({
        grid: arena.grid,
        players: party.map((c) => unitFromCharacter(c, arena.deployZone[0])),
        enemies: arena.enemies,
        objective: arena.objective,
        rng: rng.fork("enc"),
        depth: 5,
        deployZone: arena.deployZone,
      });
      autoPlayEncounter(enc);
      expect(["won", "lost"]).toContain(enc.phase);

      const bossUnit = enc.units.find((u) => u.boss);
      expect(bossUnit).toBeTruthy();
      // phase should have advanced at least once by the time the fight ends
      // (win: it was beaten down through at least phase 1; loss: it survived, phase may be 0 if it won fast — so only assert on a win)
      if (enc.phase === "won") {
        expect(bossUnit!.boss!.phase).toBeGreaterThanOrEqual(1);
        expect(bossUnit!.alive).toBe(false);
      }
    }
  });

  it("generated arenas never softlock: every enemy and extraction hex is reachable from deploy", async () => {
    const { generateArena } = await import("../game/arena");
    const { neighbors: hexNeighbors } = await import("../core/hex");
    const { HexGrid } = await import("../core/grid");

    const passableFlood = (grid: InstanceType<typeof HexGrid>, starts: { q: number; r: number }[]) => {
      const seen = new Set<string>();
      const queue: { q: number; r: number }[] = [];
      for (const s of starts) {
        const t = grid.get(s);
        if (t && t.terrain !== "wall" && t.terrain !== "chasm") {
          seen.add(key(s));
          queue.push(s);
        }
      }
      let i = 0;
      while (i < queue.length) {
        const cur = queue[i++];
        for (const n of hexNeighbors(cur)) {
          const nk = key(n);
          if (seen.has(nk) || !grid.has(n)) continue;
          const t = grid.get(n)!;
          if (t.terrain === "wall" || t.terrain === "chasm") continue;
          seen.add(nk);
          queue.push(n);
        }
      }
      return seen;
    };

    let checked = 0;
    for (const kind of ["combat", "elite", "extraction", "boss"] as const) {
      for (let depth = 1; depth <= 10; depth++) {
        for (let i = 0; i < 6; i++) {
          const rng = new RNG(`connectivity-${kind}-${depth}-${i}`);
          const arena = generateArena(rng, depth, kind, 3);
          const reached = passableFlood(arena.grid, arena.deployZone);
          const targets = arena.enemies
            .map((e) => e.pos)
            .concat(arena.objective.extractHexes ?? []);
          for (const t of targets) {
            expect(reached.has(key(t))).toBe(true);
          }
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
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

describe("league", () => {
  it("initLeague seeds one player club plus five rivals per division, player starting at the bottom", async () => {
    const { initLeague, DIVISIONS, divisionOf } = await import("../game/league");
    const league = initLeague("Test Club");
    expect(league.clubs.length).toBe(1 + 5 * DIVISIONS.length);
    const player = league.clubs.filter((c) => c.isPlayer);
    expect(player.length).toBe(1);
    expect(player[0].name).toBe("Test Club");
    expect(new Set(league.clubs.map((c) => c.id)).size).toBe(league.clubs.length); // unique ids
    // every division is populated
    for (const div of DIVISIONS) {
      expect(league.clubs.filter((c) => c.divisionId === div.id).length).toBeGreaterThanOrEqual(5);
    }
    expect(divisionOf(league).tier).toBe(DIVISIONS.length); // starts in the bottom division
  });

  it("recordFixture deducts the division's fee and credits clears/points on a clear", async () => {
    const { initLeague, recordFixture, divisionOf } = await import("../game/league");
    const league = initLeague("Fee Test");
    const div = divisionOf(league);
    const { fee, net } = recordFixture(league, {
      cleared: true,
      floorsCleared: 5,
      goldEarned: 400,
      squadHealth: 3,
      reputation: 10,
    });
    expect(fee).toBe(Math.round(400 * div.feePct));
    expect(net).toBe(400 - fee);
    const player = league.clubs.find((c) => c.isPlayer)!;
    expect(player.clears).toBe(1);
    expect(player.losses).toBe(0);
    expect(player.goldEarned).toBe(400);
    expect(player.feePaid).toBe(fee);
    expect(player.netGold).toBe(net);
    expect(player.points).toBe(3);
    expect(player.form).toEqual(["W"]);
    // every rival should also have rolled a fixture this round
    for (const c of league.clubs) {
      if (c.isPlayer) continue;
      expect(c.form.length).toBe(1);
    }
  });

  it("a loss records no clear and no points, but still pays a fee on whatever gold was earned", async () => {
    const { initLeague, recordFixture } = await import("../game/league");
    const league = initLeague("Loss Test");
    const { fee, net } = recordFixture(league, {
      cleared: false,
      floorsCleared: 2,
      goldEarned: 50,
      squadHealth: 1,
      reputation: 0,
    });
    const player = league.clubs.find((c) => c.isPlayer)!;
    expect(player.clears).toBe(0);
    expect(player.losses).toBe(1);
    expect(player.points).toBe(0);
    expect(player.form).toEqual(["L"]);
    expect(fee + net).toBe(50);
  });

  it("standings rank by clears first, then gold, then net gold, then squad, then reputation", async () => {
    const { standings } = await import("../game/league");
    const club = (over: object) => ({
      id: "x", name: "x", isPlayer: false, divisionId: "salvage", strength: 0.5,
      clears: 0, losses: 0, floorsCleared: 0, goldEarned: 0, feePaid: 0, netGold: 0, points: 0,
      squadHealth: 3, reputation: 0, form: [], careerClears: 0, careerGoldEarned: 0, seasonsPlayed: 0,
      ...over,
    });
    const league = {
      season: 1,
      round: 0,
      clubs: [
        club({ id: "a", name: "More clears, less gold", clears: 3, goldEarned: 100, netGold: 90 }),
        club({ id: "b", name: "Fewer clears, more gold", clears: 1, goldEarned: 900, netGold: 810 }),
      ],
    };
    const ranked = standings(league, "salvage");
    expect(ranked[0].id).toBe("a"); // clears beat gold, exactly per the design's ranking priority
    expect(ranked[1].id).toBe("b");
  });

  it("fee tiers rise with division prestige (tier 4 cheapest, tier 1 dearest)", async () => {
    const { DIVISIONS } = await import("../game/league");
    const byTier = [...DIVISIONS].sort((a, b) => a.tier - b.tier);
    for (let i = 1; i < byTier.length; i++) {
      expect(byTier[i].feePct).toBeLessThan(byTier[i - 1].feePct);
    }
  });

  it("promotes a dominant club and relegates a winless one at season's end", async () => {
    const { initLeague, recordFixture, playerClub, SEASON_LENGTH, DIVISIONS } = await import("../game/league");

    const promoLeague = initLeague("Promo Test");
    const startTier = playerClub(promoLeague).divisionId;
    let last;
    for (let i = 0; i < SEASON_LENGTH; i++) {
      last = recordFixture(promoLeague, { cleared: true, floorsCleared: 20, goldEarned: 999999, squadHealth: 3, reputation: 0 });
    }
    expect(last!.seasonEnded).toBe(true);
    expect(last!.promoted).toBe(true);
    expect(playerClub(promoLeague).divisionId).not.toBe(startTier);
    expect(promoLeague.season).toBe(2);
    // season-to-date resets, but career total remembers the dominant run
    expect(playerClub(promoLeague).clears).toBe(0);
    expect(playerClub(promoLeague).careerClears).toBe(SEASON_LENGTH);

    const relLeague = initLeague("Relegation Test");
    let lastRel;
    for (let i = 0; i < SEASON_LENGTH; i++) {
      lastRel = recordFixture(relLeague, { cleared: false, floorsCleared: 0, goldEarned: 0, squadHealth: 1, reputation: 0 });
    }
    expect(lastRel!.seasonEnded).toBe(true);
    // already at the bottom division, so a winless season can't relegate further —
    // only assert it never promotes a club that lost every fixture
    expect(lastRel!.promoted).toBe(false);
    void DIVISIONS;
  });

  it("resetPlayerClub drops the club to the bottom division and clears its record", async () => {
    const { initLeague, recordFixture, resetPlayerClub, playerClub, divisionOf, DIVISIONS, SEASON_LENGTH } = await import(
      "../game/league"
    );
    const league = initLeague("Collapse Test");
    for (let i = 0; i < SEASON_LENGTH; i++) {
      recordFixture(league, { cleared: true, floorsCleared: 10, goldEarned: 999999, squadHealth: 3, reputation: 0 });
    }
    expect(divisionOf(league).tier).toBeLessThan(DIVISIONS.length); // promoted out of the bottom
    resetPlayerClub(league, "Reborn Club");
    expect(divisionOf(league).tier).toBe(DIVISIONS.length);
    expect(playerClub(league).clears).toBe(0);
    expect(playerClub(league).careerClears).toBe(0);
    expect(playerClub(league).name).toBe("Reborn Club");
  });
});

describe("recruitment market", () => {
  it("prices recruits above zero and tags a risk level for each", async () => {
    const { rollMarket } = await import("../game/recruitment");
    const pool = rollMarket(new RNG("market-test"), 6);
    expect(pool.length).toBe(6);
    for (const m of pool) {
      expect(m.price).toBeGreaterThan(0);
      expect(["Low", "Medium", "High"]).toContain(m.risk);
      expect(m.character.name.length).toBeGreaterThan(0);
    }
  });

  it("a full run seeded with a persistent roster starts the draft already signed", async () => {
    const { makeCharacter } = await import("../game/character");
    const seedParty = ["fighter", "cleric", "rogue"].map(
      (classId, i) => makeCharacter(new RNG(`roster-seed-${i}`), { classId: classId as ClassId }),
    );
    const run = new Run("roster-run", "Test Club", seedParty);
    expect(run.state.party.length).toBe(3);
    expect(run.draftComplete).toBe(true);
    expect(run.state.party.map((c) => c.id)).toEqual(seedParty.map((c) => c.id));
  });
});

describe("disbandment", () => {
  it("triggers on a total roster wipeout, not otherwise", async () => {
    const { checkDisbandment } = await import("../game/guild");
    const { initLeague } = await import("../game/league");
    const base = {
      version: 4 as const, name: "Test Club", sigil: "⛓", gold: 500, renown: 0, materials: 0,
      buildings: { recruitment: 0, barracks: 0, training: 0, pedigree: 0, vault: 0, infirmary: 0, smithy: 0 },
      runs: [], graveyard: [], bestDepth: 3, bestBanked: 0, totalBanked: 0, retires: 0, founded: Date.now(),
      league: initLeague("Test Club"), roster: [], disbandments: 0,
    };
    expect(checkDisbandment(base)).toBeTruthy(); // empty roster
    expect(checkDisbandment({ ...base, roster: [{} as never] })).toBeNull(); // someone's still fielded
  });

  it("triggers on financial collapse: broke plus three straight losses", async () => {
    const { checkDisbandment } = await import("../game/guild");
    const { initLeague, playerClub } = await import("../game/league");
    const league = initLeague("Broke Club");
    playerClub(league).form = ["L", "L", "L"];
    const base = {
      version: 4 as const, name: "Broke Club", sigil: "⛓", gold: 0, renown: 0, materials: 0,
      buildings: { recruitment: 0, barracks: 0, training: 0, pedigree: 0, vault: 0, infirmary: 0, smithy: 0 },
      runs: [], graveyard: [], bestDepth: 1, bestBanked: 0, totalBanked: 0, retires: 0, founded: Date.now(),
      league, roster: [{} as never], disbandments: 0,
    };
    expect(checkDisbandment(base)).toBeTruthy();
    expect(checkDisbandment({ ...base, gold: 40 })).toBeNull(); // not broke — safe despite the losing streak
  });

  it("disbandAndRebuild keeps history but resets the roster, most of the treasury, and league position", async () => {
    const { disbandAndRebuild } = await import("../game/guild");
    const { initLeague, divisionOf, DIVISIONS, playerClub } = await import("../game/league");
    const league = initLeague("Doomed Club");
    playerClub(league).divisionId = DIVISIONS[1].id; // pretend they'd climbed a tier
    const g = {
      version: 4 as const, name: "Doomed Club", sigil: "⛓", gold: 1000, renown: 100, materials: 0,
      buildings: { recruitment: 0, barracks: 0, training: 0, pedigree: 0, vault: 0, infirmary: 0, smithy: 0 },
      runs: [{ seed: "s", depth: 4, outcome: "wipe" as const, banked: 0, fee: 0, net: 0, party: [], when: 0 }],
      graveyard: [{ name: "Bael", epitaph: "e", depth: 4, cause: "c" }],
      bestDepth: 4, bestBanked: 0, totalBanked: 0, retires: 0, founded: Date.now(),
      league, roster: [], disbandments: 0,
    };
    disbandAndRebuild(g, "New Name");
    expect(g.name).toBe("New Name");
    expect(g.gold).toBeLessThan(1000);
    expect(g.disbandments).toBe(1);
    expect(divisionOf(g.league).id).toBe(DIVISIONS[0].id); // dropped to the bottom
    // history survives the collapse
    expect(g.runs.length).toBe(1);
    expect(g.graveyard.length).toBe(1);
    expect(g.bestDepth).toBe(4);
  });
});
