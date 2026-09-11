/**
 * How a club fills its roster — there is no free blind draft any more.
 *
 * The Recruitment Market: spend treasury gold to sign a specific,
 * fully-rolled prospect outright — expensive but targeted (chase a role
 * you're missing, replace someone who just died with a known quantity).
 *
 * The Sump School (the club's youth academy): a cheap, always-available
 * fallback — every prospect it turns out is weaker than a market signing
 * (a lower stat floor, tightened further below the academy building's
 * level), but it's the one path that never dries up, and it's how a brand
 * new club with only its founding grant fields its first squad at all.
 */
import { RNG } from "../core/rng";
import { ABILITIES, Character } from "./types";
import { makeCharacter } from "./character";
import { TRAITS } from "./data";
import { RUN_CONFIG } from "./config";

export type Risk = "Low" | "Medium" | "High";

export interface MarketRecruit {
  character: Character;
  price: number;
  risk: Risk;
}

function priceFor(c: Character): number {
  const statSum = ABILITIES.reduce((s, k) => s + c.abilities[k], 0);
  const boons = c.traitIds.filter((id) => TRAITS[id]?.kind === "boon").length;
  const banes = c.traitIds.filter((id) => TRAITS[id]?.kind === "bane").length;
  const raw = (statSum - 60) * 7 + boons * 55 - banes * 25 + 90;
  return Math.max(50, Math.round(raw / 5) * 5);
}

function riskFor(c: Character): Risk {
  const banes = c.traitIds.filter((id) => TRAITS[id]?.kind === "bane").length;
  if (banes >= 2) return "High";
  if (banes === 1) return "Medium";
  return "Low";
}

/** a fresh page of purchasable prospects — call again (e.g. with a new rng fork) to "scout" a new page */
export function rollMarket(rng: RNG, count = 4): MarketRecruit[] {
  const out: MarketRecruit[] = [];
  for (let i = 0; i < count; i++) {
    const c = makeCharacter(rng.fork(`market:${i}`));
    out.push({ character: c, price: priceFor(c), risk: riskFor(c) });
  }
  return out;
}

export const ACADEMY_COST = 60;
const ACADEMY_MAX_LEVEL = 3;

/** how far below the current recruit floor an academy grad rolls at, by building level (0 = unbuilt) */
function academyFloor(academyLevel: number): number {
  const gap = ACADEMY_MAX_LEVEL + 1 - Math.min(academyLevel, ACADEMY_MAX_LEVEL); // 4..1
  return Math.max(1, RUN_CONFIG.statFloor - gap);
}

/** one cheap, deliberately weaker-than-market prospect straight out of the Sump School */
export function rollAcademyProspect(rng: RNG, academyLevel: number): MarketRecruit {
  const c = makeCharacter(rng.fork("academy"), { statFloor: academyFloor(academyLevel) });
  return { character: c, price: ACADEMY_COST, risk: riskFor(c) };
}
