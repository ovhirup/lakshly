// Gentle-nudge rules for Premium upsells (Free tier only). Pure functions + a tiny localStorage store.
// Rules: at most 1 proactive nudge per screen and 1 per 7 days; "Not now" snoozes; never at launch,
// after an error or mid-task; no countdowns, fake discounts or guilt copy.
export const UPSELL_KEY = "lakshly.upsell";
const DAY = 86_400_000;
export type UpsellState = { v: 1; last?: { id: string; at: string }; snoozed: Record<string, string> };
export const EMPTY_UPSELL: UpsellState = { v: 1, snoozed: {} };

export function parseUpsell(raw: string | null): UpsellState {
  if (!raw) return EMPTY_UPSELL;
  try {
    const s = JSON.parse(raw) as Partial<UpsellState>;
    const snoozed: Record<string, string> = {};
    for (const [k, v] of Object.entries(s.snoozed ?? {})) if (typeof v === "string") snoozed[k] = v;
    const last = s.last && typeof s.last.id === "string" && typeof s.last.at === "string" ? s.last : undefined;
    return { v: 1, snoozed, ...(last ? { last } : {}) };
  } catch {
    return EMPTY_UPSELL;
  }
}

/** May this proactive nudge show now? The same nudge may keep showing; a different one waits 7 days. */
export function mayShow(state: UpsellState, id: string, now: Date): boolean {
  const until = state.snoozed[id];
  if (until && Date.parse(until) > now.getTime()) return false;
  if (!state.last || state.last.id === id) return true;
  return now.getTime() - Date.parse(state.last.at) >= 7 * DAY;
}

export function markShown(state: UpsellState, id: string, now: Date): UpsellState {
  if (state.last?.id === id && now.getTime() - Date.parse(state.last.at) < 7 * DAY) return state;
  return { ...state, last: { id, at: now.toISOString() } };
}

export function snooze(state: UpsellState, id: string, days: number, now: Date): UpsellState {
  return { ...state, snoozed: { ...state.snoozed, [id]: new Date(now.getTime() + days * DAY).toISOString() } };
}

export function loadUpsell(): UpsellState {
  try { return parseUpsell(localStorage.getItem(UPSELL_KEY)); } catch { return EMPTY_UPSELL; }
}
export function storeUpsell(s: UpsellState) {
  try { localStorage.setItem(UPSELL_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}
