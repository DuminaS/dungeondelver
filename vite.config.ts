import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/** class crests to inline as data URIs for the single-file artifact build */
const INLINE_CRESTS = [
  "fighter", "rogue", "ranger", "cleric", "barbarian", "paladin", "monk",
  "bard", "druid", "sorcerer", "warlock", "wizard", "artificer",
];

function crestData(single: boolean): string {
  if (!single) return "null";
  const out: Record<string, string> = {};
  for (const id of INLINE_CRESTS) {
    const p = new URL(`./public/logos/${id}.webp`, import.meta.url);
    if (existsSync(p)) out[id] = `data:image/webp;base64,${readFileSync(p).toString("base64")}`;
  }
  return JSON.stringify(out);
}

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "nogit";
  }
}

const buildStamp = new Date().toISOString().slice(0, 16).replace("T", " ");
const version = `v${pkg.version} · ${gitSha()} · ${buildStamp}Z`;

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    // GitHub Pages serves the repo at /dungeondelver/. The single-file build
    // (used for the hosted playtest artifact) is origin-root, so base "./".
    base: single ? "./" : "/dungeondelver/",
    plugins: single ? [viteSingleFile()] : [],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __CRESTS__: crestData(single),
    },
    build: {
      outDir: single ? "dist-single" : "dist",
      target: "es2022",
      assetsInlineLimit: single ? 100_000_000 : 4096,
    },
    server: { port: 5173, open: true },
  };
});
