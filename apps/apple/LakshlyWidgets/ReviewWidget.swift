import SwiftUI
import WidgetKit

/// "10 to review" + streak flame. Counts only: no merchants, no amounts. Tap opens lakshly://review.
struct ReviewEntry: TimelineEntry {
  var date: Date
  var count: Int
  var streak: Int
  var snapshot: GlanceSnapshot?
}

struct ReviewProvider: TimelineProvider {
  private func entry(preview: Bool) -> ReviewEntry {
    let defaults = GlanceStore.preferences
    if preview { return ReviewEntry(date: Date(), count: 10, streak: 2, snapshot: .placeholder) }
    return ReviewEntry(
      date: Date(), count: defaults.integer(forKey: "review.count"), streak: defaults.integer(forKey: "review.streak"),
      snapshot: GlanceStore.read())
  }
  func placeholder(in context: Context) -> ReviewEntry { entry(preview: true) }
  func getSnapshot(in context: Context, completion: @escaping (ReviewEntry) -> Void) { completion(entry(preview: context.isPreview)) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<ReviewEntry>) -> Void) {
    completion(Timeline(entries: [entry(preview: false)], policy: .after(Date().addingTimeInterval(6 * 3600))))
  }
}

struct ReviewWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: ReviewEntry
  private var countText: String { entry.count > 50 ? "50+" : String(entry.count) }
  private var headline: String { entry.count > 0 ? "\(countText) to review" : "Inbox zero ✨" }
  private var streak: String? { entry.streak > 0 ? "🔥 \(entry.streak)" : nil }

  var body: some View {
    let chrome = GlanceChrome.palette(for: entry.snapshot)
    content
      .environment(\.theme, chrome.palette)
      .foregroundStyle(chrome.palette.text)
      .modifier(GlanceForcedScheme(scheme: chrome.scheme))
      .containerBackground(for: .widget) { ThemeBackground().environment(\.theme, chrome.palette) }
      .widgetURL(URL(string: "lakshly://review"))
      .accessibilityElement(children: .combine)
      .accessibilityLabel("Weekly review, \(entry.count > 0 ? "\(entry.count) to review" : "inbox zero")\(entry.streak > 0 ? ", \(entry.streak)-week streak" : "")")
  }

  @ViewBuilder private var content: some View {
    switch family {
    #if os(iOS)
    case .accessoryInline:
      Text([headline, streak].compactMap { $0 }.joined(separator: " · "))
    case .accessoryCircular:
      VStack(spacing: 0) {
        Text(countText).font(.title2.bold())
        Text(entry.streak > 0 ? "🔥\(entry.streak)" : "review").font(.caption2)
      }
    case .accessoryRectangular:
      VStack(alignment: .leading) {
        Text("Weekly review").font(.caption.weight(.semibold))
        Text(headline).font(.headline)
        if let streak { Text("\(streak)-week streak").font(.caption) }
      }
    #endif
    default:
      VStack(alignment: .leading, spacing: 6) {
        Label("Weekly review", systemImage: "checklist").font(.caption.weight(.semibold))
        Spacer(minLength: 0)
        Text(headline).font(.system(.title2, design: .rounded, weight: .bold)).minimumScaleFactor(0.7)
        if let streak { Text("\(streak)-week streak").font(.subheadline) }
      }.frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct ReviewWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyReview", provider: ReviewProvider()) { entry in
      ReviewWidgetView(entry: entry)
    }
    .configurationDisplayName("Weekly review")
    .description("How many spends are waiting, and your streak. Never amounts.")
    .supportedFamilies(Self.families)
  }

  static var families: [WidgetFamily] {
    #if os(iOS)
    [.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline]
    #else
    [.systemSmall]
    #endif
  }
}
