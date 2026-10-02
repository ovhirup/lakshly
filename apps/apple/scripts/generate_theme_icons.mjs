#!/usr/bin/env node
// Generates the per-theme Lakshly app icons from docs/themes.json.
//
// Vector sources (SVG) are written to docs/icons/<themeId>/ and rasterised with sharp (librsvg),
// which is already installed with apps/web (run `npm ci` in apps/web first).
//
//   node apps/apple/scripts/generate_theme_icons.mjs                 # public repo defaults
//   node apps/apple/scripts/generate_theme_icons.mjs --themes <json> --assets <Assets.xcassets> \
//        [--svg <dir>] [--web <public dir>] [--sheet <contact-sheet.png>]
//
// Output per theme:
//   iOS app icon (1024, opaque, full bleed) with light, dark and tinted appearances. Lakshmi is the
//   primary `AppIcon` (also carries the macOS sizes); the others are iOS alternate icons `AppIcon-<Name>`.
//   `ThemeIcon-<id>` image sets (light + dark appearance) for the Settings icon picker.
//   `DockIcon-<id>` / `DockIcon-<id>-Dark` image sets (macOS grid, transparent margin) for the runtime Dock icon.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../..");
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith("--")) pairs.push([arg.slice(2), all[i + 1]]);
  return pairs;
}, []));
const themesPath = resolve(args.themes ?? join(repo, "docs/themes.json"));
const assetsDir = resolve(args.assets ?? join(repo, "apps/apple/Lakshly/Resources/Assets.xcassets"));
const svgDir = resolve(args.svg ?? join(repo, "docs/icons"));
const webDir = args.web === "none" ? null : resolve(args.web ?? join(repo, "apps/web/public"));
const sheetPath = args.sheet ? resolve(args.sheet) : null;
const sharpFrom = resolve(args.sharp ?? join(repo, "apps/web/package.json"));
const sharp = createRequire(sharpFrom)("sharp");

// The existing Lakshly lotus (apps/web/public/icon.svg), drawn on a 64-unit grid.
export const LOTUS = "M32 14c5 6 7 12 7 18s-3 12-7 16c-4-4-7-10-7-16s2-12 7-18zm-14 12c5 1 9 4 11 9s2 10 0 13c-5-1-9-4-11-9s-2-10 0-13zm28 0c2 3 2 8 0 13s-6 8-11 9c-2-3-2-8 0-13s6-8 11-9z";

// Which palette tokens paint each variant. "light.gold" = themes.json light.tokens.gold.
// Lakshmi's light icon is exactly the original Lakshly icon (gold tile, indigo lotus).
const RECIPES = {
  lakshmi:        { light: { tile: ["dark.lockGold", "dark.gold"], mark: ["dark.bg"], markOpacity: 0.92 },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.lockGold", "dark.gold"] } },
  monochromeGold: { light: { tile: ["light.bg", "light.surface"], mark: ["light.gold", "dark.gold"] },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.gold", "light.gold"] } },
  graphite:       { light: { tile: ["light.surface", "light.bg"], mark: ["light.gold", "dark.gold"] },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.gold", "light.gold"] } },
  ocean:          { light: { tile: ["dark.gold", "dark.lotus"], mark: ["dark.bg"], markOpacity: 0.92 },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.gold", "dark.lotus"] } },
  forest:         { light: { tile: ["dark.gold", "dark.lotus"], mark: ["dark.bg"], markOpacity: 0.92 },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.gold", "dark.lotus"] } },
  roseQuartz:     { light: { tile: ["dark.gold", "dark.lotus"], mark: ["dark.bg"], markOpacity: 0.92 },
                    dark:  { tile: ["dark.bg", "dark.surface"], mark: ["dark.gold", "dark.lotus"] } },
};
// iOS 18+ tinted icons are grayscale; the system applies the user's tint from luminance.
const TINTED = { tile: ["#000000", "#141414"], mark: ["#FFFFFF", "#B8B8B8"] };

const pascal = (id) => id[0].toUpperCase() + id.slice(1);
export const appIconName = (id) => (id === "lakshmi" ? "AppIcon" : `AppIcon-${pascal(id)}`);

function resolveColors(theme, refs) {
  return refs.map((ref) => {
    if (ref.startsWith("#")) return ref.toUpperCase();
    const [mode, token] = ref.split(".");
    const hex = theme[mode]?.tokens?.[token];
    if (!hex) throw new Error(`${theme.id}: missing ${ref}`);
    return hex.toUpperCase();
  });
}

function paint(theme, variant) {
  const recipe = variant === "tinted" ? TINTED : RECIPES[theme.id]?.[variant];
  if (!recipe) throw new Error(`no icon recipe for theme ${theme.id}`);
  const tile = resolveColors(theme, recipe.tile);
  const mark = resolveColors(theme, recipe.mark);
  return { tile: [tile[0], tile[1] ?? tile[0]], mark: [mark[0], mark[1] ?? mark[0]], markOpacity: recipe.markOpacity ?? 1 };
}

function gradient(id, [a, b]) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
}

/** shape: "ios" (full-bleed square, the OS masks it), "mac" (macOS grid, 824 squircle + shadow), "web" (rounded tile). */
export function iconSVG(theme, variant, shape) {
  const p = paint(theme, variant);
  const size = 1024;
  const inset = shape === "mac" ? 100 : 0;
  const side = size - inset * 2;
  const radius = shape === "mac" ? 185 : shape === "web" ? 256 : 0;
  const scale = side / 64;
  const shadow = shape === "mac"
    ? `<filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity=".28"/></filter>`
    : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<title>Lakshly ${theme.name} (${variant})</title>`,
    `<defs>${gradient("tile", p.tile)}${gradient("mark", p.mark)}${shadow}</defs>`,
    // The shadow is a separate shape so the tile gradient is not rasterised through the filter (banding).
    shape === "mac" ? `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${radius}" fill="#000" filter="url(#s)"/>` : "",
    `<rect x="${inset}" y="${inset}" width="${side}" height="${side}" rx="${radius}" fill="url(#tile)"/>`,
    `<g transform="translate(${inset} ${inset}) scale(${scale})"><path d="${LOTUS}" fill="url(#mark)"${p.markOpacity < 1 ? ` opacity="${p.markOpacity}"` : ""}/></g>`,
    `</svg>`,
    "",
  ].join("\n");
}

const json = (value) => JSON.stringify(value, null, 2) + "\n";
const info = { author: "xcode", version: 1 };
const DARK = [{ appearance: "luminosity", value: "dark" }];
const TINT = [{ appearance: "luminosity", value: "tinted" }];
const MAC_SIZES = [16, 32, 128, 256, 512];

async function png(svg, px, path, { flatten = false } = {}) {
  // Render at the target size (librsvg bands dark gradients when heavily supersampled); tiny sizes get 4x.
  const supersample = px <= 64 ? 4 : 1;
  let image = sharp(Buffer.from(svg), { density: 72 * (px / 1024) * supersample }).resize(px, px);
  if (flatten) image = image.flatten({ background: "#000000" });
  await image.png({ compressionLevel: 9 }).toFile(path);
}

function freshDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

const themes = JSON.parse(readFileSync(themesPath, "utf8")).themes;
for (const id of Object.keys(RECIPES)) if (!themes.some((t) => t.id === id)) throw new Error(`theme ${id} missing from ${themesPath}`);
if (!existsSync(assetsDir)) throw new Error(`asset catalog not found: ${assetsDir}`);

const sheetCells = [];
for (const theme of themes) {
  const svgs = {
    light: iconSVG(theme, "light", "ios"), dark: iconSVG(theme, "dark", "ios"), tinted: iconSVG(theme, "tinted", "ios"),
    mac: iconSVG(theme, "light", "mac"), "mac-dark": iconSVG(theme, "dark", "mac"),
    web: iconSVG(theme, "light", "web"), "web-dark": iconSVG(theme, "dark", "web"),
  };
  const themeSvgDir = join(svgDir, theme.id);
  freshDir(themeSvgDir);
  for (const [name, svg] of Object.entries(svgs)) writeFileSync(join(themeSvgDir, `${name}.svg`), svg);

  // App icon set.
  const iconSet = join(assetsDir, `${appIconName(theme.id)}.appiconset`);
  freshDir(iconSet);
  const images = [
    { filename: "ios-light.png", idiom: "universal", platform: "ios", size: "1024x1024" },
    { appearances: DARK, filename: "ios-dark.png", idiom: "universal", platform: "ios", size: "1024x1024" },
    { appearances: TINT, filename: "ios-tinted.png", idiom: "universal", platform: "ios", size: "1024x1024" },
  ];
  await png(svgs.light, 1024, join(iconSet, "ios-light.png"), { flatten: true });
  await png(svgs.dark, 1024, join(iconSet, "ios-dark.png"), { flatten: true });
  await png(svgs.tinted, 1024, join(iconSet, "ios-tinted.png"), { flatten: true });
  if (theme.id === "lakshmi") {
    // macOS has no alternate icons: only the primary set carries Finder/Dock sizes.
    for (const pt of MAC_SIZES) for (const scale of [1, 2]) {
      const filename = `mac-${pt}x${pt}@${scale}x.png`;
      await png(svgs.mac, pt * scale, join(iconSet, filename));
      images.push({ filename, idiom: "mac", scale: `${scale}x`, size: `${pt}x${pt}` });
    }
  }
  writeFileSync(join(iconSet, "Contents.json"), json({ images, info }));

  // Settings picker preview (light + dark appearance).
  const preview = join(assetsDir, `ThemeIcon-${theme.id}.imageset`);
  freshDir(preview);
  await png(svgs.light, 360, join(preview, "light.png"), { flatten: true });
  await png(svgs.dark, 360, join(preview, "dark.png"), { flatten: true });
  writeFileSync(join(preview, "Contents.json"), json({
    images: [
      { filename: "light.png", idiom: "universal" },
      { appearances: DARK, filename: "dark.png", idiom: "universal" },
    ],
    info,
  }));

  // macOS runtime Dock icons (NSApplication.applicationIconImage).
  for (const [suffix, svg] of [["", svgs.mac], ["-Dark", svgs["mac-dark"]]]) {
    const dock = join(assetsDir, `DockIcon-${theme.id}${suffix}.imageset`);
    freshDir(dock);
    await png(svg, 1024, join(dock, "dock.png"));
    writeFileSync(join(dock, "Contents.json"), json({ images: [{ filename: "dock.png", idiom: "mac" }], info }));
  }

  // Web favicons: one SVG per theme and appearance, swapped at runtime by the theme switcher.
  if (webDir) {
    const webIcons = join(webDir, "icons");
    mkdirSync(webIcons, { recursive: true });
    writeFileSync(join(webIcons, `${theme.id}.svg`), svgs.web);
    writeFileSync(join(webIcons, `${theme.id}-dark.svg`), svgs["web-dark"]);
    if (theme.id === "lakshmi") {
      writeFileSync(join(webDir, "icon.svg"), svgs.web);
      await png(svgs.light, 180, join(webDir, "apple-touch-icon.png"), { flatten: true });
      await png(svgs.web, 192, join(webIcons, "icon-192.png"));
      await png(svgs.web, 512, join(webIcons, "icon-512.png"));
      await png(svgs.light, 512, join(webIcons, "maskable-512.png"), { flatten: true });
    }
  }
  sheetCells.push({ theme, svgs });
}

if (sheetPath) {
  // Contact sheet: one row per theme, columns light / dark / tinted (iOS mask) / macOS Dock light / dark.
  const cell = 220, pad = 24, label = 230, cols = ["light", "dark", "tinted", "mac", "mac-dark"];
  const width = label + cols.length * (cell + pad) + pad, height = 70 + themes.length * (cell + pad) + pad;
  const composites = [];
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${cell}"><rect width="${cell}" height="${cell}" rx="${cell * 0.2237}"/></svg>`);
  for (const [row, { theme, svgs }] of sheetCells.entries()) {
    for (const [col, key] of cols.entries()) {
      let buf = await sharp(Buffer.from(svgs[key]), { density: 72 }).resize(cell, cell).png().toBuffer();
      if (!key.startsWith("mac")) buf = await sharp(buf).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
      composites.push({ input: buf, left: label + pad + col * (cell + pad), top: 70 + pad + row * (cell + pad) });
    }
  }
  const text = [
    ...cols.map((c, i) => `<text x="${label + pad + i * (cell + pad) + cell / 2}" y="52" text-anchor="middle">${{ light: "iOS light", dark: "iOS dark", tinted: "iOS tinted", mac: "macOS Dock", "mac-dark": "macOS Dock dark" }[c]}</text>`),
    ...sheetCells.map(({ theme }, row) => `<text x="${pad}" y="${70 + pad + row * (cell + pad) + cell / 2 + 8}">${theme.name}${theme.premium ? " ✦" : ""}</text>`),
  ].join("");
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#8E8E93"/><g font-family="Helvetica, Arial, sans-serif" font-size="24" fill="#FFFFFF">${text}</g></svg>`);
  await sharp(bg).composite(composites).png().toFile(sheetPath);
}
console.log(`theme icons: ${themes.length} themes -> ${assetsDir}${webDir ? `, ${webDir}` : ""}, svg ${svgDir}`);
