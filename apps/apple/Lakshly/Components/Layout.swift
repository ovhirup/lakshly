import SwiftUI

struct Page<Content: View>: View {
  let title: String
  let subtitle: String
  @ViewBuilder var content: Content
  var body: some View {
    ScrollView {
      GlassEffectContainer(spacing: 24) {
        VStack(alignment: .leading, spacing: 24) {
          VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.system(.largeTitle, design: .rounded, weight: .bold))
            Text(subtitle).foregroundStyle(.secondary)
          }
          content
        }.frame(maxWidth: 900).padding(24).frame(maxWidth: .infinity)
      }
    }
    .scrollContentBackground(.hidden)
    .background {
      LinearGradient(
        colors: [.pink.opacity(0.20), .orange.opacity(0.18), .yellow.opacity(0.22)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      ).ignoresSafeArea()
    }
  }
}
struct Card<Content: View>: View {
  let title: String
  @ViewBuilder var content: Content
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text(title).font(.system(.title3, design: .rounded, weight: .bold))
      content
    }.frame(maxWidth: .infinity, alignment: .leading).modifier(GlassCard())
  }
}
struct MetricRow: View {
  let title: String
  let value: String
  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).foregroundStyle(.secondary)
      Spacer()
      Text(value).fontWeight(.semibold).monospacedDigit()
    }
  }
}
struct Pill: View {
  let text: String
  var color: Color = .orange
  var symbol: String? = nil
  var body: some View {
    HStack(spacing: 4) {
      if let symbol { Image(systemName: symbol) }
      Text(text)
    }.font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 5)
      .foregroundStyle(color).background(color.opacity(0.14), in: Capsule())
  }
}
