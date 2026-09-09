# Content tables

Companion to [../DESIGN.md](../DESIGN.md). These are v1 content sets sized for a vertical slice, with "design-for" targets noted. Everything here is **data** — the engine loads it from JSON/TS tables so it can be balanced, expanded, and eventually modded.

---

## 1. Races

Weighted draft table. Rarer races carry stronger, narrower identity.

| Race | Weight | Ability mods | Speed | Traits / features |
|---|---|---|---|---|
| **Human** | 30 | `+1` to three different scores (engine picks class-relevant) | 6 | 1 free minor trait; +1 skill. The safe, flexible pick. |
| **Dwarf** | 16 | `+2 CON, +1 WIS` | 5 | Poison resistance; no speed penalty from heavy armor; darkvision; `+2` saves vs. being moved. |
| **Elf** | 16 | `+2 DEX, +1 INT` | 7 | Darkvision; advantage vs. Frightened/charm; can't be surprised while conscious; `Trance` (short rest in ½ time). |
| **Half-Orc** | 12 | `+2 STR, +1 CON` | 6 | **Relentless:** first time you'd drop to 0 each floor, drop to 1 instead; crits add one weapon die; `+2` intimidation. |
| **Halfling** | 10 | `+2 DEX, +1 CHA` | 5 | **Lucky** (reroll nat 1s on attacks/checks/saves); advantage vs. Frightened; can move through larger creatures' hexes. |
| **Goliath** | 6 | `+2 STR, +1 CON` | 6 | Once/floor reduce a hit by `2d6+level`; carry capacity ×2; no penalty for cold; counts as one size larger for Shove/Grapple. |
| **Tiefling** | 5 | `+2 CHA, +1 INT` | 6 | Fire resistance; `Firebolt`-equivalent cantrip; darkvision; at L3 free `Hellish Rebuke` 1/floor. |
| **Ratfolk / Skaven** | 3 | `+2 DEX, +1 INT, −1 STR` | 7 | **Pack Tactics:** advantage on attacks vs. any enemy adjacent to one of your allies; `+2` to disengage-y checks; small (as Halfling movement). |
| **Revenant** (unlocked) | 2 | `+1 CON, +1 STR, +1 WIS` | 6 | Doesn't eat/sleep/breathe (ignores gas suffocation, not damage); when downed, rolls death saves at advantage; **can't be healed above ½ max HP** by magic (only rest). |
| **Deepkin** (unlocked) | 1 | `+2 WIS, +1 CON, −1 CHA` | 6 | Blindsight 3 (ignores Darkness/Blinded within 3); the Deep's hazards deal half to you; surface Markets charge you double. |

**Design-for:** ~14 races. Add Gnome, Aasimar, Kobold, Firbolg.

---

## 2. Classes (v1 feature tables to L5; design-for L20)

Notation: **hit die** / saves / armor+weapons / skills. Then per-level features.

### Fighter — d10
Saves: STR, CON. All armor + shields, all weapons. 2 skills from a martial list.

| Lvl | Features |
|---|---|
| 1 | **Fighting Style** (Archery `+2` ranged hit / Defense `+1` AC / Great Weapon / Dueling / Two-Weapon / Protection); **Second Wind** (bonus action, `1d10+lvl` HP, 1/short rest). |
| 2 | **Action Surge** (1 extra Action, 1/short rest). |
| 3 | **Subclass:** Champion (crit on 19–20; ungated) / Battle Master (3 maneuver dice, pick 3 maneuvers; ungated) / Eldritch Knight (INT 13 or Arcane Dabbler trait; 1/3 caster) / Rune Knight (Str 13 or Giantblood trait). |
| 4 | ASI/Feat. |
| 5 | **Extra Attack** (2 attacks per Attack action). |
| →20 | ASI 6/8/12/14, Extra Attack 3 at 11, Indomitable, Extra Attack 4 + capstone at 20. |

### Rogue — d8
Saves: DEX, INT. Light armor, finesse/light weapons, hand crossbow. 4 skills + Expertise.

| Lvl | Features |
|---|---|
| 1 | **Sneak Attack** `1d6` (once/turn, when you have advantage OR an ally is adjacent to the target and you don't have disadvantage); **Expertise** (double prof on 2 skills); Thieves' tools. |
| 2 | **Cunning Action** (bonus action: Dash / Disengage / Hide). |
| 3 | Sneak Attack `2d6`; **Subclass:** Thief (fast hands: bonus-action Interact/Use Item; ungated) / Assassin (Stealth prof + Criminal bg or Cold-Blooded trait; auto-crit vs. surprised, advantage on first turn) / Arcane Trickster (INT 13 or Arcane Dabbler; 1/3 caster, mage hand legerdemain). |
| 4 | ASI/Feat. |
| 5 | Sneak Attack `3d6`; **Uncanny Dodge** (reaction: halve one hit). |
| →20 | SA scales to `10d6` at 19; Evasion 7, Reliable Talent 11, Blindsense 14, Slippery Mind 15, capstone 20. |

### Wizard — d6
Saves: INT, WIS. No armor, daggers/darts/slings/quarterstaff. 2 skills (arcana-ish).

| Lvl | Features |
|---|---|
| 1 | **Spellcasting** (spellbook; prepare INT-mod + level; 3 cantrips, 2 slots L1); **Arcane Recovery** (short rest: recover slots totaling ½ level, 1/floor). |
| 2 | **Subclass (Arcane Tradition):** Evocation (sculpt spells — allies auto-succeed & take no damage from your AoE; ungated) / Abjuration (arcane ward soaks damage; ungated) / Divination (Portent: replace 2 rolls/floor with pre-rolled d20s; INT 15 or Seer trait) / Necromancy (grim harvest; via Shrine or Marked by the Deep trait). |
| 3 | 2nd-level slots; 4 cantrips. |
| 4 | ASI/Feat; 3rd cantrip damage bump. |
| 5 | 3rd-level slots. |
| →20 | Slots per standard table; subclass features 6/10/14; Spell Mastery 18, Signature Spells; capstone 20 (regain 4 slot-levels on init). |

### Cleric — d8
Saves: WIS, CHA. Light/medium armor + shields, simple weapons. 2 skills (religion/medicine/insight/history/persuasion).

| Lvl | Features |
|---|---|
| 1 | **Spellcasting** (WIS; prepare WIS-mod + level from full list; 3 cantrips); **Divine Domain** at 1 (subclass): Life (heal `+2+spell lvl`; heavy armor; ungated) / War (bonus-action attack when you cast; martial weapons; STR or DEX 13 or Soldier bg) / Light (warding flare; free Faerie Fire 1/floor; ungated) / Death (only via Shrine / Marked by the Deep). |
| 2 | **Channel Divinity** 1/short rest: **Turn Undead** + a domain option. |
| 3 | 2nd-level slots. |
| 4 | ASI/Feat. |
| 5 | 3rd-level slots; **Destroy Undead** CR ½. |
| →20 | Domain features 6/8/17; Channel Divinity 2×/3× at 6/18; Divine Intervention 10/20. |

### Ranger — d10
Saves: STR, DEX. Light/medium armor + shields, all weapons. 3 skills (nature/survival/perception/stealth/animal…).

| Lvl | Features |
|---|---|
| 1 | **Favored Quarry** (bonus action mark 1 enemy: `+1d6` dmg to it, advantage to track; re-mark on kill, 2/floor); **Deep Sense** (advantage on initiative & to notice hazards). |
| 2 | **Spellcasting** (½-caster, WIS); **Fighting Style** (Archery / Defense / Two-Weapon). |
| 3 | **Subclass (Conclave):** Hunter (Colossus Slayer `+1d8` vs. hurt / Horde Breaker extra attack vs. adjacent group / Volley; ungated) / Beast Master (a beast companion acts on your turn; Animal Handling prof) / Gloom Stalker (invisible in darkness, `+3` init, extra attack turn 1; darkvision race or Deepkin/Deep-touched trait). |
| 4 | ASI/Feat. |
| 5 | **Extra Attack**. |
| →20 | Quarry uses scale; Conclave features 7/11/15; Feral Senses 18; capstone 20. |

### Barbarian — d12
Saves: STR, CON. Light/medium armor + shields, all weapons. 2 skills (athletics/perception/survival/intimidation/nature/animal).

| Lvl | Features |
|---|---|
| 1 | **Rage** (bonus action; `+2` melee dmg, resistance to bludgeoning/piercing/slashing, advantage on STR checks/saves; 2/floor; ends if you don't attack/take damage in a round); **Unarmored Defense** (`10 + DEX + CON` when no armor). |
| 2 | **Reckless Attack** (advantage on your STR attacks this turn, attacks vs you have advantage until your next turn); **Danger Sense** (advantage on DEX saves vs. things you can see — traps!). |
| 3 | **Subclass (Path):** Berserker (Frenzy: bonus-action attack while raging, gain 1 Exhaustion after; ungated) / Totem Warrior (Bear = resistance to ALL but psychic while raging; Nature/Survival, a Shrine ritual) / Ancestral Guardian (enemies you hit have disadvantage vs. others; ungated) / Storm Herald (aura damage; a storm-touched trait). |
| 4 | ASI/Feat. |
| 5 | **Extra Attack**; **Fast Movement** `+2` Speed (no heavy armor). |
| →20 | Rage uses & damage scale; Path features 6/10/14; Brutal Critical 9/13/17; Relentless Rage 11; capstone 20 (`+4 STR/CON`, 24 cap). |

**Design-for classes:** Paladin (d10, auras, smite, Oath subclasses via trait/stat gates), Monk (d8, Ki, Martial Arts, unarmored movement, Way subclasses), Sorcerer (d6, Metamagic, Origin at 1), Warlock (d8, Pact + Invocations, short-rest slots, Patron at 1), Bard (d8, Bardic Inspiration, College at 3, Jack of All Trades), Druid (d8, Wild Shape at 2, Circle at 2).

---

## 3. Traits (v1 ~30; design-for ~120)

Budget: each recruit rolls a trait point total (`0–6`, weighted low); minor = 1, major = 2, defining = 3 (and always adds a drawback worth ~1).

### Passive stat
- **Ironhide** (minor) — `+2` max HP/level, `−1` Speed.
- **Fleet** (minor) — `+1` Speed.
- **Thick Skull** (minor) — advantage vs. Stunned; `−1` INT.
- **Keen-Eyed** (minor) — `+2` Perception & ranged to-hit vs. targets 4+ hexes away.
- **Giantblood** (major) — count as one size larger (Shove/Grapple/carry); `−1` AC (big target).
- **Wiry** (minor) — `+1` DEX, `−1` STR.

### Passive conditional
- **Bloodscent** (major) — `+2` hit & `+1d6` dmg vs. enemies below ½ HP.
- **Last Stand** (major) — while you're the only conscious ally within 4 hexes: `+2` AC, `+2` to hit, advantage on saves.
- **Cave Instinct** (minor) — `+2` AC in Darkness / while adjacent to a Wall.
- **Coward** (minor, drawback-ish) — `+2` AC while no enemy is adjacent; `−2` to hit while 2+ enemies are adjacent.
- **Zealot** (major) — `+1d4` dmg while above ¾ HP; `−1` all saves while below ¼.

### Triggered
- **Coward's Instinct** (minor) — first time below 25% HP each floor: free Disengage + half move.
- **Vengeful** (minor) — when an ally within 3 hexes is downed: `+2` hit & `+1d6` dmg for 2 rounds.
- **Second Wind (natural)** (major) — 1/floor, bonus action, heal `1d10 + level`.
- **Adrenaline** (major) — first time you drop a target to 0 each encounter: gain a bonus action this turn.
- **Brittle Bones** (defining drawback) — you take `+1` damage per hit from any source. *(Pairs with strong offense rolls.)*

### Granted ability
- **Pyromaniac** (defining) — gain **Immolate** (bonus action, `2d6` fire in a 1-hex radius incl. allies); `−2` saves vs. fire.
- **Grappler** (major) — gain **Chokehold** (bonus action grapple attempt; grappled targets also Restrained).
- **Field Medic** (major) — gain **Patch** (Action, adjacent ally heals `1d8 + your WIS`, 2/floor); works even on downed without a check.
- **Duelist's Riposte** (major) — reaction: when an adjacent enemy misses you in melee, free weapon attack back.
- **Tunnel Sense** (minor) — gain **Read the Stone** (Action, reveal all hidden traps/hazards within 5 hexes).

### Drawback (usually attached to defining traits)
- **Doomed** — auto-dies when reduced to being the last living delver.
- **Bloodlust** — must attack the nearest enemy if any is within Move+reach (no Dodge/Help/Disengage while an enemy is visible).
- **Frail** — `−3` max HP/level.
- **Greenhorn** — `−2` initiative; disadvantage on the first save you make each encounter.
- **Marked by the Deep** — enemies with `#deep`/`#undead` tags target you first; **but** unlocks Death/Necromancy subclasses and `+1` WIS.
- **Kleptomaniac** — must spend an Action to loot any chest/cache within reach before doing anything else that turn.

### Quirk (economy / meta flavor with an edge)
- **Lucky** (major) — 1/floor reroll any one die (yours, or an enemy's vs. you).
- **Debt-Bonded** (quirk) — free to draft; Guild skims 20% of this delver's personal loot — **you keep it even on a wipe**.
- **Heirloom Bearer** (quirk) — start with a random uncommon weapon; it auto-salvages on your death (can't be left on the floor).
- **Glory Hound** (quirk) — `+50%` Renown from kills you personally land; `−2` to hit while an ally is adjacent (won't share).
- **Deserter's Eyes** (quirk) — always knows where the current floor's Extraction/exit is; `−1` to hit on the turn you move away from it.
- **Cheap Date** (quirk) — Market prices `−25%` for this delver's gear; refuses to carry more than 2 salvage slots.

---

## 4. Backgrounds (v1 ~8)

| Background | Skill profs | Perk |
|---|---|---|
| **Soldier** | Athletics, Intimidation | Start with a shield or a martial weapon; counts as meeting some War/Battle subclass gates. |
| **Urchin** | Stealth, Sleight of Hand | `+1` Speed in the first round of any encounter; ignore difficult terrain from rubble. |
| **Acolyte** | Religion, Insight | 1 free Cleric cantrip (WIS); meets some Cleric/Paladin gates. |
| **Charlatan** | Deception, Persuasion | Once/run, reroll a Market's stock; better event outcomes on social choices. |
| **Miner** | Athletics, Survival | Sees hidden collapsing-floor tiles 1 round earlier; `+2` vs. being buried; finds `+1` Materials per floor. |
| **Disgraced Noble** | History, Persuasion | Start with `+50` gold; the retirement bonus is `+15%` for a party containing this delver. |
| **Sage** | Arcana, Investigation | Counts as `Arcane Dabbler` for subclass gates; identifies gear properties for free. |
| **Hunter** | Survival, Perception | Advantage on initiative; `+1d6` on the first ranged attack each encounter. |

---

## 5. Monsters (v1)

Per depth band. Stat shorthand: `HP / AC / +hit / dmg / Speed / archetype`. Tags in `#`.

### Deep 1–3 (tier 1)
| Monster | Stats | Notes |
|---|---|---|
| **Pit Rat Swarm** | 6 / 12 / +4 / 1d4 / 6 / Mindless `#pack` | Splits into 2 half-swarms once when first bloodied. |
| **Scavenger** (humanoid) | 8 / 12 / +3 / 1d6+1 / 6 / Brute | Flees at <25% HP toward a SpawnPoint; if it reaches one, +1 Scavenger next round. |
| **Cutpurse** | 7 / 13 / +4 / 1d4 (+1d6 if you have an ally adjacent — their sneak) / 7 / Skirmisher | Steals 1 gold on hit; drops it on death. |
| **Cave Slinger** | 6 / 12 / +4 / 1d6 (range 6) / 5 / Archer | Sits on high ground; repositions if meleed. |
| **Fungal Thrall** | 10 / 11 / +3 / 1d6 + CON save or Poisoned / 4 / Mindless `#deep` | On death: bursts a small poison cloud (§ hazard). |
| **Houndmaster** (elite) | 16 / 14 / +5 / 1d8+2 / 6 / Support | Buffs adjacent beasts (+2 hit); arrives with 2 Rime Pups. |

### Deep 4–7 (tier 2)
| Monster | Stats | Notes |
|---|---|---|
| **Rime Hound** | 14 / 13 / +5 / 2d6 + DEX save or Prone / 8 / Brute `#pack` | Pack: +1 hit per adjacent hound. Fast — hard to kite. |
| **Bone Archer** | 12 / 13 / +5 / 1d8+2 (range 8) / 6 / Archer `#undead` | Ignores half cover; reassembles once (revives at 6 HP 2 rounds after death) unless a hex of fire/holy is on its bones. |
| **Gloom Stalker** (humanoid) | 20 / 15 / +6 / 2×(1d8+3) / 7 / Skirmisher | Invisible until it attacks; shows intent only within vision. |
| **Ooze, Grey** | 26 / 8 / +4 / 1d10 acid + armor −1 / 3 / Mindless | Immune to Prone/crit; splits on slashing hits; leaves an acid trail hazard. |
| **Deep Shaman** | 18 / 13 / +5 / 1d6 / 5 / Support `#deep` | Casts the expanding poison cloud; drops summoning glyphs; must be focused. |
| **Gladiator, Chained** (elite) | 34 / 16 / +7 / 2×(2d6+4), Shove rider / 6 / Elite | Every 3rd turn: telegraphed **Sweep** (all adjacent, `3d6` + Prone). A "pit champion" — appears on Gladiator Pit floors. |

### Deep 8+ (tier 3) — samples
| Monster | Stats | Notes |
|---|---|---|
| **Abyssal Maw** | 55 / 15 / +8 / 3d8 swallow (Restrained, `2d6`/turn until STR save) / 5 / Elite `#deep` | Board-controlling; swallowed delver is out of position and taking damage. |
| **Wraith of the Ledger** | 44 / 16 / +8 / 2d8 necrotic + max HP reduction / 8 / Skirmisher `#undead` | Phases through Walls; drains banked-gold-per-hit as a flavor threat (steals in-run gold). |
| **The Warden** (Deep 5 boss) | 120 / 17, 3 phases | P1: shield-wall + adds; P2 (66%): arena floods, low tiles become Water; P3 (33%): shatters cover, gains Sweep + a 1-round "execute" windup on the lowest-HP delver. |

**Design-for:** ~10 monsters/tier through tier 5, plus 4 hand-authored bosses (Deep 5/10/15/20) and a procedural boss assembler beyond.

---

## 6. Floor types (recap + generation params)

See [../DESIGN.md](../DESIGN.md) §7 for the full list. Generation-relevant params:

| Type | Objective pool | Size mod | Enemy budget mod | Loot tier | Guaranteed features |
|---|---|---|---|---|---|
| Combat | Slay / Survive / Extract / Escort / Hold | — | ×1.0 | normal | — |
| Elite / Gladiator Pit | Slay(boss) + baked bonus objective | `+1` | ×1.3, 1 elite | +1 tier | 1 elite, 2 chests |
| Boss | bespoke | `+3` | bespoke | +2 tier + Relic roll | multi-phase arena |
| Rest Site | none | small | 0 | — | camp/gear/train/short-rest node |
| Market | none | small | 0 | — | vendor with `5 + depth/2` stock slots |
| Extraction | none (menu) | small | 0 | — | extraction pad, vault terminal |
| Vault | grab-and-run timer / hazard gauntlet | `+2` | ×0.6 | +2 tier | collapse timer, 3–4 high chests |
| Shrine / Event | choice node | tiny | 0 | varies | the bargain UI |
| Hollow | none | — | 0 | — | full-heal tiles |

---

## 7. Loot (v1)

### Weapons (base → rarity riders)
Dagger `1d4` finesse light thrown · Shortsword `1d6` finesse light · Longsword `1d8` (`1d10` two-handed) · Greataxe `1d12` two-handed · Warhammer `1d8` · Rapier `1d8` finesse · Shortbow `1d6` range 8 · Longbow `1d8` range 12 two-handed · Hand crossbow `1d6` range 6 light · Quarterstaff `1d6` (`1d8` two-handed) · Halberd `1d10` reach two-handed · Spear `1d6` reach thrown.

Rarity riders (roll 1): **Keen** (crit on 19–20) · **Vicious** (`+1d6` on crit) · **Reach** (adds reach) · **Vampiric** (heal ½ damage dealt, `1/round`) · **Thundering** (on hit, Shove 1 hex, STR save negates) · **Frost** (`+1d4` cold, speed −2 on hit) · **of the Anchor** (wielder immune to forced movement) · **Heavy** (`+2` dmg, `−1` hit) · **Executioner's** (`+1d8` vs. targets below ¼ HP).

### Armor
Padded/Leather (`11 + DEX`) · Studded (`12 + DEX`) · Hide (`12 + DEX max 2`) · Chain shirt (`13 + DEX max 2`) · Breastplate (`14 + DEX max 2`) · Half-plate (`15 + DEX max 2`, stealth disadv) · Ring mail (`14`, stealth disadv) · Chain mail (`16`, STR 13, stealth disadv) · Plate (`18`, STR 15, stealth disadv). Shield `+2`.
Riders: **Sturdy** (resist first crit each floor) · **Feathered** (no stealth disadv, `+1` Speed) · **Warded** (`+1` all saves) · **Spiked** (attackers who hit you in melee take `1d4`) · **of Second Breath** (once/floor, when downed, stand at `1d10` HP instead).

### Trinkets (2 slots)
Ring of Protection (`+1` AC & saves) · Cloak of the Bat (Speed `+2`, fall damage halved) · Amulet of the Deep (immune to gas Poison) · Bloodstone (`+1d4` dmg while below ½ HP) · Boots of the Skirmisher (ignore the first difficult-terrain hex each turn) · Lucky Coin (1/floor reroll a save) · Salvager's Gloves (Salvage costs only an Action, not Move+Action) · Torch-Bearer's Brand (you and adjacent allies ignore Darkness).

### Consumables
Healing draught (`2d4+2`, Action) · Greater healing (`4d4+4`) · Alchemist's fire (thrown, `2d6` fire + Burning) · Caltrops (place a 1-hex hazard) · Smoke bomb (2-hex LOS-block cloud, 3 rounds) · Antitoxin (end/prevent Poisoned, 10 min) · Oil flask (coat a hex/weapon; ignites for `+2d6`) · Scroll of *Misty Step* / *Bless* / *Shield* / *Grease* · Revive token (Market/Boss only — restore a downed ally to ½ HP; consumed) · Rope & piton (auto-succeed one climb/pit escape).

### Cursed (Black Market / Shrine)
Berserker's Chain (`+3` dmg, can't Dodge/Disengage/retreat) · The Hungering Blade (`+1d8` on hit, `1d4` to you each turn you don't kill something) · Coinbleed Ring (`+2` all stats, lose 10 gold/floor) · Mask of the Drowned (Blindsight 4, but you're always considered Frightened of `#deep` bosses). Can't be removed without a Market/Shrine service.
