import SwiftUI

struct NotchAmountLabel: View {
  var line: NotchAmountLine
  var body: some View {
    Text(line.visibleText)
      .monospacedDigit()
      .blur(radius: line.isHidden ? 6 : 0)
      .accessibilityLabel(line.accessibilityLabel)
      .privacySensitive(!line.isHidden)
  }
}

/// Notch glance body. SwiftUI only, so ImageRenderer can paint it without opening a window.
struct NotchPanelFace: View {
  @Environment(\.theme) private var theme
  var content: NotchGlanceContent
  var message: String?
  var capHeight: CGFloat = 28
  var onReveal: () -> Void = {}

  var body: some View {
    NotchPanelGlass(content: content, message: message, capHeight: capHeight, onReveal: onReveal)
      .environment(\.theme, ThemePalette(theme.id, scheme: .dark))
      .environment(\.colorScheme, .dark)
  }
}

private struct NotchPanelGlass: View {
  @Environment(\.theme) private var theme
  var content: NotchGlanceContent
  var message: String?
  var capHeight: CGFloat
  var onReveal: () -> Void

  var body: some View {
    VStack(spacing: 0) {
      Color.black.frame(height: capHeight).accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 12) {
        header
        budget
        if content.safeToSpend != nil { safeRow }
        if content.upcomingLabel != nil { upcoming }
        if content.showsNetWorth { netRow }
        if let message {
          Text(message)
            .font(.caption2)
            .foregroundStyle(theme.secondaryText)
            .fixedSize(horizontal: false, vertical: true)
        }
        reveal
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .topLeading)
      .background { glass }
    }
    .frame(width: NotchMetrics.width)
    // Hug the content: the panel ends just under Reveal instead of filling a fixed height.
    .fixedSize(horizontal: false, vertical: true)
    .foregroundStyle(theme.text)
    .clipShape(
      UnevenRoundedRectangle(
        topLeadingRadius: 0,
        bottomLeadingRadius: NotchMetrics.cornerRadius,
        bottomTrailingRadius: NotchMetrics.cornerRadius,
        topTrailingRadius: 0,
        style: .continuous)
    )
    .accessibilityElement(children: .contain)
  }

  private var glass: some View {
    ZStack {
      Color.black
      theme.bg.opacity(0.88)
      LinearGradient(colors: [Color.black, Color.black.opacity(0)], startPoint: .top, endPoint: .init(x: 0.5, y: 0.28))
    }
    .accessibilityHidden(true)
  }

  private var header: some View {
    HStack(alignment: .firstTextBaseline) {
      Text("Lakshly").font(.system(.headline, design: .rounded, weight: .bold))
      Spacer(minLength: 8)
      Text("Glance").font(.caption.weight(.bold)).foregroundStyle(theme.gold)
    }
  }

  private var budget: some View {
    let tint = content.pace.tint(theme)
    return HStack(spacing: 12) {
      GlanceRing(percent: content.spendPercent, tint: tint, lineWidth: 7)
        .frame(width: 64, height: 64)
      VStack(alignment: .leading, spacing: 4) {
        Text(content.paceWord)
          .font(.system(.subheadline, design: .rounded, weight: .bold))
          .foregroundStyle(tint)
        Text(content.budgetUsedText).font(.caption.weight(.semibold))
        Text(content.monthProgressText).font(.caption2).foregroundStyle(theme.secondaryText)
        GlancePaceBar(spend: content.spendPercent, elapsed: content.elapsedPercent, tint: tint)
      }
      Spacer(minLength: 0)
    }
    .accessibilityElement(children: .combine)
  }

  private var safeRow: some View {
    HStack(spacing: 8) {
      Text("Safe to spend today").font(.caption.weight(.semibold))
      Spacer(minLength: 8)
      if let line = content.safeToSpend {
        NotchAmountLabel(line: line).font(.caption.weight(.semibold))
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var upcoming: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(content.upcomingTitle ?? "Next bill")
        .font(.caption2.weight(.semibold))
        .foregroundStyle(theme.gold)
      HStack(spacing: 8) {
        Text(content.upcomingLabel ?? "")
          .font(.subheadline.weight(.semibold))
          .lineLimit(1)
        if let date = content.upcomingDate {
          Text(date).font(.caption).foregroundStyle(theme.secondaryText)
        }
        Spacer(minLength: 8)
        if let line = content.upcomingAmount {
          NotchAmountLabel(line: line).font(.caption.weight(.semibold))
        }
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var netRow: some View {
    HStack(spacing: 8) {
      Text("Net worth").font(.caption.weight(.semibold))
      if let trend = content.netWorthTrend {
        Text(trend).font(.caption).foregroundStyle(theme.gold)
      }
      Spacer(minLength: 8)
      if let line = content.netWorth {
        NotchAmountLabel(line: line).font(.caption.weight(.semibold))
      }
    }
    .accessibilityElement(children: .combine)
  }

  private var reveal: some View {
    VStack(alignment: .leading, spacing: 4) {
      Button(content.revealed ? "Hide amounts" : "Reveal", action: onReveal)
        .font(.caption.weight(.semibold))
        .accessibilityIdentifier("notch.reveal")
        .accessibilityLabel(content.revealed ? "Hide amounts" : "Reveal amounts")
        .accessibilityHint("Confirms it's you, then shows amounts on this panel")
      if content.revealed {
        Text("Amounts hide after 30 seconds.")
          .font(.caption2)
          .foregroundStyle(theme.secondaryText)
      }
    }
  }
}

struct NotchGlanceSettingsBlock: View {
  @Environment(\.theme) private var theme
  var isOn: Bool
  var entitled: Bool
  var hasNotch: Bool
  var setOn: (Bool) -> Void = { _ in }
  var onLockedTap: () -> Void = {}

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 8) {
        Text("Notch glance")
        Spacer(minLength: 8)
        if !entitled {
          Pill(text: "✦ Premium", color: theme.gold)
            .accessibilityLabel("Premium")
        }
        Toggle("Notch glance", isOn: Binding(get: { entitled && isOn }, set: { setOn($0) }))
          .labelsHidden()
          .disabled(!entitled)
          .allowsHitTesting(entitled)
          .accessibilityHidden(!entitled)
          .accessibilityIdentifier("settings.notchGlance")
      }
      Text(NotchGlanceCopy.footnote(hasNotch: hasNotch))
        .font(.caption)
        .foregroundStyle(theme.secondaryText)
        .fixedSize(horizontal: false, vertical: true)
    }
    .overlay {
      if !entitled {
        Button(action: onLockedTap) {
          Color.clear.contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Notch glance, Premium")
        .accessibilityHint("Opens Lakshly Premium")
        .accessibilityIdentifier("settings.notchGlance")
      }
    }
  }
}

struct NotchHardwareMark: View {
  var width: CGFloat = 196
  var height: CGFloat = 34
  var body: some View {
    UnevenRoundedRectangle(
      topLeadingRadius: 0, bottomLeadingRadius: 14, bottomTrailingRadius: 14, topTrailingRadius: 0,
      style: .continuous)
      .fill(Color.black)
      .frame(width: width, height: height)
      .accessibilityHidden(true)
  }
}

struct NotchMenuStrip: View {
  @Environment(\.colorScheme) private var colorScheme
  var showsNotch: Bool
  var body: some View {
    ZStack(alignment: .top) {
      HStack {
        Text("Lakshly").font(.system(size: 12, weight: .semibold))
        Spacer()
        Text("9:41").font(.system(size: 12, weight: .medium)).monospacedDigit()
      }
      .padding(.horizontal, 14)
      .frame(maxWidth: .infinity)
      .frame(height: 36)
      .background(colorScheme == .dark ? Color(white: 0.14) : Color(white: 0.94))
      .foregroundStyle(colorScheme == .dark ? Color.white.opacity(0.88) : Color.black.opacity(0.75))
      if showsNotch {
        NotchHardwareMark()
      }
    }
    .frame(height: showsNotch ? 40 : 36)
    .accessibilityHidden(true)
  }
}

struct NotchPanelShot: View {
  var content: NotchGlanceContent
  var message: String? = nil
  var body: some View {
    VStack(spacing: 0) {
      NotchMenuStrip(showsNotch: true)
      NotchPanelFace(content: content, message: message, capHeight: 20)
        .padding(.top, -16)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}

struct NotchSettingsShot: View {
  @Environment(\.theme) private var theme
  var entitled: Bool
  var hasNotch: Bool
  var isOn: Bool
  var body: some View {
    VStack(spacing: 0) {
      NotchMenuStrip(showsNotch: hasNotch)
      NotchGlanceSettingsBlock(isOn: isOn, entitled: entitled, hasNotch: hasNotch)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .padding(16)
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
  }
}
