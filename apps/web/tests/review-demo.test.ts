// The demo review starts from a seed built at runtime from the SYNTHETIC demo dataset.
import { describe, expect, it } from "vitest";
import { dataset } from "../lib/data";
import { demoNow, demoSeed } from "../components/useReview";
import { buildInbox, monthlyRatio, regretMerchants, type ReviewTxn } from "../lib/review";

describe("demo weekly review", () => {
  const txns = dataset.transactions as ReviewTxn[];
  const seed = demoSeed(dataset);
  const now = demoNow(dataset);
  it("uses the synthetic dataset and a fixed demo clock", () => {
    expect(dataset.synthetic).toBe(true);
    expect(now.getHours()).toBe(19);
  });
  it("has about a week waiting, a 2-week streak and a 40% worth-it month", () => {
    const inbox = buildInbox(txns, seed, now);
    expect(inbox.count).toBeGreaterThanOrEqual(5);
    expect(inbox.count).toBeLessThanOrEqual(20);
    expect(inbox.older).toHaveLength(0);
    expect(seed.streak).toBe(2);
    const month = Object.keys(seed.worth).map((id) => txns.find((t) => t.id === id)!.date.slice(0, 7))[0];
    expect(monthlyRatio(txns, seed, month)).toMatchObject({ rated: 5, ratio: 0.4 });
    expect(regretMerchants(txns, seed, now)).toHaveLength(1);
  });
});
