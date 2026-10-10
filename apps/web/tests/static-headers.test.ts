// Pages _headers/_redirects: CSP keeps GSI, Gmail API and the feedback relay working; HSTS on; /privacy redirects.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const pub = (f: string) => readFileSync(join(__dirname, "..", "public", f), "utf8");

describe("static headers", () => {
  const h = pub("_headers");
  const csp = h.match(/Content-Security-Policy: (.*)/)![1];
  const dir = (name: string) => csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name} `)) ?? "";
  it("HSTS and framing protection", () => {
    expect(h).toMatch(/Strict-Transport-Security: max-age=31536000/);
    expect(dir("frame-ancestors")).toBe("frame-ancestors 'none'");
  });
  it("allows Google Identity Services, Gmail API and the feedback endpoint", () => {
    expect(dir("script-src")).toContain("https://accounts.google.com/gsi/client");
    expect(dir("style-src")).toContain("https://accounts.google.com/gsi/style");
    expect(dir("frame-src")).toContain("https://accounts.google.com/gsi/");
    for (const u of ["https://feedback.lakshly.com", "https://gmail.googleapis.com", "https://oauth2.googleapis.com", "https://accounts.google.com/gsi/"]) expect(dir("connect-src")).toContain(u);
    expect(dir("worker-src")).toContain("'self'");
    expect(h).toMatch(/Cross-Origin-Opener-Policy: same-origin-allow-popups/);
  });
  it("/privacy goes to the main site's policy", () => {
    expect(pub("_redirects")).toMatch(/^\/privacy https:\/\/lakshly\.com\/privacy\.html 301$/m);
  });
});
