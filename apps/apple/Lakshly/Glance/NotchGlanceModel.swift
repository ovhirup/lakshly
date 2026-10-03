import CoreGraphics
import Foundation

/// What the notch panel is allowed to put in the view tree.
/// Hidden amounts are the redacted placeholder only — never a formatted rupee string.
struct NotchAmountLine: Equatable, Sendable {
  static let redacted = "₹••,•••"
  static let hiddenLabel = "Hidden"

  var visibleText: String
  var accessibilityLabel: String
  var isHidden: Bool

  static func hidden() -> NotchAmountLine {
    NotchAmountLine(visibleText: redacted, accessibilityLabel: hiddenLabel, isHidden: true)
  }

  static func shown(_ paise: Int64) -> NotchAmountLine {
    let text = Money.glance(paise)
    return NotchAmountLine(visibleText: text, accessibilityLabel: text, isHidden: false)
  }
}

struct NotchGlanceContent: Equatable, Sendable {
  var paceWord: String
  var pace: GlancePace
  var spendPercent: Double
  var elapsedPercent: Double
  var budgetUsedText: String
  var monthProgressText: String
  var safeToSpend: NotchAmountLine?
  var upcomingTitle: String?
  var upcomingLabel: String?
  var upcomingDate: String?
  var upcomingAmount: NotchAmountLine?
  var showsNetWorth: Bool
  var netWorthTrend: String?
  var netWorth: NotchAmountLine?
  var revealed: Bool

  var amountLines: [NotchAmountLine] {
    [safeToSpend, upcomingAmount, netWorth].compactMap { $0 }
  }

  /// Every string the panel renders, including accessibility labels. Tests scan this for amount digits.
  var renderedText: [String] {
    var lines = [paceWord, budgetUsedText, monthProgressText]
    if let upcomingTitle { lines.append(upcomingTitle) }
    if let upcomingLabel { lines.append(upcomingLabel) }
    if let upcomingDate { lines.append(upcomingDate) }
    if let netWorthTrend { lines.append(netWorthTrend) }
    for line in amountLines {
      lines.append(line.visibleText)
      lines.append(line.accessibilityLabel)
    }
    return lines
  }
}

enum NotchGlanceCopy {
  static let noNotchFootnote = "This display has no notch, so Lakshly uses the menu-bar extra instead."

  static var notchedFootnote: String {
    let seconds = Int(NotchRevealPolicy.revealDuration)
    return "Hover or click the notch to see your budget and next bill. Amounts stay hidden until Touch ID and hide again after \(seconds) seconds."
  }

  static func footnote(hasNotch: Bool) -> String {
    hasNotch ? notchedFootnote : noNotchFootnote
  }
}

enum NotchMetrics {
  static let width: CGFloat = 360
  static let bodyHeight: CGFloat = 292
  static let cornerRadius: CGFloat = 20
  static let hoverDelay: TimeInterval = 0.25
  static let leaveDelay: TimeInterval = 0.6
}

enum NotchGlanceModel {
  static func make(
    snapshot: GlanceSnapshot,
    revealed: Bool,
    showsNetWorth: Bool,
    calendar: Calendar = .current
  ) -> NotchGlanceContent {
    let pace = snapshot.budget
    let upcoming = snapshot.nextBill
    return NotchGlanceContent(
      paceWord: pace.status.word,
      pace: pace.status,
      spendPercent: pace.monthSpendPercent,
      elapsedPercent: pace.monthElapsedPercent,
      budgetUsedText: "\(GlanceFormat.percent(pace.monthSpendPercent)) used",
      monthProgressText: "\(GlanceFormat.percent(pace.monthElapsedPercent)) of the month",
      safeToSpend: amount(pace.safeToSpendPerDay, revealed: revealed),
      upcomingTitle: upcoming.map { $0.kind == .sip ? "Next payout" : "Next bill" },
      upcomingLabel: upcoming?.name,
      upcomingDate: upcoming.map { due($0.dueDate, calendar: calendar) },
      upcomingAmount: amount(upcoming?.amount, revealed: revealed),
      showsNetWorth: showsNetWorth,
      netWorthTrend: showsNetWorth ? snapshot.netWorthTrend.word : nil,
      netWorth: showsNetWorth ? amount(snapshot.netWorth, revealed: revealed) : nil,
      revealed: revealed)
  }

  private static func amount(_ paise: Int64?, revealed: Bool) -> NotchAmountLine? {
    guard let paise else { return nil }
    return revealed ? .shown(paise) : .hidden()
  }

  private static func due(_ date: Date, calendar: Calendar) -> String {
    let parts = calendar.dateComponents([.day, .month], from: date)
    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    let monthIndex = (parts.month ?? 1) - 1
    let month = months.indices.contains(monthIndex) ? months[monthIndex] : ""
    return "\(parts.day ?? 0) \(month)"
  }
}
