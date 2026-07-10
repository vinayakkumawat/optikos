import { useEffect, useRef } from "react";
import type { Sensing } from "../types";
import { Card } from "./Card";

export function SignalChart({ s }: { s: Sensing | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const data = s?.history ?? [];
    // Fixed dBm scale so the trace is comparable over time.
    const min = -90;
    const max = -20;
    const pad = 8;

    // grid
    ctx.strokeStyle = "rgba(30,44,71,0.7)";
    ctx.lineWidth = 1;
    ctx.font = "10px ui-monospace, monospace";
    ctx.fillStyle = "rgba(120,140,170,0.6)";
    for (let dbm = -20; dbm >= -90; dbm -= 20) {
      const y = pad + ((max - dbm) / (max - min)) * (h - pad * 2);
      ctx.beginPath();
      ctx.moveTo(28, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(`${dbm}`, 2, y + 3);
    }

    if (data.length > 1) {
      const x0 = 28;
      const step = (w - x0) / (data.length - 1);
      const yOf = (v: number) =>
        pad + ((max - Math.max(min, Math.min(max, v))) / (max - min)) * (h - pad * 2);

      // area fill
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(51,224,200,0.35)");
      grad.addColorStop(1, "rgba(51,224,200,0.02)");
      ctx.beginPath();
      ctx.moveTo(x0, h - pad);
      data.forEach((v, i) => ctx.lineTo(x0 + i * step, yOf(v)));
      ctx.lineTo(x0 + (data.length - 1) * step, h - pad);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // line
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = x0 + i * step;
        const y = yOf(v);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#33e0c8";
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // last point
      const lx = x0 + (data.length - 1) * step;
      const ly = yOf(data[data.length - 1]);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#33e0c8";
      ctx.fill();
    }
  }, [s]);

  return (
    <Card
      title="Live WiFi Signal (RSSI)"
      subtitle="Fluctuation in this trace = movement disturbing the radio waves"
      right={
        <div className="text-right">
          <div className="font-mono text-lg font-bold text-accent">
            {s ? `${s.rssi_dbm} dBm` : "—"}
          </div>
          {s?.snr_db != null && (
            <div className="text-[11px] text-slate-500">SNR {Math.round(s.snr_db)} dB</div>
          )}
        </div>
      }
    >
      <canvas ref={canvasRef} className="h-40 w-full" />
    </Card>
  );
}
