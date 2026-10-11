import SwiftUI
import UserNotifications

/// Opt-in Sunday 19:00 local nudge. Off by default; counts only, never merchants or amounts. Nothing leaves the device.
enum ReviewReminder {
  static let identifier = "lakshly.review.sunday"

  static var enabled: Bool { UserDefaults.standard.bool(forKey: ReviewGlance.reminderEnabledKey) }

  static func body(count: Int, streak: Int) -> String {
    count > 0
      ? "\(Review.countLabel(count)) to review this week\(streak > 0 ? " · 🔥 \(streak)" : "")"
      : "Your weekly review is ready"
  }

  static func setEnabled(_ on: Bool, count: Int, streak: Int) {
    UserDefaults.standard.set(on, forKey: ReviewGlance.reminderEnabledKey)
    let center = UNUserNotificationCenter.current()
    guard on else {
      center.removePendingNotificationRequests(withIdentifiers: [identifier])
      return
    }
    center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
      guard granted else { return }
      schedule(count: count, streak: streak)
    }
  }

  static func schedule(count: Int, streak: Int) {
    guard enabled else { return }
    let defaults = UserDefaults.standard
    let weekday = defaults.object(forKey: ReviewGlance.reminderWeekdayKey) as? Int ?? 1
    let hour = defaults.object(forKey: ReviewGlance.reminderHourKey) as? Int ?? 19
    let content = UNMutableNotificationContent()
    content.title = "Weekly review"
    content.body = body(count: count, streak: streak)
    content.userInfo = ["url": "lakshly://review"]
    let trigger = UNCalendarNotificationTrigger(dateMatching: DateComponents(hour: hour, weekday: weekday), repeats: true)
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
  }
}

struct ReviewSettingsSection: View {
  let store: DataStore
  @AppStorage(ReviewGlance.reminderEnabledKey) private var reminder = false
  var body: some View {
    Section("Weekly review") {
      Toggle("Sunday review reminder", isOn: Binding(get: { reminder }, set: { on in
        reminder = on
        ReviewReminder.setEnabled(on, count: store.reviewInbox.count, streak: store.reviewState.streak)
      }))
      .accessibilityIdentifier("settings.reviewReminder")
      Text("Sundays at 7 PM: how many spends are waiting, and your streak. Never amounts. Off by default.")
        .font(.caption)
    }
  }
}
