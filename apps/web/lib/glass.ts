// Beta liquid-glass amount. Default 70 is 24px on cards and 20px on navigation, for every mood.

export const GLASS_LEVEL_KEY = "lakshly.glassLevel";
export const GLASS_DEFAULT = 70;

export function clampGlass(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return GLASS_DEFAULT;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function readGlassLevel(raw: string | null): number {
  if (raw == null || raw.trim() === "") return GLASS_DEFAULT;
  return clampGlass(raw);
}

/** Card blur scales from 24px at 70. Nav blur scales from 20px at 70. */
export function glassBlur(level: number): { card: number; nav: number } {
  const n = clampGlass(level);
  return { card: Math.round(n * 24 / GLASS_DEFAULT), nav: Math.round(n * 20 / GLASS_DEFAULT) };
}

export function glassDeclarations(level: number): { card: string; nav: string } {
  const blur = glassBlur(level);
  return { card: `${blur.card}px`, nav: `${blur.nav}px` };
}

export interface GlassStyle {
  setProperty(name: string, value: string): void;
  removeProperty(name: string): void;
}

export function applyGlass(level: number, root: GlassStyle) {
  const decl = glassDeclarations(level);
  root.setProperty("--lk-glass-card", decl.card);
  root.setProperty("--lk-glass-nav", decl.nav);
}
