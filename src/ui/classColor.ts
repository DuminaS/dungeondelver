import { ClassId } from "../game/types";

/**
 * One accent per class — used as a left-rail/banner colour on cards, the
 * sheet, and Class Path lanes so a build reads at a glance even before you
 * read the text. Distinct from the app's semantic tokens (good/bad/warn) —
 * these are identity colours, not state colours.
 */
export const CLASS_COLOR: Record<ClassId, string> = {
  fighter: "#b6905f", // iron / bronze
  rogue: "#5f8a86", // slate blue-green
  ranger: "#8a9a4f", // moss / olive
  cleric: "#d7c27a", // gold / ivory
  barbarian: "#c1543c", // red / rust
  paladin: "#c3c9cf", // silver / white-gold
  monk: "#4f9b8e", // teal / jade
  bard: "#a1699c", // violet / rose
  druid: "#4f7a52", // forest green
  sorcerer: "#c1487a", // magenta / ember
  warlock: "#7b5a9e", // plum / purple
  wizard: "#4c78ad", // blue / cyan
  artificer: "#ab7642", // copper / steel
};

export function classAccent(id: ClassId): string {
  return CLASS_COLOR[id] ?? "#d9a441";
}
