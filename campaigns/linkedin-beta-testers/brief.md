# LinkedIn beta tester invite — brief
Slug: linkedin-beta-testers · Owner: Abhirup Banerjee (@ovhirup) · Created: 2026-10-05

## Goal (one measurable objective)
Visits to https://beta.lakshly.com from this campaign, from unknown to [REAL NUMBER — you set the target] by [YYYY-MM-DD — you set the close date].

The drafts do not invent a tester count. Nothing here is a traction claim. The X posts use the same URL and the same goal. They do not add a second objective.

The waitlist post (`li-18-waitlist`) is a later destination, https://lakshly.com/. It does not replace this goal.

## Audience
- Who: people who want to look at their own money and do not want to hand a bank login to an app first. This is the product's intended reader, not a surveyed segment.
- Where they read: LinkedIn on weekday mornings, and X in the evening.
- What they already believe: a finance app will ask for access before it shows anything useful.

## Offer / CTA
- Action: open the tester site and try the sample statement. A real bank file is optional.
- Destination for the beta invite and the sneak peeks: https://beta.lakshly.com/
- Later action, not the first post: join the public waitlist for launch news. Destination: https://lakshly.com/
- Soft launch: not an action yet. The day is unset.

## Verified facts and proof
| # | Fact | Source / provenance | Confirmed by user? |
|---|------|---------------------|--------------------|
| F1 | The tester site is live and titled Lakshly Beta. | https://beta.lakshly.com/ fetched 2026-10-05; `apps/web/lib/edition.ts` | yes |
| F2 | The public site stays on Free until payments exist. | `apps/web` public edition; README and profile copy | yes |
| F3 | A sample statement on Import uses fake rows: a salary, a food order and a grocery shop. Review runs in the browser. | `apps/web/lib/import/sample-statement.ts`; Import page copy | yes |
| F4 | Statement files are opened in the browser tab. Nothing is uploaded. A statement password is used once and is not stored. Imported data is encrypted in the browser. | `apps/web/app/import/page.tsx` | yes |
| F5 | Hide amounts masks figures. Delete on Profile removes imported statements and the encryption key from that browser. The demo remains. | Profile and privacy UI; e2e on 2026-10-05 | yes |
| F6 | Lakshly is not a bank, broker or investment adviser and does not provide financial advice. All numbers in the repo are synthetic. | `README.md` | yes |
| F7 | The app code is AGPL-3.0-or-later. | `README.md`, `LICENSE` | yes |
| F8 | Payments are not live. | Profile page copy | yes |
| F9 | The iPhone app is coming soon. No ship date. It is not on the App Store yet. | Owner, 2026-10-05: iPhone is coming soon, no date. `README.md` status line: early development, Phase 1 web MVP, "Not yet on the App Store". `site/index.html` eyebrow: "Coming soon to iPhone, Mac & web". `apps/apple/README.md` describes a SwiftUI iOS app in the repo (`Lakshly-iOS`). That file is development, not a public release. Posts may say coming soon and not on the App Store. Posts may not list tabs, widgets, themes, or prices. | yes |
| F10 | The Mac app is coming soon. No ship date. It is not on the App Store yet. | Owner, 2026-10-05: Mac is coming soon, no date. Same README status line and site eyebrow as F9. `apps/apple/README.md` has a `Lakshly-macOS` scheme. `docs/PLAN.md` phase 3 mentions a Mac App Store launch with a duration estimate. That estimate is not a campaign date and posts must not use it. Posts may not list the menu bar, widgets, or prices. | yes |
| F11 | Apple Duo is coming soon. No ship date. No feature list in posts. The repo never uses the words "Apple Duo". The Duo that is written down is iPhone Duo: a design preview of two pills, and a spec, not a device you can buy. | Owner, 2026-10-05: "Apple Duo" is coming soon, no date, and posts must not invent Duo features. `apps/web/lib/island-storyboard.ts` motion `duo`: "Design preview of two pills. iPhone Duo is a spec, not a device you can buy." `site/index.html`: the same sentence. The two-pill preview is recorded here so it is not invented later. It is not copied into posts. | yes |
| F12 | https://lakshly.com/ is the public landing page and waitlist. It is not the beta. The form is for launch and product updates. | `site/README.md` (GitHub Pages at https://lakshly.com, `site/CNAME`). `site/index.html` waitlist section and consent line. `site/privacy.html`. Distinct from https://beta.lakshly.com/ (F1). | yes |
| F13 | The soft-launch day is unset. When a day exists, the post may say the web beta opens to a wider group. That wider opening is not dated and is not claimed as happening. | Owner, 2026-10-05. No date in the repo was adopted for this post. | yes |
| F14 | Launch copy may say money sits in separate bank, card and fund apps, and that other apps want a bank login. This is the owner's framing, not a survey and not a count. | Owner, 2026-10-05, series extension. | yes |

User, 2026-10-05: F1–F8 were the allowed set for the invite drafts. The series extension the same day adds F9–F14. Drafts in this folder may use F1–F14 only. Confirmed means that list is the allowed set. It is not a new code audit.

The first posts may join F9, F10 and F11 into one line: iPhone, Mac and Apple Duo versions are coming soon. That line adds no date and no feature list.

UTM note for the waitlist: `site/config.js` copies `utm_source`, `utm_medium` and `utm_campaign` into the Buttondown form. That file's comment says Buttondown stores those three on the free plan. `utm_content` is sent as `metadata__utm_content`, and metadata may not be stored on the free plan. The links stay fully tagged. Post-level attribution on the free plan is not confirmed.

UTM note for the beta: it is still not confirmed that https://beta.lakshly.com/ records tags. If it does not, count visits by the clock around each post.

## Proof slots still open
- [REAL NUMBER OR QUOTE — source?] for a tester-count target, LinkedIn followers, and any later reflection post. No post may ship with this slot empty if it depends on the number.
- [YYYY-MM-DD — Abhirup names the day] blocks `li-20-soft-launch` and `x-20-soft-launch`. The bodies do not name a date.
- Duo features are not an open slot. Do not fill them from the two-pill design preview.

## Constraints
- Voice: plain sentences. One idea per post. No résumé. No "I spent N months" story.
- Do not claim / mention: user counts, testimonials, returns, savings amounts, performance, specific funds or stocks, RBI or SEBI registration, bank partnerships, an Apple partnership, Swiggy or any merchant as a partner, employer or client names, prices as if checkout works.
- Do not name a ship date for iPhone, Mac, Apple Duo, or the soft launch.
- Do not list Apple Duo or iPhone Duo features. Do not say Apple Duo is a device you can buy.
- https://lakshly.com/ is a later post. It is not the first post and it is not the beta.
- Legal / identity topics to avoid: real account numbers, real statements, screenshots of real money.

## Timeline and budget
Series order, explicit:

1. Beta invite (existing). Proposed 2026-10-06 through 2026-10-13. Destination https://beta.lakshly.com/. LinkedIn `li-01-invite` at 10:30 IST and X `x-01-launch` at 18:30 IST, each only after you approve that post. Approving one does not approve the other.
2. Sneak peeks, on the next weekdays after that window. Dates are proposed. iPhone on 2026-10-14, Mac on 2026-10-15, Apple Duo on 2026-10-16. No ship date in the copy. Each one points back to the beta invite. The link stays in the first comment or reply.
3. Waitlist site, proposed 2026-10-19. Destination https://lakshly.com/. For people who want launch news and are not ready for the beta.
4. Soft launch. Date unset. Blocked until Abhirup names the day. The draft describes a wider web beta and does not name a date.

- Ad spend: ₹0. Reply time per day: [minutes — you set this]. First hour after each post is a proposed reply block only. It is not staffed until you say so.
- Nothing in this folder is posted, scheduled, or approved.

## Channels (1–3)
| Channel | Why this audience is here | Job (launch / depth / community) |
|---------|---------------------------|----------------------------------|
| LinkedIn | Weekday posts can reach people who will actually try a browser beta. | Launch, then explanations, then sneak peeks, then the waitlist, then a soft launch once it has a day. |
| X | People who read short posts are here in the evening, which is morning in the US. They already expect a finance app to ask for access before it shows anything. | One launch post, then short follow-ups that point back to the pin. One post each, not a thread. |

Instagram and Threads are out of this campaign. They are not staffed here.

`x-16-sneak-duo` is one tight post under 280 characters, not a thread. It is still a draft. Cut it at approval if a small account should not carry it.

## Baseline
| Metric | Value | Source / date |
|--------|-------|---------------|
| Followers (LinkedIn) | unknown | not supplied |
| Followers (X) | unknown | not supplied |
| Typical post impressions | unknown | not supplied |
| beta.lakshly.com visits | unknown | not supplied |
