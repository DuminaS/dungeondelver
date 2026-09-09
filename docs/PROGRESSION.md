# Progression — leveling, multiclass, feats, meta

Companion to [../DESIGN.md](../DESIGN.md) §5 & §3. This is the advancement spec.

---

## 1. Ability scores

- Six scores, `3–20` in normal play (racial + level bumps can exceed the rolled range; hard cap `24`).
- Modifier `= floor((score − 10) / 2)`.
- **Generation methods** (Charter / Covenant selectable):
  - *Standard* (default): roll `4d6 drop lowest` six times, engine assigns to a class-priority array with ±1 noise per slot, then apply racial mods. Guarantees the primary stat is decent, keeps variance in the secondaries.
  - *Wild*: straight `4d6d1` in STR/DEX/CON/INT/WIS/CHA order, no reassignment. High-variance Charter.
  - *Point-buy floor*: every recruit is at least a 27-point-buy spread. "Recruit Pedigree" upgrade nudges toward / past this.
- **Recruit Pedigree** (Guild upgrade) raises the *minimum* rolled value (`3 → 6 → 8`) and at high tiers grants a free `+1` to the class primary and a guaranteed positive trait slot.

### Ability Score Improvement (ASI)
At class levels `4, 8, 12, 16, 19` (per the class, standard 5e cadence): `+2` to one score or `+1`/`+1` to two, **or** take a **Feat** (§4). Multiclassers get ASIs based on levels *in that class*, which is part of the opportunity cost.

---

## 2. Leveling

### 2.1 XP vs. milestone

**Default: milestone.** Delvers gain a level on a fixed floor cadence, capped at current `W`:

| Guild `W` tier | Cadence |
|---|---|
| `W = 3` | +1 level per 2 floors cleared (so ~L3 by floor 4–5) |
| `W = 5` | +1 per 2 floors |
| `W = 8` | +1 per 1.5 floors (alternating 1/2) |
| `W = 11+` | +1 per floor, slowing to +1 per 2 past level 12 |

Elite/Boss floors count double toward the cadence. A delver drafted mid-run (rare, via events) enters at `party median level − 1`.

**Optional: XP mode** (Covenant). Per-encounter XP = `objective_base(depth) + Σ kill_value + bonus_objective`. Shared party pool; auto-spent to level the lowest-level eligible delver first (configurable to manual). Surplus XP above `W` converts at a poor rate to **Renown**.

### 2.2 What a level-up gives

On gaining a delver level, the player chooses **which class** to advance (§3), then resolves that class level:

- **HP:** `+ (avg of hit die + CON mod)`, min 1. (avg: d6→4, d8→5, d10→6, d12→7.)
- **Proficiency bonus** tracks **total delver level**, not class level: `+2` (1–4), `+3` (5–8), `+4` (9–12), `+5` (13–16), `+6` (17–20).
- **Class features** for that class at its new class level (see [CONTENT.md](CONTENT.md) class tables).
- **Subclass** choice if this class level is its subclass level (usually 3) and prereqs are met (§3.3).
- **ASI/Feat** if this class level is an ASI level for that class.
- **Spellcasting** progression if a caster (§5).

### 2.3 Level cap `W`

- `W` is a **Guild-wide ceiling**, upgraded `3 → 5 → 8 → 11 → 14 → 17 → 20` via the Training Yard.
- No delver may exceed `W` regardless of XP/floors. Milestone leveling simply stops; XP mode banks surplus as Renown.
- Training Yard tier riders:
  - **T1 (W=5):** subclasses unlocked.
  - **T2 (W=8):** 1st Feat slot enabled (ASIs can be taken as Feats).
  - **T3 (W=11):** multiclassing unlocked (before this, a delver is single-class for the run).
  - **T4 (W=14):** "Veteran Start" — recruits roll at level `2`.
  - **T5 (W=17):** Veteran Start level `3`; subclass-at-1 options open.
  - **T6 (W=20):** capstone class features (level 20) enabled; "Legend" retirees keep up to level `15` when re-hired (else `10`).

Design note: early `W` keeps the game a *tight tactical* game where the draft and positioning dominate. Late `W` deliberately tips toward a power fantasy that enemy depth-scaling (COMBAT.md §9, DESIGN.md §11) is tuned to chase but never fully catch.

---

## 3. Classes & multiclassing

### 3.1 Ship list (v1)

Fighter (d10), Rogue (d8), Wizard (d6), Cleric (d8), Ranger (d10), Barbarian (d12).
**Design-for list:** + Paladin, Monk, Sorcerer, Warlock, Bard, Druid.

Each class defines: hit die, armor/weapon proficiencies, saving-throw proficiencies, skill picks, and a per-level feature table to (at least) level 5 for v1, level 20 for design. See [CONTENT.md](CONTENT.md).

### 3.2 The multiclass rule

- **Unlocked at `W = 11`** (Training Yard T3). Below that, a delver picks a class at draft and is stuck with it.
- Once unlocked: **every level-up, free choice** of which known-or-new class to advance. *No ability-score prerequisites* in v1 — the cost is purely opportunity cost:
  - Class features are gated by **class level**, not delver level. A Fighter 5 / Wizard 1 has Extra Attack but only 1st-level spells.
  - **Proficiencies** from a second class are the *reduced multiclass set* (5e-style: e.g. multiclassing into Fighter grants light/medium armor, shields, martial weapons — not saves; into Wizard grants nothing but the spellcasting).
  - ASIs are per-class-level, so splitting delays them.
- **Optional Hardcore rule** (Covenant): re-adds 5e stat prerequisites (`13` in the key stat of both the class you leave and the one you enter).
- **Subclass per class:** a multiclassed delver can hold multiple subclasses (one per class that has reached its subclass level).

### 3.3 Subclasses

- Chosen at the class's **subclass level** (Cleric/Sorcerer/Warlock: 1; most: 3; a few: 2).
- **Prerequisites** where flavorful — a *soft gate* using the delver's traits / background / skills / stats, e.g.:
  - *Eldritch Knight* (Fighter): INT `≥ 13` **or** the `Arcane Dabbler` trait / Sage background.
  - *Assassin* (Rogue): proficiency in Stealth **and** (Criminal background **or** `Cold-Blooded` trait).
  - *Berserker* (Barbarian): no gate (it's the "default").
  - *Death Domain* (Cleric): only via a Shrine bargain or the `Marked by the Deep` trait — not offered in normal draft.
- If no subclass prereq is met at the subclass level, the delver picks from the ungated subset (every class has `≥2` ungated options) or **defers** one level (max once).
- Subclasses grant features at set class levels (3/6/10/14/18 typical).

### 3.4 Combined-slots multiclass casting (simplified)

To avoid 5e's multiclass spell-slot table pain:

- **Caster level** `L_cast = full-casters + ½ half-casters (round down) + ⅓ third-casters (round down)`.
  - Full: Wizard, Cleric, Sorcerer, Bard, Druid. Half: Paladin, Ranger. Third: Eldritch Knight, Arcane Trickster.
- Spell **slots** come from a single table keyed on `L_cast` (standard 5e single-class slot table).
- **Spells known/prepared** are still tracked per class (a Wizard 3 / Cleric 2 knows Wizard spells up to what Wizard 3 allows and Cleric spells up to Cleric 2), but they all draw from the **shared slot pool**.
- Highest spell level you can *cast* = min(what your slots allow, highest any single class grants).

---

## 4. Feats

- Enabled at `W = 8` (Training Yard T2). Taken **in place of an ASI**.
- v1 feat pool (~12), design-for ~30. Each is a build verb, not a stat stick.

| Feat | Effect (v1) |
|---|---|
| **Polearm Master** | Reach weapons make Opportunity Attacks when an enemy *enters* your reach; bonus-action butt-end attack (`1d4`). |
| **Sentinel** | Your Opportunity Attacks reduce target speed to 0 for the turn; you OA even against Disengagers. |
| **Great Weapon Master** | Before a two-handed attack, opt for `−5` hit / `+10` dmg; on a kill or crit, free bonus-action attack. |
| **Sharpshooter** | Ignore cover, no long-range disadvantage, `−5`/`+10` option on ranged. |
| **Crossbow Expert** | Ignore loading; no disadvantage in melee with ranged; bonus-action hand-crossbow shot. |
| **War Caster** | Advantage on concentration saves; cast a spell as an Opportunity Attack. |
| **Mobile** | `+2` Speed; no OAs from anyone you attacked this turn; ignore difficult terrain when Dashing. |
| **Tough** | `+2` max HP per level (retroactive). |
| **Lucky** (feat, distinct from trait) | 3 luck points/floor: reroll an attack, check, save, or force an enemy to reroll. |
| **Alert** | `+5` initiative; can't be surprised; no advantage to attackers you can't see. |
| **Resilient (CON)** | `+1` CON, gain CON save proficiency (concentration!). |
| **Skirmisher's Reflexes** | Once/round, when an enemy ends its turn adjacent, move 1 hex free (no OA). |

Traits can *grant* feats (e.g. `Born Fighter` → free Tough), and a Feat can be a subclass prereq.

---

## 5. Spellcasting (v1 simplified)

- **Cantrips:** at-will, scale with total delver level (`1d10` firebolt → `2d10` at L5, etc.).
- **Slots:** by `L_cast` (§3.4) on the standard table. Slots refresh on a **Rest Site** short rest is *partial* (regain `⌈L_cast/2⌉` slot-levels worth); a Rest Site "long camp" event or a Hollow floor refreshes all.
- **Preparation:** Wizards prepare from a spellbook (found/bought spells expand it); Clerics/Druids/Paladins prepare from their full list; Sorcerers/Bards/Rangers/Warlocks know a fixed set.
- **Concentration:** one concentration spell at a time; taking damage → CON save `DC max(10, ½ damage)` or it drops.
- **Warlock exception:** few slots, all at max level, refresh on short rest (Rest Site).
- v1 spell list: ~8 cantrips, ~14 level-1, ~8 level-2, then design-for through level 5 spells for the `W=20` target. See [CONTENT.md](CONTENT.md).

---

## 6. Rests & recovery

| Where | Recovery |
|---|---|
| **After any floor** | `⌈¼ max HP⌉` free; remove `Bleeding`. |
| **Rest Site — short rest** | Spend Hit Dice (`1 die + CON mod` HP each, pool = total level, refreshes 1/floor); regain short-rest features (Second Wind, Action Surge, Warlock slots, Ki). |
| **Rest Site — long camp** (event choice) | Full HP, full slots, clear one non-permanent condition, but costs the "event" slot (no gear-swap / no training that visit). |
| **Hollow floor** | Full HP + slots, no cost. Rare, usually post-Boss. |
| **Downed & survived** | Stabilize at 1 HP, gain an **Injury** (DESIGN.md §5.5) — only removed at the Guild Infirmary. |
| **Level-up** | Heal to full (milestone mode only; a small carrot for hitting the cadence). |

---

## 7. Guild meta-progression (numbers)

Illustrative cost curve (Gold / Renown / Materials). Tune in sim.

| Track | Tier costs (Gold) | Gate |
|---|---|---|
| **Recruitment Hall** (`N` 3→8) | 150 / 400 / 900 / 1800 / 3200 | Renown gate on T4–5 |
| **Barracks** (`X` 3→6) | 600 / 2000 / 5000 | **Deepest-floor record** ≥ 6 / 11 / 16 |
| **Training Yard** (`W` 3→20) | 200 / 500 / 1100 / 2200 / 4000 / 7000 | Boss kills at Deep 5/10/15/20 for T4–6 |
| **Recruit Pedigree** | 250 / 700 / 1600 | — |
| **The Vault** (bank cap / interest) | 200 / 600 / 1400 / 3000 | — |
| **Infirmary** | 500 / 1500 | Barracks T1 |
| **Quartermaster** (stash 1→3) | 800 / 2500 | — |
| **Scrying Pool** | 400 / 1200 | — |
| **Memorial / Legacy Boons** | 600 / 1800 | 1 dead delver reached Deep 10 |
| **Black Market** | 500 | Renown 20 |
| **Champion's Rest** | 1000 / 3000 | 1 successful retirement |

**Renown** unlocks Charters (`0` start with 1, then `15 / 40 / 80 / 150 …`), Covenant ascension tiers, and cosmetics.

**Relics** (rare, from Bosses/Vaults/deep extractions) — pick 1 of 3 offered, permanent, global. ~15 in the pool, e.g.:
- *The Tithe-Breaker's Seal* — extraction tithe reduced to 0.
- *Coward's Bell* — one free party-wide Disengage per floor.
- *The Drowned Ledger* — banked gold earns 5%/run interest, but wipes cost you 10% of the bank.
- *Ninefold Contract* — draft pool always contains one guaranteed rare-race recruit.
- *The Last Torch* — the first delver to die each run leaves a ghost that fights for you until the next floor.
