// Plain (non-secret) "this browser has imported data" flag, kept outside the encrypted vault.
// It only says *that* data exists, never what. Used to keep demo numbers off screen until the vault has loaded.
export const HAS_DATA_KEY = "lk-has-data";
export const SOURCE_KEY = "lakshly.source";
/** After this long still opening, the skeleton offers a reload (it never falls back to demo data). */
export const VAULT_SLOW_MS = 15000;

/**
 * Inline <head> script, run before first paint. The static HTML is prerendered with the demo dataset, so
 * unless the person explicitly chose the demo, main content stays behind the server-rendered skeleton
 * (html[data-vault=pending]) until the data context has resolved. Only the app lifts it; there is no timer
 * that could reveal demo data on a slow network. CSP: allowed by script-src 'unsafe-inline' (no nonce/hash).
 */
export const vaultBootScript = `(function(){try{var d=document.documentElement,s=null,h=false;try{s=localStorage.getItem(${JSON.stringify(SOURCE_KEY)});h=localStorage.getItem(${JSON.stringify(HAS_DATA_KEY)})==="1"}catch(e){}if(s!=="demo"||h){d.dataset.vault="pending";if(h)d.dataset.hasData="1";setTimeout(function(){if(d.dataset.vault==="pending")d.dataset.vaultSlow="1"},${VAULT_SLOW_MS})}}catch(e){}})();`;

/** Is the boot gate needed? (anything but an explicit demo choice by someone without real data) */
export function vaultPending(flags: { hasData: boolean; source: string | null; ready: boolean }): boolean {
  if (flags.ready) return false;
  return flags.hasData || flags.source !== "demo";
}

export function setHasData(on: boolean) {
  try { if (on) localStorage.setItem(HAS_DATA_KEY, "1"); else localStorage.removeItem(HAS_DATA_KEY); } catch { /* storage blocked */ }
}
export function hasDataFlag(): boolean {
  try { return localStorage.getItem(HAS_DATA_KEY) === "1"; } catch { return false; }
}
export function clearVaultPending() {
  if (typeof document === "undefined") return;
  const d = document.documentElement.dataset;
  delete d.vault; delete d.vaultSlow;
}
