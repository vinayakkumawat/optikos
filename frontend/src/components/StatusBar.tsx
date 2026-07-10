import type { Snapshot } from "../types";

function Pill({ label, value, tone = "default" }: { label: string; value: string; tone?: string }) {
  const tones: Record<string, string> = {
    default: "text-slate-300 border-edge",
    good: "text-accent border-accent/40",
    warn: "text-warn border-warn/40",
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${tones[tone]}`}>
      <span className="text-slate-500">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

export function StatusBar({
  snapshot,
  conn,
  onRecalibrate,
}: {
  snapshot: Snapshot | null;
  conn: string;
  onRecalibrate: () => void;
}) {
  const live = conn === "live";
  const realRssi = snapshot?.rssi_source === "corewlan";
  const uptime = snapshot ? `${Math.floor(snapshot.uptime_s)}s` : "—";

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-edge bg-panel/70 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="2" />
            <path d="M8.5 8.5a5 5 0 0 1 7 0M5.5 5.5a9 9 0 0 1 13 0" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-none tracking-tight text-white">
            Optikos <span className="text-accent">·</span>{" "}
            <span className="text-slate-400 text-sm font-normal">WiFi Spatial Sensing</span>
          </h1>
          <p className="text-[11px] text-slate-500">
            Reading motion & presence from live WiFi signal on{" "}
            <span className="font-mono text-slate-400">{snapshot?.interface ?? "…"}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1 text-[11px]">
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-accent animate-pulse2" : "bg-warn animate-pulse2"}`}
          />
          <span className="font-medium">{live ? "LIVE" : conn.toUpperCase()}</span>
        </div>
        <Pill label="signal" value={realRssi ? "real (CoreWLAN)" : "simulated"} tone={realRssi ? "good" : "warn"} />
        <Pill label="scan" value={snapshot?.scan_source ?? "…"} />
        <Pill label="uptime" value={uptime} />
        <a
          href="/api/export.csv"
          className="rounded-lg border border-edge px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-edge"
          title="Download the raw RSSI time series as CSV"
        >
          CSV
        </a>
        <a
          href="/api/export.json"
          className="rounded-lg border border-edge px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:bg-edge"
          title="Download the full dataset (raw + derived signals) as JSON"
        >
          JSON
        </a>
        <button
          onClick={onRecalibrate}
          className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-medium text-accent transition hover:bg-accent/20"
        >
          Recalibrate baseline
        </button>
      </div>
    </header>
  );
}
