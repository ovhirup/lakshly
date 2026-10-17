import XCTest
@testable import Lakshly

@MainActor
final class WowFeeRunwayTests: XCTestCase {
  private var defaults: UserDefaults!
  private var suite: String!

  override func setUp() {
    super.setUp()
    suite = "app.lakshly.tests.fee-runway.\(UUID().uuidString)"
    defaults = UserDefaults(suiteName: suite)
    defaults.removePersistentDomain(forName: suite)
  }

  override func tearDown() {
    if let suite { defaults?.removePersistentDomain(forName: suite) }
    defaults = nil
    suite = nil
    super.tearDown()
  }

  func testPerMonthCeilsAndMonthsLeftIsAtLeastOne() {
    let now = clock(2026, 1, 15)
    let soon = WowFee(id: "soon", name: "Demo Soon", amount: 100, due: "2026-01-20", yearly: false)
    let later = WowFee(id: "later", name: "Demo Later", amount: 1_000, due: "2026-04-15", yearly: true)
    let plan = FeeRunway.plan(fees: [later, soon], setAside: [:], now: now)
    let soonRow = plan.fees.first { $0.id == "soon" }
    let laterRow = plan.fees.first { $0.id == "later" }
    XCTAssertEqual(soonRow?.monthsLeft, 1)
    XCTAssertEqual(soonRow?.daysLeft, 5)
    XCTAssertEqual(soonRow?.perMonthPaise, 100)
    XCTAssertEqual(laterRow?.monthsLeft, 3)
    XCTAssertEqual(laterRow?.toGoPaise, 1_000)
    XCTAssertEqual(laterRow?.perMonthPaise, 334)
    XCTAssertEqual(plan.fees.map(\.id), ["soon", "later"])
    XCTAssertEqual(plan.monthlyNeedPaise, 434)
  }

  func testFundedOnTrackAndBehind() {
    let now = clock(2026, 1, 15)
    let due = "2026-07-15"
    let funded = WowFee(id: "funded", name: "Demo Funded", amount: 12_000, due: due, yearly: true)
    let steady = WowFee(id: "steady", name: "Demo Steady", amount: 12_000, due: due, yearly: true)
    let late = WowFee(id: "late", name: "Demo Late", amount: 12_000, due: due, yearly: true)
    let open = WowFee(id: "open", name: "Demo Open", amount: 12_000, due: due, yearly: false)
    let plan = FeeRunway.plan(
      fees: [late, funded, open, steady],
      setAside: ["funded": 12_000, "steady": 7_000, "late": 1_000],
      now: now)
    XCTAssertEqual(plan.fees.first { $0.id == "funded" }?.status, .funded)
    XCTAssertEqual(plan.fees.first { $0.id == "funded" }?.fraction, 1)
    XCTAssertEqual(plan.fees.first { $0.id == "funded" }?.perMonthPaise, 0)
    XCTAssertEqual(plan.fees.first { $0.id == "steady" }?.status, .onTrack)
    XCTAssertEqual(plan.fees.first { $0.id == "late" }?.status, .behind)
    XCTAssertEqual(plan.fees.first { $0.id == "open" }?.status, .onTrack)
    XCTAssertEqual(plan.totalPaise, 48_000)
    XCTAssertEqual(plan.fundedPaise, 20_000)
  }

  func testDueBeforeTodayRollsYearlyForwardAndDropsOneOff() {
    let now = clock(2026, 6, 15)
    let yearly = WowFee(id: "year", name: "Demo Cover", amount: 5_000, due: "2026-06-01", yearly: true)
    let once = WowFee(id: "once", name: "Demo One Off", amount: 2_000, due: "2026-06-01", yearly: false)
    let plan = FeeRunway.plan(fees: [once, yearly], setAside: ["year": 8_000, "once": 2_000], now: now)
    XCTAssertEqual(plan.fees.map(\.id), ["year"])
    XCTAssertEqual(plan.fees[0].due, "2027-06-01")
    XCTAssertEqual(plan.fees[0].setAside, 3_000)
    XCTAssertEqual(plan.fees[0].toGoPaise, 2_000)
  }

  func testLogCrossesIntoFundedOnceThenResetAndRemove() {
    let data = makeStore()
    data.setSource(.mine)
    let fee = WowFee(id: "fee-demo", name: "Demo Cover", amount: 10_000, due: "2026-12-01", yearly: true)
    data.addFee(fee)
    XCTAssertFalse(data.logFee(feeId: fee.id, paise: 0))
    XCTAssertFalse(data.logFee(feeId: fee.id, paise: -5))
    XCTAssertFalse(data.logFee(feeId: fee.id, paise: 4_000))
    XCTAssertEqual(data.wowState.setAside[fee.id], 4_000)
    XCTAssertTrue(data.logFee(feeId: fee.id, paise: 6_000))
    XCTAssertFalse(data.logFee(feeId: fee.id, paise: 1))
    XCTAssertEqual(data.wowState.setAside[fee.id], 10_001)

    data.resetFee(feeId: fee.id)
    XCTAssertEqual(data.wowState.setAside[fee.id] ?? 0, 0)
    XCTAssertTrue(data.logFee(feeId: fee.id, paise: 10_000))

    data.removeFee(feeId: fee.id)
    XCTAssertFalse(data.wowState.fees.contains { $0.id == fee.id })
    XCTAssertNil(data.wowState.setAside[fee.id])
    XCTAssertFalse(data.logFee(feeId: fee.id, paise: 500))
  }

  func testLogClampsThePot() {
    let data = makeStore()
    data.setSource(.mine)
    data.addFee(WowFee(id: "cap", name: "Demo Cap", amount: 2_000_000_000_000, due: "2026-12-01", yearly: true))
    XCTAssertFalse(data.logFee(feeId: "cap", paise: 2_000_000_000_000))
    XCTAssertEqual(data.wowState.setAside["cap"], FeeRunway.potMax)
    XCTAssertFalse(data.logFee(feeId: "cap", paise: 10))
    XCTAssertEqual(data.wowState.setAside["cap"], FeeRunway.potMax)
  }

  func testSuggestionFromYearlyInsuranceRow() {
    let now = clock(2026, 3, 1)
    let rows = [
      txn("a", "2025-01-01", -100_000, "Demo Cover Insurance", "insurance"),
      txn("b", "2026-01-01", -120_000, "Demo Cover Insurance", "insurance"),
      txn("recent", "2026-02-01", -50_000, "Demo Recent Cover", "insurance"),
      txn("old", "2025-01-01", -80_000, "Example Old Cover", "insurance"),
      txn("income", "2025-01-01", 80_000, "Example Refund", "insurance"),
      txn("word", "2025-03-01", -2_999, "Sample Club membership", "shopping"),
    ]
    let found = FeeRunway.suggestions(transactions: rows, now: now)
    let yearly = found.first { $0.name == "Demo Cover Insurance" }
    XCTAssertEqual(yearly?.id, "sugg-demo-cover-insurance")
    XCTAssertEqual(yearly?.amount, 120_000)
    XCTAssertEqual(yearly?.due, "2027-01-01")
    XCTAssertEqual(yearly?.yearly, true)
    XCTAssertTrue(found.contains { $0.id == "sugg-example-old-cover" && $0.amount == 80_000 && $0.due == "2026-01-01" })
    XCTAssertTrue(found.contains { $0.id == "sugg-sample-club-membership" && $0.yearly })
    XCTAssertFalse(found.contains { $0.name == "Demo Recent Cover" })
    XCTAssertFalse(found.contains { $0.name == "Example Refund" })

    let again = FeeRunway.suggestions(transactions: rows, now: now, fees: [
      WowFee(id: "sugg-demo-cover-insurance", name: "Demo Cover Insurance", amount: 120_000, due: "2027-01-01", yearly: true)
    ])
    XCTAssertFalse(again.contains { $0.id == "sugg-demo-cover-insurance" })
  }

  func testDemoSeedGivesThreeFeesAndMineStaysEmpty() {
    let data = makeStore()
    XCTAssertEqual(data.source, .demo)
    let plan = data.feeRunwayPlan()
    XCTAssertEqual(plan.fees.count, 3)
    XCTAssertEqual(Set(plan.fees.map(\.name)), [
      "Demo Car Insurance", "Sample Card Co annual fee", "Example Professional Licence",
    ])
    XCTAssertTrue(plan.fees.allSatisfy(\.yearly))
    let car = plan.fees.first { $0.name == "Demo Car Insurance" }
    let card = plan.fees.first { $0.name == "Sample Card Co annual fee" }
    let licence = plan.fees.first { $0.name == "Example Professional Licence" }
    XCTAssertEqual(car?.amount, 1_450_000)
    XCTAssertEqual(car?.setAside, 900_000)
    XCTAssertEqual(card?.amount, 299_900)
    XCTAssertEqual(card?.setAside, 0)
    XCTAssertEqual(licence?.amount, 900_000)
    XCTAssertEqual(licence?.setAside, 200_000)
    XCTAssertEqual(car?.due, shift(4, from: data.reviewNow))
    XCTAssertEqual(card?.due, shift(7, from: data.reviewNow))
    XCTAssertEqual(licence?.due, shift(11, from: data.reviewNow))
    XCTAssertTrue(plan.fees.contains { $0.status == .onTrack || $0.status == .funded })
    XCTAssertEqual(data.wowDemo?.fees.count, 3)
    XCTAssertNil(data.wow)

    data.setSource(.mine)
    XCTAssertTrue(data.feeRunwayPlan().fees.isEmpty)
    XCTAssertTrue(data.wowState.fees.isEmpty)
    XCTAssertTrue((data.wow?.fees ?? []).isEmpty)
    XCTAssertEqual(data.wowDemo?.fees.count, 3)
  }

  private func makeStore() -> DataStore {
    DataStore(backing: MemoryStoredData(), defaults: defaults)
  }

  private func txn(_ id: String, _ date: String, _ amount: Int64, _ merchant: String, _ category: String) -> Transaction {
    Transaction(
      id: id, accountId: "demo", date: date, amount: amount, description: merchant, merchant: merchant,
      category: category, method: nil, recurring: nil, tags: nil, categorisedBy: "rule")
  }

  private func clock(_ year: Int, _ month: Int, _ day: Int) -> Date {
    Calendar.current.date(from: DateComponents(year: year, month: month, day: day, hour: 12))!
  }

  private func shift(_ months: Int, from now: Date) -> String {
    let calendar = Calendar.current
    let shifted = calendar.date(byAdding: .month, value: months, to: now) ?? now
    let bits = calendar.dateComponents([.year, .month, .day], from: shifted)
    return String(format: "%04d-%02d-%02d", bits.year ?? 0, bits.month ?? 1, bits.day ?? 1)
  }
}
