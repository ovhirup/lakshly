#if DEBUG
import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

enum TierShotRenderer {
  static let screens = ["identity-chip", "settings-profile"]
  static let themes: [(ThemeID, ColorScheme)] = [(.lakshmi, .dark), (.monochromeGold, .light)]
  @MainActor static func render(to directory: URL) throws {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios", width: CGFloat = 390, height: CGFloat = 1100, scale: CGFloat = 3
    #else
    let platform = "macos", width: CGFloat = 760, height: CGFloat = 1000, scale: CGFloat = 2
    #endif
    for (id, scheme) in themes {
      let theme = ThemePalette(id, scheme: scheme)
      let appearance = scheme == .dark ? "dark" : "light"
      for tier in [Tier.free, .premium] {
        for screen in screens {
          let content = snapshot(screen: screen, tier: tier)
            .foregroundStyle(theme.text).tint(theme.gold)
            .environment(\.setupRendering, true)
            .environment(\.theme, theme).environment(\.colorScheme, scheme).preferredColorScheme(scheme)
            .frame(width: width, height: height, alignment: .top).background(theme.bg)
          let renderer = ImageRenderer(content: content)
          renderer.scale = scale; renderer.isOpaque = true
          renderer.proposedSize = ProposedViewSize(width: width, height: height)
          #if os(iOS)
          guard let bytes = renderer.uiImage?.pngData() else { throw CocoaError(.coderReadCorrupt) }
          #else
          guard let tiff = renderer.nsImage?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                let bytes = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.coderReadCorrupt) }
          #endif
          let plan = tier == .free ? "free" : "premium"
          try bytes.write(to: directory.appendingPathComponent("tier-\(plan)-\(screen)-\(platform)-\(id.rawValue)-\(appearance).png"))
        }
      }
    }
  }
  @MainActor private static func snapshot(screen: String, tier: Tier) -> some View {
    VStack(alignment: .leading, spacing: 20) {
      Text(screen == "identity-chip" ? "Your profile" : "Settings").font(.title2.weight(.semibold))
      if screen == "identity-chip" {
        ProfileIdentity(profile: ProfileRecord(name: "Asha"), tier: tier).glassCard()
      } else {
        Card(title: "Profile") {
          ProfileIdentity(profile: ProfileRecord(name: "Asha"), tier: tier)
          TierProfileDetails(tier: tier, purchaseDate: Date(timeIntervalSince1970: 1_759_449_600),
            expirationDate: Date(timeIntervalSince1970: 1_793_664_000), willRenew: true)
          #if os(iOS)
          if tier >= .premium { Button("Manage subscription") {}.frame(minHeight: 44) }
          #endif
        }
        TierBenefits(tier: tier, showUpsell: true)
      }
      Spacer(minLength: 0)
    }.padding(24)
  }
}
#endif
