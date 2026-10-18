import XCTest

@testable import Lakshly

final class BillRadarGlanceTests: XCTestCase {
  private var calendar: Calendar {
    var result = Calendar(identifier: .gregorian)
    result.timeZone = TimeZone(identifier: "Asia/Kolkata")!
    return result
  }

  private var now: Date {
    calendar.date(from: DateComponents(year: 2026, month: 10, day: 18, hour: 12))!
  }

  private var dataset: Dataset {
    Dataset(schemaVersion: "1", generatedAt: "2026-10-18", synthetic: true, notice: nil,
      currency: "INR", accounts: [], transactions: [], budgets: nil, debts: nil, sips: nil, rewards: nil)
  }

  private func snapshot(tier: Tier = .premium, kind: GlanceBillKind = .subscription) -> GlanceSnapshot {
    var result = GlanceBuilder.build(dataset: dataset, now: now, includeAmounts: false,
      tier: tier, calendar: calendar)
    let bill = GlanceBill(name: "Demo renewal", dueDate: now, kind: kind, amount: nil)
    result.bills = [bill]
    result.nextBill = bill
    return result
  }

  func testOldSnapshotWithoutBillsAndUnknownKindStillDecodes() throws {
    let original = snapshot()
    let data = try GlanceCoding.encoder().encode(original)
    var object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    object.removeValue(forKey: "bills")
    var bill = try XCTUnwrap(object["nextBill"] as? [String: Any])
    bill["kind"] = "future-kind"
    object["nextBill"] = bill
    let legacy = try GlanceCoding.decoder().decode(GlanceSnapshot.self,
      from: JSONSerialization.data(withJSONObject: object))
    XCTAssertEqual(legacy.version, 1)
    XCTAssertTrue(legacy.bills.isEmpty)
    XCTAssertEqual(legacy.nextBill?.kind, .card)
    object["bills"] = Array(repeating: bill, count: 8)
    let future = try GlanceCoding.decoder().decode(GlanceSnapshot.self,
      from: JSONSerialization.data(withJSONObject: object))
    XCTAssertEqual(future.bills.count, 6)
    XCTAssertEqual(future.bills.first?.kind, .card)
    XCTAssertEqual(future.nextBill, future.bills.first)
  }

  func testBuilderUsesFeeFirstAndOmitsPaidAndCancelledBills() {
    let fees = [
      WowFee(id: "demo-fee", name: "Demo annual fee", amount: 10_000, due: "2026-10-18", yearly: false),
      WowFee(id: "demo-policy", name: "Demo insurance", amount: 20_000, due: "2026-10-20", yearly: false),
    ]
    let subscription = SubscriptionItem(id: "demo-renewal", name: "Demo renewal", kind: "music",
      charges: 2, lastDate: "2026-09-19", lastPaise: 1_000, typicalPaise: 1_000,
      cadence: .monthly, monthlyPaise: 1_000, yearlyPaise: 12_000, nextDate: "2026-10-19",
      flags: [], verdict: "Demo recurring")
    let result = GlanceBuilder.build(dataset: dataset, now: now, includeAmounts: true,
      tier: .free, calendar: calendar, fees: fees, subscriptions: [subscription],
      plannedCancels: [], radarState: BillRadarState())
    XCTAssertEqual(result.bills.map(\.kind), [.fee, .subscription, .insurance])
    XCTAssertEqual(result.nextBill, result.bills.first)
    XCTAssertEqual(result.nextBill?.amount, 10_000)
    let hidden = GlanceBuilder.build(dataset: dataset, now: now, includeAmounts: false,
      tier: .premium, calendar: calendar, fees: fees, subscriptions: [subscription],
      plannedCancels: [], radarState: BillRadarState())
    XCTAssertEqual(hidden.bills.count, 3)
    XCTAssertTrue(hidden.bills.allSatisfy { $0.amount == nil })
    let filtered = GlanceBuilder.build(dataset: dataset, now: now, includeAmounts: false,
      tier: .premium, calendar: calendar, fees: fees, subscriptions: [subscription],
      plannedCancels: [subscription.id],
      radarState: BillRadarState(paid: ["fee:demo-fee:2026-10-18"]))
    XCTAssertEqual(filtered.bills.map(\.kind), [.insurance])
    XCTAssertTrue(filtered.bills.allSatisfy { $0.amount == nil })
    XCTAssertNil(filtered.nextBill?.amount)
    XCTAssertTrue(result.omittingAmounts().bills.allSatisfy { $0.amount == nil })
  }

  func testSubscriptionDueTodayNeedsPremiumAndCardRemainsFree() throws {
    XCTAssertNil(LiveActivityPlanner.select(snapshot: snapshot(tier: .free), now: now, calendar: calendar))
    let plan = try XCTUnwrap(LiveActivityPlanner.select(
      snapshot: snapshot(), now: now, calendar: calendar))
    XCTAssertEqual(plan.kind, .bill)
    XCTAssertEqual(plan.subtitle, "Renews today")
    let card = LiveActivityPlanner.select(snapshot: snapshot(tier: .free, kind: .card),
      now: now, calendar: calendar)
    XCTAssertEqual(card?.kind, .bill)
    XCTAssertEqual(card?.subtitle, "Due today")
    for kind in [GlanceBillKind.emi, .sip] {
      XCTAssertEqual(LiveActivityPlanner.select(snapshot: snapshot(tier: .free, kind: kind),
        now: now, calendar: calendar)?.kind, .bill)
    }
    for kind in [GlanceBillKind.insurance, .fee] {
      XCTAssertNil(LiveActivityPlanner.select(snapshot: snapshot(tier: .free, kind: kind),
        now: now, calendar: calendar))
      XCTAssertEqual(LiveActivityPlanner.select(snapshot: snapshot(kind: kind),
        now: now, calendar: calendar)?.subtitle, "Due today")
    }
  }

  func testFreePlannerFindsCardAfterPremiumRenewal() {
    var result = snapshot(tier: .free)
    result.bills.append(GlanceBill(name: "Demo card", dueDate: now, kind: .card, amount: nil))
    XCTAssertEqual(LiveActivityPlanner.select(snapshot: result, now: now,
      calendar: calendar)?.title, "Demo card")
    result.bills = []
    result.nextBill?.kind = .card
    XCTAssertEqual(LiveActivityPlanner.select(snapshot: result, now: now, calendar: calendar)?.kind, .bill)
  }

  func testWidgetRowLimitsAndFreeLegacyFallback() {
    var result = snapshot()
    result.bills = (0..<6).map { index in
      GlanceBill(name: "Demo bill \(index)", dueDate: now, kind: .fee, amount: nil)
    }
    XCTAssertEqual(BillRadarWidgetRows.select(snapshot: result, capacity: 3).count, 3)
    XCTAssertEqual(BillRadarWidgetRows.select(snapshot: result, capacity: 6).count, 6)
    result.tier = .free
    XCTAssertEqual(BillRadarWidgetRows.select(snapshot: result, capacity: 6), [result.bills[0]])
    result.bills = []
    XCTAssertEqual(BillRadarWidgetRows.select(snapshot: result, capacity: 3), [result.nextBill!])
    result.nextBill = nil
    XCTAssertTrue(BillRadarWidgetRows.select(snapshot: result, capacity: 6).isEmpty)
    XCTAssertEqual(BillRadarWidgetRows.dueText(now, now: now, calendar: calendar), "Today")
    XCTAssertEqual(BillRadarWidgetRows.dueText(calendar.date(byAdding: .day, value: 1, to: now)!,
      now: now, calendar: calendar), "Tomorrow")
    XCTAssertEqual(BillRadarWidgetRows.dueText(calendar.date(byAdding: .day, value: 5, to: now)!,
      now: now, calendar: calendar), "In 5 days")
  }
}
