import Foundation
import UserNotifications

@MainActor enum BillNotifications {
  static let categoryID = "LAKSHLY_BILL"
  static let openURL = Notification.Name("lakshly.notification.openURL")
  static var alertLimit: FeatureLimit = .count(3)
  static var pendingURL: String?
  private static var generation = 0
  private static var delegate: BillNotificationDelegate?

  struct Request: Equatable, Sendable {
    var id: String
    var dateComponents: DateComponents
    var title: String
    var body: String
    var userInfo: [String: String]
    var categoryIdentifier: String { BillNotifications.categoryID }
  }

  static func requests(
    for bills: [RadarBill], state: BillRadarState, limit: FeatureLimit,
    includeAmounts: Bool = false, now: Date, calendar: Calendar = .current
  ) -> [Request] {
    BillRadar.alerts(bills, state: state, limit: limit, includeAmounts: includeAmounts,
      now: now, calendar: calendar).alerts.prefix(40).map { alert in
      Request(id: alert.id,
        dateComponents: calendar.dateComponents([.calendar, .timeZone, .year, .month, .day, .hour, .minute, .second], from: alert.fireAt),
        title: alert.title, body: alert.body,
        userInfo: ["url": "lakshly://bills", "billId": alert.billId])
    }
  }

  static func register(store: DataStore) {
    let center = UNUserNotificationCenter.current()
    let handler = BillNotificationDelegate(store: store)
    delegate = handler
    center.delegate = handler
    let category = UNNotificationCategory(identifier: categoryID, actions: [
      UNNotificationAction(identifier: "MARK_PAID", title: "Mark paid"),
      UNNotificationAction(identifier: "TOMORROW", title: "Remind me tomorrow"),
    ], intentIdentifiers: [])
    center.getNotificationCategories { existing in
      center.setNotificationCategories(existing.union([category]))
    }
  }

  static func reschedule(store: DataStore) {
    generation += 1
    let revision = generation
    Task { @MainActor in
      let center = UNUserNotificationCenter.current()
      let pending = await center.pendingNotificationRequests()
      guard revision == generation else { return }
      let alertsOn = store.wowState.bills.alertsOn
      // Keep "Remind me tomorrow" snoozes across reschedules unless alerts were turned off.
      center.removePendingNotificationRequests(withIdentifiers: pending.map(\.identifier).filter {
        $0.hasPrefix("lakshly.bill.") && (!alertsOn || !$0.hasPrefix("lakshly.bill.snooze."))
      })
      guard alertsOn else { return }
      let settings = await center.notificationSettings()
      guard revision == generation,
            settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { return }
      let plans = requests(for: store.billRadar, state: store.wowState.bills, limit: alertLimit,
        includeAmounts: GlancePreferences.lockScreenAmounts(in: GlanceStore.preferences), now: Date())
      for plan in plans {
        guard revision == generation else { return }
        let content = UNMutableNotificationContent()
        content.title = plan.title
        content.body = plan.body
        content.userInfo = plan.userInfo
        content.categoryIdentifier = categoryID
        content.threadIdentifier = "lakshly.bills"
        let trigger = UNCalendarNotificationTrigger(dateMatching: plan.dateComponents, repeats: false)
        try? await center.add(UNNotificationRequest(identifier: plan.id, content: content, trigger: trigger))
      }
    }
  }

  static func setEnabled(_ on: Bool, store: DataStore) {
    store.setBillAlerts(on: on)
    guard on else { return }
    Task { @MainActor in
      _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])
      reschedule(store: store)
    }
  }
}

@MainActor final class BillNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  private let store: DataStore

  init(store: DataStore) { self.store = store }

  nonisolated func userNotificationCenter(
    _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse
  ) async {
    let action = response.actionIdentifier
    let content = response.notification.request.content
    let billId = content.userInfo["billId"] as? String
    let url = content.userInfo["url"] as? String ?? "lakshly://bills"
    if action == "TOMORROW", let billId,
       let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date()),
       let date = Calendar.current.date(bySettingHour: 9, minute: 0, second: 0, of: tomorrow) {
      // Reuse the already privacy-filtered content for mirrored iPhone / Watch actions.
      let trigger = UNCalendarNotificationTrigger(
        dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date), repeats: false)
      try? await center.add(UNNotificationRequest(identifier: "lakshly.bill.snooze.\(billId)", content: content, trigger: trigger))
      return
    }
    await handle(action: action, billId: billId, url: url)
  }

  private func handle(action: String, billId: String?, url: String) {
    if action == "MARK_PAID", let billId {
      store.markBillPaid(billId)
    } else if action == UNNotificationDefaultActionIdentifier {
      BillNotifications.pendingURL = url
      NotificationCenter.default.post(name: BillNotifications.openURL, object: url)
    }
  }
}
