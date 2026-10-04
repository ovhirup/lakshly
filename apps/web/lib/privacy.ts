// Privacy mode: hide every rupee amount. Settings live in plain localStorage (not secret, no financial data).
// The mask is rendered by the formatters (lib/format.ts), so the DOM never contains the digits.
export const PRIVACY_KEY = "lk-privacy";
export const MASK = "₹ •••••";
export const PCT_MASK = "••%";

export type PrivacySettings = {
  on: boolean; startHidden: boolean; shake: boolean; hideOnBlur: boolean; hidePercent: boolean;
  widgetAmounts: "hidden" | "shown"; v: 1;
};
export const DEFAULT_PRIVACY: PrivacySettings = { on: false, startHidden: false, shake: false, hideOnBlur: false, hidePercent: false, widgetAmounts: "hidden", v: 1 };

export function parsePrivacy(raw: string | null): PrivacySettings {
  if (!raw) return DEFAULT_PRIVACY;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const b = (k: keyof PrivacySettings) => (typeof o[k] === "boolean" ? (o[k] as boolean) : (DEFAULT_PRIVACY[k] as boolean));
    return { on: b("on"), startHidden: b("startHidden"), shake: b("shake"), hideOnBlur: b("hideOnBlur"), hidePercent: b("hidePercent"), widgetAmounts: o.widgetAmounts === "shown" ? "shown" : "hidden", v: 1 };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

/** Effective mask = on || transient (blur / switched away) || (startHidden && not revealed this session). */
export function isMasked(s: PrivacySettings, transient: boolean, revealedThisSession: boolean): boolean {
  return s.on || transient || (s.startHidden && !revealedThisSession);
}

// Module-level flags the pure formatters read. Set by PrivacyProvider before its subtree renders.
const flags = { money: false, pct: false };
export function setFormatMask(money: boolean, pct: boolean) { flags.money = money; flags.pct = money && pct; }
export function moneyMasked() { return flags.money; }
export function pctMasked() { return flags.pct; }
/** Honors "Also hide percentages": masks any "NN%" inside generated text (badge hints, progress labels). */
export function maskPctText(t: string): string { return flags.pct ? t.replace(/\d+(?:\.\d+)?\s?%/g, PCT_MASK) : t; }

/** Shake detector: acceleration magnitude > 15 m/s² twice within 600 ms, then a 1.5 s cooldown. */
export function createShakeDetector(onShake: () => void, threshold = 15) {
  let first: number | null = null;
  let cooldownUntil = -Infinity;
  return (magnitude: number, t: number) => {
    if (t < cooldownUntil || magnitude <= threshold) return false;
    if (first !== null && t - first <= 600) {
      first = null; cooldownUntil = t + 1500; onShake();
      return true;
    }
    first = t;
    return false;
  };
}

/** Pre-paint script: hides the content until React has rendered masked amounts (no flash of digits). */
export const privacyBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PRIVACY_KEY)})||"{}");var r=false;try{r=sessionStorage.getItem("lk-privacy-revealed")==="1"}catch(e){}if(p.on===true||(p.startHidden===true&&!r))document.documentElement.dataset.privacyBoot="1"}catch(e){}})();`;
