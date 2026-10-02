"use client";
import { useState, useSyncExternalStore } from "react";
import { useAppState } from "@/components/AppState";
import { Icon } from "@/components/Icon";
import { Chips, Glass, PageHeader, PremiumBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getServerSnapshot, getSnapshot, save, STATUS_LABEL, subscribe, type Request, type Status } from "@/lib/feedback";

const AREAS = ["Overview", "Spend", "Budget", "Debt", "Credit", "Investments", "SIPs", "Rewards", "History", "Design", "Other"];
const STEPS: Status[] = ["received", "planned", "in_progress", "shipped"];

export default function FeedbackPage() {
  const { plan } = useAppState();
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [area, setArea] = useState("Spend");
  const [credit, setCredit] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const sorted = [...items]
    .filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => Number(b.premium) - Number(a.premium) || b.votes - a.votes);
  const shipped = items.filter((r) => r.status === "shipped" && r.credit);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const r: Request = {
      id: `r${Date.now()}`, title: title.trim(), detail: detail.trim(), area, status: "received", votes: 1,
      premium: plan === "premium", mine: true, createdAt: new Date().toISOString().slice(0, 10), credit: credit.trim() || undefined,
      reply: plan === "premium"
        ? "Thank you! ⭐ As a Premium member you're in the priority queue. A human will reply within 1 business day."
        : "Thank you, this genuinely helps. We've logged it and you'll hear from us soon 🙏",
    };
    save([r, ...items]);
    setTitle(""); setDetail(""); setCredit("");
    setToast(r.reply!);
    setTimeout(() => setToast(null), 4200);
  }
  const vote = (id: string) => save(items.map((r) => (r.id === id ? { ...r, votes: r.votes + (plan === "premium" ? 3 : 1) } : r)));

  return (
    <>
      <PageHeader title="Feedback & Requests" subtitle="Lakshly is built with you. Thank you for every idea 💛">
        {plan === "premium" ? <PremiumBadge /> : <span className="badge">Free</span>}
      </PageHeader>

      <div className="grid g3">
        <Glass className="card">
          <h2>Suggest something</h2>
          <p className="muted">Every request gets an instant thank-you and a visible status. {plan === "premium"
            ? <strong>⭐ Premium: priority queue, votes count 3×, human reply within 1 business day.</strong>
            : "Premium members get priority triage and a 1-business-day reply target."}</p>
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label className="field">What would you love Lakshly to do?
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Remind me before SIP dates" maxLength={90} required />
            </label>
            <label className="field">Why would it help? (optional)
              <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="I want to… so that…" maxLength={400} />
            </label>
            <label className="field">Area
              <select value={area} onChange={(e) => setArea(e.target.value)}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
            <label className="field">Credit me in &ldquo;Built with you&rdquo; as (optional)
              <input type="text" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="First name or @handle" maxLength={40} />
            </label>
            <button className="btn primary" type="submit">Send with thanks</button>
            <p className="tiny muted">Demo: saved only on this device. Please never include account numbers or real amounts.</p>
          </form>
        </Glass>

        <Glass className="card span2">
          <div className="card-head">
            <h2>Requests</h2>
            <Chips label="Status filter" value={filter} onChange={setFilter}
              options={[{ value: "all", label: "All" }, ...STEPS.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
          </div>
          <div className="list">
            {sorted.map((r) => (
              <div className="row" key={r.id} style={{ alignItems: "flex-start" }}>
                <button className="icon-btn" onClick={() => vote(r.id)} aria-label={`Upvote ${r.title}`} style={{ flexDirection: "column", height: 52, gap: 0 }}>
                  <span aria-hidden="true">▲</span><small>{r.votes}</small>
                </button>
                <div className="grow">
                  <div className="title" style={{ whiteSpace: "normal" }}>{r.title} {r.premium && <PremiumBadge small />} {r.mine && <span className="badge small">You</span>}</div>
                  {r.detail && <div className="sub">{r.detail}</div>}
                  <div className="sub">{r.area} · {formatDate(r.createdAt)}</div>
                  <StatusTrack status={r.status} />
                  {r.reply && <p className="tiny" style={{ marginTop: 6 }}><Icon name="heart" size={11} /> <em>{r.reply}</em></p>}
                </div>
                <span className={`status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
              </div>
            ))}
            {!sorted.length && <p className="empty muted">Nothing here yet. Your idea could be first!</p>}
          </div>
        </Glass>
      </div>

      <Glass className="card">
        <div className="card-head"><h2>💛 Built with you</h2><span className="muted tiny">Shipped ideas, credited with gratitude (opt-in). Sample names in this demo are fictional.</span></div>
        <div className="list">
          {shipped.map((r) => (
            <div className="row" key={r.id}>
              <span className="status shipped">Shipped</span>
              <div className="grow"><div className="title">{r.title}</div></div>
              <div className="amt">Thank you, {r.credit}!</div>
            </div>
          ))}
        </div>
      </Glass>

      {toast && <Glass className="toast" as="div"><strong>🙏 Thank you!</strong> <span className="muted">{toast}</span></Glass>}
    </>
  );
}

function StatusTrack({ status }: { status: Status }) {
  const idx = STEPS.indexOf(status);
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 8, maxWidth: 280 }} aria-label={`Status: ${STATUS_LABEL[status]}`}>
      {STEPS.map((s, i) => (
        <span key={s} title={STATUS_LABEL[s]} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= idx ? "var(--accent-grad)" : "var(--grid)" }} />
      ))}
    </div>
  );
}
