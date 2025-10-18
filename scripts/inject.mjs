// scripts/inject.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync } from "fs";
import { dirname } from "path";

const SRC = ".";
const DIST = "dist";
mkdirSync(DIST, { recursive: true });

// 1) Αντέγραψε όλα τα static αρχεία/φακέλους στο dist (εκτός scripts & dist)
cpSync(SRC, DIST, { recursive: true, filter: (src) => {
  return !src.includes("/scripts/") && !src.includes("\\scripts\\") && !src.includes("/dist/");
}});

// 2) Κάνε replace στα HTML
const files = [
  `${DIST}/index.html`,
  `${DIST}/games/tap-reflex/index.html`
];

const repl = (str) =>
  str
    .replaceAll("__GA_MEASUREMENT_ID__", process.env.GA_MEASUREMENT_ID || "")
    .replaceAll("__ADSENSE_PUB__", process.env.ADSENSE_PUBLISHER_ID || "")
    .replaceAll("__ADSENSE_SLOT_HOME__", process.env.ADSENSE_SLOT_HOME || "")
    .replaceAll("__ADSENSE_SLOT_TAPREFLEX__", process.env.ADSENSE_SLOT_TAPREFLEX || "");

for (const f of files) {
  const html = readFileSync(f, "utf8");
  writeFileSync(f, repl(html), "utf8");
}
console.log("Injected env → dist/");
