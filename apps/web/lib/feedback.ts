// Feedback & Requests: the user's own requests live only on this device (localStorage).
// The public roadmap is static JSON in the repo (content/roadmap.json). Sample people and requests are fictional.
import roadmapJson from "@/content/roadmap.json";

export type Kind = "idea" | "bug" | "praise";
export type Status = "received" | "planned" | "in_progress" | "shipped" | "not_now";
export type Reply = { from: "auto" | "team"; name?: string; at: string; text: string };
export type Request = {
  id: string; kind: Kind; title: string; detail: string; area: string; status: Status;
  premium: boolean; createdAt: string; credit?: string; shippedIn?: string; replies?: Reply[];
  /** Relay secret for status lookups (only on this device). Absent for demo items and email-sent items. */
  secret?: string; via?: "relay" | "email" | "github" | "demo"; roadmapId?: string;
};
export type RoadmapItem = {
  id: string; title: string; area: string; status: Exclude<Status, "received">; votes: number;
  shippedIn?: string; credits?: string[]; reason?: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  received: "Received", planned: "Planned", in_progress: "In progress", shipped: "Shipped", not_now: "Not now",
};
export const KIND_LABEL: Record<Kind, string> = { idea: "Idea", bug: "Bug", praise: "Praise" };
export const STEPS: Status[] = ["received", "planned", "in_progress", "shipped"];
export const AREAS = ["Overview", "Spend", "Budget", "Debt", "Credit", "Investments", "SIPs", "Rewards", "History", "Import", "Design", "Other"];
export const TEAM = "Abhirup from Lakshly";
export const ROADMAP = roadmapJson.items as RoadmapItem[];
export const ROADMAP_UPDATED = roadmapJson.updated;

export function autoAck(at: string, premium: boolean): Reply {
  return {
    from: "auto", at,
    text: premium
      ? "Thank you, this genuinely helps 🙏 You're in the Premium priority queue. A human will reply within 1 business day."
      : "Thank you, this genuinely helps 🙏 We've logged it and you'll hear from us soon.",
  };
}

/** Demo history so the screens aren't empty in the synthetic demo. */
export const DEMO_MINE: Request[] = [
  { id: "LK-7Q4M2K", kind: "idea", title: "Hide amounts with one tap", detail: "So I can open the app on the metro without everyone seeing my balance.", area: "Design", status: "shipped", premium: true, createdAt: "2026-09-02", shippedIn: "0.2", credit: "Kavya R.", via: "demo", roadmapId: "RM-31",
    replies: [autoAck("2026-09-02", true), { from: "team", name: TEAM, at: "2026-09-02", text: "Such a good idea. Planning it for 0.2, and you'll get early access first." }, { from: "team", name: TEAM, at: "2026-09-29", text: "You asked, we built it! Tap the eye on Overview. Thank you, Kavya 💛" }] },
  { id: "LK-9DX3TA", kind: "idea", title: "Remind me 3 days before card due dates", detail: "A gentle nudge before each credit card due date.", area: "Credit", status: "planned", premium: true, createdAt: "2026-09-18", via: "demo", roadmapId: "RM-12",
    replies: [autoAck("2026-09-18", true), { from: "team", name: TEAM, at: "2026-09-19", text: "Thank you! Planned for the next beta. Would 3 days and 1 day before both be useful?" }] },
  { id: "LK-H2V8NC", kind: "bug", title: "Refund shows twice after import", detail: "A UPI refund appears as two rows after importing the same statement again.", area: "Import", status: "in_progress", premium: true, createdAt: "2026-09-27", via: "demo",
    replies: [autoAck("2026-09-27", true), { from: "team", name: TEAM, at: "2026-09-28", text: "Thanks for the clear steps, I can reproduce it. A fix is in progress; I'll tell you when it ships." }] },
];

type Store = { mine: Request[]; votes: string[] };
const KEY = "lakshly.feedback.v3";
const EMPTY: Store = { mine: DEMO_MINE, votes: ["RM-12", "RM-31"] };
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheVal: Store = EMPTY;

export function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export function getSnapshot(): Store {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* storage blocked */ }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cacheVal = raw ? (JSON.parse(raw) as Store) : EMPTY; } catch { cacheVal = EMPTY; }
  }
  return cacheVal;
}
export const getServerSnapshot = () => EMPTY;
export function save(next: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export function reset() { save(EMPTY); }

/** Public counts are raw: your own vote adds exactly 1, whatever your plan. */
export const displayVotes = (item: RoadmapItem, voted: boolean) => item.votes + (voted ? 1 : 0);

/** Reply-by date: N business days (Mon–Fri) after `from`, in IST. Public holidays are not modelled. */
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
