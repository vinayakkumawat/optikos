import { useEffect, useRef } from "react";
import type { RouterNode } from "../types";
import { Card } from "./Card";

export function RouterRadar({ routers }: { routers: RouterNode[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const routersRef = useRef<RouterNode[]>(routers);
  routersRef.current = routers;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let angle = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) / 2 - 14;

      const rt = routersRef.current;
      const maxDist = Math.max(10, ...rt.filter((r) => !r.is_current).map((r) => r.distance_m));
      const scale = radius / maxDist;

      // rings + labels
      ctx.strokeStyle = "rgba(51,224,200,0.14)";
      ctx.fillStyle = "rgba(120,160,180,0.5)";
      ctx.font = "9px ui-monospace, monospace";
      const ringMeters = [maxDist * 0.33, maxDist * 0.66, maxDist];
      ringMeters.forEach((m) => {
        const rr = m * scale;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(`${m.toFixed(0)}m`, cx + 3, cy - rr + 10);
      });
      // cross-hairs
      ctx.beginPath();
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy);
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius);
      ctx.stroke();

      // sweep
      const grad = ctx.createConicGradient
        ? ctx.createConicGradient(angle, cx, cy)
        : null;
      if (grad) {
        grad.addColorStop(0, "rgba(51,224,200,0.25)");
        grad.addColorStop(0.08, "rgba(51,224,200,0.0)");
        grad.addColorStop(1, "rgba(51,224,200,0.0)");
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle - 0.6, angle);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // center (you)
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#4d8dff";
      ctx.fill();
      ctx.fillStyle = "rgba(200,220,255,0.8)";
      ctx.fillText("YOU", cx + 8, cy + 4);

      // access points
      rt.forEach((r) => {
        if (r.is_current) return;
        const px = cx + r.x * scale;
        const py = cy + r.y * scale;
        const strong = r.rssi_dbm >= -60;
        const mid = r.rssi_dbm >= -75;
        const color = strong ? "#33e0c8" : mid ? "#ffb020" : "#ff5470";
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "rgba(219,228,243,0.75)";
        ctx.font = "10px ui-sans-serif, system-ui";
        const name = r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name;
        ctx.fillText(name, px + 7, py + 3);
        ctx.globalAlpha = 1;
      });

      angle += 0.03;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Card
      title="Router Map (radar)"
      subtitle="Nearby access points placed by estimated distance from you"
      right={<span className="font-mono text-sm text-accent">{routers.length} APs</span>}
    >
      <canvas ref={canvasRef} className="aspect-square w-full" />
      <div className="mt-2 flex justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent" /> strong</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warn" /> medium</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" /> weak</span>
      </div>
    </Card>
  );
}
