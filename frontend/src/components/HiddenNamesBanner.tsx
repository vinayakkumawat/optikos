import { useState } from "react";
import type { RouterNode } from "../types";

export function HiddenNamesBanner({ routers }: { routers: RouterNode[] }) {
  const [dismissed, setDismissed] = useState(false);
  const hiddenCount = routers.filter((r) => r.hidden).length;

  if (dismissed || hiddenCount === 0) return null;

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
      <div className="mt-0.5 text-warn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" />
        </svg>
      </div>
      <div className="flex-1 text-[12px] leading-relaxed text-slate-300">
        <span className="font-semibold text-warn">
          {hiddenCount} network{hiddenCount > 1 ? "s have" : " has"} hidden names.
        </span>{" "}
        macOS masks WiFi network names (SSIDs) unless the app has Location
        access, so they show as{" "}
        <span className="font-mono text-slate-400">Wi-Fi · band · channel</span>{" "}
        instead. To reveal the real names:
        <span className="mt-1 block text-slate-400">
          <span className="text-slate-300">System Settings → Privacy &amp; Security → Location Services</span>{" "}
          → turn it on → enable the app you launch <span className="font-mono">run.sh</span> from
          (Terminal / iTerm / Cursor) → fully quit &amp; reopen that app.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="rounded-md px-2 py-0.5 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
