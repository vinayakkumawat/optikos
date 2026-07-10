"""Router (access-point) mapping.

Turns each nearby AP's RSSI into:
  * a rough distance estimate (log-distance path-loss model), and
  * a stable 2D layout position for the "building map" / radar view.

Caveat: without knowing real AP coordinates we cannot triangulate true
positions. We instead place APs on a stable radial layout where the radius
encodes estimated distance and the angle is derived deterministically from the
AP identity, so the map is readable and doesn't jump around between scans.
"""

from __future__ import annotations

import hashlib
import math

from .config import CONFIG
from .wifi.scanner import AccessPoint


def estimate_distance_m(rssi_dbm: float) -> float:
    """Log-distance path loss: d = 10 ** ((txPower - RSSI) / (10 * n))."""
    m = CONFIG.mapping
    exp = (m.tx_power_dbm - rssi_dbm) / (10.0 * m.path_loss_exponent)
    d = 10.0 ** exp
    return round(max(0.3, min(d, 200.0)), 1)


def signal_quality(rssi_dbm: float) -> str:
    if rssi_dbm >= -50:
        return "excellent"
    if rssi_dbm >= -60:
        return "good"
    if rssi_dbm >= -70:
        return "fair"
    if rssi_dbm >= -80:
        return "weak"
    return "very weak"


def _stable_angle(name: str) -> float:
    """Deterministic angle (radians) from AP name, so layout is stable."""
    h = hashlib.md5(name.encode()).hexdigest()
    return (int(h[:8], 16) % 36000) / 36000.0 * 2 * math.pi


def _dedupe(aps: list[AccessPoint]) -> list[AccessPoint]:
    """Collapse APs sharing name+channel (macOS lists radios separately and
    has no BSSID), keeping the strongest observation of each."""
    best: dict[str, AccessPoint] = {}
    for ap in aps:
        cur = best.get(ap.key)
        if cur is None or ap.rssi_dbm > cur.rssi_dbm or ap.is_current:
            # Preserve is_current flag if any duplicate was the connected AP.
            if cur is not None and cur.is_current:
                ap.is_current = True
            best[ap.key] = ap
    return list(best.values())


def build_map(aps: list[AccessPoint]) -> list[dict]:
    """Produce serializable map nodes for the frontend."""
    nodes: list[dict] = []
    for ap in _dedupe(aps):
        dist = estimate_distance_m(ap.rssi_dbm)
        if ap.is_current:
            x, y, angle = 0.0, 0.0, 0.0
        else:
            angle = _stable_angle(ap.key)
            x = round(dist * math.cos(angle), 2)
            y = round(dist * math.sin(angle), 2)
        nodes.append(
            {
                "name": ap.name,
                "key": ap.key,
                "rssi_dbm": ap.rssi_dbm,
                "noise_dbm": ap.noise_dbm,
                "distance_m": dist,
                "quality": signal_quality(ap.rssi_dbm),
                "channel": ap.channel,
                "band": ap.band,
                "phy_mode": ap.phy_mode,
                "security": ap.security,
                "is_current": ap.is_current,
                "hidden": ap.hidden,
                "bssid": ap.bssid,
                "angle_rad": round(angle, 4),
                "x": x,
                "y": y,
                "last_seen": ap.last_seen,
            }
        )
    nodes.sort(key=lambda n: (not n["is_current"], -n["rssi_dbm"]))
    return nodes


def channel_analysis(nodes: list[dict]) -> dict:
    """Score how congested each WiFi channel is and recommend clearer ones.

    Congestion weights each AP on a channel by its signal strength (a strong
    neighbor interferes more than a faint one).
    """
    # Standard non-overlapping 2.4GHz channels; 5GHz channels are mostly
    # non-overlapping already.
    per_channel: dict[int, dict] = {}
    for n in nodes:
        ch = n["channel"]
        if ch is None:
            continue
        weight = max(0.0, (n["rssi_dbm"] + 95) / 65.0)  # ~0 (faint) .. ~1 (strong)
        entry = per_channel.setdefault(
            ch, {"channel": ch, "band": n["band"], "count": 0, "congestion": 0.0}
        )
        entry["count"] += 1
        entry["congestion"] += weight

    channels = sorted(per_channel.values(), key=lambda c: -c["congestion"])
    for c in channels:
        c["congestion"] = round(c["congestion"], 2)

    def _recommend(band: str, candidates: list[int]) -> dict | None:
        best = None
        for ch in candidates:
            cong = per_channel.get(ch, {}).get("congestion", 0.0)
            if best is None or cong < best[1]:
                best = (ch, cong)
        if best is None:
            return None
        return {"band": band, "channel": best[0], "congestion": round(best[1], 2)}

    recommendations = [
        r
        for r in (
            _recommend("2.4GHz", [1, 6, 11]),
            _recommend("5GHz", [36, 40, 44, 48, 149, 153, 157, 161]),
        )
        if r is not None
    ]
    return {"channels": channels, "recommendations": recommendations}


def map_summary(nodes: list[dict]) -> dict:
    bands: dict[str, int] = {}
    channels: dict[int, int] = {}
    for n in nodes:
        if n["band"]:
            bands[n["band"]] = bands.get(n["band"], 0) + 1
        if n["channel"] is not None:
            channels[n["channel"]] = channels.get(n["channel"], 0) + 1
    return {
        "total_aps": len(nodes),
        "bands": bands,
        "busiest_channels": sorted(
            channels.items(), key=lambda kv: -kv[1]
        )[:5],
        "closest": nodes[0]["name"] if nodes else None,
    }
