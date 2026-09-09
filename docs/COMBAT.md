# Combat — the tactical layer

Companion to [../DESIGN.md](../DESIGN.md) §6. This is the rules spec the engine implements.

---

## 1. The hex grid

- **Coordinates:** cube coordinates `(q, r, s)` with `q + r + s = 0` internally; axial `(q, r)` for storage. Flat-top hexes.
- **Distance:** `(|dq| + |dr| + |ds|) / 2`.
- **Neighbors:** the 6 directions. No diagonals, no ambiguity — a core reason to use hexes over squares for a tactics game.
- **Grid size:** `W×H` where `W, H` scale with party size and floor type:
  - base `10×10`, `+1` per party member above 3, `+2..4` for Boss/Vault floors.
- **Generation:** see §7.

### Tile data

```
Tile {
  q, r
  elevation: 0..3
  terrain: Open | Difficult | Wall | Water | Chasm | Rubble
  hazard?: Hazard            // see §5
  feature?: Deploy | Extraction | Glyph | Chest | Lever | SpawnPoint | Cover
  occupant?: EntityId
  discovered: bool           // for hidden traps / fog floors
}
```

### Movement cost

| Situation | Cost (in "move points"; 1 hex of Speed = 1 point) |
|---|---|
| Enter Open, same elevation | 1 |
| Enter Difficult / Water / Rubble | 2 |
| Climb +1 elevation | +1 (in addition to terrain cost) |
| Descend elevation | free (drop of 2+ = fall, see §6) |
| Enter Wall / Chasm | impassable (Chasm enterable only via forced movement → fall) |
| Enter a hazard tile | terrain cost; hazard effect resolves on enter (§5) |
| Leave a hex threatened by an enemy | allowed, but provokes an **Opportunity Attack** reaction unless Disengaging |

Diagonal-free hexes mean no movement-cost fudging. A* pathfinding over the cost function above; ties broken by fewest hazard tiles, then straightest line.

---

## 2. Line of sight & cover

- **LOS:** supercover line between hex centers. Blocked by any `Wall` tile, or by any tile whose `elevation` is `≥ max(shooter.elev, target.elev) + 1` (a ridge between them).
- **Cover:**
  - **Half cover (+2 AC, +2 Dex saves):** target is adjacent to a Wall/Rubble/higher-elevation tile that sits between it and the attacker.
  - **Three-quarter cover (+5 AC):** two or more such blockers, or a `Lever`/`Chest`-type solid feature.
  - **Total cover:** no LOS, cannot be targeted directly (AoE templates can still catch the tile).
- **High ground:** attacker elevation `>` target elevation → ranged attacks have **advantage**; melee attacks get `+1` to hit. Target elevation `>` attacker by 2+ → attacker has **disadvantage** on ranged.
- **Vision / fog:** default floors are fully visible. `Darkness` modifier: vision radius `= 3 + WIS mod` per chaindiver, unioned; enemies outside vision don't show intent. Torches/light spells extend it.

---

## 3. Turn structure

1. **Deployment.** Player places party in the Deploy zone. Full board info visible.
2. **Roll initiative.** `d20 + DEX mod` per entity. Group identical enemy types can share one initiative (config) to speed play. Ties: higher DEX, then player-first.
3. **Round loop.** Entities act in initiative order. At the **start of each player entity's turn**, refresh all enemy **intent** markers (§8).
4. **On an entity's turn:** it has `Move`, `Action`, `Bonus Action` (see §4). It may interleave: e.g. move 2 → Action → move 3.
5. **Reactions** trigger between turns (Opportunity Attack, `Shield`, `Coward's Instinct`, prepared actions). One per entity per round.
6. **End of round:** hazard spread ticks (gas expands, fire spreads), timed objective counters advance, ongoing effects (burning, poison) tick on affected entities at the **start of their** turn.
7. **Objective check** after every entity's turn and at end of round.

### Conditions (v1 set)

`Prone` (melee adv vs you / ranged disadv vs you; costs ½ move to stand) · `Grappled` (speed 0) · `Restrained` (speed 0, attacks disadv, attacks vs you adv) · `Poisoned` (disadv attacks & checks) · `Frightened` (disadv while source in LOS, can't move closer) · `Stunned` (no actions, attacks vs you adv) · `Blinded` · `Burning` (Xd6 fire at start of turn, ends on save or Water) · `Blessed` (+1d4 attacks/saves) · `Marked` (attacker's bonus dmg) · `Bleeding` (flat dmg per turn, no save, ends at rest).

---

## 4. Action economy

### Move (once per turn, splittable)
Spend up to `Speed` move points (§1). Standing from Prone costs half your Speed. Difficult terrain / climbing per the cost table.

### Action (one of):
| Action | Effect |
|---|---|
| **Attack** | One weapon attack (more at higher level via Extra Attack). `d20 + prof + mod vs AC`; on hit, weapon damage + mod. Nat 20 = crit (double damage dice). Nat 1 = miss. |
| **Cast a Spell** | A spell with casting time = 1 action (see PROGRESSION.md for slots). |
| **Dash** | Gain move points equal to Speed. |
| **Disengage** | Movement doesn't provoke Opportunity Attacks this turn. |
| **Dodge** | Attacks against you have disadvantage; you have advantage on Dex saves. Until your next turn. |
| **Help** | Give an ally advantage on their next attack against an adjacent enemy, or on their next check. |
| **Shove** | Contested STR (Athletics) vs. STR/DEX: push target 1 hex (into a hazard/chasm if you want) or knock Prone. **Signature "environmental verb."** |
| **Grapple** | Contested check; target Grappled, moves with you at half speed. |
| **Interact (major)** | Disarm a trap, pick up/stow a large object, work a lever, free a caged ally, stabilize a downed ally (auto). |
| **Use Item** | Drink a potion, throw alchemist's fire / caltrops / a net, read a scroll. |
| **Ready** | Prepare an action with a trigger; it fires as a reaction. |
| **Salvage** | Strip an adjacent corpse/cache (Move + Action total). |

### Bonus Action (only if something grants one):
Class/subclass features (Second Wind, Cunning Action, Rage, Hunter's Mark, Healing Word, Misty Step, off-hand attack with two light weapons, etc.), some consumables, some traits.

### Reaction (one per round, off-turn):
Opportunity Attack (default, when an enemy leaves your melee reach without Disengaging) · `Shield` spell · Readied action · certain feats/traits.

### Free (no cost, reasonable limits):
Drop an item, speak, one "minor interact" (open an unlocked door, pull a torch from a sconce), swap which weapon is in hand once.

### Combo examples (the point of the system)

- **Rogue:** Move behind cover → **Action: Attack** (ally adjacent to target ⇒ Sneak Attack dice) → **Bonus: Cunning Action Disengage** → Move back out of reach. Hit-and-run with zero exposure.
- **Fighter + Wizard:** Fighter **Shoves** an ogre off a ledge for fall damage + Prone; Wizard **Firebolts** the Prone ogre (melee adv doesn't apply to ranged, but it's now in the open and low). Next turn Fighter **Action Surge**s two attacks into it.
- **Barbarian:** **Bonus: Rage** → **Action: Reckless Attack** (advantage, but attacks vs you have advantage too) → he's now a lightning rod that halves all physical damage, letting the squishies reposition freely.
- **Cleric:** **Bonus: Healing Word** a downed ally at range (they're up at 1 HP, Prone) → **Action: Sacred Flame** the enemy standing over them → **Move** to interpose. Three problems, one turn.
- **Ranger:** **Bonus: Hunter's Mark** on the boss → **Action: Volley** (all enemies in a radius) → the marked boss eats the bonus die too. Move to high ground for next turn's advantage.

---

## 5. Hazards

| Hazard | On enter / start of turn in it | Spread / duration |
|---|---|---|
| **Acid pool** | `1d6` acid, no save; `−1` AC for 1 round (armor pitting) | static |
| **Spike strip / caltrops** | `1d4` piercing on enter; if you Dash through, `2d4` + speed halved | static; caltrops are player-placeable |
| **Fire** | `1d6` fire on enter, Burning condition | spreads to adjacent flammable (Rubble w/ oil, Difficult=brush) 1 hex/round |
| **Poison gas cloud** | CON save DC 12 or Poisoned + `1d4`; blocks LOS through 2+ hexes of it | **expands 1 hex/round** up to a radius, then dissipates; wind modifier biases direction |
| **Collapsing floor** | telegraphed 1 round ahead (cracks), then becomes Chasm | one-time, chained sometimes |
| **Hidden trap** | Perception vs. DC to spot on approach; if triggered: dart `2d6` / net (Restrained) / pit (fall) / alarm (spawn) | one-time; can be **triggered onto enemies** by shoving them in or by an enemy pathing over it |
| **Summoning glyph** | if an entity ends turn on it, spawns a minion adjacent next round | destroyable (Action, or AoE) |
| **Freezing water / rime** | speed halved, DEX save or Prone; ranged fire dmg −half | static, some floors |

Hazards are first-class tactical tools: the **Shove** action, forced-movement spells, and bait AI all exist partly to weaponize them.

---

## 6. Falls & forced movement

- **Fall:** dropping `≥2` elevation levels, or being pushed off a ledge: `1d6` per level fallen (min 1d6), land Prone. Into a **Chasm**: if it's a marked *pit* (has a bottom) it's `3d6` + Prone + must climb out (Athletics, costs move); if **bottomless**, instant death (this is a real, telegraphed board threat).
- **Forced movement** (Shove, spells, some monster attacks) ignores movement cost and doesn't provoke, but *does* trigger hazard-on-enter effects and falls. `of the Anchor` gear and high STR (save) resist it.

---

## 7. Arena generation

Pipeline, seeded:

1. **Pick a template biome** for the depth band (Quarry, Flooded Vault, Bone Warren, Magma Gallery, Fungal Deep, Collapsed Library…). Sets terrain palette + hazard weights + tileset.
2. **Blockout:** generate elevation with layered noise, then carve **1–3 choke points** (guaranteed connectivity between deploy zone and objective, with at least one route that is *contested* — passes near high ground or a hazard).
3. **Place the objective** and its spatial twist (extraction behind a hazard; boss on the highest tile; survive-zone as the only tile safe from the planned gas expansion).
4. **Place enemies** against the depth budget: mix of melee/ranged/support/elite; ranged enemies biased to high ground / cover; a "reserve" group behind a choke for Slay-with-reinforcements.
5. **Scatter hazards** per biome weights, but **never** such that the *only* path is lethal without counterplay (validated: a "no-damage-possible" route or a shove/verb solution must exist).
6. **Place loot:** chests weighted toward danger (on high ground, past a hazard, guarded).
7. **Deploy zone:** 3–6 contiguous tiles at the "entrance", never adjacent to an enemy (unless `Ambush` modifier).
8. **Validate:** pathfind check, objective-reachable check, "fair route exists" check, no fully-sealed loot. Re-roll steps 4–6 up to K times, else fall back to a safe template.

Floor **modifiers** (visible + hidden) layer on after: `Darkness`, `Unstable ground` (more collapsing floor), `Elite pack`, `Rich veins` (extra loot + extra guards), `Thin air` (−1 max HP per level), `Blood moon` (enemies enrage at low HP), `Silence` (no verbal spellcasting), `Ambush` (enemies act first, deploy zone smaller).

---

## 8. Enemy AI

Utility-based, transparent. Each enemy archetype has a scored action set:

```
score(action) = Σ weight_i * consideration_i(state)
considerations: expected_damage, kill_secured, self_risk_after,
  ally_support_gained, objective_pressure, hazard_exposure_self,
  hazard_exposure_target, positioning_value (cover/highground/flank),
  focus_fire_bonus (target already damaged), threat_of_target
```

Archetype weight profiles:

| Archetype | Behavior |
|---|---|
| **Brute** | Rushes nearest/weakest, ignores self-risk, loves Shove-into-hazard. |
| **Skirmisher** | Attacks then retreats out of reach (kites), uses Disengage, targets backline. |
| **Archer / Caster** | Holds high ground + cover, focuses lowest effective HP, repositions if engaged in melee. |
| **Support / Shaman** | Buffs/heals allies, drops hazards (gas, glyphs), stays behind the line. |
| **Pack** (`#pack` tag) | Gains bonuses when adjacent to other pack members; coordinates focus fire; breaks and flees if pack is halved. |
| **Elite / Boss** | Multi-action, has a telegraphed "big move" every 2–3 turns (a 1-round windup the player can interrupt/avoid), phase changes at HP thresholds that alter the arena. |
| **Mindless** (oozes, skeletons) | Simplest: nearest target, straight line, always shows full intent. |

**Intent display:** at the start of the player's turn, each visible enemy shows a marker: move-path ghost + target reticle + "will do: Attack / Cast Gas / Charge (windup) / Reposition". `Cunning` archetypes hide intent when outside vision; `Mindless` always show. Bosses show their big-move windup 1 full round early with an unmistakable board warning.

**Fairness rule baked into AI:** an enemy will not path through a *bottomless* chasm-adjacent tile or a lethal hazard unless it secures a kill by doing so — mirrors what a decent player would risk.

---

## 9. Combat math reference (v1 tuning targets)

- Level-1 chaindiver: `~9–13` HP, AC `12–17`, `+4..+6` to hit, `~5–9` damage per hit.
- Level-1 trash enemy: `~7` HP, AC `12`, `+3` to hit, `~4` damage.
- **Target:** a balanced 3-chaindiver party clears a fair Floor-1 Slay in `4–6` rounds losing `~25–40%` of total HP and `0` chaindivers (if played well), `1` chaindiver (sloppy).
- Hit chance sweet spot: player attacks land `~65–75%` vs. trash, `~50–60%` vs. elites. Never design a "must-hit" turn without a fallback.
- Crit rate `~5%` base (nat 20), up to `~15%` for crit-fisher builds — crits should swing a fight, not end it outright at low level.
- **TTK guardrail:** no enemy at a given depth should be able to take a full-HP chaindiver of the expected level from 100→0 in a single turn without a telegraphed windup. Bursty deaths must be *seen coming*.
- Simulate: 10k headless encounters per depth band per patch; watch chaindiver-death-rate, round-count, and "unavoidable damage" distributions.
