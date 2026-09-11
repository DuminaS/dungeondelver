/**
 * The Recruitment Market — a paid, targeted alternative to the free draft
 * roll. The draft still hands you random prospects for open roster slots at
 * no cost; the market lets you spend treasury gold to sign a *specific*
 * prospect outright, any time between runs (chase a class you're missing,
 * replace someone who just died, and so on).
 */
import { RNG } from "../core/rng";
import { ABILITIES, Character } from "./types";
import { makeCharacter } from "./character";
import { TRAITS } from "./data";

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
