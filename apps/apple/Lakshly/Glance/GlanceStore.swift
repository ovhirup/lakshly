import Foundation

enum GlancePreferences {
  static let showAmountsKey = "glance.showAmounts"
  static let lockScreenAmountsKey = "glance.lockScreenAmounts"
  static let liveActivitiesKey = "glance.liveActivities"
  static let menuBarExtraKey = "glance.menuBarExtra"
  static let notchPanelKey = "glance.notchPanel"
  static let budgetAlertMonthKey = "glance.budgetAlertMonth"

  static func showAmounts(in defaults: UserDefaults) -> Bool {
    bool(showAmountsKey, default: true, in: defaults)
  }

  static func lockScreenAmounts(in defaults: UserDefaults) -> Bool {
    bool(lockScreenAmountsKey, default: false, in: defaults)
  }

  static func liveActivities(in defaults: UserDefaults) -> Bool {
    bool(liveActivitiesKey, default: true, in: defaults)
  }

  static func menuBarExtra(in defaults: UserDefaults) -> Bool {
    bool(menuBarExtraKey, default: true, in: defaults)
  }

  static func notchPanel(in defaults: UserDefaults) -> Bool {
    bool(notchPanelKey, default: false, in: defaults)
  }

  /// Missing keys use the product default. `bool(forKey:)` would treat them as false.
  static func bool(_ key: String, default defaultValue: Bool, in defaults: UserDefaults) -> Bool {
    guard defaults.object(forKey: key) != nil else { return defaultValue }
    return defaults.bool(forKey: key)
  }
}

enum GlanceTimeline {
  /// Timeline entries: now, the next midnight, and the next bill when it is still ahead.
  static func dates(now: Date, nextBill: Date?, calendar: Calendar = .current) -> [Date] {
    let midnight = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) ?? now
    var dates = [now, midnight]
    if let nextBill, nextBill > now { dates.append(nextBill) }
    return dates
  }
}

enum GlanceStore {
  static let infoKey = "LakshlyAppGroup"
  static let fileName = "glance.json"

  static var isAppExtension: Bool {
    Bundle.main.bundleURL.pathExtension == "appex"
  }

  static var appGroupID: String? {
    normalizedGroupID(Bundle.main.object(forInfoDictionaryKey: infoKey) as? String)
  }

  static func normalizedGroupID(_ raw: String?) -> String? {
    guard let raw else { return nil }
    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, !trimmed.contains("$("), !trimmed.contains(" "), trimmed.hasPrefix("group.") else {
      return nil
    }
    return trimmed
  }

  static var preferences: UserDefaults {
    if let id = appGroupID, let suite = UserDefaults(suiteName: id) { return suite }
    return .standard
  }

  /// App Group container, or the app's Application Support when the group is unavailable.
  /// Widget extensions return nil instead of the fallback so they show a placeholder.
  static func storageDirectory(allowAppFallback: Bool) -> URL? {
    if let id = appGroupID,
       let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id) {
      return container
    }
    guard allowAppFallback else { return nil }
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
    return support.first?.appendingPathComponent("Lakshly", isDirectory: true)
  }

  static func read() -> GlanceSnapshot? {
    guard let directory = storageDirectory(allowAppFallback: !isAppExtension) else { return nil }
    return read(directory: directory, preferences: preferences)
  }

  static func write(_ snapshot: GlanceSnapshot) throws {
    guard let directory = storageDirectory(allowAppFallback: !isAppExtension) else {
      throw CocoaError(.fileNoSuchFile)
    }
    try write(snapshot, directory: directory, preferences: preferences)
  }

  static func read(directory: URL, preferences: UserDefaults) -> GlanceSnapshot? {
    let url = directory.appendingPathComponent(fileName)
    guard let data = try? Data(contentsOf: url),
          var snapshot = try? GlanceCoding.decoder().decode(GlanceSnapshot.self, from: data) else { return nil }
    if !GlancePreferences.showAmounts(in: preferences) { snapshot = snapshot.omittingAmounts() }
    return snapshot
  }

  static func write(_ snapshot: GlanceSnapshot, directory: URL, preferences: UserDefaults) throws {
    let stored = GlancePreferences.showAmounts(in: preferences) ? snapshot : snapshot.omittingAmounts()
    let data = try GlanceCoding.encoder().encode(stored)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent(fileName)
    #if os(iOS)
    // Widgets can read the file after the first unlock, including on the Lock Screen.
    try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    #else
    try data.write(to: url, options: [.atomic])
    #endif
  }
}
