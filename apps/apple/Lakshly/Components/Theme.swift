import SwiftUI

/// Adaptive asset colors are the single source of truth for the app palette.
enum Theme {
  static let bg = Color("bg")
  static let surface = Color("surface")
  static let secondaryText = Color("secondaryText")
  static let gold = Color("gold")
  static let lotus = Color("lotus")
  static let income = Color("income")
  static let spend = Color("spend")
  static let invest = Color("invest")
  static let danger = Color("danger")
  static let success = Color("success")

  static let indigo = Color("chartRent")
  static let slate = Color("chartOther")
  static let ambientIndigo = Color("ambientIndigo")
  static let lockBackground = Color("lockBackground")
  static let lockGold = Color("lockGold")
  // White is reserved for reflected light, never text.
  static let specular = Color.white
  static let clear = Color.clear

  /// Stable category identities; hue and luminance vary in each appearance.
  /// The chart legend labels supplement color, including the single lotus accent.
  static let categoryColors: KeyValuePairs<String, Color> = [
    "Income": income,
    "Groceries": Color("chartGroceries"),
    "Dining": Color("chartDining"),
    "Transport": Color("chartTransport"),
    "Fuel": Color("chartFuel"),
    "Shopping": Color("chartShopping"),
    "Utilities": Color("chartUtilities"),
    "Rent": indigo,
    "Health": Color("chartHealth"),
    "Education": Color("chartEducation"),
    "Entertainment": Color("chartEntertainment"),
    "Travel": Color("chartTravel"),
    "Subscriptions": gold,
    "Insurance": Color("chartInsurance"),
    "Investments": invest,
    "Emi": Color("chartEmi"),
    "Fees": Color("chartFees"),
    "Transfers": Color("chartTransfers"),
    "Cash": Color("chartCash"),
    "Gifts": lotus,
    "Other": slate,
  ]
}

struct ThemeBackground: View {
  @Environment(\.colorScheme) private var colorScheme
  var body: some View {
    GeometryReader { geometry in
      ZStack {
        Theme.bg
        RadialGradient(
          colors: [Theme.ambientIndigo.opacity(colorScheme == .dark ? 0.12 : 0.05), Theme.clear],
          center: .topLeading, startRadius: 0,
          endRadius: max(geometry.size.width, geometry.size.height) * 0.9
        )
        RadialGradient(
          colors: [Theme.gold.opacity(colorScheme == .dark ? 0.05 : 0.025), Theme.clear],
          center: .bottomTrailing, startRadius: 0,
          endRadius: max(geometry.size.width, geometry.size.height) * 0.8
        )
      }
    }.ignoresSafeArea().allowsHitTesting(false).accessibilityHidden(true)
  }
}

/// Plain native editing with an adaptive surface, including multiline fields.
struct ThemedFieldStyle: TextFieldStyle {
  func _body(configuration: TextField<Self._Label>) -> some View {
    configuration.textFieldStyle(.plain)
      .foregroundStyle(.primary)
      .padding(.horizontal, 14).padding(.vertical, 12)
      .background(Theme.surface.opacity(0.9), in: RoundedRectangle(cornerRadius: 12))
      .overlay {
        RoundedRectangle(cornerRadius: 12).strokeBorder(.primary.opacity(0.12), lineWidth: 0.5)
          .allowsHitTesting(false)
      }
  }
}

struct ThemedSubmitStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled
  func makeBody(configuration: Configuration) -> some View {
    configuration.label.font(.body.weight(.semibold))
      .foregroundStyle(isEnabled ? Theme.gold : Theme.secondaryText)
      .padding(.horizontal, 20).padding(.vertical, 12)
      .background(Theme.surface, in: Capsule())
      .overlay {
        Capsule().strokeBorder(isEnabled ? Theme.gold : Theme.secondaryText, lineWidth: 0.75)
      }
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
  }
}
