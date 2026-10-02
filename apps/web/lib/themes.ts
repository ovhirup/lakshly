// Hand-written theme API. Palette data and the pre-paint script come from themes.gen.ts.
import { themeBootScript, themes, type ThemeId } from "./themes.gen";

export { themeBootScript, themes };
export type { ThemeId };

export type AppearancePref = "system" | "light" | "dark";
export type ResolvedAppearance = "light" | "dark";

export const PLAN_KEY = "lakshly.plan";
export const THEME_ID_KEY = "lakshly.themeId";
export const APPEARANCE_KEY = "lakshly.appearance";
/** Previous build stored light/dark here. Migrated once into APPEARANCE_KEY. */
export const LEGACY_THEME_KEY = "lakshly.theme";

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function themeById(id: string | null | undefined) {
  return themes.find((theme) => theme.id === id) ?? themes[0];
}

export function isPremiumTheme(id: string | null | undefined) {
  const theme = themeById(id);
  return theme.premium && theme.id === id;
}

/** Paint `data-theme`, `data-appearance`, theme flags, and the browser theme-color. */
export function applyDocumentTheme(themeId: ThemeId, appearance: ResolvedAppearance) {
  if (typeof document === "undefined") return;
  const theme = themeById(themeId);
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.dataset.appearance = appearance;
  root.dataset.semanticIcons = theme.usesSemanticIcons ? "true" : "false";
  root.dataset.spacious = theme.spacious ? "true" : "false";
  root.dataset.clearGlass = theme.clearGlass ? "true" : "false";
  const bg = theme.swatches[appearance].bg;
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = bg;
    document.head.appendChild(meta);
    return;
  }
  metas.forEach((meta) => {
    meta.setAttribute("content", bg);
    meta.removeAttribute("media");
  });
}
