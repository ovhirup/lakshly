import AppKit
import Foundation

@MainActor @main struct SetupShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.accessory)
    let arguments = CommandLine.arguments
    guard arguments.count >= 5 else {
      fputs("usage: setup-renderer <output-dir> <sources.catalog.json> <state.midway.json> <dataset.after-import.json>\n", stderr)
      exit(2)
    }
    do {
      let catalog = try SourcesCatalog.load(data: Data(contentsOf: URL(fileURLWithPath: arguments[2])))
      let midway = try JSONDecoder().decode(SetupState.self, from: Data(contentsOf: URL(fileURLWithPath: arguments[3])))
      let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: URL(fileURLWithPath: arguments[4])))
      try SetupShotRenderer.render(
        to: URL(fileURLWithPath: arguments[1], isDirectory: true), catalog: catalog, midway: midway, dataset: dataset)
    } catch {
      fputs("setup renderer failed: \(error)\n", stderr)
      exit(1)
    }
    for window in NSApp.windows { window.orderOut(nil) }
  }
}
