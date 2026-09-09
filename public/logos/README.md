# Class crests

`<id>.webp` — 400px, transparent, gold emblem. One per D&D-style class:
artificer, barbarian, bard, cleric, druid, fighter, monk, paladin, ranger,
rogue, sorcerer, warlock, wizard.

**Live classes** (fighter/rogue/ranger/cleric) are also inlined as base64 into
the single-file artifact build — see `INLINE_CRESTS` in `vite.config.ts`; add to
that list when a class goes live.

## Regenerating

Source art is large navy/gold JPGs kept **outside** the repo. To rebuild:

```
python scripts/process-crests.py "<folder of source jpgs named Fighter.jpg, …>"
```

It downscales, keys the flat navy background to transparent (feathered), trims,
and writes `public/logos/<class>.webp`. Re-run after any source change and commit
the result.

The UI renders each as a navy "medallion" ([src/ui/crests.ts](../../src/ui/crests.ts));
if a file is missing the card falls back to the SVG role glyph.
