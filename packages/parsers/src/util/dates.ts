const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

const pad = (n: number) => String(n).padStart(2, "0");
const yy = (y: number) => (y < 100 ? 2000 + y : y);

function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Parse common Indian statement date formats (day-first) into ISO yyyy-mm-dd:
 * 05/09/2026, 05/09/26, 05-09-2026, 05.09.2026, 05-Sep-2026, 05 Sep 2026, 05 Sep 26, 5-Sept-26, 2026-09-05.
 */
export function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/,/g, "");
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) return valid(yy(+m[3]), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,4})[\s-](\d{2}|\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo ? valid(yy(+m[3]), mo, +m[1]) : null;
  }
  return null;
}

/** Regexes that find a date at the start of a line (bank/card transaction rows). */
export const LEADING_DATE_RES = [
  /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/,
  /^(\d{1,2}[\s-][A-Za-z]{3,4}[\s-]\d{2,4})\b/,
];

export function leadingDate(text: string): { iso: string; raw: string } | null {
  for (const re of LEADING_DATE_RES) {
    const m = text.match(re);
    if (m) {
      const iso = parseDate(m[1]);
      if (iso) return { iso, raw: m[1] };
    }
  }
  return null;
}

/** Find the first date anywhere in a string after a label, e.g. "Payment Due Date : 25/10/2026". */
export function dateAfter(text: string, label: RegExp): string | null {
  const m = text.match(new RegExp(label.source + String.raw`\s*[:\-]?\s*(\d{1,2}[/.\- ][A-Za-z0-9]{2,4}[/.\- ]\d{2,4})`, "i"));
  return m ? parseDate(m[m.length - 1].replace(/ /g, "-")) : null;
}
