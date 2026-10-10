import SwiftUI

struct ProfileIdentity: View {
  @Environment(\.theme) private var theme
  let profile: ProfileRecord
  var body: some View {
    HStack(spacing: 10) {
      ProfileAvatar(profile: profile)
      VStack(alignment: .leading, spacing: 2) {
        Text(profile.displayName).font(.subheadline.weight(.semibold))
        if profile.name == nil {
          HStack(spacing: 4) {
            Circle().fill(theme.gold).frame(width: 4, height: 4)
            Text("Add your name").font(.caption).foregroundStyle(theme.secondaryText)
          }
        }
      }
    }.frame(minHeight: 44)
  }
}

struct ProfileAvatar: View {
  let profile: ProfileRecord
  var body: some View {
    ZStack {
      Circle().fill(.secondary.opacity(0.12))
      if let initial = profile.initial { Text(initial).font(.headline) }
      else { Image(systemName: "person").font(.headline) }
    }.frame(width: 36, height: 36).accessibilityHidden(true)
  }
}

/// Shared by the profile popover, Settings and offscreen renders.
struct ProfileEditor: View {
  let save: (String) -> Void
  let clear: () -> Void
  let cancel: (() -> Void)?
  let rendering: Bool
  @State private var name: String
  init(profile: ProfileRecord, save: @escaping (String) -> Void, clear: @escaping () -> Void, cancel: (() -> Void)? = nil, rendering: Bool = false) {
    self.save = save; self.clear = clear; self.cancel = cancel; self.rendering = rendering
    _name = State(initialValue: profile.name ?? "")
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ProfileIdentity(profile: ProfileRecord(name: name))
      Text("What should we call you? (optional)").font(.subheadline)
      SetupEntry(prompt: "Your name", text: $name, rendering: rendering)
        .accessibilityLabel("Your name, optional, maximum 40 characters")
        .accessibilityIdentifier("profile.name")
        .onChange(of: name) { _, value in if value.count > 40 { name = String(value.prefix(40)) } }
      Text("Encrypted on this device.").font(.caption).foregroundStyle(.secondary)
      HStack {
        Button("Save") { save(name) }.buttonStyle(ThemedSubmitStyle())
          .accessibilityIdentifier("profile.save").frame(minHeight: 44)
        Button("Clear") { name = ""; clear() }.accessibilityIdentifier("profile.clear").frame(minHeight: 44)
        if let cancel { Button("Cancel", action: cancel).keyboardShortcut(.cancelAction).frame(minHeight: 44) }
      }
    }
  }
}

#if !PARITY_SHOTS
struct ProfileChip: View {
  let store: DataStore
  @State private var editing = false
  var body: some View {
    Button { editing = true } label: { ProfileIdentity(profile: store.profile) }
      .buttonStyle(.plain)
      .accessibilityIdentifier("profile.chip")
      .accessibilityLabel(store.profile.name == nil ? "You. Add your name" : "Edit profile for \(store.profile.displayName)")
      .popover(isPresented: $editing) {
        ProfileEditor(profile: store.profile, save: { store.saveProfile($0); if store.error == nil { editing = false } },
                      clear: { store.clearProfile(); if store.error == nil { editing = false } }, cancel: { editing = false })
          .padding(20).frame(minWidth: 300, idealWidth: 340)
      }
  }
}

struct SettingsProfileCard: View {
  let store: DataStore
  var body: some View {
    Card(title: "Profile") {
      ProfileChip(store: store)
      ProfileEditor(profile: store.profile, save: store.saveProfile, clear: store.clearProfile)
        .id(store.profile)
      if let error = store.error { Text(error).font(.caption) }
    }
  }
}

#endif
