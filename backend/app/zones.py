"""Room mapping via WiFi RF fingerprinting.

Every spot in a building "sees" the surrounding access points with a distinct
set of signal strengths — a fingerprint. If you walk the laptop to each room
and capture that fingerprint once, we can later compare the *live* fingerprint
against the saved ones and estimate which room you're currently in.

This is classic WiFi indoor positioning and needs no extra hardware. Accuracy
depends on how distinct the rooms' RF environments are (walls help).

A fingerprint is a map of {ap_key: rssi_dbm} plus the connected-AP RSSI and a
motion baseline. Matching uses mean absolute RSSI difference over the union of
APs (missing APs treated as a weak floor), weighted by how many APs overlap.
"""

from __future__ import annotations

import json
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

# RSSI assumed for an AP that one fingerprint saw but the other didn't.
_FLOOR_DBM = -95.0
# Distance (in dB) that maps to ~zero confidence.
_MATCH_SCALE = 22.0

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "zones.json"


@dataclass
class Zone:
    id: str
    name: str
    created_at: float
    fingerprint: dict  # ap_key -> mean rssi_dbm
    connected_rssi: float | None
    ap_count: int
    samples: int = 1

    def to_dict(self) -> dict:
        return asdict(self)


def _fingerprint_from_nodes(nodes: list[dict]) -> dict:
    return {n["key"]: float(n["rssi_dbm"]) for n in nodes if n.get("key")}


def _match_distance(fp_a: dict, fp_b: dict) -> tuple[float, int]:
    """Mean absolute RSSI difference over the union of APs; also returns the
    number of APs the two fingerprints have in common."""
    keys = set(fp_a) | set(fp_b)
    if not keys:
        return 999.0, 0
    total = 0.0
    common = 0
    for k in keys:
        a = fp_a.get(k, _FLOOR_DBM)
        b = fp_b.get(k, _FLOOR_DBM)
        if k in fp_a and k in fp_b:
            common += 1
        total += abs(a - b)
    return total / len(keys), common


class ZoneStore:
    def __init__(self) -> None:
        self._zones: dict[str, Zone] = {}
        self._load()

    # ---- persistence -----------------------------------------------------
    def _load(self) -> None:
        try:
            if _DATA_PATH.exists():
                data = json.loads(_DATA_PATH.read_text())
                for z in data.get("zones", []):
                    zone = Zone(**z)
                    self._zones[zone.id] = zone
        except Exception:
            self._zones = {}

    def _save(self) -> None:
        try:
            _DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
            _DATA_PATH.write_text(
                json.dumps({"zones": [z.to_dict() for z in self._zones.values()]}, indent=2)
            )
        except Exception:
            pass

    # ---- CRUD ------------------------------------------------------------
    def list(self) -> list[dict]:
        return [z.to_dict() for z in sorted(self._zones.values(), key=lambda z: z.created_at)]

    def capture(self, name: str, nodes: list[dict], connected_rssi: float | None) -> Zone:
        """Create a new zone, or refine an existing one with the same name by
        averaging the fingerprints."""
        fp = _fingerprint_from_nodes(nodes)
        existing = next((z for z in self._zones.values() if z.name.lower() == name.lower()), None)
        if existing:
            merged = dict(existing.fingerprint)
            n = existing.samples
            for k, v in fp.items():
                if k in merged:
                    merged[k] = (merged[k] * n + v) / (n + 1)
                else:
                    merged[k] = v
            existing.fingerprint = merged
            existing.samples += 1
            existing.ap_count = len(merged)
            if connected_rssi is not None:
                base = existing.connected_rssi if existing.connected_rssi is not None else connected_rssi
                existing.connected_rssi = (base * n + connected_rssi) / (n + 1)
            self._save()
            return existing

        zone = Zone(
            id=uuid.uuid4().hex[:8],
            name=name,
            created_at=time.time(),
            fingerprint=fp,
            connected_rssi=connected_rssi,
            ap_count=len(fp),
        )
        self._zones[zone.id] = zone
        self._save()
        return zone

    def delete(self, zone_id: str) -> bool:
        if zone_id in self._zones:
            del self._zones[zone_id]
            self._save()
            return True
        return False

    def clear(self) -> None:
        self._zones = {}
        self._save()

    # ---- live localization ----------------------------------------------
    def match(self, nodes: list[dict]) -> dict | None:
        """Return the best-matching zone for the current RF environment."""
        if not self._zones:
            return None
        live = _fingerprint_from_nodes(nodes)
        if not live:
            return None

        scored = []
        for z in self._zones.values():
            dist, common = _match_distance(live, z.fingerprint)
            confidence = max(0.0, 1.0 - dist / _MATCH_SCALE)
            # Penalize matches with little AP overlap (unreliable).
            overlap_ratio = common / max(1, len(z.fingerprint))
            confidence *= min(1.0, 0.4 + 0.6 * overlap_ratio)
            scored.append((confidence, dist, z))

        scored.sort(key=lambda s: -s[0])
        best_conf, best_dist, best = scored[0]

        # If the top two are nearly tied, we're less sure.
        margin = 1.0
        if len(scored) > 1:
            second = scored[1][0]
            margin = min(1.0, (best_conf - second) * 3 + 0.4)

        return {
            "zone_id": best.id,
            "zone_name": best.name,
            "confidence": round(best_conf * margin, 2),
            "distance_db": round(best_dist, 1),
            "ranking": [
                {"zone_id": z.id, "name": z.name, "confidence": round(c, 2)}
                for (c, _d, z) in scored[:5]
            ],
        }
