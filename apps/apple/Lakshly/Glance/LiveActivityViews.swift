import SwiftUI

struct GlanceActivityModel: Equatable {
  enum Kind: Equatable { case bill, budget }
  var kind: Kind
  var title: String
  var subtitle: String
  var progress: Double
  var amount: String?
}

enum GlanceActivityChrome { case lock, expanded, compact }

struct GlanceActivityView: View {
  @Environment(\.theme) private var theme
  var model: GlanceActivityModel
  var chrome: GlanceActivityChrome

  var body: some View {
    switch chrome {
    case .compact: compact
    case .expanded: details(onIsland: true)
    case .lock: details(onIsland: false)
    }
  }

  private var symbol: String { model.kind == .budget ? "target" : "calendar" }

  private var compactText: String {
    if model.kind == .budget { return GlanceFormat.percent(model.progress * 100) }
    return "Today"
  }

  private var compact: some View {
    HStack(spacing: 8) {
      Image(systemName: symbol).foregroundStyle(theme.gold)
      Spacer(minLength: 4)
      Text(compactText).font(.caption.weight(.bold)).foregroundStyle(.white).monospacedDigit()
    }
    .padding(.horizontal, 4)
  }

  private func details(onIsland: Bool) -> some View {
    let primary = onIsland ? Color.white : theme.text
    let secondary = onIsland ? Color.white.opacity(0.72) : theme.secondaryText
    return VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 10) {
        Image(systemName: symbol).font(.title3).foregroundStyle(theme.gold)
        VStack(alignment: .leading, spacing: 2) {
          Text(model.title).font(.system(.headline, design: .rounded, weight: .bold))
            .foregroundStyle(primary).lineLimit(1)
          Text(model.subtitle).font(.caption).foregroundStyle(secondary).lineLimit(1)
        }
        Spacer(minLength: 8)
        Text(compactText).font(.system(.subheadline, design: .rounded, weight: .bold))
          .foregroundStyle(primary).monospacedDigit()
      }
      GlanceActivityBar(
        progress: model.progress,
        tint: theme.gold,
        track: onIsland ? Color.white.opacity(0.22) : theme.secondaryText.opacity(0.2))
      if let amount = model.amount {
        Text(amount).font(.caption.monospacedDigit()).foregroundStyle(secondary).privacySensitive()
      }
    }
    .padding(onIsland ? 14 : 16)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(onIsland ? Color.clear : theme.bg)
  }
}

struct GlanceActivityBar: View {
  var progress: Double
  var tint: Color
  var track: Color
  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(track)
        Capsule().fill(tint).frame(width: geometry.size.width * min(max(progress, 0), 1))
      }
    }
    .frame(height: 6)
  }
}

/// Screenshot chrome for the Dynamic Island. The system draws the real island.
struct GlanceIslandFrame<Content: View>: View {
  var compact: Bool
  @ViewBuilder var content: () -> Content
  var body: some View {
    content()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background {
        if compact {
          Capsule().fill(Color.black)
        } else {
          RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.black)
        }
      }
  }
}
