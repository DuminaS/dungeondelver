import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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
    },
    build: {
      outDir: single ? "dist-single" : "dist",
      target: "es2022",
      assetsInlineLimit: single ? 100_000_000 : 4096,
    },
    server: { port: 5173, open: true },
  };
});
