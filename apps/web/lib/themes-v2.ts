// Theme System v2 (first pass, beta edition only): three moods + Lotus Glass, accents inside moods.
// Spec: theme-system-v2.md §3-§6 and liquid-glass-theme.md §4. Colours live in app/themes-v2.css.
import type { ThemeId } from "./themes.gen";

export type Mood = "calm" | "vivid" | "classic" | "lotusGlass";
export type Accent = "graphite" | "sage" | "quartz" | "lakshmi" | "tide" | "gold";
export interface ThemeV2 { v: 2; theme: Mood; accent: Accent | null }

export const THEME_V2_KEY = "lakshly.theme.v2";

export interface MoodDef { id: Mood; name: string; premium: boolean; accents: Accent[]; blurb: string; art: "contour" | "discs" | "guilloche" | "lotus" }
export const MOODS: readonly MoodDef[] = [
  { id: "calm", name: "Calm", premium: false, accents: ["graphite", "sage", "quartz"], blurb: "Porcelain and graphite, contour lines", art: "contour" },
  { id: "vivid", name: "Vivid", premium: false, accents: ["lakshmi", "tide"], blurb: "Indigo, saffron and lotus pink, bold discs", art: "discs" },
  { id: "classic", name: "Classic", premium: false, accents: ["gold"], blurb: "Ivory or black with gold guilloché", art: "guilloche" },
  { id: "lotusGlass", name: "Lotus Glass", premium: true, accents: [], blurb: "Liquid glass over a living lotus", art: "lotus" },
];

export interface AccentDef { id: Accent; name: string; mood: Mood; premium: boolean; legacyId: ThemeId; light: string; dark: string }
export const ACCENTS: Readonly<Record<Accent, AccentDef>> = {
  graphite: { id: "graphite", name: "Graphite", mood: "calm", premium: false, legacyId: "graphite", light: "#0A6FD8", dark: "#3D9BFF" },
  sage: { id: "sage", name: "Sage", mood: "calm", premium: true, legacyId: "forest", light: "#5E7A3A", dark: "#B5CE87" },
  quartz: { id: "quartz", name: "Quartz", mood: "calm", premium: true, legacyId: "roseQuartz", light: "#AD4C72", dark: "#EB91B6" },
  lakshmi: { id: "lakshmi", name: "Lakshmi", mood: "vivid", premium: false, legacyId: "lakshmi", light: "#F5A524", dark: "#FFC24A" },
  tide: { id: "tide", name: "Tide", mood: "vivid", premium: true, legacyId: "ocean", light: "#0FA3B1", dark: "#71CCD5" },
  gold: { id: "gold", name: "Gold", mood: "classic", premium: false, legacyId: "monochromeGold", light: "#A47520", dark: "#D9AF52" },
};

/** §6 mapping: every legacy id lands on a mood + accent; nobody drops to Lakshmi unless the id is unknown. */
export const LEGACY_TO_V2: Readonly<Record<ThemeId, ThemeV2>> = {
  lakshmi: { v: 2, theme: "vivid", accent: "lakshmi" },
  monochromeGold: { v: 2, theme: "classic", accent: "gold" },
  graphite: { v: 2, theme: "calm", accent: "graphite" },
  ocean: { v: 2, theme: "vivid", accent: "tide" },
  forest: { v: 2, theme: "calm", accent: "sage" },
  roseQuartz: { v: 2, theme: "calm", accent: "quartz" },
};

/** The beta opens on Lotus Glass so testers see the new look first (spec N3 default stays Vivid · Lakshmi for production). */
export const BETA_DEFAULT: ThemeV2 = { v: 2, theme: "lotusGlass", accent: null };
export const moodById = (id: Mood) => MOODS.find((m) => m.id === id)!;
const isMood = (v: unknown): v is Mood => MOODS.some((m) => m.id === v);
const isAccent = (v: unknown): v is Accent => typeof v === "string" && v in ACCENTS;

/** Accent valid for the mood, else the mood's base accent (Lotus Glass has none). */
export function normaliseAccent(theme: Mood, accent: unknown): Accent | null {
  const m = moodById(theme);
  if (!m.accents.length) return null;
  return isAccent(accent) && m.accents.includes(accent) ? accent : m.accents[0];
}

export function parseThemeV2(raw: string | null): ThemeV2 | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ThemeV2>;
    if (!isMood(p.theme)) return null;
    return { v: 2, theme: p.theme, accent: normaliseAccent(p.theme, p.accent) };
  } catch { return null; }
}

/** Stored v2 choice wins; else migrate the legacy id; else the default. */
export function resolveThemeV2(rawV2: string | null, legacyId: string | null, fallback: ThemeV2 = BETA_DEFAULT): ThemeV2 {
  const v2 = parseThemeV2(rawV2);
  if (v2) return v2;
  if (legacyId && legacyId in LEGACY_TO_V2) return LEGACY_TO_V2[legacyId as ThemeId];
  return fallback;
}

/**
 * Entitlement fallback (§6): a Premium look without Premium shows the mood's base accent (Lotus Glass falls back to
 * Vivid · Lakshmi) and keeps the stored choice. The beta resolves Premium, so this only matters for production later.
 */
export function effectiveThemeV2(t: ThemeV2, premium: boolean): ThemeV2 {
  if (premium) return t;
  if (moodById(t.theme).premium) return LEGACY_TO_V2.lakshmi;
  if (t.accent && ACCENTS[t.accent].premium) return { v: 2, theme: t.theme, accent: moodById(t.theme).accents[0] };
  return t;
}

/** Legacy `data-theme` kept underneath so category colours and existing flags still resolve. */
export function legacyIdFor(t: ThemeV2): ThemeId {
  return t.accent ? ACCENTS[t.accent].legacyId : "lakshmi";
}

/** Pre-paint (beta only): mark the edition, unlock Premium, and paint the mood before React hydrates. */
export const themeV2BootScript = `(function(){try{var d=document.documentElement;d.dataset.edition="beta";
try{localStorage.setItem("lakshly.plan","premium")}catch(e){}
var M={calm:["graphite","sage","quartz"],vivid:["lakshmi","tide"],classic:["gold"],lotusGlass:[]};
var L={lakshmi:["vivid","lakshmi"],monochromeGold:["classic","gold"],graphite:["calm","graphite"],ocean:["vivid","tide"],forest:["calm","sage"],roseQuartz:["calm","quartz"]};
var t="lotusGlass",a=null,raw=null,leg=null;try{raw=localStorage.getItem("${THEME_V2_KEY}");leg=localStorage.getItem("lakshly.themeId")}catch(e){}
var p=null;try{p=raw?JSON.parse(raw):null}catch(e){}
if(p&&M[p.theme]){t=p.theme;a=p.accent}else if(leg&&L[leg]){t=L[leg][0];a=L[leg][1]}
if(M[t].length){if(M[t].indexOf(a)<0)a=M[t][0]}else a=null;
d.dataset.mood=t;if(a)d.dataset.accent=a;else delete d.dataset.accent;
if(t!=="lotusGlass"){var g=70;try{var gs=localStorage.getItem("lakshly.glassLevel");if(gs!=null&&gs!==""){var n=Number(gs);if(isFinite(n))g=Math.max(0,Math.min(100,Math.round(n)))}}catch(e){}
d.style.setProperty("--lk-glass-card",Math.round(g*24/70)+"px");d.style.setProperty("--lk-glass-nav",Math.round(g*20/70)+"px")}}catch(e){}})();`;
