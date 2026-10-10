// Credit-card payment reminder. Dates only; no amounts and no network.

export const CARD_DUE_WINDOW_DAYS = 3;

/** Next due date on or after today. Day 31 in a short month clamps to that month's last day. */
export function nextDueDate(dueDay: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  let yy = y;
  let mm = m;
  if (d > dueDay) {
    mm += 1;
    if (mm > 12) { mm = 1; yy += 1; }
  }
  const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  const dd = Math.min(Math.max(dueDay, 1), last);
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function daysUntil(today: string, due: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${due}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/** True from three days before the due date through the due date itself. */
export function cardDueSoon(days: number, windowDays = CARD_DUE_WINDOW_DAYS): boolean {
  return days >= 0 && days <= windowDays;
}

export function cardDueWhen(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}
