import type { BillAlert } from "./radar";

export const FIRED_STORAGE = "lakshly.bills.fired";

export function dueAlerts(alerts: readonly BillAlert[], fired: readonly string[], now: Date): BillAlert[] {
  const seen = new Set(fired);
  return alerts.filter((alert) => {
    const due = Date.parse(alert.fireAt);
    if (!Number.isFinite(due) || due > now.getTime() || seen.has(alert.id)) return false;
    seen.add(alert.id);
    return true;
  });
}

export function rememberFired(fired: readonly string[], ids: readonly string[]): string[] {
  return [...new Set([...fired, ...ids])].slice(-200);
}

export async function deliverAlert(alert: BillAlert, isCurrent: () => boolean = () => true): Promise<boolean> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return false;
  try {
    const options: NotificationOptions = { body: alert.body, tag: alert.id, data: { url: "/bills/" } };
    if (navigator.serviceWorker?.controller) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!isCurrent()) return false;
      if (registration) {
        await registration.showNotification(alert.title, options);
        return true;
      }
    }
    if (!isCurrent()) return false;
    const notification = new Notification(alert.title, options);
    notification.onclick = () => { window.location.assign(new URL("/bills/", window.location.origin).href); notification.close(); };
    return true;
  } catch {
    return false;
  }
}

/** Keep the original time when the clock crosses a planned reminder. */
export function reconcileAlertPlan(previous: readonly BillAlert[], next: readonly BillAlert[], allowed: ReadonlySet<string>): BillAlert[] {
  const byId = new Map(previous.filter((alert) => allowed.has(alert.billId)).map((alert) => [alert.id, alert]));
  for (const alert of next) {
    const old = byId.get(alert.id);
    byId.set(alert.id, old ? { ...alert, fireAt: old.fireAt, title: old.title } : alert);
  }
  return [...byId.values()];
}
