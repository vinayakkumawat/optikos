import type { Gestures } from "../types";
import { Card } from "./Card";

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function GestureCard({ gestures }: { gestures: Gestures | undefined }) {
  const active = gestures?.active ?? false;
  const last = gestures?.last ?? null;
  const recent = gestures?.recent ?? [];

  return (
    <Card
      title="Gesture Detection"
      subtitle="Wave your hand close to the laptop, or knock the desk — sharp signal spikes register as gestures"
      right={<span className="font-mono text-sm text-slate-400">{gestures?.total ?? 0} total</span>}
    >
      <div
        className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
          active ? "border-accent bg-accent/10" : "border-edge bg-panel2"
        }`}
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${
            active ? "bg-accent/20 animate-pulse2" : "bg-edge"
          }`}
        >
          {active ? "✋" : "·"}
        </div>
        <div className="min-w-0">
          {active ? (
            <div className="text-lg font-bold capitalize text-accent">{last?.type} detected!</div>
          ) : last ? (
            <div className="text-sm text-slate-300">
              Last: <span className="font-medium capitalize text-slate-100">{last.type}</span>
              <span className="ml-1 text-[11px] text-slate-500">{timeAgo(last.ts)}</span>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Try waving a hand near the laptop</div>
          )}
          <div className="text-[11px] text-slate-500">
            Sensitivity depends on your laptop — get within ~20cm of the antenna for best results.
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...recent].reverse().map((g, i) => (
            <span
              key={`${g.ts}-${i}`}
              className="rounded-md border border-edge bg-panel2 px-2 py-0.5 text-[11px] text-slate-300"
            >
              <span className="capitalize">{g.type}</span>
              <span className="ml-1 text-slate-600">{timeAgo(g.ts)}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
