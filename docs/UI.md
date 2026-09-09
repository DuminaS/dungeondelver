# UI language

The interface rule: **if it can be shown in one glance, don't make the player read it.** Board first, active unit second, threats third, secondary status fourth, prose last.

## Palette (one meaning per colour)

Tokens live in [`src/style.css`](../src/style.css) `:root`; the canvas mirrors them in [`src/ui/render.ts`](../src/ui/render.ts).

| Token | Hex | Means |
|---|---|---|
| `--bg` / `--bg-deep` | `#100c0a` / `#080605` | ground / board void |
| `--stone` / `--stone-2/3` | `#1b1410` … | panels, raised, pressed |
| `--iron` / `--iron-2` | `#3a2d24` / `#4b3a2d` | rules, edges |
| `--ink` / `--ink-dim` / `--ink-faint` | `#ece0cd` / `#a08c76` / `#6d5d4c` | text: primary / secondary / tertiary |
| `--player` | `#6ea6cc` | **player faction** — everything you control or can do |
| `--enemy` | `#c65a3a` | **enemy faction** — threats, their reach, their plans |
| `--gold` | `#d9a441` | loot, objects, extraction, **the active unit** |
| `--good` | `#86a758` | buffs, healthy HP, success |
| `--warn` | `#dc8a3a` | danger, low HP, burning |
| `--bad` | `#b0413b` | dying, death, debuffs |
| `--hazard` | `#8a76b4` | generic environmental |
| hazard tints | acid `#93a14f` · spikes `#9a9384` · fire `#d5713a` · gas `#9276b6` | each hazard = one colour, board + legend |

Never reuse a colour for an unrelated meaning. Contrast beats prettiness.

## Type

- **Display** — Cinzel (carved capitals): `h1` (page), unit names, turn banner.
- **Body** — Iowan/Palatino serif: paragraphs, card copy.
- **Utility** — system mono, `tabular-nums`: every number, every UPPERCASE label, seeds, the build badge.
- Uppercase labels get `letter-spacing: 0.1–0.18em`. Headings are `text-wrap: balance`.

## Icon language

One set, shared across board / HUD / cards / log ([`src/ui/icons.ts`](../src/ui/icons.ts)). A symbol on the board reads the same in a panel.

`hp` drop · `move` » · `atk` blade · `def` shield · `rng` target · `round` ↻ · `skull` dead · `downed` · `buff` / `debuff` chevron-in-ring · `poison` · `burn` · `prone` · `dodge` · `bless` · `bleed` · `loot` coin · `extract` ↑ · `hazard` ⚠ · `threat` ▸ · `melee`/`ranged`/`support` role · `star` · `dash`/`disengage`/`shove`/`check`/`x`/`chevron`.

Icons take `currentColor`, so an icon always matches the colour of its label/state. Numbers that matter keep their digits — icon **beside** the number, never instead of it.

## Label map — words replaced

| Was | Now |
|---|---|
| "Move 6 / Action / Bonus" text row | three **pips**: `» 6` · `ACT` · `BON` — lit = available, struck = spent |
| "Attack (click enemy)" | `⚔ Attack` (button) — or just click the enemy in the brackets |
| "Cunning: Disengage" | `↩ Disengage` with the class name in the tooltip |
| "AC 17 · Shortsword · attacks Kerr of the Rope" (card line) | `🛡17` chip + intent chip `⚔→K` |
| "Health Points 10/10" | `♥ 10/10` (tone = colour: good/warn/bad) |
| full stat sentence + 6-row grid | one `statrow` (`♥ ⛨ » ⚔`) + a 6-cell attr grid, cells coloured good/bad, primary underlined gold |
| class blurb paragraph in the pick list | card `title=` tooltip only |
| log run-on sentences | `icon + short fragment`, colour = outcome |

## Components

- **`.ucard`** (recruit / party) — left border = team; name (display) · role icon + race/class · `statrow` · attr grid · trait tags. No paragraphs.
- **`.turnbar`** — whose turn, round counter. Blue inset for player, rust for enemy.
- **`.active-panel`** — gold border. Name · condition glyph strip · `statrow` · pips · action grid (icon + 1 word) · feature grid · `End turn` / `✕`.
- **`.roster` `.urow`** — 3px team colour bar · name · HP bar (notched at 25/50%) · right rail: HP number (coloured) and, for enemies, the **intent chip** (`⚔→K` / `»→K`). Downed rows dim and collapse to `✝ down — n/3`.
- **`.log__line`** — leading icon, fragment, `t-*` colour class (`hit` ink · `crit` amber bold · `bad` wine · `good` moss · `buff` blue · `hazard` violet · `loot` gold · `faint` · `divider` for round breaks).

## Board (canvas)

| Layer | Treatment |
|---|---|
| terrain | subdued but distinct fills; elevation brightens the fill + a top-edge highlight + `▲`/`▲▲` tick |
| hazard | colour-tinted fill + soft radial glow + a **drawn glyph** (acid bubbles / spike teeth / flame / drifting dots) |
| move zone | translucent **blue** fill + thin boundary line around the reachable set |
| threatened | translucent **rust** fill + boundary line — every hex an enemy could reach *and* attack next turn |
| attackable enemy | four **red corner brackets** (not a full ring — less noise) |
| enemy intent | dashed rust line to target + thin **reticle** (ring + cross) on the target; a `!` / `»` badge on the enemy disc |
| active unit | gold radial glow, thick gold ring, gold roster bar + panel |
| unit | team-coloured disc + ring, display-face initial, notched HP bar under it, condition dots above |
| downed | desaturated disc, red skull glyph, no HP bar |
| hover / path | ivory hex outline; gold dashed path with an end dot |

A one-line legend sits under the board (move · attack · threatened · the four hazard swatches · high ground).
