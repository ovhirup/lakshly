// Generates lib/currencies.gen.ts and apps/apple/Lakshly/Components/Currencies.gen.swift
// from packages/shared/currency/currencies.json. Node stdlib only. Deterministic output (JSON key order, LF newlines).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const SRC = resolve(here, "../../../packages/shared/currency/currencies.json");
export const DEST_TS = resolve(here, "../lib/currencies.gen.ts");
export const DEST_SWIFT = resolve(here, "../../apple/Lakshly/Components/Currencies.gen.swift");

/** Validates the table and returns it. Throws on anything an app could not safely use. */
export function parse(json) {
  const data = JSON.parse(json);
  const codes = Object.keys(data.currencies);
  if (!codes.length) throw new Error("currencies.json: no currencies");
  const scalarKeys = Object.keys(data.currencies[codes[0]].magnitude).filter((k) => k !== "starterBudgets");
  for (const code of codes) {
    if (!/^[A-Z]{3}$/.test(code)) throw new Error(`bad currency code ${code}`);
    const c = data.currencies[code];
    if (!Number.isInteger(c.exponent) || c.exponent < 0 || c.exponent > 3) throw new Error(`${code}: bad exponent`);
    for (const k of ["symbol", "locale", "mask"]) if (typeof c[k] !== "string" || !c[k]) throw new Error(`${code}: missing ${k}`);
    const thresholds = c.compactUnits.map((u) => u[0]);
    if (thresholds.some((t, i) => !Number.isInteger(t) || (i && t >= thresholds[i - 1]))) throw new Error(`${code}: compactUnits must be integers, descending`);
    const keys = Object.keys(c.magnitude).filter((k) => k !== "starterBudgets");
    if (keys.join() !== scalarKeys.join()) throw new Error(`${code}: magnitude keys differ from ${codes[0]}`);
    for (const k of keys) if (!Number.isSafeInteger(c.magnitude[k]) || c.magnitude[k] <= 0) throw new Error(`${code}.${k}: must be a positive integer`);
    for (const [cat, amount] of c.magnitude.starterBudgets) if (!cat || !Number.isSafeInteger(amount) || amount <= 0) throw new Error(`${code}: bad starterBudgets`);
  }
  return { codes, scalarKeys, currencies: data.currencies };
}

export function render(json) {
  const { codes, currencies } = parse(json);
  return [
    "/* Generated from packages/shared/currency/currencies.json by scripts/gen-currencies.mjs. Do not edit. */",
    "",
    `export const CURRENCY_CODES = ${JSON.stringify(codes)} as const;`,
    "export type CurrencyCode = (typeof CURRENCY_CODES)[number];",
    "export type CurrencyMagnitude = {",
    ...Object.keys(currencies[codes[0]].magnitude).map((k) => `  ${k}: ${k === "starterBudgets" ? "readonly (readonly [string, number])[]" : "number"};`),
    "};",
    "export type CurrencyInfo = {",
    "  exponent: number; symbol: string; locale: string; mask: string;",
    "  /** Thresholds in MAJOR units, descending. */",
    "  compactUnits: readonly (readonly [number, string])[];",
    "  /** Amounts in MINOR units. */",
    "  magnitude: CurrencyMagnitude;",
    "};",
    `export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyInfo>> = ${JSON.stringify(currencies, null, 2)};`,
    "",
  ].join("\n");
}

const swiftString = (s) => JSON.stringify(s);
export function renderSwift(json) {
  const { codes, scalarKeys, currencies } = parse(json);
  const lc = (c) => c.toLowerCase();
  const lines = [
    "// Generated from packages/shared/currency/currencies.json by apps/web/scripts/gen-currencies.mjs. Do not edit.",
    "",
    "enum CurrencyCode: String, CaseIterable, Codable {",
    ...codes.map((c) => `  case ${lc(c)} = ${swiftString(c)}`),
    "}",
    "",
    "/// Amounts are integers in MINOR units (paise, cents).",
    "struct CurrencyMagnitude {",
    ...scalarKeys.map((k) => `  let ${k}: Int64`),
    "  let starterBudgets: [(category: String, amount: Int64)]",
    "}",
    "",
    "struct CurrencyInfo {",
    "  let exponent: Int",
    "  let symbol: String",
    "  let locale: String",
    "  let mask: String",
    "  /// Thresholds in MAJOR units, descending.",
    "  let compactUnits: [(threshold: Int64, suffix: String)]",
    "  let magnitude: CurrencyMagnitude",
    "}",
    "",
    "extension CurrencyCode {",
    "  var info: CurrencyInfo {",
    "    switch self {",
  ];
  for (const code of codes) {
    const c = currencies[code];
    lines.push(`    case .${lc(code)}:`);
    lines.push("      return CurrencyInfo(");
    lines.push(`        exponent: ${c.exponent}, symbol: ${swiftString(c.symbol)}, locale: ${swiftString(c.locale)}, mask: ${swiftString(c.mask)},`);
    lines.push(`        compactUnits: [${c.compactUnits.map(([t, s]) => `(${t}, ${swiftString(s)})`).join(", ")}],`);
    lines.push("        magnitude: CurrencyMagnitude(");
    for (const k of scalarKeys) lines.push(`          ${k}: ${c.magnitude[k]},`);
    lines.push(`          starterBudgets: [${c.magnitude.starterBudgets.map(([cat, a]) => `(${swiftString(cat)}, ${a})`).join(", ")}]`);
    lines.push("        )");
    lines.push("      )");
  }
  lines.push("    }", "  }", "}", "");
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const json = readFileSync(SRC, "utf8");
  writeFileSync(DEST_TS, render(json));
  writeFileSync(DEST_SWIFT, renderSwift(json));
  console.log("generated lib/currencies.gen.ts, Currencies.gen.swift");
}
