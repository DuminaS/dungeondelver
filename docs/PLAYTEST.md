# V1 playtest build

This is an early **vertical slice** — the tactical core plus a thin run wrapper. It exists to answer one question: *is a fight fun, and is a short descent tense?* Most of the design bible (a real gear/inventory system, subclasses/feats, Charters/Covenants) is **not in this build yet** — see [ROADMAP.md](ROADMAP.md).

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
| **Settlement hub** — found & name the Pit, then a persistent campaign screen: click the Pit to launch a run; 7 upgradable buildings (Recruitment Hall `N`, Barracks `X` record-gated, Training Yard `W`, Recruit Pedigree stat floor, Smithy starting gear, Vault bank cap, Infirmary death-saves) spend the treasury; a Ledger of records / the dead / past runs | ✅ |
| **Persistent roster** — survivors are signed to the club for good, not redrafted every run: a run's draft only fills *open* slots (roster short of party size), and every pick joins the roster permanently. Dead means gone from the roster, same as from the fight | ✅ |
| Draft: roll `N` (from Recruitment Hall), pick `X` for open slots, **full pool re-roll** after every pick; free Mulligan + a "watch ad" reroll stub (free in playtest) | ✅ |
| **Recruitment Market** — a paid, targeted alternative to the free draft roll: scout a page of purchasable prospects (priced by stat quality, tagged Low/Medium/High risk) and sign a *specific* one straight onto the roster, or release a current roster member to free a slot | ✅ |
| **Tap-to-confirm targeting** — a first tap on the board *arms* the move / attack / feature / AOE (highlighted, with a hit-chance or blast-count readout); a second tap on it, the **Confirm** button, or <kbd>Enter</kbd> commits; <kbd>Esc</kbd> or ✕ cancels. Built for touch | ✅ |
| **AOE abilities** — Fighter Cleave, Barbarian Sweep, Ranger Volley, Bard Thunderwave, Wizard/Sorcerer Burning Hands (targeted burst, hits allies too), Cleric Spirit Guardians (passive aura) | ✅ |
| 4 races (Human/Dwarf/Elf/Half-Orc); **all 13 classes** (Fighter, Rogue, Ranger, Cleric, Barbarian, Paladin, Monk, Bard, Druid, Sorcerer, Warlock, Wizard, Artificer) to Lv 5, each with a starting weapon + 2–3 signature abilities — simplified kits, not full spell lists | ✅ |
| **Real multiclassing** — XP earned queues as a level-up choice, resolved in the Aftermath screen: advance a class you already have (free) or branch into a new one if you meet its Admission Requirement (a stat threshold / race / trait chip, shown met or unmet). Features, HP and AC all accumulate correctly across classes (5e multiclass rules) | ✅ |
| **Character sheet** — click any warband card (or the small ⌖ on a draft-pool card) to open a slide-in dossier: header, combat bar, ability cards (class-primary stats glow gold), skills, clickable trait/feature cards tagged by source (class+level / race / trait), a Class Path lane per class taken, and a "Multiclass paths" panel showing every other class with its requirement chips | ✅ |
| ~11 traits (boons/banes/quirks) + racial passives | ✅ |
| Action economy: Move / Action / Bonus / Reaction; Dash, Disengage, Dodge, **Shove** (into chasms/hazards), opportunity attacks | ✅ |
| Class verbs: Second Wind, Power Attack, Action Surge, Sneak Attack, Cunning Action, Hunter's Mark, Colossus Slayer, Cure Wounds, Bless, Extra Attack | ✅ |
| Enemy AI: utility targeting + **telegraphed intent** (dashed lines), brute/archer/skirmisher/elite profiles, shove-to-hazard | ✅ |
| Objectives: **Slay**, **Extract** | ✅ (Survive/Escort/Hold: not yet) |
| Procedural arenas: elevation ridges, choke terrain, hazard scatter, budgeted enemies, deploy zone | ✅ |
| Deployment phase (full board info before you commit) | ✅ |
| Random descent: 2–3 tagged floor choices, threat skulls, modifiers shown | ✅ (modifiers are cosmetic for now) |
| **Bosses** — a boss gates every 5th Deep (no alternative floor offered); multi-phase (HP-threshold phase transitions with flavor text, stat buffs, summoned adds, and hazard fields), telegraphed-then-executed big AOE moves (a round of warning with marked tiles, then it lands), bumped XP/loot/Renown on the kill, guaranteed extraction floor right after. Two bosses authored so far: **The Warden** (Deep 5), **The Chainbroken King** (Deep 10) | ✅ |
| **The League** — the club/team competitive layer. Every run is a fixture; a league fee (10%–22%, rising with division prestige) is cut from whatever gold that fixture banks before it lands in the treasury. A standings table ranks your club against 5 rival clubs *per division* by clears → gold → net gold → squad health → reputation; every rival, in every division, rolls its own lightly-simulated fixture the moment yours resolves, so all four tables stay alive. Leveling stays entirely combat-based — the league only ranks, it never grants XP | ✅ |
| **Promotion & relegation** — a season is 6 fixtures; at the end of one, the top 2 of your division's table promote (steeper fee, richer tables) and the bottom 2 relegate, except at the very top or bottom of the 4-division pyramid (Salvage Rounds → Prospect Wards → Lower Pit Circuit → Deep Vault League). Season-to-date numbers reset for everyone at that point; career totals (shown on the Disbandment screen) don't | ✅ |
| **Team disbandment** — the club collapses if the roster is wiped out with no one left to field, or if it's broke *and* has lost three straight fixtures. A rebuild costs most of the treasury, the whole roster, and drops the club to the bottom division with a clean league record — but keeps the Ledger (graveyard, past runs, best depth) intact | ✅ |
| Permadeath, downed + death saves, weapon salvage on death | ✅ |
| Per-chaindiver **XP** + level-ups (kill credit + objective share) | ✅ |
| Extraction floors: bank gold / retire the warband | ✅ (partial extraction, tithe: not yet) |
| Barracks: records, Hall of the Dead, run history (localStorage) | ✅ minimal |

## What's out (don't file bugs for these)

Charters · Covenants · subclasses / feats · a real gear/inventory system (Smithy gives flat bonuses) · injuries persisting between runs · Rest/Market/Shrine/Vault *floors* (the Vault *building* is in) · floor modifiers doing anything · a real rewarded-ad SDK · sound · animation beyond redraws · roster bench rotation (every signed roster member always fields, up to party size) · rival clubs changing division on their own (only your club is ever promoted/relegated).

The interface language (palette, icon set, label map, board layers) is documented in [UI.md](UI.md).

## Controls

- **Deploy:** click a green tile per fighter, or *Auto-deploy*.
- **Move:** hover a blue tile (path previews), click to go. Leaving an enemy's reach draws an opportunity attack unless you Disengage.
- **Attack:** click a red-ringed enemy (uses your Action).
- **Bonus / feature actions:** buttons in the HUD; some ask you to click a target.
- **End turn:** button, or <kbd>Space</kbd> / <kbd>Enter</kbd>.
- **Board key:** elevation = dots · `≈` acid · `^` spikes · `*` fire · `~` gas · `↑` extraction · dashed red line = that enemy's plan next turn · solid red tiles with `!` = a boss's telegraphed big move, get off them before its next turn.

## What to look for / report

1. Did any chaindiver die to something you **could not see coming**? (That's the #1 bug class.)
2. Fights that were trivial or unwinnable from the deploy screen.
3. AI doing something obviously stupid or obviously unfair.
4. Pathing / LOS / hit-chance numbers that felt wrong.
5. Was the "press on vs. extract" call ever actually hard?
6. The seed + the build-badge version, always.

## Dev shortcuts

`?dev=enc&seed=<seed>` jumps straight into a deployed encounter. `?dev=boss&seed=<seed>` jumps straight into a Deep-5 boss fight. Add `&rounds=N` to auto-play N rounds first (auto-attacks the lowest-HP target in range and otherwise walks toward the nearest enemy). `?dev=standings` jumps straight to the league table. `?dev=market` jumps to the Recruitment Market with a seeded roster + treasury. `?dev=disband` jumps to the Disbandment screen. `?dev=debrief&seed=<seed>` fast-forwards a full run to the Debrief screen with a league fixture result (add `&wipe=1` for the loss state, `&promo=1` to see a season-ending promotion, `&releg=1&wipe=1` for a relegation). For quick balance passes: `npm test` runs the headless multi-seed run simulation.
