// What leaves the device when someone sends feedback, and how. Lakshly is local-first: feedback is the ONLY
// user data that leaves the device, and only when the user presses Send.
//   - NEXT_PUBLIC_FEEDBACK_ENDPOINT set  -> POST to the Lakshly feedback relay (workers/feedback).
//   - unset                              -> the page opens a prefilled GitHub issue (lib/github-issue).
// mailto remains an optional secondary path; send() still supports email drafts without a relay.
import type { Kind, Status } from "./feedback";

export const FEEDBACK_ENDPOINT = (process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT ?? "").replace(/\/+$/, "");
export const FEEDBACK_EMAIL = "hello@lakshly.com";

export type Draft = {
  kind: Kind; title: string; detail: string; area: string;
  credit?: string; replyEmail?: string; includeDiagnostics: boolean;
};
export type Diagnostics = { appVersion: string; platform: string };
export type Payload = {
  kind: Kind; title: string; detail: string; area: string; plan: "free" | "premium";
  credit?: string; replyEmail?: string; diagnostics?: Diagnostics;
};

const clip = (s: string | undefined, n: number) => (s ?? "").trim().slice(0, n);

/** Exactly what would be sent: only what the user typed, their plan tier, and diagnostics if they opted in.
 *  Never transactions, balances, accounts, statements, or anything from the encrypted vault. */
export function buildPayload(d: Draft, plan: "free" | "premium", diag: Diagnostics): Payload {
  const p: Payload = { kind: d.kind, title: clip(d.title, 90), detail: clip(d.detail, 1000), area: d.area, plan };
  const credit = clip(d.credit, 40); if (credit) p.credit = credit;
  const email = clip(d.replyEmail, 120); if (email) p.replyEmail = email;
  if (d.includeDiagnostics) p.diagnostics = { appVersion: diag.appVersion, platform: diag.platform };
  return p;
}

/** Rough check for things that look like account/card/phone numbers, PAN or IFSC in free text, so we can warn before sending. */
export function looksSensitive(text: string): boolean {
  const joined = text.replace(/(\d)[ -](?=\d)/g, "$1");
  return /\d{9,19}/.test(joined) || /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(text) || /\b[A-Z]{4}0[A-Z0-9]{6}\b/i.test(text);
}

const KIND_SUBJECT: Record<Kind, string> = { idea: "Idea", bug: "Bug", praise: "Praise" };
/** mailto: fallback with the same fields the relay would get. */
export function mailtoHref(p: Payload): string {
  const lines = [
    `${KIND_SUBJECT[p.kind]}: ${p.title}`, "", p.detail || "(no details)", "",
    "—", `Area: ${p.area}`, `Plan: ${p.plan}`,
    `Credit me as: ${p.credit ?? "(no credit)"}`,
    ...(p.diagnostics ? [`App: ${p.diagnostics.appVersion} · ${p.diagnostics.platform}`] : []),
    "", "Sent from Lakshly. Please don't include account numbers or statements.",
  ];
  const subject = `[Lakshly ${KIND_SUBJECT[p.kind]}${p.plan === "premium" ? " · Premium" : ""}] ${p.title}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n").slice(0, 1500))}`;
}

export type Sent = { mode: "relay"; id: string; secret: string } | { mode: "email"; href: string };
export class SendError extends Error {}

export async function send(p: Payload, honeypot = "", endpoint = FEEDBACK_ENDPOINT): Promise<Sent> {
  if (!endpoint) return { mode: "email", href: mailtoHref(p) };
  let res: Response;
  try {
    res = await fetch(`${endpoint}/v1/feedback`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Lakshly-Client": "web" },
      body: JSON.stringify({ ...p, website: honeypot }), credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
    });
  } catch { throw new SendError("network"); }
  if (res.status === 429) throw new SendError("rate_limited");
  if (!res.ok) throw new SendError(`http_${res.status}`);
  const body = (await res.json()) as { id?: string; secret?: string };
  if (!body.id || !body.secret) throw new SendError("bad_response");
  return { mode: "relay", id: body.id, secret: body.secret };
}

export type RemoteStatus = { status: Status; replies: { at: string; text: string }[] };
/** Status + replies for one of your requests. null = not visible yet (GitHub search can lag a minute). */
export async function fetchStatus(id: string, secret: string, endpoint = FEEDBACK_ENDPOINT): Promise<RemoteStatus | null> {
  if (!endpoint) return null;
  const res = await fetch(`${endpoint}/v1/feedback/${encodeURIComponent(id)}?s=${encodeURIComponent(secret)}`, {
    headers: { "X-Lakshly-Client": "web" }, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new SendError(`http_${res.status}`);
  return (await res.json()) as RemoteStatus;
}
