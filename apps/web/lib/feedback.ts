// Local-only feedback store (mock). Nothing is sent anywhere in this MVP.
export type Status = "received" | "planned" | "in_progress" | "shipped";
export type Request = {
  id: string; title: string; detail: string; area: string; status: Status;
  votes: number; premium: boolean; mine?: boolean; createdAt: string; credit?: string; reply?: string;
};

export const STATUS_LABEL: Record<Status, string> = {
  received: "Received", planned: "Planned", in_progress: "In progress", shipped: "Shipped",
};

export const SEED: Request[] = [
  { id: "r1", title: "Split a bill with family", detail: "Mark part of a payment as shared and track who owes what.", area: "Spend", status: "planned", votes: 42, premium: true, createdAt: "2026-09-12", reply: "Love this, thank you! It's on the roadmap for the next beta." },
  { id: "r2", title: "SIP step-up reminders", detail: "Nudge me every April to step up my SIPs.", area: "SIPs", status: "in_progress", votes: 35, premium: true, createdAt: "2026-09-03", reply: "Being built right now. Thank you for the nudge!" },
  { id: "r3", title: "Dark mode that follows the system", detail: "Switch automatically with my phone.", area: "Design", status: "shipped", votes: 58, premium: false, createdAt: "2026-08-20", credit: "Meera K.", reply: "Shipped! Thank you, Meera 💛" },
  { id: "r4", title: "Credit card due-date widget", detail: "A home screen widget for upcoming card dues.", area: "Credit", status: "received", votes: 17, premium: false, createdAt: "2026-09-25" },
  { id: "r5", title: "Export budget as CSV", detail: "For my CA at tax time.", area: "Budget", status: "shipped", votes: 23, premium: true, createdAt: "2026-08-02", credit: "@arjun_builds", reply: "Shipped in 0.1. Thank you, Arjun!" },
];

const KEY = "lakshly.feedback.v1";
const listeners = new Set<() => void>();
let cacheRaw: string | null = null;
let cacheVal: Request[] = SEED;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export function getSnapshot(): Request[] {
  const raw = localStorage.getItem(KEY);
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try { cacheVal = raw ? (JSON.parse(raw) as Request[]) : SEED; } catch { cacheVal = SEED; }
  }
  return cacheVal;
}
export const getServerSnapshot = () => SEED;
export function save(next: Request[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}
