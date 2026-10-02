"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAppState, type Plan } from "@/components/AppState";
import { Icon } from "@/components/Icon";
import { Chips, Glass, PageHeader, PremiumBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import {
  AREAS, autoAck, getServerSnapshot, getSnapshot, KIND_LABEL, replyBy, reset, save, STATUS_LABEL, STEPS, subscribe, TEAM, voteWeight,
  type Kind, type Request, type Status,
} from "@/lib/feedback";
import { buildPayload, looksSensitive, submit, type Draft, type Receipt } from "@/lib/feedback-transport";
import "./feedback.css";

// Views are hash-addressable so the prototype is clickable and linkable: #new, #new-bug, #sent, #mine, #roadmap.
type View = "hub" | "new" | "sent" | "mine" | "roadmap";
const DIAG = { appVersion: "web 0.2.0 (demo)", platform: "Web" };

function subscribeHash(cb: () => void) { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); }
const readHash = () => window.location.hash.replace(/^#/, "");
const go = (h: string) => { window.location.hash = h; window.scrollTo({ top: 0 }); };

export default function FeedbackPage() {
  const { plan, setPlan } = useAppState();
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [receipt, setReceipt] = useState<(Receipt & { kind: Kind; premium: boolean }) | null>(null);
  const view: View = hash.startsWith("new") ? "new" : hash === "sent" && receipt ? "sent" : hash === "mine" ? "mine" : hash === "roadmap" ? "roadmap" : "hub";
  const initialKind: Kind = hash === "new-bug" ? "bug" : hash === "new-praise" ? "praise" : "idea";

  const vote = (id: string) => save(items.map((r) => (r.id === id
    ? { ...r, voted: !r.voted, votes: Math.max(0, r.votes + (r.voted ? -1 : 1) * voteWeight(plan)) } : r)));

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
      {view === "hub" && <Hub items={items} plan={plan} setPlan={setPlan} vote={vote} />}
      {view === "new" && <NewRequest key={initialKind} initialKind={initialKind} plan={plan} items={items}
        onSent={(r, kind) => { setReceipt({ ...r, kind, premium: plan === "premium" }); go("sent"); }} />}
      {view === "sent" && receipt && <ThankYou receipt={receipt} />}
      {view === "mine" && <Mine items={items} plan={plan} />}
      {view === "roadmap" && <Roadmap items={items} plan={plan} vote={vote} />}
      <p className="tiny muted fb-demo-note">Prototype: nothing is sent; requests stay on this device. Names and requests are fictional. <button className="linklike" onClick={reset}>Reset demo</button></p>
    </>
  );
}

/** "Thank you, Meera K." / "Thank you, @arjun!" without doubled punctuation. */
const thanks = (name = "", end = "!") => `Thank you, ${name}${/[.!?]$/.test(name) ? "" : end}`;

/* ---------- Hub ---------- */
function Hub({ items, plan, setPlan, vote }: { items: Request[]; plan: Plan; setPlan: (p: Plan) => void; vote: (id: string) => void }) {
  const mine = items.filter((r) => r.mine);
  const shippedMine = mine.find((r) => r.status === "shipped");
  const open = mine.filter((r) => r.status !== "shipped");
  const top = items.filter((r) => !r.mine && (r.status === "planned" || r.status === "in_progress")).sort((a, b) => b.votes - a.votes).slice(0, 3);
  return (
    <>
      {shippedMine && (
        <Glass className="hero fb-shipped" as="div">
          <p className="eyebrow"><Icon name="heart" size={14} /> You asked, we shipped</p>
          <h2><strong>{shippedMine.title}</strong> is live in {shippedMine.shippedIn}.</h2>
          <p className="fb-hero-sub">{thanks(shippedMine.credit, ".")} Your idea is credited in the “Built with you” changelog. 💛</p>
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
          <div className="list">{top.map((r) => <RoadmapRow key={r.id} r={r} plan={plan} vote={vote} />)}</div>
        </Glass>
        <Credits items={items} />
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
        <li><strong>Your votes count 3×</strong><span>Premium requests are triaged first.</span></li>
        <li><strong>Early access</strong><span>Try the features you asked for before everyone else.</span></li>
      </ul>
      <div className="fb-stats"><div><strong>{mine.length}</strong><span>sent</span></div><div><strong>{replied}</strong><span>replied</span></div><div><strong>{mine.filter((r) => r.status === "shipped").length}</strong><span>shipped</span></div></div>
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
        <li><strong>Votes count 3× and priority triage</strong></li>
        <li><strong>Early access to what you asked for</strong></li>
      </ul>
      <p className="price"><strong>₹119</strong>/month · or <strong>₹999</strong>/year</p>
      <button className="btn primary" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
      <p className="tiny muted">Demo only. No payment is taken in this preview.</p>
    </Glass>
  );
}

/* ---------- New request ---------- */
function NewRequest({ initialKind, plan, items, onSent }: { initialKind: Kind; plan: Plan; items: Request[]; onSent: (r: Receipt, kind: Kind) => void }) {
  const [d, setD] = useState<Draft>({ kind: initialKind, title: "", detail: "", area: initialKind === "bug" ? "Import" : "Spend", credit: "", replyEmail: "", includeDiagnostics: false });
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  const payload = useMemo(() => buildPayload(d, plan, DIAG), [d, plan]);
  const sensitive = looksSensitive(`${d.title} ${d.detail}`);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const copy = {
    idea: { t: "What would you love Lakshly to do?", ph: "e.g. Remind me before SIP dates", dt: "Why would it help? (optional)", dph: "I want to… so that…" },
    bug: { t: "What went wrong?", ph: "e.g. Refund shows twice after import", dt: "Steps to see it, and what you expected", dph: "1. Import… 2. Open Spend… I expected…" },
    praise: { t: "What do you love?", ph: "e.g. The Lakshmi theme is gorgeous", dt: "Tell us more (optional)", dph: "It makes me feel…" },
  }[d.kind];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!d.title.trim()) { setErr("Please add a short title."); titleRef.current?.focus(); return; }
    setErr(null); setSending(true);
    const id = `LK-${1043 + items.filter((r) => r.mine).length - 3}`;
    const receipt = await submit(payload, id); // STUB: resolves locally, sends nothing
    const now = receipt.receivedAt.slice(0, 10);
    const r: Request = {
      id: receipt.id, kind: d.kind, title: payload.title, detail: payload.detail, area: d.area, status: "received",
      votes: d.kind === "praise" ? 0 : voteWeight(plan), voted: d.kind !== "praise", premium: plan === "premium", mine: true,
      createdAt: now, credit: payload.credit, replies: [autoAck(now, plan === "premium")],
    };
    save([r, ...items]);
    setSending(false);
    onSent(receipt, d.kind);
  }

  return (
    <div className="grid g3">
      <Glass className="card span2">
        <div className="card-head"><h2>New {KIND_LABEL[d.kind].toLowerCase()}</h2>
          <Chips label="Type" value={d.kind} onChange={(k) => set("kind", k)} options={(["idea", "bug", "praise"] as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} /></div>
        <form className="fb-form" onSubmit={send} noValidate>
          <label className="field">{copy.t}
            <input ref={titleRef} type="text" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder={copy.ph} maxLength={90} aria-invalid={!!err} />
          </label>
          {err && <p className="fb-err" role="alert">{err}</p>}
          <label className="field">{copy.dt}
            <textarea rows={4} value={d.detail} onChange={(e) => set("detail", e.target.value)} placeholder={copy.dph} maxLength={1000} />
          </label>
          {sensitive && <p className="fb-warn" role="status"><Icon name="shield" size={14} /> That looks like an account, card or phone number, or a PAN/IFSC. Please remove it. We never need your financial details.</p>}
          <div className="fb-two">
            <label className="field">Area
              <select value={d.area} onChange={(e) => set("area", e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <label className="field">Credit me in “Built with you” as <span className="muted">(optional)</span>
              <input type="text" value={d.credit} onChange={(e) => set("credit", e.target.value)} placeholder="First name or @handle" maxLength={40} />
            </label>
          </div>
          <label className="field">Email for replies <span className="muted">(optional)</span>
            <input type="text" inputMode="email" autoComplete="email" value={d.replyEmail} onChange={(e) => set("replyEmail", e.target.value)} placeholder="Leave blank to get replies in the app only" maxLength={120} />
          </label>
          <label className="fb-check"><input type="checkbox" checked={d.includeDiagnostics} onChange={(e) => set("includeDiagnostics", e.target.checked)} />
            <span>Include app version and platform <span className="muted">(helps with bugs; no financial data)</span></span></label>
          <div className="fb-send">
            <button className="btn primary" type="submit" disabled={sending}>{sending ? "Sending…" : "Send with thanks"}</button>
            <span className="tiny muted">{plan === "premium" ? "Priority queue · human reply within 1 business day (IST)" : "Standard queue · best-effort reply, usually within 5 business days"}</span>
          </div>
        </form>
      </Glass>
      <Glass className="card fb-preview">
        <h2 className="heading-icon"><Icon name="shield" size={16} /> Exactly what will be sent</h2>
        <p className="muted tiny">Your finances never leave this device. Only what you type below goes to the Lakshly team, and only when you press Send.</p>
        <dl className="fb-payload">
          {Object.entries(payload).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{typeof v === "object" ? Object.values(v).join(" · ") : String(v) || "—"}</dd></div>
          ))}
        </dl>
        <p className="tiny muted">Never sent: transactions, balances, accounts, statements, categories or anything in your encrypted vault.</p>
      </Glass>
    </div>
  );
}

/* ---------- Thank-you ---------- */
function ThankYou({ receipt }: { receipt: Receipt & { kind: Kind; premium: boolean } }) {
  const by = replyBy(new Date(receipt.receivedAt), receipt.premium ? 1 : 5);
  const byText = by.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });
  const headline = receipt.kind === "praise" ? "Thank you, that made our day 💛" : receipt.kind === "bug" ? "Thank you for telling us. We're on it." : "Thank you, this genuinely helps 🙏";
  return (
    <Glass className="card fb-thanks" as="div">
      <div className="fb-heart" aria-hidden="true"><Icon name="heart" size={34} /></div>
      <h2>{headline}</h2>
      <p className="muted">Reference <strong>{receipt.id}</strong>. {receipt.premium ? "You're in the Premium priority queue." : "It's in the queue and will be read by a human."}</p>
      <ol className="fb-next" aria-label="What happens next">
        <li className="done"><strong>Received</strong><span>Just now, and you&apos;ve been thanked automatically.</span></li>
        <li><strong>{receipt.premium ? `Human reply by ${byText}` : `Reply usually by ${byText}`}</strong><span>{receipt.premium ? "Within 1 business day (IST), a target we take seriously." : "Best effort. Premium members get a reply within 1 business day."}</span></li>
        {receipt.kind !== "praise" && <li><strong>Status updates</strong><span>Planned → In progress → Shipped, shown in My requests.</span></li>}
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
function Mine({ items, plan }: { items: Request[]; plan: Plan }) {
  const mine = items.filter((r) => r.mine);
  return (
    <Glass className="card">
      <div className="card-head"><h2>My requests</h2><span className="tiny muted">{plan === "premium" ? "Priority line · human reply within 1 business day (IST)" : "Standard queue · best-effort replies"}</span></div>
      <div className="list">
        {mine.map((r) => (
          <article className="row fb-thread" key={r.id}>
            <div className="grow">
              <div className="title">{r.title} {r.premium && <PremiumBadge small />} <span className="badge small">{KIND_LABEL[r.kind]}</span></div>
              <div className="sub">{r.id} · {r.area} · sent {formatDate(r.createdAt)}</div>
              {r.kind !== "praise" && <StatusTrack status={r.status} />}
              <ul className="fb-replies">
                {(r.replies ?? []).map((x, i) => (
                  <li key={i} className={x.from}><span className="who">{x.from === "auto" ? "Lakshly (automatic)" : x.name ?? TEAM} · {formatDate(x.at)}</span>{x.text}</li>
                ))}
              </ul>
            </div>
            <span className={`status ${r.status}`}>{r.kind === "praise" ? "Thanked" : STATUS_LABEL[r.status]}</span>
          </article>
        ))}
      </div>
    </Glass>
  );
}

/* ---------- Roadmap ---------- */
const COLS: Status[] = ["planned", "in_progress", "shipped"];
function Roadmap({ items, plan, vote }: { items: Request[]; plan: Plan; vote: (id: string) => void }) {
  const [col, setCol] = useState<Status>("planned");
  const ideas = items.filter((r) => r.kind === "idea");
  const by = (s: Status) => ideas.filter((r) => r.status === s).sort((a, b) => b.votes - a.votes);
  const notNow = by("not_now");
  return (
    <>
      <p className="note">Public roadmap of ideas from everyone. {plan === "premium" ? "As a Premium member, your votes count 3×." : "Your vote counts once; Premium votes count 3×."} We never promise dates, but status is always honest.</p>
      <div className="fb-colpick"><Chips label="Roadmap column" value={col} onChange={setCol} options={COLS.map((s) => ({ value: s, label: `${STATUS_LABEL[s]} · ${by(s).length}` }))} /></div>
      <div className="fb-board">
        {COLS.map((s) => (
          <Glass key={s} className={`card fb-col ${s === col ? "picked" : ""}`}>
            <div className="card-head"><h2><span className={`status ${s}`}>{STATUS_LABEL[s]}</span></h2><span className="tiny muted">{by(s).length}</span></div>
            <div className="list">{by(s).map((r) => <RoadmapRow key={r.id} r={r} plan={plan} vote={vote} />)}</div>
          </Glass>
        ))}
      </div>
      {notNow.length > 0 && (
        <Glass className="card">
          <h2>Not now, and why</h2>
          <div className="list">{notNow.map((r) => (
            <div className="row" key={r.id}><div className="grow"><div className="title">{r.title}</div><div className="sub">{r.reason}</div></div><span className="status not_now">{r.votes} votes</span></div>
          ))}</div>
        </Glass>
      )}
    </>
  );
}

function RoadmapRow({ r, plan, vote }: { r: Request; plan: Plan; vote: (id: string) => void }) {
  return (
    <div className="row fb-rrow">
      <button className={`icon-btn fb-vote ${r.voted ? "on" : ""}`} onClick={() => vote(r.id)} aria-pressed={!!r.voted}
        aria-label={`${r.voted ? "Remove vote from" : "Vote for"} ${r.title}. ${r.votes} votes.${plan === "premium" ? " Your vote counts 3×." : ""}`}
        disabled={r.status === "shipped"}>
        <span aria-hidden="true">▲</span><small>{r.votes}</small>
      </button>
      <div className="grow">
        <div className="title">{r.title}</div>
        <div className="sub">{r.area}{r.premium ? " · ⭐ Premium request" : ""}{r.mine ? " · You asked" : ""}{r.shippedIn ? ` · in ${r.shippedIn}` : ""}</div>
        {r.credit && r.status === "shipped" && <div className="sub fb-credit"><Icon name="heart" size={11} /> {thanks(r.credit)}</div>}
      </div>
    </div>
  );
}

function Credits({ items }: { items: Request[] }) {
  const shipped = items.filter((r) => r.status === "shipped" && r.credit);
  return (
    <Glass className="card">
      <div className="card-head"><h2 className="heading-icon"><Icon name="heart" size={16} /> Built with you</h2><span className="muted tiny">Shipped ideas, credited (opt-in)</span></div>
      <div className="list">
        {shipped.map((r) => (
          <div className="row" key={r.id}>
            <span className="status shipped">{r.shippedIn}</span>
            <div className="grow"><div className="title">{r.title}</div></div>
            <div className="amt">{thanks(r.credit)}</div>
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
        <StatusTrack status={r.status} />
        {last && <p className="tiny fb-last"><Icon name="heart" size={11} /> <em>{last.text}</em> <span className="muted">— {last.name}</span></p>}
      </div>
      <span className={`status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
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
