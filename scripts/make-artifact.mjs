// Turns the Vite single-file build into a body-only HTML fragment suitable for
// publishing as a Claude Artifact (which supplies its own <!doctype>/<head>).
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync("dist-single/index.html", "utf8");

const styles = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const scriptTags = (src.match(/<script[\s\S]*?<\/script>/g) ?? []).map((s) =>
  s.replace(/\s+crossorigin/g, ""),
);

const titleMatch = src.match(/<title>([\s\S]*?)<\/title>/);
const title = titleMatch ? titleMatch[1] : "DEPTHDIVER";

const out = `<title>${title}</title>
<style>
${styles}
</style>
<div id="app"></div>
<div id="build-badge"></div>
${scriptTags.join("\n")}
`;

writeFileSync("dist-single/artifact.html", out);
console.log(`wrote dist-single/artifact.html (${(out.length / 1024).toFixed(1)} kB)`);
