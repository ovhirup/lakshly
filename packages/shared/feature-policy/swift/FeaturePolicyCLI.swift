import Foundation

// Headless synthetic verification transport, never linked into an application.
@main
struct FeaturePolicyCLI {
  static func main() {
    let arguments = Array(CommandLine.arguments.dropFirst())
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    if arguments == ["--round-trip-fixture"] {
      do {
        let data = FileHandle.standardInput.readDataToEndOfFile()
        let fixture = try JSONDecoder().decode(LakshlyFeaturePolicyV1.FixtureDocument.self, from: data)
        let encoded = try encoder.encode(fixture)
        FileHandle.standardOutput.write(encoded)
        FileHandle.standardOutput.write(Data([10]))
      } catch {
        FileHandle.standardError.write(Data("Fixture round-trip failed: \(error)\n".utf8))
        exit(1)
      }
      return
    }
    guard arguments.isEmpty else {
      FileHandle.standardError.write(Data("Unsupported CLI arguments\n".utf8)); exit(1)
    }
    while let line = readLine() {
      do {
        let value = try JSONSerialization.jsonObject(with: Data(line.utf8), options: [.fragmentsAllowed])
        guard let envelope = value as? [String: Any], Set(envelope.keys) == Set(["catalog", "context", "request"]) else {
          print("{\"error\":\"invalid_envelope\"}"); continue
        }
        let result = LakshlyFeaturePolicyV1.evaluateFeaturePolicy(catalog: envelope["catalog"], context: envelope["context"], request: envelope["request"])
        print(String(decoding: try encoder.encode(result), as: UTF8.self))
      } catch {
        print("{\"error\":\"invalid_json\"}")
      }
    }
  }
}
