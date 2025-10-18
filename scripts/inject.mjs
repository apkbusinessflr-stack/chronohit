// scripts/inject.mjs
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "fs";
import { resolve } from "path";

const SRC = ".";
const DIST = "dist";

// καθαρισμός & δημιουργία dist
try { rmSync(DIST, { recursive: true, force: true }); } catch {}
mkdirSync(DIST, { recursive: true });

// αντιγραφή όλων (εκτός scripts/ & dist/)
cpSync(SRC, DIST, {
  recursive: true,
  filter: (src) => {
    const p = src.replaceAll("\\", "/");
    if (p.includes("/scripts/")) return false;
    if (p.endsWith("/scripts")) return false;
    if (p.includes("/dist/")) return false;
    if (p.endsWith("/dist")) return false;
    return true;
  }
});

// λίστα html προς έγχυση
const files = [
  `${DIST}/index.html`,
  `${DIST}/games/tap-reflex/index.html`
];

// αντικατάσταση placeholders με envs
const repl = (s) =>
  s
    .replaceAll("__GA_MEASUREMENT_ID__", process.env.GA_MEASUREMENT_ID || "")
    .replaceAll("__ADSENSE_PUB__", process.env.ADSENSE_PUBLISHER_ID || "")
    .replaceAll("__ADSENSE_SLOT_HOME__", process.env.ADSENSE_SLOT_HOME || "")
    .replaceAll("__ADSENSE_SLOT_TAPREFLEX__", process.env.ADSENSE_SLOT_TAPREFLEX || "");

for (const f of files) {
  const html = readFileSync(f, "utf8");
  writeFileSync(f, repl(html), "utf8");
}

console.log("Injected env → dist/");
