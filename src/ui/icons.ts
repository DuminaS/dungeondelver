/**
 * One shared icon language for the whole UI (HUD, cards, draft, log).
 * Inline SVG, 24-unit grid, `currentColor` stroke — colour comes from the
 * surrounding text colour so an icon always matches its label/state.
 *
 * The board (canvas) has its own matching glyph drawers in render.ts —
 * a symbol on the board reads the same as the symbol in the panel.
 */

type IconName =
  | "hp" | "move" | "atk" | "def" | "rng" | "round"
  | "skull" | "downed" | "buff" | "debuff"
  | "poison" | "burn" | "prone" | "dodge" | "bless" | "bleed"
  | "loot" | "extract" | "hazard" | "threat"
  | "melee" | "ranged" | "support" | "star"
  | "dash" | "disengage" | "shove" | "check" | "x" | "chevron";

const P: Record<IconName, string> = {
  hp: '<path d="M12 20S4 14 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 11-8 11Z"/>',
  move: '<path d="M4 7l6 5-6 5M13 7l6 5-6 5"/>',
  atk: '<path d="M14 4l6 6M20 4l-9 9M4 20l4-1 3-3-3-3-3 3Z"/>',
  def: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>',
  rng: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/>',
  round: '<path d="M20 11a8 8 0 1 0-1 5M20 6v5h-5"/>',
  skull: '<path d="M12 3a8 8 0 0 0-5 14v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2a8 8 0 0 0-5-14Z"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M11 18h2"/>',
  downed: '<path d="M3 17h13a3 3 0 0 0 0-6M16 17l5 0M6 8l3 3"/>',
  buff: '<circle cx="12" cy="12" r="9"/><path d="M8 13l4-4 4 4"/>',
  debuff: '<circle cx="12" cy="12" r="9"/><path d="M8 11l4 4 4-4"/>',
  poison: '<path d="M12 20S4 14 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 5-8 11-8 11Z"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  burn: '<path d="M12 3c3 4 5 6 5 10a5 5 0 0 1-10 0c0-2 .8-3.4 2-4.5.2 2 1 3 2 3 0-4-3-5.5-1-8.5Z"/>',
  prone: '<path d="M3 16h13a3 3 0 0 0 0-6M16 16h5M6 7l3 3"/>',
  dodge: '<path d="M3 8h11a2 2 0 1 0-2-2M3 16h9a2 2 0 1 1-2 2M3 12h8"/>',
  bless: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
  bleed: '<path d="M12 21c-3.3 0-6-2.5-6-6 0-3 4-8 6-12 2 4 6 9 6 12 0 3.5-2.7 6-6 6Z"/>',
  loot: '<circle cx="12" cy="12" r="8"/><path d="M14 9.5A3 3 0 0 0 9 12a3 3 0 0 0 5 2.5"/>',
  extract: '<path d="M12 3v13M7 8l5-5 5 5M5 21h14"/>',
  hazard: '<path d="M12 3l9 16H3z"/><path d="M12 9v5M12 17h.01"/>',
  threat: '<path d="M5 5l14 7-14 7 3-7z"/>',
  melee: '<path d="M14 4l6 6M20 4l-9 9M4 20l4-1 3-3-3-3-3 3Z"/>',
  ranged: '<path d="M4 20A16 16 0 0 1 20 4M4 20 20 8M4 20l6-1M4 20l-1 1M11 4h9v9"/>',
  support: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
  star: '<path d="M12 3l2.5 6H21l-5 4 2 6.5-6-4-6 4 2-6.5-5-4h6.5z"/>',
  dash: '<path d="M3 12h13M11 6l6 6-6 6M19 5v14"/>',
  disengage: '<path d="M9 6L3 12l6 6M3 12h11M21 4v16"/>',
  shove: '<path d="M3 12h11M9 7l5 5-5 5M17 5v14M21 5v14"/>',
  check: '<path d="M4 12l5 6L20 5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
};

export function icon(name: IconName, cls = ""): string {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}

/** icon + value chip, e.g. stat("hp", "9/12", "warn") */
export function stat(name: IconName, value: string | number, tone = "", title = ""): string {
  return `<span class="stat ${tone ? "stat--" + tone : ""}"${title ? ` title="${title}"` : ""}>${icon(name)}<b>${value}</b></span>`;
}

/** map a status condition kind -> icon + tone */
export const CONDITION_ICON: Record<string, { icon: IconName; tone: string; label: string }> = {
  prone: { icon: "prone", tone: "warn", label: "Prone" },
  dodging: { icon: "dodge", tone: "player", label: "Dodging" },
  disengaged: { icon: "disengage", tone: "player", label: "Disengaged" },
  blessed: { icon: "bless", tone: "good", label: "Blessed" },
  poisoned: { icon: "poison", tone: "hazard", label: "Poisoned" },
  burning: { icon: "burn", tone: "warn", label: "Burning" },
  bleeding: { icon: "bleed", tone: "bad", label: "Bleeding" },
};

/** role glyph from a class id */
export function roleIcon(classId: string): string {
  if (classId === "ranger") return icon("ranged", "role");
  if (classId === "cleric") return icon("support", "role");
  return icon("melee", "role");
}

/** classify a combat-log line -> { icon, tone } for the feed */
export function logStyle(line: string): { icon: IconName | null; tone: string } {
  if (/^—\s*Round/.test(line)) return { icon: "round", tone: "divider" };
  if (/is (destroyed|killed)|is dead\.|The party is wiped|keeps them/i.test(line)) return { icon: "skull", tone: "bad" };
  if (/goes down!/i.test(line)) return { icon: "downed", tone: "bad" };
  if (/CRITS/.test(line)) return { icon: "atk", tone: "crit" };
  if (/\bhits\b.*for \d+/i.test(line)) return { icon: "atk", tone: "hit" };
  if (/misses/i.test(line)) return { icon: "atk", tone: "faint" };
  if (/heals|catches their breath|claws back|stabili/i.test(line)) return { icon: "hp", tone: "good" };
  if (/blessing|marks /i.test(line)) return { icon: "buff", tone: "buff" };
  if (/shoves|chasm|Sweep/i.test(line)) return { icon: "shove", tone: "warn" };
  if (/burning|fire|acid|gas|spores|choked/i.test(line)) return { icon: "hazard", tone: "hazard" };
  if (/spends their luck/i.test(line)) return { icon: "star", tone: "loot" };
  if (/cleared|Extraction reached/i.test(line)) return { icon: "check", tone: "good" };
  if (/opportunity|disengages|dashes|Dodge/i.test(line)) return { icon: "move", tone: "faint" };
  return { icon: null, tone: "" };
}
