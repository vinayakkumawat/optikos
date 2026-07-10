import type { Sensing } from "../types";
import { Card } from "./Card";

export function MotionGauge({ s }: { s: Sensing | null }) {
  const score = s?.motion_score ?? 0;
  const pct = Math.min(100, score);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const color =
    s?.motion_state === "active" ? "#ff5470" : s?.motion_state === "motion" ? "#ffb020" : "#33e0c8";

  return (
    <Card title="Motion Intensity" subtitle="0 = still · 100 = lots of movement">
      <div className="flex items-center gap-4 py-2">
        <div className="relative grid place-items-center">
          <svg width="130" height="130" className="-rotate-90">
            <circle cx="65" cy="65" r={r} fill="none" stroke="#1e2c47" strokeWidth="10" />
            <circle
              cx="65"
              cy="65"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s" }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="font-mono text-2xl font-bold" style={{ color }}>
              {Math.round(score)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">score</div>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {(["quiet", "motion", "active"] as const).map((st) => {
            const on = s?.motion_state === st;
            const dot = st === "active" ? "bg-danger" : st === "motion" ? "bg-warn" : "bg-accent";
            return (
              <div
                key={st}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                  on ? "border-edge bg-panel2 text-white" : "border-transparent text-slate-500"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${dot} ${on ? "animate-pulse2" : "opacity-30"}`} />
                {st}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
