import SwiftUI
import WidgetKit

struct BillRadarWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "LakshlyBillRadar", provider: GlanceProvider()) { entry in
      BillRadarEntryView(entry: entry)
    }
    .configurationDisplayName("Bill radar")
    .description("Your upcoming bills and renewals at a glance.")
    .supportedFamilies(Self.families)
  }

  static var families: [WidgetFamily] {
    #if os(iOS)
    [.systemMedium, .systemLarge, .accessoryRectangular]
    #else
    [.systemMedium, .systemLarge]
    #endif
  }
}

private struct BillRadarEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: GlanceEntry

  var body: some View {
    let chrome = GlanceChrome.palette(for: entry.snapshot)
    BillRadarContent(entry: entry, capacity: capacity,
      showsAmounts: GlanceChrome.showsAmounts(family: family)
        && GlancePreferences.lockScreenAmounts(in: GlanceStore.preferences))
      .environment(\.theme, chrome.palette)
      .modifier(GlanceForcedScheme(scheme: chrome.scheme))
      .containerBackground(for: .widget) {
        ThemeBackground().environment(\.theme, chrome.palette)
      }
      .widgetURL(URL(string: "lakshly://bills"))
      .accessibilityIdentifier("bills.widget")
  }

  private var capacity: Int {
    #if os(iOS)
    if family == .accessoryRectangular { return 1 }
    #endif
    return family == .systemLarge ? 6 : 3
  }
}

private struct BillRadarContent: View {
  @Environment(\.theme) private var theme
  var entry: GlanceEntry
  var capacity: Int
  var showsAmounts: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: capacity == 1 ? 2 : 8) {
      if let snapshot = entry.snapshot {
        Text("Bill radar").font(.caption.weight(.semibold)).foregroundStyle(theme.gold)
        let rows = BillRadarWidgetRows.select(snapshot: snapshot, capacity: capacity)
        if rows.isEmpty {
          Text("Nothing due in the next 45 days")
            .font(.caption).foregroundStyle(theme.secondaryText)
        }
        ForEach(Array(rows.enumerated()), id: \.offset) { index, bill in
          HStack(spacing: 8) {
            Image(systemName: bill.kind.symbol).foregroundStyle(theme.gold)
              .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
              Text(bill.name).font(.caption.weight(.semibold)).lineLimit(1)
              Text(BillRadarWidgetRows.dueText(bill.dueDate, now: entry.date))
                .font(.caption2).foregroundStyle(theme.secondaryText)
            }
            Spacer(minLength: 4)
            if showsAmounts, let amount = bill.amount {
              GlanceMoneyLabel(amount: .shown(amount)).font(.caption.weight(.semibold))
            }
          }
          .accessibilityElement(children: .combine)
          .accessibilityIdentifier("bills.row.\(index)")
        }
        if !can(.billWidget, tier: snapshot.tier.accessTier) {
          Label("Bill radar widget is Premium", systemImage: "lock.fill")
            .font(.caption2).foregroundStyle(theme.secondaryText)
            .accessibilityIdentifier("bills.premium")
        }
      } else {
        GlanceEmptyGlance()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .foregroundStyle(theme.text)
  }
}
