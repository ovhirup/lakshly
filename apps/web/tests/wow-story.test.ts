import { describe, expect, it } from "vitest";
import { budgets, transactions } from "@/lib/data";
import { emptyState, isoWeek, type ReviewState, type ReviewTxn } from "../lib/review";
import type { Budget, Category, Transaction } from "../lib/schema.gen";
import { buildStory, shareSafe, shareTiles, storySlides, type MonthlyStory } from "../lib/wow/story";

const september = new Date(2026, 8, 18, 19);

function txn(id: string, date: string, amount: number, merchant: string, category: Category): Transaction {
  return {
    id, accountId: "demo", date, amount, description: merchant, merchant, category, categorisedBy: "rule",
  };
}

function budget(id: string, month: string, category: Category, limit: number): Budget {
  return { id, month, category, limit };
}

function build(
  month: string,
  rows: Transaction[],
  now: Date,
  monthBudgets: Budget[] = [],
  review: ReviewState = emptyState(),
  reviewTxns?: ReviewTxn[],
): MonthlyStory {
  return buildStory(rows, review, month, monthBudgets, now, reviewTxns);
}

describe("monthly story", () => {
  it("ignores transfers, investments and card bills in the savings rate", () => {
    const story = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("rent", "2026-09-02", -400_000, "Demo Rent Co", "rent"),
      txn("cafe", "2026-09-03", -100_000, "Demo Cafe", "dining"),
      txn("move", "2026-09-04", -9_000_000, "Self transfer", "transfers"),
      txn("sip", "2026-09-05", -2_000_000, "Demo Sample Fund", "investments"),
      txn("bill", "2026-09-06", -8_000_000, "CARD BILL payment", "fees"),
      txn("credit", "2026-09-07", 500_000, "Demo Refund", "shopping"),
    ], september);
    expect(story.incomePaise).toBe(1_000_000);
    expect(story.spendPaise).toBe(500_000);
    expect(story.savingsRate ?? -1).toBeCloseTo(50, 3);
    expect(story.spendChangePct).toBeNull();
    expect(story.label).toBe("September 2026");
  });

  it("compares spend with the previous calendar month", () => {
    const story = build("2026-09", [
      txn("aug", "2026-08-11", -200_000, "Demo Mart", "groceries"),
      txn("sep", "2026-09-11", -150_000, "Demo Mart", "groceries"),
    ], september);
    expect(story.spendChangePct ?? 0).toBeCloseTo(-25, 3);
    expect(build("2026-08", [
      txn("aug", "2026-08-11", -200_000, "Demo Mart", "groceries"),
    ], september).spendChangePct).toBeNull();
  });

  it("picks the biggest want and skips needs", () => {
    const review = emptyState();
    review.decisions.arcade = {
      category: "other", nwv: "vice", action: "confirm", at: "2026-09-04T10:00:00Z",
    };
    const rows = [
      txn("grocer", "2026-09-02", -500_000, "Demo Mart", "groceries"),
      txn("cafe", "2026-09-03", -120_000, "Demo Cafe", "dining"),
      txn("arcade", "2026-09-04", -180_000, "Demo Arcade", "other"),
    ];
    const story = build("2026-09", rows, september, [], review);
    expect(story.topCategory.name).toBe("groceries");
    expect(story.topCategory.paise).toBe(500_000);
    expect(story.topWant?.merchant).toBe("Demo Arcade");
    expect(story.topWant?.paise).toBe(180_000);
    expect(story.wantsSharePct).toBeCloseTo((300_000 / 800_000) * 100, 3);
    expect(story.topWant?.merchant).not.toBe("Demo Mart");
  });

  it("counts budgets kept inside the limit for that month", () => {
    const story = build("2026-09", [
      txn("food", "2026-09-02", -40_000, "Demo Cafe", "dining"),
      txn("shop", "2026-09-03", -20_000, "Demo Bazaar", "shopping"),
    ], september, [
      budget("d", "2026-09", "dining", 50_000),
      budget("s", "2026-09", "shopping", 10_000),
      budget("old", "2026-08", "dining", 1),
    ]);
    expect(story.budgetsKept).toBe(1);
    expect(story.budgetsTotal).toBe(2);
  });

  it("picks the win in rule order", () => {
    const every = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("aug", "2026-08-02", -400_000, "Demo Mart", "groceries"),
      txn("sep", "2026-09-02", -200_000, "Demo Mart", "groceries"),
    ], september, [budget("g", "2026-09", "groceries", 500_000)]);
    expect(every.win).toBe("Every budget kept 🎯");

    const less = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("aug", "2026-08-02", -400_000, "Demo Mart", "groceries"),
      txn("sep", "2026-09-02", -200_000, "Demo Mart", "groceries"),
    ], september, [budget("g", "2026-09", "groceries", 100_000)]);
    expect(less.win).toBe("Spent 50% less than August 📉");

    const saved = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("sep", "2026-09-02", -800_000, "Demo Mart", "groceries"),
    ], september, [budget("g", "2026-09", "groceries", 100_000)]);
    expect(saved.savingsRate ?? -1).toBeCloseTo(20, 3);
    expect(saved.win).toBe("Saved 20% of income 💪");

    const kept = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("sep", "2026-09-02", -900_000, "Demo Mart", "groceries"),
      txn("cafe", "2026-09-03", -10_000, "Demo Cafe", "dining"),
    ], september, [
      budget("g", "2026-09", "groceries", 100_000),
      budget("d", "2026-09", "dining", 50_000),
    ]);
    expect(kept.win).toBe("Kept 1 of 2 budgets ✅");

    const showedUp = build("2026-09", [
      txn("sep", "2026-09-02", -100_000, "Demo Mart", "groceries"),
    ], september);
    expect(showedUp.win).toBe("You showed up and looked. That counts ✍️");
  });

  it("marks the review clock's month as partial", () => {
    const rows = [txn("sep", "2026-09-02", -100_000, "Demo Mart", "groceries")];
    expect(build("2026-09", rows, september).partial).toBe(true);
    expect(build("2026-08", rows, september).partial).toBe(false);
    expect(build("2026-09", rows, new Date(2026, 9, 2, 19)).partial).toBe(false);
  });

  it("builds slides in order", () => {
    const review = emptyState();
    review.weekXP[isoWeek("2026-09-14")] = 12;
    review.weekXP[isoWeek("2026-08-03")] = 9;
    const story = build("2026-09", [
      txn("in", "2026-09-01", 500_000, "Demo Employer", "income"),
      txn("cafe", "2026-09-03", -100_000, "Demo Cafe", "dining"),
    ], september, [budget("d", "2026-09", "dining", 200_000)], review);
    const slides = storySlides(story);
    expect(slides.map((item) => item.id)).toEqual(["intro", "win", "category", "want", "budgets", "savings", "worth", "xp", "outro"]);
    expect(slides.map((item) => item.label)).toEqual([
      "Intro", "Win", "Top category", "Top want", "Budgets", "Savings", "Worth it", "Review XP", "Share",
    ]);
    expect(slides[0].headline).toBe("Your September (so far)");
    expect(slides[1].headline).toBe(story.win);
    expect(slides[2].headline).toBe("dining");
    expect(slides[3].headline).toBe("Demo Cafe");
    expect(slides[3].detail.startsWith("Wants share ")).toBe(true);
    expect(slides[6].headline).toBe("Rate a few Wants in Review to see this");
    expect(slides[7].headline).toBe(`+${story.reviewXP}`);
    expect(story.reviewXP).toBeGreaterThan(0);
    expect(slides[8].headline).toBe("Share your September");
    expect(slides[8].detail).toBe("The image shows percentages only, never amounts.");

    const closed = storySlides(build("2026-08", [
      txn("aug", "2026-08-02", -50_000, "Demo Mart", "groceries"),
    ], september));
    expect(closed[0].headline).toBe("Your August");
    expect(closed[0].headline.includes("so far")).toBe(false);
  });

  it("shows the worth-it share once five wants are rated", () => {
    const review = emptyState();
    const rows: Transaction[] = [];
    const reviewTxns: ReviewTxn[] = [];
    for (let index = 0; index < 5; index += 1) {
      const id = `w${index}`;
      const row = txn(id, `2026-09-0${index + 1}`, -10_000, "Demo Cafe", "dining");
      rows.push(row);
      reviewTxns.push(row);
      review.worth[id] = index === 4 ? "no" : "yes";
    }
    const story = build("2026-09", rows, september, [], review, reviewTxns);
    expect(story.worth.rated).toBe(5);
    expect(storySlides(story)[6].headline).toBe("80% worth it");
  });

  it("keeps amounts off the share tiles", () => {
    const story = build("2026-09", [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("aug", "2026-08-02", -200_000, "Demo Mart", "groceries"),
      txn("sep", "2026-09-02", -150_000, "Demo Cafe", "dining"),
    ], september, [budget("d", "2026-09", "dining", 200_000)]);
    const tiles = shareTiles(story);
    expect(tiles.map((tile) => tile.label)).toEqual([
      "Savings rate", "Wants share", "Spend vs last month", "Budgets kept", "Worth it", "Review XP",
    ]);
    expect(tiles[3].value).toBe("1/1");
    expect(tiles[2].value.startsWith("-") || tiles[2].value.startsWith("+") || tiles[2].value === "0%").toBe(true);
    expect(tiles[5].value.startsWith("+")).toBe(true);
    const blob = tiles.map((tile) => `${tile.label} ${tile.value}`).join(" ");
    expect(blob).not.toMatch(/\d\s*[₹$€]/);
    expect(blob).not.toMatch(/[₹$€]\s*\d/);
    expect(blob.includes("₹")).toBe(false);

    const cleaned = shareSafe("Spent ₹1,234.50 on Demo Cafe");
    expect(cleaned.includes("₹")).toBe(false);
    expect(cleaned.includes("1,234")).toBe(false);
    expect(cleaned.includes("Demo Cafe")).toBe(true);
    const paid = shareSafe("Paid $99.00 and €1,000 today");
    expect(paid.includes("$")).toBe(false);
    expect(paid.includes("€")).toBe(false);
    expect(paid.includes("1,000")).toBe(false);
  });

  it("builds a story for the demo dataset's latest month", () => {
    const months = transactions.map((row) => row.date.slice(0, 7)).sort();
    const month = months[months.length - 1] ?? "";
    const story = buildStory(transactions, emptyState(), month, budgets, new Date(2026, 9, 17, 19));
    expect(month).toMatch(/^\d{4}-\d{2}$/);
    expect(story.month).toBe(month);
    expect(story.spendPaise).toBeGreaterThan(0);
    expect(storySlides(story)).toHaveLength(9);
  });
});
