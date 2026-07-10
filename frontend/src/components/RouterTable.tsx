import type { RouterNode, RouterSummary } from "../types";
import { Card } from "./Card";

function bars(rssi: number) {
  // -30 (great) .. -90 (poor) mapped to 0-4 bars
  const level = Math.max(0, Math.min(4, Math.round((rssi + 90) / 15)));
  return (
    <span className="inline-flex items-end gap-0.5 align-middle">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1 rounded-sm ${i < level ? "bg-accent" : "bg-edge"}`}
          style={{ height: `${4 + i * 3}px` }}
        />
      ))}
    </span>
  );
}

export function RouterTable({
  routers,
  summary,
}: {
  routers: RouterNode[];
  summary: RouterSummary | undefined;
}) {
  return (
    <Card
      title="Detected Routers"
      subtitle="Everything your WiFi radio can currently hear"
      right={
        summary ? (
          <div className="flex gap-2 text-[11px]">
            {Object.entries(summary.bands).map(([b, n]) => (
              <span key={b} className="rounded border border-edge px-1.5 py-0.5 text-slate-400">
                {b}: {n}
              </span>
            ))}
          </div>
        ) : null
      }
    >
      <div className="max-h-[340px] overflow-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-0 bg-panel text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1.5 pr-2">Network</th>
              <th className="px-2">Signal</th>
              <th className="px-2">Dist</th>
              <th className="px-2">Band</th>
              <th className="px-2">Ch</th>
              <th className="px-2">Security</th>
            </tr>
          </thead>
          <tbody>
            {routers.map((r) => (
              <tr
                key={r.key}
                className={`border-t border-edge/50 ${r.is_current ? "bg-accent/5" : ""}`}
              >
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="max-w-[130px] truncate font-medium text-slate-200">
                      {r.name}
                    </span>
                    {r.hidden && (
                      <span
                        title="macOS hid this network's name (enable Location Services to reveal it)"
                        className="rounded bg-slate-600/30 px-1 text-[9px] font-semibold text-slate-400"
                      >
                        NAME HIDDEN
                      </span>
                    )}
                    {r.is_current && (
                      <span className="rounded bg-accent/20 px-1 text-[9px] font-semibold text-accent">
                        YOU
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 font-mono text-slate-300">
                  {bars(r.rssi_dbm)} <span className="ml-1">{r.rssi_dbm}</span>
                </td>
                <td className="px-2 font-mono text-slate-400">~{r.distance_m}m</td>
                <td className="px-2 text-slate-400">{r.band ?? "—"}</td>
                <td className="px-2 font-mono text-slate-400">{r.channel ?? "—"}</td>
                <td className="px-2 text-slate-500">{r.security ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
