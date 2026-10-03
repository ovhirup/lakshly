// Generates lib/entitlements.gen.ts from packages/shared/entitlements.json.
// Node stdlib only. Deterministic output (stable key order, LF newlines).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/shared/entitlements.json");
const dest = resolve(here, "../lib/entitlements.gen.ts");

export function render(json) {
  const data = JSON.parse(json);
  const ids = Object.keys(data.features).sort();
  const features = Object.fromEntries(ids.map((id) => [id, data.features[id]]));
  return [
    "/* Generated from packages/shared/entitlements.json by scripts/gen-entitlements.mjs. Do not edit. */",
    "",
    `export const TIERS = ${JSON.stringify(data.tiers)} as const;`,
    `export const PRICES = ${JSON.stringify(data.prices, null, 2)} as const;`,
    `export const FEATURE_IDS = ${JSON.stringify(ids, null, 2)} as const;`,
    "export type FeatureId = (typeof FEATURE_IDS)[number];",
    "export type FeatureSpec = { minTier: \"free\" | \"premium\" | \"superUser\"; label: string; limits?: Partial<Record<\"free\" | \"premium\" | \"superUser\", number | null>> };",
    `export const FEATURES: Readonly<Record<FeatureId, FeatureSpec>> = ${JSON.stringify(features, null, 2)};`,
    `export const FREE_BILL_OF_RIGHTS: readonly FeatureId[] = ${JSON.stringify(data.freeBillOfRights)};`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(dest, render(readFileSync(src, "utf8")));
  console.log("generated lib/entitlements.gen.ts");
}
