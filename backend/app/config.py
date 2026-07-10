"""Runtime configuration for the Optikos sensing engine.

All values are tunable defaults. The signal-processing thresholds are
environment-dependent (every room reflects WiFi differently), so they can be
re-calibrated at runtime via the /api/config endpoint.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class SamplingConfig:
    # How often we read the RSSI of the connected AP (Hz).
    # CoreWLAN reads take ~3ms, so we can comfortably poll several times a second.
    rssi_hz: float = 8.0

    # Number of recent RSSI samples kept in the rolling analysis window.
    # At 8 Hz, 240 samples ~= 30 seconds of history.
    window_size: int = 240

    # How often we re-scan for nearby routers (seconds). Scans are slow (a
    # CoreWLAN active scan is ~1-2s, system_profiler ~3-4s) so this runs on a
    # background thread. A shorter interval gives the multi-AP motion tracker
    # more samples per link (better spatial sensing) at the cost of more scans.
    scan_interval_s: float = 6.0

    # How often we push a state update to connected dashboards (Hz).
    broadcast_hz: float = 5.0


@dataclass
class DetectionConfig:
    # Motion is scored from the short-term variability of the RSSI signal.
    # These thresholds map a motion score (0-100) onto discrete states.
    motion_quiet_below: float = 8.0
    motion_active_above: float = 22.0

    # Presence: sustained elevated motion implies someone is in the space.
    presence_hold_s: float = 6.0

    # Calibration baseline (noise floor of a still, empty room). Learned during
    # the first `calibration_s` seconds after startup, then used as reference.
    calibration_s: float = 20.0

    # Rough occupancy buckets. RSSI from a single AP cannot truly count people,
    # so this is an activity-derived ESTIMATE with explicit confidence.
    occupancy_levels: tuple = (
        (0, "empty"),
        (12, "one person / light activity"),
        (30, "a few people / moderate activity"),
        (55, "busy / high activity"),
    )


@dataclass
class MappingConfig:
    # Log-distance path-loss model parameters for turning RSSI into a rough
    # distance estimate: RSSI = tx_power - 10 * n * log10(d).
    # These are coarse defaults for indoor 2.4/5 GHz environments.
    tx_power_dbm: float = -40.0  # reference RSSI at 1 meter
    path_loss_exponent: float = 3.0  # 2.0 = free space, 3-4 = walls/indoor


@dataclass
class AppConfig:
    sampling: SamplingConfig = field(default_factory=SamplingConfig)
    detection: DetectionConfig = field(default_factory=DetectionConfig)
    mapping: MappingConfig = field(default_factory=MappingConfig)


CONFIG = AppConfig()
