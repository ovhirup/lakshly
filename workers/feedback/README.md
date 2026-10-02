# Lakshly feedback relay (`workers/feedback`)

This is a stateless Cloudflare Worker. It turns in-app feedback into issues in a **private** GitHub repo
(default `ovhirup/lakshly-feedback`). It stores nothing itself and never logs message content.

| Route | What it does |
|---|---|
| `POST /v1/feedback` | Validates the JSON, opens an issue, returns `{ id: "LK-XXXXXX", secret }` (201) |
| `GET /v1/feedback/:id?s=<secret>` | Returns `{ id, status, replies }` for whoever holds the secret (the app that sent it) |
| `GET /health` | `{ ok: true }` |

**Guards**
- **CORS:** exact origins from `ALLOWED_ORIGINS` only. Other browser origins get 403. Native apps send no `Origin` and must send `X-Lakshly-Client`.
- **Input:**
  - JSON only, body ≤ 8 KB.
  - Strict allow-list of typed fields: `kind`, `title` (3–90), `detail` (≤1000), `area`, `plan`, optional `credit` (≤40), `replyEmail` (≤120, validated), and `diagnostics` (only when the user opted in).
  - Anything else is dropped. Control and bidi characters are stripped.
- **Honeypot:** if the hidden `website` field is filled, the Worker answers 201 and creates nothing.
- **Rate limits** (Workers Rate Limiting binding, per Cloudflare location): 5 submissions/min per client, 60/min overall, and 20 status checks/min per client. The client key is a salted SHA-256 of the IP; raw IPs are never stored or used as the key.
- **GitHub-safe issue body:**
  - User text is fenced, so Markdown, HTML and images never render.
  - `@mentions` and `#refs` are defanged.
  - Labels: `kind:*`, `area:*`, `plan:*`, plus `priority` for Premium.
  - Only the SHA-256 of the secret is embedded (in an HTML comment).
- **Replies and status:**
  - Comments that start with `/reply ` from the repo OWNER/MEMBER are returned to the app as "Abhirup from Lakshly".
  - Status comes from the `status:planned|in-progress|shipped|not-now` labels; no label means "Received".
  - Other comments stay internal.

```sh
npm ci
npm test           # vitest, GitHub API mocked
npm run typecheck
npm run check      # wrangler deploy --dry-run (no login, nothing deployed). Wrangler needs Node >= 22.
```

## One-time setup (Abhirup does or approves each step; nothing here has been done yet)

**1. Private repo** (Abhirup approves creating it):
```sh
gh repo create ovhirup/lakshly-feedback --private --description "Lakshly in-app feedback (private triage)"
for l in kind:idea kind:bug kind:praise plan:free plan:premium priority \
         status:planned status:in-progress status:shipped status:not-now; do
  gh label create "$l" -R ovhirup/lakshly-feedback --force
done
for a in overview spend budget debt credit investments sips rewards history import design other; do
  gh label create "area:$a" -R ovhirup/lakshly-feedback --force --color BFD4F2
done
```
To use a different repo, change `FEEDBACK_REPO` in `wrangler.jsonc`.

**2. Fine-grained GitHub token.** Abhirup creates it at github.com → Settings → Developer settings → Fine-grained tokens:
- Resource owner: `ovhirup`
- Repository access: **Only select repositories → `ovhirup/lakshly-feedback`**
- Repository permissions: **Issues: Read and write** (Metadata: Read is added automatically). Nothing else.
- Expiration: 1 year. Set a calendar reminder to rotate it.

**3. Cloudflare** (account on ovhirup@gmail.com; the `lakshly.com` zone is already there):
```sh
cd workers/feedback
npx wrangler login                    # browser OAuth, Abhirup signs in
npx wrangler secret put GITHUB_TOKEN  # paste the fine-grained token (never commit it)
npx wrangler secret put IP_SALT       # any long random string, e.g. `openssl rand -hex 32`
npm run deploy                        # creates lakshly-feedback.<subdomain>.workers.dev + feedback.lakshly.com
curl https://feedback.lakshly.com/health   # -> {"ok":true}
```
- `routes` in `wrangler.jsonc` makes `feedback.lakshly.com` a Worker custom domain. Cloudflare creates the DNS record and the certificate.
- The `namespace_id`s (71001–71003) only need to be unique within the account.

**4. Allowed origins.** Edit `ALLOWED_ORIGINS` in `wrangler.jsonc` to the real web-app origin(s). The default is `https://lakshly.com`, `https://www.lakshly.com` and `https://app.lakshly.com`. For local testing, run `wrangler dev` with a `.dev.vars` file (see `.dev.vars.example`), and temporarily add `http://localhost:3000` locally only.

**5. Point the web app at it.** Build with `NEXT_PUBLIC_FEEDBACK_ENDPOINT=https://feedback.lakshly.com`. If it's unset, the app falls back to a prefilled `mailto:hello@lakshly.com` draft.

**6. Replying.**
- Comment `/reply <text>` on the issue; the app shows it signed "Abhirup from Lakshly" on the user's next "Check for updates".
- If the user left an email, also reply from hello@lakshly.com.
- Set a `status:*` label as the request moves.
- Premium issues carry `priority`. Target: a human reply within 1 business day (IST).

## Costs
$0 at launch volume. Workers Free allows 100k requests/day; GitHub Issues in a private repo are free.

## Known limits
- GitHub search can lag about a minute after an issue is created. Until then a status check returns "not visible yet", and the app shows "Received".
- The GitHub Search API allows about 30 requests/min per token, which is why status checks are user-initiated and rate-limited.
- The Premium plan is reported by the client (it only affects the `priority` label). Verifying StoreKit / web entitlements comes later.
