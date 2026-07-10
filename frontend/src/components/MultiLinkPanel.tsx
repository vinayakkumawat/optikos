import type { MultiAp } from "../types";
import { Card } from "./Card";

function motionColor(m: number) {
  if (m >= 55) return "#ff5470";
  if (m >= 22) return "#ffb020";
  if (m >= 8) return "#4d8dff";
  return "#33e0c8";
}

export function MultiLinkPanel({ multi }: { multi: MultiAp | undefined }) {
  const links = multi?.links ?? [];
  const conf = Math.round((multi?.confidence ?? 0) * 100);

  return (
    <Card
      title="Multi-Link Activity"
      subtitle="Spatial view: how many independent router links are being disturbed at once"
      right={
        <span className="font-mono text-sm text-slate-400">
          {multi?.active_links ?? 0}/{multi?.total_links ?? 0} active
        </span>
      }
    >
      {/* Fused estimate */}
      <div className="mb-3 rounded-xl border border-edge bg-panel2 p-3">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">
          Spatial activity estimate
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-xl font-bold text-slate-100">
            {multi?.available ? multi.occupancy_estimate : "gathering data…"}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-edge">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${multi?.spatial_activity ?? 0}%`,
              background: motionColor(multi?.spatial_activity ?? 0),
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500">
          <span>confidence ~{conf}% (experimental)</span>
          <span>updates every ~{multi?.scan_rate_s ?? "?"}s</span>
        </div>
      </div>

      {/* Per-link bars */}
      <div className="space-y-1.5">
        {links.length === 0 && (
          <div className="text-sm text-slate-500">Scanning nearby links…</div>
        )}
        {links.map((l) => (
          <div key={l.key} className="flex items-center gap-2">
            <span className="flex w-32 shrink-0 items-center gap-1 truncate text-[11px] text-slate-400">
              {l.is_current && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              <span className="truncate">{l.name}</span>
            </span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-edge">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${l.motion}%`, background: motionColor(l.motion) }}
              />
              {l.active && (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-white/90">
                  active
                </span>
              )}
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[10px] text-slate-500">
              {Math.round(l.rssi_dbm)}dBm
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Each bar is one router link. A person only disturbs links whose path they cross, so more
        <span className="text-slate-400"> simultaneously-active links</span> hints at activity spread
        across the room. This is a coarse, experimental estimate limited by the slow scan rate — not
        an exact head count.
      </p>
    </Card>
  );
}
