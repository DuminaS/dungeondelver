# Dungeon Delver — Design Bible

Working title: **DEPTHDIVER**. Genre: roguelike tactical RPG. Reference points: *Fire Emblem*, D&D 5e / Pathfinder tabletop, *Slay the Spire* (run structure & map), *Darkest Dungeon* (attrition, expendable roster, the settlement), *Into the Breach* (readable deterministic tactics), *Battle Brothers* (mercenary roster, permadeath, salvage economy).

This document is the source of truth for *what the game is*. Companion docs go deep on specific systems:

- [docs/COMBAT.md](docs/COMBAT.md) — the tactical layer.
- [docs/PROGRESSION.md](docs/PROGRESSION.md) — character advancement + meta upgrades.
- [docs/CONTENT.md](docs/CONTENT.md) — the content tables.
- [docs/ROADMAP.md](docs/ROADMAP.md) — build order.

---

## 1. Design pillars

1. **Your soldiers are ammunition.** The fantasy is not "my beloved hero". It is "which two of these five do I spend to keep the other three alive and get the loot out". Attachment is *earned* by survival, not handed out.
2. **Every fight is a puzzle with a body count.** Hand-authored feel from procedural parts: elevation, choke points, hazards and objectives should make each arena ask a different question. No "walk up and auto-attack" floors.
3. **The draft is a game before the game.** Team composition is a genuine decision under uncertainty. You are gambling on synergy with incomplete information.
4. **Greed is the core loop.** Descend further = better loot = higher chance the run ends with nothing. "Use it, send it, or lose it" is the emotional engine.
5. **Loss is content.** A dead delver becomes a Barracks entry, a salvaged weapon, a cautionary tale, a named modifier on a future run. The game should make you *want* to read the obituary.
6. **Deterministic and legible.** Given a seed and inputs, the sim is reproducible. Hit chances, damage ranges, threat ranges and AI intent are always visible before you commit. Randomness is in the *setup and the dice*, never in hidden rules.

---

## 2. The shape of a session

```
┌─────────────────────────────────────────────────────────────────────┐
│  GUILD (persistent meta-layer — "the Pit")                           │
│    • Roster of the dead (Barracks)   • Upgrade tree   • Vault/bank    │
│    • Records: deepest floor, richest run, longest-lived delver       │
└───────────────┬─────────────────────────────────────────────────────┘
                │  START A RUN
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  DRAFT                                                                │
│    Roll N level-1 recruits → pick 1 → N re-roll → ... until X picked  │
│    Optional: 1 free "mulligan" of the whole pool, upgradable          │
└───────────────┬─────────────────────────────────────────────────────┘
                │  DESCEND
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FLOOR LOOP  (repeat until wipe / voluntary extraction)              │
│    1. Reveal 1–3 candidate next floors, each tagged (see §7)         │
│    2. Player picks one                                               │
│    3. Tactical encounter: generate hex arena, resolve objective      │
│    4. Aftermath: loot, salvage, level-ups, injuries, events          │
│    5. If Extraction floor: choose to bank, retire, or press on       │
└───────────────┬─────────────────────────────────────────────────────┘
                │  RUN ENDS (wipe, or voluntary retire)
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SETTLE UP                                                            │
│    • Banked gold/loot is kept    • Un-banked is lost                 │
│    • Retired survivors → "Legends" (permanent Barracks, small bonus) │
│    • Dead → Barracks obituaries + any legacy modifiers               │
│    • Spend on Guild upgrades                                          │
└─────────────────────────────────────────────────────────────────────┘
```

A run is expected to last **25–50 minutes** at mid-game mastery: roughly 8–15 floors, 3–6 minutes per encounter.

---

## 3. The Guild (meta-layer)

The framing: you have inherited / been sentenced to run a **ruined arena-settlement at the mouth of the Descent** — call it *the Pit*, *the Maw*, *Gallowsreach*, *the Sinkhole Concession* (name TBD, see §12). It is falling apart. Every run funds another plank of its reconstruction, and a rebuilt Pit produces better delvers and better options.

### 3.1 Guild creation (one-time, first launch)

The player makes a handful of choices that set the campaign's flavor and starting modifiers. Think *Darkest Dungeon* estate, not an MMO character creator.

| Choice | Options (examples) | Effect |
|---|---|---|
| **Charter** (the Pit's origin) | *Penal Colony* / *Gladiator Guild* / *Scholars' Expedition* / *Doomsday Cult* / *Merchant Concession* | Starting upgrade, one always-on rule, cosmetic theme. e.g. Penal Colony: recruits are free but start with a negative trait; Merchant Concession: +25% loot value, −1 starting party slot. |
| **Sigil & name** | Free text + icon | Cosmetic; appears on records and gravestones. |
| **First Overseer** (your avatar / the meta-narrator) | A portrait + a passive | Minor global passive, a voice for event text. |
| **Difficulty covenant** | *Delver* / *Warden* / *Abyssal* / custom sliders | Enemy scaling, salvage rates, permadeath strictness (see §11). |

Charters are the "class" of your whole campaign and are the main source of build-around identity at the meta level. Ship 3, design for ~8.

### 3.2 Persistent resources

| Resource | Earned from | Spent on |
|---|---|---|
| **Gold** | Banked at extraction; retirement bonus; selling salvage | Upgrades, re-rolls, hiring back Legends |
| **Renown** | Clearing milestone floors, boss kills, records set | Unlocking new Charters, upgrade tiers, cosmetic |
| **Salvage / Materials** | Stripped gear sent to surface, dungeon resources | Crafting, forging heirlooms, upgrade material costs |
| **Relics** (rare) | Boss floors, "Vault" floors, deep extractions | One-time permanent global modifiers (small pool, big effects) |

### 3.3 Guild upgrades — the four the player named, expanded

All four are **tiered tracks**, not single toggles. Costs scale; each tier can carry a secondary rider.

1. **Recruitment Hall → draft pool size `N`.** `N`: 3 → 4 → 5 → 6 → 7 → 8. Higher tiers also add: guaranteed class diversity in the pool (no dupes), then a visible "next reroll" preview, then the ability to *bench* one rejected recruit per draft for later.
2. **Barracks Expansion → party size `X`.** `X`: 3 → 4 → 5 → 6. Each `+1` is expensive and gated behind a deepest-floor record. Party size is the single biggest power lever — treat it as a mid/late-game goal, not an early buy.
3. **Training Yard → level cap `W`.** `W`: 3 → 5 → 8 → 11 → 14 → 17 → 20. See §5.4. Also unlocks: subclass access (tier 2), feat slots (tier 3+), the "veteran start" option (deep tiers: recruits roll at level > 1).
4. **Recruit Pedigree → base stat floor for new level-1s.** Raises the minimum of rolled stats and/or grants free background skills / a guaranteed positive trait slot. Keeps the late-game draft from feeling like garbage-picking.

### 3.4 Other Guild upgrades (brainstorm pool)

- **The Vault** — increases how much you can bank per extraction; later, passive interest on banked gold between runs.
- **Infirmary** — a between-runs slot to heal an *injury* off a retired Legend so you can redeploy them.
- **Quartermaster** — a persistent stash of a few gear items that carry between runs (small, e.g. 3 slots at max).
- **Scrying Pool** — reveal an extra candidate next-floor, or reveal one floor deeper, or see floor modifiers before choosing.
- **Memorial** — converts Barracks dead into **Legacy Boons**: a fallen delver who reached floor 10+ leaves a bonus that a future recruit of the same class can inherit (a heirloom weapon, a signature ability, a stat bump).
- **Black Market** — unlocks the Market floor type and improves its stock.
- **Cartographer** — small chance each run to start with a partial map of the first few floors.
- **Champion's Rest** — retire more than the party cap into "Legends"; hire a Legend back into a future draft pool for gold (they keep their level up to a cap).
- **Rites** — consumable pre-run blessings bought with Renown (start with a shared shield, one free revive token, +1 draft mulligan).

---

## 4. The Draft

### 4.1 The roll

Starting a run generates a pool of `N` **recruits**. Each recruit is a fully generated level-1 character:

- **Race** (weighted table; rarer races carry stronger identity — see [docs/CONTENT.md](docs/CONTENT.md)).
- **Ability scores** — rolled, method configurable per Charter/difficulty. Default: `4d6 drop lowest`, assigned to a class-appropriate array with some noise, then race modifiers applied. Recruit Pedigree raises the floor.
- **Class** (level 1) — weighted; the recruit comes with the level-1 kit for that class.
- **Background** — a light skill/flavor package (Soldier, Urchin, Acolyte, Charlatan, Miner, Disgraced Noble…). Grants 1–2 skill proficiencies and a tiny utility perk.
- **Traits** — 0–3 from a large table. Traits are the spice: flat bonuses, drawbacks, conditional triggers, or unique active/passive abilities. Positive and negative. A recruit with a scary-good trait usually also has a scary-bad one. See §4.3.
- **Portrait + generated name** (name influenced by race/background).
- **Cost** — usually free, but some Charters or high-value recruits cost gold to draft (a "signing bonus"), creating a draft-economy decision.

### 4.2 The pick loop

1. Show `N` recruits as cards with full stat blocks and trait tooltips.
2. Player drafts **one**. It joins the party.
3. The **entire remaining pool re-rolls** to `N` fresh recruits. (Design intent: you cannot "wait" for a specific recruit to still be there next pick — every pick is now-or-never. This is the tension.)
4. Repeat until `X` picked.
5. **Mulligan** (upgradable count, default 1): before drafting a given slot, discard the whole current pool and re-roll it once. Does not consume a pick.
6. **Bench** (high Recruitment Hall tier): keep one un-drafted recruit aside; you may draft them instead of the live pool on a later pick.

Optional rule (Charter-gated): **Blind Draft** — you see race + class + traits but ability scores are hidden until drafted. Higher variance, higher reward Charter.

### 4.3 Traits (the identity engine)

Traits are the main reason two Fighters play differently. Structure:

- **Tier**: minor / major / defining. A recruit's trait budget is a point total; defining traits cost more and usually pair with a drawback.
- **Kind**: `passive_stat`, `passive_conditional`, `triggered`, `granted_ability`, `drawback`, `quirk` (roleplay/economy flavor with mechanical edge).
- **Tags** for synergy: `#fire #undead #greed #pack #berserk #arcane #holy` etc. Enemies, floors and gear reference tags.

Examples (full table in [docs/CONTENT.md](docs/CONTENT.md)):

| Trait | Kind | Effect |
|---|---|---|
| *Ironhide* | passive_stat | +2 max HP per level, −1 hex speed. |
| *Bloodscent* | passive_conditional | +2 to hit and +1d6 damage vs. any enemy below half HP. |
| *Coward's Instinct* | triggered | The first time you drop below 25% HP each floor, immediately take a free Disengage + half-move. |
| *Pyromaniac* | granted_ability + drawback | Gain the *Immolate* bonus action; you have −2 saves vs. fire and ignite adjacent allies on a natural 1. |
| *Doomed* | drawback | Cannot be the last survivor — dies automatically if reduced to 1 ally. (Pairs with huge stat rolls.) |
| *Lucky* | quirk | Once per floor, reroll any one die (yours or an enemy's roll against you). |
| *Debt-Bonded* | quirk | Free to draft; 20% of any gold this delver personally loots is skimmed by the Guild… which you keep even if the run wipes. |
| *Heirloom Bearer* | quirk | Starts with a random uncommon weapon; if they die, that weapon auto-salvages (can't be lost on the floor). |

### 4.4 Reading synergy (player-facing helper)

The draft UI surfaces a lightweight **synergy panel**: shared tags across the current party, coverage gaps (no ranged? no healer? no one who can deal with `#undead`?), and action-economy notes (three characters who all want their bonus action for the same thing). Never prescriptive — just information.

---

## 5. Characters

Full mechanical spec in [docs/PROGRESSION.md](docs/PROGRESSION.md). Summary here.

### 5.1 Ability scores & derived stats

Six scores: **STR, DEX, CON, INT, WIS, CHA**. Modifier `= floor((score − 10) / 2)`.

Derived:

| Stat | Formula (v1) |
|---|---|
| Max HP | class hit die + CON mod at L1; `+ (avg die roll + CON mod)` per level |
| Armor Class | `10 + DEX mod (capped by armor) + armor bonus + shield + cover` |
| Initiative | `d20 + DEX mod` (+ trait/feat mods) |
| Speed | base `6` hexes, modified by race/armor/traits |
| Proficiency bonus | `+2` at L1–4, `+3` at 5–8, `+4` at 9–12, `+5` at 13–16, `+6` at 17–20 |
| Saves | proficient saves add prof bonus; used vs. hazards, spells, conditions |
| Carry / salvage capacity | `STR mod + 3` gear slots for looting-out |

### 5.2 Action economy

Per turn, each character gets: **1 Move**, **1 Action**, **1 Bonus Action**, plus **1 Reaction** (between turns). Move can be split around the Action. Full rules, the action list, and combo examples in [docs/COMBAT.md](docs/COMBAT.md §4).

### 5.3 Classes, multiclass, subclass

- Ship classes: **Fighter, Rogue, Wizard, Cleric, Ranger, Barbarian** (v1). Design for ~12 (add Paladin, Monk, Sorcerer, Warlock, Bard, Druid).
- **Every level-up, the player picks which class to take a level in** (Pathfinder: Kingmaker style). No stat/level prerequisites to *enter* a class in v1 — the cost of multiclassing is opportunity cost (delayed class features, split proficiency). Optional hardcore rule re-adds stat gates.
- **Subclass** chosen at that class's **level 3** (some at 1 or 2), gated by feat/stat/skill/background prerequisites where flavorful. Subclass is where a build gets its verb.
- Multiclass spellcasting uses a simplified combined-slots rule (see PROGRESSION.md) to avoid 5e's headache.

### 5.4 Level cap `W` and XP

- **`W` is the Guild-wide hard ceiling** on delver level, upgradable `3 → 5 → 8 → 11 → 14 → 17 → 20`. A run cannot level a delver past the current `W` even with surplus XP (it banks a little as Renown instead).
- XP is awarded per encounter (objective + kills + optional bonus objectives). Party shares a pool; each delver spends from it. Early `W` tiers make the draft and floor 1–3 tactics matter more; deep `W` tiers turn late runs into a power fantasy that the enemy scaling (§11) chases.
- **Milestone option** (difficulty setting): instead of XP numbers, delvers level on a fixed floor cadence (e.g. +1 level every 2 floors, capped at `W`). Cleaner, less bookkeeping, recommended default.

### 5.5 Injuries (between the binary of "fine" and "dead")

When a character hits 0 HP: they are **downed**, not dead — *if* an ally can reach them. Downed characters roll **death saves** each of their turns (3 successes = stabilized & prone at 1 HP; 3 failures = dead). Taking a hit while downed = auto-fail (crit hit = 2). If the encounter ends with a downed character still alive, they survive the floor but gain a persistent **Injury** (Cracked Ribs: −1 CON until treated; Limp: −2 speed; Haunted: disadvantage on fear saves; Missing Eye: −2 ranged to hit). Injuries are only removed at the Guild Infirmary (retired Legends) — within a run they stack and press you toward extraction.

**Instant death** still happens: massive overkill (damage ≥ remaining HP + max HP), certain boss abilities, falling into a bottomless pit, `Doomed` trait, etc.

---

## 6. The tactical encounter

The heart of the game. Detailed in [docs/COMBAT.md](docs/COMBAT.md). Key points:

- **Hex grid**, procedurally generated per floor, sized ~`10×10` to `16×16` scaled to party size and floor type.
- **Elevation** (0–3): high ground grants ranged advantage / +to-hit, extends vision, and costs extra move to climb; blocks line of sight against lower tiles behind ridges.
- **Terrain**: open, difficult (½ speed), wall (blocks move + LOS, grants cover to adjacent), water (speed + can't dash), chasm (impassable / fall), rubble (cover, climbable).
- **Hazards**: acid pools, spike strips, caltrops, fire, poison gas clouds (spreading), collapsing floor, hidden traps (Perception vs. DC to spot; can be triggered *onto* enemies), summoning glyphs.
- **Choke points & objectives** are generated together so the objective is always spatially interesting (extraction point behind a hazard, boss on the high ground, survive-zone that's the only safe tile from an expanding gas).
- **Deployment**: player places their party within a deployment zone at encounter start, with full knowledge of enemy positions and the objective. First move is yours (unless an Ambush modifier).
- **Enemy AI**: utility-based, telegraphed. Every enemy shows its **intent** (who it will move toward / attack) at the start of the player's turn, *Into the Breach*-style, for most enemy types. "Cunning" enemies show intent only within vision; "Mindless" enemies always show it.

### 6.1 Objective types (v1)

| Objective | Rule | Twist hooks |
|---|---|---|
| **Slay** | Reduce all hostiles (or the marked Boss) to 0. | Reinforcement waves; a fleeing enemy that calls more if it escapes. |
| **Survive** | Live for `T` turns; then a extraction opens. | Endless spawns; shrinking safe zone; an unkillable threat you must juke. |
| **Extract** | Get `≥1` (or *all*) survivors onto the extraction hex(es). | Extraction roams; carrying loot slows you; the point only activates after a lever/kill. |
| **Escort / Carry** | Move an objective token (a caged ally, a relic, a wounded NPC) to the exit. | The token can be targeted; whoever carries it can't use their Action. |
| **Ritual / Hold** | Stand on `K` glyphs for `T` turns total (party-wide) to open the way. | Standing on a glyph draws aggro / applies a debuff. |

Bonus objectives (optional, per floor, for extra XP/loot): "no deaths", "kill the boss first", "don't trigger the gas", "loot all 3 chests", "finish in ≤ 8 turns".

---

## 7. Random Descent — the map

After clearing a floor, reveal **2–3 candidate next floors** (Scrying Pool upgrade adds a 4th, or reveals depth+2). Each candidate shows:

- **Depth** (always current + 1; the abyss only goes down).
- **Floor type tag(s)** — see table.
- **Threat rating** — a 1–5 skull indicator of enemy tier relative to your party's average level.
- **Known modifiers** — 0–2 visible mutators (e.g. `Darkness`, `Elite pack`, `Unstable ground`, `Rich veins`). Hidden modifiers exist and are revealed on entry (Cartographer/Scrying reduce hidden count).

### 7.1 Floor types

| Type | What it is |
|---|---|
| **Combat** (default) | A standard encounter with one of the §6.1 objectives. |
| **Elite / Gladiator Pit** | Harder fight (named elite or mini-boss), guaranteed higher-tier loot, often a bonus objective baked in. |
| **Boss** | Every ~5 floors, a large multi-phase enemy on a bespoke-ish arena. Clearing grants Renown + a Relic chance + opens a guaranteed Extraction next. |
| **Rest Site** | No fight. Choose one: short rest (spend Hit Dice to heal), swap gear freely, hold a brief camp event (dialogue + choice), or train (convert XP surplus). |
| **Market / Black Market** | A vendor: buy gear/consumables/services (revive token, injury patch, reroll draft-pool memory) with in-run gold. Black Market adds cursed/gambling stock. |
| **Extraction** | The greed valve. See §8. |
| **Vault** | Rare. A puzzle-ish or timed room with high-tier loot behind a hazard gauntlet or a "grab and run before it collapses" timer. |
| **Shrine / Event** | A non-combat choice node: a bargain with something in the dark. Trait grafts, curses, gambles, story beats. |
| **Hollow / Empty** | Deliberately quiet floor — free healing tiles, foreshadowing, a breather. Rare; more common right after a Boss. |

### 7.2 Descent pacing rules

- Depth `d` sets a **budget** for enemy count/tier, hazard density, and loot tier. Budgets ramp, with periodic dips (post-Boss) so the difficulty curve breathes.
- Guaranteed cadence: **Boss every 5**, **Extraction available within 2 floors of a Boss**, **at least one Rest/Market per 4** unless the player keeps choosing away from them.
- The set of candidates is biased so there's usually a "safe-ish" and a "greedy" option. Sometimes there isn't — both doors are bad, pick your poison.
- **No backtracking.** Down is the only direction. A chosen door is committed.

---

## 8. Extraction — "use it, send it, or lose it"

Extraction floors (and post-Boss guaranteed extractions) present a menu. This is where runs are won or thrown away.

1. **Bank loot & gold (SEND IT).** Ship any subset of your in-run gold + salvage + gear to the surface. Banked = permanently yours for the Guild. There's a **capacity** (Vault upgrade) and often a **tithe** (a % cut, reducible by Charter/upgrades). The party continues, now lighter — and often you've just sent up the gear that was keeping someone alive.
2. **Retire the party (CASH OUT / USE IT — the run ends well).** Every surviving delver "retires" to the surface alive. You get: all carried loot banked automatically (no tithe), a **retirement bonus** (gold + Renown scaling with depth reached and survivors), and each retiree becomes a **Legend** in the Barracks — permanently recorded, and re-hireable later (Champion's Rest upgrade). The run is over. This is the "good ending" and the correct call more often than players want to admit.
3. **Press on (LOSE IT… maybe).** Take nothing, keep everything on your bodies, go deeper. If you wipe before the next extraction, all of it — gold, gear, delvers — is gone. The deeper you are when you finally extract, the fatter the bonus.
4. **Partial extraction (advanced).** Send *one delver* home with the loot (they retire as a Legend, carrying a bounded number of gear slots — guaranteed safe) while the rest press on short-handed. Great for saving a beloved veteran or a stuffed pack mule; brutal on the tactical layer.

Design intent: the *math* should usually say "extract", and the *player* should usually want to push. That gap is the game.

---

## 9. Loot, gear & salvage

### 9.1 Gear

- Slots: **Main hand, Off hand, Armor, Trinket ×2, Consumables**. Two-handers eat both hands.
- Rarity: common / uncommon / rare / heirloom / cursed. Higher rarity = flat bump + a keyword property (`Keen`, `Vampiric`, `Reach`, `Thundering`, `of the Anchor` = can't be moved by forced movement, etc.).
- **Cursed** items are strong with a real cost and can't be unequipped without a Shrine/Market service — great Black Market bait.
- Gear scaling is deliberately modest vs. levels; a good level-6 party in common gear beats a level-3 party in rares. Gear is *tie-breaker and identity*, not the power axis. (Keeps the "send it or keep it" choice hard — losing gear hurts but isn't run-ending unless you overcommitted.)

### 9.2 Salvage (the corpse economy)

- When a delver dies, their body drops **all** carried gear as a lootable cache on that hex.
- Any surviving delver can spend **Move + Action** adjacent to the cache to strip it, up to their carry capacity (§5.1). Ungrabbed gear is **lost** when the floor ends.
- Salvaged gear can be: re-equipped immediately, carried to sell/bank at the next Market/Extraction, or fed to the Guild as Materials.
- **Field salvage** of enemies: certain enemies (constructs, armored humanoids) leave salvage too. Beasts leave *crafting materials* / trophies.
- Emotional beat: stripping your own dead teammate mid-fight while their killer is still on the board. The UI should not shy away from it.

### 9.3 Heirlooms & legacy

- An heirloom weapon that survives 10+ floors, or is carried by 3+ different delvers across runs, can be **enshrined** at the Guild (Memorial upgrade) — it gains a name, a small stat, and a line of history. Enshrined heirlooms can be issued to a future recruit at run start.
- A delver who dies *holding* an heirloom binds a wisp of themselves to it: the next wielder inherits one of the dead delver's traits or trained abilities. Builds a literal family tree of gear across a campaign.

---

## 10. The Barracks (legacy layer)

- **Hall of the Dead** — every fallen delver: name, portrait, race/class(es), level, floors survived, kill count, cause of death (specific: "Torn apart by a Rime Hound on Floor 12, holding the Ashglass Dagger"), and their traits. Searchable, sortable, filterable.
- **Legends** — retired survivors. Same card, gold border, plus their retirement stats and current re-hire cost.
- **Records** — deepest floor, richest single extraction, longest-lived delver, biggest single hit, most kills in one encounter, fastest Boss kill, "no-death" run streak, per-Charter bests.
- **Run History** — a compact log of past runs: party, route taken through the descent, how it ended, what was banked. Replayable from seed (dev/verification feature, exposed as "Ghost Replay" for players later).
- **Cause-of-death analytics** (fun + useful): "34% of your delvers die to hazards they walked into." "You extract on average at floor 7.2." Nudges self-awareness without nagging.
- **Legacy Boons** feed from here into §3.4 Memorial.

---

## 11. Difficulty, scaling & fairness

- **Depth-based budget** is the primary knob (§7.2). Enemy tier tracks `party average level + f(depth)`; the `+f(depth)` term is what punishes over-greed.
- **Covenant** (chosen at Guild creation, adjustable): enemy HP/damage multipliers, salvage %, tithe %, number of draft mulligans, whether Injuries are permanent, whether death saves exist at all (Abyssal: 0 HP = dead, no downed state).
- **Rubber-banding, downward only:** after a wipe, the next run gets a tiny, decaying "grief" bonus (a free Rite, +1 mulligan) — never enough to trivialize, enough to reduce tilt. Off on Abyssal.
- **Anti-snowball:** party size `X` and level cap `W` are gated behind *records*, not just gold, so the player can't buy their way past the tactical learning curve.
- **Telegraphing is sacred.** Any time the game kills a delver, the player must have been able to see it coming: hit chances, damage ranges, enemy intent, hazard tick timing, save DCs — all visible pre-commit. Post-mortem screen highlights the fatal decision point.
- **Seeded & deterministic** core so balance can be tested by simulation (run 10k headless drafts+descents, look at extraction depth / wipe-floor distributions).

---

## 12. Naming & tone

- **Delvers** vs. slaves/adventurers/helldivers/depthdivers: recommend **"Delvers"** as the neutral term, with Charter-flavored synonyms in UI text (*the Condemned*, *the Contracted*, *the Faithful*, *volunteers*). "Depthdiver" as the working project title / the deepest-diver record holder's honorific.
- **The Pit** (settlement) candidates: *Gallowsreach*, *the Maw*, *the Sinkhole Concession*, *Ninefold Deep*, *the Throat*, *Coinhole*, *Last Market*.
- **The Descent / the Abyss / the Deep** for the dungeon. Floors are "Deeps" (Deep 1, Deep 2…) or just numbered.
- Tone: grimy, mercenary, darkly funny. *Battle Brothers* register — matter-of-fact about death, not edgelord about it. Event text has a dry narrator (the Overseer).

---

## 13. Brainstorm — making it better & more fun

Grouped by how strongly they're recommended.

### 13.1 Strong — build these into the core

- **Enemy intent telegraphing** (*Into the Breach*). Non-negotiable for "loss is fair". Already in §6.
- **The synergy panel in the draft** (§4.4). Turns a blind gamble into a readable gamble.
- **Injuries as a soft failure state** (§5.5). Gives "should I extract" a mechanical push, not just a greed-vs-fear vibe.
- **Partial extraction** (§8.4). The single best source of memorable stories ("I sent Old Kerrow home with the gold and the other three didn't make it").
- **Cause-of-death specificity + post-mortem** (§10, §11). Cheap to build, huge for attachment and for the player feeling the game is fair.
- **Deterministic seeded core.** Enables Daily/Weekly runs, ghost replays, leaderboards, and sane balance testing. Build it in from line one, not bolted on.
- **Deployment phase with full info** (§6). Front-loads the puzzle; every fight opens with a real decision.
- **"Both doors are bad" descent nodes.** The map should sometimes refuse to offer a safe option.

### 13.2 Medium — great additions once the core is proven

- **Daily / Weekly Descent** — fixed seed, fixed Charter, global leaderboard by extraction value / depth. Trivial given the deterministic core.
- **Rivals / Ghost warbands** — another player's (or a past run's) wiped party appears as a hazard-neutral neutral faction, or their corpses litter a floor with their gear still on them. Async multiplayer flavor, no netcode-heavy PvP.
- **Bounties / Contracts** — the Guild offers optional run-goals ("extract with 3 Legends", "kill the Deep-5 boss under level 6") for Renown. Directs play without forcing it.
- **Faction reputation in the Deep** — some floors have a neutral third party (a lost expedition, a merchant, cultists). Help / rob / ignore. Reputation unlocks Market stock or turns them hostile.
- **Environmental "verbs" for the player** — shove enemies into hazards/chasms, collapse a ceiling on a choke, ignite an oil slick, bait a trap. Reward tactical creativity over stat-checks.
- **Formation / stance meta-actions** — a party-wide toggle each turn (Aggressive/Defensive/Skirmish) that trades a small bonus for a small penalty, giving the player one decision even on quiet turns.
- **Camp events at Rest Sites** — short branching dialogue with a mechanical choice; a place for delver personality to surface (their traits/background gate options).
- **The retirement cutscene** — a one-screen "where are they now" for each Legend. *Battle Brothers* / *Wildermyth* pathos on the cheap.
- **New Charters as the main long-tail content** — each is a full re-flavor + rules twist. Cheaper than new classes, high replay value.

### 13.3 Spicy — riskier, prototype before committing

- **Two-warband runs** — draft two teams, alternate which one delves each floor while the other "rests"; a wipe on one doesn't end the run. Doubles roster attachment, complicates balance.
- **Persistent Deep** — the dungeon is the same across runs within a "season"; your dead bodies and unlooted gear persist; the Deep slowly changes as the community/your account digs. High tech cost.
- **Real-time-with-pause option** for combat, for players who find strict turns slow. Big scope, only if turn-based lands and there's demand.
- **A "surface" 4X-lite layer** — the Pit grows into a town with its own map, rival concessions to compete with for the Descent. Probably a sequel, not v1.
- **Roguelite "ascension" ladder** (*StS*-style) layered on top of the Covenant sliders for the mastery crowd.
- **Mod / content-pack support** — data-driven classes/traits/monsters/floors from JSON. If the core is data-driven anyway (it should be), exposing it is mostly UI + docs.
- **Procedural boss assembly** — bosses built from a body plan + 3–4 ability modules + an arena gimmick, so Deep-25 fights aren't all hand-authored.

### 13.4 Small polish ideas (cheap wins)

- Every delver auto-generates a **one-line epitaph** on death from their traits + cause ("Feared nothing but fire. Died to fire.").
- A **"last stand" slow-mo** beat when your final delver drops.
- **Threat range overlay** — hover any enemy, see every hex it could reach + attack this turn, unioned across enemies with a heat tint.
- **Undo movement** before committing an Action (not after) — respects the puzzle without punishing misclicks.
- **Loadout presets** the player names, applied at draft/gear time.
- **"Press F to salvage"** — literally. Lean into it.
- Deterministic **shareable seed strings** in a readable word format.
- **Colorblind-safe** hazard patterns (not just color), and a full text log of every roll for accessibility + trust.
- **Pause-menu "rules" reference** that's actually the design doc's combat tables, in-game.

---

## 14. Open questions / decisions to lock

1. **XP numbers vs. milestone leveling** — lean milestone for default, XP as a Covenant option. Confirm.
2. **How punishing is gear loss?** Current stance: modest (§9.1). If playtests show it's run-ending, soften salvage rules, not gear power.
3. **Downed/death-save state on by default?** Yes for Delver/Warden, off for Abyssal. Confirm the save math (3/3, hit-while-down auto-fails).
4. **Party size `X` starting value** — 3 or 4? 3 makes early runs tense and the draft heavier; 4 is more forgiving and more "party-like". Leaning 3.
5. **Draft: full re-roll on every pick** (current, max tension) vs. re-roll only the drafted slot (lets you plan around visible recruits). Leaning full re-roll, with Bench upgrade as the pressure valve.
6. **Multiclass prerequisites** — none in v1 (opportunity cost only) vs. 5e-style stat gates. Leaning none + optional hardcore rule.
7. **How much authored content per Boss** vs. procedural assembly (§13.3). Probably hand-author Deeps 5/10/15, proc-assemble beyond.
8. **Real-money / meta-progression ethics** — this is a premium game, no MTX. State it plainly.
9. **Name.** Lock the game title and the settlement name before store-page work.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| **Guild / the Pit** | Persistent meta-account: settlement, upgrades, Barracks, Vault. |
| **Charter** | The campaign-level "class" chosen at Guild creation. |
| **Delver** | A drafted character. Expendable by design. |
| **Draft** | Pre-run: roll `N`, pick `X` one at a time with full re-roll between picks. |
| **`N` / `X` / `W`** | Draft pool size / party size / level cap. All Guild-upgradable. |
| **Descent / Deep** | The dungeon / an individual floor. |
| **Objective** | The win condition for a floor (Slay/Survive/Extract/Escort/Hold). |
| **Intent** | The telegraphed action an enemy will take, shown before the player commits. |
| **Downed** | 0 HP but not dead; rolling death saves; salvageable to survival by an ally. |
| **Injury** | Persistent debuff from surviving a downing; only cured at the Guild. |
| **Salvage** | Gear stripped from the dead (yours or enemies') on the floor. |
| **Bank / Send it** | Ship loot to the surface at an Extraction floor; permanent. |
| **Retire / Cash out** | End the run voluntarily; survivors become Legends, full bonus. |
| **Legend** | A retired survivor: permanent Barracks entry, re-hireable. |
| **Heirloom** | Gear with persistent cross-run history and inherited traits. |
| **Covenant** | The difficulty ruleset. |
| **Relic** | Rare permanent global meta-modifier. |
