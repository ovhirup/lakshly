// On-device profile: the name you want Lakshly to use, and when you started Premium (demo).
// Plain localStorage: a display name is not financial data. Never sent anywhere.
import { useSyncExternalStore } from "react";

export const PROFILE_KEY = "lakshly.profile";
export type Profile = { v: 1; name: string; premiumSince?: string };
const EMPTY: Profile = { v: 1, name: "" };

export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function parseProfile(raw: string | null): Profile {
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<Profile>;
    const name = typeof p.name === "string" ? cleanName(p.name) : "";
    const since = typeof p.premiumSince === "string" && /^\d{4}-\d{2}-\d{2}/.test(p.premiumSince) ? p.premiumSince : undefined;
    return since ? { v: 1, name, premiumSince: since } : { v: 1, name };
  } catch {
    return EMPTY;
  }
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

const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cache: Profile = EMPTY;

function read(): Profile {
  let raw: string | null = null;
  try { raw = localStorage.getItem(PROFILE_KEY); } catch { /* storage blocked */ }
  if (raw !== cacheRaw) { cacheRaw = raw; cache = parseProfile(raw); }
  return cache;
}

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}

export function saveProfile(next: Partial<Profile>) {
  const merged = { ...read(), ...next, v: 1 as const };
  merged.name = cleanName(merged.name);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
