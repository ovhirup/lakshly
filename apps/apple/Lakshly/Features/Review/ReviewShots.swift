#if DEBUG
import SwiftUI

/// Orchestrator-only weekly-review screenshots: synthetic demo data, offscreen host views (no window is shown).
@MainActor enum ReviewShotRenderer {
  static let screens = ["inbox", "swipe", "nwv", "xp", "done", "inbox-hidden"]

  static func render(to directory: URL) throws -> [URL] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios", width: CGFloat = 390
    #else
    let platform = "macos", width: CGFloat = 900
    #endif
    let suiteName = "app.lakshly.review-shots"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    let entitlements = EntitlementStore(syncPurchases: {})
    var written: [URL] = []
    for (id, scheme) in PrivacyShotRenderer.themes {
      let theme = ThemePalette(id, scheme: scheme)
      let appearance = scheme == .dark ? "dark" : "light"
      for screen in screens {
        let data = DataStore(backing: MemoryStoredData(), defaults: defaults, loadSyntheticDemo: true)
        let session = SetupSession(store: data, defaults: defaults)
        // One Want rated so the Worth-it chips show a selected state.
        if screen.hasPrefix("inbox") || screen == "swipe", let ratable = data.reviewInbox.rows.first(where: \.ratable) {
          data.applyReview(.rate(ratable.id, .yes))
        }
        if screen == "done" { data.applyReview(.confirmAll) }
        let privacy = PrivacyStore(defaults: defaults, group: defaults, reload: {})
        privacy.setPrivacy(screen == "inbox-hidden", source: "shots")
        let height: CGFloat = screen == "nwv" ? 940 : screen == "swipe" || screen == "xp" || screen == "done" ? 800 : 1200
        let view = content(screen, data: data)
          .environment(\.privacy, privacy).environment(\.theme, theme)
          .environment(session).environment(entitlements).environment(data)
          .foregroundStyle(theme.text).tint(theme.gold)
          .environment(\.colorScheme, scheme)
          .environment(\.setupRendering, true)
          .frame(width: width, height: height, alignment: .top)
          .background(theme.bg)
        let url = directory.appendingPathComponent("review-\(screen)-\(platform)-\(id.rawValue)-\(appearance).png")
        #if os(macOS)
        try PrivacyShotRenderer.imageRender(AnyView(view), size: CGSize(width: width, height: height)).write(to: url)
        #else
        try PrivacyShotRenderer.snapshot(AnyView(view), size: CGSize(width: width, height: height), dark: scheme == .dark).write(to: url)
        #endif
        written.append(url)
        defaults.removePersistentDomain(forName: suiteName)
      }
    }
    return written
  }

  @ViewBuilder private static func content(_ screen: String, data: DataStore) -> some View {
    let rows = data.reviewInbox.rows
    switch screen {
    case "swipe":
      VStack(alignment: .leading, spacing: 14) {
        Text("Swipe right to confirm").font(.headline)
        if let r = rows.first { ReviewRow(row: r, worth: nil, selected: false, previewOffset: 110, act: { _ in }, edit: {}) }
        Text("Swipe left to change").font(.headline)
        if rows.count > 1 { ReviewRow(row: rows[1], worth: nil, selected: false, previewOffset: -110, act: { _ in }, edit: {}) }
        Text("Buttons are always there too").font(.headline)
        if rows.count > 2 { ReviewRow(row: rows[2], worth: data.reviewState.worth[rows[2].id], selected: false, previewOffset: nil, act: { _ in }, edit: {}) }
        Spacer(minLength: 0)
      }.padding(20).background { ThemeBackground() }
    case "nwv":
      VStack(alignment: .leading, spacing: 14) {
        if let r = rows.first(where: { !$0.refund }) {
          Text("Change · \(r.tx.name)").font(.headline)
          ReviewEditor(row: r, onSave: { _, _, _ in }, onCancel: {}).modifier(GlassCard())
          Text("Long-press: Confirm, Change, Skip, Mark Need, Mark Want, Mark Vice, Worth it, Not really.")
            .font(.caption)
        }
        Spacer(minLength: 0)
      }.padding(20).background { ThemeBackground() }
    case "xp":
      VStack(alignment: .leading, spacing: 14) {
        ReviewEntryCard(store: data, open: {})
        HStack { Spacer(); ReviewChip(store: data, open: {}) }
        WorthItCard(store: data)
        Spacer(minLength: 0)
      }.padding(20).background { ThemeBackground() }
    default:
      ReviewView(store: data)
    }
  }
}
#endif
