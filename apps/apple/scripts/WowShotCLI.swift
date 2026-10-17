import AppKit
import Foundation

/// Offscreen macOS renderer for wow shots: prohibited activation policy, nothing is ordered front.
@MainActor @main struct WowShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.prohibited)
    guard CommandLine.arguments.count == 2 else { fputs("usage: wow-renderer <outdir>\n", stderr); exit(2) }
    do {
      let urls = try WowShotRenderer.render(to: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
      print("wow shots: \(urls.count)")
    } catch { fputs("wow renderer failed: \(error)\n", stderr); exit(1) }
  }
}
