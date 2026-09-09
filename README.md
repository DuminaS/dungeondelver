# Dungeon Delver

*Working title: **DEPTHDIVER*** — a roguelike hex-grid tactics game about drafting a warband of doomed nobodies and marching them into a hole that goes down forever.

> You do not have heroes. You have a roster of slaves, debtors, condemned criminals and desperate volunteers. You roll them, you draft them, you send them down. Some of them come back. Their gear always does.

---

## The 30-second pitch

Fire Emblem / D&D-style tactical combat on procedurally generated hex arenas, wrapped in a roguelike run structure:

1. **Build a Guild** once (a persistent meta-account: a ruined settlement / gladiator pit you slowly rebuild).
2. **Draft a party.** Each run, roll `N` fully random level-1 recruits. Pick one, `N` fresh recruits replace the pool, repeat until your party of `X` is full.
3. **Delve.** Every floor is a distinct tactical encounter on a hex grid with elevation, choke points, and hazards. Clear the floor objective, then choose your next floor from a revealed set of options.
4. **Permadeath & salvage.** Dead is dead. Survivors strip the corpses and carry the gear deeper — or bank it at an extraction floor.
5. **Use it, send it, or lose it.** Extraction floors let you ship loot/gold to the surface (bank it) or retire the whole party for a cash-out bonus. Everything you don't extract dies with the run.
6. **Spend the proceeds** on Guild upgrades: bigger draft pool (`N`), bigger party (`X`), higher level cap (`W`), better starting recruits, new unlocks.

---

## Repo status

This repository currently contains **design documentation only**. No engine code yet.

| Document | Contents |
|---|---|
| [DESIGN.md](DESIGN.md) | The full design bible — every system, expanded and specified. Start here. |
| [docs/COMBAT.md](docs/COMBAT.md) | Tactical layer: hex grid, action economy, combat math, hazards, LOS/cover. |
| [docs/PROGRESSION.md](docs/PROGRESSION.md) | Leveling to `W` (cap 20), multiclassing, subclasses, feats, Guild meta-upgrades. |
| [docs/CONTENT.md](docs/CONTENT.md) | Content tables: races, classes, traits, monsters, floor types, loot. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build phases from prototype to 1.0. |

## Intended tech (proposed, not final)

- **TypeScript + Vite**, zero UI framework for the arena.
- **Canvas 2D** hex renderer; DOM overlay for HUD/menus.
- Pure, seeded, deterministic simulation core (`rng` → everything) so runs are replayable and testable headless.
- `localStorage` for the Guild/meta save; single JSON blob, versioned.
- No backend for v1.

## License

TODO — not yet chosen.
