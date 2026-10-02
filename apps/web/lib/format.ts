// INR formatting helpers. All amounts in Lakshly are integers in paise.

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ₹1,23,456 (Indian digit grouping), from paise. */
export function formatINR(paise: number, opts: { decimals?: boolean; signed?: boolean } = {}): string {
  const rupees = paise / 100;
  const body = (opts.decimals ? inr2 : inr).format(Math.abs(rupees));
  if (rupees < 0) return `−${body}`;
  return opts.signed && rupees > 0 ? `+${body}` : body;
}

/** Compact Indian units: ₹950, ₹12.5K, ₹3.2L, ₹1.1Cr. */
export function formatINRCompact(paise: number): string {
  const r = Math.abs(paise / 100);
  const sign = paise < 0 ? "−" : "";
  const trim = (n: number) => (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
  if (r >= 1e7) return `${sign}₹${trim(r / 1e7)}Cr`;
  if (r >= 1e5) return `${sign}₹${trim(r / 1e5)}L`;
  if (r >= 1e3) return `${sign}₹${trim(r / 1e3)}K`;
  return `${sign}₹${Math.round(r)}`;
}

export function formatPct(v: number, digits = 1): string {
  return `${(Math.round(v * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" -> "Sep 2026" (locale-independent, so SSR and client agree). */
export function formatMonth(ym: string, short = false): string {
  const [y, m] = ym.split("-").map(Number);
  return short ? MONTHS[m - 1] : `${MONTHS[m - 1]} ${y}`;
}

/** "2026-09-14" -> "14 Sep 2026". */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const ACRONYMS: Record<string, string> = { emi: "EMI", upi: "UPI", sip: "SIP", fd: "FD", epf: "EPF", ppf: "PPF", nps: "NPS", bnpl: "BNPL" };

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w+/g, (w) => ACRONYMS[w.toLowerCase()] ?? w[0].toUpperCase() + w.slice(1));
}
