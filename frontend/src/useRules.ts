import { useCallback, useEffect, useState } from "react";
import type { Rule } from "./types";

export interface NewRule {
  name: string;
  trigger: Rule["trigger"];
  action_type: Rule["action_type"];
  target: string;
  zone?: string | null;
  min_count?: number;
}

export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/rules");
      const d = await r.json();
      setRules(d.rules ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const add = useCallback(
    async (rule: NewRule) => {
      setBusy(true);
      try {
        const r = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
        await refresh();
        return r.ok;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      await fetch(`/api/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await fetch(`/api/rules/${id}`, { method: "DELETE" });
      await refresh();
    },
    [refresh],
  );

  return { rules, busy, add, toggle, remove, refresh };
}
