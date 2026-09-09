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
