import SwiftUI

enum GlanceWidgetStyle {
  case small, medium, circular, rectangular, inline
}

extension GlancePace {
  func tint(_ theme: ThemePalette) -> Color {
    switch self {
    case .ahead: theme.success
    case .onTrack: theme.gold
    case .over: theme.danger
    }
  }
}

struct GlanceMoneyLabel: View {
  @Environment(\.theme) private var theme
  var amount: GlanceAmountText
  var caption: String?
  var body: some View {
    HStack(spacing: 4) {
      Text(amount.text)
        .monospacedDigit()
        .privacySensitive(amount.isPrivate)
      if let caption {
        Text(caption).foregroundStyle(theme.secondaryText)
      }
    }
    .lineLimit(1)
    .minimumScaleFactor(0.6)
  }
}

struct GlanceRing: View {
  @Environment(\.theme) private var theme
  var percent: Double
  var tint: Color
  var lineWidth: CGFloat = 10
  var body: some View {
    ZStack {
      Circle().stroke(theme.secondaryText.opacity(0.18), lineWidth: lineWidth)
      Circle()
        .trim(from: 0, to: min(max(percent, 0), 100) / 100)
        .stroke(tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text(GlanceFormat.percent(percent))
        .font(.system(size: lineWidth > 8 ? 22 : 13, weight: .bold, design: .rounded))
        .minimumScaleFactor(0.5)
        .monospacedDigit()
    }
    .accessibilityLabel("Budget \(GlanceFormat.percent(percent, digits: 1))")
  }
}

struct GlanceGauge: View {
  @Environment(\.theme) private var theme
  var percent: Double
  var tint: Color
  var body: some View {
    ZStack {
      Circle()
        .trim(from: 0, to: 0.75)
        .stroke(theme.secondaryText.opacity(0.2), style: StrokeStyle(lineWidth: 8, lineCap: .round))
        .rotationEffect(.degrees(135))
      Circle()
        .trim(from: 0, to: 0.75 * min(max(percent, 0), 100) / 100)
        .stroke(tint, style: StrokeStyle(lineWidth: 8, lineCap: .round))
        .rotationEffect(.degrees(135))
      VStack(spacing: 0) {
        Text(GlanceFormat.percent(percent))
          .font(.system(.headline, design: .rounded, weight: .bold))
          .minimumScaleFactor(0.5)
        Text("repaid").font(.system(size: 9)).foregroundStyle(theme.secondaryText)
      }
    }
    .accessibilityLabel("Debt \(GlanceFormat.percent(percent, digits: 1)) repaid")
  }
}

struct GlancePaceBar: View {
  @Environment(\.theme) private var theme
  var spend: Double
  var elapsed: Double
  var tint: Color
  var body: some View {
    GeometryReader { geometry in
      let width = geometry.size.width
      ZStack(alignment: .leading) {
        Capsule().fill(theme.secondaryText.opacity(0.16))
        Capsule().fill(tint).frame(width: width * min(max(spend, 0), 100) / 100)
        Rectangle()
          .fill(theme.text.opacity(0.9))
          .frame(width: 2)
          .offset(x: width * min(max(elapsed, 0), 100) / 100 - 1)
      }
    }
    .frame(height: 8)
    .accessibilityLabel("Spent \(GlanceFormat.percent(spend, digits: 1)), \(GlanceFormat.percent(elapsed)) of the month")
  }
}

struct GlanceDebtBar: View {
  @Environment(\.theme) private var theme
  var percent: Double
  var body: some View {
    GeometryReader { geometry in
      ZStack(alignment: .leading) {
        Capsule().fill(theme.secondaryText.opacity(0.16))
        Capsule()
          .fill(LinearGradient(colors: [theme.lotus, theme.gold], startPoint: .leading, endPoint: .trailing))
          .frame(width: geometry.size.width * min(max(percent, 0), 100) / 100)
      }
    }
    .frame(height: 8)
  }
}

struct GlancePremiumUpsell: View {
  @Environment(\.theme) private var theme
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "lock.fill").font(.title3).foregroundStyle(theme.gold)
      Text("Lakshly Premium")
        .font(.system(.headline, design: .rounded, weight: .bold))
        .multilineTextAlignment(.center)
      Text("Lakshly Premium widget — open Lakshly to upgrade")
        .font(.caption)
        .foregroundStyle(theme.secondaryText)
        .multilineTextAlignment(.center)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct GlanceEmptyGlance: View {
  @Environment(\.theme) private var theme
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "leaf.fill").font(.title2).foregroundStyle(theme.gold)
      Text("Open Lakshly")
        .font(.system(.headline, design: .rounded, weight: .bold))
      Text("Your glance appears after Lakshly opens.")
        .font(.caption)
        .foregroundStyle(theme.secondaryText)
        .multilineTextAlignment(.center)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct GlanceWidgetView: View {
  @Environment(\.theme) private var theme
  var snapshot: GlanceSnapshot?
  var kind: GlanceWidgetKind
  var style: GlanceWidgetStyle
  var showsAmounts: Bool

  var body: some View {
    Group {
      if let snapshot {
        if GlanceWidgetAccess.allows(kind, tier: snapshot.tier.accessTier) {
          populated(snapshot)
        } else {
          GlancePremiumUpsell()
        }
      } else {
        GlanceEmptyGlance()
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .foregroundStyle(theme.text)
  }

  @ViewBuilder private func populated(_ snapshot: GlanceSnapshot) -> some View {
    switch kind {
    case .budgetPace: budget(snapshot)
    case .upcomingBill: bill(snapshot)
    case .netWorth: netWorth(snapshot)
    case .debt: debt(snapshot)
    }
  }

  private func money(_ paise: Int64?) -> GlanceAmountText {
    guard showsAmounts, let paise else { return .masked }
    return .shown(paise)
  }

  @ViewBuilder private func budget(_ snapshot: GlanceSnapshot) -> some View {
    let pace = snapshot.budget
    let tint = pace.status.tint(theme)
    switch style {
    case .inline:
      Text(budgetInline(pace)).lineLimit(1)
    case .circular:
      VStack(spacing: 2) {
        GlanceRing(percent: pace.monthSpendPercent, tint: tint, lineWidth: 8)
        if showsAmounts {
          GlanceMoneyLabel(amount: money(pace.safeToSpendPerDay)).font(.system(size: 9, weight: .semibold))
        }
      }
      .padding(4)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .rectangular:
      HStack(spacing: 8) {
        GlanceRing(percent: pace.monthSpendPercent, tint: tint, lineWidth: 6).frame(width: 36, height: 36)
        VStack(alignment: .leading, spacing: 2) {
          Text("Budget").font(.caption2.weight(.semibold)).foregroundStyle(theme.secondaryText).lineLimit(1)
          Text(pace.status.word).font(.caption.weight(.bold)).lineLimit(1).minimumScaleFactor(0.8)
          Text("\(GlanceFormat.percent(pace.monthElapsedPercent)) of month")
            .font(.caption2).foregroundStyle(theme.secondaryText).lineLimit(1).minimumScaleFactor(0.8)
        }
        Spacer(minLength: 4)
        GlanceMoneyLabel(amount: money(pace.safeToSpendPerDay)).font(.caption.weight(.semibold)).lineLimit(1)
      }
      .padding(.horizontal, 4)
    case .medium:
      HStack(spacing: 16) {
        GlanceRing(percent: pace.monthSpendPercent, tint: tint).frame(width: 108, height: 108)
        VStack(alignment: .leading, spacing: 8) {
          Text("Budget pace").font(.caption.weight(.semibold)).foregroundStyle(theme.gold)
          Text(pace.status.word).font(.system(.title2, design: .rounded, weight: .bold)).foregroundStyle(tint)
          Text("\(GlanceFormat.percent(pace.monthSpendPercent, digits: 1)) spent · \(GlanceFormat.percent(pace.monthElapsedPercent)) elapsed")
            .font(.caption).foregroundStyle(theme.secondaryText).lineLimit(2)
          GlancePaceBar(spend: pace.monthSpendPercent, elapsed: pace.monthElapsedPercent, tint: tint)
          GlanceMoneyLabel(amount: money(pace.safeToSpendPerDay), caption: "safe / day")
            .font(.subheadline.weight(.semibold))
        }
        Spacer(minLength: 0)
      }
      .padding(16)
    case .small:
      VStack(spacing: 8) {
        GlanceRing(percent: pace.monthSpendPercent, tint: tint).frame(width: 96, height: 96)
        Text(pace.status.word).font(.system(.caption, design: .rounded, weight: .bold)).foregroundStyle(tint)
        GlanceMoneyLabel(amount: money(pace.safeToSpendPerDay), caption: "/ day")
          .font(.caption.weight(.semibold))
      }
      .padding(12)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func budgetInline(_ pace: GlanceBudgetPace) -> String {
    var text = "Budget \(GlanceFormat.percent(pace.monthSpendPercent)) · \(pace.status.word)"
    if showsAmounts, let safe = pace.safeToSpendPerDay { text += " · \(Money.glance(safe))/day" }
    else if !showsAmounts { text += " · ••••" }
    return text
  }

  @ViewBuilder private func bill(_ snapshot: GlanceSnapshot) -> some View {
    if let bill = snapshot.nextBill {
      switch style {
      case .inline:
        Text(billInline(bill)).lineLimit(1)
      case .circular:
        VStack(spacing: 2) {
          Image(systemName: bill.kind.symbol).font(.title3).foregroundStyle(theme.gold)
          Text(bill.kind.word).font(.caption2.weight(.bold))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
      case .rectangular, .small:
        VStack(alignment: .leading, spacing: style == .small ? 8 : 4) {
          Label("Next bill", systemImage: bill.kind.symbol)
            .font(.caption.weight(.semibold)).foregroundStyle(theme.gold).lineLimit(1)
          Text(bill.name).font(.system(style == .small ? .headline : .subheadline, design: .rounded, weight: .bold))
            .lineLimit(style == .small ? 2 : 1)
          HStack {
            Text(bill.dueDate.formatted(.dateTime.day().month(.abbreviated)))
              .font(.caption).foregroundStyle(theme.secondaryText)
            Spacer(minLength: 4)
            GlanceMoneyLabel(amount: money(bill.amount)).font(.caption.weight(.semibold))
          }
          if style == .small { Spacer(minLength: 0) }
        }
        .padding(style == .small ? 14 : 4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      case .medium:
        HStack(alignment: .top, spacing: 14) {
          Image(systemName: bill.kind.symbol)
            .font(.title).foregroundStyle(theme.gold)
            .frame(width: 64, height: 64)
            .background(theme.gold.opacity(0.14), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
          VStack(alignment: .leading, spacing: 6) {
            Text("Upcoming bill").font(.caption.weight(.semibold)).foregroundStyle(theme.gold)
            Text(bill.name).font(.system(.title3, design: .rounded, weight: .bold)).lineLimit(2)
            Text("\(bill.kind.word) · \(bill.dueDate.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))")
              .font(.subheadline).foregroundStyle(theme.secondaryText)
            GlanceMoneyLabel(amount: money(bill.amount)).font(.title3.weight(.bold))
          }
          Spacer(minLength: 0)
        }
        .padding(16)
      }
    } else {
      Text("No upcoming bill").font(.caption).foregroundStyle(theme.secondaryText)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private func billInline(_ bill: GlanceBill) -> String {
    let date = bill.dueDate.formatted(.dateTime.day().month(.abbreviated))
    if showsAmounts, let amount = bill.amount { return "\(bill.name) · \(date) · \(Money.glance(amount))" }
    return "\(bill.name) · \(date)"
  }

  @ViewBuilder private func netWorth(_ snapshot: GlanceSnapshot) -> some View {
    switch style {
    case .inline, .circular, .rectangular:
      HStack(spacing: 6) {
        Image(systemName: snapshot.netWorthTrend.symbol).foregroundStyle(theme.gold)
        Text(snapshot.netWorthTrend.word).font(.caption.weight(.bold)).lineLimit(1)
        Spacer(minLength: 4)
        GlanceMoneyLabel(amount: money(snapshot.netWorth)).font(.caption.weight(.semibold))
      }
      .padding(.horizontal, 8)
    case .medium, .small:
      VStack(alignment: .leading, spacing: style == .medium ? 10 : 8) {
        Text("Net worth").font(.caption.weight(.semibold)).foregroundStyle(theme.gold)
        HStack(spacing: 8) {
          Image(systemName: snapshot.netWorthTrend.symbol)
            .font(style == .medium ? .title : .title3)
            .foregroundStyle(theme.gold)
          Text(snapshot.netWorthTrend.word)
            .font(.system(style == .medium ? .largeTitle : .title, design: .rounded, weight: .bold))
        }
        GlanceMoneyLabel(amount: money(snapshot.netWorth))
          .font(.system(style == .medium ? .title : .title3, design: .rounded, weight: .bold))
        Text(snapshot.netWorthTrend == .flat ? "Holding steady" : "Since last month")
          .font(.caption).foregroundStyle(theme.secondaryText)
        Spacer(minLength: 0)
      }
      .padding(style == .medium ? 16 : 14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }

  @ViewBuilder private func debt(_ snapshot: GlanceSnapshot) -> some View {
    switch style {
    case .inline:
      Text("Debt \(GlanceFormat.percent(snapshot.debtRepaidPercent)) repaid").lineLimit(1)
    case .circular:
      VStack(spacing: 2) {
        GlanceGauge(percent: snapshot.debtRepaidPercent, tint: theme.gold)
        if showsAmounts {
          GlanceMoneyLabel(amount: money(snapshot.debtOutstanding)).font(.system(size: 9, weight: .semibold))
        }
      }
      .padding(4)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .rectangular:
      VStack(alignment: .leading, spacing: 4) {
        HStack {
          Text("Debt \(GlanceFormat.percent(snapshot.debtRepaidPercent))").font(.caption.weight(.bold))
          Spacer()
          GlanceMoneyLabel(amount: money(snapshot.debtOutstanding)).font(.caption2)
        }
        GlanceDebtBar(percent: snapshot.debtRepaidPercent)
      }
      .padding(.horizontal, 4)
    case .medium, .small:
      VStack(alignment: .leading, spacing: 10) {
        Text("Debt").font(.caption.weight(.semibold)).foregroundStyle(theme.gold)
        Text("\(GlanceFormat.percent(snapshot.debtRepaidPercent, digits: snapshot.debtRepaidPercent.rounded() == snapshot.debtRepaidPercent ? 0 : 1)) repaid")
          .font(.system(style == .medium ? .largeTitle : .title, design: .rounded, weight: .bold))
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        GlanceDebtBar(percent: snapshot.debtRepaidPercent)
        HStack {
          Text("Outstanding").font(.caption).foregroundStyle(theme.secondaryText)
          Spacer()
          GlanceMoneyLabel(amount: money(snapshot.debtOutstanding)).font(.subheadline.weight(.semibold))
        }
        Spacer(minLength: 0)
      }
      .padding(style == .medium ? 16 : 14)
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
  }
}

struct MenuBarGlanceBody: View {
  @Environment(\.theme) private var theme
  var snapshot: GlanceSnapshot?
  var revealed: Bool
  var premium: Bool
  var message: String?
  var onReveal: () -> Void = {}
  var onOpen: () -> Void = {}
  var onQuit: () -> Void = {}

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .firstTextBaseline) {
        Text("Lakshly").font(.system(.title3, design: .rounded, weight: .bold))
        Spacer()
        Text("Glance").font(.caption.weight(.bold)).foregroundStyle(theme.gold)
      }
      if let snapshot {
        budgetRow(snapshot)
        if let bill = snapshot.nextBill { billRow(bill) }
        debtRow(snapshot)
        if premium { netRow(snapshot) }
        Text("Updated \(snapshot.generatedAt.formatted(date: .abbreviated, time: .shortened))")
          .font(.caption2).foregroundStyle(theme.secondaryText)
      } else {
        GlanceEmptyGlance().frame(height: 120)
      }
      if let message {
        Text(message).font(.caption).foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
      }
      if revealed {
        Text("Amounts hide after a minute.").font(.caption2).foregroundStyle(theme.secondaryText)
      }
      Divider().overlay(theme.secondaryText.opacity(0.2))
      HStack {
        Button(revealed ? "Hide amounts" : "Reveal amounts", action: onReveal)
        Spacer()
        Button("Open Lakshly", action: onOpen)
      }
      .font(.caption.weight(.semibold))
      Button("Quit", action: onQuit).font(.caption).foregroundStyle(theme.secondaryText)
    }
    .padding(16)
    .frame(width: 320, alignment: .leading)
    .foregroundStyle(theme.text)
    .background {
      ZStack {
        theme.bg
        RadialGradient(colors: [theme.gold.opacity(0.18), theme.clear], center: .topLeading, startRadius: 0, endRadius: 280)
        RadialGradient(colors: [theme.lotus.opacity(0.1), theme.clear], center: .bottomTrailing, startRadius: 0, endRadius: 220)
      }
    }
    .overlay {
      RoundedRectangle(cornerRadius: 22, style: .continuous)
        .strokeBorder(
          LinearGradient(colors: [theme.specular.opacity(0.75), theme.clear], startPoint: .top, endPoint: .center),
          lineWidth: 0.8)
    }
    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
  }

  private func money(_ paise: Int64?) -> GlanceAmountText {
    guard revealed, let paise else { return .masked }
    return .shown(paise)
  }

  private func budgetRow(_ snapshot: GlanceSnapshot) -> some View {
    let pace = snapshot.budget
    return HStack(spacing: 12) {
      GlanceRing(percent: pace.monthSpendPercent, tint: pace.status.tint(theme), lineWidth: 8)
        .frame(width: 72, height: 72)
      VStack(alignment: .leading, spacing: 4) {
        Text("Budget · \(pace.status.word)")
          .font(.system(.headline, design: .rounded, weight: .bold))
          .foregroundStyle(pace.status.tint(theme))
        Text("\(GlanceFormat.percent(pace.monthSpendPercent, digits: 1)) spent · \(GlanceFormat.percent(pace.monthElapsedPercent)) of the month")
          .font(.caption).foregroundStyle(theme.secondaryText)
        GlanceMoneyLabel(amount: money(pace.safeToSpendPerDay), caption: "safe / day")
          .font(.caption.weight(.semibold))
      }
      Spacer(minLength: 0)
    }
  }

  private func billRow(_ bill: GlanceBill) -> some View {
    HStack(alignment: .top, spacing: 8) {
      Image(systemName: bill.kind.symbol).foregroundStyle(theme.gold).frame(width: 18)
      VStack(alignment: .leading, spacing: 2) {
        Text(bill.name).font(.subheadline.weight(.semibold)).lineLimit(2)
        Text("\(bill.kind.word) · \(bill.dueDate.formatted(.dateTime.day().month(.abbreviated)))")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
      Spacer(minLength: 8)
      GlanceMoneyLabel(amount: money(bill.amount)).font(.caption.weight(.semibold))
    }
  }

  private func debtRow(_ snapshot: GlanceSnapshot) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        Text("Debt \(GlanceFormat.percent(snapshot.debtRepaidPercent, digits: 1)) repaid")
          .font(.caption.weight(.bold))
        Spacer()
        GlanceMoneyLabel(amount: money(snapshot.debtOutstanding)).font(.caption)
      }
      GlanceDebtBar(percent: snapshot.debtRepaidPercent)
    }
  }

  private func netRow(_ snapshot: GlanceSnapshot) -> some View {
    HStack(spacing: 8) {
      Image(systemName: snapshot.netWorthTrend.symbol).foregroundStyle(theme.gold)
      Text("Net worth · \(snapshot.netWorthTrend.word)").font(.caption.weight(.bold))
      Spacer()
      GlanceMoneyLabel(amount: money(snapshot.netWorth)).font(.caption.weight(.semibold))
    }
  }
}
