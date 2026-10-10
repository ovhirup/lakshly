import AppKit
import Foundation

@MainActor @main struct ParityShotCLI {
  static func main() {
    NSApplication.shared.setActivationPolicy(.accessory)
    let args = CommandLine.arguments
    guard args.count == 4 else {
      fputs("usage: parity-renderer <outdir> <catalog.json> <synthetic-dataset.json>\n", stderr)
      exit(2)
    }
    do {
      let catalog = try SourcesCatalog.load(data: Data(contentsOf: URL(fileURLWithPath: args[2])))
      let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: URL(fileURLWithPath: args[3])))
      try ParityShotRenderer.render(to: URL(fileURLWithPath: args[1], isDirectory: true), catalog: catalog, dataset: dataset)
    } catch { fputs("parity renderer failed: \(error)\n", stderr); exit(1) }
  }
}
