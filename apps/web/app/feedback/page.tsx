"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAppState, type Plan } from "@/components/AppState";
import { Icon } from "@/components/Icon";
import { Chips, Glass, PageHeader, PremiumBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { can } from "@/lib/entitlements";
import { buildGitHubIssue, issueEnvironment, issueKind, type GitHubIssue } from "@/lib/github-issue";
import { themeById } from "@/lib/themes";
import { APP_VERSION } from "@/lib/version";
import { IS_BETA } from "@/lib/edition";
import {
  AREAS, autoAck, displayVotes, getServerSnapshot, getSnapshot, KIND_LABEL, replyBy, reset, ROADMAP, ROADMAP_UPDATED, save,
  STATUS_LABEL, STEPS, subscribe, TEAM, type Kind, type Request, type RoadmapItem, type Status,
} from "@/lib/feedback";
import {
  buildPayload, FEEDBACK_EMAIL, FEEDBACK_ENDPOINT, fetchStatus, looksSensitive, mailtoHref, send, SendError, type Draft, type Payload,
} from "@/lib/feedback-transport";
import "./feedback.css";

// Views are hash-addressable so screens are linkable: #new, #new-bug, #new-praise, #sent, #mine, #roadmap.
type View = "hub" | "new" | "sent" | "mine" | "roadmap";
type Receipt = { id?: string; kind: Kind; premium: boolean; at: string; mode: "relay" | "email" | "github" };
const DIAG = { appVersion: APP_VERSION, platform: "Web" };

function subscribeHash(cb: () => void) { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); }
const readHash = () => window.location.hash.replace(/^#/, "");
const go = (h: string) => { window.location.hash = h; window.scrollTo({ top: 0 }); };
/** YYYY-MM-DD in IST. */
const istDate = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
/** "Thank you, Meera K." / "Thank you, @arjun!" without doubled punctuation. */
const thanks = (name = "", end = "!") => `Thank you, ${name}${/[.!?]$/.test(name) ? "" : end}`;

export default function FeedbackPage() {
  const { plan, setPlan } = useAppState();
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const view: View = hash.startsWith("new") ? "new" : hash === "sent" && receipt ? "sent" : hash === "mine" ? "mine" : hash === "roadmap" ? "roadmap" : "hub";
  const initialKind: Kind = hash === "new-bug" ? "bug" : hash === "new-praise" ? "praise" : "idea";
  const vote = (id: string) => save({ ...store, votes: store.votes.includes(id) ? store.votes.filter((v) => v !== id) : [...store.votes, id] });

  return (
    <>
      <PageHeader title="Feedback & Requests" subtitle="Lakshly is built with you. Every idea, bug and kind word is read by a human. Thank you.">
        {plan === "premium" ? <PremiumBadge /> : <span className="badge">Free</span>}
        {view !== "new" && <button className="btn primary" onClick={() => go("new")}><Icon name="sparkle" size={14} /> New request</button>}
      </PageHeader>
      <nav className="fb-subnav" aria-label="Feedback sections">
        <Chips label="Feedback sections" value={view === "new" || view === "sent" ? "hub" : view}
          onChange={(v) => go(v === "hub" ? "" : v)}
          options={[{ value: "hub", label: "Overview" }, { value: "mine", label: "My requests" }, { value: "roadmap", label: "Roadmap" }]} />
      </nav>
      {view === "hub" && <Hub mine={store.mine} votes={store.votes} plan={plan} setPlan={setPlan} vote={vote} />}
      {view === "new" && <NewRequest key={initialKind} initialKind={initialKind} plan={plan}
        onSent={(r, req) => { save({ ...store, mine: [req, ...store.mine] }); setReceipt(r); go("sent"); }} />}
      {view === "sent" && receipt && <ThankYou receipt={receipt} />}
      {view === "mine" && <Mine mine={store.mine} plan={plan} onUpdate={(mine) => save({ ...store, mine })} />}
      {view === "roadmap" && <Roadmap mine={store.mine} votes={store.votes} plan={plan} vote={vote} />}
      <p className="tiny muted fb-demo-note">
        {FEEDBACK_ENDPOINT ? "Feedback is sent securely to the Lakshly team only when you press Send." : "Feedback opens a prefilled GitHub issue. Review it and press Submit on GitHub to send it."}{" "}
        Your request history stays on this device. Sample requests and names are fictional. <button className="linklike" onClick={reset}>Reset demo</button>
      </p>
    </>
  );
}

/* ---------- Hub ---------- */
function Hub({ mine, votes, plan, setPlan, vote }: { mine: Request[]; votes: string[]; plan: Plan; setPlan: (p: Plan) => void; vote: (id: string) => void }) {
  const shippedMine = mine.find((r) => r.status === "shipped");
  const open = mine.filter((r) => r.status !== "shipped");
  const top = ROADMAP.filter((r) => r.status === "planned" || r.status === "in_progress").sort((a, b) => b.votes - a.votes).slice(0, 3);
  return (
    <>
      {shippedMine && (
        <Glass className="hero fb-shipped" as="div">
          <p className="eyebrow"><Icon name="heart" size={14} /> You asked, we shipped</p>
          <h2><strong>{shippedMine.title}</strong>{shippedMine.shippedIn ? ` is live in ${shippedMine.shippedIn}.` : " is live."}</h2>
          <p className="fb-hero-sub">{shippedMine.credit ? `${thanks(shippedMine.credit, ".")} Your idea is credited in the “Built with you” changelog. 💛` : "Thank you for making Lakshly better. 💛"}</p>
          <div className="fb-actions"><button className="btn primary" onClick={() => go("mine")}>See the thread</button></div>
        </Glass>
      )}
      <div className="grid g3">
        <ActionCard icon="sparkle" title="Suggest an idea" text="Something you'd love Lakshly to do." to="new" />
        <ActionCard icon="shield" title="Report a bug" text="Something wrong or confusing? We'll fix it." to="new-bug" />
        <ActionCard icon="heart" title="Send praise" text="Tell us what you love. It makes our day." to="new-praise" />
      </div>
      <div className="grid g3">
        {plan === "premium" ? <PremiumLine mine={mine} /> : <PremiumUpsell setPlan={setPlan} />}
        <Glass className="card span2">
          <div className="card-head"><h2>My requests</h2><button className="btn ghost small-btn" onClick={() => go("mine")}>View all</button></div>
          <div className="list">
            {open.map((r) => <MiniRow key={r.id} r={r} />)}
            {!open.length && <p className="empty muted">No open requests. Your next idea could ship next! 💛</p>}
          </div>
        </Glass>
      </div>
      <div className="grid g2">
        <Glass className="card">
          <div className="card-head"><h2>Popular on the roadmap</h2><button className="btn ghost small-btn" onClick={() => go("roadmap")}>Open roadmap</button></div>
          <div className="list">{top.map((r) => <RoadmapRow key={r.id} r={r} voted={votes.includes(r.id)} mineAsked={mine.some((m) => m.roadmapId === r.id)} vote={vote} />)}</div>
        </Glass>
        <Credits />
      </div>
    </>
  );
}

function ActionCard({ icon, title, text, to }: { icon: string; title: string; text: string; to: string }) {
  return (
    <button className="glass card fb-action" onClick={() => go(to)}>
      <span className="fb-action-icon"><Icon name={icon} size={20} /></span>
      <span><strong>{title}</strong><span className="muted">{text}</span></span>
      <span className="fb-chevron" aria-hidden="true">›</span>
    </button>
  );
}

function PremiumLine({ mine }: { mine: Request[] }) {
  const replied = mine.filter((r) => r.replies?.some((x) => x.from === "team")).length;
  return (
    <Glass className="card fb-priority">
      <div className="card-head"><h2 className="heading-icon"><Icon name="sparkle" size={16} /> Your priority line</h2><PremiumBadge small /></div>
      <ul className="fb-perks">
        <li><strong>Human reply within 1 business day</strong><span>Mon–Fri, IST. Data, security or billing issues: same day.</span></li>
        <li><strong>Priority triage</strong><span>Your requests and votes are weighted first when we plan.</span></li>
        <li><strong>Early access</strong><span>Try the features you asked for before everyone else.</span></li>
      </ul>
      <div className="fb-stats"><div><strong>{mine.length}</strong><span>requests</span></div><div><strong>{replied}</strong><span>replied</span></div><div><strong>{mine.filter((r) => r.status === "shipped").length}</strong><span>shipped</span></div></div>
    </Glass>
  );
}

function PremiumUpsell({ setPlan }: { setPlan: (p: Plan) => void }) {
  return (
    <Glass className="card fb-upsell">
      <div className="gate-icon"><Icon name="lock" size={20} /></div>
      <h2>Get a priority line to the team</h2>
      <p className="muted">You can always send ideas, bugs and praise for free. Premium adds:</p>
      <ul className="fb-perks locked">
        <li><strong>Human reply within 1 business day</strong><span>Free: best effort, usually within 5 business days.</span></li>
        <li><strong>Priority triage for your requests and votes</strong></li>
        <li><strong>Early access to what you asked for</strong></li>
      </ul>
      <p className="price" data-lk-price><strong>₹119</strong>/month · or <strong>₹999</strong>/year</p>
      {IS_BETA && <button className="btn primary" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>}
      <p className="tiny muted">{IS_BETA ? "Demo only. No payment is taken in this preview." : "Payments aren’t live yet."}</p>
    </Glass>
  );
}

/* ---------- New request ---------- */
function NewRequest({ initialKind, plan, onSent }: { initialKind: Kind; plan: Plan; onSent: (r: Receipt, req: Request) => void }) {
  const { theme, resolved } = useAppState();
  const [userAgent, setUserAgent] = useState("");
  const [d, setD] = useState<Draft>({ kind: initialKind, title: "", detail: "", area: initialKind === "bug" ? "Import" : "Spend", credit: "", replyEmail: "", includeDiagnostics: false });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    // The preview needs browser metadata after hydration; SSR must use an empty user agent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserAgent(window.navigator.userAgent);
  }, []);
  const payload = useMemo(() => buildPayload(d, plan, DIAG), [d, plan]);
  const environment = issueEnvironment({ appVersion: APP_VERSION, themeName: themeById(theme).name, appearance: resolved, plan, userAgent });
  const issue = buildGitHubIssue({ kind: issueKind(d.kind), title: d.title, text: d.detail, environment });
  const priority = can("priorityFeedback", plan);
  const sensitive = looksSensitive(`${d.title} ${d.detail}`);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const copy = {
    idea: { t: "What would you love Lakshly to do?", ph: "e.g. Remind me before SIP dates", dt: "Why would it help? (optional)", dph: "I want to… so that…" },
    bug: { t: "What went wrong?", ph: "e.g. Refund shows twice after import", dt: "Steps to see it, and what you expected", dph: "1. Import… 2. Open Spend… I expected…" },
    praise: { t: "What do you love?", ph: "e.g. The Lakshmi theme is gorgeous", dt: "Tell us more (optional)", dph: "It makes me feel…" },
  }[d.kind];

  function openGitHubIssue() {
    const current = buildGitHubIssue({ kind: issueKind(d.kind), title: d.title, text: d.detail,
      environment: issueEnvironment({ appVersion: APP_VERSION, themeName: themeById(theme).name, appearance: resolved, plan, userAgent: window.navigator.userAgent }) });
    window.open(current.url, "_blank", "noopener,noreferrer");
    const now = new Date().toISOString();
    const today = istDate(new Date());
    onSent({ kind: d.kind, premium: priority, at: now, mode: "github" }, {
      id: `GITHUB-${now.replace(/\D/g, "").slice(0, 14)}`, kind: d.kind, title: current.title, detail: current.text,
      area: d.area, status: "received", premium: priority, createdAt: today, via: "github",
      replies: [{ from: "auto", at: today, text: "Opened in a new tab. Review it and press Submit on GitHub. Nothing is sent until you do." }],
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!FEEDBACK_ENDPOINT) { openGitHubIssue(); return; }
    if (payload.title.length < 3) { setErr("Please add a short title (at least 3 characters)."); titleRef.current?.focus(); return; }
    if (payload.replyEmail && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(payload.replyEmail)) { setErr("That reply email doesn't look right. Leave it blank for in-app replies."); return; }
    setErr(null); setSendErr(null); setSending(true);
    try {
      const sent = await send(payload, hpRef.current?.value ?? "");
      const now = new Date().toISOString();
      const today = istDate(new Date());
      const premium = plan === "premium";
      const base: Request = { id: "", kind: d.kind, title: payload.title, detail: payload.detail, area: d.area, status: "received", premium, createdAt: today, credit: payload.credit };
      if (sent.mode === "relay") {
        onSent({ id: sent.id, kind: d.kind, premium, at: now, mode: "relay" }, { ...base, id: sent.id, secret: sent.secret, via: "relay", replies: [autoAck(today, premium)] });
      } else {
        window.location.href = sent.href; // opens the user's email app with the draft
        onSent({ kind: d.kind, premium, at: now, mode: "email" }, { ...base, id: `EMAIL-${now.replace(/\D/g, "").slice(0, 14)}`, via: "email",
          replies: [{ from: "auto", at: today, text: `Drafted in your email app. Once you press Send, ${TEAM} replies from ${FEEDBACK_EMAIL}.` }] });
      }
    } catch (x) {
      setSendErr(x instanceof SendError && x.message === "rate_limited" ? "You're sending a lot right now. Please try again in a minute." : "We couldn't send that just now.");
    } finally { setSending(false); }
  }

  const preview = FEEDBACK_ENDPOINT ? <PayloadPreview payload={payload} /> : <IssuePreview issue={issue} />;
  return (
    <div className="grid g3">
      <Glass className="card span2">
        <div className="card-head"><h2>New {KIND_LABEL[d.kind].toLowerCase()}</h2>
          <Chips label="Type" value={d.kind} onChange={(k) => set("kind", k)} options={(["idea", "bug", "praise"] as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} /></div>
        <form className="fb-form" onSubmit={submit} noValidate>
          <label className="field">{copy.t}
            <input ref={titleRef} type="text" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder={copy.ph} maxLength={FEEDBACK_ENDPOINT ? 90 : 120} aria-invalid={!!err} />
          </label>
          {err && <p className="fb-err" role="alert">{err}</p>}
          <label className="field">{copy.dt}
            <textarea rows={4} value={d.detail} onChange={(e) => set("detail", e.target.value)} placeholder={copy.dph} maxLength={FEEDBACK_ENDPOINT ? 1000 : 2000} />
          </label>
          {sensitive && <p className="fb-warn" role="status"><Icon name="shield" size={14} /> That looks like an account, card or phone number, or a PAN/IFSC. Please remove it. We never need your financial details.</p>}
          {FEEDBACK_ENDPOINT && <div className="fb-two">
            <label className="field">Area
              <select value={d.area} onChange={(e) => set("area", e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <label className="field">Credit me in “Built with you” as <span className="muted">(optional)</span>
              <input type="text" value={d.credit} onChange={(e) => set("credit", e.target.value)} placeholder="First name or @handle" maxLength={40} />
            </label>
          </div>}
          {FEEDBACK_ENDPOINT && (
            <label className="field">Email for replies <span className="muted">(optional)</span>
              <input type="email" inputMode="email" autoComplete="email" value={d.replyEmail} onChange={(e) => set("replyEmail", e.target.value)} placeholder="Leave blank to get replies in the app only" maxLength={120} />
            </label>
          )}
          {FEEDBACK_ENDPOINT && <label className="fb-check"><input type="checkbox" checked={d.includeDiagnostics} onChange={(e) => set("includeDiagnostics", e.target.checked)} />
            <span>Include app version and platform <span className="muted">(off by default; helps with bugs; no financial data)</span></span></label>}
          {/* Honeypot for bots: hidden from people and assistive tech. */}
          <input ref={hpRef} className="fb-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" defaultValue="" />
          <div className="fb-preview-inline">{preview}</div>
          {sendErr && <p className="fb-err" role="alert">{sendErr} <a href={mailtoHref(payload)}>Email it to {FEEDBACK_EMAIL} instead</a>.</p>}
          <div className="fb-send">
            <button className="btn primary" type="submit" disabled={sending}>{sending ? "Sending…" : FEEDBACK_ENDPOINT ? "Send with thanks" : "Open GitHub issue"}</button>
            {priority ? <span className="badge small">Priority label</span> : <span className="tiny muted">Premium requests get the priority label</span>}
          </div>
          {FEEDBACK_ENDPOINT ? <>
            <button className="linklike tiny" type="button" disabled={sending} onClick={openGitHubIssue}>Open on GitHub instead</button>
            <IssuePreview issue={issue} />
          </> : <a className="linklike tiny" href={mailtoHref(payload)}>Prefer email?</a>}
        </form>
      </Glass>
      <Glass className="card fb-preview fb-preview-side">{preview}</Glass>
    </div>
  );
}

function PayloadPreview({ payload }: { payload: Payload }) {
  return (
    <div className="fb-preview-body">
      <h2 className="heading-icon"><Icon name="shield" size={16} /> Exactly what will be sent</h2>
      <p className="muted tiny">Your finances never leave this device. Only what you type goes to {FEEDBACK_ENDPOINT ? "the Lakshly team" : FEEDBACK_EMAIL}, and only when you press {FEEDBACK_ENDPOINT ? "Send" : "Send in your email app"}.</p>
      <dl className="fb-payload">
        {Object.entries(payload).map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{typeof v === "object" ? Object.values(v).join(" · ") : String(v) || "—"}</dd></div>
        ))}
      </dl>
      <p className="tiny muted">Never sent: transactions, balances, accounts, statements, categories or anything in your encrypted vault.</p>
    </div>
  );
}

function IssuePreview({ issue }: { issue: GitHubIssue }) {
  return (
    <div className="fb-preview-body">
      <h2 className="heading-icon"><Icon name="shield" size={16} /> Exactly what will be sent{FEEDBACK_ENDPOINT ? " on GitHub" : ""}</h2>
      <p className="muted tiny">GitHub opens with this draft. Review it and press Submit on GitHub. Nothing is sent until you do. Submitted issues are public.</p>
      <dl className="fb-payload">
        <div><dt>Title</dt><dd>{issue.title}</dd></div>
        <div><dt>Labels</dt><dd>{issue.labels.join(",")}</dd></div>
        <div><dt>Body</dt><dd>{issue.body}</dd></div>
      </dl>
      <p className="tiny muted">Only your title, message, app version, OS family, theme, appearance and plan are included. Never add account numbers, statements or other personal data.</p>
    </div>
  );
}

/* ---------- Thank-you ---------- */
function ThankYou({ receipt }: { receipt: Receipt }) {
  if (receipt.mode === "github") return (
    <Glass className="card fb-thanks" as="div">
      <div className="fb-heart" aria-hidden="true"><Icon name="heart" size={34} /></div>
      <h2>Thank you for helping Lakshly 💛</h2>
      <p className="muted">Opened in a new tab. Review it and press Submit on GitHub. Nothing is sent until you do.</p>
      <div className="fb-actions center">
        <button className="btn primary" onClick={() => go("mine")}>See my requests</button>
        <button className="btn ghost" onClick={() => go("")}>Back to Feedback</button>
      </div>
    </Glass>
  );
  const by = replyBy(new Date(receipt.at), receipt.premium ? 1 : 5);
  const byText = by.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const email = receipt.mode === "email";
  const headline = email ? "Almost there: press Send in your email app" : receipt.kind === "praise" ? "Thank you, that made our day 💛" : receipt.kind === "bug" ? "Thank you for telling us. We're on it." : "Thank you, this genuinely helps 🙏";
  return (
    <Glass className="card fb-thanks" as="div">
      <div className="fb-heart" aria-hidden="true"><Icon name="heart" size={34} /></div>
      <h2>{headline}</h2>
      <p className="muted">{email ? <>Your email app opened with a draft to <strong>{FEEDBACK_EMAIL}</strong>. If it didn&apos;t, <a href={`mailto:${FEEDBACK_EMAIL}`}>write to us directly</a>.</> : <>Reference <strong>{receipt.id}</strong>. {receipt.premium ? "You're in the Premium priority queue." : "It's in the queue and will be read by a human."}</>}</p>
      <ol className="fb-next" aria-label="What happens next">
        <li className="done"><strong>{email ? "Draft ready" : "Received"}</strong><span>{email ? "Nothing has been sent until you press Send." : "Just now, and you've been thanked automatically."}</span></li>
        <li><strong>{receipt.premium ? `Human reply by ${byText}` : `Reply usually by ${byText}`}</strong><span>{receipt.premium ? `Within 1 business day (IST), signed ${TEAM}.` : "Best effort. Premium members get a reply within 1 business day."}</span></li>
        {receipt.kind !== "praise" && <li><strong>Status updates</strong><span>Planned → In progress → Shipped{email ? ", by email." : ", shown in My requests."}</span></li>}
        {receipt.kind === "idea" && <li><strong>If it ships, you&apos;re credited</strong><span>In the “Built with you” changelog, if you added a name.</span></li>}
      </ol>
      <div className="fb-actions center">
        <button className="btn primary" onClick={() => go("mine")}>See my requests</button>
        <button className="btn ghost" onClick={() => go("")}>Back to Feedback</button>
      </div>
    </Glass>
  );
}

/* ---------- My requests ---------- */
function Mine({ mine, plan, onUpdate }: { mine: Request[]; plan: Plan; onUpdate: (m: Request[]) => void }) {
  const [state, setState] = useState<"idle" | "checking" | "error" | "done">("idle");
  const refresh = useCallback(async () => {
    const tracked = mine.filter((r) => r.via === "relay" && r.secret);
    if (!FEEDBACK_ENDPOINT || !tracked.length) return;
    setState("checking");
    try {
      const updates = await Promise.all(tracked.map(async (r) => [r.id, await fetchStatus(r.id, r.secret!)] as const));
      const byId = new Map(updates);
      onUpdate(mine.map((r) => {
        const u = byId.get(r.id);
        if (!u) return r;
        const auto = (r.replies ?? []).filter((x) => x.from === "auto");
        return { ...r, status: u.status, replies: [...auto, ...u.replies.map((x) => ({ from: "team" as const, name: TEAM, at: istDate(new Date(x.at)), text: x.text }))] };
      }));
      setState("done");
    } catch { setState("error"); }
  }, [mine, onUpdate]);
  const tracked = mine.some((r) => r.via === "relay");
  return (
    <Glass className="card">
      <div className="card-head"><h2>My requests</h2>
        <span className="fb-head-actions">
          <span className="tiny muted">{plan === "premium" ? "Priority line · human reply within 1 business day (IST)" : "Standard queue · best-effort replies"}</span>
          {FEEDBACK_ENDPOINT && tracked && <button className="btn ghost small-btn" onClick={refresh} disabled={state === "checking"}>{state === "checking" ? "Checking…" : "Check for updates"}</button>}
        </span>
      </div>
      {state === "error" && <p className="fb-err" role="alert">Couldn&apos;t check for updates. Your requests are safe; try again later.</p>}
      <div className="list">
        {mine.map((r) => (
          <article className="row fb-thread" key={r.id}>
            <div className="grow">
              <div className="title">{r.title} {r.premium && <PremiumBadge small />} <span className="badge small">{KIND_LABEL[r.kind]}</span></div>
              <div className="sub">{r.via === "github" ? "Opened on GitHub" : r.via === "email" ? "Sent by email" : r.id} · {r.area} · {formatDate(r.createdAt)}</div>
              {r.kind !== "praise" && r.via !== "github" && <StatusTrack status={r.status} />}
              <ul className="fb-replies">
                {(r.replies ?? []).map((x, i) => (
                  <li key={i} className={x.from}><span className="who">{x.from === "auto" ? "Lakshly (automatic)" : x.name ?? TEAM} · {formatDate(x.at)}</span>{x.text}</li>
                ))}
              </ul>
            </div>
            <span className={`status ${r.status}`}>{r.via === "github" ? "Draft opened" : r.kind === "praise" ? "Thanked" : STATUS_LABEL[r.status]}</span>
          </article>
        ))}
        {!mine.length && <p className="empty muted">Nothing yet. Your first idea is one tap away. 💛</p>}
      </div>
    </Glass>
  );
}

/* ---------- Roadmap ---------- */
const COLS: Exclude<Status, "received" | "not_now">[] = ["planned", "in_progress", "shipped"];
function Roadmap({ mine, votes, plan, vote }: { mine: Request[]; votes: string[]; plan: Plan; vote: (id: string) => void }) {
  const [col, setCol] = useState<Status>("planned");
  const by = (s: Status) => ROADMAP.filter((r) => r.status === s).sort((a, b) => b.votes - a.votes);
  const notNow = by("not_now");
  return (
    <>
      <p className="note">Public roadmap, updated {formatDate(ROADMAP_UPDATED)}. Counts are raw votes. {plan === "premium" ? "As a Premium member, your requests and votes get priority in triage." : "Premium members' requests get priority in triage."} We never promise dates, but status is always honest.</p>
      <div className="fb-colpick"><Chips label="Roadmap column" value={col} onChange={setCol} options={COLS.map((s) => ({ value: s, label: `${STATUS_LABEL[s]} · ${by(s).length}` }))} /></div>
      <div className="fb-board">
        {COLS.map((s) => (
          <Glass key={s} className={`card fb-col ${s === col ? "picked" : ""}`}>
            <div className="card-head"><h2><span className={`status ${s}`}>{STATUS_LABEL[s]}</span></h2><span className="tiny muted">{by(s).length}</span></div>
            <div className="list">{by(s).map((r) => <RoadmapRow key={r.id} r={r} voted={votes.includes(r.id)} mineAsked={mine.some((m) => m.roadmapId === r.id)} vote={vote} />)}</div>
          </Glass>
        ))}
      </div>
      {notNow.length > 0 && (
        <Glass className="card">
          <h2>Not now, and why</h2>
          <div className="list">{notNow.map((r) => (
            <div className="row" key={r.id}><div className="grow"><div className="title">{r.title}</div><div className="sub">{r.reason}</div></div><span className="status not_now">{displayVotes(r, votes.includes(r.id))} votes</span></div>
          ))}</div>
        </Glass>
      )}
    </>
  );
}

function RoadmapRow({ r, voted, mineAsked, vote }: { r: RoadmapItem; voted: boolean; mineAsked: boolean; vote: (id: string) => void }) {
  const n = displayVotes(r, voted);
  return (
    <div className="row fb-rrow">
      <button className={`icon-btn fb-vote ${voted ? "on" : ""}`} onClick={() => vote(r.id)} aria-pressed={voted}
        aria-label={`${voted ? "Remove vote from" : "Vote for"} ${r.title}. ${n} votes.`} disabled={r.status === "shipped"}>
        <span aria-hidden="true">▲</span><small>{n}</small>
      </button>
      <div className="grow">
        <div className="title">{r.title}</div>
        <div className="sub">{r.area}{mineAsked ? " · You asked" : ""}{r.shippedIn ? ` · in ${r.shippedIn}` : ""}</div>
        {r.credits?.length && r.status === "shipped" ? <div className="sub fb-credit"><Icon name="heart" size={11} /> {thanks(r.credits.join(", "))}</div> : null}
      </div>
    </div>
  );
}

function Credits() {
  const shipped = ROADMAP.filter((r) => r.status === "shipped" && r.credits?.length);
  return (
    <Glass className="card">
      <div className="card-head"><h2 className="heading-icon"><Icon name="heart" size={16} /> Built with you</h2><span className="muted tiny">Shipped ideas, credited (opt-in)</span></div>
      <div className="list">
        {shipped.map((r) => (
          <div className="row" key={r.id}>
            <span className="status shipped">{r.shippedIn}</span>
            <div className="grow"><div className="title">{r.title}</div></div>
            <div className="amt">{thanks(r.credits!.join(", "))}</div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

function MiniRow({ r }: { r: Request }) {
  const last = [...(r.replies ?? [])].reverse().find((x) => x.from === "team");
  return (
    <div className="row" style={{ alignItems: "flex-start" }}>
      <div className="grow">
        <div className="title">{r.title} <span className="badge small">{KIND_LABEL[r.kind]}</span></div>
        {r.via === "github" ? <p className="tiny muted">Draft opened on GitHub</p> : <StatusTrack status={r.status} />}
        {last && <p className="tiny fb-last"><Icon name="heart" size={11} /> <em>{last.text}</em> <span className="muted">— {last.name}</span></p>}
      </div>
      <span className={`status ${r.status}`}>{r.via === "github" ? "Draft opened" : STATUS_LABEL[r.status]}</span>
    </div>
  );
}

function StatusTrack({ status }: { status: Status }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="fb-track" role="img" aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {STEPS.map((s, i) => <span key={s} className={i <= idx ? "on" : ""} title={STATUS_LABEL[s]} />)}
    </div>
  );
}
