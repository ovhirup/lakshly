"use client";
import { useMemo, useState } from "react";
import { Glass, PageHeader, Stat } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { Amount } from "@/components/Privacy";
import { formatDate, formatINR } from "@/lib/format";
import { familyLoans, namedRefunds, TAT, tatStatus, complaintText, copyComplaint, type TatId } from "@/lib/owed";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function OwedView() {
  const { transactions, debts } = useData();
  const refunds = useMemo(() => namedRefunds(transactions), [transactions]);
  const loans = useMemo(() => familyLoans(debts), [debts]);
  const today = todayIso();
  const [channel, setChannel] = useState<TatId>("upi");
  const [merchant, setMerchant] = useState("Sample Store (Demo)");
  const [date, setDate] = useState("2026-09-01");
  const [rupeeText, setRupeeText] = useState("299");
  const [reference, setReference] = useState("DEMO-UPI-1001");
  const [notice, setNotice] = useState("");

  const amountPaise = Math.round(Number(rupeeText || "0") * 100);
  const draft = complaintText({ channel, merchant, amountPaise: Number.isFinite(amountPaise) ? amountPaise : 0, date, reference, today });
  const status = tatStatus(channel, date, today);

  async function copy() {
    try {
      await copyComplaint(draft);
      setNotice("Copied. Paste it into your bank's complaint form. Lakshly did not send it.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Couldn't copy.");
    }
  }

  return (
    <>
      <PageHeader title="Owed to you" subtitle="Refunds you are waiting on, and a family loan counted as money you owe." />
      <div className="grid g3">
        <Glass className="card"><Stat label="Named refunds" value={String(refunds.length)} hint="Credits that say refund or reversal" /></Glass>
        <Glass className="card"><Stat label="You owe family" value={formatINR(loans.reduce((s, d) => s + d.outstanding, 0))} hint="A liability, not money owed to you" /></Glass>
        <Glass className="card"><Stat label="This draft" value={status.overdue ? `${status.lateBy}d late` : "Inside T+" + status.days} hint={status.label} /></Glass>
      </div>

      <Glass className="card">
        <div className="card-head"><h2>Refund credits</h2><span className="muted tiny">Tap a row to fill the complaint</span></div>
        {refunds.length === 0 ? <p className="muted">No named refund in this data. The draft below uses a synthetic example.</p> : (
          <div className="list">
            {refunds.map((t) => (
              <button className="row pick" key={t.id} type="button" onClick={() => {
                setMerchant(t.merchant || t.description || "the payee");
                setDate(t.date);
                setRupeeText(String(Math.round(t.amount / 100)));
                setReference(t.id);
                setNotice("");
              }}>
                <div className="grow">
                  <div className="title">{t.merchant || t.description}</div>
                  <div className="sub">{formatDate(t.date)} · {t.description}</div>
                </div>
                <div className="amt"><Amount>{formatINR(t.amount)}</Amount></div>
              </button>
            ))}
          </div>
        )}
      </Glass>

      <Glass className="card">
        <div className="card-head"><h2>Copy a complaint</h2><span className="muted tiny">Stays on this device</span></div>
        <div className="owed-form">
          <label>Channel
            <select value={channel} onChange={(e) => setChannel(e.target.value as TatId)}>
              {TAT.map((row) => <option key={row.id} value={row.id}>{row.label} · T+{row.days}</option>)}
            </select>
          </label>
          <label>Payee<input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></label>
          <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>Amount (₹)<input inputMode="decimal" value={rupeeText} onChange={(e) => setRupeeText(e.target.value)} /></label>
          <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
          <button className="btn primary" type="button" onClick={copy}>Copy complaint</button>
          {notice ? <p className="muted tiny">{notice}</p> : null}
          <pre className="muted tiny" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{draft}</pre>
        </div>
      </Glass>

      <Glass className="card">
        <div className="card-head"><h2>Turnaround times</h2><span className="muted tiny">{`Summary of ${"RBI/2019-20/67"}. Not legal advice.`}</span></div>
        <table className="tat">
          <thead><tr><th>Payment</th><th>Reverse within</th><th>What it covers</th></tr></thead>
          <tbody>
            {TAT.map((row) => (
              <tr key={row.id}><td>{row.label}</td><td>T+{row.days} day{row.days === 1 ? "" : "s"}</td><td>{row.detail}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted tiny">If the money is not reversed in that time, the same circular sets compensation of ₹100 a day after the turnaround time. Your bank may reverse sooner. This is a summary, not a calculation and not legal advice.</p>
      </Glass>

      <Glass className="card">
        <div className="card-head"><h2>Family loans</h2><span className="muted tiny">Counted in net worth as money you owe</span></div>
        {loans.length === 0 ? <p className="muted">No family loan in this data.</p> : (
          <div className="list">
            {loans.map((d) => (
              <div className="row" key={d.id}>
                <div className="grow">
                  <div className="title">{d.name}</div>
                  <div className="sub">{d.lender ?? "Family"} · you owe this</div>
                </div>
                <div className="amt down"><Amount>{formatINR(-d.outstanding)}</Amount></div>
              </div>
            ))}
          </div>
        )}
      </Glass>
    </>
  );
}

export default function OwedPage() {
  return <DataGate title="Owed to you" need={["transactions", "debts"]}><OwedView /></DataGate>;
}
