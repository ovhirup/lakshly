#if DEBUG
import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

enum GlanceShotCatalog {
  struct Item {
    var name: String
    var size: CGSize
    var view: AnyView
  }

  static func items(platform: String, snapshot: GlanceSnapshot, theme: ThemeID, scheme: ColorScheme) -> [Item] {
    let hidden = snapshot.omittingAmounts()
    var items: [Item] = []
    let appearance = scheme == .dark ? "dark" : "light"
    func add(_ viewName: String, _ size: CGSize, revealed: Bool, _ view: some View) {
      let suffix = revealed ? "-revealed" : ""
      items.append(Item(
        name: "\(platform)-\(viewName)-\(theme.rawValue)-\(appearance)\(suffix)",
        size: size,
        view: AnyView(frame(view, size: size, theme: theme, scheme: scheme))))
    }
    let home: [(String, GlanceWidgetKind)] = [
      ("budget", .budgetPace), ("bill", .upcomingBill), ("networth", .netWorth), ("debt", .debt),
    ]
    let small = CGSize(width: 170, height: 170)
    let medium = CGSize(width: 360, height: 170)
    for (name, kind) in home {
      for revealed in [false, true] {
        let value = revealed ? snapshot : hidden
        add("\(name)-small", small, revealed: revealed, widget(value, kind, .small, revealed))
        add("\(name)-medium", medium, revealed: revealed, widget(value, kind, .medium, revealed))
      }
    }
    if platform == "ios" {
      let rectangular = CGSize(width: 172, height: 76)
      let circular = CGSize(width: 76, height: 76)
      for revealed in [false, true] {
        let value = revealed ? snapshot : hidden
        add("budget-rectangular", rectangular, revealed: revealed, widget(value, .budgetPace, .rectangular, revealed))
        add("bill-rectangular", rectangular, revealed: revealed, widget(value, .upcomingBill, .rectangular, revealed))
        add("budget-circular", circular, revealed: revealed, widget(value, .budgetPace, .circular, revealed))
        add("debt-circular", circular, revealed: revealed, widget(value, .debt, .circular, revealed))
        let model = activityModel(value, revealed: revealed)
        add("activity-lock", CGSize(width: 380, height: 168), revealed: revealed,
            GlanceActivityView(model: model, chrome: .lock))
        add("activity-island-compact", CGSize(width: 250, height: 40), revealed: revealed,
            GlanceIslandFrame(compact: true) { GlanceActivityView(model: model, chrome: .compact) })
        add("activity-island-expanded", CGSize(width: 380, height: 210), revealed: revealed,
            GlanceIslandFrame(compact: false) { GlanceActivityView(model: model, chrome: .expanded) })
      }
    }
    if platform == "macos" {
      for revealed in [false, true] {
        add("menu", CGSize(width: 340, height: 460), revealed: revealed, MenuBarGlanceBody(
          snapshot: revealed ? snapshot : hidden,
          revealed: revealed,
          premium: true,
          message: revealed ? nil : "Amounts stay hidden until you reveal them."))
      }
    }
    return items
  }

  private static func widget(
    _ snapshot: GlanceSnapshot, _ kind: GlanceWidgetKind, _ style: GlanceWidgetStyle, _ revealed: Bool
  ) -> some View {
    GlanceWidgetView(snapshot: snapshot, kind: kind, style: style, showsAmounts: revealed)
  }

  private static func activityModel(_ snapshot: GlanceSnapshot, revealed: Bool) -> GlanceActivityModel {
    GlanceActivityModel(
      kind: .bill,
      title: snapshot.nextBill?.name ?? "Rewards Card",
      subtitle: "Due today",
      progress: 1,
      amount: revealed ? snapshot.nextBill?.amount.map { Money.format($0) } : nil)
  }

  private static func frame<V: View>(_ view: V, size: CGSize, theme: ThemeID, scheme: ColorScheme) -> some View {
    let palette = ThemePalette(theme, scheme: scheme)
    return view
      .environment(\.theme, palette)
      .environment(\.colorScheme, scheme)
      .preferredColorScheme(scheme)
      .frame(width: size.width, height: size.height)
      .background(palette.bg)
  }
}

enum GlanceShotRenderer {
  static func sampleSnapshot(dataset: Dataset, theme: ThemeID, scheme: ColorScheme) -> GlanceSnapshot {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let now = calendar.date(from: DateComponents(year: 2026, month: 9, day: 10, hour: 12)) ?? Date()
    var snapshot = GlanceBuilder.build(
      dataset: dataset, now: now, includeAmounts: true, tier: .premium,
      themeID: theme.rawValue, appearance: scheme == .dark ? "dark" : "light", calendar: calendar)
    snapshot.appearance = scheme == .dark ? .dark : .light
    return snapshot
  }

  private static let themes: [(ThemeID, ColorScheme)] = [(.lakshmi, .dark), (.monochromeGold, .light)]

  @MainActor static func render(to directory: URL, dataset: Dataset) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios"
    let scale: CGFloat = 3
    #else
    let platform = "macos"
    let scale: CGFloat = 2
    #endif
    for (theme, scheme) in themes {
      let snapshot = sampleSnapshot(dataset: dataset, theme: theme, scheme: scheme)
      for item in GlanceShotCatalog.items(platform: platform, snapshot: snapshot, theme: theme, scheme: scheme) {
        let data = try png(item.view, size: item.size, scale: scale)
        try data.write(to: directory.appendingPathComponent(item.name + ".png"))
      }
    }
  }

  @MainActor private static func png<V: View>(_ view: V, size: CGSize, scale: CGFloat) throws -> Data {
    let renderer = ImageRenderer(content: view)
    renderer.scale = scale
    renderer.isOpaque = true
    renderer.proposedSize = ProposedViewSize(width: size.width, height: size.height)
    #if os(iOS)
    guard let image = renderer.uiImage, let data = image.pngData() else { throw CocoaError(.coderReadCorrupt) }
    return data
    #else
    guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let data = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.coderReadCorrupt) }
    return data
    #endif
  }
}
#endif
