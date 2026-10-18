import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatINR } from "@/lib/format";
import {
  BILL_KINDS, HORIZON_DAYS, billAlerts, buildRadar, dueText, emptyBillState,
  normaliseBillState, radarSummary,
  type BillAlert, type BillKind, type BillRadarState, type RadarBill, type RadarInput,
} from "@/lib/bills/radar";
import { emptyWow, normaliseWow } from "@/lib/wow/state";
import type { SubscriptionCadence, SubscriptionItem } from "@/lib/wow/subscription-audit";

type Fixture = Pick<RadarInput, "accounts" | "debts" | "sips" | "fees"> & {
  now: string;
  timezone: string;
  subscriptions: { id: string; name: string; amount: number; nextDate: string; cadence: SubscriptionCadence; lapsed: boolean }[];
  plannedCancels: string[];
  state: BillRadarState;
  expected: {
    bills: Pick<RadarBill, "id" | "daysLeft" | "kind" | "amount" | "paid" | "muted">[];
    summary: { dueThisWeek: number; dueThisWeekPaise: number; next: string };
    alerts: BillAlert[];
    limit3: { alertIds: string[]; lockedCount: number };
    unlimited: { alertIds: string[]; lockedCount: number };
  };
};
const fixture = JSON.parse(readFileSync(new URL("../../../packages/shared/fixtures/bill-radar.json", import.meta.url), "utf8")) as Fixture;
const now = new Date("2026-03-28T19:00:00+05:30");
const at = (text: string) => new Date(text + "T19:00:00+05:30");
const build = (overrides: Partial<RadarInput> = {}) => buildRadar({
  accounts: [], debts: [], sips: [], fees: [], subscriptions: [], plannedCancels: new Set(), state: emptyBillState(), now, ...overrides,
});
const card = (overrides: Partial<RadarInput["accounts"][number]> = {}): RadarInput["accounts"][number] => ({
  ...fixture.accounts[0], id: "demo", name: "Demo card", balance: -10000, dueDay: 31, ...overrides,
});
const subscription = (cadence: SubscriptionCadence, nextDate: string): SubscriptionItem => ({
  id: "demo-service", name: "Demo service", kind: "other", charges: 2,
  lastDate: "2026-01-01", lastPaise: 10000, typicalPaise: 10000, cadence,
  monthlyPaise: 10000, yearlyPaise: 120000, nextDate, flags: [], lapsed: false, verdict: "Keep",
});
const row = (overrides: Partial<RadarBill> = {}): RadarBill => {
  const bill = { sourceId: "demo", kind: "card" as BillKind, name: "Demo card", due: "2026-04-03", daysLeft: 6, amount: 10000, paid: false, muted: false, ...overrides };
  return { ...bill, id: bill.kind + ":" + bill.sourceId + ":" + bill.due };
};
const enabled = (overrides: Partial<BillRadarState> = {}): BillRadarState => ({ ...emptyBillState(), alertsOn: true, ...overrides });

describe("bill radar Apple parity", () => {
  it("matches every expected value in the shared golden fixture", () => {
    expect(fixture.timezone).toBe("Asia/Kolkata");
    const state = normaliseBillState(fixture.state);
    const bills = buildRadar({
      ...fixture, now: new Date(fixture.now), state, plannedCancels: new Set(fixture.plannedCancels),
      subscriptions: fixture.subscriptions.map((item) => ({ ...subscription(item.cadence, item.nextDate), ...item, typicalPaise: item.amount })),
    });
    expect(bills.map(({ id, daysLeft, kind, amount, paid, muted }) => ({ id, daysLeft, kind, amount, paid, muted }))).toEqual(fixture.expected.bills);
    const summary = radarSummary(bills);
    expect({ ...summary, next: summary.next?.id }).toEqual(fixture.expected.summary);
    for (const [limit, wanted] of [[3, fixture.expected.limit3], [null, fixture.expected.unlimited]] as const) {
      const result = billAlerts(bills, state, limit, true, new Date(fixture.now));
      expect(result.lockedCount).toBe(wanted.lockedCount);
      expect(result.alerts.map((alert) => alert.id)).toEqual(wanted.alertIds);
      expect(result.alerts).toEqual(wanted.alertIds.map((id) => fixture.expected.alerts.find((alert) => alert.id === id)));
    }
    expect(billAlerts(bills, state, null, true, now).alerts).toEqual(fixture.expected.alerts);
  });

  it("clamps month ends and handles zero balances and missing due days", () => {
    expect(build({ accounts: [card()], now: at("2026-02-28") })[0]).toMatchObject({ due: "2026-02-28", daysLeft: 0 });
    expect(build({ accounts: [card()], now: at("2026-04-01") })[0].due).toBe("2026-04-30");
    const { dueDay: omitted, ...withoutDay } = card();
    void omitted;
    expect(build({ accounts: [{ ...withoutDay, balance: 0 }] })).toEqual([]);
    expect(build({ accounts: [withoutDay] })[0].due).toBe("2026-04-01");
    expect(build({ accounts: [card({ balance: -Number.MAX_SAFE_INTEGER })] })[0].amount).toBe(Number.MAX_SAFE_INTEGER);
    expect(build({ accounts: [card({ balance: 0 })] })[0].amount).toBe(0);
    expect(build({ accounts: [card({ dueDay: 0 }), card({ dueDay: 32 })] })).toEqual([]);
  });

  it("rolls yearly fees, excludes expired one-offs, and includes the horizon boundary", () => {
    const bills = build({ fees: [
      { id: "demo-yearly", name: "Demo LIC policy", amount: 10000, due: "2025-04-02", yearly: true },
      { id: "sample-old", name: "Sample old fee", amount: 20000, due: "2025-04-02", yearly: false },
      { id: "sample-edge", name: "Sample boundary", amount: 30000, due: "2026-05-12", yearly: false },
      { id: "sample-out", name: "Sample outside", amount: 40000, due: "2026-05-13", yearly: false },
    ] });
    expect(HORIZON_DAYS).toBe(45);
    expect(bills.map((bill) => bill.sourceId)).toEqual(["demo-yearly", "sample-edge"]);
    expect(bills.map((bill) => bill.daysLeft)).toEqual([5, 45]);
    expect(bills[0]).toMatchObject({ kind: "insurance", due: "2026-04-02" });
  });

  it("sorts by day, kind, name and id, and summarises unpaid bills including muted ones", () => {
    const bills = build({
      accounts: [card({ id: "demo-z", name: "Demo Z" }), card({ id: "demo-a", name: "Demo A" })],
      fees: [{ id: "sample-fee", name: "Sample fee", amount: 5000, due: "2026-03-31", yearly: false }],
      state: normaliseBillState({ paid: ["card:demo-a:2026-03-31"], muted: ["card:demo-z"] }),
    });
    expect(bills.map((bill) => bill.sourceId)).toEqual(["demo-a", "demo-z", "sample-fee"]);
    expect(bills[0].paid).toBe(true);
    expect(bills[1].muted).toBe(true);
    expect(radarSummary(bills)).toEqual({ dueThisWeek: 2, dueThisWeekPaise: 15000, next: bills[1] });
    expect(radarSummary([])).toEqual({ dueThisWeek: 0, dueThisWeekPaise: 0, next: null });
    expect(build({ accounts: [card({ id: "demo-z" }), card({ id: "demo-a" })] }).map((bill) => bill.sourceId)).toEqual(["demo-a", "demo-z"]);
    expect(radarSummary([row({ amount: null }), row({ daysLeft: 7 })]).dueThisWeekPaise).toBe(0);
  });

  it("rolls each subscription cadence from its original date and excludes inactive subscriptions", () => {
    const cases: [SubscriptionCadence, string, string][] = [
      ["weekly", "2026-03-14", "2026-03-28"], ["monthly", "2026-01-31", "2026-03-31"],
      ["quarterly", "2025-12-31", "2026-03-31"], ["yearly", "2025-04-02", "2026-04-02"],
    ];
    for (const [cadence, next, expected] of cases) expect(build({ subscriptions: [subscription(cadence, next)] })[0].due).toBe(expected);
    const active = subscription("monthly", "2026-03-29");
    expect(build({ subscriptions: [{ ...active, lapsed: true }] })).toEqual([]);
    expect(build({ subscriptions: [active], plannedCancels: new Set([active.id]) })).toEqual([]);
    expect(build({ subscriptions: [subscription("irregular", "2026-03-01")] })).toEqual([]);
    expect(build({ subscriptions: [{ ...active, nextDate: null }] })).toEqual([]);
    expect(build({ subscriptions: [{ ...active, nextDate: "2026-02-30" }] })).toEqual([]);
  });

  it("orders every kind and ignores cleared loans and inactive SIPs", () => {
    const debt = { ...fixture.debts[0], startDate: "2025-01-31", emi: 10000 };
    const sip = { ...fixture.sips[0], dayOfMonth: 31 };
    const bills = build({ accounts: [card()], debts: [debt, { ...debt, outstanding: 0 }, { ...debt, emi: 0 }],
      sips: [sip, { ...sip, status: "paused" as const }], subscriptions: [subscription("monthly", "2026-03-31")],
      fees: [
        { id: "demo-policy", name: "Demo term plan", amount: 10000, due: "2026-03-31", yearly: true },
        { id: "sample-renewal", name: "Sample renewal", amount: 10000, due: "2026-03-31", yearly: true },
      ],
    });
    expect(bills.map((bill) => bill.kind)).toEqual(Object.keys(BILL_KINDS));
    expect(bills.map((bill) => bill.daysLeft)).toEqual(Array(6).fill(3));
    expect(Object.values(BILL_KINDS).map((kind) => kind.title)).toEqual(["Card bill", "EMI", "Insurance", "Fee", "Subscription", "SIP"]);
    expect(Object.values(BILL_KINDS).map((kind) => kind.rank)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(build({ debts: [debt], sips: [sip], now: at("2026-02-28") }).map((bill) => bill.due)).toEqual(["2026-02-28", "2026-02-28"]);
  });

  it("applies alert limits and excludes paid and muted bills", () => {
    const bills = Array.from({ length: 5 }, (_, i) => row({ name: "Demo " + i }));
    expect(billAlerts(bills, enabled(), 3, false, now)).toMatchObject({ alerts: Array(3).fill(expect.anything()), lockedCount: 2 });
    expect(billAlerts(bills, enabled(), null, false, now).alerts).toHaveLength(5);
    expect(billAlerts(bills, enabled(), null, false, now).lockedCount).toBe(0);
    expect(billAlerts(bills, emptyBillState(), 3, true, now)).toEqual({ alerts: [], lockedCount: 0 });
    expect(billAlerts([row({ paid: true }), row({ muted: true })], enabled(), 0, true, now)).toEqual({ alerts: [], lockedCount: 0 });
    expect(billAlerts(bills, enabled(), -1, false, now)).toEqual({ alerts: [], lockedCount: 5 });
  });

  it("uses each lead preference and requires both amount preferences", () => {
    for (const leadDays of [1, 3, 7]) {
      const alert = billAlerts([row({ due: "2026-04-10" })], enabled({ leadDays }), null, true, now).alerts[0];
      expect(alert.fireAt).toBe("2026-04-" + String(10 - leadDays).padStart(2, "0") + "T09:00:00+05:30");
      expect(alert.title).toBe("Card bill " + dueText(leadDays).toLowerCase());
      expect(alert.body).toBe("Demo card · 10 Apr");
    }
    for (const amountsInAlerts of [false, true]) for (const include of [false, true]) {
      expect(billAlerts([row()], enabled({ amountsInAlerts }), null, include, now).alerts[0].body).toBe("Demo card · 3 Apr" + (amountsInAlerts && include ? " · " + formatINR(10000) : ""));
    }
    expect(billAlerts([row({ amount: null })], enabled({ amountsInAlerts: true }), null, true, now).alerts[0].body).toBe("Demo card · 3 Apr");
  });

  it("falls back to due-day alerts and schedules one minute ahead on the due day", () => {
    const result = billAlerts([row({ due: "2026-03-28" }), row({ due: "2026-03-29" }), row({ due: "2026-03-27" })], enabled(), null, false, now);
    expect(result.alerts.map((alert) => alert.fireAt)).toEqual(["2026-03-28T19:01:00+05:30", "2026-03-29T09:00:00+05:30"]);
    expect(result.alerts.map((alert) => alert.title)).toEqual(["Card bill due today", "Card bill due today"]);
    const early = new Date("2026-03-28T08:00:00+05:30");
    expect(billAlerts([row({ due: "2026-03-28" })], enabled(), null, false, early).alerts[0].fireAt).toBe("2026-03-28T09:00:00+05:30");
    expect([0, 1, 7].map(dueText)).toEqual(["Due today", "Due tomorrow", "Due in 7 days"]);
    expect(build({ accounts: [card({ dueDay: 29 })], now: new Date("2026-03-28T20:00:00Z") })[0].daysLeft).toBe(0);
  });

  it("uses the requested alert hour and preserves leap-day recurrence anchors", () => {
    expect(billAlerts([row()], enabled(), null, false, now, 14).alerts[0].fireAt).toBe("2026-03-31T14:00:00+05:30");
    const bills = build({ subscriptions: [subscription("yearly", "2024-02-29")], now: at("2027-02-01") });
    expect(bills[0].due).toBe("2027-02-28");
    expect(build({ subscriptions: [subscription("monthly", "2026-01-31")], now: at("2026-02-28") })[0].due).toBe("2026-02-28");
    expect(build({ subscriptions: [subscription("monthly", "2026-01-31")], now: at("2026-03-01") })[0].due).toBe("2026-03-31");
  });

  it("omits entire account numbers from notification names", () => {
    for (const name of ["Demo card 1234567890", "Demo card 1234 5678 9012", "Demo card 1234-5678-9012", "Demo card 9012"]) {
      expect(billAlerts([row({ name })], enabled(), null, false, now).alerts[0].body).toBe("Demo card · 3 Apr");
    }
    expect(billAlerts([row({ name: "1234-5678" })], enabled(), null, false, now).alerts[0].body).toBe("Card bill · 3 Apr");
  });

  it("defensively decodes state, retains the most recent 200 paid ids, and round-trips wow", () => {
    for (const raw of [{}, null, [], { paid: 7, muted: false, leadDays: 2, alertsOn: "yes", amountsInAlerts: 1 }, { paid: ["demo", 1], muted: [1] }]) {
      expect(normaliseBillState(raw)).toEqual(emptyBillState());
    }
    const ids = Array.from({ length: 201 }, (_, i) => "card:demo-" + String(i).padStart(3, "0") + ":2026-04-01");
    const state = normaliseBillState({ paid: [...ids, "card:demo-old:2025-01-01", ids[0]], muted: ["card:demo-z", "card:demo-a", "card:demo-z"], leadDays: 99, alertsOn: true });
    expect(state.paid).toEqual(ids.slice(1));
    expect(state.muted).toEqual(["card:demo-a", "card:demo-z"]);
    expect(state.leadDays).toBe(3);
    expect(state.alertsOn).toBe(true);
    const wow = { ...emptyWow(), bills: state };
    expect(normaliseWow(JSON.parse(JSON.stringify(wow)))).toEqual(wow);
    expect(normaliseWow({ bills: 42 }).bills).toEqual(emptyBillState());
    expect(normaliseWow({ extraPaise: 100, fees: [], plannedCancels: ["demo-service"] })).toEqual({ ...emptyWow(), extraPaise: 100, plannedCancels: ["demo-service"] });
  });
});
