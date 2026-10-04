// On-device profile: the name you want Lakshly to use, and when you started Premium (demo).
// Kept in the encrypted on-device vault (record "profile"); never sent anywhere.
// There is no default person: an unset name shows "You" with an "Add your name" hint.
import { useSyncExternalStore } from "react";
import { loadRecord, saveRecord, VAULT_DELETED_EVENT } from "./vault";

/** Legacy plaintext profile (v1, localStorage). Migrated into the vault on first load, then removed. */
export const PROFILE_KEY = "lakshly.profile";
export const DEFAULT_DISPLAY_NAME = "You";
export const NAME_MAX = 40;
/** Where the name came from: typed by the person, or prefilled from Google sign-in. */
export type NameSource = "user" | "google";
export type Profile = { v: 2; name: string; nameSource?: NameSource; premiumSince?: string };
export type ProfileState = Profile & { loaded: boolean };

const EMPTY: Profile = { v: 2, name: "" };

export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim().slice(0, NAME_MAX).trim();
}

/** What to call someone on screen: their own name, or the neutral "You". */
export function displayName(p: Pick<Profile, "name">): string { return p.name || DEFAULT_DISPLAY_NAME; }

const since = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : undefined);

/** Parses a stored profile (vault record object, or a JSON string). Unknown shapes give an empty profile. */
export function parseProfile(raw: unknown): Profile {
  let p: unknown = raw;
  if (typeof raw === "string") { try { p = JSON.parse(raw); } catch { return { ...EMPTY }; } }
  if (!p || typeof p !== "object") return { ...EMPTY };
  const o = p as Record<string, unknown>;
  const name = typeof o.name === "string" ? cleanName(o.name) : "";
  const src = o.nameSource === "user" || o.nameSource === "google" ? o.nameSource : undefined;
  const out: Profile = { v: 2, name };
  if (name && src) out.nameSource = src;
  const s = since(o.premiumSince);
  if (s) out.premiumSince = s;
  return out;
}

/** Names that early builds could leave behind without the person typing them (the beta default and the
 *  maintainer's name prefilled during testing). A legacy profile carrying one of these starts unset again. */
const LEGACY_SEED_NAMES = ["abhirup", "tester", "beta tester"];

/** v1 (plaintext, no name provenance) → v2. Seed-like names are cleared so the person is asked again;
 *  any other v1 name was typed by them and is kept as user-entered. */
export function migrateLegacyProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  const p = parseProfile(raw);
  let v1Version: unknown;
  try { v1Version = (JSON.parse(raw) as { v?: unknown }).v; } catch { /* parseProfile handled it */ }
  if (v1Version === 2 && p.nameSource) return p;
  if (LEGACY_SEED_NAMES.includes(p.name.toLowerCase())) return { ...p, name: "", nameSource: undefined };
  return p.name ? { ...p, nameSource: "user" } : p;
}

/** Google sign-in fills the name only when the field is still empty; the person can edit it afterwards. */
export function googlePrefill(currentField: string, givenName: string | undefined, fullName?: string): string | null {
  if (cleanName(currentField)) return null;
  const n = cleanName(givenName || (fullName ?? "").split(" ")[0] || "");
  return n || null;
}

/** "Priya Sharma" -> "P"; empty -> "". Uses the first grapheme so Devanagari and emoji work. */
export function initial(name: string): string {
  const first = cleanName(name).split(" ")[0] ?? "";
  if (!first) return "";
  const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter().segment(first)][0]?.segment : first[0];
  return (seg ?? "").toLocaleUpperCase();
}

/** Renewal date one year after the start (demo; payments aren't live). */
export function renewsOn(since: string): string {
  const [y, m, d] = since.slice(0, 10).split("-").map(Number);
  return `${String(y + 1).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ───────── store: memory cache, hydrated from the vault ───────── */
const listeners = new Set<() => void>();
const SERVER: ProfileState = { ...EMPTY, loaded: false };
let state: ProfileState = SERVER;
let hydrating: Promise<void> | null = null;
let pending: Partial<Profile> | null = null;
const emit = () => listeners.forEach((l) => l());

function hydrate(): Promise<void> {
  hydrating ??= (async () => {
    let p: Profile = { ...EMPTY };
    let migrated = false;
    try {
      const rec = await loadRecord<unknown>("profile");
      if (rec) p = parseProfile(rec);
      else {
        let legacy: string | null = null;
        try { legacy = localStorage.getItem(PROFILE_KEY); } catch { /* storage blocked */ }
        const m = migrateLegacyProfile(legacy);
        if (m) { p = m; migrated = true; }
      }
    } catch { /* vault unavailable: start empty */ }
    if (pending) { p = { ...p, ...pending }; migrated = true; pending = null; }
    state = { ...p, loaded: true };
    emit();
    if (migrated) await persist(p);
    try { localStorage.removeItem(PROFILE_KEY); } catch { /* ignore */ }
  })();
  return hydrating;
}

async function persist(p: Profile) {
  const { v, name, nameSource, premiumSince } = p;
  try { await saveRecord("profile", { v, name, ...(name && nameSource ? { nameSource } : {}), ...(premiumSince ? { premiumSince } : {}) }); } catch { /* vault unavailable */ }
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (typeof window !== "undefined") void hydrate();
  return () => { listeners.delete(l); };
}

if (typeof window !== "undefined") {
  window.addEventListener(VAULT_DELETED_EVENT, () => { state = { ...EMPTY, loaded: true }; pending = null; emit(); });
}

/** Saves to the encrypted vault. A changed name counts as typed by the person unless nameSource says otherwise. */
export function saveProfile(next: Partial<Profile>) {
  const patch: Partial<Profile> = { ...next };
  if (typeof patch.name === "string") {
    patch.name = cleanName(patch.name);
    if (!patch.nameSource) patch.nameSource = "user";
    if (!patch.name) patch.nameSource = undefined;
  }
  const merged: Profile = { ...state, ...patch, v: 2 };
  delete (merged as Partial<ProfileState>).loaded;
  state = { ...merged, loaded: state.loaded };
  emit();
  if (!state.loaded) { pending = { ...(pending ?? {}), ...patch }; void hydrate(); return; }
  void persist(merged);
}

export function useProfile(): ProfileState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER);
}
