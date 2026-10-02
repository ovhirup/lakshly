// Lakshly: placeholder app entry point (Phase 0). Not yet wired into an Xcode project.
// SPDX-License-Identifier: AGPL-3.0-or-later
import SwiftUI

@main
struct LakshlyApp: App {
    var body: some Scene {
        WindowGroup {
            OverviewPlaceholder()
        }
    }
}

struct OverviewPlaceholder: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [.pink.opacity(0.35), .orange.opacity(0.25), .yellow.opacity(0.2)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
                .ignoresSafeArea()
            VStack(spacing: 12) {
                Text("Lakshly").font(.largeTitle.bold())
                Text("Every rupee on target.").font(.headline).foregroundStyle(.secondary)
                Text("Demo data only").font(.caption)
            }
            .padding(32)
            .modifier(GlassCard())
        }
    }
}

/// Liquid Glass on iOS 26 / macOS 26, material fallback elsewhere.
struct GlassCard: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, macOS 26, *) {
            content.glassEffect(.regular, in: .rect(cornerRadius: 28))
        } else {
            content.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 28))
        }
    }
}
