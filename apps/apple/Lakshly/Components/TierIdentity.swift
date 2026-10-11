import SwiftUI

struct TierPill: View {
  @Environment(\.theme) private var theme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.setupRendering) private var rendering
  @State private var sheen = false
  let tier: Tier
  // Gold membership identity stays gold even in themes with a blue/teal accent.
  private let gold = Color(hex: "#E9BF62")
  var body: some View {
    Group {
      switch tier {
      case .free:
        Text(tier.pillText).foregroundStyle(theme.text)
          .padding(.horizontal, 9).padding(.vertical, 5)
          .overlay { Capsule().strokeBorder(theme.text.opacity(0.34), lineWidth: 1) }
      case .premium:
        Text(tier.pillText).foregroundStyle(Color(hex: "#30230B"))
          .padding(.horizontal, 10).padding(.vertical, 5)
          .background(LinearGradient(colors: [Color(hex: "#FAE5B3"), gold, Color(hex: "#D0A54C")], startPoint: .topLeading, endPoint: .bottomTrailing))
          .overlay {
            if !reduceMotion && !rendering {
              GeometryReader { geometry in
                LinearGradient(colors: [.clear, .white.opacity(0.55), .clear], startPoint: .leading, endPoint: .trailing)
                  .frame(width: geometry.size.width * 0.4)
                  .rotationEffect(.degrees(-18))
                  .offset(x: sheen ? geometry.size.width * 1.4 : -geometry.size.width * 0.6)
              }.allowsHitTesting(false)
            }
          }.clipShape(Capsule())
      case .superUser:
        HStack(spacing: 5) {
          // Five overlapping petals form the private edition's gold lotus.
          ZStack {
            ForEach(-2...2, id: \.self) { petal in
              Ellipse().fill(gold).frame(width: 5, height: 12)
                .rotationEffect(.degrees(Double(petal) * 25), anchor: .bottom)
            }
          }.frame(width: 22, height: 14).accessibilityHidden(true)
          Text(tier.pillText)
        }.foregroundStyle(gold).padding(.horizontal, 10).padding(.vertical, 6)
          .background(Color(hex: "#0E1430"), in: Capsule())
      }
    }.font(.caption.weight(.bold)).fixedSize(horizontal: true, vertical: false)
      .accessibilityLabel(tier.accessibilityName)
      .task(id: reduceMotion) {
        sheen = false
        guard tier == .premium, !reduceMotion, !rendering else { return }
        withAnimation(.easeInOut(duration: 5.5).repeatForever(autoreverses: false)) { sheen = true }
      }
  }
}

/// Used by Settings and the offscreen renderer, with verified dates supplied by the store.
struct TierProfileDetails: View {
  let tier: Tier
  var purchaseDate: Date? = nil
  var expirationDate: Date? = nil
  var willRenew: Bool? = nil
  var body: some View {
    if tier == .free {
      Text("Lakshly Free · security and import are always free")
        .font(.subheadline).fixedSize(horizontal: false, vertical: true)
    } else {
      let line = TierMembership.line(purchaseDate: purchaseDate, expirationDate: expirationDate, willRenew: willRenew)
      if !line.isEmpty { Text(line).font(.subheadline).fixedSize(horizontal: false, vertical: true) }
      Text("⭐ Priority requests").font(.subheadline)
    }
  }
}

struct TierBenefits: View {
  let tier: Tier
  var showUpsell = false
  var seePremium: () -> Void = {}
  var notNow: () -> Void = {}
  private let perks = ["3 extra themes", "Forecast / debt planner", "Unlimited budgets", "Priority feedback"]
  var body: some View {
    if tier >= .premium {
      Card(title: "Your Premium perks") {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 145))], alignment: .leading, spacing: 12) {
          ForEach(perks, id: \.self) { perk in
            Label(perk, systemImage: "sparkle").font(.subheadline.weight(.semibold))
              .fixedSize(horizontal: false, vertical: true).frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
          }
        }
      }
    } else if showUpsell {
      Card(title: "Lakshly Premium") {
        Text("Lakshly Premium: 3 themes, payoff what-ifs, unlimited budgets.")
          .fixedSize(horizontal: false, vertical: true)
        HStack {
          Button("See Premium", action: seePremium).buttonStyle(ThemedSubmitStyle()).frame(minHeight: 44)
          Button("Not now", action: notNow).frame(minHeight: 44)
        }
      }
    }
  }
}
