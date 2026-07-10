import { useCallback, useEffect, useState } from "react";
import type { Zone } from "./types";

export function useZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/zones");
      const d = await r.json();
      setZones(d.zones ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const capture = useCallback(
    async (name: string) => {
      setBusy(true);
      try {
        await fetch("/api/zones/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
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
      await fetch(`/api/zones/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  return { zones, busy, capture, remove, refresh };
}
