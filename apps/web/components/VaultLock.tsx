"use client";
import { useEffect, useState } from "react";
import { Glass } from "./ui";
import { enableVaultLock, lockVaultNow, unlockVault, vaultLockState } from "@/lib/vault";

export function VaultLockCard() {
  const [state, setState] = useState<"unset" | "locked" | "open" | null>(null);
  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    vaultLockState().then((next) => { if (alive) setState(next); }).catch(() => { if (alive) setState("unset"); });
    return () => { alive = false; };
  }, []);

  async function setLock() {
    if (pass.trim().length < 8) { setNote("Use at least 8 characters."); return; }
    if (pass !== again) { setNote("The two passphrases do not match."); return; }
    try {
      await enableVaultLock(pass);
      setPass(""); setAgain(""); setState("open");
      setNote("Vault lock is on. Forgetting this passphrase means the imported data on this device cannot be opened.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't set the lock.");
    }
  }

  async function open() {
    try {
      await unlockVault(pass);
      setPass(""); setState("open");
      setNote("Unlocked on this device. Nothing was sent.");
    } catch {
      setNote("That passphrase did not open the vault.");
    }
  }

  return (
    <Glass className="card">
      <div className="card-head"><h2>Vault lock</h2><span className="muted tiny">Free · this device only</span></div>
      <p className="muted">A passphrase wraps the key for your imported data. The demo stays available. The passphrase is never stored or sent.</p>
      {state === "locked" && (
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); void open(); }}>
          <label>Passphrase<input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          <button className="btn primary" type="submit">Unlock</button>
        </form>
      )}
      {state === "unset" && (
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); void setLock(); }}>
          <label>New passphrase<input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
          <label>Again<input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
          <button className="btn primary" type="submit">Turn on vault lock</button>
        </form>
      )}
      {state === "open" && (
        <div className="row-actions">
          <button className="btn ghost" type="button" onClick={() => { lockVaultNow(); setState("locked"); setNote("Locked. Your imported data stays on this device."); }}>Lock now</button>
        </div>
      )}
      {note ? <p className="muted tiny">{note}</p> : null}
    </Glass>
  );
}
