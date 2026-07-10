"""Connection-health tracker for the associated access point.

Consumes the same RSSI stream used for sensing, but focuses on link quality:
signal, SNR, transmit rate, stability, and drop events over a rolling window.
"""

from __future__ import annotations

import threading
import time
from collections import deque

import numpy as np


class LinkHealthTracker:
    def __init__(self, window_s: float = 600.0, hz: float = 8.0) -> None:
        maxlen = int(window_s * hz)
        self._ts = deque(maxlen=maxlen)
        self._rssi = deque(maxlen=maxlen)
        self._noise = deque(maxlen=maxlen)
        self._rate = deque(maxlen=maxlen)
        self._drops: deque = deque(maxlen=50)
        self._lock = threading.Lock()
        self._last_rssi: float | None = None
        # A "drop" is a sudden fall of >= this many dB between samples, or
        # crossing into weak territory.
        self._drop_delta = 12.0
        self._weak_dbm = -75.0

    def add(self, rssi: float, noise: float | None, tx_rate: float | None) -> None:
        now = time.time()
        with self._lock:
            self._ts.append(now)
            self._rssi.append(rssi)
            self._noise.append(noise if noise is not None else np.nan)
            self._rate.append(tx_rate if tx_rate is not None else np.nan)
            if self._last_rssi is not None:
                delta = self._last_rssi - rssi
                if delta >= self._drop_delta or (
                    rssi < self._weak_dbm and self._last_rssi >= self._weak_dbm
                ):
                    self._drops.append(
                        {"ts": now, "from": round(self._last_rssi, 1), "to": round(rssi, 1)}
                    )
            self._last_rssi = rssi

    def _quality(self, rssi: float) -> str:
        if rssi >= -50:
            return "excellent"
        if rssi >= -60:
            return "good"
        if rssi >= -70:
            return "fair"
        if rssi >= -80:
            return "weak"
        return "very weak"

    def snapshot(self) -> dict:
        with self._lock:
            if not self._rssi:
                return {"available": False}
            rssi = np.array(self._rssi, dtype=float)
            noise = np.array(self._noise, dtype=float)
            rate = np.array(self._rate, dtype=float)
            ts = np.array(self._ts, dtype=float)
            drops = list(self._drops)

        cur_rssi = float(rssi[-1])
        cur_noise = float(noise[-1]) if not np.isnan(noise[-1]) else None
        cur_rate = float(rate[-1]) if not np.isnan(rate[-1]) else None
        snr = cur_rssi - cur_noise if cur_noise is not None else None

        std = float(np.std(rssi[-240:])) if len(rssi) > 5 else 0.0
        # Stability: low variance + few recent drops = high score.
        recent_drops = sum(1 for d in drops if time.time() - d["ts"] < 120)
        stability = max(0.0, 100.0 - std * 6.0 - recent_drops * 12.0)

        # Downsample history for charting (~120 points).
        def _downsample(arr: np.ndarray, n: int = 120) -> list:
            if len(arr) <= n:
                return [None if np.isnan(x) else round(float(x), 1) for x in arr]
            idx = np.linspace(0, len(arr) - 1, n).astype(int)
            return [None if np.isnan(arr[i]) else round(float(arr[i]), 1) for i in idx]

        return {
            "available": True,
            "rssi_dbm": round(cur_rssi, 1),
            "noise_dbm": round(cur_noise, 1) if cur_noise is not None else None,
            "snr_db": round(snr, 1) if snr is not None else None,
            "tx_rate_mbps": cur_rate,
            "quality": self._quality(cur_rssi),
            "rssi_min": round(float(np.min(rssi)), 1),
            "rssi_max": round(float(np.max(rssi)), 1),
            "rssi_avg": round(float(np.mean(rssi)), 1),
            "stability_score": round(stability, 1),
            "recent_drops": recent_drops,
            "drops": drops[-10:],
            "window_s": round(float(ts[-1] - ts[0]), 1) if len(ts) > 1 else 0.0,
            "rssi_history": _downsample(rssi),
            "rate_history": _downsample(rate),
        }
