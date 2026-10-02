import SwiftUI

struct Page<Content: View>: View {
  @Environment(\.theme) private var theme
  let title: String
  let subtitle: String
  @ViewBuilder var content: Content
  var body: some View {
    ScrollView {
      GlassEffectContainer(spacing: theme.spacious ? 32 : 24) {
        VStack(alignment: .leading, spacing: theme.spacious ? 32 : 24) {
          VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(.largeTitle, design: .rounded, weight: .bold))
            Text(subtitle).foregroundStyle(theme.secondaryText)
          }
          content
        }.frame(maxWidth: 900).padding(theme.spacious ? 32 : 24).frame(maxWidth: .infinity)
      }
    }
    .scrollContentBackground(.hidden)
    .background { ThemeBackground() }
  }
}
struct Card<Content: View>: View {
  @Environment(\.theme) private var theme
  let title: String
  @ViewBuilder var content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacious ? 22 : 14) {
      Text(title).font(.system(.title3, design: .rounded, weight: .bold))
      content
    }.frame(maxWidth: .infinity, alignment: .leading).modifier(GlassCard())
  }
}
struct MetricRow: View {
  @Environment(\.theme) private var theme
  let title: String
  let value: String
  var semantic: MoneySemantic? = nil
  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).foregroundStyle(theme.secondaryText)
      Spacer()
      SemanticAmount(value: value, semantic: semantic).fontWeight(.semibold).monospacedDigit()
    }
  }
}
struct Pill: View {
  @Environment(\.theme) private var theme
  let text: String
  var color: Color? = nil
  var symbol: String? = nil
  var body: some View {
    let color = color ?? theme.secondaryText
    HStack(spacing: 4) {
      if let symbol { Image(systemName: symbol) }
      Text(text)
    }.font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
      .foregroundStyle(color).background(color.opacity(0.14), in: Capsule())
  }
}

// Shape cues preserve money meaning when the palette uses neutral semantics.
enum MoneySemantic {
  case income, spend, invest
  var symbol: String {
    switch self {
    case .income: "arrow.down.left"
    case .spend: "arrow.up.right"
    case .invest: "chart.line.uptrend"
    }
  }
  func color(in theme: ThemePalette) -> Color {
    switch self { case .income: theme.income; case .spend: theme.spend; case .invest: theme.invest }
  }
}
struct SemanticAmount: View {
  @Environment(\.theme) private var theme
  let value: String
  let semantic: MoneySemantic?
  var prominent: Bool = false
  @ScaledMetric(relativeTo: .largeTitle) private var prominentIconSize = 17
  var body: some View {
    HStack(alignment: prominent ? .center : .firstTextBaseline, spacing: 5) {
      if theme.usesSemanticIcons, let semantic {
        Image(systemName: semantic.symbol)
          .font(prominent ? .system(size: prominentIconSize, weight: .semibold) : .caption)
          .accessibilityHidden(true)
      }
      Text(value)
    }.foregroundStyle(semantic?.color(in: theme) ?? theme.text)
  }
}
