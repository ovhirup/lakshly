"use client";
// Theme System v2 runtime (beta edition): stored mood/accent, the canvas art layer, and the picker grid.
import { useEffect, useSyncExternalStore } from "react";
import { useAppState } from "./AppState";
import { useTier } from "./useTier";
import { Icon } from "./Icon";
import { formatINR } from "@/lib/format";
import { ACCENTS, BETA_DEFAULT, effectiveThemeV2, legacyIdFor, MOODS, moodById, normaliseAccent, resolveThemeV2, THEME_V2_KEY, type Accent, type Mood, type ThemeV2 } from "@/lib/themes-v2";
import { applyGlass, GLASS_DEFAULT, GLASS_LEVEL_KEY, readGlassLevel } from "@/lib/glass";

const listeners = new Set<() => void>();
let cacheKey: string | undefined;
let cache: ThemeV2 = BETA_DEFAULT;
function read(): ThemeV2 {
  let raw: string | null = null; let legacy: string | null = null;
  try { raw = localStorage.getItem(THEME_V2_KEY); legacy = localStorage.getItem("lakshly.themeId"); } catch { /* blocked */ }
  const key = `${raw}|${legacy}`;
  if (key !== cacheKey) { cacheKey = key; cache = resolveThemeV2(raw, legacy); }
  return cache;
}
function subscribe(l: () => void) {
  listeners.add(l); window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
export function useThemeV2(): ThemeV2 { return useSyncExternalStore(subscribe, read, () => BETA_DEFAULT); }
function write(next: ThemeV2) {
  try { localStorage.setItem(THEME_V2_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Keeps <html data-mood/data-accent> and the legacy data-theme in step, and paints the canvas art. */
export function ThemeV2Root() {
  const stored = useThemeV2();
  const { can } = useTier();
  const { theme, setTheme, resolved } = useAppState();
  const t = effectiveThemeV2(stored, can("themes.premium"));
  const mood = t.theme; const accent = t.accent;
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.edition = "beta";
    d.dataset.mood = mood;
    if (accent) d.dataset.accent = accent; else delete d.dataset.accent;
    const legacy = legacyIdFor({ v: 2, theme: mood, accent });
    if (theme !== legacy) setTheme(legacy);
    let storedLevel: string | null = null;
    try { storedLevel = localStorage.getItem(GLASS_LEVEL_KEY); } catch { /* blocked */ }
    applyGlass(readGlassLevel(storedLevel), d.style);
  }, [mood, accent, theme, setTheme]);
  return <MoodArt mood={t.theme} dark={resolved === "dark"} />;
}

/* ───────── canvas art (hand-drawn SVG; decorative, aria-hidden) ───────── */
const PETAL = "M0 -224C40 -158 46 -80 0 0C-46 -80 -40 -158 0 -224Z";
function LotusArt() {
  const petals: [number, number, number][] = [[-84, .52, .55], [84, .52, .55], [-58, .72, .7], [58, .72, .7], [-30, .88, .85], [30, .88, .85], [0, 1, 1]];
  return (
    <svg className="art-lotus" viewBox="-260 -300 520 380" aria-hidden="true">
      <defs>
        <linearGradient id="lk-petal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--art-petal-1)" }} /><stop offset=".45" style={{ stopColor: "var(--art-petal-2)" }} /><stop offset="1" style={{ stopColor: "var(--art-petal-3)" }} /></linearGradient>
        <radialGradient id="lk-core"><stop offset="0" stopColor="#FFE7A8" stopOpacity=".95" /><stop offset="1" stopColor="#FFB547" stopOpacity="0" /></radialGradient>
      </defs>
      {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx="0" cy="30" rx={70 + i * 46} ry={12 + i * 7.5} fill="none" style={{ stroke: "var(--art-stroke)" }} strokeOpacity={0.55 - i * 0.08} strokeWidth="1.2" />)}
      <circle cx="0" cy="-32" r="120" fill="url(#lk-core)" opacity=".55" />
      <g className="lotus-bloom">
        {petals.map(([r, s, o], i) => <path key={i} d={PETAL} fill="url(#lk-petal)" fillOpacity={o} style={{ stroke: "var(--art-stroke)" }} strokeWidth="1.3" transform={`rotate(${r}) scale(${s})`} />)}
      </g>
      <circle cx="0" cy="-16" r="9" fill="#FFE7A8" opacity=".9" />
    </svg>
  );
}
function ContourArt() {
  return (
    <svg className="art-contour" viewBox="0 0 800 600" preserveAspectRatio="xMaxYMin slice" aria-hidden="true">
      {Array.from({ length: 15 }, (_, i) => <path key={i} fill="none" style={{ stroke: "var(--art-stroke)" }} strokeOpacity={0.3 - i * 0.014} strokeWidth="1.1"
        d={`M${620 - i * 22} ${130} C ${640 - i * 18} ${40 - i * 20}, ${760 + i * 20} ${40 - i * 18}, ${770 + i * 22} ${150} S ${700 + i * 14} ${300 + i * 20}, ${620 - i * 22} ${130} Z`} />)}
      <circle cx="140" cy="520" r="90" style={{ fill: "var(--art-stone)" }} />
      <circle cx="230" cy="560" r="54" style={{ fill: "var(--art-stone)" }} opacity=".7" />
    </svg>
  );
}
function DiscArt() {
  const discs = [["d1", 22, 18, 26], ["d2", 88, 8, 18], ["d3", 82, 52, 20], ["d4", 6, 92, 22]] as const;
  return (
    <svg className="art-discs" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>{discs.map(([id]) => <radialGradient key={id} id={`lk-${id}`} cx="35%" cy="30%"><stop offset="0" style={{ stopColor: `var(--art-${id}-a)` }} /><stop offset="1" style={{ stopColor: `var(--art-${id}-b)` }} /></radialGradient>)}</defs>
      {discs.map(([id, cx, cy, r]) => <ellipse key={id} cx={cx} cy={cy} rx={r} ry={r * 1.6} fill={`url(#lk-${id})`} />)}
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1="22" y1="18" x2={22 + 90 * Math.cos((i * Math.PI) / 6)} y2={18 + 150 * Math.sin((i * Math.PI) / 6)} style={{ stroke: "var(--art-stroke)" }} strokeWidth=".12" />)}
      {[34, 44, 54].map((r) => <ellipse key={r} cx="22" cy="18" rx={r} ry={r * 1.6} fill="none" style={{ stroke: "var(--art-stroke)" }} strokeWidth=".12" />)}
    </svg>
  );
}
function GuillocheArt() {
  return (
    <svg className="art-guilloche" viewBox="-200 -200 400 400" aria-hidden="true">
      <g fill="none" style={{ stroke: "var(--art-stroke)" }} strokeWidth=".6">
        {Array.from({ length: 36 }, (_, i) => <ellipse key={`a${i}`} rx="170" ry="62" transform={`rotate(${i * 5})`} />)}
        {Array.from({ length: 24 }, (_, i) => <ellipse key={`b${i}`} rx="104" ry="40" transform={`rotate(${i * 7.5})`} />)}
        {[176, 120, 46].map((r) => <circle key={r} r={r} />)}
      </g>
    </svg>
  );
}
function Waves() {
  return (
    <svg className="art-waves" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => <path key={i} fill="none" style={{ stroke: "var(--art-stroke)" }} strokeWidth=".8" d={`M0 ${60 + i * 6} C 200 ${20 + i * 6}, 400 ${100 + i * 6}, 600 ${60 + i * 6} S 1000 ${20 + i * 6}, 1200 ${60 + i * 6}`} />)}
    </svg>
  );
}
export function MoodArt({ mood, dark }: { mood: Mood; dark: boolean }) {
  const art = moodById(mood).art;
  return (
    <div className={`mood-canvas mood-art-${art} ${dark ? "dark" : "light"}`} aria-hidden="true">
      {art === "lotus" && <LotusArt />}
      {art === "contour" && <ContourArt />}
      {art === "discs" && <DiscArt />}
      {art === "guilloche" && <><GuillocheArt /><Waves /></>}
    </div>
  );
}

/* ───────── picker grid (inside the existing theme popover) ───────── */
const glassListeners = new Set<() => void>();
function emitGlass() { glassListeners.forEach((listener) => listener()); }
function subscribeGlass(listener: () => void) {
  glassListeners.add(listener);
  return () => { glassListeners.delete(listener); };
}
function glassLevelSnapshot() {
  try { return readGlassLevel(localStorage.getItem(GLASS_LEVEL_KEY)); } catch { return GLASS_DEFAULT; }
}
function subscribeReduced(listener: () => void) {
  const mq = window.matchMedia("(prefers-reduced-transparency: reduce)");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
function reducedSnapshot() {
  return window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
}

function GlassSlider() {
  const level = useSyncExternalStore(subscribeGlass, glassLevelSnapshot, () => GLASS_DEFAULT);
  const reduced = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => false);
  return (
    <label className="glass-slider">
      <span className="tiny muted">Glass</span>
      <input
        type="range"
        min={0}
        max={100}
        value={level}
        disabled={reduced}
        aria-label="Liquid glass for cards and navigation"
        onChange={(e) => {
          const next = readGlassLevel(e.target.value);
          try { localStorage.setItem(GLASS_LEVEL_KEY, String(next)); } catch { /* blocked */ }
          applyGlass(next, document.documentElement.style);
          emitGlass();
        }}
      />
      <span className="tiny muted">{reduced ? "Off" : level}</span>
    </label>
  );
}

const PREVIEW: Record<Mood, { light: [string, string, string]; dark: [string, string, string] }> = {
  calm: { light: ["linear-gradient(160deg,#F7F6F3,#ECEEF1)", "#1B1D22", "#0A6FD8"], dark: ["linear-gradient(160deg,#17191D,#0C0D0F)", "#F2F3F5", "#3D9BFF"] },
  vivid: { light: ["radial-gradient(60% 60% at 20% 20%,#C7B6FF,transparent),radial-gradient(50% 50% at 90% 10%,#FFB3D3,transparent),linear-gradient(160deg,#FFF6EC,#F3EEFF)", "#1A1440", "#5A2FD0"], dark: ["radial-gradient(60% 60% at 20% 20%,#5A3BD8,transparent),radial-gradient(50% 50% at 90% 10%,#C02A6E,transparent),linear-gradient(160deg,#160B46,#080826)", "#FFFFFF", "#FFD27A"] },
  classic: { light: ["linear-gradient(160deg,#FFFDF8,#F4EEE0)", "#111111", "#7A5A00"], dark: ["radial-gradient(60% 50% at 90% 0%,rgba(217,175,82,.3),transparent),linear-gradient(160deg,#0D0C09,#000)", "#F7EBCB", "#E8C478"] },
  lotusGlass: { light: ["radial-gradient(60% 40% at 50% 10%,rgba(255,150,186,.85),transparent),radial-gradient(44% 30% at 92% 6%,rgba(255,200,110,.85),transparent),radial-gradient(70% 40% at 20% 96%,rgba(120,220,206,.55),transparent),linear-gradient(180deg,#FFF3EE,#F4F0FF)", "#19213E", "#C24D72"], dark: ["radial-gradient(58% 40% at 50% 10%,rgba(236,92,150,.72),transparent),radial-gradient(40% 26% at 96% 4%,rgba(233,175,80,.6),transparent),radial-gradient(70% 40% at 18% 98%,rgba(24,150,160,.5),transparent),linear-gradient(180deg,#1C0E3E,#080A22)", "#F5F3FF", "#F2CD78"] },
};

export function MoodGrid() {
  const stored = useThemeV2();
  const { resolved } = useAppState();
  const { can } = useTier();
  const premium = can("themes.premium");
  const choose = (theme: Mood, accent?: Accent) => write({ v: 2, theme, accent: normaliseAccent(theme, accent ?? (stored.theme === theme ? stored.accent : null)) });
  const current = moodById(stored.theme);
  return (
    <div className="mood-picker">
      <div className="theme-grid mood-grid">
        {MOODS.map((m) => {
          const [bg, ink, acc] = PREVIEW[m.id][resolved];
          const selected = stored.theme === m.id;
          const locked = m.premium && !premium;
          return (
            <button key={m.id} type="button" className={`theme-card mood-card mood-${m.id}`} aria-pressed={selected}
              aria-label={`${m.name}${m.premium ? ", Premium" : ""}. ${m.blurb}${locked ? ". Locked" : ""}`} onClick={() => choose(m.id)}>
              <span className="theme-preview" style={{ background: bg, color: ink }}>
                <span className="mood-preview-glass">
                  <span className={`mood-preview-figure fig-${m.id}`} style={{ color: m.id === "lotusGlass" || m.id === "classic" ? acc : ink }}>{formatINR(2480000)}</span>
                  <span className="mood-preview-pill" style={{ background: acc }} />
                </span>
                <span className="theme-card-meta">
                  <span className="theme-card-name">{m.name}{m.premium ? <span className="mood-star" aria-hidden="true"> ✦</span> : null}</span>
                  {locked ? <Icon name="lock" size={12} /> : null}
                  {selected ? <span className="theme-check" aria-hidden="true">✓</span> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {current.accents.length > 1 && (
        <div className="accent-row" role="radiogroup" aria-label={`${current.name} accent`}>
          <span className="tiny muted">Accent</span>
          {current.accents.map((a) => {
            const def = ACCENTS[a];
            const on = (stored.accent ?? current.accents[0]) === a;
            return (
              <button key={a} type="button" role="radio" aria-checked={on} className={`accent-swatch ${on ? "on" : ""}`} onClick={() => choose(current.id, a)}>
                <i style={{ background: def[resolved] }} aria-hidden="true" />
                {def.name}{def.premium ? " ✦" : ""}
              </button>
            );
          })}
        </div>
      )}
      <GlassSlider />
      <p className="tiny muted">{current.blurb}. Beta: every look is unlocked for testers.</p>
    </div>
  );
}
