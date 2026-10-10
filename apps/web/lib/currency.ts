// Currency table helpers. All money in Lakshly is an integer in minor units (paise, cents).
// Facts come from packages/shared/currency/currencies.json via lib/currencies.gen.ts. Work from `exponent`; never assume 2.
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode, type CurrencyInfo } from "./currencies.gen";

export { CURRENCY_CODES };
export type { CurrencyCode, CurrencyInfo };

export function isCurrencyCode(code: string): code is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(code);
}

/** The table row for a supported currency. Throws on an unsupported code so a wrong currency can never fall back silently.
 *  Narrow a dataset's currency string once with isCurrencyCode where it loads; everything below takes a CurrencyCode. */
export function currencyInfo(code: CurrencyCode): CurrencyInfo {
  if (!isCurrencyCode(code)) throw new Error(`Unsupported currency: ${String(code)}`);
  return CURRENCIES[code];
}

/** Minor units per major unit (100 for INR and USD). */
export function minorFactor(code: CurrencyCode): number {
  return 10 ** currencyInfo(code).exponent;
}

/**
 * Decimal text ("1234.56") to minor units, exactly, without floating point. More fraction digits than the
 * currency allows is an error unless the extra digits are all zero. There is deliberately no number overload:
 * a float cannot carry "extra precision" honestly (toFixed would round 19.999 to 20.00 silently).
 */
export function toMinor(text: string, code: CurrencyCode): number {
  const { exponent } = currencyInfo(code);
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) throw new Error(`Not a decimal amount: ${text}`);
  const [, sign, whole, frac = ""] = m;
  if (/[^0]/.test(frac.slice(exponent))) throw new Error(`Too many decimal places for ${code}: ${text}`);
  const minor = Number(whole + frac.slice(0, exponent).padEnd(exponent, "0"));
  if (!Number.isSafeInteger(minor)) throw new Error(`Amount out of range: ${text}`);
  return sign === "-" && minor !== 0 ? -minor : minor;
}

/** Non-throwing parse for text a user is still typing ("", "12."): null instead of an exception. */
export function tryToMinor(text: string, code: CurrencyCode): number | null {
  try {
    return toMinor(text, code);
  } catch {
    return null;
  }
}

/**
 * A number a user typed or a float calculation produced, rounded to minor units: Math.round(major * factor).
 * This is the deliberately lenient counterpart to toMinor (which is strict, text-only and exact). It keeps today's
 * behaviour for free-typed amount fields (e.g. 12.345 and 19.999 round) while following the currency's exponent.
 */
export function roundToMinor(major: number, code: CurrencyCode): number {
  return Math.round(major * minorFactor(code));
}

/** Minor units to a major-unit number. For display maths only; keep stored money in minor units. */
export function fromMinor(minor: number, code: CurrencyCode): number {
  return minor / minorFactor(code);
}
