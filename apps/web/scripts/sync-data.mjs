// Copies the shared SYNTHETIC demo dataset into the web app (no network, no real data).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../demo-data/sample.synthetic.json");
const dest = resolve(here, "../data/sample.synthetic.json");
mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("synced synthetic demo data ->", "data/sample.synthetic.json");
