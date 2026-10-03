import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { applyDocumentTheme, faviconHref } from "../lib/themes";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const repoRoot = resolve(webRoot, "../..");
const cssPath = resolve(webRoot, "app/themes.gen.css");
const tsPath = resolve(webRoot, "lib/themes.gen.ts");

function generate() {
  return execFileSync(process.execPath, ["scripts/gen-themes.mjs"], {
    cwd: webRoot,
    encoding: "utf8",
  });
}

generate();

const css = readFileSync(cssPath, "utf8");
const tsSource = readFileSync(tsPath, "utf8");
const manifest = JSON.parse(readFileSync(resolve(repoRoot, "docs/themes.json"), "utf8")) as {
  themes: ThemeManifest[];
};

const CATEGORIES = [
  "income", "groceries", "dining", "transport", "fuel", "shopping", "utilities", "rent", "health",
  "education", "entertainment", "travel", "subscriptions", "insurance", "investments", "emi", "fees",
  "transfers", "cash", "gifts", "other",
] as const;

const REQUIRED = [
  "--lk-bg", "--lk-surface", "--lk-surface-2", "--lk-text", "--lk-text-muted", "--lk-border",
  "--lk-gold", "--lk-gold-text", "--lk-lotus", "--lk-income", "--lk-spend", "--lk-invest",
  "--lk-danger", "--lk-success", "--lk-glass", "--lk-glass-strong", "--lk-highlight", "--lk-grid",
  "--lk-inner-glow", "--lk-hero", "--lk-hero-text", "--lk-hero-muted", "--lk-on-gold",
  "--lk-ambient-indigo", "--lk-ambient-gold",
  ...CATEGORIES.map((category) => `--lk-cat-${category}`),
];

const TEXT_PAIRS = [
  "--lk-text", "--lk-text-muted", "--lk-gold-text", "--lk-income", "--lk-spend", "--lk-invest",
  "--lk-danger", "--lk-success",
];

type ThemeManifest = {
  id: string;
  name: string;
  premium: boolean;
  description: string;
  usesSemanticIcons: boolean;
  spacious: boolean;
  clearGlass: boolean;
  light: ModeManifest;
  dark: ModeManifest;
};

type ModeManifest = {
  tokens: Record<string, string>;
  categories: Record<string, string>;
  ambient: { primary: string; secondary: string; primaryOpacity: number; secondaryOpacity: number };
};

type Decls = Record<string, string>;

function rgb(hex: string) {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match) throw new Error(`Expected #RRGGBB, got ${hex}`);
  return [1, 3, 5].map((index) => parseInt(match[1].slice(index - 1, index + 1), 16));
}

function linearize(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string) {
  const [r, g, b] = rgb(color).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const left = luminance(a);
  const right = luminance(b);
  const [hi, lo] = left >= right ? [left, right] : [right, left];
  return (hi + 0.05) / (lo + 0.05);
}

function parseRules(source: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  let index = 0;
  while (index < source.length) {
    while (index < source.length && /\s/.test(source[index])) index += 1;
    if (index >= source.length) break;
    if (source.startsWith("/*", index)) {
      const end = source.indexOf("*/", index + 2);
      index = end + 2;
      continue;
    }
    const open = source.indexOf("{", index);
    if (open < 0) break;
    const selector = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      else if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    const body = source.slice(open + 1, cursor - 1);
    if (selector.startsWith("@")) rules.push(...parseRules(body));
    else rules.push({ selector, body });
    index = cursor;
  }
  return rules;
}

function declarations(body: string): Decls {
  const out: Decls = {};
  for (const part of body.split(";")) {
    const line = part.trim();
    if (!line || line.includes("{")) continue;
    const split = line.indexOf(":");
    if (split < 0) continue;
    out[line.slice(0, split).trim()] = line.slice(split + 1).trim();
  }
  return out;
}

const blocks = new Map(parseRules(css).map((rule) => [rule.selector, declarations(rule.body)]));

function block(theme: string, mode: string) {
  const selector = `html[data-theme="${theme}"][data-appearance="${mode}"]`;
  const vars = blocks.get(selector);
  if (!vars) throw new Error(`Missing ${selector}`);
  return vars;
}

function bootScript() {
  const marker = "export const themeBootScript = ";
  const start = tsSource.indexOf(marker);
  if (start < 0) throw new Error("themeBootScript missing");
  const literal = tsSource.slice(start + marker.length).trim().replace(/;\s*$/, "");
  return JSON.parse(literal) as string;
}

const boot = bootScript();

type BootMeta = {
  content: string;
  media?: string;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
};

function runBoot(options: {
  search?: string;
  storage?: Record<string, string>;
  dark?: boolean;
  storageThrows?: boolean;
  brokenDocument?: boolean;
}) {
  const store = { ...(options.storage ?? {}) };
  const writes: string[] = [];
  const dataset: Record<string, string> = {};
  const metas: BootMeta[] = [{
    content: "#000000",
    media: "(prefers-color-scheme: dark)",
    setAttribute(name: string, value: string) {
      if (name === "content") this.content = value;
    },
    removeAttribute(name: string) {
      if (name === "media") delete this.media;
    },
  }];
  const sandbox = {
    URLSearchParams,
    location: { search: options.search ?? "" },
    matchMedia: () => ({ matches: Boolean(options.dark) }),
    localStorage: {
      getItem(key: string) {
        if (options.storageThrows) throw new Error("blocked");
        return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
      },
      setItem(key: string, value: string) {
        if (options.storageThrows) throw new Error("blocked");
        writes.push(key);
        store[key] = value;
      },
      removeItem(key: string) {
        if (options.storageThrows) throw new Error("blocked");
        writes.push(`delete:${key}`);
        delete store[key];
      },
    },
    document: options.brokenDocument ? undefined : {
      documentElement: { dataset },
      head: { appendChild() { /* created only when no meta exists */ } },
      createElement: () => ({ setAttribute() {}, name: "", content: "" }),
      querySelectorAll: (selector: string) => (selector === 'meta[name="theme-color"]' ? metas : []),
    },
  };
  vm.createContext(sandbox);
  expect(() => vm.runInContext(boot, sandbox)).not.toThrow();
  return { dataset, store, writes, metas };
}

const generatedThemes = vm.runInNewContext(
  `(${tsSource.slice(tsSource.indexOf("["), tsSource.indexOf("] as const;") + 1)})`,
) as {
  id: string;
  name: string;
  premium: boolean;
  description: string;
  usesSemanticIcons: boolean;
  spacious: boolean;
  clearGlass: boolean;
  swatches: Record<"light" | "dark", Record<string, string>>;
}[];

describe("generated themes", () => {
  it("is deterministic and marked generated", () => {
    const beforeCss = readFileSync(cssPath, "utf8");
    const beforeTs = readFileSync(tsPath, "utf8");
    generate();
    expect(readFileSync(cssPath, "utf8")).toBe(beforeCss);
    expect(readFileSync(tsPath, "utf8")).toBe(beforeTs);
    expect(css.startsWith("/* Generated — do not edit")).toBe(true);
    expect(tsSource.startsWith("/* Generated — do not edit")).toBe(true);
    expect(css).not.toContain("color-mix");
  });

  it("emits every theme, both appearances, and the required variables", () => {
    expect(manifest.themes).toHaveLength(6);
    expect(blocks.get(":root")).toEqual(block("lakshmi", "light"));
    expect(blocks.get(":root:not([data-appearance])")).toEqual(block("lakshmi", "dark"));
    for (const theme of manifest.themes) {
      for (const mode of ["light", "dark"] as const) {
        const vars = block(theme.id, mode);
        for (const name of REQUIRED) expect(vars[name], `${theme.id}/${mode} ${name}`).toBeTruthy();
        expect(vars["color-scheme"]).toBe(mode);
      }
    }
  });

  it("maps Lakshmi tokens from themes.json and keeps the shipped chrome", () => {
    const lakshmi = manifest.themes.find((theme) => theme.id === "lakshmi");
    expect(lakshmi).toBeTruthy();
    for (const mode of ["light", "dark"] as const) {
      const vars = block("lakshmi", mode);
      const tokens = lakshmi![mode].tokens;
      expect(vars["--lk-bg"]).toBe(tokens.bg);
      expect(vars["--lk-surface"]).toBe(tokens.surface);
      expect(vars["--lk-text"]).toBe(tokens.text);
      expect(vars["--lk-text-muted"]).toBe(tokens.secondaryText);
      expect(vars["--lk-gold-text"]).toBe(tokens.gold);
      expect(vars["--lk-lotus"]).toBe(tokens.lotus);
      expect(vars["--lk-income"]).toBe(tokens.income);
      expect(vars["--lk-spend"]).toBe(tokens.spend);
      expect(vars["--lk-invest"]).toBe(tokens.invest);
      expect(vars["--lk-danger"]).toBe(tokens.danger);
      expect(vars["--lk-success"]).toBe(tokens.success);
      expect(vars["--lk-gold"]).toBe("#D9A93F");
      expect(vars["--lk-hero"]).toBe("#151E40");
      expect(vars["--lk-hero-text"]).toBe("#F7F5ED");
      expect(vars["--lk-hero-muted"]).toBe("#C3CAE1");
      expect(vars["--lk-hero-gold"]).toBe("#D9A93F");
      expect(vars["--lk-on-gold"]).toBe("#231B09");
      for (const category of CATEGORIES) {
        expect(vars[`--lk-cat-${category}`]).toBe(lakshmi![mode].categories[category]);
      }
    }
    const light = block("lakshmi", "light");
    expect(light["--lk-surface-2"]).toBe("#EAEAF3");
    expect(light["--lk-border"]).toBe("#C4C8D8");
    expect(light["--lk-glass"]).toBe("rgba(245,244,249,.64)");
    expect(light["--lk-glass-strong"]).toBe("rgba(245,244,249,.88)");
    expect(light["--lk-ambient-indigo"]).toBe("rgba(98,108,180,.18)");
    expect(light["--lk-ambient-gold"]).toBe("rgba(217,169,63,.08)");
    expect(light["--lk-shadow"]).toBe("0 18px 48px -28px rgba(14,20,48,.28), 0 3px 10px -5px rgba(14,20,48,.12)");
    const dark = block("lakshmi", "dark");
    expect(dark["--lk-surface-2"]).toBe("#263152");
    expect(dark["--lk-border"]).toBe("#465275");
    expect(dark["--lk-glass"]).toBe("rgba(26,35,68,.52)");
    expect(dark["--lk-glass-strong"]).toBe("rgba(26,35,68,.84)");
    expect(dark["--lk-ambient-indigo"]).toBe("rgba(98,108,180,.28)");
    expect(dark["--lk-ambient-gold"]).toBe("rgba(217,169,63,.09)");
  });

  it("keeps text, hero, and category contrast", () => {
    const failures: string[] = [];
    for (const theme of manifest.themes) {
      for (const mode of ["light", "dark"] as const) {
        const vars = block(theme.id, mode);
        for (const name of TEXT_PAIRS) {
          for (const ground of ["--lk-bg", "--lk-surface"]) {
            const ratio = contrast(vars[name], vars[ground]);
            if (ratio < 4.5) failures.push(`${theme.id}/${mode} ${name} on ${ground} ${ratio.toFixed(2)}`);
          }
        }
        const hero = contrast(vars["--lk-hero-text"], vars["--lk-hero"]);
        if (hero < 4.5) failures.push(`${theme.id}/${mode} hero-text ${hero.toFixed(2)}`);
        const heroMuted = contrast(vars["--lk-hero-muted"], vars["--lk-hero"]);
        if (heroMuted < 4.5) failures.push(`${theme.id}/${mode} hero-muted ${heroMuted.toFixed(2)}`);
        const onGold = contrast(vars["--lk-on-gold"], vars["--lk-gold"]);
        if (onGold < 4.5) failures.push(`${theme.id}/${mode} on-gold ${onGold.toFixed(2)}`);
        const heroGold = contrast(vars["--lk-hero-gold"], vars["--lk-hero"]);
        if (heroGold < 4.5) failures.push(`${theme.id}/${mode} hero-gold ${heroGold.toFixed(2)}`);
        for (const category of CATEGORIES) {
          const ratio = contrast(vars[`--lk-cat-${category}`], vars["--lk-surface"]);
          if (ratio < 3) failures.push(`${theme.id}/${mode} ${category} ${ratio.toFixed(2)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps Monochrome Gold flat and Ocean glows scaled", () => {
    for (const mode of ["light", "dark"] as const) {
      const vars = block("monochromeGold", mode);
      expect(vars["--lk-blur"]).toBe("8px");
      expect(vars["--lk-saturate"]).toBe("100%");
      expect(vars["--lk-space"]).toBe("1.35");
      expect(vars["--lk-shadow"]).toBe("none");
      expect(vars["--lk-elevation-1"]).toBe("none");
      expect(vars["--lk-inner-glow"]).toBe("transparent");
      expect(vars["--lk-sheen"]).toBe("transparent");
      expect(vars["--lk-ambient-indigo"]).toBe("rgba(0,0,0,0)");
      expect(vars["--lk-indigo"]).not.toBe(vars["--lk-blue"]);
    }
    expect(block("monochromeGold", "light")["--lk-ambient-gold"]).toBe("rgba(128,96,0,0)");
    expect(block("monochromeGold", "light")["--lk-hero"]).toBe("#000000");
    expect(block("monochromeGold", "light")["--lk-gold"]).toBe("#806000");
    expect(block("monochromeGold", "light")["--lk-hero-gold"]).toBe("#D9AF52");
    expect(block("monochromeGold", "dark")["--lk-ambient-gold"]).toBe("rgba(217,175,82,0)");
    expect(block("monochromeGold", "dark")["--lk-gold"]).toBe("#D9AF52");
    expect(block("monochromeGold", "dark")["--lk-on-gold"]).toBe("#000000");
    expect(block("graphite", "light")["--lk-shadow"]).toBe("0 18px 48px -28px rgba(0,0,0,.18), 0 3px 10px -5px rgba(0,0,0,.08)");
    expect(block("ocean", "light")["--lk-ambient-indigo"]).toBe("rgba(21,157,168,.18)");
    expect(block("ocean", "light")["--lk-ambient-gold"]).toBe("rgba(23,101,117,.08)");
    expect(block("ocean", "dark")["--lk-ambient-indigo"]).toBe("rgba(21,157,168,.28)");
    expect(block("ocean", "dark")["--lk-ambient-gold"]).toBe("rgba(113,204,213,.09)");
  });

  it("publishes typed metadata and preview swatches", () => {
    expect(generatedThemes.map((theme) => theme.id)).toEqual(manifest.themes.map((theme) => theme.id));
    for (const theme of manifest.themes) {
      const generated = generatedThemes.find((item) => item.id === theme.id)!;
      expect(generated.name).toBe(theme.name);
      expect(generated.premium).toBe(theme.premium);
      expect(generated.description).toBe(theme.description);
      expect(generated.usesSemanticIcons).toBe(theme.usesSemanticIcons);
      expect(generated.spacious).toBe(theme.spacious);
      expect(generated.clearGlass).toBe(theme.clearGlass);
      for (const mode of ["light", "dark"] as const) {
        const swatch = generated.swatches[mode];
        const vars = block(theme.id, mode);
        expect(swatch.bg).toBe(vars["--lk-bg"]);
        expect(swatch.surface).toBe(vars["--lk-surface"]);
        expect(swatch.text).toBe(vars["--lk-text"]);
        expect(swatch.gold).toBe(theme[mode].tokens.gold);
        expect(swatch.income).toBe(theme[mode].tokens.income);
        expect(swatch.spend).toBe(theme[mode].tokens.spend);
        expect(swatch.invest).toBe(theme[mode].tokens.invest);
        expect(swatch.accent).toBe(theme[mode].tokens.lotus);
      }
    }
  });
});

describe("pre-paint script", () => {
  it("never throws, including when storage or the document is unavailable", () => {
    runBoot({ storageThrows: true, dark: true });
    runBoot({ brokenDocument: true, search: "?theme=ocean&appearance=dark&switcher=open" });
    const fallback = runBoot({ storage: { "lakshly.themeId": "not-a-theme", "lakshly.appearance": "sideways" } });
    expect(fallback.dataset.theme).toBe("lakshmi");
    expect(fallback.dataset.appearance).toBe("light");
  });

  it("applies screenshot query params without saving them", () => {
    const result = runBoot({
      search: "?theme=ocean&appearance=dark&switcher=open",
      storage: { "lakshly.plan": "free", "lakshly.themeId": "lakshmi" },
      dark: false,
    });
    expect(result.dataset.theme).toBe("ocean");
    expect(result.dataset.appearance).toBe("dark");
    expect(result.dataset.themeEphemeral).toBe("1");
    expect(result.dataset.appearanceEphemeral).toBe("dark");
    expect(result.dataset.switcher).toBe("open");
    expect(result.store["lakshly.themeId"]).toBe("lakshmi");
    expect(result.store["lakshly.appearance"]).toBeUndefined();
    expect(result.writes).toEqual([]);
    expect(result.metas[0].content).toBe("#081B2B");
    expect(result.metas[0].media).toBeUndefined();
  });

  it("migrates the legacy appearance key and gates stored premium themes", () => {
    const legacy = runBoot({ storage: { "lakshly.theme": "dark" }, dark: false });
    expect(legacy.dataset.appearance).toBe("dark");
    expect(legacy.store["lakshly.appearance"]).toBe("dark");
    expect(legacy.store["lakshly.theme"]).toBeUndefined();

    const locked = runBoot({ storage: { "lakshly.themeId": "forest", "lakshly.plan": "free" } });
    expect(locked.dataset.theme).toBe("lakshmi");
    expect(locked.store["lakshly.themeId"]).toBe("forest");

    const unlocked = runBoot({ storage: { "lakshly.themeId": "forest", "lakshly.plan": "premium" }, dark: true });
    expect(unlocked.dataset.theme).toBe("forest");
    expect(unlocked.dataset.appearance).toBe("dark");

    const mono = runBoot({ search: "?theme=monochromeGold" });
    expect(mono.dataset.semanticIcons).toBe("true");
    expect(mono.dataset.spacious).toBe("true");
    expect(mono.dataset.clearGlass).toBe("true");
    expect(mono.writes).toEqual([]);
  });
});


describe("theme icons", () => {
  it("creates or reuses the SVG favicon, including when theme-color is absent", () => {
    for (const existing of [false, true]) {
      const attributes: Record<string, string> = {};
      const icon = { type: "image/svg+xml", setAttribute: (key: string, value: string) => { attributes[key] = value; } };
      const children: unknown[] = [];
      const doc = {
        documentElement: { dataset: {} },
        head: { appendChild: (child: unknown) => { children.push(child); } },
        querySelector: () => existing || children.includes(icon) ? icon : null,
        querySelectorAll: () => [],
        createElement: (tag: string) => tag === "link" ? icon : {},
      };
      vi.stubGlobal("document", doc);
      try {
        applyDocumentTheme("ocean", "dark");
        expect(attributes.href).toBe("/icons/ocean-dark.svg");
        expect(attributes["data-theme-icon"]).toBe("");
        applyDocumentTheme("graphite", "light");
        expect(attributes.href).toBe("/icons/graphite.svg");
        expect(children.filter((child) => child === icon)).toHaveLength(existing ? 0 : 1);
      } finally {
        vi.unstubAllGlobals();
      }
    }
  });

  it("maps every theme and appearance to a shipped favicon", () => {
    for (const theme of manifest.themes) {
      for (const appearance of ["light", "dark"] as const) {
        const href = faviconHref(theme.id, appearance);
        expect(href).toBe(`/icons/${theme.id}${appearance === "dark" ? "-dark" : ""}.svg`);
        expect(existsSync(resolve(webRoot, "public", href.slice(1))), href).toBe(true);
      }
    }
  });

  it("falls back to Lakshmi for an unknown theme", () => {
    expect(faviconHref("unknown", "light")).toBe("/icons/lakshmi.svg");
    expect(faviconHref("unknown", "dark")).toBe("/icons/lakshmi-dark.svg");
  });

  it("ships every manifest icon", () => {
    const pwa = JSON.parse(readFileSync(resolve(webRoot, "public/manifest.webmanifest"), "utf8")) as {
      icons: { src: string; sizes: string; purpose?: string }[];
    };
    expect(pwa.icons.map((icon) => icon.src)).toEqual([
      "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png",
    ]);
    for (const icon of pwa.icons) {
      expect(existsSync(resolve(webRoot, "public", icon.src.slice(1))), icon.src).toBe(true);
    }
    expect(pwa.icons.find((icon) => icon.purpose === "maskable")?.sizes).toBe("512x512");
  });
});
