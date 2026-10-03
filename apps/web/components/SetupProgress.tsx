"use client";
import type { CSSProperties } from "react";
import "@/app/setup/setup.css";
export function SetupRing({ done, applicable, percent }: { done: number; applicable: number; percent: number }) {
  return <div className="setup-ring" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent} percent, ${done} of ${applicable}`} style={{ "--setup-progress": `${percent}%` } as CSSProperties}><div><strong>{percent}%</strong><span>{done} of {applicable}</span></div></div>;
}

