#if DEBUG
import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Orchestrator-only privacy screenshots: synthetic demo data, offscreen host views (no window is shown).
@MainActor enum PrivacyShotRenderer {
  static let themes: [(ThemeID, ColorScheme)] = [(.lakshmi, .dark), (.monochromeGold, .light)]
  static let screens = ["overview", "debt", "toggle", "settings"]

  static func render(to directory: URL) throws -> [URL] {
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platform = "ios", size = CGSize(width: 390, height: 1000)
    #else
    let platform = "macos", size = CGSize(width: 900, height: 900)
    #endif
    let suiteName = "app.lakshly.privacy-shots"
    let defaults = UserDefaults(suiteName: suiteName)!
    defaults.removePersistentDomain(forName: suiteName)
    let data = DataStore(backing: MemoryStoredData(), defaults: defaults, loadSyntheticDemo: true)
    let session = SetupSession(store: data, defaults: defaults)
    let entitlements = EntitlementStore(syncPurchases: {})
    var written: [URL] = []
    for (id, scheme) in themes {
      let theme = ThemePalette(id, scheme: scheme)
      let appearance = scheme == .dark ? "dark" : "light"
      for masked in [false, true] {
        let privacy = PrivacyStore(defaults: defaults, group: defaults, reload: {})
        privacy.setPrivacy(masked, source: "shots")
        for screen in screens {
          let view = content(screen, data: data, masked: masked)
            .environment(\.privacy, privacy).environment(\.theme, theme)
            .environment(session).environment(entitlements).environment(data)
            .foregroundStyle(theme.text).tint(theme.gold)
            .environment(\.colorScheme, scheme)
            .frame(width: size.width, height: size.height, alignment: .top)
            .background(theme.bg)
          let state = masked ? "hidden" : "visible"
          let url = directory.appendingPathComponent("privacy-\(screen)-\(state)-\(platform)-\(id.rawValue)-\(appearance).png")
          #if os(macOS)
          // AppKit-backed Form needs a host view; everything else renders through ImageRenderer.
          let bytes = screen == "settings"
            ? try snapshot(AnyView(view), size: size, dark: scheme == .dark)
            : try imageRender(AnyView(view.environment(\.setupRendering, true)), size: size)
          try bytes.write(to: url)
          #else
          try snapshot(AnyView(view), size: size, dark: scheme == .dark).write(to: url)
          #endif
          written.append(url)
        }
      }
      defaults.removePersistentDomain(forName: suiteName)
    }
    return written
  }

  @ViewBuilder private static func content(_ screen: String, data: DataStore, masked: Bool) -> some View {
    switch screen {
    case "overview": OverviewView(store: data, showFeedback: {})
    case "debt": DebtView(store: data)
    case "toggle":
      VStack(alignment: .leading, spacing: 24) {
        Text("Eye button").font(.title2.weight(.semibold))
        HStack(spacing: 16) { ProfileChip(store: data); Spacer(); PrivacyToggle().font(.title2) }
          .padding(16).glassCard()
        Text(masked ? "Amounts hidden · tap 👁 to show" : "Tap the eye, double-tap the net worth, shake (iPhone) or ⌘⇧H.")
          .font(.callout)
        #if os(macOS)
        MenuBarGlanceBody(snapshot: nil, revealed: false, premium: false,
          message: masked ? "Privacy mode is on. Amounts stay hidden." : nil,
          privacyHidden: masked).glassCard()
        #endif
        Spacer(minLength: 0)
      }.padding(24)
    default:
      Form { PrivacySettingsSection() }.formStyle(.grouped).scrollContentBackground(.hidden)
    }
  }

  #if os(macOS)
  static func imageRender(_ view: AnyView, size: CGSize) throws -> Data {
    let renderer = ImageRenderer(content: view)
    renderer.scale = 2; renderer.isOpaque = true
    renderer.proposedSize = ProposedViewSize(width: size.width, height: size.height)
    guard let tiff = renderer.nsImage?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let bytes = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.coderReadCorrupt) }
    return bytes
  }
  #endif
  static func snapshot(_ view: AnyView, size: CGSize, dark: Bool) throws -> Data {
    #if os(iOS)
    let host = UIHostingController(rootView: view)
    host.overrideUserInterfaceStyle = dark ? .dark : .light
    let window = UIWindow(frame: CGRect(origin: .zero, size: size))
    window.rootViewController = host
    window.isHidden = false
    host.view.frame = window.bounds
    host.view.layoutIfNeeded()
    RunLoop.main.run(until: Date().addingTimeInterval(0.6))
    let format = UIGraphicsImageRendererFormat(); format.scale = 3; format.opaque = true
    let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
      host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
    }
    window.isHidden = true
    guard let bytes = image.pngData() else { throw CocoaError(.coderReadCorrupt) }
    return bytes
    #else
    let hosting = NSHostingView(rootView: view)
    hosting.wantsLayer = true
    hosting.frame = CGRect(origin: .zero, size: size)
    let window = NSWindow(contentRect: hosting.frame, styleMask: [.borderless], backing: .buffered, defer: false)
    window.appearance = NSAppearance(named: dark ? .darkAqua : .aqua)
    window.contentView = hosting
    hosting.layoutSubtreeIfNeeded()
    var captured: NSBitmapImageRep?
    // The first pass of a scrolling page can come back empty; wait and capture again until it draws.
    for attempt in 0..<6 {
      RunLoop.main.run(until: Date().addingTimeInterval(attempt == 0 ? 0.6 : 1.0))
      hosting.layoutSubtreeIfNeeded()
      guard let rep = hosting.bitmapImageRepForCachingDisplay(in: hosting.bounds) else { continue }
      hosting.cacheDisplay(in: hosting.bounds, to: rep)
      captured = rep
      let corner = rep.colorAt(x: 2, y: 2)?.alphaComponent ?? 0
      let middle = rep.colorAt(x: rep.pixelsWide / 2, y: rep.pixelsHigh / 2)?.alphaComponent ?? 0
      if corner > 0 || middle > 0 { break }
      // Gradient-backed pages may not draw through cacheDisplay; fall back to rendering the layer tree.
      if attempt >= 1, let layer = hosting.layer,
         let layerRep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(size.width * 2), pixelsHigh: Int(size.height * 2),
           bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0),
         let context = NSGraphicsContext(bitmapImageRep: layerRep) {
        let cg = context.cgContext
        cg.translateBy(x: 0, y: size.height * 2); cg.scaleBy(x: 2, y: -2)
        layer.render(in: cg)
        captured = layerRep
        if (layerRep.colorAt(x: layerRep.pixelsWide / 2, y: layerRep.pixelsHigh / 2)?.alphaComponent ?? 0) > 0 { break }
      }
    }
    guard let rep = captured, let bytes = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.coderReadCorrupt) }
    return bytes
    #endif
  }
}
#endif
