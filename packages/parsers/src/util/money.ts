/**
 * Parse an Indian-formatted amount into paise. Handles "1,23,456.78", "₹ 1,234", "Rs. 99.5",
 * trailing "Cr"/"Dr"/"CR"/"DR"/"C"/"D", leading "-" and parentheses. Returns null if not an amount.
 * The sign follows the text: "Dr"/"D"/"-"/"( )" → negative, otherwise positive.
 */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  let neg = false;
  const suffix = s.match(/\s*(CR|DR|Cr|Dr|C|D)\.?$/);
  if (suffix) {
    if (/^d/i.test(suffix[1])) neg = true;
    s = s.slice(0, suffix.index).trim();
  }
  s = s.replace(/^(₹|INR|Rs\.?)\s*/i, "");
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  s = s.replace(/^(₹|INR|Rs\.?)\s*/i, "");
  if (!/^\d{1,3}(,\d{2,3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(/,/g, "").split(".");
  const paise = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -paise : paise;
}

/** Strict amount token check (used to find amount columns). */
export const AMOUNT_RE = /^-?(₹\s?)?(\d{1,3}(,\d{2,3})+|\d+)\.\d{2}(\s?(Cr|Dr|CR|DR|C|D))?$/;

/** Parse a decimal quantity like units/NAV ("1,234.567") into a number. */
export function parseNumber(raw: string): number | null {
  const s = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}
