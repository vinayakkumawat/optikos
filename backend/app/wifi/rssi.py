"""Fast RSSI reader for the currently-connected access point.

On macOS this uses the CoreWLAN framework (via PyObjC), which returns the
live RSSI of the associated AP in ~3ms with no shell-out and no special
permissions. When CoreWLAN is unavailable we fall back to a physically
plausible simulator so the rest of the stack still runs.
"""

from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass


@dataclass
class RSSISample:
    timestamp: float
    rssi_dbm: float
    noise_dbm: float | None
    tx_rate_mbps: float | None
    source: str  # "corewlan" | "simulated"


class _CoreWLANReader:
    """Real macOS reader backed by CoreWLAN."""

    def __init__(self) -> None:
        from CoreWLAN import CWWiFiClient  # imported lazily; macOS-only

        self._client = CWWiFiClient.sharedWiFiClient()
        self._iface = self._client.interface()
        if self._iface is None:
            raise RuntimeError("No WiFi interface found")
        # Probe once so construction fails fast if the API is blocked.
        _ = self._iface.rssiValue()

    def read(self) -> RSSISample:
        rssi = float(self._iface.rssiValue())
        noise = self._iface.noiseMeasurement()
        rate = self._iface.transmitRate()
        return RSSISample(
            timestamp=time.time(),
            rssi_dbm=rssi,
            noise_dbm=float(noise) if noise is not None else None,
            tx_rate_mbps=float(rate) if rate is not None else None,
            source="corewlan",
        )

    def interface_name(self) -> str:
        return str(self._iface.interfaceName() or "wifi")


class _SimulatedReader:
    """Physically-flavored RSSI simulator.

    Produces a stable baseline with occasional 'motion events' (bursts of
    variance) so the downstream detectors and UI can be exercised without a
    live radio.
    """

    def __init__(self, base_rssi: float = -47.0) -> None:
        self._base = base_rssi
        self._motion_until = 0.0
        self._next_event = time.time() + random.uniform(5, 12)

    def read(self) -> RSSISample:
        now = time.time()
        if now >= self._next_event:
            self._motion_until = now + random.uniform(2.5, 6.0)
            self._next_event = now + random.uniform(8, 20)

        moving = now < self._motion_until
        jitter = random.gauss(0, 5.5 if moving else 0.8)
        slow_drift = 2.0 * math.sin(now / 7.0)
        rssi = self._base + slow_drift + jitter
        return RSSISample(
            timestamp=now,
            rssi_dbm=round(rssi, 1),
            noise_dbm=-92.0 + random.gauss(0, 0.5),
            tx_rate_mbps=866.0,
            source="simulated",
        )

    def interface_name(self) -> str:
        return "simulated"


class RSSIReader:
    """Facade that picks the best available backend."""

    def __init__(self, force_simulated: bool = False) -> None:
        self._backend = None
        self.mode = "simulated"
        if not force_simulated:
            try:
                self._backend = _CoreWLANReader()
                self.mode = "corewlan"
            except Exception:
                self._backend = None
        if self._backend is None:
            self._backend = _SimulatedReader()
            self.mode = "simulated"

    def read(self) -> RSSISample:
        return self._backend.read()

    def interface_name(self) -> str:
        return self._backend.interface_name()
