import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Account, LakshlyDataset, Transaction } from "../lib/schema.gen";
import OverviewPage from "../app/page";

const state = vi.hoisted(() => ({ dataset: null as unknown as LakshlyDataset }));

// Keep the route's data requirements, actual financial calculations, and markup;
// isolate unrelated providers, charts, and browser-only interactions.
vi.mock("@/components/DataState", () => ({
  useData: () => ({ ...state.dataset, dataset: state.dataset, source: "mine" }),
  DataGate: ({ need, children }: { need: ("accounts" | "transactions")[]; children: ReactNode }) =>
    need.some((key) => !state.dataset[key].length) ? createElement("p", null, "Nothing here yet") : children,
}));
vi.mock("@/components/Privacy", () => ({ Amount: ({ children }: { children: ReactNode }) => children, useDoubleTapToggle: () => ({}) }));
vi.mock("@/components/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/SetupParts", () => ({ SetupCard: () => null }));
vi.mock("@/components/ReviewParts", () => ({ ReviewEntryCard: () => null, SundayBanner: () => null, WorthItCard: () => null }));
vi.mock("@/components/Game", () => ({ BackfillCard: () => null, NextUpStrip: () => null, NudgeCard: () => null }));
vi.mock("@/components/charts", () => ({
  CashflowBars: () => createElement("div", null, "Cash flow chart"),
  Donut: () => createElement("div", null, "Spending chart"),
}));

const account = (id: string, patch: Partial<Account> = {}): Account => ({
  id, name: id, type: "mutual_fund", institution: "Synthetic fund", currency: "INR", balance: 1003753,
  invested: 900000, asOf: "2026-08-31", ...patch,
});
const transaction = (id: string, patch: Partial<Transaction> = {}): Transaction => ({
  id, accountId: "fund", date: "2026-09-01", amount: 100000, description: "Synthetic income", category: "income", ...patch,
});
const render = () => renderToStaticMarkup(createElement(OverviewPage));

beforeEach(() => {
  state.dataset = {
    schemaVersion: "0.1.0", currency: "INR", generatedAt: "2026-09-01T00:00:00Z",
    accounts: [account("Balanced fund"), account("Short-term fund", { balance: 255000, invested: 240000 })], transactions: [],
  };
});

describe("Overview after statement imports", () => {
  it("shows holdings-only net worth and every account without inventing cash flow", () => {
    const html = render();
    expect(html).toContain("Net worth");
    expect(html).toContain("₹12,588");
    expect(html).toContain("Balanced fund");
    expect(html).toContain("Short-term fund");
    expect(html).toContain("Add your cash flow");
    expect(html).toMatch(/href="\/import\/?"/);
    expect(html).not.toContain("Nothing here yet");
    expect(html).not.toContain("Cash flow chart");
    expect(html).not.toContain("Income ·");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("also renders when the only transactions are CAS unit-ledger entries", () => {
    state.dataset.transactions = [transaction("cas", { category: "investments", tags: ["units:45.122"] })];
    expect(render()).toContain("Add your cash flow");
    expect(render()).not.toContain("Cash flow chart");
  });

  it("aggregates fund gains across known cost bases and identifies partial coverage", () => {
    expect(render()).toContain("+₹1,188");
    state.dataset.accounts.push(account("Unknown cost", { balance: 500000, invested: undefined }));
    const html = render();
    expect(html).toContain("+₹1,188");
    expect(html).toContain("fund gains (known cost)");
  });

  it("keeps bank cash-flow sections and labels the actual cash-flow month", () => {
    state.dataset.transactions = [
      transaction("income"), transaction("spent", { category: "groceries", amount: -25000 }),
      transaction("later-cas", { date: "2026-10-01", category: "investments", tags: ["units:5.000"] }),
    ];
    const html = render();
    expect(html).toContain("Income · Sep");
    expect(html).toContain("₹1,000");
    expect(html).toContain("25% of income");
    expect(html).toContain("75% savings rate");
    expect(html).toContain("Cash flow chart");
    expect(html).not.toContain("Add your cash flow");
  });

  it("handles spending without income and zero account balances without invalid percentages", () => {
    state.dataset.accounts = [account("Zero balance", { balance: 0, invested: undefined })];
    state.dataset.transactions = [transaction("spent", { category: "groceries", amount: -25000 })];
    const html = render();
    expect(html).toContain("No income recorded");
    expect(html).toContain('aria-valuenow="0"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("keeps the empty-account route gated", () => {
    state.dataset.accounts = [];
    expect(render()).toContain("Nothing here yet");
  });
});
