// Plain (non-secret) "this browser has imported data" flag, kept outside the encrypted vault.
// It only says *that* data exists, never what. Used to hide demo numbers until the vault has loaded.
export const HAS_DATA_KEY = "lk-has-data";
export const SOURCE_KEY = "lakshly.source";

/** Inline <head> script: mark the page as waiting for the vault before first paint. */
export const vaultBootScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(HAS_DATA_KEY)})==="1"&&localStorage.getItem(${JSON.stringify(SOURCE_KEY)})!=="demo"){var d=document.documentElement;d.dataset.vault="pending";setTimeout(function(){delete d.dataset.vault},8000)}}catch(e){}})();`;

/** Should demo data be hidden right now? (has real data, not explicitly viewing the demo, vault not read yet) */
export function vaultPending(flags: { hasData: boolean; source: string | null; ready: boolean }): boolean {
  return flags.hasData && flags.source !== "demo" && !flags.ready;
}

export function setHasData(on: boolean) {
  try { if (on) localStorage.setItem(HAS_DATA_KEY, "1"); else localStorage.removeItem(HAS_DATA_KEY); } catch { /* storage blocked */ }
}
export function hasDataFlag(): boolean {
  try { return localStorage.getItem(HAS_DATA_KEY) === "1"; } catch { return false; }
}
export function clearVaultPending() {
  if (typeof document !== "undefined") delete document.documentElement.dataset.vault;
}
