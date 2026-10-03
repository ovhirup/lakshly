import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_MINE, displayVotes, replyBy, ROADMAP } from "../lib/feedback";
import { buildPayload, fetchStatus, looksSensitive, mailtoHref, send, SendError } from "../lib/feedback-transport";
import { APP_VERSION } from "../lib/version";

const diag = { appVersion: APP_VERSION, platform: "Web" };
const base = { kind: "idea" as const, title: "  Remind me before SIP dates ", detail: "", area: "SIPs", includeDiagnostics: false };
afterEach(() => vi.unstubAllGlobals());

describe("feedback payload", () => {
  it("contains only typed fields and plan tier by default (no diagnostics)", () => {
    expect(buildPayload(base, "free", diag)).toEqual({ kind: "idea", title: "Remind me before SIP dates", detail: "", area: "SIPs", plan: "free" });
  });
  it("adds credit, reply email and diagnostics only when given / opted in", () => {
    const p = buildPayload({ ...base, credit: "Kavya", replyEmail: "k@example.invalid", includeDiagnostics: true }, "premium", diag);
    expect(Object.keys(p).sort()).toEqual(["area", "credit", "detail", "diagnostics", "kind", "plan", "replyEmail", "title"]);
    expect(p.diagnostics).toEqual({ appVersion: "0.2.0 (web)", platform: "Web" });
  });
  it("clips long text", () => { expect(buildPayload({ ...base, title: "x".repeat(200) }, "free", diag).title).toHaveLength(90); });
});

describe("transport", () => {
  const p = buildPayload({ ...base, detail: "So I can plan cash & stuff" }, "premium", diag);
  it("falls back to a mailto: draft to hello@lakshly.com when no endpoint is set", async () => {
    const r = await send(p, "", "");
    expect(r.mode).toBe("email");
    if (r.mode !== "email") return;
    expect(r.href.startsWith("mailto:hello@lakshly.com?subject=")).toBe(true);
    const body = decodeURIComponent(r.href.split("&body=")[1]);
    expect(body).toContain("So I can plan cash & stuff");
    expect(decodeURIComponent(r.href.split("subject=")[1].split("&")[0])).toBe("[Lakshly Idea · Premium] Remind me before SIP dates");
  });
  it("keeps mailto bodies short and decodable", () => {
    const long = mailtoHref({ ...p, detail: "é".repeat(1000) });
    expect(() => decodeURIComponent(long.split("&body=")[1])).not.toThrow();
  });
  it("POSTs the payload plus honeypot to the relay and returns id + secret", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "LK-ABC123", secret: "s".repeat(32) }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await send(p, "", "https://feedback.example");
    expect(r).toEqual({ mode: "relay", id: "LK-ABC123", secret: "s".repeat(32) });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://feedback.example/v1/feedback");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(init.body as string)).toEqual({ ...p, website: "" });
  });
  it("surfaces rate limits and failures as SendError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    await expect(send(p, "", "https://feedback.example")).rejects.toThrow(SendError);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(send(p, "", "https://feedback.example")).rejects.toThrow("network");
  });
  it("fetches status, treating 404 as not visible yet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })));
    expect(await fetchStatus("LK-ABC123", "s".repeat(32), "https://feedback.example")).toBeNull();
    expect(await fetchStatus("LK-ABC123", "s".repeat(32), "")).toBeNull();
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

describe("roadmap JSON", () => {
  it("has unique ids, valid statuses and raw counts", () => {
    expect(new Set(ROADMAP.map((r) => r.id)).size).toBe(ROADMAP.length);
    for (const r of ROADMAP) expect(["planned", "in_progress", "shipped", "not_now"]).toContain(r.status);
    expect(displayVotes(ROADMAP[0], true)).toBe(ROADMAP[0].votes + 1);
  });
  it("demo requests link only to real roadmap items", () => {
    const ids = new Set(ROADMAP.map((r) => r.id));
    for (const m of DEMO_MINE) if (m.roadmapId) expect(ids.has(m.roadmapId)).toBe(true);
  });
});
