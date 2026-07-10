import type { ChannelAnalysis } from "../types";
import { Card } from "./Card";

export function ChannelPanel({ analysis }: { analysis: ChannelAnalysis | undefined }) {
  const channels = analysis?.channels ?? [];
  const recs = analysis?.recommendations ?? [];
  const max = Math.max(1, ...channels.map((c) => c.congestion));

  const barColor = (band: string | null) =>
    band === "2.4GHz" ? "#ffb020" : band === "6GHz" ? "#a78bfa" : "#4d8dff";

  return (
    <Card
      title="Channel Congestion"
      subtitle="How crowded each WiFi channel is (weighted by signal strength)"
    >
      {recs.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {recs.map((r) => (
            <div
              key={r.band}
              className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px]"
            >
              <span className="text-slate-400">Best {r.band}: </span>
              <span className="font-mono font-semibold text-accent">ch {r.channel}</span>
            </div>
          ))}
        </div>
      )}

      <div className="max-h-[240px] space-y-1.5 overflow-auto pr-1">
        {channels.map((c) => (
          <div key={`${c.band}-${c.channel}`} className="flex items-center gap-2">
            <span className="w-14 shrink-0 font-mono text-[11px] text-slate-400">
              ch {c.channel}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-edge">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${(c.congestion / max) * 100}%`,
                  background: barColor(c.band),
                }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-[10px] text-slate-500">
              {c.count} AP{c.count > 1 ? "s" : ""}
            </span>
          </div>
        ))}
        {channels.length === 0 && (
          <div className="text-sm text-slate-500">Scanning channels…</div>
        )}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "#ffb020" }} /> 2.4GHz
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm" style={{ background: "#4d8dff" }} /> 5GHz
        </span>
      </div>
    </Card>
  );
}
