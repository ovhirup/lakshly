# Feedback: prefilled GitHub issue link (shared contract)

Swift (`apps/apple/Lakshly/Features/Feedback/GitHubIssueLink.swift`) and TypeScript (`apps/web/lib/github-issue.ts`) MUST produce byte-identical URLs.

Purpose: the public Lakshly app's Feedback / Requests action opens a PREFILLED GitHub new-issue page in the
user's browser. No API, no token, no network call from the app, nothing is submitted: the user reviews and
presses Submit on GitHub themselves. The URL must contain NO personal data: only the user's own typed title/text
plus app version, platform/OS, theme and tier.

Base: https://github.com/ovhirup/lakshly/issues/new

Kinds (key / template / kind label / heading / title prefix / main form field id / default title):
- feedback / feedback.yml        / feedback        / ### Feedback        / [Feedback] / details / Feedback from the app
- request  / feature_request.yml / feature-request / ### Feature request / [Request]  / problem / Feature request from the app
- bug      / bug_report.yml      / bug             / ### Bug report      / [Bug]      / what    / Bug report from the app

Title: prefix + " " + trimmed user title (max 120 chars, clipped). If the title is empty, use the first non-empty line
of the trimmed text clipped to 60 chars; if that is empty too, use the default title.
Text: trimmed user text, clipped to 2000 chars (append "…" when clipped). If empty, use "_Write your message here._"

Labels: kind label, then "priority" ONLY when the user is Premium (Apple: entitlements.can(.priorityFeedback);
web: can("priorityFeedback", plan)). Joined with "," (encoded %2C).

Environment block (exactly these 4 lines, nothing else, ever):
- App: Lakshly <version>
- Platform: <platform>
- Theme: <Theme display name> · <Light|Dark>
- Tier: <Free|Premium>

Body (lines joined with "\n"):
<heading>
<blank>
<text>
<blank>
### Environment
<blank>
<environment block, 4 lines>
<blank>
_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._

Query parameters, in this exact order:
template, title, body, labels, <main form field id>=<text>, environment=<environment block>
(GitHub ignores `body` for YAML issue forms, so the form fields are prefilled by id too.)

Encoding: UTF-8, percent-encode EVERY byte except A-Z a-z 0-9 - . _ ~ (uppercase hex; space -> %20, never "+").
Keys are plain ASCII. Join as key=value with "&".

Golden test (both platforms assert the exact same URL string, and also that decoding gives back the inputs):
kind=request, title="Split bills with friends", text="Let me split a bill & track who paid.\nThanks! #1 + 50% = 🙏",
version="0.1.0 (1)", platform="iOS 26.2", theme="Lakshmi", appearance="Dark", tier=Premium, priority=true.
Expected title: "[Request] Split bills with friends"; labels "feature-request,priority".
The expected URL string is a literal in BOTH test suites (Swift: `apps/apple/LakshlyTests/GitHubIssueLinkTests.swift`,
web: `apps/web/tests/github-issue.test.ts`).

Note: GitHub applies the `labels` query parameter only for people allowed to label issues; the issue forms' own `labels:` always apply.
