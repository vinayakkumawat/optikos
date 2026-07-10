import { useEffect, useRef } from "react";
import type { Sensing } from "../types";
import { Card } from "./Card";

export function SpectrumCard({ s }: { s: Sensing | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spec = s?.spectrum;
  const peakHz = spec?.peak_hz;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, W, H);

    const freqs = spec?.freqs_hz ?? [];
    const mag = spec?.mag ?? [];

    // Highlight the respiration band 0.1-0.6 Hz.
    if (freqs.length) {
      const fmin = freqs[0];
      const fmax = freqs[freqs.length - 1];
      const xOf = (f: number) => ((f - fmin) / (fmax - fmin || 1)) * W;
      ctx.fillStyle = "rgba(51,224,200,0.08)";
      ctx.fillRect(xOf(0.1), 0, xOf(0.6) - xOf(0.1), H);
    }

    // Bars.
    if (mag.length > 1) {
      const bw = W / mag.length;
      for (let i = 0; i < mag.length; i++) {
        const h = Math.max(1, mag[i] * (H - 14));
        const isPeak =
          peakHz != null && Math.abs((freqs[i] ?? -1) - peakHz) < 0.02;
        ctx.fillStyle = isPeak ? "#33e0c8" : "#4d8dff";
        ctx.fillRect(i * bw, H - h - 12, Math.max(1, bw - 1), h);
      }
    } else {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("gathering signal…", W / 2, H / 2);
    }

    // Frequency axis labels.
    ctx.fillStyle = "rgba(148,163,184,0.7)";
    ctx.font = "9px ui-monospace, monospace";
    ctx.textAlign = "center";
    const fmax = freqs.length ? freqs[freqs.length - 1] : 2;
    [0, 0.5, 1, 1.5, 2].forEach((f) => {
      if (f <= fmax) {
        const x = (f / fmax) * W;
        ctx.fillText(`${f}Hz`, x, H - 2);
      }
    });
  }, [spec, peakHz]);

  return (
    <Card
      title="RSSI Frequency Spectrum"
      subtitle="Live FFT of the signal — periodic movement shows up as peaks"
      right={
        <span className="font-mono text-xs text-slate-400">
          {peakHz != null ? `peak ${peakHz.toFixed(2)}Hz` : "—"}
        </span>
      }
    >
      <canvas
        ref={canvasRef}
        width={520}
        height={140}
        className="w-full rounded-lg border border-edge"
        style={{ aspectRatio: "520 / 140" }}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        The connected-link RSSI is detrended, windowed (Hann) and transformed with an FFT. The
        shaded band (0.1–0.6&nbsp;Hz = 6–36&nbsp;breaths/min) is where a still person's breathing
        would appear. A sharp peak there is the (experimental) breathing estimate.
      </p>
    </Card>
  );
}
