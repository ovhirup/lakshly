#if DEBUG
import SwiftUI

/// Orchestrator-only bill radar screenshots: synthetic demo data, offscreen host views (no window is shown).
/// State is set with setWowState directly so no notification permission is ever requested.
@MainActor enum BillShotRenderer {
  static let screens = ["radar", "alerts", "overview", "paid", "radar-hidden"]

  static func render(to directory: URL) throws -> [URL] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios", width: CGFloat = 390
    #else
    let platform = "macos", width: CGFloat = 760
    #endif
    let suiteName = "app.lakshly.bill-shots"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    var written: [URL] = []
    for (id, scheme) in PrivacyShotRenderer.themes {
      let theme = ThemePalette(id, scheme: scheme)
      let appearance = scheme == .dark ? "dark" : "light"
      for tier in [Tier.free, .premium] {
        for screen in screens {
          let entitlements = EntitlementStore(syncPurchases: {})
          entitlements.overrideTierForShots(tier)
          let data = DataStore(backing: MemoryStoredData(), defaults: defaults, loadSyntheticDemo: true)
          let session = SetupSession(store: data, defaults: defaults)
          var state = data.wowState
          if screen == "alerts" { state.bills.alertsOn = true }
          if screen == "paid", let first = data.billRadar.first { state.bills.paid = [first.id] }
          data.setWowState(state)
          let privacy = PrivacyStore(defaults: defaults, group: defaults, reload: {})
          privacy.setPrivacy(screen.hasSuffix("-hidden"), source: "shots")
          #if os(iOS)
          let radarHeight: CGFloat = 2200
          #else
          let radarHeight: CGFloat = 1700
          #endif
          let height: CGFloat = screen == "overview" ? 520 : (screen == "alerts" ? 640 : radarHeight)
          let view = content(screen, data: data)
            .environment(\.privacy, privacy).environment(\.theme, theme)
            .environment(session).environment(entitlements).environment(data)
            .foregroundStyle(theme.text).tint(theme.gold)
            .environment(\.colorScheme, scheme)
            .environment(\.setupRendering, true)
            .frame(width: width, height: height, alignment: .top)
            .background(theme.bg)
          let plan = tier == .free ? "free" : "premium"
          let url = directory.appendingPathComponent("bills-\(screen)-\(plan)-\(platform)-\(id.rawValue)-\(appearance).png")
          #if os(macOS)
          try PrivacyShotRenderer.imageRender(AnyView(view), size: CGSize(width: width, height: height)).write(to: url)
          #else
          try PrivacyShotRenderer.snapshot(AnyView(view), size: CGSize(width: width, height: height), dark: scheme == .dark).write(to: url)
          #endif
          written.append(url)
          defaults.removePersistentDomain(forName: suiteName)
        }
      }
    }
    return written
  }

  @ViewBuilder private static func content(_ screen: String, data: DataStore) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      switch screen {
      case "overview":
        BillsOverviewCard(store: data, open: {})
      case "alerts":
        BillAlertsCard(store: data)
      default:
        BillRadarView(store: data)
      }
      Spacer(minLength: 0)
    }
    .padding(20)
    .background { ThemeBackground() }
  }
}
#endif
