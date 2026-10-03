#if DEBUG
import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

enum SetupShotRenderer {
  static let screens: [(name: String, step: SetupStep, health: Bool, consent: Bool)] = [
    ("welcome", .welcome, false, false),
    ("email", .email, false, false),
    ("accounts", .accounts, false, false),
    ("import", .importStep, false, false),
    ("plan", .plan, false, false),
    ("done", .done, false, false),
    ("health", .done, true, false),
    ("consent", .email, false, true),
  ]
  static let themes: [(ThemeID, ColorScheme)] = [(.lakshmi, .dark), (.monochromeGold, .light)]

  @MainActor static func render(to directory: URL, catalog: SourcesCatalog, midway: SetupState, dataset: Dataset) throws {
    SetupSources.testingCatalog = catalog
    defer { SetupSources.testingCatalog = nil }
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    #if os(iOS)
    let platformName = "ios"
    let size = CGSize(width: 390, height: 844)
    let scale: CGFloat = 3
    #else
    let platformName = "macos"
    let size = CGSize(width: 760, height: 600)
    let scale: CGFloat = 2
    #endif
    let today = "2026-10-03"
    let rows = setupDataset(from: dataset, goals: [])
    for (theme, scheme) in themes {
      let appearance = scheme == .dark ? "dark" : "light"
      for screen in screens {
        var state = screen.name == "welcome" ? initialSetup(now: "2026-10-03T11:00:00+05:30") : midway
        state.appLock = false
        state.currentStep = screen.step
        let score = checklist(state, rows, setupPlatform, today: today)
        let model = SetupCanvasModel(
          state: state,
          checklist: score,
          goals: [],
          budgets: dataset.budgets ?? [],
          dataset: rows,
          today: today,
          health: screen.health,
          showConsent: screen.consent,
          betaNotice: false,
          hideAmounts: false,
          toast: nil,
          pending: nil,
          rendering: true,
          showsFolderWatch: setupPlatform == .macos,
          platform: setupPlatform,
          emailLimit: 3,
          themeID: theme.rawValue,
          celebrate: screen.name == "done",
          budgetCurrency: "INR",
          continueDisabled: false)
        let palette = ThemePalette(theme, scheme: scheme)
        let view = SetupSnapshot(model: model)
          .environment(\.theme, palette)
          .environment(\.colorScheme, scheme)
          .preferredColorScheme(scheme)
          .frame(width: size.width, height: size.height, alignment: .top)
          .clipped()
          .background(palette.bg)
        let data = try png(view, size: size, scale: scale)
        let file = "\(platformName)-\(screen.name)-\(theme.rawValue)-\(appearance).png"
        try data.write(to: directory.appendingPathComponent(file))
      }
    }
  }

  @MainActor private static func png<V: View>(_ view: V, size: CGSize, scale: CGFloat) throws -> Data {
    let renderer = ImageRenderer(content: view)
    renderer.scale = scale
    renderer.isOpaque = true
    renderer.proposedSize = ProposedViewSize(width: size.width, height: size.height)
    #if os(iOS)
    guard let image = renderer.uiImage, let data = image.pngData() else { throw CocoaError(.coderReadCorrupt) }
    return data
    #else
    guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let data = rep.representation(using: .png, properties: [:])
    else { throw CocoaError(.coderReadCorrupt) }
    return data
    #endif
  }
}
#endif
