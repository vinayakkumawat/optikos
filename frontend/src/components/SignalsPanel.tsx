import type { Snapshot } from "../types";
import { Card } from "./Card";

type Row = { label: string; value: string; live: boolean };

function fmt(v: number | null | undefined, digits = 0, unit = ""): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}${unit ? ` ${unit}` : ""}`;
}

function bool(v: boolean | undefined): string {
  return v ? "yes" : "no";
}

export function SignalsPanel({ snapshot }: { snapshot: Snapshot | null }) {
  const s = snapshot?.sensing ?? null;
  const h = snapshot?.link_health;
  const m = snapshot?.multi_ap;
  const loc = snapshot?.location ?? null;
  const ch = snapshot?.channels;
  const cur = (snapshot?.routers ?? []).find((r) => r.is_current) ?? null;
  const rec24 = ch?.recommendations?.find((r) => r.band === "2.4GHz");
  const rec5 = ch?.recommendations?.find((r) => r.band === "5GHz");

  const groups: { title: string; tag: string; rows: Row[] }[] = [
    {
      title: "Raw radio",
      tag: "measured",
      rows: [
        { label: "Signal (RSSI)", value: fmt(s?.rssi_dbm, 0, "dBm"), live: s?.rssi_dbm != null },
        { label: "Noise floor", value: fmt(s?.noise_dbm, 0, "dBm"), live: s?.noise_dbm != null },
        { label: "SNR", value: fmt(s?.snr_db, 0, "dB"), live: s?.snr_db != null },
        { label: "Tx rate", value: fmt(h?.tx_rate_mbps, 0, "Mbps"), live: h?.tx_rate_mbps != null },
        { label: "Channel", value: cur?.channel != null ? `${cur.channel}` : "—", live: cur?.channel != null },
        { label: "Band", value: cur?.band ?? "—", live: !!cur?.band },
        { label: "Security", value: cur?.security ?? "—", live: !!cur?.security },
        { label: "PHY mode", value: cur?.phy_mode ?? "—", live: !!cur?.phy_mode },
        { label: "BSSID", value: cur?.bssid ?? "hidden", live: !!cur?.bssid },
        { label: "Distance est.", value: fmt(cur?.distance_m, 1, "m"), live: cur?.distance_m != null },
      ],
    },
    {
      title: "Motion & presence",
      tag: "DSP",
      rows: [
        { label: "Motion score", value: fmt(s?.motion_score, 0, "/100"), live: s?.motion_score != null },
        { label: "Motion state", value: s?.motion_state ?? "—", live: !!s?.motion_state },
        { label: "Presence", value: s ? bool(s.presence) : "—", live: !!s },
        { label: "Presence conf.", value: fmt(s ? s.presence_confidence * 100 : null, 0, "%"), live: !!s },
        { label: "Baseline σ", value: fmt(s?.baseline_std, 2, "dB"), live: s?.baseline_std != null },
        { label: "Calibrated", value: s ? bool(s.calibrated) : "—", live: !!s },
      ],
    },
    {
      title: "Occupancy & vitals",
      tag: "DSP",
      rows: [
        { label: "Occupancy est.", value: s?.occupancy_estimate ?? "—", live: !!s?.occupancy_estimate },
        { label: "Breathing", value: fmt(s?.breathing_bpm, 0, "bpm"), live: s?.breathing_bpm != null },
        { label: "Breathing conf.", value: fmt(s ? s.breathing_confidence * 100 : null, 0, "%"), live: !!s?.breathing_bpm },
        { label: "Spectrum peak", value: fmt(s?.spectrum?.peak_hz, 2, "Hz"), live: s?.spectrum?.peak_hz != null },
      ],
    },
    {
      title: "Spatial",
      tag: "multi-link + fingerprint",
      rows: [
        { label: "Nearby APs", value: `${snapshot?.routers?.length ?? 0}`, live: (snapshot?.routers?.length ?? 0) > 0 },
        { label: "Active links", value: m ? `${m.active_links}/${m.total_links}` : "—", live: !!m?.available },
        { label: "Spatial activity", value: fmt(m?.spatial_activity, 0, "/100"), live: !!m?.available },
        { label: "Current room", value: loc?.zone_name ?? "—", live: !!loc },
        { label: "Room match conf.", value: fmt(loc ? loc.confidence * 100 : null, 0, "%"), live: !!loc },
      ],
    },
    {
      title: "Environment",
      tag: "scan",
      rows: [
        { label: "Best 2.4GHz ch", value: rec24 ? `${rec24.channel}` : "—", live: !!rec24 },
        { label: "Best 5GHz ch", value: rec5 ? `${rec5.channel}` : "—", live: !!rec5 },
        { label: "RSSI source", value: snapshot?.rssi_source ?? "—", live: !!snapshot },
        { label: "Scan source", value: snapshot?.scan_source ?? "—", live: !!snapshot },
      ],
    },
  ];

  const liveCount = groups.reduce((acc, g) => acc + g.rows.filter((r) => r.live).length, 0);
  const totalCount = groups.reduce((acc, g) => acc + g.rows.length, 0);

  return (
    <Card
      title="Signals Extracted from One Wi-Fi Link"
      subtitle="Everything Optikos derives from a single associated access point, live"
      right={
        <span className="font-mono text-sm">
          <span className="text-accent">{liveCount}</span>
          <span className="text-slate-500">/{totalCount} live</span>
        </span>
      }
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.title} className="rounded-xl border border-edge bg-panel2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-200">{g.title}</span>
              <span className="rounded bg-edge px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">
                {g.tag}
              </span>
            </div>
            <div className="space-y-1">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-slate-500">{r.label}</span>
                  <span
                    className={`shrink-0 font-mono ${r.live ? "text-slate-100" : "text-slate-600"}`}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        One radio, one signal-strength number sampled ~8×/second — decomposed into{" "}
        <span className="text-accent">{totalCount}+ distinct signals</span> across raw radio, DSP,
        spatial and environmental layers. This is the whole thesis: how much can you squeeze from a
        single Wi-Fi link, in software alone.
      </p>
    </Card>
  );
}
