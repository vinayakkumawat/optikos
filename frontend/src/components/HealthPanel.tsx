import type { LinkHealth } from "../types";
import { Card } from "./Card";

function qualityColor(q?: string) {
  switch (q) {
    case "excellent":
      return "#33e0c8";
    case "good":
      return "#4d8dff";
    case "fair":
      return "#ffb020";
    case "weak":
      return "#ff8f4d";
    default:
      return "#ff5470";
  }
}

function Sparkline({
  data,
  color,
  min,
  max,
}: {
  data: (number | null)[];
  color: string;
  min: number;
  max: number;
}) {
  const pts = data.filter((v): v is number => v != null);
  if (pts.length < 2) return <div className="h-10" />;
  const span = Math.max(1, max - min);
  const w = 100;
  const h = 34;
  const path = data
    .map((v, i) => {
      if (v == null) return null;
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
      <polyline points={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HealthPanel({ health }: { health: LinkHealth | undefined }) {
  if (!health?.available) {
    return (
      <Card title="Connection Health" subtitle="Live link quality to your router">
        <div className="text-sm text-slate-500">Waiting for link data…</div>
      </Card>
    );
  }

  const stability = health.stability_score ?? 0;
  const stabColor = stability >= 75 ? "#33e0c8" : stability >= 50 ? "#ffb020" : "#ff5470";

  const rssiHist = health.rssi_history ?? [];
  const rssiMin = health.rssi_min ?? -90;
  const rssiMax = health.rssi_max ?? -30;

  return (
    <Card
      title="Connection Health"
      subtitle="Live link quality to your connected router"
      right={
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize"
          style={{ color: qualityColor(health.quality), background: `${qualityColor(health.quality)}18` }}
        >
          {health.quality}
        </span>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Signal" value={`${health.rssi_dbm}`} unit="dBm" />
        <Metric label="SNR" value={health.snr_db != null ? `${health.snr_db}` : "—"} unit="dB" />
        <Metric
          label="Tx rate"
          value={health.tx_rate_mbps != null ? `${Math.round(health.tx_rate_mbps)}` : "—"}
          unit="Mbps"
        />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Signal trend (last {Math.round((health.window_s ?? 0) / 60)} min)</span>
          <span className="font-mono">
            {rssiMin} … {rssiMax} dBm
          </span>
        </div>
        <Sparkline data={rssiHist} color={qualityColor(health.quality)} min={rssiMin} max={rssiMax} />
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-slate-500">Stability score</span>
          <span className="font-mono font-semibold" style={{ color: stabColor }}>
            {stability}/100
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-edge">
          <div className="h-full rounded-full transition-all" style={{ width: `${stability}%`, background: stabColor }} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg border border-edge bg-panel2 px-3 py-2 text-[11px]">
        <span className="text-slate-400">
          Drops (2 min): <span className="font-mono font-semibold text-slate-200">{health.recent_drops ?? 0}</span>
        </span>
        {health.drops && health.drops.length > 0 ? (
          <span className="font-mono text-slate-500">
            last: {health.drops[health.drops.length - 1].from} → {health.drops[health.drops.length - 1].to} dBm
          </span>
        ) : (
          <span className="text-slate-600">no recent drops</span>
        )}
      </div>
    </Card>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-edge bg-panel2 px-2 py-2 text-center">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold text-slate-100">{value}</div>
      <div className="text-[10px] text-slate-500">{unit}</div>
    </div>
  );
}
