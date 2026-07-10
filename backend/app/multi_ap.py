"""Multi-AP motion sensing — spatial diversity from several router links.

The connected-AP RSSI (sampled fast, 8 Hz) drives the primary motion/presence
signal. This module adds a *second* view: it watches how the RSSI to each of
the strongest nearby access points varies across scans. Because each router
sits in a different direction, a person only disturbs the links whose path they
cross. Counting how many *independent* links are being disturbed at once gives a
coarse sense of whether activity is localized (likely one person / one area) or
spread across the room (likely multiple people / areas).

HONESTY: this is limited by the slow scan rate (a few seconds per update) and by
RSSI being a single scalar per link. It improves robustness and adds rough
spatial spread — it is NOT an exact people counter. True counting needs CSI.
"""

from __future__ import annotations

import threading
import time
from collections import deque

import numpy as np

# RSSI std (dB) below which a link is considered "quiet" (scan measurement
# noise floor). Motion is scored as variability above this.
_QUIET_FLOOR_DB = 1.5
_MOTION_SCALE = 16.0
_ACTIVE_THRESHOLD = 22.0  # per-link motion score above which a link is "active"
_MAX_LINKS = 6            # strongest APs to consider
_WIN = 8                  # scans used for the short-term variability window
_MAXLEN = 40


class _Link:
    __slots__ = ("rssi", "name", "band", "channel", "is_current", "last_seen", "min_std")

    def __init__(self) -> None:
        self.rssi: deque = deque(maxlen=_MAXLEN)
        self.name = ""
        self.band = None
        self.channel = None
        self.is_current = False
        self.last_seen = 0.0
        self.min_std = None  # adaptive quiet floor per link


class MultiAPMotion:
    def __init__(self) -> None:
        self._links: dict[str, _Link] = {}
        self._lock = threading.Lock()
        self._last_update = 0.0
        self._scan_rate_s = 0.0

    def update(self, nodes: list[dict]) -> None:
        now = time.time()
        with self._lock:
            if self._last_update:
                dt = now - self._last_update
                # Smooth the observed cadence.
                self._scan_rate_s = (
                    dt if self._scan_rate_s == 0 else self._scan_rate_s * 0.6 + dt * 0.4
                )
            self._last_update = now

            for n in nodes:
                key = n.get("key")
                if not key:
                    continue
                lk = self._links.get(key)
                if lk is None:
                    lk = _Link()
                    self._links[key] = lk
                lk.rssi.append(float(n.get("rssi_dbm", -100.0)))
                lk.name = n.get("name", key)
                lk.band = n.get("band")
                lk.channel = n.get("channel")
                lk.is_current = bool(n.get("is_current"))
                lk.last_seen = now

            # Drop links not seen for a while.
            stale = [k for k, v in self._links.items() if now - v.last_seen > 90]
            for k in stale:
                del self._links[k]

    def _link_motion(self, lk: _Link) -> tuple[float, float, int]:
        """Return (motion_score, std, samples) for one link."""
        n = len(lk.rssi)
        if n < 4:
            return 0.0, 0.0, n
        arr = np.array(list(lk.rssi)[-_WIN:], dtype=float)
        std = float(np.std(arr))
        # Adaptive quiet floor: track the lowest std we've seen for this link.
        if lk.min_std is None:
            lk.min_std = std
        else:
            lk.min_std = min(lk.min_std, std) * 1.0
            # Slowly relax upward so a stuck-low floor can recover.
            lk.min_std = lk.min_std * 0.999 + std * 0.001
        floor = max(_QUIET_FLOOR_DB, (lk.min_std or _QUIET_FLOOR_DB) * 1.1)
        motion = float(np.clip((std - floor) * _MOTION_SCALE, 0, 100))
        return motion, std, n

    def snapshot(self) -> dict:
        with self._lock:
            items = list(self._links.items())
            scan_rate = round(self._scan_rate_s, 1)

        # Rank by mean signal strength; keep the strongest links.
        ranked = []
        for key, lk in items:
            if not lk.rssi:
                continue
            mean_rssi = float(np.mean(list(lk.rssi)[-_WIN:]))
            motion, std, samples = self._link_motion(lk)
            ranked.append(
                {
                    "key": key,
                    "name": lk.name,
                    "band": lk.band,
                    "channel": lk.channel,
                    "is_current": lk.is_current,
                    "rssi_dbm": round(mean_rssi, 1),
                    "motion": round(motion, 1),
                    "std_db": round(std, 2),
                    "samples": samples,
                    "active": motion >= _ACTIVE_THRESHOLD,
                }
            )
        ranked.sort(key=lambda d: d["rssi_dbm"], reverse=True)
        links = ranked[:_MAX_LINKS]

        ready = [l for l in links if l["samples"] >= 5]
        total_links = len(ready)
        active = [l for l in ready if l["active"]]
        active_links = len(active)

        # Spatial activity: blend average motion of active links with how many
        # independent links are lit up.
        if active:
            avg_active_motion = float(np.mean([l["motion"] for l in active]))
        else:
            avg_active_motion = 0.0
        spread_bonus = min(1.0, active_links / 3.0)
        spatial = float(np.clip(avg_active_motion * (0.6 + 0.4 * spread_bonus), 0, 100))

        # Coarse occupancy from spatial spread.
        if total_links == 0:
            label, hint = "gathering data…", 0
        elif active_links == 0:
            label, hint = "still / empty", 0
        elif active_links == 1:
            label, hint = "localized activity (~1 area)", 1
        elif active_links == 2:
            label, hint = "activity in ~2 areas", 2
        else:
            label, hint = "activity across multiple areas", 3

        # Confidence grows with data readiness and scan cadence (faster = better),
        # but is capped low — this is a coarse, experimental estimate.
        rate_factor = 1.0 if scan_rate <= 0 else max(0.3, min(1.0, 8.0 / scan_rate))
        data_factor = min(1.0, total_links / 3.0)
        confidence = round(min(0.6, 0.6 * rate_factor * data_factor), 2)

        return {
            "available": total_links > 0,
            "scan_rate_s": scan_rate,
            "links": links,
            "active_links": active_links,
            "total_links": total_links,
            "spatial_activity": round(spatial, 1),
            "occupancy_estimate": label,
            "occupancy_hint": hint,
            "confidence": confidence,
        }
