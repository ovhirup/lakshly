// GitHub Issues in a PRIVATE repo, via a fine-grained token limited to that repo (Issues: read & write).
import type { Clean } from "./validate";

export type GhEnv = { GITHUB_TOKEN: string; FEEDBACK_REPO: string };
export type Status = "received" | "planned" | "in_progress" | "shipped" | "not_now";
export type Reply = { at: string; text: string };

const API = "https://api.github.com";
const headers = (env: GhEnv) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "lakshly-feedback-worker",
  "Content-Type": "application/json",
});

/** Neutralise @mentions and #refs so user text can't ping people or link issues. */
const defang = (s: string) => s.replace(/@/g, "@\u200b").replace(/#(\d)/g, "#\u200b$1");
/** Fence user text so Markdown, HTML and images in it never render (no tracking pixels, no fake UI). */
function fence(s: string) {
  const longest = Math.max(2, ...(s.match(/~+/g) ?? []).map((m) => m.length));
  const f = "~".repeat(longest + 1);
  return `${f}text\n${s || "(empty)"}\n${f}`;
}

export function issueFor(c: Clean, id: string, secretHash: string) {
  const labels = [`kind:${c.kind}`, `area:${c.area.toLowerCase()}`, `plan:${c.plan}`];
  if (c.plan === "premium") labels.push("priority");
  const rows = [
    `**Reference:** ${id}`,
    `**Kind:** ${c.kind} · **Area:** ${c.area} · **Plan (client-reported):** ${c.plan}`,
    c.plan === "premium" ? "**Reply target:** human reply within 1 business day (IST)" : "**Reply target:** best effort, ≤5 business days",
    `**Credit name (opt-in):** ${c.credit ? defang(c.credit) : "none"}`,
    `**Reply email:** ${c.replyEmail ? `${defang(c.replyEmail)} (reply from hello@lakshly.com, signed "Abhirup from Lakshly")` : "none, in-app replies only"}`,
    `**Diagnostics:** ${c.diagnostics ? `${defang(c.diagnostics.appVersion)} · ${defang(c.diagnostics.platform)}` : "not shared"}`,
    "",
    "### Details",
    fence(c.detail),
    "",
    "_To reply in the app, comment starting with `/reply `. Set status with a label: `status:planned`, `status:in-progress`, `status:shipped`, `status:not-now`._",
    `<!-- lakshly-secret-sha256:${secretHash} -->`,
  ];
  return { title: `[${id}] ${c.kind}: ${defang(c.title)}`, body: rows.join("\n"), labels };
}

export async function createIssue(env: GhEnv, c: Clean, id: string, secretHash: string): Promise<void> {
  const res = await fetch(`${API}/repos/${env.FEEDBACK_REPO}/issues`, { method: "POST", headers: headers(env), body: JSON.stringify(issueFor(c, id, secretHash)) });
  if (res.status !== 201) throw new Error(`github_create_${res.status}`);
}

type GhIssue = { number: number; title: string; body?: string | null; state: string; labels: (string | { name?: string })[] };
type GhComment = { body?: string | null; created_at: string; author_association: string };

export function statusFromLabels(labels: GhIssue["labels"]): Status {
  const names = labels.map((l) => (typeof l === "string" ? l : l.name ?? ""));
  if (names.includes("status:shipped")) return "shipped";
  if (names.includes("status:not-now")) return "not_now";
  if (names.includes("status:in-progress")) return "in_progress";
  if (names.includes("status:planned")) return "planned";
  return "received";
}

/** Looks up an issue by reference id and returns status + owner replies, only if the secret hash matches. */
export async function lookup(env: GhEnv, id: string, secretHash: string): Promise<{ status: Status; replies: Reply[] } | null> {
  const q = encodeURIComponent(`repo:${env.FEEDBACK_REPO} is:issue in:title "[${id}]"`);
  const s = await fetch(`${API}/search/issues?q=${q}&per_page=5`, { headers: headers(env) });
  if (!s.ok) throw new Error(`github_search_${s.status}`);
  const found = ((await s.json()) as { items?: GhIssue[] }).items?.find((i) => i.title.startsWith(`[${id}]`));
  if (!found || !found.body?.includes(`<!-- lakshly-secret-sha256:${secretHash} -->`)) return null;
  const c = await fetch(`${API}/repos/${env.FEEDBACK_REPO}/issues/${found.number}/comments?per_page=100`, { headers: headers(env) });
  if (!c.ok) throw new Error(`github_comments_${c.status}`);
  const replies = ((await c.json()) as GhComment[])
    .filter((x) => (x.author_association === "OWNER" || x.author_association === "MEMBER") && x.body?.startsWith("/reply "))
    .map((x) => ({ at: x.created_at, text: (x.body ?? "").slice(7).trim().slice(0, 2000) }));
  return { status: statusFromLabels(found.labels), replies };
}
