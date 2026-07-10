import { useEffect, useRef } from "react";
import type { CoverageSample } from "../types";
import { Card } from "./Card";
import { useCoverage } from "../useCoverage";

const RSSI_MIN = -85;
const RSSI_MAX = -40;

function rssiToColor(rssi: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (rssi - RSSI_MIN) / (RSSI_MAX - RSSI_MIN)));
  // red (weak) -> yellow -> green (strong)
  const r = t < 0.5 ? 255 : Math.round(255 * (1 - (t - 0.5) * 2));
  const g = t < 0.5 ? Math.round(255 * (t * 2)) : 255;
  return [r, g, 60];
}

export function CoveragePanel() {
  const { samples, busy, drop, clear } = useCoverage();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // background
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, W, H);

    const pts = samples.filter((s) => s.rssi_dbm != null) as (CoverageSample & { rssi_dbm: number })[];

    if (pts.length >= 1) {
      // IDW heatmap on a coarse grid
      const cell = 12;
      for (let gx = 0; gx < W; gx += cell) {
        for (let gy = 0; gy < H; gy += cell) {
          const px = gx + cell / 2;
          const py = gy + cell / 2;
          let wsum = 0;
          let vsum = 0;
          for (const p of pts) {
            const dx = px - p.x * W;
            const dy = py - p.y * H;
            const d2 = dx * dx + dy * dy + 1;
            const w = 1 / (d2 * d2 / 1e6 + 0.02);
            wsum += w;
            vsum += w * p.rssi_dbm;
          }
          const rssi = vsum / wsum;
          const [r, g, b] = rssiToColor(rssi);
          ctx.fillStyle = `rgba(${r},${g},${b},0.5)`;
          ctx.fillRect(gx, gy, cell, cell);
        }
      }
    }

    // grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += W / 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += H / 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // sample points
    for (const p of samples) {
      const px = p.x * W;
      const py = p.y * H;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      if (p.rssi_dbm != null) {
        const [r, g, b] = rssiToColor(p.rssi_dbm);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      } else {
        ctx.fillStyle = "#64748b";
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (p.rssi_dbm != null) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(p.rssi_dbm)}`, px, py - 9);
      }
    }
  }, [samples]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    drop(Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)));
  };

  return (
    <Card
      title="Coverage / Dead-Zone Map"
      subtitle="Walk around your space; click the map where you're standing to record the signal there"
      right={
        <button
          onClick={clear}
          disabled={samples.length === 0}
          className="rounded px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-danger/10 hover:text-danger disabled:opacity-30"
        >
          Clear
        </button>
      }
    >
      <canvas
        ref={canvasRef}
        width={520}
        height={340}
        onClick={onClick}
        className="w-full cursor-crosshair rounded-xl border border-edge"
        style={{ aspectRatio: "520 / 340" }}
      />
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {samples.length === 0
            ? "Click where you are standing to drop your first signal reading."
            : `${samples.length} reading${samples.length > 1 ? "s" : ""} · ${busy ? "capturing…" : "click to add more"}`}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "rgb(255,70,60)" }} /> weak
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "rgb(60,255,60)" }} /> strong
          </span>
        </span>
      </div>
    </Card>
  );
}
