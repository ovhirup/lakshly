// Generates app/themes.gen.css and lib/themes.gen.ts from docs/themes.json.
// Node stdlib only. Deterministic: no timestamps, stable key order, LF newlines.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const manifestPath = resolve(root, "docs/themes.json");
const cssPath = resolve(here, "../app/themes.gen.css");
const tsPath = resolve(here, "../lib/themes.gen.ts");

const CATEGORIES = [
  "income", "groceries", "dining", "transport", "fuel", "shopping", "utilities", "rent", "health",
  "education", "entertainment", "travel", "subscriptions", "insurance", "investments", "emi", "fees",
  "transfers", "cash", "gifts", "other",
];

// Modest web scale of the native ambient opacities. Lakshmi's shipped rgba()
// values are special-cased below so the default theme stays pixel-identical;
// these factors reproduce that opacity lift (0.05 → .18, 0.12 → .28, …).
const LIGHT_PRIMARY_SCALE = 3.6;
const LIGHT_SECONDARY_SCALE = 3.2;
const DARK_PRIMARY_SCALE = 7 / 3;
const DARK_SECONDARY_SCALE = 1.8;
const AMBIENT_CAP = 0.34;

const HEADER = "Generated — do not edit";

function rgb(hex) {
  if (typeof hex !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error(`Expected #RRGGBB, got ${hex}`);
  }
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function hex(channels) {
  return `#${channels.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(a, b, t) {
  const A = rgb(a);
  const B = rgb(b);
  return hex(A.map((v, i) => v * (1 - t) + B[i] * t));
}

function formatAlpha(n) {
  const rounded = Math.round(Math.min(1, Math.max(0, n)) * 1000) / 1000;
  if (rounded === 0) return "0";
  if (rounded === 1) return "1";
  let s = rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (s.startsWith("0.")) s = s.slice(1);
  return s;
}

function rgba(color, alpha) {
  const [r, g, b] = rgb(color);
  return `rgba(${r},${g},${b},${formatAlpha(alpha)})`;
}

function linearize(channel) {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(color) {
  const [r, g, b] = rgb(color).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

function brighter(a, b) {
  return luminance(a) >= luminance(b) ? a : b;
}

function darker(a, b) {
  return luminance(a) <= luminance(b) ? a : b;
}

/** Lakshmi chrome copied from the shipped globals.css palette. */
function lakshmiChrome(mode) {
  if (mode === "light") {
    return {
      "--lk-bg": "#FBF8F1",
      "--lk-surface": "#F5F4F9",
      "--lk-surface-2": "#EAEAF3",
      "--lk-text": "#19213E",
      "--lk-text-muted": "#59617A",
      "--lk-border": "#C4C8D8",
      "--lk-gold": "#D9A93F",
      "--lk-gold-text": "#765510",
      "--lk-indigo": "#535EAA",
      "--lk-blue": "#356CA7",
      "--lk-glass": "rgba(245,244,249,.64)",
      "--lk-glass-strong": "rgba(245,244,249,.88)",
      "--lk-highlight": "rgba(255,255,255,.92)",
      "--lk-grid": "rgba(25,33,62,.065)",
      "--lk-shadow": "0 18px 48px -28px rgba(14,20,48,.28), 0 3px 10px -5px rgba(14,20,48,.12)",
      "--lk-elevation-1": "0 8px 24px -16px rgba(14,20,48,.24)",
      "--lk-elevation-3": "0 28px 64px -24px rgba(14,20,48,.32), 0 8px 20px -10px rgba(14,20,48,.18)",
      "--lk-inner-glow": "rgba(255,255,255,.18)",
      "--lk-sheen": "rgba(217,169,63,.18)",
      "--lk-hero": "#151E40",
      "--lk-hero-text": "#F7F5ED",
      "--lk-hero-muted": "#C3CAE1",
      "--lk-hero-gold": "#D9A93F",
      "--lk-on-gold": "#231B09",
      "--lk-ambient-indigo": "rgba(98,108,180,.18)",
      "--lk-ambient-gold": "rgba(217,169,63,.08)",
    };
  }
  return {
    "--lk-bg": "#0E1430",
    "--lk-surface": "#1A2344",
    "--lk-surface-2": "#263152",
    "--lk-text": "#F3F4FC",
    "--lk-text-muted": "#B5BFD8",
    "--lk-border": "#465275",
    "--lk-gold": "#D9A93F",
    "--lk-gold-text": "#E9BF62",
    "--lk-indigo": "#A6AEEE",
    "--lk-blue": "#90BAEB",
    "--lk-glass": "rgba(26,35,68,.52)",
    "--lk-glass-strong": "rgba(26,35,68,.84)",
    "--lk-highlight": "rgba(218,226,255,.48)",
    "--lk-grid": "rgba(215,225,255,.07)",
    "--lk-shadow": "0 24px 64px -28px rgba(0,0,0,.65), 0 4px 12px -6px rgba(0,0,0,.32)",
    "--lk-elevation-1": "0 8px 24px -12px rgba(0,0,0,.4)",
    "--lk-elevation-3": "0 28px 64px -18px rgba(0,0,0,.65), 0 8px 20px -8px rgba(0,0,0,.4)",
    "--lk-inner-glow": "rgba(166,174,238,.07)",
    "--lk-sheen": "rgba(217,169,63,.18)",
    "--lk-hero": "#151E40",
    "--lk-hero-text": "#F7F5ED",
    "--lk-hero-muted": "#C3CAE1",
    "--lk-hero-gold": "#D9A93F",
    "--lk-on-gold": "#231B09",
    "--lk-ambient-indigo": "rgba(98,108,180,.28)",
    "--lk-ambient-gold": "rgba(217,169,63,.09)",
  };
}

function bestInk(bg) {
  const candidates = ["#F7F5ED", "#FFFFFF", "#16141A", "#000000"];
  let best = candidates[0];
  let bestRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrast(candidate, bg);
    if (ratio > bestRatio) {
      best = candidate;
      bestRatio = ratio;
    }
  }
  return best;
}

function muteToward(fg, bg) {
  let best = fg;
  for (let i = 1; i <= 24; i += 1) {
    const next = mix(fg, bg, i / 24);
    if (contrast(next, bg) >= 4.6) best = next;
    else break;
  }
  return best;
}

function onFill(fill) {
  const candidates = ["#231B09", "#1A1408", "#16141A", "#000000", "#F7F5ED", "#FFFFFF"];
  let passing = "";
  let passingRatio = -1;
  for (const candidate of candidates) {
    const ratio = contrast(candidate, fill);
    if (ratio >= 4.5 && ratio > passingRatio) {
      passing = candidate;
      passingRatio = ratio;
    }
  }
  if (passing) return passing;
  return contrast("#FFFFFF", fill) >= contrast("#000000", fill) ? "#FFFFFF" : "#000000";
}

function ensureContrast(color, bg, floor) {
  if (contrast(color, bg) >= floor) return color;
  const target = luminance(bg) < 0.4 ? "#FFFFFF" : "#000000";
  let best = color;
  for (let i = 1; i <= 20; i += 1) {
    best = mix(color, target, i / 20);
    if (contrast(best, bg) >= floor) return best;
  }
  return target;
}

function readablePair(candidates, surfaces) {
  const ok = [];
  for (const candidate of candidates) {
    if (ok.includes(candidate)) continue;
    if (surfaces.every((surface) => contrast(candidate, surface) >= 4.5)) ok.push(candidate);
  }
  return ok;
}

function ambientValue(color, opacity, mode, which) {
  if (opacity <= 0) return rgba(color, 0);
  const scale = mode === "light"
    ? (which === "primary" ? LIGHT_PRIMARY_SCALE : LIGHT_SECONDARY_SCALE)
    : (which === "primary" ? DARK_PRIMARY_SCALE : DARK_SECONDARY_SCALE);
  return rgba(color, Math.min(AMBIENT_CAP, opacity * scale));
}

function lightHero(theme) {
  return darker(theme.dark.tokens.lockBackground, theme.dark.tokens.surface);
}

function derive(theme, mode) {
  const tokens = theme[mode].tokens;
  const light = mode === "light";
  const clear = theme.clearGlass;
  const bg = tokens.bg;
  const surface = tokens.surface;
  const text = tokens.text;
  const muted = tokens.secondaryText;
  const goldText = tokens.gold;
  const goldFill = brighter(tokens.gold, tokens.lockGold);

  let surfaceMix = light ? 0.06 : 0.14;
  let surface2 = mix(surface, text, surfaceMix);
  while (surfaceMix > 0 && (contrast(text, surface2) < 4.5 || contrast(muted, surface2) < 4.5)) {
    surfaceMix = Math.max(0, surfaceMix - 0.01);
    surface2 = mix(surface, text, surfaceMix);
  }

  const border = mix(surface, text, clear ? (light ? 0.16 : 0.24) : (light ? 0.28 : 0.46));
  let hero = theme.id === "lakshmi" ? "#151E40" : (light ? lightHero(theme) : tokens.lockBackground);
  let heroText = bestInk(hero);
  if (contrast(heroText, hero) < 4.5) {
    for (let i = 1; i <= 20; i += 1) {
      const next = mix(hero, "#000000", i / 20);
      const ink = "#F7F5ED";
      if (contrast(ink, next) >= 4.5) {
        hero = next;
        heroText = ink;
        break;
      }
    }
    if (contrast(heroText, hero) < 4.5) {
      hero = "#000000";
      heroText = "#FFFFFF";
    }
  }
  const heroMuted = muteToward(heroText, hero);
  const heroGoldCandidates = [
    goldFill,
    theme.light.tokens.gold,
    theme.light.tokens.lockGold,
    theme.dark.tokens.gold,
    theme.dark.tokens.lockGold,
  ];
  let heroGold = goldFill;
  let heroGoldRatio = contrast(goldFill, hero);
  for (const candidate of heroGoldCandidates) {
    const ratio = contrast(candidate, hero);
    if (ratio > heroGoldRatio) {
      heroGold = candidate;
      heroGoldRatio = ratio;
    }
  }
  heroGold = ensureContrast(heroGold, hero, 4.5);

  const shadows = clear
    ? { shadow: "none", e1: "none", e3: "none" }
    : light
      ? {
        shadow: "0 18px 48px -28px rgba(0,0,0,.18), 0 3px 10px -5px rgba(0,0,0,.08)",
        e1: "0 8px 24px -16px rgba(0,0,0,.14)",
        e3: "0 28px 64px -24px rgba(0,0,0,.2), 0 8px 20px -10px rgba(0,0,0,.1)",
      }
      : {
        shadow: "0 24px 64px -28px rgba(0,0,0,.65), 0 4px 12px -6px rgba(0,0,0,.32)",
        e1: "0 8px 24px -12px rgba(0,0,0,.4)",
        e3: "0 28px 64px -18px rgba(0,0,0,.65), 0 8px 20px -8px rgba(0,0,0,.4)",
      };

  const pool = readablePair(
    [theme[mode].categories.education, theme[mode].categories.travel, theme[mode].categories.rent, theme[mode].categories.investments, theme[mode].categories.fuel, tokens.invest, goldText, text],
    [bg, surface, surface2],
  );

  return {
    "--lk-bg": bg,
    "--lk-surface": surface,
    "--lk-surface-2": surface2,
    "--lk-text": text,
    "--lk-text-muted": muted,
    "--lk-border": border,
    "--lk-gold": goldFill,
    "--lk-gold-text": goldText,
    "--lk-indigo": pool[0] ?? text,
    "--lk-blue": pool[1] ?? pool[0] ?? text,
    "--lk-glass": rgba(surface, clear ? (light ? 0.92 : 0.88) : (light ? 0.64 : 0.52)),
    "--lk-glass-strong": rgba(surface, clear ? (light ? 0.97 : 0.94) : (light ? 0.88 : 0.84)),
    "--lk-highlight": clear ? rgba("#FFFFFF", light ? 0.4 : 0.14) : (light ? rgba("#FFFFFF", 0.92) : rgba(mix("#FFFFFF", text, 0.12), 0.4)),
    "--lk-grid": rgba(text, light ? 0.065 : 0.07),
    "--lk-shadow": shadows.shadow,
    "--lk-elevation-1": shadows.e1,
    "--lk-elevation-3": shadows.e3,
    "--lk-inner-glow": clear ? "transparent" : (light ? rgba("#FFFFFF", 0.18) : rgba(mix(goldText, "#FFFFFF", 0.45), 0.08)),
    "--lk-sheen": clear ? "transparent" : rgba(goldFill, 0.18),
    "--lk-hero": hero,
    "--lk-hero-text": heroText,
    "--lk-hero-muted": heroMuted,
    "--lk-hero-gold": heroGold,
    "--lk-on-gold": onFill(goldFill),
    "--lk-ambient-indigo": ambientValue(theme[mode].ambient.primary, theme[mode].ambient.primaryOpacity, mode, "primary"),
    "--lk-ambient-gold": ambientValue(theme[mode].ambient.secondary, theme[mode].ambient.secondaryOpacity, mode, "secondary"),
  };
}

const ORDER = [
  "--lk-bg", "--lk-surface", "--lk-surface-2", "--lk-text", "--lk-text-muted", "--lk-border",
  "--lk-gold", "--lk-gold-text", "--lk-lotus", "--lk-income", "--lk-spend", "--lk-invest",
  "--lk-danger", "--lk-success", "--lk-indigo", "--lk-blue", "--lk-glass", "--lk-glass-strong",
  "--lk-highlight", "--lk-grid", "--lk-shadow", "--lk-elevation-1", "--lk-elevation-3",
  "--lk-inner-glow", "--lk-sheen", "--lk-hero", "--lk-hero-text", "--lk-hero-muted", "--lk-hero-gold",
  "--lk-on-gold", "--lk-ambient-indigo", "--lk-ambient-gold", "--lk-blur", "--lk-saturate", "--lk-space",
  ...CATEGORIES.map((category) => `--lk-cat-${category}`),
];

function buildVars(theme, mode) {
  const tokens = theme[mode].tokens;
  const chrome = theme.id === "lakshmi" ? lakshmiChrome(mode) : derive(theme, mode);
  const vars = { ...chrome };
  vars["--lk-lotus"] = tokens.lotus;
  vars["--lk-income"] = tokens.income;
  vars["--lk-spend"] = tokens.spend;
  vars["--lk-invest"] = tokens.invest;
  vars["--lk-danger"] = tokens.danger;
  vars["--lk-success"] = tokens.success;
  vars["--lk-bg"] = tokens.bg;
  vars["--lk-surface"] = tokens.surface;
  vars["--lk-text"] = tokens.text;
  vars["--lk-text-muted"] = tokens.secondaryText;
  vars["--lk-gold-text"] = tokens.gold;
  if (theme.id === "lakshmi") vars["--lk-gold"] = "#D9A93F";
  vars["--lk-blur"] = theme.clearGlass ? "8px" : "32px";
  vars["--lk-saturate"] = theme.clearGlass ? "100%" : "165%";
  vars["--lk-space"] = theme.spacious ? "1.35" : "1";
  for (const category of CATEGORIES) {
    const value = theme[mode].categories[category];
    if (!value) throw new Error(`${theme.id}/${mode} missing category ${category}`);
    vars[`--lk-cat-${category}`] = value;
  }
  const ordered = {};
  for (const key of ORDER) {
    if (vars[key] === undefined) throw new Error(`Missing ${key} for ${theme.id}/${mode}`);
    ordered[key] = vars[key];
  }
  return ordered;
}

function checkContrast(theme, mode, vars, failures) {
  const pairs = ["--lk-text", "--lk-text-muted", "--lk-gold-text", "--lk-income", "--lk-spend", "--lk-invest", "--lk-danger", "--lk-success"];
  for (const fg of pairs) {
    for (const bg of ["--lk-bg", "--lk-surface"]) {
      const ratio = contrast(vars[fg], vars[bg]);
      if (ratio < 4.5) failures.push(`${theme.id}/${mode} ${fg} on ${bg} ${ratio.toFixed(2)}`);
    }
  }
  const heroRatio = contrast(vars["--lk-hero-text"], vars["--lk-hero"]);
  if (heroRatio < 4.5) failures.push(`${theme.id}/${mode} hero-text ${heroRatio.toFixed(2)}`);
  const mutedRatio = contrast(vars["--lk-hero-muted"], vars["--lk-hero"]);
  if (mutedRatio < 4.5) failures.push(`${theme.id}/${mode} hero-muted ${mutedRatio.toFixed(2)}`);
  const onGold = contrast(vars["--lk-on-gold"], vars["--lk-gold"]);
  if (onGold < 4.5) failures.push(`${theme.id}/${mode} on-gold ${onGold.toFixed(2)}`);
  const heroGold = contrast(vars["--lk-hero-gold"], vars["--lk-hero"]);
  if (heroGold < 4.5) failures.push(`${theme.id}/${mode} hero-gold ${heroGold.toFixed(2)}`);
  for (const category of CATEGORIES) {
    const ratio = contrast(vars[`--lk-cat-${category}`], vars["--lk-surface"]);
    if (ratio < 3) failures.push(`${theme.id}/${mode} cat ${category} ${ratio.toFixed(2)}`);
  }
}

function cssBlock(selector, vars, scheme) {
  const lines = Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`);
  lines.push(`  color-scheme: ${scheme};`);
  return `${selector} {\n${lines.join("\n")}\n}`;
}

function swatch(theme, mode, vars) {
  return {
    bg: vars["--lk-bg"],
    surface: vars["--lk-surface"],
    text: vars["--lk-text"],
    gold: vars["--lk-gold-text"],
    income: vars["--lk-income"],
    spend: vars["--lk-spend"],
    invest: vars["--lk-invest"],
    accent: theme[mode].tokens.lotus,
  };
}

function tsString(value) {
  return JSON.stringify(value);
}

function buildBootScript(data) {
  const ids = tsString(data.themes.map((theme) => theme.id));
  const premium = {};
  const flags = {};
  const bgs = {};
  for (const theme of data.themes) {
    if (theme.premium) premium[theme.id] = 1;
    flags[theme.id] = { semantic: theme.usesSemanticIcons, spacious: theme.spacious, clear: theme.clearGlass };
    bgs[theme.id] = { light: theme.light.tokens.bg, dark: theme.dark.tokens.bg };
  }
  return `/* Theme boot. ?theme=<id>&appearance=light|dark applies for this load only. ?switcher=open opens the switcher. */` +
    `(function(){try{` +
    `var IDS=${ids};` +
    `var PREMIUM=${tsString(premium)};` +
    `var FLAGS=${tsString(flags)};` +
    `var BGS=${tsString(bgs)};` +
    `var root=document.documentElement;` +
    `var params=new URLSearchParams(location.search);` +
    `var qTheme=params.get("theme");` +
    `var qAppearance=params.get("appearance");` +
    `var qSwitcher=params.get("switcher");` +
    `var plan="free";` +
    `try{if(localStorage.getItem("lakshly.plan")==="premium")plan="premium"}catch(e){}` +
    `var appearance="system";` +
    `try{var storedAppearance=localStorage.getItem("lakshly.appearance");var legacy=localStorage.getItem("lakshly.theme");` +
    `if(storedAppearance==="light"||storedAppearance==="dark"||storedAppearance==="system")appearance=storedAppearance;` +
    `else if(legacy==="light"||legacy==="dark"){appearance=legacy;try{localStorage.setItem("lakshly.appearance",legacy);localStorage.removeItem("lakshly.theme")}catch(e){}}}` +
    `catch(e){}` +
    `var theme="lakshmi";` +
    `try{var storedTheme=localStorage.getItem("lakshly.themeId");if(storedTheme&&IDS.indexOf(storedTheme)!==-1)theme=storedTheme}catch(e){}` +
    `var ephemeralTheme=false;` +
    `if(qTheme&&IDS.indexOf(qTheme)!==-1){theme=qTheme;ephemeralTheme=true}` +
    `if(!ephemeralTheme&&PREMIUM[theme]&&plan!=="premium")theme="lakshmi";` +
    `var ephemeralAppearance="";` +
    `if(qAppearance==="light"||qAppearance==="dark")ephemeralAppearance=qAppearance;` +
    `var resolved;` +
    `if(ephemeralAppearance)resolved=ephemeralAppearance;` +
    `else if(appearance==="light"||appearance==="dark")resolved=appearance;` +
    `else{try{resolved=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){resolved="light"}}` +
    `var flags=FLAGS[theme]||FLAGS.lakshmi;` +
    `root.dataset.theme=theme;` +
    `root.dataset.appearance=resolved;` +
    `root.dataset.semanticIcons=flags.semantic?"true":"false";` +
    `root.dataset.spacious=flags.spacious?"true":"false";` +
    `root.dataset.clearGlass=flags.clear?"true":"false";` +
    `if(ephemeralTheme)root.dataset.themeEphemeral="1";` +
    `if(ephemeralAppearance)root.dataset.appearanceEphemeral=ephemeralAppearance;` +
    `if(qSwitcher==="open")root.dataset.switcher="open";` +
    `var bg=(BGS[theme]&&BGS[theme][resolved])||(BGS.lakshmi&&BGS.lakshmi.light)||"#FBF8F1";` +
    `var metas=document.querySelectorAll('meta[name="theme-color"]');` +
    `if(!metas.length){var meta=document.createElement("meta");meta.setAttribute("name","theme-color");meta.setAttribute("content",bg);if(document.head)document.head.appendChild(meta)}` +
    `else{for(var i=0;i<metas.length;i++){metas[i].setAttribute("content",bg);metas[i].removeAttribute("media")}}` +
    `}catch(e){}})();`;
}

function emitTs(data, swatches, boot) {
  const lines = [];
  lines.push(`/* ${HEADER}. Source: docs/themes.json */`);
  lines.push("");
  lines.push("export const themes = [");
  for (const theme of data.themes) {
    lines.push("  {");
    lines.push(`    id: ${tsString(theme.id)},`);
    lines.push(`    name: ${tsString(theme.name)},`);
    lines.push(`    premium: ${theme.premium ? "true" : "false"},`);
    lines.push(`    description: ${tsString(theme.description)},`);
    lines.push(`    usesSemanticIcons: ${theme.usesSemanticIcons ? "true" : "false"},`);
    lines.push(`    spacious: ${theme.spacious ? "true" : "false"},`);
    lines.push(`    clearGlass: ${theme.clearGlass ? "true" : "false"},`);
    lines.push("    swatches: {");
    for (const mode of ["light", "dark"]) {
      const sw = swatches[theme.id][mode];
      lines.push(`      ${mode}: { bg: ${tsString(sw.bg)}, surface: ${tsString(sw.surface)}, text: ${tsString(sw.text)}, gold: ${tsString(sw.gold)}, income: ${tsString(sw.income)}, spend: ${tsString(sw.spend)}, invest: ${tsString(sw.invest)}, accent: ${tsString(sw.accent)} },`);
    }
    lines.push("    },");
    lines.push("  },");
  }
  lines.push("] as const;");
  lines.push("");
  lines.push('export type ThemeId = (typeof themes)[number]["id"];');
  lines.push("");
  lines.push(`export const themeBootScript = ${tsString(boot)};`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const data = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (data.schemaVersion !== 1) throw new Error(`Unsupported schemaVersion ${data.schemaVersion}`);
  if (!Array.isArray(data.themes) || data.themes.length !== 6) {
    throw new Error(`Expected 6 themes, got ${data.themes?.length}`);
  }
  const seen = new Set();
  const failures = [];
  const blocks = [];
  const swatches = {};
  let lakshmiLight = null;
  let lakshmiDark = null;

  for (const theme of data.themes) {
    if (seen.has(theme.id)) throw new Error(`Duplicate theme ${theme.id}`);
    seen.add(theme.id);
    swatches[theme.id] = {};
    for (const mode of ["light", "dark"]) {
      const vars = buildVars(theme, mode);
      checkContrast(theme, mode, vars, failures);
      swatches[theme.id][mode] = swatch(theme, mode, vars);
      const selector = `html[data-theme="${theme.id}"][data-appearance="${mode}"]`;
      blocks.push(cssBlock(selector, vars, mode));
      if (theme.id === "lakshmi" && mode === "light") lakshmiLight = vars;
      if (theme.id === "lakshmi" && mode === "dark") lakshmiDark = vars;
    }
  }

  if (failures.length) {
    console.error(failures.map((failure) => `FAIL ${failure}`).join("\n"));
    throw new Error(`${failures.length} contrast failures`);
  }

  const mediaInner = cssBlock(":root:not([data-appearance])", lakshmiDark, "dark")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  const css = [
    `/* ${HEADER}. Source: docs/themes.json */`,
    "/* Fallback when data-theme / data-appearance are missing: Lakshmi, following the OS scheme. */",
    cssBlock(":root", lakshmiLight, "light"),
    "@media (prefers-color-scheme: dark) {",
    mediaInner,
    "}",
    "",
    ...blocks,
    "",
  ].join("\n");

  const boot = buildBootScript(data);
  writeFileSync(cssPath, css);
  writeFileSync(tsPath, emitTs(data, swatches, boot));
  console.log(`generated ${data.themes.length} themes × 2 appearances -> app/themes.gen.css, lib/themes.gen.ts`);
}

main();
