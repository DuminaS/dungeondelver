import { roleIcon } from "./icons";

/**
 * Class crest art ( public/logos/<id>.webp — gold emblem, transparent ).
 * Served from the assets dir for the hosted build; inlined as data URIs for
 * the single-file artifact build (see vite.config __CRESTS__).
 */
/** bump when the crest art is regenerated so caches refetch */
const CREST_REV = "3";

export function crestUrl(id: string): string {
  const inlined =
    typeof __CRESTS__ !== "undefined" && __CRESTS__ ? __CRESTS__[id] : null;
  return inlined ?? `${import.meta.env.BASE_URL}logos/${id}.webp?v=${CREST_REV}`;
}

/**
 * A crest "medallion": the class emblem over a navy roundel, with the SVG
 * role glyph underneath as a fallback if the image fails to load
 * (a delegated `error` listener in main.ts adds `.crest-img--dead`).
 */
export function crest(classId: string, size: "xs" | "sm" | "md" | "lg" | "xl" = "sm"): string {
  return `<span class="crest crest--${size}">${roleIcon(classId)}<img class="crest-img" src="${crestUrl(classId)}" alt="" loading="lazy" decoding="async"></span>`;
}

/** small inline crest for tight rows — falls straight back to the glyph */
export function crestInline(classId: string): string {
  return crest(classId, "xs");
}
