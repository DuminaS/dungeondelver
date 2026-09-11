# Roadmap

From nothing to 1.0. Each phase ends with something you can *play*.

> **Status (build v0.1.x):** Phase 0 done, Phase 1 done, Phase 2 partially done. Playable slice deployed — see [PLAYTEST.md](PLAYTEST.md).

---

## Phase 0 — Foundations (engine skeleton) — ✅ done

Goal: a deterministic simulation core with no content, plus a hex renderer.

- [~] Project scaffold: TypeScript + Vite + Vitest. (ESLint/Prettier: not yet)
- [x] `rng.ts` — seeded PRNG (mulberry32/xoshiro), `int/float/pick/weighted/shuffle/dice("2d6+1")`. Everything random routes through an injected RNG instance.
- [x] `hex.ts` — cube/axial math, distance, neighbors, range, line (supercover), ring/spiral, rotation.
- [x] `grid.ts` — `HexGrid` with tiles, terrain, elevation, hazards, occupancy; A* pathfinding over the movement-cost function; LOS + cover per [COMBAT.md](COMBAT.md §2).
- [~] Canvas 2D renderer: grid, elevation shading, terrain, hazards, entities, overlays (reachable, attackable, path preview, enemy intent). (threat-range heat, pan/zoom: not yet)
- [~] Headless test harness: vitest suite incl. multi-seed full-run sim + pathfinding invariants. (ASCII-art grid fixtures: not yet)

## Phase 1 — Tactical vertical slice

Goal: one hand-made encounter, fully playable, no meta.

- [x] `types.ts` — Entity, Stats, Condition, Action, Effect, EncounterState.
- [x] Character derived stats (HP/AC/init/speed/prof) from a raw stat block.
- [x] Turn engine: initiative, round loop, action economy (Move/Action/Bonus/Reaction), condition ticking, objective checks.
- [x] Action resolvers: Attack (d20 vs AC, crit, damage), Move (with OA), Dash, Disengage, Dodge, Shove, Help.
- [x] Reaction system: Opportunity Attacks.
- [x] Hazards: acid, spikes, fire+Burning, fall damage, forced movement.
- [x] Enemy AI v1: utility scorer (COMBAT.md §8) with Brute + Archer profiles; intent telegraphing.
- [~] HUD: unit cards, action bar, combat log, end-turn. (hit-chance/damage preview computed but not surfaced on hover yet)
- [x] Win/lose on a single **Slay** objective. Restart.
- [ ] **Playtest gate:** is a single fight fun for 5 minutes?

## Phase 2 — Content pipeline + a delve

Goal: data-driven content, procedural floors, a multi-floor run (no meta yet).

- [x] Data tables (TS modules, typed): races, classes (L1–5), traits, backgrounds, monsters (tier 1–2), weapons/armor/trinkets/consumables, floor types.
- [x] Character generator: roll race/stats/class/background/traits → full level-1 chaindiver with kit.
- [~] Draft screen: roll `N`, pick loop with full re-roll. (mulligan, synergy panel: not yet)
- [~] Arena generator: elevation ridges, terrain/hazard scatter, deploy zone, budgeted enemy placement, objective placement. (explicit choke carving + winnability validation pass: not yet)
- [~] Objectives: Slay, Survive, Extract, Hold, Escort.
- [x] Deployment phase.
- [x] Descent map: reveal 2–3 tagged candidates, threat rating, modifiers; pick → next floor.
- [~] Aftermath: loot, per-chaindiver XP + auto level-up, downed/death-saves/permadeath, weapon salvage. (choose-your-class prompt, persistent Injuries: not yet)
- [~] Salvage: corpse caches, carry capacity, strip action.
- [x] Run-end (wipe) screen.
- [ ] **Playtest gate:** is a 6–10 floor run tense and readable?

## Phase 3 — The Guild (meta loop)

Goal: the full run→spend→run cycle.

- [ ] `meta.ts` — persistent save (versioned JSON in localStorage), migration hook.
- [ ] Guild creation: Charters (3), name-the-Pit + sigil (default "The Gordion Pit"), Overseer, Covenant sliders (Chained/Warden/Abyssal + custom).
- [ ] Resources: Gold, Renown, Materials, Relics.
- [ ] Upgrade tracks: Recruitment Hall (`N`), Barracks (`X`, record-gated), Training Yard (`W`), Recruit Pedigree, Vault, + 2–3 more.
- [ ] Extraction floors: bank / retire / press on / partial extraction.
- [ ] Barracks: Hall of the Dead (obituaries + cause of death), Legends, Records, Run History.
- [ ] Multiclass + subclass UI (Admission Requirements: stat/skill/trait gates), feats, per-class ASI cadence.
- [ ] Rest Site / Market / Shrine floors.
- [x] **The League** — reframes the run as a fixture in a competitive circuit (`game/league.ts`), its pyramid modeled on the real English football league system: 7 levels / ~240 clubs, narrow at the top (Level 1, 20 clubs) and fanning out into parallel regional groups toward the bottom (Level 6 splits into North/South, Level 7 into four circuits — every club starts at Level 7). A fee rising with level (4%→22%) comes off each fixture's gold before it hits the treasury; a standings table ranks the club against the rest of its own division by clears → gold → net gold → squad health → reputation, with every division at every level lightly simulated live. Every 6 fixtures a season settles: top 2 of the table promote, bottom 2 relegate (a random group when the destination level has more than one), season stats reset (career totals persist). Leveling stays purely combat-based — the league never grants XP, it only ranks.
- [x] **Persistent roster, no blind draft** (`game/recruitment.ts`) — the random per-run draft is gone from live play (its `Run.pool`/`pickRecruit` machinery stays only as dev/test scaffolding). Survivors carry over permanently; every open roster slot is filled through the **Recruitment Market** (pay to sign a specific priced-and-risk-tagged prospect) or **the Sump School** (an 8th building — always available even unbuilt, flat-cost, deliberately weaker than the Market, the gap narrowing but never closing as the building levels up). "Into the Pit" locks until the roster is full.
- [x] **Wages** — every roster member costs upkeep per fixture (scales with level + stat quality, `salaryFor()` in `game/character.ts`), deducted after the league fee; the treasury can go negative (debt).
- [x] **Team disbandment** — the club is forced to rebuild (roster wiped, most of the treasury gone, dropped to a random bottom-of-the-pyramid circuit, league record reset) if the roster is wiped out entirely, the club is broke after three straight fixture losses, or wage debt goes severely negative on its own; the Ledger (graveyard, past runs, best depth) survives the collapse.
- [ ] Staff system (scout/medic/trainer with mechanical effects) and per-division rulesets beyond the fee percentage (roster caps, salary caps, youth quotas) — deferred, per the "wages + Sump School first" scoping call.
- [x] **Season dungeon** (`league.ts`'s `dungeonSpecForLevel()`, `descent.ts`'s `Run.maxFloors`/`depthStart`/`finalDepth`) — the open-ended descent is gone. Every fixture is now a fixed-length dungeon sized and scaled to the club's current league level (6 floors / Deep 1 at the bottom of the pyramid up to 13 floors / Deep 10 at the top); the final floor is always forced to a real fight (never an extraction shaft) and clearing it ends the fixture as an automatic full-clear win (`EncounterReport.fullClear`).
- [x] **Season recap** — `settleSeason()` now snapshots the division's final table before resetting it (`SeasonRecap`), and a dedicated recap screen shows it (medaled top 3, the player's row highlighted) before the debrief hands off to the new season.
- [x] **Buildings cost much more, and gate on tenure** — every cost roughly tripled, and every level past the first also requires a minimum season count and best-ever league level (`guild.ts`'s `progressGate()`/`PROGRESS_REQ`, gated on the new `Guild.bestLeagueLevel`), on top of gold.
- [x] **3 save slots + a main menu** — the app opens on a club-select screen (`guild.ts`'s slot-aware `loadGuildSlot()`/`saveGuild()`/`listSlotSummaries()`/`deleteSlotSave()`); each slot is a fully independent save, a pre-slots single save migrates into Slot 1 once, and "Switch club" on the Settlement screen returns to the menu.
- [x] **Expert-tester QA pass** — found and fixed 4 real softlocks/bugs (stranded level-ups on a full clear, a financial-gridlock softlock, a rebuild-into-rebuild loop, a false-positive disbandment check); see [QA_NOTES.md](QA_NOTES.md) for the full writeup, a gap analysis against the club-management design docs, and expansion ideas.
- [ ] **Playtest gate:** do you want to start another run the moment one ends?

## Phase 4 — Depth & feel

- [~] Tiers 3–5 monsters; hand-authored bosses at Deep 5/10/15/20; procedural boss assembler. (Deep 5 "The Warden" + Deep 10 "The Chainbroken King" shipped — multi-phase, telegraphed AOE moves, adds, hazard fields; Deep 15/20 bosses + a procedural assembler for endless-mode depths: not yet)
- [ ] Full class tables to L20; design-for classes (Paladin, Monk, Sorcerer, Warlock, Bard, Druid).
- [ ] Environmental verbs polish: shove-to-chasm, collapse ceilings, ignite slicks, bait traps.
- [ ] Threat-range heat overlay, undo-move, epitaph generator, last-stand slow-mo, post-mortem screen.
- [ ] Floor modifiers (Darkness, Ambush, Elite pack, …).
- [ ] Heirlooms & Legacy Boons; Memorial upgrade.
- [ ] Audio, juice, screen-shake budget, colorblind-safe hazard patterns, full roll log.
- [ ] Balance sim: 10k headless runs per patch; dashboards for wipe-floor, extraction-depth, chaindiver-death-cause.

## Phase 5 — Meta-content & longevity

- [ ] Daily / Weekly Descent (fixed seed + Charter, leaderboard).
- [ ] Ghost warbands / rivals.
- [ ] Bounties / Contracts.
- [ ] Deep factions & reputation.
- [ ] More Charters (the main long-tail lever), Relics, Covenant ascension ladder.
- [ ] Data-driven mod support + docs.

## Non-goals for 1.0

Real-time combat mode · online PvP · the "surface 4X" layer · persistent shared Deep · monetization of any kind (premium, no MTX — state it on the store page).

---

## Testing strategy

- **Unit:** hex math, RNG determinism, pathfinding, LOS/cover, combat math resolvers, character generation invariants.
- **Property/fuzz:** arena generator always produces a valid, winnable, "fair route exists" floor for 10k seeds per biome.
- **Sim:** headless auto-player (greedy + a few heuristics) runs full descents; export CSVs of outcome distributions per balance patch.
- **Snapshot:** seeded encounter → recorded action script → deterministic end state; guards against sim regressions.
- **Playtest cadence:** a gate at the end of every phase; no moving on until the gate question is "yes".
