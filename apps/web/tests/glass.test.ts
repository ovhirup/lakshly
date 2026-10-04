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

  it("leaves Lotus Glass alone", () => {
    expect(glassDeclarations(100, "lotusGlass")).toBeNull();
    expect(glassDeclarations(70, "calm")).toEqual({ card: "24px", nav: "20px" });
    const removed: string[] = [];
    const set: [string, string][] = [];
    const root = {
      setProperty: (name: string, value: string) => { set.push([name, value]); },
      removeProperty: (name: string) => { removed.push(name); },
    };
    applyGlass(100, "lotusGlass", root);
    expect(removed).toEqual(["--lk-glass-card", "--lk-glass-nav"]);
    expect(set).toEqual([]);
    applyGlass(0, "vivid", root);
    expect(set).toEqual([["--lk-glass-card", "0px"], ["--lk-glass-nav", "0px"]]);
  });

  it("feeds blur through variables, with the webkit property first", () => {
    const css = readFileSync(new URL("../app/beta-glass.css", import.meta.url), "utf8");
    const webkit = css.indexOf("-webkit-backdrop-filter: blur(var(--lk-glass-card, 24px))");
    const standard = css.indexOf("backdrop-filter: blur(var(--lk-glass-card, 24px))");
    expect(webkit).toBeGreaterThan(-1);
    expect(standard).toBeGreaterThan(webkit);
    expect(css).toContain("blur(var(--lk-glass-nav, 20px))");
    expect(css).not.toMatch(/backdrop-filter:\s*blur\(24px\)/);
    expect(css).not.toMatch(/backdrop-filter:\s*blur\(20px\)/);
  });
});
