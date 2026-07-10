import { useState } from "react";
import type { LocationMatch, Zone } from "../types";
import { Card } from "./Card";
import { useZones } from "../useZones";

function confidenceColor(c: number) {
  if (c >= 0.7) return "#33e0c8";
  if (c >= 0.4) return "#ffb020";
  return "#ff5470";
}

export function RoomsPanel({ location }: { location: LocationMatch | null }) {
  const { zones, busy, capture, remove } = useZones();
  const [name, setName] = useState("");

  const onCapture = async () => {
    const n = name.trim();
    if (!n) return;
    await capture(n);
    setName("");
  };

  return (
    <Card
      title="Rooms — WiFi Fingerprint Map"
      subtitle="Walk the laptop to each room, capture its signal fingerprint, then Optikos detects which room you're in"
      right={<span className="font-mono text-sm text-accent">{zones.length} rooms</span>}
    >
      {/* Live "you are here" */}
      <div className="mb-3 rounded-xl border border-edge bg-panel2 p-3">
        <div className="text-[11px] uppercase tracking-widest text-slate-500">
          You are probably in
        </div>
        {zones.length === 0 ? (
          <div className="mt-1 text-sm text-slate-400">
            No rooms captured yet — capture your first spot below.
          </div>
        ) : location ? (
          <>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span
                className="text-2xl font-bold"
                style={{ color: confidenceColor(location.confidence) }}
              >
                {location.zone_name}
              </span>
              <span className="text-[11px] text-slate-500">
                {Math.round(location.confidence * 100)}% match
              </span>
            </div>
            {location.ranking.length > 1 && (
              <div className="mt-2 space-y-1">
                {location.ranking.slice(0, 3).map((r) => (
                  <div key={r.zone_id} className="flex items-center gap-2">
                    <span className="w-24 truncate text-[11px] text-slate-400">{r.name}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round(r.confidence * 100)}%`,
                          background: confidenceColor(r.confidence),
                        }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-[10px] text-slate-500">
                      {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="mt-1 text-sm text-slate-400">Locating…</div>
        )}
      </div>

      {/* Capture control */}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCapture()}
          placeholder="Room name (e.g. Kitchen)"
          className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/50"
        />
        <button
          onClick={onCapture}
          disabled={busy || !name.trim()}
          className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
        >
          {busy ? "Capturing…" : "Capture spot"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Stand in the room, then capture. Re-capturing the same name refines its fingerprint.
      </p>

      {/* Room list */}
      {zones.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {zones.map((z: Zone) => {
            const here = location?.zone_id === z.id;
            return (
              <div
                key={z.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  here ? "border-accent/50 bg-accent/5" : "border-edge bg-panel2"
                }`}
              >
                <div className="flex items-center gap-2">
                  {here && <span className="h-2 w-2 rounded-full bg-accent animate-pulse2" />}
                  <span className="font-medium text-slate-200">{z.name}</span>
                  <span className="text-[10px] text-slate-500">
                    {z.ap_count} APs · {z.samples} sample{z.samples > 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => remove(z.id)}
                  className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-danger/10 hover:text-danger"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
