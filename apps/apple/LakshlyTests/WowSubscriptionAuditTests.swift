import XCTest
@testable import Lakshly

final class WowSubscriptionAuditTests: XCTestCase {
  func testMonthlyDetectionAndNextDate() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("a", "2026-05-11", -64_900, "Demo Stream Box", "subscriptions"),
      txn("b", "2026-06-11", -64_900, "Demo Stream Box", "subscriptions"),
      txn("c", "2026-07-11", -64_900, "Demo Stream Box", "subscriptions"),
    ], now: day(2026, 7, 20), planned: [])
    let item = try XCTUnwrap(audit.items.first)
    XCTAssertEqual(item.id, "demo stream box")
    XCTAssertEqual(item.name, "Demo Stream Box")
    XCTAssertEqual(item.kind, "video")
    XCTAssertEqual(item.charges, 3)
    XCTAssertEqual(item.cadence, .monthly)
    XCTAssertEqual(item.lastDate, "2026-07-11")
    XCTAssertEqual(item.lastPaise, 64_900)
    XCTAssertEqual(item.typicalPaise, 64_900)
    XCTAssertEqual(item.monthlyPaise, 64_900)
    XCTAssertEqual(item.yearlyPaise, 64_900 * 12)
    XCTAssertEqual(item.nextDate, "2026-08-11")
    XCTAssertEqual(SubscriptionAudit.scheduleLine(item), "Monthly · next 11 Aug")
    XCTAssertEqual(item.flags, [])
    XCTAssertEqual(item.verdict, "Keep")
  }

  func testSingleSubscriptionChargeIsMonthly() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("n", "2026-08-01", -5_000, "Sample News Daily", "subscriptions"),
      txn("once", "2026-08-02", -9_000, "Demo Cinema Night", "entertainment"),
    ], now: day(2026, 8, 10), planned: [])
    XCTAssertEqual(audit.items.map(\.name), ["Sample News Daily"])
    let item = try XCTUnwrap(audit.items.first)
    XCTAssertEqual(item.kind, "news")
    XCTAssertEqual(item.cadence, .monthly)
    XCTAssertEqual(item.nextDate, "2026-09-01")
    XCTAssertEqual(item.monthlyPaise, 5_000)
    XCTAssertEqual(item.yearlyPaise, 60_000)
  }

  func testYearlyQuarterlyWeeklyAndIrregularNormalisation() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("y1", "2025-01-15", -120_000, "Example Cloud Backup", "subscriptions"),
      txn("y2", "2026-01-15", -120_000, "Example Cloud Backup", "subscriptions"),
      txn("q1", "2026-01-01", -30_000, "Demo Magazine Post", "subscriptions"),
      txn("q2", "2026-04-01", -30_000, "Demo Magazine Post", "subscriptions"),
      txn("w1", "2026-04-01", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("w2", "2026-04-08", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("w3", "2026-04-15", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("i1", "2026-01-01", -20_000, "Demo Odd Club", "entertainment"),
      txn("i2", "2026-07-20", -20_000, "Demo Odd Club", "entertainment"),
    ], now: day(2026, 4, 20), planned: [])
    let yearly = try XCTUnwrap(audit.items.first { $0.name == "Example Cloud Backup" })
    XCTAssertEqual(yearly.cadence, .yearly)
    XCTAssertEqual(yearly.kind, "cloud")
    XCTAssertEqual(yearly.monthlyPaise, 120_000 / 12)
    XCTAssertEqual(yearly.yearlyPaise, yearly.monthlyPaise * 12)
    XCTAssertEqual(yearly.nextDate, "2027-01-15")
    let quarterly = try XCTUnwrap(audit.items.first { $0.name == "Demo Magazine Post" })
    XCTAssertEqual(quarterly.cadence, .quarterly)
    XCTAssertEqual(quarterly.kind, "news")
    XCTAssertEqual(quarterly.monthlyPaise, 10_000)
    XCTAssertEqual(quarterly.yearlyPaise, 120_000)
    let weekly = try XCTUnwrap(audit.items.first { $0.name == "Sample Radio Hour" })
    XCTAssertEqual(weekly.cadence, .weekly)
    XCTAssertEqual(weekly.kind, "music")
    XCTAssertEqual(weekly.monthlyPaise, 7_000 * 52 / 12)
    XCTAssertEqual(weekly.yearlyPaise, weekly.monthlyPaise * 12)
    XCTAssertEqual(weekly.nextDate, "2026-04-22")
    let irregular = try XCTUnwrap(audit.items.first { $0.name == "Demo Odd Club" })
    XCTAssertEqual(irregular.cadence, .irregular)
    XCTAssertNil(irregular.nextDate)
    XCTAssertEqual(irregular.monthlyPaise, 40_000 * 30 / 200)
    XCTAssertEqual(irregular.yearlyPaise, irregular.monthlyPaise * 12)
  }

  func testPriceUpFlag() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("p1", "2026-03-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p2", "2026-04-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p3", "2026-05-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p4", "2026-06-05", -13_000, "Demo Stream Plus", "subscriptions"),
    ], now: day(2026, 6, 10), planned: [])
    let item = try XCTUnwrap(audit.items.first)
    XCTAssertEqual(item.lastPaise, 13_000)
    XCTAssertEqual(item.typicalPaise, 10_000)
    XCTAssertEqual(item.flags.map(\.text), ["Price up 30%"])
    XCTAssertEqual(item.verdict, "Worth a look")
  }

  func testDoubleChargeFlag() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("d1", "2026-04-10", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d2", "2026-05-10", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d3", "2026-05-20", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d4", "2026-06-10", -20_000, "Sample Tunes Desk", "subscriptions"),
    ], now: day(2026, 6, 15), planned: [])
    let item = try XCTUnwrap(audit.items.first)
    XCTAssertEqual(item.cadence, .monthly)
    XCTAssertEqual(item.flags.map(\.text), ["Charged twice in May"])
    XCTAssertEqual(item.verdict, "Worth a look")
  }

  func testLapsedSubscription() throws {
    let audit = SubscriptionAudit.build(transactions: [
      txn("l1", "2026-01-04", -15_000, "Demo Stream Old", "subscriptions"),
      txn("l2", "2026-02-04", -15_000, "Demo Stream Old", "subscriptions"),
      txn("l3", "2026-03-04", -15_000, "Demo Stream Old", "subscriptions"),
    ], now: day(2026, 6, 1), planned: [])
    let item = try XCTUnwrap(audit.items.first)
    XCTAssertEqual(item.cadence, .monthly)
    XCTAssertTrue(item.lapsed)
    XCTAssertEqual(item.flags.map(\.text), ["No charge since 4 Mar, may be cancelled already"])
    XCTAssertEqual(item.verdict, "Looks cancelled")
    XCTAssertEqual(audit.monthlyTotalPaise, 0)
    XCTAssertEqual(audit.yearlyTotalPaise, 0)
  }

  func testOverlapOfTwoVideoServices() {
    let audit = SubscriptionAudit.build(transactions: [
      txn("v1", "2026-05-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("v2", "2026-06-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("v3", "2026-07-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("f1", "2026-05-02", -29_900, "Sample Flix Two", "subscriptions"),
      txn("f2", "2026-06-02", -29_900, "Sample Flix Two", "subscriptions"),
      txn("f3", "2026-07-02", -29_900, "Sample Flix Two", "subscriptions"),
    ], now: day(2026, 7, 20), planned: [])
    XCTAssertEqual(audit.overlaps["video"], ["Demo Stream One", "Sample Flix Two"])
    XCTAssertEqual(audit.items.map(\.name), ["Demo Stream One", "Sample Flix Two"])
    for item in audit.items {
      XCTAssertEqual(item.kind, "video")
      XCTAssertEqual(item.flags.map(\.text), ["2 video services"])
      XCTAssertEqual(item.verdict, "Worth a look")
    }
  }

  func testRentEmiInsuranceAndOtherNeedsAreExcluded() {
    var rows: [Transaction] = []
    let blocked: [(String, String)] = [
      ("Demo Rent Co", "rent"),
      ("Demo EMI Desk", "emi"),
      ("Demo Cover Plan", "insurance"),
      ("Demo Mart", "groceries"),
      ("Demo Pump", "fuel"),
      ("Demo Power", "utilities"),
      ("Demo Sample Fund", "investments"),
      ("Demo Transfer", "transfers"),
    ]
    for (index, pair) in blocked.enumerated() {
      rows.append(txn("b\(index)a", "2026-05-03", -50_000, pair.0, pair.1, recurring: true))
      rows.append(txn("b\(index)b", "2026-06-03", -50_000, pair.0, pair.1, recurring: true))
    }
    rows.append(txn("keep", "2026-06-01", -9_900, "Demo Stream Keep", "subscriptions"))
    rows.append(txn("cafe1", "2026-05-08", -4_000, "Demo Cafe Club", "dining", recurring: true))
    rows.append(txn("cafe2", "2026-06-08", -4_000, "Demo Cafe Club", "dining", recurring: true))
    rows.append(txn("show", "2026-06-02", -8_000, "Sample Cinema Once", "entertainment"))
    let names = Set(SubscriptionAudit.build(transactions: rows, now: day(2026, 6, 20), planned: []).items.map(\.name))
    XCTAssertTrue(names.contains("Demo Stream Keep"))
    XCTAssertTrue(names.contains("Demo Cafe Club"))
    XCTAssertFalse(names.contains("Demo Rent Co"))
    XCTAssertFalse(names.contains("Demo EMI Desk"))
    XCTAssertFalse(names.contains("Demo Cover Plan"))
    XCTAssertFalse(names.contains("Demo Mart"))
    XCTAssertFalse(names.contains("Demo Pump"))
    XCTAssertFalse(names.contains("Demo Power"))
    XCTAssertFalse(names.contains("Demo Sample Fund"))
    XCTAssertFalse(names.contains("Demo Transfer"))
    XCTAssertFalse(names.contains("Sample Cinema Once"))
  }

  func testPlannedSavingsAndAfterPlanTotals() {
    let rows = [
      txn("s1", "2026-05-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("s2", "2026-06-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("s3", "2026-07-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("t1", "2026-05-12", -10_000, "Sample Tunes Plan", "subscriptions"),
      txn("t2", "2026-06-12", -10_000, "Sample Tunes Plan", "subscriptions"),
      txn("t3", "2026-07-12", -10_000, "Sample Tunes Plan", "subscriptions"),
    ]
    let audit = SubscriptionAudit.build(
      transactions: rows, now: day(2026, 7, 20), planned: ["demo stream plan", "missing"])
    XCTAssertEqual(audit.items.map(\.yearlyPaise), [360_000, 120_000])
    XCTAssertEqual(audit.monthlyTotalPaise, 40_000)
    XCTAssertEqual(audit.yearlyTotalPaise, 480_000)
    XCTAssertEqual(audit.plannedSavingsYearlyPaise, 360_000)
    XCTAssertEqual(audit.yearlyAfterPlanPaise, 120_000)
  }

  @MainActor
  func testDemoSeedFindsStreamingCloudAndMusic() throws {
    let dataset = try DataStore.loadSeed()
    let audit = SubscriptionAudit.build(
      transactions: dataset.transactions, now: Review.demoNow(dataset), planned: [])
    let stream = try XCTUnwrap(audit.items.first { $0.name == "Demo Stream+" })
    let cloud = try XCTUnwrap(audit.items.first { $0.name == "Example Cloud Storage" })
    let music = try XCTUnwrap(audit.items.first { $0.name == "Sample Tunes Pro" })
    XCTAssertTrue(stream.name.hasPrefix("Demo"))
    XCTAssertEqual(stream.kind, "video")
    XCTAssertTrue(cloud.name.hasPrefix("Example"))
    XCTAssertEqual(cloud.kind, "cloud")
    XCTAssertTrue(music.name.hasPrefix("Sample"))
    XCTAssertEqual(music.kind, "music")
    XCTAssertTrue(audit.items.contains { !$0.flags.isEmpty })
  }

  private func txn(
    _ id: String, _ date: String, _ amount: Int64, _ merchant: String, _ category: String,
    recurring: Bool? = nil
  ) -> Transaction {
    Transaction(
      id: id, accountId: "demo", date: date, amount: amount, description: merchant, merchant: merchant,
      category: category, method: nil, recurring: recurring, tags: nil, categorisedBy: "rule")
  }

  private func day(_ year: Int, _ month: Int, _ day: Int) -> Date {
    Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
  }
}
