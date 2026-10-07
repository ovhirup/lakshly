// Currency table helpers. All money in Lakshly is an integer in minor units (paise, cents).
// Facts come from packages/shared/currency/currencies.json via lib/currencies.gen.ts. Work from `exponent`; never assume 2.
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode, type CurrencyInfo } from "./currencies.gen";

export { CURRENCY_CODES };
export type { CurrencyCode, CurrencyInfo };

export function isCurrencyCode(code: string): code is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(code);
}

/** The table row for a supported currency. Throws on an unsupported code so a wrong currency can never fall back silently. */
export function currencyInfo(code: string): CurrencyInfo {
  if (!isCurrencyCode(code)) throw new Error(`Unsupported currency: ${code}`);
  return CURRENCIES[code];
}

/** Minor units per major unit (100 for INR and USD). */
export function minorFactor(code: string): number {
  return 10 ** currencyInfo(code).exponent;
}

/**
 * Major units to minor units, exactly. Prefer a decimal string ("1234.56"): it is parsed without floating point.
 * A number is accepted for convenience and goes through toFixed(exponent). More fraction digits than the
 * currency allows is an error unless the extra digits are all zero.
 */
export function toMinor(major: string | number, code: string): number {
  const { exponent } = currencyInfo(code);
  const text = typeof major === "number" ? (Number.isFinite(major) ? major.toFixed(exponent) : "") : major.trim();
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) throw new Error(`Not a decimal amount: ${String(major)}`);
  const [, sign, whole, frac = ""] = m;
  const extra = frac.slice(exponent);
  if (/[^0]/.test(extra)) throw new Error(`Too many decimal places for ${code}: ${String(major)}`);
  const minor = Number(whole + frac.slice(0, exponent).padEnd(exponent, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error(`Amount out of range: ${String(major)}`);
  return sign === "-" && minor !== 0 ? -minor : minor;
}

/** Minor units to a major-unit number. For display maths only; keep stored money in minor units. */
export function fromMinor(minor: number, code: string): number {
  return minor / minorFactor(code);
}
