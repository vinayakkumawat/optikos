"""Turns a rolling window of RSSI samples into human-readable sensing state.

The core intuition: a still, empty room produces an almost-flat RSSI trace to
the connected AP. When people move, their bodies absorb/reflect the 2.4/5 GHz
signal, so the RSSI starts fluctuating. We quantify that fluctuation and map
it onto motion / presence / occupancy states.

IMPORTANT (honesty): single-AP RSSI is a coarse sensor. Motion and presence
are reasonably reliable; occupancy *count* and breathing rate are best-effort
ESTIMATES with explicit confidence, not ground truth. Real per-person counting
and vitals need CSI-capable hardware (ESP32-S3 etc.).
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from ..config import CONFIG


@dataclass
class SensingState:
    timestamp: float
    rssi_dbm: float
    noise_dbm: float | None
    snr_db: float | None
    motion_score: float          # 0-100 smoothed activity level
    motion_state: str            # quiet | motion | active
    presence: bool
    presence_confidence: float   # 0-1
    occupancy_estimate: str
    occupancy_hint: int          # rough integer hint (0..n)
    breathing_bpm: float | None  # experimental, low confidence
    breathing_confidence: float
    calibrated: bool
    baseline_std: float
    source_mode: str
    history: list = field(default_factory=list)  # recent rssi for the UI chart
    spectrum: dict = field(default_factory=dict)  # {freqs_hz, mag, peak_hz} for FFT viz


class RSSIAnalyzer:
    def __init__(self) -> None:
        c = CONFIG
        self._rssi = deque(maxlen=c.sampling.window_size)
        self._ts = deque(maxlen=c.sampling.window_size)
        self._motion_hist = deque(maxlen=c.sampling.window_size)
        self._smoothed_motion = 0.0
        self._presence_since: float | None = None
        self._last_active_ts: float | None = None

        # Calibration (learn the "empty room" noise floor).
        self._calib_start = time.time()
        self._calib_stds: list[float] = []
        self._baseline_std = 1.0
        self._calibrated = False
        self._last_noise: float | None = None

    def reset_calibration(self) -> None:
        self._calib_start = time.time()
        self._calib_stds = []
        self._calibrated = False

    def add_sample(self, rssi: float, noise: float | None, ts: float) -> None:
        self._rssi.append(rssi)
        self._ts.append(ts)
        if noise is not None:
            self._last_noise = noise

    def history_series(self) -> tuple[list, list]:
        """Return (timestamps, rssi) for the current analysis window."""
        return list(self._ts), list(self._rssi)

    def _short_term_std(self, n: int = 24) -> float:
        if len(self._rssi) < 3:
            return 0.0
        arr = np.array(list(self._rssi)[-n:], dtype=float)
        return float(np.std(arr))

    def _update_calibration(self, std: float, now: float) -> None:
        if self._calibrated:
            return
        self._calib_stds.append(std)
        if now - self._calib_start >= CONFIG.detection.calibration_s:
            if self._calib_stds:
                # Use a low percentile as the quiet-room baseline.
                self._baseline_std = max(
                    0.4, float(np.percentile(self._calib_stds, 40))
                )
            self._calibrated = True

    def _compute_spectrum(self) -> tuple | None:
        """Detrended, windowed FFT of the RSSI window. Returns (freqs, mag)."""
        if len(self._rssi) < CONFIG.sampling.window_size * 0.6:
            return None
        rssi = np.array(self._rssi, dtype=float)
        ts = np.array(self._ts, dtype=float)
        dur = ts[-1] - ts[0]
        if dur <= 0:
            return None
        fs = len(rssi) / dur  # effective sample rate
        # Remove slow drift (quadratic) so we see oscillations, then window.
        idx = np.arange(len(rssi))
        detrended = rssi - np.polyval(np.polyfit(idx, rssi, 2), idx)
        detrended *= np.hanning(len(rssi))
        mag = np.abs(np.fft.rfft(detrended))
        freqs = np.fft.rfftfreq(len(detrended), d=1.0 / fs)
        return freqs, mag

    def _breathing_and_spectrum(self) -> tuple[float | None, float, dict]:
        """Breathing estimate + a compact spectrum for visualization.

        Breathing is very-low-confidence: it only works when a person is fairly
        still and near the signal path. The spectrum (0-2 Hz) is returned for the
        UI so the DSP is visible.
        """
        out = self._compute_spectrum()
        if out is None:
            return None, 0.0, {}
        freqs, mag = out

        # Compact 0-2 Hz view for the UI, magnitude normalized 0..1.
        viz = (freqs >= 0.05) & (freqs <= 2.0)
        spectrum: dict = {}
        if viz.any():
            vf = freqs[viz]
            vm = mag[viz]
            n = 48
            if len(vf) > n:
                sel = np.linspace(0, len(vf) - 1, n).astype(int)
                vf, vm = vf[sel], vm[sel]
            peak = float(vm.max()) if vm.size else 1.0
            spectrum = {
                "freqs_hz": [round(float(f), 3) for f in vf],
                "mag": [round(float(m / (peak + 1e-9)), 3) for m in vm],
            }

        # Respiration band: 0.1-0.6 Hz (6-36 BPM).
        band = (freqs >= 0.1) & (freqs <= 0.6)
        if not band.any():
            return None, 0.0, spectrum
        band_spec = mag[band]
        band_freqs = freqs[band]
        peak_idx = int(np.argmax(band_spec))
        peak = band_spec[peak_idx]
        total = mag.sum() + 1e-9
        confidence = float(min(1.0, (peak / total) * 8.0))
        bpm = float(band_freqs[peak_idx] * 60.0)
        if spectrum:
            spectrum["peak_hz"] = round(float(band_freqs[peak_idx]), 3)
        if confidence < 0.15:
            return None, round(confidence, 2), spectrum
        return round(bpm, 1), round(confidence, 2), spectrum

    def analyze(self, source_mode: str) -> SensingState:
        c = CONFIG
        now = self._ts[-1] if self._ts else time.time()
        rssi_now = self._rssi[-1] if self._rssi else -100.0
        noise_now = self._last_noise

        std = self._short_term_std()
        self._update_calibration(std, now)

        # Motion score: how far current variability exceeds the quiet baseline.
        ratio = std / max(self._baseline_std, 0.4)
        raw_motion = float(np.clip((ratio - 1.0) * 22.0, 0, 100))
        # Exponential smoothing for a stable UI value.
        alpha = 0.35
        self._smoothed_motion = (
            alpha * raw_motion + (1 - alpha) * self._smoothed_motion
        )
        motion = round(self._smoothed_motion, 1)
        self._motion_hist.append(motion)

        if motion < c.detection.motion_quiet_below:
            motion_state = "quiet"
        elif motion < c.detection.motion_active_above:
            motion_state = "motion"
        else:
            motion_state = "active"

        # Presence: motion sustained over presence_hold_s implies occupancy.
        if motion >= c.detection.motion_quiet_below:
            self._last_active_ts = now
            if self._presence_since is None:
                self._presence_since = now
        else:
            if (
                self._last_active_ts is not None
                and now - self._last_active_ts > c.detection.presence_hold_s
            ):
                self._presence_since = None

        presence = self._presence_since is not None
        if presence:
            held = now - self._presence_since
            presence_conf = float(np.clip(held / c.detection.presence_hold_s, 0, 1))
        else:
            presence_conf = 0.0

        # Occupancy estimate (coarse buckets from a longer-term motion average).
        recent = list(self._motion_hist)[-80:]
        avg_motion = float(np.mean(recent)) if recent else 0.0
        occ_label = "empty"
        occ_hint = 0
        for i, (thr, label) in enumerate(c.detection.occupancy_levels):
            if avg_motion >= thr:
                occ_label = label
                occ_hint = i
        if not presence:
            occ_label = "empty"
            occ_hint = 0

        breathing_bpm, breathing_conf, spectrum = self._breathing_and_spectrum()

        snr = None
        if noise_now is not None:
            snr = rssi_now - noise_now

        history = [round(x, 1) for x in list(self._rssi)[-CONFIG.sampling.window_size:]]

        return SensingState(
            timestamp=now,
            rssi_dbm=round(rssi_now, 1),
            noise_dbm=noise_now,
            snr_db=snr,
            motion_score=motion,
            motion_state=motion_state,
            presence=presence,
            presence_confidence=round(presence_conf, 2),
            occupancy_estimate=occ_label,
            occupancy_hint=occ_hint,
            breathing_bpm=breathing_bpm,
            breathing_confidence=breathing_conf,
            calibrated=self._calibrated,
            baseline_std=round(self._baseline_std, 2),
            source_mode=source_mode,
            history=history,
            spectrum=spectrum,
        )
