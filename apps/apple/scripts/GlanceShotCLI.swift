import AppKit
import Foundation

@MainActor @main struct GlanceShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.accessory)
    let arguments = CommandLine.arguments
    guard arguments.count >= 3 else {
      fputs("usage: glance-renderer <output-dir> <dataset.json>\n", stderr)
      exit(2)
    }
    do {
      let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: URL(fileURLWithPath: arguments[2])))
      try GlanceShotRenderer.render(to: URL(fileURLWithPath: arguments[1], isDirectory: true), dataset: dataset)
    } catch {
      fputs("glance renderer failed: \(error)\n", stderr)
      exit(1)
    }
    for window in NSApp.windows { window.orderOut(nil) }
  }
}
