# V1 playtest build

This is an early **vertical slice** — the tactical core plus a thin run wrapper. It exists to answer one question: *is a fight fun, and is a short descent tense?* Most of the design bible (Guild meta, multiclass, extraction economy, salvage-in-combat, bosses) is **not in this build yet** — see [ROADMAP.md](ROADMAP.md).

## Play it

- **Hosted:** GitHub Pages — `https://duminas.github.io/dungeondelver/` (auto-deploys from `main` once Pages is enabled on the repo).
- **Local:** `npm install && npm run dev` → open the printed URL.
- **Single-file:** `npm run build:single` produces `dist-single/index.html` — one self-contained file you can email or drop anywhere.

The build version (semver · git sha · timestamp) is pinned in the **bottom-right corner** of every screen. Quote it in bug reports.

## What's in

| System | State |
|---|---|
| Seeded, deterministic sim | ✅ everything routes through one RNG; same seed + same picks = same run |
| Hex grid: elevation, terrain, hazards (acid/spikes/fire/gas), chasms, LOS, cover, A* | ✅ |
| Draft: roll `N=3`, pick `X=3`, **full pool re-roll** after every pick | ✅ |
| 4 races (Human/Dwarf/Elf/Half-Orc); **all 13 classes** (Fighter, Rogue, Ranger, Cleric, Barbarian, Paladin, Monk, Bard, Druid, Sorcerer, Warlock, Wizard, Artificer) to Lv 5, each with a starting weapon + 2–3 signature abilities — simplified kits, not full spell lists | ✅ |
| ~11 traits (boons/banes/quirks) + racial passives | ✅ |
| Action economy: Move / Action / Bonus / Reaction; Dash, Disengage, Dodge, **Shove** (into chasms/hazards), opportunity attacks | ✅ |
| Class verbs: Second Wind, Power Attack, Action Surge, Sneak Attack, Cunning Action, Hunter's Mark, Colossus Slayer, Cure Wounds, Bless, Extra Attack | ✅ |
| Enemy AI: utility targeting + **telegraphed intent** (dashed lines), brute/archer/skirmisher/elite profiles, shove-to-hazard | ✅ |
| Objectives: **Slay**, **Extract** | ✅ (Survive/Escort/Hold: not yet) |
| Procedural arenas: elevation ridges, choke terrain, hazard scatter, budgeted enemies, deploy zone | ✅ |
| Deployment phase (full board info before you commit) | ✅ |
| Random descent: 2–3 tagged floor choices, threat skulls, modifiers shown | ✅ (modifiers are cosmetic for now) |
| Permadeath, downed + death saves, weapon salvage on death | ✅ |
| Per-chaindiver **XP** + level-ups (kill credit + objective share) | ✅ |
| Extraction floors: bank gold / retire the warband | ✅ (partial extraction, tithe: not yet) |
| Barracks: records, Hall of the Dead, run history (localStorage) | ✅ minimal |

## What's out (don't file bugs for these)

Guild creation & upgrades · Charters · Covenants · multiclass / subclasses / feats · gear beyond the starting weapon · injuries persisting between runs · bosses · Rest/Market/Shrine/Vault floors · floor modifiers doing anything · sound · animation beyond redraws · mobile layout polish.

The interface language (palette, icon set, label map, board layers) is documented in [UI.md](UI.md).

## Controls

- **Deploy:** click a green tile per fighter, or *Auto-deploy*.
- **Move:** hover a blue tile (path previews), click to go. Leaving an enemy's reach draws an opportunity attack unless you Disengage.
- **Attack:** click a red-ringed enemy (uses your Action).
- **Bonus / feature actions:** buttons in the HUD; some ask you to click a target.
- **End turn:** button, or <kbd>Space</kbd> / <kbd>Enter</kbd>.
- **Board key:** elevation = dots · `≈` acid · `^` spikes · `*` fire · `~` gas · `↑` extraction · dashed red line = that enemy's plan next turn.

## What to look for / report

1. Did any chaindiver die to something you **could not see coming**? (That's the #1 bug class.)
2. Fights that were trivial or unwinnable from the deploy screen.
3. AI doing something obviously stupid or obviously unfair.
4. Pathing / LOS / hit-chance numbers that felt wrong.
5. Was the "press on vs. extract" call ever actually hard?
6. The seed + the build-badge version, always.

## Dev shortcuts

`?dev=enc&seed=<seed>` jumps straight into a deployed encounter. Add `&rounds=N` to auto-play N rounds first. For quick balance passes: `npm test` runs the headless multi-seed run simulation.
