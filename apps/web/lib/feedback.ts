// Feedback & Requests: local-only store for the prototype. Nothing is sent anywhere; see feedback-transport.ts.
// All sample people, requests and replies are fictional demo content.
export type Kind = "idea" | "bug" | "praise";
export type Status = "received" | "planned" | "in_progress" | "shipped" | "not_now";
export type Reply = { from: "auto" | "team" | "you"; name?: string; at: string; text: string };
export type Request = {
  id: string; kind: Kind; title: string; detail: string; area: string; status: Status;
  votes: number; premium: boolean; mine?: boolean; voted?: boolean; createdAt: string;
  credit?: string; shippedIn?: string; replies?: Reply[]; reason?: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  received: "Received", planned: "Planned", in_progress: "In progress", shipped: "Shipped", not_now: "Not now",
};
export const KIND_LABEL: Record<Kind, string> = { idea: "Idea", bug: "Bug", praise: "Praise" };
export const STEPS: Status[] = ["received", "planned", "in_progress", "shipped"];
export const AREAS = ["Overview", "Spend", "Budget", "Debt", "Credit", "Investments", "SIPs", "Rewards", "History", "Import", "Design", "Other"];
export const TEAM = "Abhirup from Lakshly";
/** Premium votes carry 3× weight in triage; Free votes count once. */
export const voteWeight = (plan: "free" | "premium") => (plan === "premium" ? 3 : 1);

const ack = (at: string, premium: boolean): Reply => ({
  from: "auto", at,
  text: premium
    ? "Thank you, this genuinely helps 🙏 You're in the Premium priority queue. A human will reply within 1 business day."
    : "Thank you, this genuinely helps 🙏 We've logged it and you'll hear from us soon.",
});

export const SEED: Request[] = [
  // The demo user's own requests ("Kavya R." is fictional).
  { id: "LK-1031", kind: "idea", title: "Hide amounts with one tap", detail: "So I can open the app on the metro without everyone seeing my balance.", area: "Design", status: "shipped", votes: 64, premium: true, mine: true, voted: true, createdAt: "2026-09-02", shippedIn: "0.2", credit: "Kavya R.",
    replies: [ack("2026-09-02", true), { from: "team", name: TEAM, at: "2026-09-02", text: "Such a good idea. Planning it for 0.2, and you'll get early access first." }, { from: "team", name: TEAM, at: "2026-09-29", text: "You asked, we built it! Tap the eye on Overview. Thank you, Kavya 💛" }] },
  { id: "LK-1038", kind: "idea", title: "Remind me 3 days before card due dates", detail: "A gentle nudge before each credit card due date.", area: "Credit", status: "planned", votes: 41, premium: true, mine: true, voted: true, createdAt: "2026-09-18",
    replies: [ack("2026-09-18", true), { from: "team", name: TEAM, at: "2026-09-19", text: "Thank you! Planned for the next beta. Would 3 days and 1 day before both be useful?" }] },
  { id: "LK-1042", kind: "bug", title: "Refund shows twice after import", detail: "A UPI refund appears as two rows after importing the same statement again.", area: "Import", status: "in_progress", votes: 9, premium: true, mine: true, voted: true, createdAt: "2026-09-27",
    replies: [ack("2026-09-27", true), { from: "team", name: TEAM, at: "2026-09-28", text: "Thanks for the clear steps, I can reproduce it. A fix is in progress; I'll tell you when it ships." }] },
  // Everyone's requests (public roadmap).
  { id: "LK-1007", kind: "idea", title: "Split a bill with family", detail: "Mark part of a payment as shared and track who owes what.", area: "Spend", status: "planned", votes: 52, premium: true, createdAt: "2026-09-12" },
  { id: "LK-1012", kind: "idea", title: "SIP step-up reminders", detail: "Nudge me every April to step up my SIPs.", area: "SIPs", status: "in_progress", votes: 35, premium: true, createdAt: "2026-09-03" },
  { id: "LK-1003", kind: "idea", title: "Dark mode that follows the system", detail: "Switch automatically with my phone.", area: "Design", status: "shipped", votes: 58, premium: false, createdAt: "2026-08-20", credit: "Meera K.", shippedIn: "0.1" },
  { id: "LK-1005", kind: "idea", title: "Export budget as CSV", detail: "For my CA at tax time.", area: "Budget", status: "shipped", votes: 23, premium: true, createdAt: "2026-08-02", credit: "@arjun_builds", shippedIn: "0.1" },
  { id: "LK-1019", kind: "idea", title: "Credit card due-date widget", detail: "A home screen widget for upcoming card dues.", area: "Credit", status: "received", votes: 17, premium: false, createdAt: "2026-09-25" },
  { id: "LK-1024", kind: "idea", title: "Goal jars for a trip or a gadget", detail: "Save towards a target and see progress.", area: "Budget", status: "planned", votes: 29, premium: false, createdAt: "2026-09-21" },
  { id: "LK-1027", kind: "idea", title: "Rewards points expiry alerts", detail: "Warn me before card points expire.", area: "Rewards", status: "in_progress", votes: 21, premium: true, createdAt: "2026-09-24" },
  { id: "LK-1015", kind: "idea", title: "Live bank sync (Account Aggregator)", detail: "Pull transactions automatically.", area: "Import", status: "not_now", votes: 33, premium: false, createdAt: "2026-09-08", reason: "It needs a regulated partner, so it's on hold. Statement and email import come first. Your votes decide when we revisit it." },
];

const KEY = "lakshly.feedback.v2";
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheVal: Request[] = SEED;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getSnapshot(): Request[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cacheVal = raw ? (JSON.parse(raw) as Request[]) : SEED; } catch { cacheVal = SEED; }
  }
  return cacheVal;
}
export const getServerSnapshot = () => SEED;
export function save(next: Request[]) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function reset() { save(SEED); }

/** Next reply-by date: N business days (Mon–Fri) after `from`, in IST. Public holidays are not modelled. */
export function replyBy(from: Date, businessDays: number): Date {
  const ist = new Date(from.getTime() + 330 * 60_000);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  let left = businessDays;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}
export { ack as autoAck };
