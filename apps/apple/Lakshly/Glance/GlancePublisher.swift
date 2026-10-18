import Foundation
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Writes the privacy-safe glance file and asks widgets to reload. Amounts follow the widget preference.
@MainActor enum GlancePublisher {
  static var themeID = ThemeID.lakshmi.rawValue
  static var appearance = "system"
  static var tier: Tier = .free

  static func configure(themeID: String, appearance: String, tier: Tier) {
    self.themeID = themeID
    self.appearance = appearance
    self.tier = tier
  }

  static func publish(dataset: Dataset?, now: Date = Date(), wow: WowState = WowState()) {
    guard let dataset else { return }
    let preferences = GlanceStore.preferences
    let snapshot = GlanceBuilder.build(
      dataset: dataset,
      now: now,
      includeAmounts: GlancePreferences.showAmounts(in: preferences),
      tier: tier,
      themeID: themeID,
      appearance: appearance,
      fees: wow.fees,
      subscriptions: SubscriptionAudit.build(
        transactions: dataset.transactions, now: now, planned: Set(wow.plannedCancels)).items,
      plannedCancels: Set(wow.plannedCancels),
      radarState: wow.bills)
    try? GlanceStore.write(snapshot)
    #if canImport(WidgetKit)
    WidgetCenter.shared.reloadAllTimelines()
    #endif
    #if os(iOS)
    LiveActivityManager.shared.sync(snapshot: snapshot)
    #endif
  }
}
