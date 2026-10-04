import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataset } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { answerQuestion, readAskCounts, takeAsk, ASK_LIMIT } from "@/lib/ask";
import { netWorth } from "@/lib/selectors";

const books = {
  accounts: dataset.accounts,
  transactions: dataset.transactions,
  debts: dataset.debts ?? [],
};

describe("ask lakshly", () => {
  it("answers net worth from this device and marks the calculation", () => {
    const reply = answerQuestion("What's my net worth?", books);
    expect(reply.calc).toBe(true);
    expect(reply.text).toContain(formatINR(netWorth(dataset.accounts).net));
    expect(reply.text).toContain("my calc");
    expect(reply.text).not.toMatch(/https?:/i);
  });

  it("answers spend, category, and debt without leaving the books", () => {
    expect(answerQuestion("What did I spend?", books).text).toMatch(/spent/);
    expect(answerQuestion("Where did most of it go?", books).calc).toBe(true);
    expect(answerQuestion("What do I owe?", books).text).toContain(books.debts[0].name);
    expect(answerQuestion("hello there", books)).toEqual({
      text: expect.stringContaining("Nothing is sent"),
      calc: false,
    });
  });

  it("stops at the monthly cap and ignores junk storage", () => {
    expect(ASK_LIMIT.free).toBe(10);
    expect(ASK_LIMIT.premium).toBe(100);
    let counts: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      const step = takeAsk(counts, "2026-10", ASK_LIMIT.free);
      expect(step.allowed).toBe(true);
      counts = step.counts;
    }
    expect(takeAsk(counts, "2026-10", ASK_LIMIT.free).allowed).toBe(false);
    expect(takeAsk(counts, "2026-10", ASK_LIMIT.premium).allowed).toBe(true);
    expect(readAskCounts('{"2026-10":2,"nope":4,"bad":"x"}')).toEqual({ "2026-10": 2 });
    expect(readAskCounts("not json")).toEqual({});
  });

  it("does not call the network", () => {
    const src = readFileSync(new URL("../lib/ask.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/\bfetch\b/);
    expect(src).not.toMatch(/XMLHttpRequest/);
  });
});
