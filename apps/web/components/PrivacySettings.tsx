"use client";
import { useEffect, useState } from "react";
import { Glass } from "./ui";
import { PrivacyToggle, usePrivacy } from "./Privacy";
import { MASK, type PrivacySettings } from "@/lib/privacy";

type MotionPerm = { requestPermission?: () => Promise<"granted" | "denied"> };

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

/** Settings ▸ Privacy. Every toggle is Free; security and privacy are never paywalled. */
export function PrivacySettingsCard() {
  const { settings, update, masked } = usePrivacy();
  const [canShake, setCanShake] = useState(false);
  const [shakeNote, setShakeNote] = useState<string | null>(null);
  useEffect(() => {
    // Touch devices with motion sensors only; read after mount (no window during prerender).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShake("DeviceMotionEvent" in window && matchMedia("(pointer: coarse)").matches);
  }, []);

  async function setShake(on: boolean) {
    if (on) {
      const DM = (window as unknown as { DeviceMotionEvent?: MotionPerm }).DeviceMotionEvent;
      if (DM?.requestPermission) {
        try {
          if ((await DM.requestPermission()) !== "granted") { setShakeNote("Motion access was declined, so shake can't work. You can allow it in Settings."); return; }
        } catch { setShakeNote("Couldn't ask for motion access. Use the eye button instead."); return; }
      }
    }
    setShakeNote(null);
    update({ shake: on });
  }

  const rows: { key: keyof PrivacySettings; title: string; hint: string }[] = [
    { key: "startHidden", title: "Start with amounts hidden", hint: "Every time you open Lakshly, amounts start hidden until you show them." },
    { key: "hideOnBlur", title: "Hide when I switch away", hint: "Temporarily hides amounts while this tab or window isn't in front." },
    { key: "hidePercent", title: "Also hide percentages", hint: "Masks percentages too. Dates, merchants and chart shapes stay visible." },
  ];

  return (
    <Glass className="card">
      <div className="card-head"><h2>Privacy</h2><PrivacyToggle withLabel /></div>
      <p className="privacy-sample" data-lk-sample aria-label="Example: amounts appear as dots when hidden">
        <span>₹12,345</span><span className="arrow" aria-hidden="true">→</span><span className="masked-amount" aria-hidden="true">{MASK}</span>
      </p>
      <p className="muted tiny">Shortcut: press <kbd>.</kbd> anywhere, double-tap the net-worth total, or use the eye button. {masked ? "Amounts are hidden right now." : ""}</p>
      {rows.map((r) => (
        <div className="toggle-row" key={r.key}>
          <div className="grow"><strong>{r.title}</strong><span>{r.hint}</span></div>
          <Switch checked={settings[r.key] as boolean} onChange={(v) => update({ [r.key]: v })} label={r.title} />
        </div>
      ))}
      {canShake && (
        <div className="toggle-row">
          <div className="grow"><strong>Shake to hide</strong><span>Shake your phone to hide or show amounts. Uses the motion sensor on this device only.</span>{shakeNote && <span role="alert">{shakeNote}</span>}</div>
          <Switch checked={settings.shake} onChange={(v) => void setShake(v)} label="Shake to hide" />
        </div>
      )}
    </Glass>
  );
}
