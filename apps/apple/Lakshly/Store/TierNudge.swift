import Foundation

/// One proactive card per intentional Settings visit, at most once every seven days.
struct TierNudgePolicy {
  static let day: TimeInterval = 86_400
  static func eligible(now: Date, lastShown: Date?, snoozedUntil: Date?, intentional: Bool, midTask: Bool = false, shownOnScreen: Bool = false) -> Bool {
    guard intentional, !midTask, !shownOnScreen else { return false }
    if let snoozedUntil, now < snoozedUntil { return false }
    if let lastShown, now.timeIntervalSince(lastShown) < 7 * day { return false }
    return true
  }
  static func snoozeUntil(now: Date) -> Date { now.addingTimeInterval(30 * day) }
}

struct TierNudgeHistory {
  let defaults: UserDefaults
  init(defaults: UserDefaults = .standard) { self.defaults = defaults }
  private let shownKey = "tier.nudge.lastShown"
  private let snoozeKey = "tier.nudge.snoozedUntil"
  func eligible(now: Date, intentional: Bool, shownOnScreen: Bool = false) -> Bool {
    TierNudgePolicy.eligible(now: now, lastShown: defaults.object(forKey: shownKey) as? Date,
      snoozedUntil: defaults.object(forKey: snoozeKey) as? Date, intentional: intentional, shownOnScreen: shownOnScreen)
  }
  func recordShown(now: Date) { defaults.set(now, forKey: shownKey) }
  func snooze(now: Date) { defaults.set(TierNudgePolicy.snoozeUntil(now: now), forKey: snoozeKey) }
}

struct TierMembership {
  static func line(purchaseDate: Date?, expirationDate: Date?, willRenew: Bool?) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_GB")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    var pieces: [String] = []
    if let purchaseDate {
      formatter.dateFormat = "MMM yyyy"
      pieces.append("Member since \(formatter.string(from: purchaseDate))")
    }
    if let expirationDate, willRenew == true {
      formatter.dateFormat = "d MMM yyyy"
      pieces.append("renews \(formatter.string(from: expirationDate))")
    }
    return pieces.joined(separator: " · ")
  }
}
