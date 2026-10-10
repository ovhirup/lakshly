// Beta edition + Theme System v2 mapping (synthetic, no storage).
import { describe, expect, it } from "vitest";
import { editionFrom } from "../lib/edition";
import { displayName } from "../lib/profile";
import { ACCENTS, effectiveThemeV2, LEGACY_TO_V2, legacyIdFor, parseThemeV2, resolveThemeV2, BETA_DEFAULT } from "../lib/themes-v2";

describe("edition flag", () => {
  it("only the exact value 'beta' turns the beta on", () => {
    expect(editionFrom("beta")).toBe("beta");
    expect(editionFrom(undefined)).toBe("public");
    expect(editionFrom("BETA")).toBe("public");
  });
  it("no default person in any edition: an unset name shows the neutral 'You'", () => {
    expect(displayName({ name: "" })).toBe("You");
    expect(displayName({ name: "Asha" })).toBe("Asha");
  });
});

describe("theme v2 migration (§6)", () => {
  it("maps all six legacy ids and round-trips to the legacy data-theme", () => {
    for (const [legacy, v2] of Object.entries(LEGACY_TO_V2)) {
      expect(resolveThemeV2(null, legacy)).toEqual(v2);
      expect(legacyIdFor(v2)).toBe(legacy);
    }
  });
  it("stored v2 wins, unknown falls back to default, accents normalised per mood", () => {
    expect(resolveThemeV2('{"theme":"calm","accent":"quartz","v":2}', "lakshmi")).toEqual({ v: 2, theme: "calm", accent: "quartz" });
    expect(resolveThemeV2(null, "nope")).toEqual(BETA_DEFAULT);
    expect(parseThemeV2('{"theme":"vivid","accent":"gold"}')).toEqual({ v: 2, theme: "vivid", accent: "lakshmi" });
    expect(parseThemeV2('{"theme":"lotusGlass","accent":"tide"}')).toEqual({ v: 2, theme: "lotusGlass", accent: null });
  });
  it("without Premium, Lotus Glass and ✦ accents fall back but stay stored", () => {
    expect(effectiveThemeV2({ v: 2, theme: "lotusGlass", accent: null }, false)).toEqual(LEGACY_TO_V2.lakshmi);
    expect(effectiveThemeV2({ v: 2, theme: "vivid", accent: "tide" }, false)).toEqual({ v: 2, theme: "vivid", accent: "lakshmi" });
    expect(effectiveThemeV2({ v: 2, theme: "vivid", accent: "tide" }, true).accent).toBe("tide");
    expect(Object.values(ACCENTS).filter((a) => a.premium).map((a) => a.id).sort()).toEqual(["quartz", "sage", "tide"]);
  });
});
