// Lakshly feedback relay (Cloudflare Worker). Stateless: stores nothing itself and logs no message content.
//   POST /v1/feedback          -> validates, opens an issue in the private repo, returns { id, secret }
//   GET  /v1/feedback/:id?s=…  -> { id, status, replies } for the holder of the secret
//   GET  /health
import { createIssue, lookup } from "./github";
import { LIMITS, validate } from "./validate";

export interface RateLimit { limit(opts: { key: string }): Promise<{ success: boolean }> }
export interface Env {
  GITHUB_TOKEN: string;            // secret: fine-grained token, only the feedback repo, Issues read & write
  FEEDBACK_REPO: string;           // var: "ovhirup/lakshly-feedback"
  ALLOWED_ORIGINS: string;         // var: comma-separated exact origins
  IP_SALT?: string;                // secret: salts the hashed rate-limit key (raw IPs are never stored)
  SUBMIT_LIMIT?: RateLimit;        // per client, per minute
  GLOBAL_LIMIT?: RateLimit;        // whole Worker, per minute
  STATUS_LIMIT?: RateLimit;        // status lookups per client, per minute
}

const ID_RE = /^LK-[0-9A-HJKMNP-TV-Z]{6}$/;
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return `LK-${Array.from(b, (x) => B32[x % 32]).join("")}`;
}
export function newSecret(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, "0")).join("");
}

function origins(env: Env) { return (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean); }
function cors(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !origins(env).includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin, Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Lakshly-Client",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });

async function allowed(limiter: RateLimit | undefined, key: string) { return limiter ? (await limiter.limit({ key })).success : true; }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin");
    const h = cors(origin, env);
    // Browsers must come from an allowed origin. Native apps (no Origin) must identify themselves.
    if (origin && !h["Access-Control-Allow-Origin"]) return json({ error: "origin_not_allowed" }, 403);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (url.pathname === "/health" && req.method === "GET") return json({ ok: true }, 200, h);
    if (!origin && !req.headers.get("X-Lakshly-Client")) return json({ error: "client_header_required" }, 400, h);

    const ipKey = await sha256(`${env.IP_SALT ?? ""}:${req.headers.get("CF-Connecting-IP") ?? "unknown"}`);

    if (url.pathname === "/v1/feedback" && req.method === "POST") {
      if (!(req.headers.get("Content-Type") ?? "").toLowerCase().startsWith("application/json")) return json({ error: "json_required" }, 415, h);
      const len = Number(req.headers.get("Content-Length") ?? "0");
      if (len > LIMITS.bodyBytes) return json({ error: "too_large" }, 413, h);
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return json({ error: "too_large" }, 413, h);
      if (!(await allowed(env.SUBMIT_LIMIT, `submit:${ipKey}`)) || !(await allowed(env.GLOBAL_LIMIT, "global"))) {
        return json({ error: "rate_limited" }, 429, { ...h, "Retry-After": "60" });
      }
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400, h); }
      const v = validate(parsed);
      if (!v.ok) return json({ error: v.error }, 422, h);
      const id = newId();
      const secret = newSecret();
      // Honeypot: look successful to the bot, create nothing.
      if (v.honeypot) return json({ id, secret }, 201, h);
      try {
        await createIssue(env, v.value, id, await sha256(secret));
      } catch (e) {
        console.error("create_failed", (e as Error).message); // no user content in logs
        return json({ error: "upstream_unavailable" }, 502, h);
      }
      return json({ id, secret }, 201, h);
    }

    const m = url.pathname.match(/^\/v1\/feedback\/([^/]+)$/);
    if (m && req.method === "GET") {
      const id = decodeURIComponent(m[1]);
      const secret = url.searchParams.get("s") ?? "";
      if (!ID_RE.test(id) || secret.length < 20 || secret.length > 64) return json({ error: "not_found" }, 404, h);
      if (!(await allowed(env.STATUS_LIMIT, `status:${ipKey}`))) return json({ error: "rate_limited" }, 429, { ...h, "Retry-After": "60" });
      try {
        const r = await lookup(env, id, await sha256(secret));
        if (!r) return json({ error: "not_found" }, 404, h);
        return json({ id, ...r }, 200, h);
      } catch (e) {
        console.error("lookup_failed", (e as Error).message);
        return json({ error: "upstream_unavailable" }, 502, h);
      }
    }
    return json({ error: "not_found" }, 404, h);
  },
};
