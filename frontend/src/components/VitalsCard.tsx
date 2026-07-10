import type { Sensing } from "../types";
import { Card } from "./Card";

export function VitalsCard({ s }: { s: Sensing | null }) {
  const bpm = s?.breathing_bpm ?? null;
  const conf = Math.round((s?.breathing_confidence ?? 0) * 100);
  const hasReading = bpm != null && conf >= 15;

  return (
    <Card title="Breathing (experimental)" subtitle="FFT of the signal in the 6–36 BPM band">
      <div className="flex items-center gap-4 py-2">
        <div className="grid h-16 w-16 place-items-center rounded-xl bg-accent2/10 text-accent2">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 12h4l2-6 4 12 2-6h8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="font-mono text-3xl font-bold text-white">
            {hasReading ? bpm : "—"}
            {hasReading && <span className="ml-1 text-sm font-normal text-slate-500">BPM</span>}
          </div>
          <div className="text-[11px] text-slate-500">
            {hasReading ? `confidence ${conf}%` : "no stable rhythm detected"}
          </div>
        </div>
      </div>
      <p className="mt-2 rounded-lg bg-panel2 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
        Only works when a person is very still and near the signal path.
        RSSI-based vitals are unreliable — real breathing/heart-rate needs CSI phase data.
      </p>
    </Card>
  );
}
