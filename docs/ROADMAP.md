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
- [ ] **Playtest gate:** do you want to start another run the moment one ends?

## Phase 4 — Depth & feel

- [ ] Tiers 3–5 monsters; hand-authored bosses at Deep 5/10/15/20; procedural boss assembler.
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
