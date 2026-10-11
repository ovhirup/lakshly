import AppKit
import Foundation

/// Offscreen macOS renderer for review shots: accessory process, borderless window never ordered front.
@MainActor @main struct ReviewShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.prohibited)
    guard CommandLine.arguments.count == 2 else { fputs("usage: review-renderer <outdir>\n", stderr); exit(2) }
    do {
      let urls = try ReviewShotRenderer.render(to: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
      print("review shots: \(urls.count)")
    } catch { fputs("review renderer failed: \(error)\n", stderr); exit(1) }
  }
}
