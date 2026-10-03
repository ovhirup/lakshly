import Foundation
import Observation
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Keeps the saved choice across entitlement fallback. On macOS only the running
/// app's Dock tile changes; Finder and Launchpad retain the default Lakshmi icon.
@MainActor
@Observable
final class AppIconController {
  private(set) var current: ThemeID
  private(set) var lastError: String?
  private(set) var isApplying = false
  private var stored: ThemeID
  private var desired: ThemeID
  private var isPremium = false
  private var hasResolved = false
  #if DEBUG
  private var demoIcon: ThemeID?
  #endif
  @ObservationIgnored private let defaults: UserDefaults
  #if os(macOS)
  @ObservationIgnored private var appearanceObservation: NSKeyValueObservation?
  #endif

  var supportsAlternateIcons: Bool {
    #if os(iOS)
    UIApplication.shared.supportsAlternateIcons
    #else
    true // Runtime Dock icons, rather than bundle alternate icons.
    #endif
  }

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
    let saved = ThemeID.resolve(defaults.string(forKey: "settings.appIcon") ?? "lakshmi")
    stored = saved
    desired = saved
    #if os(iOS)
    current = ThemeAppIcon.theme(forAlternateIconName: UIApplication.shared.alternateIconName)
    #else
    current = .lakshmi
    appearanceObservation = NSApplication.shared.observe(\.effectiveAppearance) { [weak self] _, _ in
      Task { @MainActor [weak self] in self?.applyDockIcon() }
    }
    #endif
  }

  func start(isPremium: Bool, hasResolved: Bool) async {
    #if DEBUG
    demoIcon = LaunchOptions.current.appIconDemo.map { ThemeID.resolve($0) }
    #endif
    await updateEntitlements(isPremium: isPremium, hasResolved: hasResolved)
  }

  func apply(_ id: ThemeID) async {
    // Settings gates taps too; fail closed if entitlement state changes before the task runs.
    guard !ThemeAppIcon.isLocked(id, isPremium: isPremium) else { return }
    stored = id
    defaults.set(id.rawValue, forKey: "settings.appIcon")
    #if DEBUG
    demoIcon = nil
    #endif
    await updateEntitlements(isPremium: isPremium, hasResolved: hasResolved)
  }

  func updateEntitlements(isPremium: Bool, hasResolved: Bool) async {
    self.isPremium = isPremium
    self.hasResolved = hasResolved
    desired = ThemeAppIcon.effectiveIcon(stored: stored, isPremium: isPremium, hasResolved: hasResolved)
    #if DEBUG
    if let demoIcon { desired = demoIcon } // Screenshot only; never changes entitlements or preferences.
    #endif
    await reconcile()
  }

  /// Serialize iOS requests; a changed gate/selection during an await is applied next.
  private func reconcile() async {
    guard !isApplying else { return }
    isApplying = true
    defer { isApplying = false }
    lastError = nil
    #if os(iOS)
    while true {
      let target = desired
      let name = ThemeAppIcon.alternateIconName(for: target)
      guard UIApplication.shared.alternateIconName != name else {
        current = target
        return
      }
      guard supportsAlternateIcons else {
        lastError = "App icon changes aren't supported on this device."
        return
      }
      do {
        try await UIApplication.shared.setAlternateIconName(name)
        current = ThemeAppIcon.theme(forAlternateIconName: UIApplication.shared.alternateIconName)
      } catch {
        lastError = "Couldn't change the app icon: \(error.localizedDescription)"
        return
      }
      if target == desired { return }
    }
    #else
    applyDockIcon()
    #endif
  }

  #if os(macOS)
  private func applyDockIcon() {
    let dark = NSApplication.shared.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
    if desired == .lakshmi && !dark {
      NSApplication.shared.applicationIconImage = nil
    } else {
      guard let image = NSImage(named: ThemeAppIcon.dockImageName(for: desired, dark: dark)) else {
        lastError = "Couldn't load the app icon."
        return
      }
      NSApplication.shared.applicationIconImage = image
    }
    current = desired
    lastError = nil
  }
  #endif
}
