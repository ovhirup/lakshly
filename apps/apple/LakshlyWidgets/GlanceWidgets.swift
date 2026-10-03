import SwiftUI
import WidgetKit

struct GlanceEntry: TimelineEntry {
  var date: Date
  var snapshot: GlanceSnapshot?
}

struct GlanceProvider: TimelineProvider {
  func placeholder(in context: Context) -> GlanceEntry {
    GlanceEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
    let stored = GlanceStore.read()
    let snapshot = context.isPreview || stored == nil ? GlanceSnapshot.placeholder : stored
    completion(GlanceEntry(date: Date(), snapshot: snapshot))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
    let now = Date()
    let snapshot = GlanceStore.read()
    let dates = GlanceTimeline.dates(now: now, nextBill: snapshot?.nextBill?.dueDate)
    completion(Timeline(entries: dates.map { GlanceEntry(date: $0, snapshot: snapshot) }, policy: .atEnd))
  }
}

enum GlanceChrome {
  static func palette(for snapshot: GlanceSnapshot?) -> (palette: ThemePalette, scheme: ColorScheme?) {
    let id = ThemeID.resolve(snapshot?.themeID ?? ThemeID.lakshmi.rawValue)
    switch snapshot?.appearance ?? .system {
    case .light: return (ThemePalette(id, scheme: .light), .light)
    case .dark: return (ThemePalette(id, scheme: .dark), .dark)
    case .system: return (ThemePalette(id), nil)
    }
  }

  static func showsAmounts(family: WidgetFamily) -> Bool {
    let preferences = GlanceStore.preferences
    let show = GlancePreferences.showAmounts(in: preferences)
    let lock = GlancePreferences.lockScreenAmounts(in: preferences)
    #if os(iOS)
    switch family {
    case .accessoryInline, .accessoryCircular, .accessoryRectangular:
      return GlanceAmounts.allows(surface: .lockScreen, showAmounts: show, lockScreenAmounts: lock)
    default:
      break
    }
    #endif
    return GlanceAmounts.allows(surface: .home, showAmounts: show, lockScreenAmounts: lock)
  }

  static func style(family: WidgetFamily) -> GlanceWidgetStyle {
    #if os(iOS)
    switch family {
    case .accessoryCircular: return .circular
    case .accessoryRectangular: return .rectangular
    case .accessoryInline: return .inline
    case .systemMedium: return .medium
    default: return .small
    }
    #else
    return family == .systemMedium ? .medium : .small
    #endif
  }
}

struct GlanceWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: GlanceEntry
  var kind: GlanceWidgetKind

  var body: some View {
    let chrome = GlanceChrome.palette(for: entry.snapshot)
    GlanceWidgetView(
      snapshot: entry.snapshot,
      kind: kind,
      style: GlanceChrome.style(family: family),
      showsAmounts: GlanceChrome.showsAmounts(family: family))
      .environment(\.theme, chrome.palette)
      .modifier(GlanceForcedScheme(scheme: chrome.scheme))
      .containerBackground(for: .widget) {
        ThemeBackground().environment(\.theme, chrome.palette)
      }
      .widgetURL(URL(string: kind.deepLink))
  }
}

struct GlanceForcedScheme: ViewModifier {
  var scheme: ColorScheme?
  func body(content: Content) -> some View {
    if let scheme {
      content.preferredColorScheme(scheme)
    } else {
      content
    }
  }
}

struct BudgetPaceWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyBudgetPace", provider: GlanceProvider()) { entry in
      GlanceWidgetEntryView(entry: entry, kind: .budgetPace)
    }
    .configurationDisplayName("Budget pace")
    .description("How this month's spending compares with the days already gone.")
    .supportedFamilies(Self.families)
  }

  static var families: [WidgetFamily] {
    #if os(iOS)
    [.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline]
    #else
    [.systemSmall, .systemMedium]
    #endif
  }
}

struct UpcomingBillWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyUpcomingBill", provider: GlanceProvider()) { entry in
      GlanceWidgetEntryView(entry: entry, kind: .upcomingBill)
    }
    .configurationDisplayName("Upcoming bill")
    .description("The next card, EMI or SIP.")
    .supportedFamilies(Self.families)
  }

  static var families: [WidgetFamily] {
    #if os(iOS)
    [.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline]
    #else
    [.systemSmall, .systemMedium]
    #endif
  }
}

struct NetWorthWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyNetWorth", provider: GlanceProvider()) { entry in
      GlanceWidgetEntryView(entry: entry, kind: .netWorth)
    }
    .configurationDisplayName("Net worth")
    .description("Direction of what you own minus what you owe. Lakshly Premium.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct DebtWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyDebt", provider: GlanceProvider()) { entry in
      GlanceWidgetEntryView(entry: entry, kind: .debt)
    }
    .configurationDisplayName("Debt")
    .description("How much of the balance is already repaid. Lakshly Premium.")
    .supportedFamilies(Self.families)
  }

  static var families: [WidgetFamily] {
    #if os(iOS)
    [.systemSmall, .systemMedium, .accessoryCircular]
    #else
    [.systemSmall, .systemMedium]
    #endif
  }
}
