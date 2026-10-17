import XCTest
@testable import Lakshly

final class WowStoryTests: XCTestCase {
  private let september = date(2026, 9, 18, 19)

  func testSavingsRateIgnoresTransfersInvestmentsAndCardBills() {
    let story = build(month: "2026-09", transactions: [
      txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
      txn("rent", "2026-09-02", -400_000, "Demo Rent Co", "rent"),
      txn("cafe", "2026-09-03", -100_000, "Demo Cafe", "dining"),
      txn("move", "2026-09-04", -9_000_000, "Self transfer", "transfers"),
      txn("sip", "2026-09-05", -2_000_000, "Demo Sample Fund", "investments"),
      txn("bill", "2026-09-06", -8_000_000, "CARD BILL payment", "fees"),
      txn("credit", "2026-09-07", 500_000, "Demo Refund", "shopping"),
    ], now: september)
    XCTAssertEqual(story.incomePaise, 1_000_000)
    XCTAssertEqual(story.spendPaise, 500_000)
    XCTAssertEqual(story.savingsRate ?? -1, 50, accuracy: 0.001)
    XCTAssertNil(story.spendChangePct)
    XCTAssertEqual(story.label, "September 2026")
  }

  func testSpendChangeUsesThePreviousMonthWithSpend() {
    let story = build(month: "2026-09", transactions: [
      txn("aug", "2026-08-11", -200_000, "Demo Mart", "groceries"),
      txn("sep", "2026-09-11", -150_000, "Demo Mart", "groceries"),
    ], now: september)
    XCTAssertEqual(story.spendChangePct ?? 0, -25, accuracy: 0.001)
    XCTAssertNil(build(month: "2026-08", transactions: [
      txn("aug", "2026-08-11", -200_000, "Demo Mart", "groceries"),
    ], now: september).spendChangePct)
  }

  func testTopWantSkipsNeeds() {
    var review = ReviewState()
    review.decisions["arcade"] = ReviewDecision(
      category: "other", nwv: .vice, action: .confirm, at: "2026-09-04T10:00:00Z")
    let transactions = [
      txn("grocer", "2026-09-02", -500_000, "Demo Mart", "groceries"),
      txn("cafe", "2026-09-03", -120_000, "Demo Cafe", "dining"),
      txn("arcade", "2026-09-04", -180_000, "Demo Arcade", "other"),
    ]
    let story = build(month: "2026-09", transactions: transactions, review: review, now: september)
    XCTAssertEqual(story.topCategory.name, "groceries")
    XCTAssertEqual(story.topCategory.paise, 500_000)
    XCTAssertEqual(story.topWant?.merchant, "Demo Arcade")
    XCTAssertEqual(story.topWant?.paise, 180_000)
    XCTAssertEqual(story.wantsSharePct, Double(300_000) / Double(800_000) * 100, accuracy: 0.001)
    XCTAssertNotEqual(story.topWant?.merchant, "Demo Mart")
  }

  func testBudgetsKeptCountsCategoriesWithinLimit() {
    let story = build(
      month: "2026-09",
      transactions: [
        txn("food", "2026-09-02", -40_000, "Demo Cafe", "dining"),
        txn("shop", "2026-09-03", -20_000, "Demo Bazaar", "shopping"),
      ],
      budgets: [
        Budget(id: "d", month: "2026-09", category: "dining", limit: 50_000, rollover: nil),
        Budget(id: "s", month: "2026-09", category: "shopping", limit: 10_000, rollover: nil),
        Budget(id: "old", month: "2026-08", category: "dining", limit: 1, rollover: nil),
      ],
      now: september)
    XCTAssertEqual(story.budgetsKept, 1)
    XCTAssertEqual(story.budgetsTotal, 2)
  }

  func testWinRuleOrder() {
    let every = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
        txn("aug", "2026-08-02", -400_000, "Demo Mart", "groceries"),
        txn("sep", "2026-09-02", -200_000, "Demo Mart", "groceries"),
      ],
      budgets: [Budget(id: "g", month: "2026-09", category: "groceries", limit: 500_000, rollover: nil)],
      now: september)
    XCTAssertEqual(every.win, "Every budget kept 🎯")

    let less = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
        txn("aug", "2026-08-02", -400_000, "Demo Mart", "groceries"),
        txn("sep", "2026-09-02", -200_000, "Demo Mart", "groceries"),
      ],
      budgets: [Budget(id: "g", month: "2026-09", category: "groceries", limit: 100_000, rollover: nil)],
      now: september)
    XCTAssertEqual(less.win, "Spent 50% less than August 📉")

    let saved = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
        txn("sep", "2026-09-02", -800_000, "Demo Mart", "groceries"),
      ],
      budgets: [Budget(id: "g", month: "2026-09", category: "groceries", limit: 100_000, rollover: nil)],
      now: september)
    XCTAssertEqual(saved.savingsRate ?? -1, 20, accuracy: 0.001)
    XCTAssertEqual(saved.win, "Saved 20% of income 💪")

    let kept = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
        txn("sep", "2026-09-02", -900_000, "Demo Mart", "groceries"),
        txn("cafe", "2026-09-03", -10_000, "Demo Cafe", "dining"),
      ],
      budgets: [
        Budget(id: "g", month: "2026-09", category: "groceries", limit: 100_000, rollover: nil),
        Budget(id: "d", month: "2026-09", category: "dining", limit: 50_000, rollover: nil),
      ],
      now: september)
    XCTAssertEqual(kept.win, "Kept 1 of 2 budgets ✅")

    let showedUp = build(
      month: "2026-09",
      transactions: [txn("sep", "2026-09-02", -100_000, "Demo Mart", "groceries")],
      now: september)
    XCTAssertEqual(showedUp.win, "You showed up and looked. That counts ✍️")
  }

  func testPartialFlagFollowsReviewNow() {
    let rows = [txn("sep", "2026-09-02", -100_000, "Demo Mart", "groceries")]
    XCTAssertTrue(build(month: "2026-09", transactions: rows, now: september).partial)
    XCTAssertFalse(build(month: "2026-08", transactions: rows, now: september).partial)
    let october = date(2026, 10, 2, 19)
    XCTAssertFalse(build(month: "2026-09", transactions: rows, now: october).partial)
  }

  func testSlidesCountAndOrder() {
    var review = ReviewState()
    let week = ReviewDates.isoWeek("2026-09-14")
    review.weekXP = [week: 12, ReviewDates.isoWeek("2026-08-03"): 9]
    let story = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 500_000, "Demo Employer", "income"),
        txn("cafe", "2026-09-03", -100_000, "Demo Cafe", "dining"),
      ],
      budgets: [Budget(id: "d", month: "2026-09", category: "dining", limit: 200_000, rollover: nil)],
      review: review,
      now: september)
    let slides = Story.slides(story)
    XCTAssertEqual(slides.map(\.id), ["intro", "win", "category", "want", "budgets", "savings", "worth", "xp", "outro"])
    XCTAssertEqual(slides.map(\.label), [
      "Intro", "Win", "Top category", "Top want", "Budgets", "Savings", "Worth it", "Review XP", "Share",
    ])
    XCTAssertEqual(slides[0].headline, "Your September (so far)")
    XCTAssertEqual(slides[1].headline, story.win)
    XCTAssertEqual(slides[2].headline, "dining")
    XCTAssertEqual(slides[3].headline, "Demo Cafe")
    XCTAssertTrue(slides[3].detail.hasPrefix("Wants share "))
    XCTAssertEqual(slides[6].headline, "Rate a few Wants in Review to see this")
    XCTAssertEqual(slides[7].headline, "+\(story.reviewXP)")
    XCTAssertGreaterThan(story.reviewXP, 0)
    XCTAssertEqual(slides[8].headline, "Share your September")
    XCTAssertEqual(slides[8].detail, "The image shows percentages only, never amounts.")

    let closed = Story.slides(build(
      month: "2026-08",
      transactions: [txn("aug", "2026-08-02", -50_000, "Demo Mart", "groceries")],
      now: september))
    XCTAssertEqual(closed[0].headline, "Your August")
    XCTAssertFalse(closed[0].headline.contains("so far"))
  }

  func testWorthSlideWhenEnoughRatings() {
    var review = ReviewState()
    var transactions: [Transaction] = []
    var reviewTxns: [ReviewTxn] = []
    for index in 0..<5 {
      let id = "w\(index)"
      let row = txn(id, "2026-09-0\(index + 1)", -10_000, "Demo Cafe", "dining")
      transactions.append(row)
      reviewTxns.append(ReviewTxn(row))
      review.worth[id] = index == 4 ? .no : .yes
    }
    let story = build(
      month: "2026-09", transactions: transactions, review: review, reviewTxns: reviewTxns, now: september)
    XCTAssertEqual(story.worth.rated, 5)
    XCTAssertEqual(Story.slides(story)[6].headline, "80% worth it")
  }

  func testShareTilesHaveNoAmounts() {
    let story = build(
      month: "2026-09",
      transactions: [
        txn("in", "2026-09-01", 1_000_000, "Demo Employer", "income"),
        txn("aug", "2026-08-02", -200_000, "Demo Mart", "groceries"),
        txn("sep", "2026-09-02", -150_000, "Demo Cafe", "dining"),
      ],
      budgets: [Budget(id: "d", month: "2026-09", category: "dining", limit: 200_000, rollover: nil)],
      now: september)
    let tiles = Story.shareTiles(story)
    XCTAssertEqual(tiles.map(\.label), [
      "Savings rate", "Wants share", "Spend vs last month", "Budgets kept", "Worth it", "Review XP",
    ])
    XCTAssertEqual(tiles[3].value, "1/1")
    XCTAssertTrue(tiles[2].value.hasPrefix("-") || tiles[2].value.hasPrefix("+") || tiles[2].value == "0%")
    XCTAssertTrue(tiles[5].value.hasPrefix("+"))
    let blob = tiles.map { $0.label + " " + $0.value }.joined(separator: " ")
    XCTAssertNil(blob.range(of: #"\d\s*[₹$€]"#, options: .regularExpression))
    XCTAssertNil(blob.range(of: #"[₹$€]\s*\d"#, options: .regularExpression))
    XCTAssertFalse(blob.contains("₹"))

    let cleaned = Story.shareSafe("Spent ₹1,234.50 on Demo Cafe")
    XCTAssertFalse(cleaned.contains("₹"))
    XCTAssertFalse(cleaned.contains("1,234"))
    XCTAssertTrue(cleaned.contains("Demo Cafe"))
    XCTAssertFalse(Story.shareSafe("Paid $99.00 and €1,000 today").contains("$"))
    XCTAssertFalse(Story.shareSafe("Paid $99.00 and €1,000 today").contains("€"))
    XCTAssertFalse(Story.shareSafe("Paid $99.00 and €1,000 today").contains("1,000"))
  }

  @MainActor func testDemoSeedLatestMonthHasSpendAndAWant() throws {
    let dataset = try DataStore.loadSeed()
    let month = try XCTUnwrap(dataset.transactions.map { String($0.date.prefix(7)) }.sorted().last)
    let reviewTxns = dataset.transactions.map(ReviewTxn.init)
    let story = Story.build(
      month: month,
      transactions: dataset.transactions,
      budgets: dataset.budgets ?? [],
      review: Review.demoSeed(dataset),
      reviewTxns: reviewTxns,
      now: Review.demoNow(dataset))
    XCTAssertGreaterThan(story.spendPaise, 0)
    XCTAssertNotNil(story.topWant)
    XCTAssertFalse(story.month.isEmpty)
  }

  private func build(
    month: String,
    transactions: [Transaction],
    budgets: [Budget] = [],
    review: ReviewState = ReviewState(),
    reviewTxns: [ReviewTxn]? = nil,
    now: Date
  ) -> MonthlyStory {
    Story.build(
      month: month,
      transactions: transactions,
      budgets: budgets,
      review: review,
      reviewTxns: reviewTxns ?? transactions.map(ReviewTxn.init),
      now: now)
  }

  private func txn(_ id: String, _ date: String, _ amount: Int64, _ merchant: String, _ category: String) -> Transaction {
    Transaction(
      id: id, accountId: "demo", date: date, amount: amount, description: merchant, merchant: merchant,
      category: category, method: nil, recurring: nil, tags: nil, categorisedBy: "rule")
  }
}

private func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int) -> Date {
  Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: hour))!
}
