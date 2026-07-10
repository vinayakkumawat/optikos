"""Gesture / knock detection from sharp RSSI spikes.

A hand waved close to the laptop (or a knock on the desk it sits on) briefly
and strongly perturbs the antenna's signal, producing a short RSSI spike that
stands out from ordinary room motion. We detect those spikes, debounce them,
and group rapid sequences into single / double / triple "waves".

This is a fun, best-effort feature — sensitivity depends on the laptop and how
close the gesture is to the antenna.
"""

from __future__ import annotations

import threading
import time
from collections import deque


class GestureDetector:
    def __init__(
        self,
        spike_dbm: float = 7.0,
        debounce_s: float = 0.35,
        sequence_gap_s: float = 1.2,
    ) -> None:
        self._recent = deque(maxlen=24)  # recent RSSI for a fast local baseline
        self._spike_dbm = spike_dbm
        self._debounce_s = debounce_s
        self._sequence_gap_s = sequence_gap_s
        self._last_spike_ts = 0.0
        self._pending_spikes: list[float] = []
        self._events: deque = deque(maxlen=20)
        self._lock = threading.Lock()

    def add(self, rssi: float) -> None:
        now = time.time()
        self._recent.append(rssi)
        if len(self._recent) < 6:
            return
        # Local baseline = median of the recent window excluding the newest few.
        window = list(self._recent)[:-2]
        baseline = sorted(window)[len(window) // 2]
        deviation = abs(rssi - baseline)

        if deviation >= self._spike_dbm and (now - self._last_spike_ts) >= self._debounce_s:
            self._last_spike_ts = now
            self._pending_spikes.append(now)

        self._flush_sequences(now)

    def _flush_sequences(self, now: float) -> None:
        if not self._pending_spikes:
            return
        # If enough time has passed since the last spike, finalize the sequence.
        if now - self._pending_spikes[-1] >= self._sequence_gap_s:
            count = len(self._pending_spikes)
            kind = {1: "wave", 2: "double-wave", 3: "triple-wave"}.get(
                count, f"{count}x-wave"
            )
            with self._lock:
                self._events.append({"ts": self._pending_spikes[0], "type": kind, "count": count})
            self._pending_spikes = []

    def snapshot(self) -> dict:
        with self._lock:
            events = list(self._events)
        last = events[-1] if events else None
        # "Active" flag if a gesture happened in the last 2.5s (for UI flash).
        active = bool(last and time.time() - last["ts"] < 2.5)
        return {
            "last": last,
            "active": active,
            "recent": events[-8:],
            "total": len(events),
        }

    def consume_new_since(self, ts: float) -> list[dict]:
        """Return gesture events that finalized after `ts` (for automation)."""
        with self._lock:
            return [e for e in self._events if e["ts"] > ts]
