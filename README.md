# Dungeon Delver

*Working title: **DEPTHDIVER*** — a roguelike hex-grid tactics game about drafting a warband of doomed nobodies and marching them into a hole that goes down forever.

You run **The Gordion Pit** — the knot no one could untie, so they started cutting *down* through it. Your **chaindivers** go in roped together and mostly don't come back.

> You do not have heroes. You have a roster of slaves, debtors, condemned criminals and desperate volunteers. You roll them, you draft them, you send them down. Some of them come back. Their gear always does.

---

## The 30-second pitch

Fire Emblem / D&D-style tactical combat on procedurally generated hex arenas, wrapped in a roguelike run structure:

1. **Build a Guild** once — pick a Charter, name the Pit (default *The Gordion Pit*), set your Covenant. Persistent across every run.
2. **Draft a party.** Each run, roll `N` fully random level-1 recruits. Pick one; the **whole pool re-rolls**; repeat until your party of `X` (starts at **3**) is full.
3. **Delve.** Every floor is a distinct tactical encounter on a hex grid with elevation, choke points, and hazards. Clear the floor objective, then choose your next floor from a revealed set of options.
4. **Permadeath & salvage.** Dead is dead. Survivors strip the corpses and carry the gear deeper — or bank it at an extraction floor. Survive a downing and you limp out with a persistent **Injury**.
5. **Use it, send it, or lose it.** Extraction floors let you ship loot/gold to the surface (bank it), retire the whole party for a cash-out bonus, or send one veteran home safe while the rest press on. Everything you don't extract dies with the run.
6. **Spend the proceeds** on Guild upgrades: bigger draft pool (`N` → 8), bigger party (`X` → 6, record-gated), higher level cap (`W` → 20), better recruits, and a dozen more tracks.

**Locked design calls:** per-chaindiver **XP** leveling · party starts at **3** · **full pool re-roll** every draft pick · multiclass/subclass entry gated by mixed **stat / skill / trait** requirements (Pathfinder-style: always choose from the list at level-up) · premium, no MTX. Details and the still-open questions live in [DESIGN.md §14](DESIGN.md).

---

## Repo status

**V1 playtest slice is live.** Tactical core + a thin run wrapper. The bulk of the design bible (Guild meta, multiclass, bosses, salvage economy) is still to come — see [docs/ROADMAP.md](docs/ROADMAP.md).

- **Play:** `https://duminas.github.io/dungeondelver/` (GitHub Pages, auto-deploys from `main`).
- **Local:** `npm install && npm run dev`.
- **What's in / out of V1:** [docs/PLAYTEST.md](docs/PLAYTEST.md).
- Build version is pinned in the **bottom-right corner** of every screen.

| Document | Contents |
|---|---|
| [DESIGN.md](DESIGN.md) | The full design bible — every system, expanded and specified. Start here. |
| [docs/PLAYTEST.md](docs/PLAYTEST.md) | What the V1 build contains, how to run it, what to report. |
| [docs/COMBAT.md](docs/COMBAT.md) | Tactical layer: hex grid, action economy, combat math, hazards, LOS/cover. |
| [docs/PROGRESSION.md](docs/PROGRESSION.md) | Leveling to `W` (cap 20), multiclassing, subclasses, feats, Guild meta-upgrades. |
| [docs/CONTENT.md](docs/CONTENT.md) | Content tables: races, classes, traits, monsters, floor types, loot. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases from prototype to 1.0. |

## Tech

- **TypeScript + Vite**, zero UI framework. **Canvas 2D** hex renderer; DOM overlay for HUD/menus.
- Pure, seeded, deterministic simulation core (`src/core/rng.ts` → everything) — runs are replayable and testable headless (`npm test` plays multi-seed runs to completion).
- `localStorage` for the Barracks/meta save; versioned JSON blob.
- No backend.

```
src/core/    rng · hex math · grid + A* pathfinding + LOS/cover
src/game/    types · data tables · character gen · encounter engine · enemy AI · arena gen · run/descent
src/ui/      canvas board renderer · localStorage meta
src/main.ts  screen state machine + DOM screens
```

## License

TODO — not yet chosen.
