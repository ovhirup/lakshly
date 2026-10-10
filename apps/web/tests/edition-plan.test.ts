import { describe, expect, it } from "vitest";
import { resolveStoredPlan } from "@/lib/edition";

describe("beta tester plan", () => {
  it("defaults beta to Premium and keeps an explicit Free choice", () => {
    expect(resolveStoredPlan(true, null)).toBe("premium");
    expect(resolveStoredPlan(true, "premium")).toBe("premium");
    expect(resolveStoredPlan(true, "free")).toBe("free");
    expect(resolveStoredPlan(true, "nope")).toBe("premium");
  });

  it("keeps the public app on Free unless Premium was chosen", () => {
    expect(resolveStoredPlan(false, null)).toBe("free");
    expect(resolveStoredPlan(false, "free")).toBe("free");
    expect(resolveStoredPlan(false, "premium")).toBe("premium");
  });
});
