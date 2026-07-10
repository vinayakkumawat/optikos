import type { Sensing } from "../types";
import { Card } from "./Card";

export function OccupancyCard({ s }: { s: Sensing | null }) {
  const hint = s?.occupancy_hint ?? 0;
  const label = s?.occupancy_estimate ?? "empty";

  return (
    <Card title="Occupancy Estimate" subtitle="Coarse activity level — not an exact head-count">
      <div className="flex items-center gap-4 py-2">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col-reverse"
              title={`level ${i}`}
            >
              <div
                className={`w-6 rounded transition-all ${
                  i <= hint ? "bg-accent2" : "bg-edge"
                }`}
                style={{ height: `${18 + i * 14}px` }}
              />
            </div>
          ))}
        </div>
        <div>
          <div className="text-lg font-semibold capitalize text-white">{label}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            derived from sustained motion energy
          </div>
        </div>
      </div>
      <p className="mt-2 rounded-lg bg-panel2 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
        A single WiFi link can't truly separate individuals. This is an
        <span className="text-warn"> estimate</span>. Precise counting needs
        CSI hardware (ESP32-S3) or multiple sensors.
      </p>
    </Card>
  );
}
