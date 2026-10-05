"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { Avatar, TierPill } from "@/components/Identity";
import { Icon } from "@/components/Icon";
import { useTier } from "@/components/useTier";
import { Glass, PageHeader } from "@/components/ui";
import { SetupProfileRow } from "@/components/SetupParts";
import { PrivacySettingsCard } from "@/components/PrivacySettings";
import { VaultLockCard } from "@/components/VaultLock";
import { CoachSettings } from "@/components/CoachSettings";
import { useData } from "@/components/DataState";
import { datasetJson, exportFilename, transactionsCsv } from "@/lib/export";
import { FEATURES, FREE_BILL_OF_RIGHTS, PRICE_TEXT, premiumFeatures } from "@/lib/entitlements";
import { formatDate } from "@/lib/format";
import { renewsOn, saveProfile, useProfile } from "@/lib/profile";
import { loadUpsell, markShown, mayShow, snooze, storeUpsell } from "@/lib/upsell";
import { IS_BETA } from "@/lib/edition";

const UPSELL_ID = "profile.card";

export default function ProfilePage() {
  const profile = useProfile();
  const { tier, can } = useTier();
  const { dataset, deleteAll } = useData();
  const { setPlan } = useAppState();
  const [draft, setDraft] = useState<string | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (tier !== "free") return;
    const now = new Date();
    const s = loadUpsell();
    const ok = mayShow(s, UPSELL_ID, now);
    if (ok) storeUpsell(markShown(s, UPSELL_ID, now));
    // Reading device-local nudge state after mount is intentional (no SSR access to localStorage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowUpsell(ok);
  }, [tier]);

  const editing = draft !== null || !profile.name;
  const name = profile.name;
  const since = profile.premiumSince;

  function startPremium() {
    if (!profile.premiumSince) saveProfile({ premiumSince: new Date().toISOString().slice(0, 10) });
    setPlan("premium");
    setPaywall(false);
  }
  function flash(text: string) { setNote(text); setTimeout(() => setNote(null), 4000); }
  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function saveFile(filename: string, text: string, type: string) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    flash("Saved on this device. Nothing was sent.");
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Your name and plan. Stored only on this device." />

      <Glass className="card profile-card">
        <div className="profile-head">
          <Avatar size={72} />
          <div>
            {editing ? (
              <form className="profile-name-form" onSubmit={(e) => { e.preventDefault(); saveProfile({ name: draft ?? "" }); setDraft(null); }}>
                <label className="field">What should we call you?
                  <input value={draft ?? name} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoComplete="given-name" placeholder="Your name" />
                </label>
                <button className="btn primary" type="submit" disabled={!(draft ?? name).trim()}>Save</button>
                {name && <button className="btn ghost" type="button" onClick={() => setDraft(null)}>Cancel</button>}
              </form>
            ) : (
              <>
                <h2>{name}</h2>
                <div className="row-actions"><TierPill size="lg" /><button className="btn ghost small-btn" onClick={() => setDraft(name)}>Edit name</button></div>
              </>
            )}
          </div>
        </div>
        {tier === "premium" ? (
          <p className="muted">
            {since ? <>Member since {formatDate(since).replace(/^\d+ /, "")} · renews {formatDate(renewsOn(since))} (demo)</> : "Premium preview (demo)"}
            {" · "}<Link href="/feedback/">⭐ Priority requests</Link>
          </p>
        ) : (
          <p className="muted">Lakshly Free · security and import are always free</p>
        )}
      </Glass>

      <SetupProfileRow />

      {tier === "premium" ? (
        <Glass className="card">
          <div className="card-head"><h2>Your Premium perks</h2><span className="muted tiny">Thank you for supporting Lakshly 💛</span></div>
          <div className="perk-grid">
            {premiumFeatures().map((id) => <div className="perk" key={id}><Icon name="sparkle" size={16} />{FEATURES[id].label}</div>)}
          </div>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => flash("Payments aren’t live yet, so there’s no subscription to manage. This is a demo preview.")}>Manage subscription</button>
            <button className="btn ghost" onClick={() => setPlan("free")}>Switch back to Free (demo)</button>
          </div>
        </Glass>
      ) : (showUpsell || paywall) && (
        <Glass className="card soft-upsell">
          {!paywall ? (
            <>
              <div className="card-head"><h2>Lakshly Premium</h2><TierPillPreview /></div>
              <p className="muted">3 extra themes, payoff what-ifs, unlimited budgets and history, credit and rewards insights.</p>
              <div className="row-actions">
                <button className="btn primary" onClick={() => setPaywall(true)}>See Premium</button>
                <button className="btn ghost" onClick={() => { storeUpsell(snooze(loadUpsell(), UPSELL_ID, 30, new Date())); setShowUpsell(false); }}>Not now</button>
              </div>
            </>
          ) : (
            <div className="paywall">
              <div className="card-head"><h2>Lakshly Premium</h2><button className="btn ghost" onClick={() => setPaywall(false)}>Close</button></div>
              <ul>{premiumFeatures().map((id) => <li key={id}>{FEATURES[id].label}</li>)}</ul>
              <div>
                <div className="price-main" data-lk-price>{PRICE_TEXT.yearly}/year<small>≈{PRICE_TEXT.yearlyPerMonth}/month</small></div>
                <div className="muted" data-lk-price>or {PRICE_TEXT.monthly}/month. Renews automatically; cancel anytime in your store settings.</div>
              </div>
              {IS_BETA && (
                <div className="row-actions">
                  <button className="btn primary" onClick={startPremium}>Preview Premium (demo)</button>
                </div>
              )}
              <p className="tiny muted">{IS_BETA ? "Payments aren’t live yet. This preview unlocks Premium on this device only, and no payment is taken." : "Payments aren’t live yet. Premium stays locked on this site."}</p>
              <div className="legal"><a href="https://lakshly.com/privacy.html" rel="noopener">Privacy</a><span className="muted">Terms: coming with payments</span><span className="muted">Family Sharing: planned on Apple</span></div>
            </div>
          )}
        </Glass>
      )}

      <PrivacySettingsCard />
      <VaultLockCard />
      {can("data.export") && (
        <Glass className="card">
          <div className="card-head"><h2>Your data</h2><span className="muted tiny">Free · stays on this device</span></div>
          <p className="muted">Download a copy of the books open right now. Lakshly does not upload it.</p>
          <div className="row-actions">
            <button className="btn primary" type="button" onClick={() => saveFile(exportFilename("json", todayIso()), datasetJson(dataset), "application/json")}>Download JSON</button>
            <button className="btn ghost" type="button" onClick={() => saveFile(exportFilename("csv", todayIso()), transactionsCsv(dataset.transactions), "text/csv")}>Download transactions CSV</button>
          </div>
          {can("data.delete") && (
            confirmDelete ? (
              <div className="danger-zone" role="alertdialog" aria-label="Confirm delete">
                <p className="tiny">Delete imported statements and the encryption key from this browser? The demo stays available. This can&apos;t be undone.</p>
                <div className="row-actions">
                  <button className="btn danger" type="button" onClick={() => { void deleteAll().then(() => { setConfirmDelete(false); flash("All your data was deleted from this device."); }); }}>Delete everything</button>
                  <button className="btn ghost" type="button" onClick={() => setConfirmDelete(false)}>Keep</button>
                </div>
              </div>
            ) : (
              <div className="row-actions">
                <button className="btn ghost" type="button" onClick={() => setConfirmDelete(true)}>Delete all my data</button>
              </div>
            )
          )}
        </Glass>
      )}
      <CoachSettings />

      <div className="grid g2">
        <Glass className="card">
          <div className="card-head"><h2>Free bill of rights</h2><span className="muted tiny">Never paywalled</span></div>
          <ul className="rights">
            {FREE_BILL_OF_RIGHTS.map((id) => <li key={id}><Icon name="check" size={18} />{FEATURES[id].label}</li>)}
          </ul>
        </Glass>
        <Glass className="card">
          <div className="card-head"><h2>Plan</h2></div>
          <dl className="kv">
            <dt>Tier</dt><dd>{tier === "premium" ? "Premium" : "Free"}</dd>
            <dt>Edition</dt><dd>Public · open source</dd>
            <dt>Payments</dt><dd>Not live yet (demo toggle)</dd>
          </dl>
          <div className="row-actions" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => flash("Nothing to restore yet: payments aren’t live. Your Premium preview stays on this device.")}>Restore purchases</button>
          </div>
        </Glass>
      </div>
      {note && <div className="toast glass" role="status">{note}</div>}
    </>
  );
}

function TierPillPreview() {
  return <span className="tier-pill premium sm"><Icon name="sparkle" size={11} /> Premium</span>;
}
