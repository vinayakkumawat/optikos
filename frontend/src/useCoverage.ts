import { useCallback, useEffect, useState } from "react";
import type { CoverageSample } from "./types";

export function useCoverage() {
  const [samples, setSamples] = useState<CoverageSample[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/coverage");
      const d = await r.json();
      setSamples(d.samples ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const drop = useCallback(
    async (x: number, y: number) => {
      setBusy(true);
      try {
        await fetch("/api/coverage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x, y }),
        });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/coverage/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  const clear = useCallback(async () => {
    await fetch("/api/coverage", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  return { samples, busy, drop, remove, clear, refresh };
}
