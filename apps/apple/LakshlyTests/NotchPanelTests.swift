import XCTest

@testable import Lakshly

final class NotchGeometryTests: XCTestCase {
  private let panel = CGSize(width: 360, height: 280)

  func testNoNotchWhenTheTopInsetIsZeroOrAnAreaIsMissing() {
    let frame = CGRect(x: 0, y: 0, width: 1400, height: 900)
    let left = CGRect(x: 0, y: 868, width: 600, height: 32)
    let right = CGRect(x: 800, y: 868, width: 600, height: 32)
    XCTAssertNil(NotchGeometry.layout(
      frame: frame, safeAreaTop: 0, auxiliaryTopLeftArea: left, auxiliaryTopRightArea: right, panelSize: panel))
    XCTAssertNil(NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: nil, auxiliaryTopRightArea: right, panelSize: panel))
    XCTAssertNil(NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: left, auxiliaryTopRightArea: nil, panelSize: panel))
    XCTAssertNil(NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: left,
      auxiliaryTopRightArea: CGRect(x: 400, y: 868, width: 200, height: 32), panelSize: panel))
  }

  func testPanelIsCentredOnTheNotchAndFlushWithTheTop() throws {
    let frame = CGRect(x: 100, y: 200, width: 1512, height: 982)
    let left = CGRect(x: 100, y: 1150, width: 656, height: 32)
    let right = CGRect(x: 956, y: 1150, width: 656, height: 32)
    let layout = NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: left, auxiliaryTopRightArea: right, panelSize: panel)
    let placed = try XCTUnwrap(layout)
    XCTAssertEqual(placed.notchRect, CGRect(x: 756, y: 1150, width: 200, height: 32))
    XCTAssertEqual(placed.panelRect, CGRect(x: 676, y: 902, width: 360, height: 280))
    XCTAssertEqual(placed.panelRect.midX, placed.notchRect.midX)
    XCTAssertEqual(placed.panelRect.maxY, frame.maxY)
  }

  func testPanelClampsToTheLeftEdge() throws {
    let frame = CGRect(x: 0, y: 0, width: 1400, height: 900)
    let left = CGRect(x: 0, y: 868, width: 40, height: 32)
    let right = CGRect(x: 140, y: 868, width: 1260, height: 32)
    let placed = try XCTUnwrap(NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: left, auxiliaryTopRightArea: right, panelSize: panel))
    XCTAssertEqual(placed.notchRect.midX, 90)
    XCTAssertEqual(placed.panelRect.minX, frame.minX)
    XCTAssertEqual(placed.panelRect.maxY, frame.maxY)
    XCTAssertLessThanOrEqual(placed.panelRect.maxX, frame.maxX)
  }

  func testPanelClampsToTheRightEdge() throws {
    let frame = CGRect(x: 0, y: 0, width: 1400, height: 900)
    let left = CGRect(x: 0, y: 868, width: 1200, height: 32)
    let right = CGRect(x: 1320, y: 868, width: 80, height: 32)
    let placed = try XCTUnwrap(NotchGeometry.layout(
      frame: frame, safeAreaTop: 32, auxiliaryTopLeftArea: left, auxiliaryTopRightArea: right, panelSize: panel))
    XCTAssertEqual(placed.notchRect.midX, 1260)
    XCTAssertEqual(placed.panelRect.maxX, frame.maxX)
    XCTAssertEqual(placed.panelRect.minX, 1040)
    XCTAssertEqual(placed.panelRect.maxY, frame.maxY)
  }

  func testNotchedScreenPrefersTheBuiltInDisplay() {
    let external = screen(x: 2000, builtIn: false, notched: true)
    let plainBuiltIn = screen(x: 0, builtIn: true, notched: false)
    let notchedBuiltIn = screen(x: 4000, builtIn: true, notched: true)
    XCTAssertEqual(
      NotchGeometry.notchedScreen(in: [external, plainBuiltIn, notchedBuiltIn])?.frame,
      notchedBuiltIn.frame)
    XCTAssertEqual(
      NotchGeometry.notchedScreen(in: [plainBuiltIn, external])?.frame,
      external.frame)
    XCTAssertNil(NotchGeometry.notchedScreen(in: [plainBuiltIn, screen(x: 10, builtIn: false, notched: false)]))
  }

  private func screen(x: CGFloat, builtIn: Bool, notched: Bool) -> NotchScreenDescriptor {
    let frame = CGRect(x: x, y: 0, width: 1400, height: 900)
    let left = notched ? CGRect(x: x, y: 868, width: 600, height: 32) : nil
    let right = notched ? CGRect(x: x + 800, y: 868, width: 600, height: 32) : nil
    return NotchScreenDescriptor(
      frame: frame, safeAreaTop: notched ? 32 : 0,
      auxiliaryTopLeftArea: left, auxiliaryTopRightArea: right, isBuiltIn: builtIn)
  }
}

final class NotchRevealPolicyTests: XCTestCase {
  private let now = Date(timeIntervalSince1970: 1_700_000_000)

  func testAmountsStartHidden() {
    XCTAssertEqual(NotchRevealState.initial.panelEnabled, true)
    XCTAssertNil(NotchRevealState.initial.revealedUntil)
    XCTAssertFalse(NotchRevealState.initial.isRevealed)
  }

  func testRevealLastsThirtySeconds() {
    let revealed = NotchRevealPolicy.reduce(.initial, .reveal(now: now))
    XCTAssertEqual(NotchRevealPolicy.revealDuration, 30)
    XCTAssertEqual(revealed.revealedUntil, now.addingTimeInterval(30))
    XCTAssertTrue(revealed.isRevealed)
    let early = NotchRevealPolicy.reduce(revealed, .tick(now: now.addingTimeInterval(29)))
    XCTAssertTrue(early.isRevealed)
    let due = NotchRevealPolicy.reduce(revealed, .tick(now: now.addingTimeInterval(30)))
    XCTAssertFalse(due.isRevealed)
    XCTAssertTrue(due.panelEnabled)
  }

  func testCollapseLockSleepAndSpaceChangeHideAmounts() {
    let revealed = NotchRevealPolicy.reduce(.initial, .reveal(now: now))
    for event in [NotchRevealEvent.collapse, .lock, .sleep, .spaceChange] {
      let next = NotchRevealPolicy.reduce(revealed, event)
      XCTAssertFalse(next.isRevealed, "\(event)")
      XCTAssertTrue(next.panelEnabled, "\(event)")
      XCTAssertNil(next.revealedUntil, "\(event)")
    }
  }

  func testLosingTheEntitlementDisablesThePanelAndHidesAmounts() {
    let revealed = NotchRevealPolicy.reduce(.initial, .reveal(now: now))
    let blocked = NotchRevealPolicy.reduce(revealed, .configure(enabled: true, entitled: false, hasNotch: true))
    XCTAssertEqual(blocked, .disabled)
    XCTAssertFalse(blocked.isRevealed)
    let stillBlocked = NotchRevealPolicy.reduce(blocked, .reveal(now: now))
    XCTAssertEqual(stillBlocked, .disabled)
  }

  func testToggleOrMissingNotchDisablesThePanel() {
    XCTAssertEqual(
      NotchRevealPolicy.reduce(.initial, .configure(enabled: false, entitled: true, hasNotch: true)),
      .disabled)
    XCTAssertEqual(
      NotchRevealPolicy.reduce(.initial, .configure(enabled: true, entitled: true, hasNotch: false)),
      .disabled)
    let enabled = NotchRevealPolicy.reduce(.disabled, .configure(enabled: true, entitled: true, hasNotch: true))
    XCTAssertTrue(enabled.panelEnabled)
    XCTAssertFalse(enabled.isRevealed)
  }
}

final class NotchGlanceModelTests: XCTestCase {
  private var utc: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    return calendar
  }

  func testNotchPanelIsPremium() {
    XCTAssertEqual(Feature.notchPanel.rawValue, "glance.notchPanel")
    XCTAssertEqual(EntitlementsMap.standard[.notchPanel], .premium)
    XCTAssertFalse(can(.notchPanel, tier: .free))
    XCTAssertTrue(can(.notchPanel, tier: .premium))
  }

  func testNotchPreferenceDefaultsOff() throws {
    let domain = "app.lakshly.notch-pref.\(UUID().uuidString)"
    let preferences = try XCTUnwrap(UserDefaults(suiteName: domain))
    defer { preferences.removePersistentDomain(forName: domain) }
    XCTAssertFalse(GlancePreferences.notchPanel(in: preferences))
    preferences.set(true, forKey: GlancePreferences.notchPanelKey)
    XCTAssertTrue(GlancePreferences.notchPanel(in: preferences))
  }

  func testHiddenContentHasNoDigitsFromSnapshotAmounts() {
    let snapshot = GlanceSnapshot.placeholder
    let hidden = NotchGlanceModel.make(snapshot: snapshot, revealed: false, showsNetWorth: true, calendar: utc)
    let blob = hidden.renderedText.joined(separator: "\n")
    let amounts = [
      snapshot.budget.safeToSpendPerDay, snapshot.nextBill?.amount, snapshot.netWorth, snapshot.debtOutstanding,
    ].compactMap { $0 }
    XCTAssertFalse(amounts.isEmpty)
    for paise in amounts {
      let formatted = Money.glance(paise)
      XCTAssertFalse(blob.contains(formatted), formatted)
      let digits = formatted.filter(\.isNumber)
      XCTAssertFalse(digits.isEmpty)
      XCTAssertFalse(blob.contains(digits), digits)
    }
    XCTAssertFalse(hidden.amountLines.isEmpty)
    for line in hidden.amountLines {
      XCTAssertTrue(line.isHidden)
      XCTAssertEqual(line.visibleText, NotchAmountLine.redacted)
      XCTAssertEqual(line.accessibilityLabel, "Hidden")
      XCTAssertFalse(line.visibleText.contains { $0.isNumber })
    }
    XCTAssertEqual(hidden.budgetUsedText, "42% used")
    XCTAssertEqual(hidden.safeToSpend?.visibleText, NotchAmountLine.redacted)
    XCTAssertEqual(hidden.upcomingLabel, "Rewards Card")
    XCTAssertEqual(hidden.upcomingDate, "25 Sep")
  }

  func testRevealedContentShowsAmountsAndNetWorthStaysBehindItsGate() {
    let snapshot = GlanceSnapshot.placeholder
    let revealed = NotchGlanceModel.make(snapshot: snapshot, revealed: true, showsNetWorth: true, calendar: utc)
    XCTAssertEqual(revealed.safeToSpend?.visibleText, Money.glance(85_000))
    XCTAssertEqual(revealed.upcomingAmount?.visibleText, Money.glance(450_000))
    XCTAssertEqual(revealed.netWorth?.visibleText, Money.glance(56_000_000))
    XCTAssertFalse(revealed.amountLines.contains { $0.isHidden })

    let gated = NotchGlanceModel.make(snapshot: snapshot, revealed: true, showsNetWorth: false, calendar: utc)
    XCTAssertFalse(gated.showsNetWorth)
    XCTAssertNil(gated.netWorth)
    XCTAssertNil(gated.netWorthTrend)
    XCTAssertFalse(gated.renderedText.joined(separator: " ").contains(Money.glance(56_000_000)))

    var withoutSafe = snapshot
    withoutSafe.budget.safeToSpendPerDay = nil
    let noSafe = NotchGlanceModel.make(snapshot: withoutSafe, revealed: false, showsNetWorth: false, calendar: utc)
    XCTAssertNil(noSafe.safeToSpend)
  }

  func testFootnotes() {
    XCTAssertEqual(
      NotchGlanceCopy.notchedFootnote,
      "Hover or click the notch to see your budget and next bill. Amounts stay hidden until Touch ID and hide again after 30 seconds.")
    XCTAssertEqual(
      NotchGlanceCopy.footnote(hasNotch: false),
      "This display has no notch, so Lakshly uses the menu-bar extra instead.")
  }
}
