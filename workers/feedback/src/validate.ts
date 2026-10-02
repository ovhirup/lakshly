// Input validation for feedback submissions. Only these typed fields survive; everything else is dropped.
export const KINDS = ["idea", "bug", "praise"] as const;
export const AREAS = ["Overview", "Spend", "Budget", "Debt", "Credit", "Investments", "SIPs", "Rewards", "History", "Import", "Design", "Other"] as const;
export const LIMITS = { title: 90, detail: 1000, credit: 40, replyEmail: 120, appVersion: 40, platform: 20, bodyBytes: 8 * 1024 } as const;

export type Kind = (typeof KINDS)[number];
export type Clean = {
  kind: Kind; title: string; detail: string; area: string; plan: "free" | "premium";
  credit?: string; replyEmail?: string; diagnostics?: { appVersion: string; platform: string };
};
export type Result = { ok: true; value: Clean; honeypot: boolean } | { ok: false; error: string };

// Strip control and bidi-override characters; collapse whitespace in single-line fields.
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
const line = (v: unknown) => (typeof v === "string" ? v.replace(CTRL, "").replace(/\s+/g, " ").trim() : "");
const text = (v: unknown) => (typeof v === "string" ? v.replace(CTRL, "").replace(/\r\n?/g, "\n").trim() : "");
const EMAIL = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i;

export function validate(input: unknown): Result {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "invalid_body" };
  const o = input as Record<string, unknown>;
  const honeypot = typeof o.website === "string" && o.website.trim() !== "";

  if (!KINDS.includes(o.kind as Kind)) return { ok: false, error: "invalid_kind" };
  const title = line(o.title);
  if (title.length < 3) return { ok: false, error: "title_too_short" };
  if (title.length > LIMITS.title) return { ok: false, error: "title_too_long" };
  const detail = text(o.detail);
  if (detail.length > LIMITS.detail) return { ok: false, error: "detail_too_long" };

  const value: Clean = {
    kind: o.kind as Kind, title, detail,
    area: AREAS.includes(o.area as (typeof AREAS)[number]) ? (o.area as string) : "Other",
    plan: o.plan === "premium" ? "premium" : "free",
  };
  const credit = line(o.credit);
  if (credit.length > LIMITS.credit) return { ok: false, error: "credit_too_long" };
  if (credit) value.credit = credit;

  const email = line(o.replyEmail);
  if (email) {
    if (email.length > LIMITS.replyEmail || !EMAIL.test(email)) return { ok: false, error: "invalid_reply_email" };
    value.replyEmail = email;
  }
  // Diagnostics only when the user opted in, and only these two short strings.
  const d = o.diagnostics;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const dd = d as Record<string, unknown>;
    const appVersion = line(dd.appVersion).slice(0, LIMITS.appVersion);
    const platform = line(dd.platform).slice(0, LIMITS.platform);
    if (appVersion || platform) value.diagnostics = { appVersion, platform };
  }
  return { ok: true, value, honeypot };
}
