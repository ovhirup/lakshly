import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Account, LakshlyDataset, Transaction } from "../lib/schema.gen";
import OverviewPage from "../app/page";

const state = vi.hoisted(() => ({ dataset: null as unknown as LakshlyDataset }));

vi.mock("@/components/DataState", () => ({
  useData: () => ({ ...state.dataset, dataset: state.dataset, source: "mine", accounts: state.dataset.accounts, transactions: state.dataset.transactions, debts: [], sips: [], rewards: [] }),
  DataGate: ({ need, children }: { need: ("accounts" | "transactions")[]; children: ReactNode }) =>
    need.some((key) => !(state.dataset[key]?.length)) ? createElement("p", null, "Nothing here yet") : children,
}));
vi.mock("@/components/Privacy", () => ({ Amount: ({ children }: { children: ReactNode }) => children, useDoubleTapToggle: () => ({}) }));
vi.mock("@/components/Icon", () => ({ Icon: () => null }));
vi.mock("@/components/SetupParts", () => ({ SetupCard: () => null }));
vi.mock("@/components/ReviewParts", () => ({ ReviewEntryCard: () => null, WorthItCard: () => null }));
vi.mock("@/components/Game", () => ({ BackfillCard: () => null, NextUpStrip: () => null, NudgeCard: () => null }));
vi.mock("@/components/TodayCard", () => ({ TodayCard: () => null }));
vi.mock("@/components/MergeOffers", () => ({ MergeOffers: () => null }));
vi.mock("@/components/charts", () => ({
  CashflowBars: () => createElement("div", null, "Cash flow chart"),
  Donut: () => createElement("div", null, "Spending chart"),
}));

const account = (id: string, patch: Partial<Account> = {}): Account => ({
  id, name: id, type: "mutual_fund", institution: "Synthetic fund", currency: "INR", balance: 1_003_753,
  invested: 900_000, asOf: "2026-08-31", ...patch,
});
const transaction = (id: string, patch: Partial<Transaction> = {}): Transaction => ({
  id, accountId: "fund", date: "2026-09-01", amount: 100_000, description: "Synthetic income", category: "income", ...patch,
});

beforeEach(() => {
  state.dataset = {
    schemaVersion: "0.1.0", currency: "INR", generatedAt: "2026-09-01T00:00:00Z",
    accounts: [account("Balanced fund"), account("Short-term fund", { balance: 255_000, invested: 240_000 })],
    transactions: [],
  } as LakshlyDataset;
});

const render = () => renderToStaticMarkup(createElement(OverviewPage));

describe("Overview after a holdings-only import", () => {
  it("shows the funds and asks for a bank statement instead of an empty page", () => {
    const html = render();
    expect(html).toContain("Net worth");
    expect(html).toContain("Balanced fund");
    expect(html).toContain("Short-term fund");
    expect(html).toContain("Add your cash flow");
    expect(html).toContain('href="/import"');
    expect(html).not.toContain("Nothing here yet");
    expect(html).not.toContain("Cash flow chart");
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("does not invent cash flow from fund unit rows", () => {
    state.dataset.transactions = [transaction("cas", { category: "investments", tags: ["units:45.122"] })];
    const html = render();
    expect(html).toContain("Add your cash flow");
    expect(html).not.toContain("Cash flow chart");
  });

  it("keeps an empty account list behind the empty state", () => {
    state.dataset.accounts = [];
    expect(render()).toContain("Nothing here yet");
  });
});
