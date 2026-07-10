"""Nearby access-point scanner.

Two macOS backends, tried in order:

  1. CoreWLAN active scan (`scanForNetworksWithName:error:`) — returns real
     SSID names AND BSSIDs, but ONLY when the process is authorized to read
     location data. That happens when the backend runs as **root** (sudo) or
     when the launching app has been granted Location Services access.
  2. `system_profiler SPAirPortDataType -json` — always works without perms,
     but macOS redacts SSID names to "<redacted>" when unauthorized.

Falls back to a simulated set of routers on non-macOS hosts.
"""

from __future__ import annotations

import json
import platform
import random
import re
import subprocess
import time
from dataclasses import dataclass, field


@dataclass
class AccessPoint:
    name: str
    rssi_dbm: float
    noise_dbm: float | None
    channel: int | None
    band: str | None  # "2.4GHz" | "5GHz" | "6GHz"
    phy_mode: str | None
    security: str | None
    is_current: bool = False
    hidden: bool = False  # True when macOS redacted the real SSID
    bssid: str | None = None  # router MAC, only available when authorized
    last_seen: float = field(default_factory=time.time)

    @property
    def key(self) -> str:
        # BSSID uniquely identifies a radio; fall back to name+channel.
        if self.bssid:
            return self.bssid
        return f"{self.name}::{self.channel}"


_CHANNEL_RE = re.compile(r"(\d+)\s*\(([\d.]+)GHz")
_SIGNAL_RE = re.compile(r"(-?\d+)\s*dBm\s*/\s*(-?\d+)\s*dBm")

# Values macOS returns when it won't reveal the real SSID (no Location perm).
_HIDDEN_NAMES = {None, "", "<redacted>", "(hidden)", "redacted"}


def _friendly_label(band: str | None, channel: int | None) -> str:
    """Readable label for a network whose real name macOS is hiding."""
    b = band or "Wi-Fi"
    c = f" · ch{channel}" if channel is not None else ""
    return f"Wi-Fi · {b}{c}"


def _parse_channel(raw: str | None) -> tuple[int | None, str | None]:
    if not raw:
        return None, None
    m = _CHANNEL_RE.search(raw)
    if not m:
        return None, None
    ch = int(m.group(1))
    ghz = m.group(2)
    band = {"2": "2.4GHz", "2.4": "2.4GHz", "5": "5GHz", "6": "6GHz"}.get(
        ghz, f"{ghz}GHz"
    )
    return ch, band


def _parse_signal(raw: str | None) -> tuple[float | None, float | None]:
    if not raw:
        return None, None
    m = _SIGNAL_RE.search(raw)
    if not m:
        return None, None
    return float(m.group(1)), float(m.group(2))


def _clean_security(raw: str | None) -> str | None:
    if not raw:
        return None
    return (
        raw.replace("spairport_security_mode_", "")
        .replace("_", " ")
        .replace("wpa", "WPA")
        .replace("wep", "WEP")
        .strip()
        .title()
        .replace("Wpa", "WPA")
        .replace("Wep", "WEP")
    )


class APScanner:
    def __init__(self, force_simulated: bool = False) -> None:
        self.is_macos = platform.system() == "Darwin" and not force_simulated
        self.mode = "system_profiler" if self.is_macos else "simulated"
        self._sim_aps = self._build_sim_aps()
        self._cw_iface = None
        if self.is_macos:
            try:
                from CoreWLAN import CWWiFiClient

                self._cw_iface = CWWiFiClient.sharedWiFiClient().interface()
            except Exception:
                self._cw_iface = None

    def scan(self) -> list[AccessPoint]:
        if self.is_macos:
            # Prefer the CoreWLAN active scan — it yields real names + BSSIDs
            # when authorized (root / Location-granted). Only accept it if it
            # actually returned un-redacted names; otherwise fall through.
            try:
                cw = self._scan_corewlan()
                if cw and any(not ap.hidden for ap in cw):
                    self.mode = "corewlan (names available)"
                    return cw
            except Exception:
                pass
            try:
                aps = self._scan_macos()
                if aps:
                    self.mode = (
                        "system_profiler (names hidden)"
                        if all(ap.hidden for ap in aps)
                        else "system_profiler"
                    )
                    return aps
            except Exception:
                pass
            # If the real scan failed/empty, keep the stack alive with sim data.
            self.mode = "simulated (macos scan empty)"
        return self._scan_simulated()

    # ---- CoreWLAN active scan (real names + BSSIDs when authorized) -------
    def _scan_corewlan(self) -> list[AccessPoint]:
        if self._cw_iface is None:
            return []
        networks, err = self._cw_iface.scanForNetworksWithName_error_(None, None)
        if networks is None:
            return []
        cur_bssid = None
        try:
            cur_bssid = self._cw_iface.bssid()
        except Exception:
            pass
        band_map = {1: "2.4GHz", 2: "5GHz", 3: "6GHz"}
        now = time.time()
        aps: list[AccessPoint] = []
        for n in networks:
            try:
                ssid = n.ssid()
                bssid = n.bssid()
                rssi = float(n.rssiValue())
                noise = float(n.noiseMeasurement())
                chan = n.wlanChannel()
                ch = int(chan.channelNumber()) if chan else None
                band = band_map.get(int(chan.channelBand()), None) if chan else None
            except Exception:
                continue
            hidden = ssid in _HIDDEN_NAMES or not ssid
            name = _friendly_label(band, ch) if hidden else ssid
            aps.append(
                AccessPoint(
                    name=name,
                    rssi_dbm=rssi,
                    noise_dbm=noise if noise else None,
                    channel=ch,
                    band=band,
                    phy_mode=None,
                    security=None,
                    is_current=bool(bssid and cur_bssid and bssid == cur_bssid),
                    hidden=hidden,
                    bssid=bssid or None,
                    last_seen=now,
                )
            )
        return aps

    def _scan_macos(self) -> list[AccessPoint]:
        out = subprocess.run(
            ["system_profiler", "SPAirPortDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        data = json.loads(out.stdout)
        ifaces = data.get("SPAirPortDataType", [{}])[0].get(
            "spairport_airport_interfaces", []
        )
        aps: list[AccessPoint] = []
        now = time.time()
        for iface in ifaces:
            current = iface.get("spairport_current_network_information")
            if isinstance(current, dict):
                ap = self._ap_from_entry(current, now, is_current=True)
                if ap:
                    aps.append(ap)
            for entry in iface.get(
                "spairport_airport_other_local_wireless_networks", []
            ):
                ap = self._ap_from_entry(entry, now, is_current=False)
                if ap:
                    aps.append(ap)
        return aps

    def _ap_from_entry(
        self, entry: dict, now: float, is_current: bool
    ) -> AccessPoint | None:
        rssi, noise = _parse_signal(entry.get("spairport_signal_noise"))
        if rssi is None:
            return None
        ch, band = _parse_channel(entry.get("spairport_network_channel"))
        raw_name = entry.get("_name")
        hidden = raw_name in _HIDDEN_NAMES
        name = _friendly_label(band, ch) if hidden else raw_name
        return AccessPoint(
            name=name,
            rssi_dbm=rssi,
            noise_dbm=noise,
            channel=ch,
            band=band,
            phy_mode=entry.get("spairport_network_phymode"),
            security=_clean_security(entry.get("spairport_security_mode")),
            is_current=is_current,
            hidden=hidden,
            last_seen=now,
        )

    # ---- simulation ------------------------------------------------------
    def _build_sim_aps(self) -> list[AccessPoint]:
        seed = [
            ("HomeRouter-5G", -34, 36, "5GHz", True),
            ("HomeRouter-2G", -41, 6, "2.4GHz", False),
            ("Neighbor_A", -63, 11, "2.4GHz", False),
            ("Neighbor_B", -71, 149, "5GHz", False),
            ("Office_Guest", -78, 1, "2.4GHz", False),
            ("CoffeeShop", -85, 157, "5GHz", False),
            ("FarAway_AP", -91, 44, "5GHz", False),
        ]
        return [
            AccessPoint(
                name=n,
                rssi_dbm=r,
                noise_dbm=-92,
                channel=c,
                band=b,
                phy_mode="802.11ax",
                security="WPA2 Personal",
                is_current=cur,
            )
            for (n, r, c, b, cur) in seed
        ]

    def _scan_simulated(self) -> list[AccessPoint]:
        now = time.time()
        out = []
        for ap in self._sim_aps:
            jitter = random.gauss(0, 1.5)
            out.append(
                AccessPoint(
                    name=ap.name,
                    rssi_dbm=round(ap.rssi_dbm + jitter, 1),
                    noise_dbm=ap.noise_dbm,
                    channel=ap.channel,
                    band=ap.band,
                    phy_mode=ap.phy_mode,
                    security=ap.security,
                    is_current=ap.is_current,
                    last_seen=now,
                )
            )
        return out
