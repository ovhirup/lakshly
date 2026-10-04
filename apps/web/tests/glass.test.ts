import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyGlass, clampGlass, glassBlur, glassDeclarations, readGlassLevel } from "@/lib/glass";

describe("liquid glass slider", () => {
  it("keeps today's blur at the default and scales from there", () => {
    expect(glassBlur(70)).toEqual({ card: 24, nav: 20 });
    expect(glassBlur(0)).toEqual({ card: 0, nav: 0 });
    expect(glassBlur(100)).toEqual({ card: 34, nav: 29 });
    expect(clampGlass("140")).toBe(100);
    expect(clampGlass("nope")).toBe(70);
    expect(readGlassLevel(null)).toBe(70);
    expect(readGlassLevel(" 40 ")).toBe(40);
  });

  it("applies the same blur on Lotus and Classic", () => {
    expect(glassDeclarations(70)).toEqual({ card: "24px", nav: "20px" });
    expect(glassDeclarations(100)).toEqual({ card: "34px", nav: "29px" });
    const set: [string, string][] = [];
    applyGlass(100, {
      setProperty: (name: string, value: string) => { set.push([name, value]); },
      removeProperty: () => {},
    });
    expect(set).toEqual([["--lk-glass-card", "34px"], ["--lk-glass-nav", "29px"]]);
  });

  it("feeds blur through variables, with the webkit property first", () => {
    const css = readFileSync(new URL("../app/beta-glass.css", import.meta.url), "utf8");
    const webkit = css.indexOf("-webkit-backdrop-filter: blur(var(--lk-glass-card, 24px))");
    const standard = css.indexOf("backdrop-filter: blur(var(--lk-glass-card, 24px))");
    expect(webkit).toBeGreaterThan(-1);
    expect(standard).toBeGreaterThan(webkit);
    expect(css).toContain("blur(var(--lk-glass-nav, 20px))");
    expect(css).not.toMatch(/backdrop-filter:\s*blur\(24px\)/);
    expect(css).toContain('html[data-edition="beta"][data-mood="lotusGlass"] .sidebar.glass');
    expect(css).not.toMatch(/\[data-clear-glass="true"\][^{]*\{[^}]*backdrop-filter:\s*none/);
  });
});
