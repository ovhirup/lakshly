#if DEBUG
import SwiftUI

/// Orchestrator-only wow screenshots: synthetic demo data, offscreen host views (no window is shown).
@MainActor enum WowShotRenderer {
  static let screens = ["freedom", "story", "share", "audit", "runway", "freedom-hidden"]

  static func render(to directory: URL) throws -> [URL] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios", width: CGFloat = 390
    #else
    let platform = "macos", width: CGFloat = 760
    #endif
    let suiteName = "app.lakshly.wow-shots"
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
          if screen == "audit",
            let first = SubscriptionAudit.build(transactions: data.dataset?.transactions ?? [], now: data.reviewNow, planned: []).items.first(where: { !$0.lapsed })?.id {
            var state = data.wowState
            state.plannedCancels = [first]
            data.setWowState(state)
          }
          if screen.hasPrefix("freedom"), tier == .premium {
            var state = data.wowState
            state.extraPaise = 500_000
            state.rollOver = true
            data.setWowState(state)
          }
          let privacy = PrivacyStore(defaults: defaults, group: defaults, reload: {})
          privacy.setPrivacy(screen.hasSuffix("-hidden"), source: "shots")
          let height: CGFloat = height(screen)
          let view = content(screen, data: data, tier: tier)
            .environment(\.privacy, privacy).environment(\.theme, theme)
            .environment(session).environment(entitlements).environment(data)
            .foregroundStyle(theme.text).tint(theme.gold)
            .environment(\.colorScheme, scheme)
            .environment(\.setupRendering, true)
            .frame(width: width, height: height, alignment: .top)
            .background(theme.bg)
          let plan = tier == .free ? "free" : "premium"
          let url = directory.appendingPathComponent("wow-\(screen)-\(plan)-\(platform)-\(id.rawValue)-\(appearance).png")
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

  private static func height(_ screen: String) -> CGFloat {
    switch screen {
    case "share": 900
    case "story": 1250
    case "audit", "runway": 1350
    default: 1200
    }
  }

  #if os(iOS)
  private static let shareWidth: CGFloat = 390
  #else
  private static let shareWidth: CGFloat = 760
  #endif

  @ViewBuilder private static func content(_ screen: String, data: DataStore, tier: Tier) -> some View {
    VStack(alignment: .leading, spacing: 16) {
      switch screen {
      case "story":
        StoryCard(store: data)
        StoryPager(store: data).modifier(GlassCard())
      case "share":
        if tier >= .premium, let month = data.months.last {
          Text("Share image (percentages only)").font(.headline)
          let fit = min(1, (shareWidth - 40) / StoryShareImage.width)
          StoryShareImage(story: StoryReading.build(data, month: month))
            .scaleEffect(fit, anchor: .topLeading)
            .frame(width: StoryShareImage.width * fit, height: StoryShareImage.height * fit, alignment: .topLeading)
        } else {
          PremiumGate(
            feature: .storyShare, title: "Share your story",
            message: "Pick any past month and share a story card. The image shows percentages only, never amounts."
          ) { EmptyView() }
        }
      case "audit":
        SubscriptionAuditCard(store: data)
      case "runway":
        FeeRunwayCard(store: data)
      default:
        FreedomOverviewRow(store: data, open: {})
        FreedomCard(store: data)
        FreedomWhatIfCard(store: data)
      }
      Spacer(minLength: 0)
    }
    .padding(20)
    .background { ThemeBackground() }
  }
}
#endif
