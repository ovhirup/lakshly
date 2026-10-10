"use client";
import { useState } from "react";
import { Glass, PageHeader } from "@/components/ui";
import { DataGate, useData } from "@/components/DataState";
import { useAppState } from "@/components/AppState";
import { ASK_LIMIT, answerQuestion, readAskCounts, takeAsk, type AskReply } from "@/lib/ask";

const COUNT_KEY = "lakshly.ask.v1";
const PROMPTS = ["What's my net worth?", "What did I spend?", "Where did most of it go?", "What did I save?", "What do I owe?"];

interface Turn { role: "you" | "lakshly"; text: string; calc?: boolean }

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadCounts() {
  try { return readAskCounts(localStorage.getItem(COUNT_KEY)); } catch { return {}; }
}

function AskView() {
  const { accounts, transactions, debts } = useData();
  const { plan } = useAppState();
  const cap = ASK_LIMIT[plan];
  const month = monthKey();
  const [counts, setCounts] = useState(loadCounts);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState("");
  const used = counts[month] ?? 0;

  function ask(raw: string) {
    const question = raw.trim();
    if (!question) return;
    const next = takeAsk(counts, month, cap);
    if (!next.allowed) {
      setNotice(`That's ${cap} questions for ${plan === "premium" ? "Premium" : "Free"} this month. Nothing was sent.`);
      return;
    }
    const reply: AskReply = answerQuestion(question, { accounts, transactions, debts });
    setCounts(next.counts);
    try { localStorage.setItem(COUNT_KEY, JSON.stringify(next.counts)); } catch { /* count stays in memory */ }
    setTurns((prev) => [...prev, { role: "you", text: question }, { role: "lakshly", text: reply.text, calc: reply.calc }]);
    setDraft("");
    setNotice("");
  }

  return (
    <>
      <PageHeader title="Ask Lakshly" subtitle={`${used} of ${cap} this month · answered on this device, nothing is sent`} />
      <Glass className="card">
        <div className="ask-log">
          {turns.length === 0 ? <p className="muted">Ask about net worth, spend, savings, or debt. The reply is my calc from the numbers already here.</p> : null}
          {turns.map((turn, i) => (
            <p key={i} className={turn.role === "you" ? "ask-you" : "ask-reply"}>
              <span className="muted tiny">{turn.role === "you" ? "You" : "Lakshly"}</span><br />
              {turn.text}
            </p>
          ))}
        </div>
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
          <label>Question
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What's my net worth?" />
          </label>
          <button className="btn primary" type="submit" disabled={used >= cap}>Ask</button>
          {notice ? <p className="muted tiny">{notice}</p> : null}
        </form>
        <div className="ask-prompts">
          {PROMPTS.map((prompt) => (
            <button key={prompt} className="btn ghost" type="button" onClick={() => ask(prompt)} disabled={used >= cap}>{prompt}</button>
          ))}
        </div>
      </Glass>
    </>
  );
}

export default function AskPage() {
  return <DataGate title="Ask Lakshly" need={["accounts", "transactions"]}><AskView /></DataGate>;
}
