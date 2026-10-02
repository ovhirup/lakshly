import { describe, expect, it } from "vitest";
import { replyBy, SEED, voteWeight } from "../lib/feedback";
import { buildPayload, looksSensitive } from "../lib/feedback-transport";

const diag = { appVersion: "web 0.2.0", platform: "Web" };
const base = { kind: "idea" as const, title: "  Remind me before SIP dates ", detail: "", area: "SIPs", includeDiagnostics: false };

describe("feedback payload", () => {
  it("contains only typed fields and plan tier by default", () => {
    expect(buildPayload(base, "free", diag)).toEqual({ kind: "idea", title: "Remind me before SIP dates", detail: "", area: "SIPs", plan: "free" });
  });
  it("adds credit, reply email and diagnostics only when given / opted in", () => {
    const p = buildPayload({ ...base, credit: "Kavya", replyEmail: "k@example.invalid", includeDiagnostics: true }, "premium", diag);
    expect(p.credit).toBe("Kavya");
    expect(p.replyEmail).toBe("k@example.invalid");
    expect(p.diagnostics).toEqual(diag);
    expect(Object.keys(p).sort()).toEqual(["area", "credit", "detail", "diagnostics", "kind", "plan", "replyEmail", "title"]);
  });
  it("clips long text", () => {
    expect(buildPayload({ ...base, title: "x".repeat(200) }, "free", diag).title).toHaveLength(90);
  });
});

describe("sensitive-text warning", () => {
  it("flags card/account numbers, PAN and IFSC", () => {
    expect(looksSensitive("card 4111 1111 1111 1111")).toBe(true);
    expect(looksSensitive("acct 50100123456789")).toBe(true);
    expect(looksSensitive("PAN ABCDE1234F")).toBe(true);
    expect(looksSensitive("IFSC HDFC0001234")).toBe(true);
  });
  it("ignores ordinary text and small numbers", () => {
    expect(looksSensitive("Remind me 3 days before, around ₹2,000 limit, in 2026")).toBe(false);
  });
});

describe("reply-by date (IST business days)", () => {
  it("skips the weekend", () => {
    // Saturday 3 Oct 2026, 18:00 IST -> next business day is Monday 5 Oct.
    expect(replyBy(new Date("2026-10-03T12:30:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-10-05");
  });
  it("counts five business days", () => {
    expect(replyBy(new Date("2026-10-05T04:00:00Z"), 5).toISOString().slice(0, 10)).toBe("2026-10-12");
  });
});

describe("seed and weights", () => {
  it("Premium votes weigh 3×", () => { expect(voteWeight("premium")).toBe(3); expect(voteWeight("free")).toBe(1); });
  it("seed ids are unique", () => { expect(new Set(SEED.map((r) => r.id)).size).toBe(SEED.length); });
});
