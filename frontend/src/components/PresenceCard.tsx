import type { Sensing } from "../types";
import { Card } from "./Card";

export function PresenceCard({ s }: { s: Sensing | null }) {
  const presence = s?.presence ?? false;
  const state = s?.motion_state ?? "quiet";
  const conf = Math.round((s?.presence_confidence ?? 0) * 100);

  const map = {
    quiet: { label: "No motion", color: "text-slate-400", ring: "border-edge", glow: "" },
    motion: { label: "Motion detected", color: "text-warn", ring: "border-warn/50", glow: "shadow-[0_0_40px_-8px] shadow-warn/40" },
    active: { label: "Active movement", color: "text-danger", ring: "border-danger/50", glow: "shadow-[0_0_50px_-6px] shadow-danger/50" },
  } as const;
  const m = map[state];

  return (
    <Card title="Presence" subtitle="Is someone in the space?">
      <div className="flex flex-col items-center py-3">
        <div
          className={`relative grid h-40 w-40 place-items-center rounded-full border-2 ${m.ring} ${presence ? m.glow : ""} transition-all`}
        >
          {presence && (
            <span className="absolute inset-0 rounded-full border-2 border-current opacity-20 animate-ping" />
          )}
          <div className="text-center">
            <div className={`text-2xl font-bold ${presence ? m.color : "text-slate-500"}`}>
              {presence ? "OCCUPIED" : "EMPTY"}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-widest text-slate-500">
              {m.label}
            </div>
          </div>
        </div>
        <div className="mt-4 w-full">
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>confidence</span>
            <span className="font-mono">{presence ? `${conf}%` : "—"}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-edge">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${presence ? conf : 0}%` }}
            />
          </div>
          {!s?.calibrated && (
            <p className="mt-3 text-center text-[11px] text-warn">
              Calibrating empty-room baseline… keep still for a moment.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
