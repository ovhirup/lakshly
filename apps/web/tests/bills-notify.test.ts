import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverAlert, dueAlerts, reconcileAlertPlan, rememberFired } from "@/lib/bills/notify";
import type { BillAlert } from "@/lib/bills/radar";

const alert: BillAlert = { id: "lakshly.bill.card:demo:2026-10-20", billId: "card:demo:2026-10-20", fireAt: "2026-10-19T09:00:00+05:30", title: "Card bill due tomorrow", body: "Demo card · 20 Oct" };
afterEach(() => vi.unstubAllGlobals());

describe("bill notification planning", () => {
  it("fires at the exact instant, skips future, invalid, duplicate and remembered alerts", () => {
    expect(dueAlerts([alert], [], new Date("2026-10-19T03:29:59Z"))).toEqual([]);
    expect(dueAlerts([alert, alert, { ...alert, id: "bad", fireAt: "bad" }], [], new Date("2026-10-19T03:30:00Z"))).toEqual([alert]);
    expect(dueAlerts([alert], [alert.id], new Date("2026-10-20"))).toEqual([]);
  });
  it("stores only distinct supplied ids and retains the last 200", () => {
    const ids = Array.from({ length: 205 }, (_, index) => "demo-" + index);
    expect(rememberFired(ids, [ids[204], "last"])).toHaveLength(200);
    expect(rememberFired(ids, [ids[204], "last"])[199]).toBe("last");
  });
  it("preserves elapsed plans across clock changes and removes paid or muted bills", () => {
    const shifted = { ...alert, fireAt: "2026-10-20T09:00:00+05:30" };
    expect(reconcileAlertPlan([alert], [shifted], new Set([alert.billId]))[0].fireAt).toBe(alert.fireAt);
    expect(reconcileAlertPlan([alert], [], new Set([alert.billId]))).toEqual([alert]);
    expect(reconcileAlertPlan([alert], [], new Set())).toEqual([]);
  });
  it("reports failed delivery without treating it as fired", async () => {
    vi.stubGlobal("Notification", class { static permission = "granted"; constructor() { throw new Error("blocked"); } });
    vi.stubGlobal("navigator", {});
    expect(await deliverAlert(alert)).toBe(false);
    vi.stubGlobal("Notification", class { static permission = "denied"; });
    expect(await deliverAlert(alert)).toBe(false);
  });
  it("falls back immediately without awaiting an uncontrolled service worker", async () => {
    const shown = vi.fn();
    vi.stubGlobal("Notification", class { static permission = "granted"; constructor(title: string, options: NotificationOptions) { shown(title, options); } });
    vi.stubGlobal("navigator", { serviceWorker: { controller: null, ready: new Promise(() => {}) } });
    expect(await deliverAlert(alert)).toBe(true);
    expect(shown).toHaveBeenCalledWith(alert.title, expect.objectContaining({ tag: alert.id, data: { url: "/bills/" } }));
  });
  it("cancels queued delivery after settings or the data source changes", async () => {
    const showNotification = vi.fn();
    vi.stubGlobal("Notification", class { static permission = "granted"; });
    vi.stubGlobal("navigator", { serviceWorker: { controller: {}, getRegistration: async () => ({ showNotification }) } });
    expect(await deliverAlert(alert, () => false)).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });
  it("uses a controlling service worker registration", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Notification", class { static permission = "granted"; });
    vi.stubGlobal("navigator", { serviceWorker: { controller: {}, getRegistration: async () => ({ showNotification }) } });
    expect(await deliverAlert(alert)).toBe(true);
    expect(showNotification).toHaveBeenCalledWith(alert.title, expect.objectContaining({ body: alert.body }));
  });
});
