"""Sensing engine: background acquisition threads + shared live state.

Two daemon threads:
  * RSSI loop  - polls the connected AP at `rssi_hz` and feeds the analyzer.
  * Scan loop  - refreshes the nearby-AP map every `scan_interval_s`.

The FastAPI layer reads `snapshot()` and streams it to dashboards. Keeping
acquisition in plain threads avoids blocking the asyncio event loop on the
slow `system_profiler` scan and the (fast but synchronous) CoreWLAN reads.
"""

from __future__ import annotations

import threading
import time
from dataclasses import asdict

from .automation import RuleStore
from .config import CONFIG
from .coverage import CoverageStore
from .dsp.analyzer import RSSIAnalyzer
from .gesture import GestureDetector
from .link_health import LinkHealthTracker
from .mapping import build_map, channel_analysis, map_summary
from .multi_ap import MultiAPMotion
from .wifi.rssi import RSSIReader
from .wifi.scanner import APScanner
from .zones import ZoneStore


class SensingEngine:
    def __init__(self, force_simulated: bool = False) -> None:
        self.reader = RSSIReader(force_simulated=force_simulated)
        self.scanner = APScanner(force_simulated=force_simulated)
        self.analyzer = RSSIAnalyzer()

        self.zones = ZoneStore()
        self.coverage = CoverageStore()
        self.rules = RuleStore()
        self.health = LinkHealthTracker(hz=CONFIG.sampling.rssi_hz)
        self.gestures = GestureDetector()
        self.multi = MultiAPMotion()

        self._lock = threading.Lock()
        self._latest_state = None
        self._map_nodes: list[dict] = []
        self._map_summary: dict = {}
        self._channels: dict = {}
        self._location: dict | None = None
        self._multi: dict = {"available": False}
        self._running = False

        # Transition state for automations.
        self._prev_presence = False
        self._prev_motion_active = False
        self._prev_zone: str | None = None
        self._last_gesture_ts = 0.0
        self._threads: list[threading.Thread] = []
        self.started_at = time.time()

    # ---- lifecycle -------------------------------------------------------
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._threads = [
            threading.Thread(target=self._rssi_loop, daemon=True),
            threading.Thread(target=self._scan_loop, daemon=True),
        ]
        for t in self._threads:
            t.start()

    def stop(self) -> None:
        self._running = False

    # ---- acquisition loops ----------------------------------------------
    def _rssi_loop(self) -> None:
        period = 1.0 / CONFIG.sampling.rssi_hz
        while self._running:
            t0 = time.time()
            try:
                s = self.reader.read()
                self.analyzer.add_sample(s.rssi_dbm, s.noise_dbm, s.timestamp)
                self.health.add(s.rssi_dbm, s.noise_dbm, s.tx_rate_mbps)
                self.gestures.add(s.rssi_dbm)
                state = self.analyzer.analyze(self.reader.mode)
                with self._lock:
                    self._latest_state = state
                self._check_automations(state)
            except Exception:
                pass
            sleep = period - (time.time() - t0)
            if sleep > 0:
                time.sleep(sleep)

    def _scan_loop(self) -> None:
        while self._running:
            try:
                aps = self.scanner.scan()
                nodes = build_map(aps)
                summary = map_summary(nodes)
                channels = channel_analysis(nodes)
                location = self.zones.match(nodes)
                self.multi.update(nodes)
                multi = self.multi.snapshot()
                with self._lock:
                    self._map_nodes = nodes
                    self._map_summary = summary
                    self._channels = channels
                    self._location = location
                    self._multi = multi
                # Fire room_enter automations on zone change.
                zone_name = location["zone_name"] if location else None
                if zone_name and zone_name != self._prev_zone:
                    self.rules.fire("room_enter", {"zone": zone_name})
                self._prev_zone = zone_name
            except Exception:
                pass
            # Sleep in small increments so stop() is responsive.
            waited = 0.0
            while self._running and waited < CONFIG.sampling.scan_interval_s:
                time.sleep(0.5)
                waited += 0.5

    # ---- automations -----------------------------------------------------
    def _check_automations(self, state) -> None:
        presence = state.presence
        motion_active = state.motion_state == "active"

        if presence and not self._prev_presence:
            self.rules.fire("arrive", {"motion": state.motion_score})
        elif not presence and self._prev_presence:
            self.rules.fire("leave", {})
        if motion_active and not self._prev_motion_active:
            self.rules.fire("motion", {"score": state.motion_score})

        for ev in self.gestures.consume_new_since(self._last_gesture_ts):
            self._last_gesture_ts = max(self._last_gesture_ts, ev["ts"])
            self.rules.fire("gesture", ev)

        self._prev_presence = presence
        self._prev_motion_active = motion_active

    # ---- read side -------------------------------------------------------
    def recalibrate(self) -> None:
        self.analyzer.reset_calibration()

    # coverage
    def add_coverage(self, x: float, y: float) -> dict:
        with self._lock:
            state = self._latest_state
        rssi = state.rssi_dbm if state is not None else None
        return self.coverage.add(x, y, rssi)

    def list_coverage(self) -> list[dict]:
        return self.coverage.list()

    def delete_coverage(self, sample_id: str) -> bool:
        return self.coverage.delete(sample_id)

    def clear_coverage(self) -> None:
        self.coverage.clear()

    def capture_zone(self, name: str) -> dict:
        with self._lock:
            nodes = list(self._map_nodes)
            state = self._latest_state
        connected = state.rssi_dbm if state is not None else None
        zone = self.zones.capture(name, nodes, connected)
        # Refresh the live match immediately against the new zone set.
        with self._lock:
            self._location = self.zones.match(nodes)
        return zone.to_dict()

    def list_zones(self) -> list[dict]:
        return self.zones.list()

    def delete_zone(self, zone_id: str) -> bool:
        ok = self.zones.delete(zone_id)
        with self._lock:
            nodes = list(self._map_nodes)
        self._location = self.zones.match(nodes)
        return ok

    def export_json(self) -> dict:
        """Full data export: metadata, raw RSSI series, derived state, routers."""
        ts, rssi = self.analyzer.history_series()
        snap = self.snapshot()
        return {
            "meta": {
                "app": "Optikos",
                "exported_at": time.time(),
                "rssi_source": self.reader.mode,
                "scan_source": self.scanner.mode,
                "interface": self.reader.interface_name(),
                "sample_rate_hz": CONFIG.sampling.rssi_hz,
                "samples": len(rssi),
            },
            "rssi_series": [
                {"t": round(t, 3), "rssi_dbm": round(r, 1)} for t, r in zip(ts, rssi)
            ],
            "derived_state": snap.get("sensing"),
            "multi_ap": snap.get("multi_ap"),
            "link_health": snap.get("link_health"),
            "routers": snap.get("routers"),
            "channels": snap.get("channels"),
            "location": snap.get("location"),
        }

    def export_csv(self) -> str:
        """Raw connected-link RSSI time series as CSV."""
        ts, rssi = self.analyzer.history_series()
        lines = ["timestamp_unix,rssi_dbm"]
        lines.extend(f"{round(t, 3)},{round(r, 1)}" for t, r in zip(ts, rssi))
        return "\n".join(lines) + "\n"

    def snapshot(self) -> dict:
        with self._lock:
            state = self._latest_state
            nodes = self._map_nodes
            summary = self._map_summary
            channels = self._channels
            location = self._location
            multi = self._multi
        sensing = asdict(state) if state is not None else None
        return {
            "type": "state",
            "time": time.time(),
            "uptime_s": round(time.time() - self.started_at, 1),
            "rssi_source": self.reader.mode,
            "scan_source": self.scanner.mode,
            "interface": self.reader.interface_name(),
            "sensing": sensing,
            "routers": nodes,
            "router_summary": summary,
            "channels": channels,
            "location": location,
            "zone_count": len(self.zones.list()),
            "link_health": self.health.snapshot(),
            "gestures": self.gestures.snapshot(),
            "multi_ap": multi,
        }
