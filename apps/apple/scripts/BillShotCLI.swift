import AppKit
import Foundation

/// Offscreen macOS renderer for bill shots: prohibited activation policy, nothing is ordered front.
@MainActor @main struct BillShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.prohibited)
    guard CommandLine.arguments.count == 2 else { fputs("usage: bill-renderer <outdir>\n", stderr); exit(2) }
    do {
      let urls = try BillShotRenderer.render(to: URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true))
      print("bill shots: \(urls.count)")
    } catch { fputs("bill renderer failed: \(error)\n", stderr); exit(1) }
  }
}
