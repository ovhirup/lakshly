// What leaves the device when someone sends feedback, and how. Lakshly is local-first: feedback is the ONLY
// user data that leaves the device, and only when the user presses Send. This prototype never sends: submit() is a stub.
import type { Kind } from "./feedback";

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

export type Receipt = { id: string; receivedAt: string };

/** STUB. The real version would POST the payload to the feedback relay (see premium-feedback-plan.md). */
export async function submit(payload: Payload, id: string): Promise<Receipt> {
  void payload;
  await new Promise((r) => setTimeout(r, 600));
  return { id, receivedAt: new Date().toISOString() };
}
