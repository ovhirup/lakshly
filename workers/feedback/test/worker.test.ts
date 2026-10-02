import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker, { sha256, type Env, type RateLimit } from "../src/index";
import { issueFor, statusFromLabels } from "../src/github";
import { validate } from "../src/validate";

const ORIGIN = "https://lakshly.com";
const env = (over: Partial<Env> = {}): Env => ({
  GITHUB_TOKEN: "test-token", FEEDBACK_REPO: "ovhirup/lakshly-feedback", ALLOWED_ORIGINS: "https://lakshly.com,https://app.lakshly.com", IP_SALT: "salt", ...over,
});
const good = { kind: "idea", title: "Show SIP dates on a calendar", detail: "So I can plan cash.", area: "SIPs", plan: "premium", website: "" };
const post = (body: unknown, headers: Record<string, string> = {}) => new Request("https://feedback.lakshly.com/v1/feedback", {
  method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
  headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.7", ...headers },
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ number: 1 }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("validate", () => {
  it("keeps only typed fields and drops unknown keys", () => {
    const r = validate({ ...good, balance: 123456, accounts: ["x"], credit: " Kavya R. ", replyEmail: "k@example.com" });
    expect(r.ok && r.value).toEqual({ kind: "idea", title: "Show SIP dates on a calendar", detail: "So I can plan cash.", area: "SIPs", plan: "premium", credit: "Kavya R.", replyEmail: "k@example.com" });
  });
  it("rejects bad kind, short/long title, long detail, bad email", () => {
    expect(validate({ ...good, kind: "spam" })).toEqual({ ok: false, error: "invalid_kind" });
    expect(validate({ ...good, title: "hi" })).toEqual({ ok: false, error: "title_too_short" });
    expect(validate({ ...good, title: "x".repeat(91) })).toEqual({ ok: false, error: "title_too_long" });
    expect(validate({ ...good, detail: "x".repeat(1001) })).toEqual({ ok: false, error: "detail_too_long" });
    expect(validate({ ...good, replyEmail: "not-an-email" })).toEqual({ ok: false, error: "invalid_reply_email" });
    expect(validate([1, 2])).toEqual({ ok: false, error: "invalid_body" });
  });
  it("normalises unknown area and plan, strips control chars", () => {
    const r = validate({ ...good, area: "Hacks", plan: "gold", title: "Hello\u0007 \u202Eworld  there" });
    expect(r.ok && [r.value.area, r.value.plan, r.value.title]).toEqual(["Other", "free", "Hello world there"]);
  });
  it("keeps diagnostics only as two short strings", () => {
    const r = validate({ ...good, diagnostics: { appVersion: "web 0.2.0", platform: "Web", userAgent: "secret" } });
    expect(r.ok && r.value.diagnostics).toEqual({ appVersion: "web 0.2.0", platform: "Web" });
  });
  it("flags the honeypot", () => { const r = validate({ ...good, website: "http://spam" }); expect(r.ok && r.honeypot).toBe(true); });
});

describe("issue formatting", () => {
  it("fences user text, defangs mentions, labels, embeds only the secret hash", () => {
    const v = validate({ ...good, title: "ping @octocat #12", detail: "~~~\n![x](https://evil/p.png)" });
    if (!v.ok) throw new Error("invalid");
    const i = issueFor(v.value, "LK-ABC123", "deadbeef");
    expect(i.title).toBe("[LK-ABC123] idea: ping @\u200boctocat #\u200b12");
    expect(i.labels).toEqual(["kind:idea", "area:sips", "plan:premium", "priority"]);
    expect(i.body).toContain("~~~~text\n~~~\n![x](https://evil/p.png)\n~~~~");
    expect(i.body).toContain("<!-- lakshly-secret-sha256:deadbeef -->");
  });
  it("maps status labels", () => {
    expect(statusFromLabels([{ name: "status:in-progress" }])).toBe("in_progress");
    expect(statusFromLabels(["status:shipped"])).toBe("shipped");
    expect(statusFromLabels([])).toBe("received");
  });
});

describe("POST /v1/feedback", () => {
  it("creates an issue in the private repo and returns id + secret", async () => {
    const res = await worker.fetch(post(good), env());
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const { id, secret } = (await res.json()) as { id: string; secret: string };
    expect(id).toMatch(/^LK-[0-9A-Z]{6}$/);
    expect(secret.length).toBeGreaterThanOrEqual(30);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/ovhirup/lakshly-feedback/issues");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body as string);
    expect(body.title).toBe(`[${id}] idea: Show SIP dates on a calendar`);
    expect(body.body).toContain(`lakshly-secret-sha256:${await sha256(secret)}`);
    expect(body.body).not.toContain(secret);
  });
  it("uses the configured repo", async () => {
    await worker.fetch(post(good), env({ FEEDBACK_REPO: "someone/other-feedback" }));
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.github.com/repos/someone/other-feedback/issues");
  });
  it("honeypot: pretends success, creates nothing", async () => {
    const res = await worker.fetch(post({ ...good, website: "spam" }), env());
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("blocks disallowed origins", async () => {
    const res = await worker.fetch(post(good, { Origin: "https://evil.example" }), env());
    expect(res.status).toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("native clients without Origin must send X-Lakshly-Client", async () => {
    const noOrigin = (h: Record<string, string>) => new Request("https://feedback.lakshly.com/v1/feedback", { method: "POST", body: JSON.stringify(good), headers: { "Content-Type": "application/json", ...h } });
    expect((await worker.fetch(noOrigin({}), env())).status).toBe(400);
    expect((await worker.fetch(noOrigin({ "X-Lakshly-Client": "ios" }), env())).status).toBe(201);
  });
  it("answers CORS preflight only for allowed origins", async () => {
    const pre = (o: string) => new Request("https://feedback.lakshly.com/v1/feedback", { method: "OPTIONS", headers: { Origin: o, "Access-Control-Request-Method": "POST" } });
    const ok = await worker.fetch(pre("https://app.lakshly.com"), env());
    expect(ok.status).toBe(204);
    expect(ok.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect((await worker.fetch(pre("https://lakshly.com.evil.example"), env())).status).toBe(403);
  });
  it("enforces size, JSON content-type and validation", async () => {
    expect((await worker.fetch(post({ ...good, detail: "x".repeat(9000) }), env())).status).toBe(413);
    expect((await worker.fetch(post(good, { "Content-Type": "text/plain" }), env())).status).toBe(415);
    expect((await worker.fetch(post("{not json"), env())).status).toBe(400);
    expect((await worker.fetch(post({ ...good, title: "" }), env())).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rate limits with a hashed client key (raw IP never used as key)", async () => {
    const keys: string[] = [];
    const deny: RateLimit = { limit: async ({ key }) => { keys.push(key); return { success: false }; } };
    const res = await worker.fetch(post(good), env({ SUBMIT_LIMIT: deny }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(keys[0]).toMatch(/^submit:[0-9a-f]{64}$/);
    expect(keys[0]).not.toContain("203.0.113.7");
  });
  it("returns 502 without leaking details when GitHub fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 401 }));
    const res = await worker.fetch(post(good), env());
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "upstream_unavailable" });
  });
});

describe("GET /v1/feedback/:id", () => {
  const get = (id: string, s: string) => new Request(`https://feedback.lakshly.com/v1/feedback/${id}?s=${s}`, { headers: { Origin: ORIGIN } });
  it("returns status and owner /reply comments when the secret matches", async () => {
    const secret = "s".repeat(32);
    const hash = await sha256(secret);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ number: 7, title: "[LK-ABC123] idea: x", state: "open", labels: [{ name: "status:planned" }], body: `… <!-- lakshly-secret-sha256:${hash} -->` }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { body: "/reply Thank you! Planned for the next beta.", created_at: "2026-10-05T05:00:00Z", author_association: "OWNER" },
        { body: "internal note", created_at: "2026-10-05T05:01:00Z", author_association: "OWNER" },
        { body: "/reply fake", created_at: "2026-10-05T05:02:00Z", author_association: "NONE" },
      ])));
    const res = await worker.fetch(get("LK-ABC123", secret), env());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "LK-ABC123", status: "planned", replies: [{ at: "2026-10-05T05:00:00Z", text: "Thank you! Planned for the next beta." }] });
  });
  it("404s on a wrong secret or malformed id", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ number: 7, title: "[LK-ABC123] idea: x", state: "open", labels: [], body: "<!-- lakshly-secret-sha256:other -->" }] })));
    expect((await worker.fetch(get("LK-ABC123", "w".repeat(32)), env())).status).toBe(404);
    expect((await worker.fetch(get("../../etc", "w".repeat(32)), env())).status).toBe(404);
  });
});
