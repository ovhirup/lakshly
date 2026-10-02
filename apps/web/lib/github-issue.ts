import { can, type Plan } from "./entitlements";
import type { Kind } from "./feedback";
import type { ResolvedAppearance } from "./themes";

export type IssueKind = "feedback" | "request" | "bug";
export type IssueEnvironment = {
  appVersion: string;
  platform: string;
  themeName: string;
  appearance: "Light" | "Dark";
  plan: Plan;
};
export type GitHubIssue = { title: string; text: string; labels: string[]; body: string; url: string };

const BASE_URL = "https://github.com/ovhirup/lakshly/issues/new";
const KINDS = {
  feedback: { template: "feedback.yml", label: "feedback", heading: "### Feedback", prefix: "[Feedback]", field: "details", fallback: "Feedback from the app" },
  request: { template: "feature_request.yml", label: "feature-request", heading: "### Feature request", prefix: "[Request]", field: "problem", fallback: "Feature request from the app" },
  bug: { template: "bug_report.yml", label: "bug", heading: "### Bug report", prefix: "[Bug]", field: "what", fallback: "Bug report from the app" },
} as const;

export function issueKind(kind: Kind): IssueKind {
  return { idea: "request", bug: "bug", praise: "feedback" }[kind] as IssueKind;
}

/** UTF-8 byte encoding, with only RFC 3986 unreserved bytes left plain. */
export function strictEncode(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) =>
    (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122) || (byte >= 48 && byte <= 57) || [45, 46, 95, 126].includes(byte)
      ? String.fromCharCode(byte)
      : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
}

/** OS family only: never copy the user agent or any OS/browser version into the issue. */
export function webPlatform(userAgent: string): string {
  const families: [RegExp, string][] = [
    [/iPad/i, "iPadOS"],
    [/iPhone|iPod/i, "iOS"],
    [/Android/i, "Android"],
    [/CrOS/i, "ChromeOS"],
    [/Windows/i, "Windows"],
    [/Macintosh|Mac OS X/i, "macOS"],
    [/Linux/i, "Linux"],
  ];
  const family = families.find(([pattern]) => pattern.test(userAgent))?.[1];
  return family ? `Web · ${family}` : "Web";
}

export function issueEnvironment({ appVersion, themeName, appearance, plan, userAgent }: {
  appVersion: string; themeName: string; appearance: ResolvedAppearance; plan: Plan; userAgent: string;
}): IssueEnvironment {
  return { appVersion, platform: webPlatform(userAgent), themeName, appearance: appearance === "dark" ? "Dark" : "Light", plan };
}

// Keep clipping on Unicode code point boundaries so percent encoding never splits a surrogate pair.
const clip = (value: string, limit: number) => Array.from(value).slice(0, limit).join("");
const line = (value: string) => value.replace(/[\r\n\u2028\u2029]+/g, " ");

export function buildGitHubIssue({ kind, title, text, environment }: {
  kind: IssueKind; title: string; text: string; environment: IssueEnvironment;
}): GitHubIssue {
  const spec = KINDS[kind];
  const trimmedText = text.trim();
  const firstLine = trimmedText.split(/\r?\n/).find((value) => value.trim())?.trim() ?? "";
  const issueTitle = `${spec.prefix} ${title.trim() ? clip(title.trim(), 120) : firstLine ? clip(firstLine, 60) : spec.fallback}`;
  const issueText = trimmedText ? clip(trimmedText, 2000) + (Array.from(trimmedText).length > 2000 ? "…" : "") : "_Write your message here._";
  const labels = [spec.label, ...(can("priorityFeedback", environment.plan) ? ["priority"] : [])];
  const block = [
    `- App: Lakshly ${line(environment.appVersion)}`,
    `- Platform: ${line(environment.platform)}`,
    `- Theme: ${line(environment.themeName)} · ${environment.appearance}`,
    `- Tier: ${environment.plan === "premium" ? "Premium" : "Free"}`,
  ].join("\n");
  const body = [
    spec.heading, "", issueText, "", "### Environment", "", block, "",
    "_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._",
  ].join("\n");
  const params = [
    ["template", spec.template], ["title", issueTitle], ["body", body], ["labels", labels.join(",")],
    [spec.field, issueText], ["environment", block],
  ];
  return { title: issueTitle, text: issueText, labels, body, url: `${BASE_URL}?${params.map(([key, value]) => `${key}=${strictEncode(value)}`).join("&")}` };
}
