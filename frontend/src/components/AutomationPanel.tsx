import { useState } from "react";
import type { Rule } from "../types";
import { Card } from "./Card";
import { useRules } from "../useRules";

const TRIGGERS: { value: Rule["trigger"]; label: string }[] = [
  { value: "arrive", label: "I arrive (presence starts)" },
  { value: "leave", label: "I leave (presence ends)" },
  { value: "motion", label: "Motion becomes active" },
  { value: "gesture", label: "Gesture / wave detected" },
  { value: "room_enter", label: "I enter a room" },
];

function timeAgo(ts: number | null) {
  if (!ts) return "never";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function AutomationPanel() {
  const { rules, busy, add, toggle, remove } = useRules();
  const [trigger, setTrigger] = useState<Rule["trigger"]>("arrive");
  const [actionType, setActionType] = useState<Rule["action_type"]>("command");
  const [target, setTarget] = useState("");
  const [zone, setZone] = useState("");
  const [name, setName] = useState("");
  const [minCount, setMinCount] = useState(2);

  const onAdd = async () => {
    if (!target.trim()) return;
    const ok = await add({
      name: name.trim() || trigger,
      trigger,
      action_type: actionType,
      target: target.trim(),
      zone: trigger === "room_enter" ? zone.trim() || null : null,
      min_count: trigger === "gesture" ? minCount : 1,
    });
    if (ok) {
      setTarget("");
      setName("");
      setZone("");
    }
  };

  const placeholder =
    actionType === "command"
      ? 'Shell command, e.g. osascript -e \'display notification "Welcome"\''
      : "Webhook URL, e.g. http://localhost:1880/hook";

  return (
    <Card
      title="Automations"
      subtitle="Run a command or call a webhook when something happens"
      right={<span className="font-mono text-sm text-accent">{rules.length} rules</span>}
    >
      <div className="space-y-2 rounded-xl border border-edge bg-panel2 p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name (optional)"
          className="w-full rounded-lg border border-edge bg-ink px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/50"
        />
        <div className="flex gap-2">
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as Rule["trigger"])}
            className="flex-1 rounded-lg border border-edge bg-ink px-2 py-2 text-sm text-slate-200 outline-none focus:border-accent/50"
          >
            {TRIGGERS.map((t) => (
              <option key={t.value} value={t.value}>
                When: {t.label}
              </option>
            ))}
          </select>
          <select
            value={actionType}
            onChange={(e) => setActionType(e.target.value as Rule["action_type"])}
            className="w-32 rounded-lg border border-edge bg-ink px-2 py-2 text-sm text-slate-200 outline-none focus:border-accent/50"
          >
            <option value="command">Run command</option>
            <option value="webhook">Call webhook</option>
          </select>
        </div>
        {trigger === "gesture" && (
          <select
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
            className="w-full rounded-lg border border-edge bg-ink px-2 py-2 text-sm text-slate-200 outline-none focus:border-accent/50"
          >
            <option value={1}>Fire on any wave (most sensitive)</option>
            <option value={2}>Require a double-wave (recommended for calls)</option>
            <option value={3}>Require a triple-wave (fewest false triggers)</option>
          </select>
        )}
        {trigger === "room_enter" && (
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Room name (blank = any room). Must match a captured room."
            className="w-full rounded-lg border border-edge bg-ink px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/50"
          />
        )}
        <div className="flex gap-2">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-edge bg-ink px-3 py-2 font-mono text-[12px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent/50"
          />
          <button
            onClick={onAdd}
            disabled={busy || !target.trim()}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Commands run locally with your user privileges. Keep the backend bound to localhost.
        </p>
      </div>

      <div className="mt-3 space-y-1.5">
        {rules.length === 0 && (
          <div className="text-sm text-slate-500">No automations yet. Add one above.</div>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-edge bg-panel2 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggle(r.id, !r.enabled)}
                  className={`h-4 w-7 shrink-0 rounded-full transition ${r.enabled ? "bg-accent/70" : "bg-edge"}`}
                  title={r.enabled ? "Enabled" : "Disabled"}
                >
                  <span
                    className={`block h-3 w-3 rounded-full bg-white transition-transform ${r.enabled ? "translate-x-3.5" : "translate-x-0.5"}`}
                  />
                </button>
                <span className="truncate text-sm font-medium text-slate-200">{r.name}</span>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                <span className="text-accent2">{r.trigger}</span>
                {r.zone ? `:${r.zone}` : ""} → <span className="text-slate-400">{r.action_type}</span>{" "}
                <span className="font-mono text-slate-500">{r.target}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-600">
                fired {r.fire_count}× · last {timeAgo(r.last_fired)}
                {r.last_result && r.last_result !== "ok" ? (
                  <span className="ml-1 text-danger">{r.last_result}</span>
                ) : r.last_fired ? (
                  <span className="ml-1 text-accent">ok</span>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => remove(r.id)}
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-slate-500 transition hover:bg-danger/10 hover:text-danger"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
