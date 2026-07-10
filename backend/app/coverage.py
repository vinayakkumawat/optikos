"""Coverage / dead-zone survey.

The user clicks their position on a floor canvas while standing there; we record
that (x, y) with the current connected-AP RSSI. Collected points form a coverage
map that reveals weak spots and good router placement. Positions are normalized
0..1 so the canvas can be any size.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "coverage.json"


class CoverageStore:
    def __init__(self) -> None:
        self._samples: list[dict] = []
        self._load()

    def _load(self) -> None:
        try:
            if _DATA_PATH.exists():
                self._samples = json.loads(_DATA_PATH.read_text()).get("samples", [])
        except Exception:
            self._samples = []

    def _save(self) -> None:
        try:
            _DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
            _DATA_PATH.write_text(json.dumps({"samples": self._samples}, indent=2))
        except Exception:
            pass

    def add(self, x: float, y: float, rssi: float | None) -> dict:
        sample = {
            "id": uuid.uuid4().hex[:8],
            "x": round(float(x), 4),
            "y": round(float(y), 4),
            "rssi_dbm": round(float(rssi), 1) if rssi is not None else None,
            "ts": time.time(),
        }
        self._samples.append(sample)
        self._save()
        return sample

    def list(self) -> list[dict]:
        return list(self._samples)

    def delete(self, sample_id: str) -> bool:
        n = len(self._samples)
        self._samples = [s for s in self._samples if s["id"] != sample_id]
        if len(self._samples) != n:
            self._save()
            return True
        return False

    def clear(self) -> None:
        self._samples = []
        self._save()
