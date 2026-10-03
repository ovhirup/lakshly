import { describe, expect, it } from "vitest";
import { can, FEATURES } from "../lib/entitlements";
import { buildGitHubIssue, issueEnvironment, issueKind, strictEncode, webPlatform, type IssueEnvironment, type IssueKind } from "../lib/github-issue";

const GOLDEN_URL = "https://github.com/ovhirup/lakshly/issues/new?template=feature_request.yml&title=%5BRequest%5D%20Split%20bills%20with%20friends&body=%23%23%23%20Feature%20request%0A%0ALet%20me%20split%20a%20bill%20%26%20track%20who%20paid.%0AThanks%21%20%231%20%2B%2050%25%20%3D%20%F0%9F%99%8F%0A%0A%23%23%23%20Environment%0A%0A-%20App%3A%20Lakshly%200.1.0%20%281%29%0A-%20Platform%3A%20iOS%2026.2%0A-%20Theme%3A%20Lakshmi%20%C2%B7%20Dark%0A-%20Tier%3A%20Premium%0A%0A_Opened%20from%20the%20Lakshly%20app.%20Nothing%20was%20sent%20automatically.%20Please%20don%27t%20add%20account%20numbers%2C%20statements%20or%20other%20personal%20data._&labels=feature-request%2Cpriority&problem=Let%20me%20split%20a%20bill%20%26%20track%20who%20paid.%0AThanks%21%20%231%20%2B%2050%25%20%3D%20%F0%9F%99%8F&environment=-%20App%3A%20Lakshly%200.1.0%20%281%29%0A-%20Platform%3A%20iOS%2026.2%0A-%20Theme%3A%20Lakshmi%20%C2%B7%20Dark%0A-%20Tier%3A%20Premium";
const TEXT = "Let me split a bill & track who paid.\nThanks! #1 + 50% = 🙏";
const ENVIRONMENT = "- App: Lakshly 0.1.0 (1)\n- Platform: iOS 26.2\n- Theme: Lakshmi · Dark\n- Tier: Premium";
const environment: IssueEnvironment = { appVersion: "0.1.0 (1)", platform: "iOS 26.2", themeName: "Lakshmi", appearance: "Dark", plan: "premium" };
const draft = { kind: "request" as const, title: "Split bills with friends", text: TEXT, environment };

describe("shared GitHub issue contract", () => {
  it("matches the literal golden URL (shared with the Apple tests) byte for byte", () => {
    expect(buildGitHubIssue(draft).url).toBe(GOLDEN_URL);
  });

  it("round-trips all query values, preserving their required order and full body", () => {
    const issue = buildGitHubIssue(draft);
    const body = ["### Feature request", "", TEXT, "", "### Environment", "", ENVIRONMENT, "",
      "_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._"].join("\n");
    expect([...new URL(issue.url).searchParams]).toEqual([
      ["template", "feature_request.yml"], ["title", "[Request] Split bills with friends"], ["body", body],
      ["labels", "feature-request,priority"], ["problem", TEXT], ["environment", ENVIRONMENT],
    ]);
    expect(issue).toMatchObject({ title: "[Request] Split bills with friends", labels: ["feature-request", "priority"], text: TEXT, body });
  });

  it("never adds priority on Free", () => {
    for (const kind of ["feedback", "request", "bug"] as const) {
      const issue = buildGitHubIssue({ ...draft, kind, environment: { ...environment, plan: "free" } });
      expect(issue.labels).toHaveLength(1);
      expect(issue.url).not.toContain("priority");
      expect(new URL(issue.url).searchParams.get("environment")).toContain("- Tier: Free");
    }
  });

  it.each([
    ["feedback", "feedback.yml", "feedback", "### Feedback", "[Feedback]", "details"],
    ["request", "feature_request.yml", "feature-request", "### Feature request", "[Request]", "problem"],
    ["bug", "bug_report.yml", "bug", "### Bug report", "[Bug]", "what"],
  ] as const)("uses the contract fields for %s", (kind, template, label, heading, prefix, field) => {
    const issue = buildGitHubIssue({ ...draft, kind });
    const params = new URL(issue.url).searchParams;
    expect(params.get("template")).toBe(template);
    expect(issue.title).toBe(`${prefix} ${draft.title}`);
    expect(issue.body.startsWith(`${heading}\n\n`)).toBe(true);
    expect(issue.labels).toEqual([label, "priority"]);
    expect([...params.keys()]).toEqual(["template", "title", "body", "labels", field, "environment"]);
    expect(params.get(field)).toBe(TEXT);
  });

  it("percent-encodes every reserved byte, spaces and Unicode with uppercase hex", () => {
    const text = "AZaz09-._~ !'()*&#+%=/?;:@,$[]\né ₹ 🙏";
    expect(strictEncode(text)).toBe("AZaz09-._~%20%21%27%28%29%2A%26%23%2B%25%3D%2F%3F%3B%3A%40%2C%24%5B%5D%0A%C3%A9%20%E2%82%B9%20%F0%9F%99%8F");
    const issue = buildGitHubIssue({ ...draft, title: text, text });
    const params = new URL(issue.url).searchParams;
    expect(params.get("title")).toBe(`[Request] ${text}`);
    expect(params.get("problem")).toBe(text);
    expect(issue.url).not.toContain("+");
  });

  it("trims and clips titles to 120 characters and message fallbacks to 60", () => {
    expect(buildGitHubIssue({ ...draft, title: `  ${"x".repeat(121)}  ` }).title).toBe(`[Request] ${"x".repeat(120)}`);
    expect(buildGitHubIssue({ ...draft, title: " \n", text: `\n  \n ${"y".repeat(61)}\nsecond line ` }).title).toBe(`[Request] ${"y".repeat(60)}`);
  });

  it("clips text to 2000 characters plus an ellipsis only when clipped", () => {
    for (const length of [1999, 2000, 2001]) {
      const issue = buildGitHubIssue({ ...draft, text: `  ${"x".repeat(length)}  ` });
      const expected = "x".repeat(Math.min(length, 2000)) + (length > 2000 ? "…" : "");
      expect(issue.text).toBe(expected);
      expect(new URL(issue.url).searchParams.get("problem")).toBe(expected);
      expect(issue.body).toContain(`\n\n${expected}\n\n`);
    }
  });

  it("clips on Unicode boundaries", () => {
    const issue = buildGitHubIssue({ ...draft, title: "🙏".repeat(121), text: "🙏".repeat(2001) });
    expect(issue.title).toBe(`[Request] ${"🙏".repeat(120)}`);
    expect(new URL(issue.url).searchParams.get("problem")).toBe(`${"🙏".repeat(2000)}…`);
  });

  it.each([
    ["feedback", "Feedback from the app"], ["request", "Feature request from the app"], ["bug", "Bug report from the app"],
  ] as const)("uses empty fallbacks for %s", (kind, fallback) => {
    const issue = buildGitHubIssue({ ...draft, kind, title: "  \n", text: " \n \t " });
    expect(issue.title).toBe(`${{ feedback: "[Feedback]", request: "[Request]", bug: "[Bug]" }[kind]} ${fallback}`);
    expect(issue.text).toBe("_Write your message here._");
  });

  it("includes exactly four environment lines even with line breaks in metadata", () => {
    const issue = buildGitHubIssue({ ...draft, environment: { ...environment, appVersion: "0.2.0\n(web)", themeName: "Lakshmi\r\nGold" } });
    expect(new URL(issue.url).searchParams.get("environment")?.split("\n")).toEqual([
      "- App: Lakshly 0.2.0 (web)", "- Platform: iOS 26.2", "- Theme: Lakshmi Gold · Dark", "- Tier: Premium",
    ]);
  });
});

describe("entitlements", () => {
  it("requires Premium for priorityFeedback and unknown features", () => {
    expect(FEATURES.priorityFeedback.minTier).toBe("premium");
    for (const feature of ["priorityFeedback", "unknown", "toString", "constructor", "__proto__"]) {
      expect(can(feature, "free")).toBe(false);
      expect(can(feature, "premium")).toBe(true);
    }
  });
});

describe("web environment", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Version/18.0 Mobile Safari/604.1", "iOS"],
    ["Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)", "iOS"],
    ["Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) Version/18.0 Safari/604.1", "iPadOS"],
    ["Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/131.0.0.0", "Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) Chrome/131.0.0.0", "macOS"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0", "Windows"],
    ["Mozilla/5.0 (X11; CrOS x86_64 16093.68.0) Chrome/131.0.0.0", "ChromeOS"],
    ["Mozilla/5.0 (X11; Linux x86_64) Firefox/132.0", "Linux"],
  ])("reduces %s to the OS family %s", (userAgent, family) => {
    expect(webPlatform(userAgent)).toBe(`Web · ${family}`);
  });

  it.each(["", "unknown", "Mozilla/5.0 (X11; FreeBSD amd64) Firefox/132.0", "Safari/604.1"])("uses Web for unknown OS: %s", (userAgent) => {
    expect(webPlatform(userAgent)).toBe("Web");
  });

  it.each(["light", "dark"] as const)("uses the supplied theme and resolved %s appearance", (appearance) => {
    const env = issueEnvironment({ appVersion: "0.2.0 (web)", themeName: "Monochrome Gold", appearance, plan: "free", userAgent: "Windows NT 10.0 Chrome/131" });
    const issue = buildGitHubIssue({ ...draft, environment: env });
    expect(new URL(issue.url).searchParams.get("environment")?.split("\n")).toEqual([
      "- App: Lakshly 0.2.0 (web)", "- Platform: Web · Windows", `- Theme: Monochrome Gold · ${appearance === "light" ? "Light" : "Dark"}`, "- Tier: Free",
    ]);
  });
});

describe("page kind mapping", () => {
  it.each([["idea", "request"], ["bug", "bug"], ["praise", "feedback"]] as const)("maps %s to %s", (kind, expected: IssueKind) => {
    expect(issueKind(kind)).toBe(expected);
  });
});
