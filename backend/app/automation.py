"""Presence-/event-triggered automation.

Rules fire when the sensing state transitions. Each rule has a trigger and an
action:

  Triggers:  arrive | leave | motion | gesture | room_enter
  Actions:   command (run a local shell command) | webhook (HTTP POST)

SECURITY NOTE: "command" actions run with your user privileges on this machine.
The API binds to 127.0.0.1 only and rules are user-created, but treat this like
any local automation tool — don't expose the backend to untrusted networks.
"""

from __future__ import annotations

import json
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib import request as urlrequest

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "automations.json"

VALID_TRIGGERS = {"arrive", "leave", "motion", "gesture", "room_enter"}
VALID_ACTIONS = {"command", "webhook"}


class RuleStore:
    def __init__(self) -> None:
        self._rules: dict[str, dict] = {}
        self._lock = threading.Lock()
        self._load()

    def _load(self) -> None:
        try:
            if _DATA_PATH.exists():
                for r in json.loads(_DATA_PATH.read_text()).get("rules", []):
                    self._rules[r["id"]] = r
        except Exception:
            self._rules = {}

    def _save(self) -> None:
        try:
            _DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
            _DATA_PATH.write_text(
                json.dumps({"rules": list(self._rules.values())}, indent=2)
            )
        except Exception:
            pass

    def list(self) -> list[dict]:
        with self._lock:
            return list(self._rules.values())

    def add(
        self,
        name: str,
        trigger: str,
        action_type: str,
        target: str,
        zone: str | None = None,
        min_count: int = 1,
    ) -> dict:
        rule = {
            "id": uuid.uuid4().hex[:8],
            "name": name,
            "trigger": trigger,
            "zone": zone,  # only for room_enter
            "min_count": max(1, int(min_count)),  # gesture: min waves to fire
            "action_type": action_type,
            "target": target,  # command / webhook URL / phone number
            "enabled": True,
            "last_fired": None,
            "last_result": None,
            "fire_count": 0,
        }
        with self._lock:
            self._rules[rule["id"]] = rule
            self._save()
        return rule

    def delete(self, rule_id: str) -> bool:
        with self._lock:
            if rule_id in self._rules:
                del self._rules[rule_id]
                self._save()
                return True
            return False

    def set_enabled(self, rule_id: str, enabled: bool) -> bool:
        with self._lock:
            if rule_id in self._rules:
                self._rules[rule_id]["enabled"] = enabled
                self._save()
                return True
            return False

    # ---- firing ----------------------------------------------------------
    def fire(self, trigger: str, detail: dict | None = None) -> None:
        detail = detail or {}
        to_run = []
        with self._lock:
            for rule in self._rules.values():
                if not rule["enabled"] or rule["trigger"] != trigger:
                    continue
                if trigger == "room_enter" and rule.get("zone"):
                    if (detail.get("zone") or "").lower() != rule["zone"].lower():
                        continue
                if trigger == "gesture":
                    if int(detail.get("count", 1)) < int(rule.get("min_count", 1)):
                        continue
                to_run.append(rule)
        for rule in to_run:
            threading.Thread(
                target=self._execute, args=(rule, detail), daemon=True
            ).start()

    def _execute(self, rule: dict, detail: dict) -> None:
        result = "ok"
        try:
            if rule["action_type"] == "command":
                subprocess.run(
                    rule["target"], shell=True, timeout=15,
                    capture_output=True,
                )
            elif rule["action_type"] == "webhook":
                payload = json.dumps(
                    {"trigger": rule["trigger"], "detail": detail, "ts": time.time()}
                ).encode()
                req = urlrequest.Request(
                    rule["target"], data=payload,
                    headers={"Content-Type": "application/json"}, method="POST",
                )
                urlrequest.urlopen(req, timeout=10).read()
        except Exception as e:  # noqa: BLE001
            result = f"error: {type(e).__name__}: {e}"[:180]
        with self._lock:
            rule["last_fired"] = time.time()
            rule["last_result"] = result
            rule["fire_count"] = rule.get("fire_count", 0) + 1
            self._save()
