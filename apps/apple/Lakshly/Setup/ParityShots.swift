#if DEBUG
import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

/// Offscreen cases use the production content components and synthetic state only.
enum ParityShotRenderer {
  static let nameScreens = ["welcome-empty", "welcome-typed", "identity-unset", "identity-set", "profile-sheet", "settings-profile"]
  static let batchScreens = ["results", "select-all", "running", "password", "summary"]
  @MainActor static func render(to directory: URL, catalog: SourcesCatalog, dataset: Dataset) throws {
    SetupSources.testingCatalog = catalog
    defer { SetupSources.testingCatalog = nil }
    #if os(iOS)
    let platform = "ios", size = CGSize(width: 390, height: 844), scale: CGFloat = 3
    let extraBatchHeight: CGFloat = 80
    #else
    let platform = "macos", size = CGSize(width: 760, height: 700), scale: CGFloat = 2
    let extraBatchHeight: CGFloat = 320
    #endif
    for (id, scheme) in SetupShotRenderer.themes {
      let theme = ThemePalette(id, scheme: scheme)
      let appearance = scheme == .dark ? "dark" : "light"
      for category in ["name", "gmail-tidy"] {
        let folder = directory.appendingPathComponent(category, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        for screen in category == "name" ? nameScreens : batchScreens {
          let content = category == "name" ? nameView(screen, dataset: dataset, themeID: id.rawValue) : batchView(screen)
          let height = category == "gmail-tidy" ? size.height + extraBatchHeight : size.height
          let view = content.foregroundStyle(theme.text).tint(theme.gold).environment(\.setupRendering, true).environment(\.theme, theme).environment(\.colorScheme, scheme)
            .preferredColorScheme(scheme).frame(width: size.width, height: height, alignment: .top)
            .background(theme.bg).clipped()
          let renderer = ImageRenderer(content: view)
          renderer.scale = scale; renderer.isOpaque = true
          renderer.proposedSize = ProposedViewSize(width: size.width, height: height)
          #if os(iOS)
          guard let data = renderer.uiImage?.pngData() else { throw CocoaError(.coderReadCorrupt) }
          #else
          guard let tiff = renderer.nsImage?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                let data = rep.representation(using: .png, properties: [:]) else { throw CocoaError(.coderReadCorrupt) }
          #endif
          try data.write(to: folder.appendingPathComponent("\(category)-\(screen)-\(platform)-\(id.rawValue)-\(appearance).png"))
        }
      }
    }
  }

  @MainActor private static func nameView(_ screen: String, dataset: Dataset, themeID: String) -> AnyView {
    let profile = ProfileRecord(name: screen == "identity-unset" || screen == "welcome-empty" ? nil : "Asha")
    if screen.hasPrefix("welcome") {
      var state = initialSetup(now: "2026-10-10T00:00:00Z")
      state.profile.name = profile.name ?? ""
      let rows = setupDataset(from: dataset, goals: [])
      let model = SetupCanvasModel(state: state, checklist: checklist(state, rows, setupPlatform, today: "2026-10-10"),
        goals: [], budgets: [], dataset: rows, today: "2026-10-10", health: false, showConsent: false,
        betaNotice: false, hideAmounts: false, toast: nil, pending: nil, rendering: true,
        showsFolderWatch: setupPlatform == .macos, platform: setupPlatform, emailLimit: 1,
        themeID: themeID, celebrate: false, budgetCurrency: "INR", continueDisabled: false)
      return AnyView(SetupSnapshot(model: model))
    }
    return AnyView(VStack(alignment: .leading, spacing: 20) {
      Text(screen == "settings-profile" ? "Settings" : "Your profile").font(.title2.weight(.semibold))
      if screen.hasPrefix("identity") {
        ProfileIdentity(profile: profile).padding(12).modifier(GlassCard())
      } else {
        Card(title: "Profile") {
          ProfileEditor(profile: profile, save: { _ in }, clear: {}, cancel: screen == "profile-sheet" ? {} : nil, rendering: true)
        }
      }
      Spacer()
    }.padding(20))
  }

  @MainActor private static func batchView(_ screen: String) -> AnyView {
    let files = [
      BulkImportFile(name: "Savings September.csv", data: Data("savings".utf8)),
      BulkImportFile(name: "Savings copy.csv", data: Data("savings".utf8)),
      BulkImportFile(name: "Card September.pdf", data: Data("card".utf8)),
      BulkImportFile(name: "Shopping notes.csv", data: Data("notes".utf8)),
      BulkImportFile(name: "CAS August.pdf", data: Data("imported".utf8)),
      BulkImportFile(name: "Savings October.pdf", data: Data("locked".utf8)),
    ]
    let runner = BulkImportRunner(rows: BulkImportPlan.rows(files, importedHashes: [files[4].hash]) {
      $0.id == files[3].id ? .notStatement : ($0.id == files[5].id ? .locked : .statement)
    })
    if screen == "results" { runner.rows[1].selected = false }
    if screen == "select-all" { runner.selectAll(true) }
    if screen == "running" || screen == "summary" { runner.hasStarted = true }
    if screen == "running" {
      runner.rows[0].status = .imported; runner.rows[0].selected = false
      runner.rows[1].status = .importing; runner.rows[4].status = .queued
    }
    if screen == "summary" {
      runner.rows[0].status = .imported; runner.rows[1].status = .failed; runner.rows[4].status = .skipped
      runner.selectAll(false)
    }
    return AnyView(VStack(alignment: .leading, spacing: 12) {
      Text("Import statements").font(.title2.weight(.semibold))
      if screen == "password" { BulkPasswordCard(file: "Savings October.pdf", submit: { _ in }, rendering: true) }
      else { BulkResultsCard(runner: runner, start: { _ in }, rendering: true) }
      Spacer(minLength: 0)
    }.padding(20))
  }
}
#endif
