"""Optikos FastAPI application.

Exposes:
  GET  /api/health          - liveness + which data sources are active
  GET  /api/state           - one-shot snapshot of current sensing state
  GET  /api/routers         - current nearby-router map
  POST /api/recalibrate     - re-learn the empty-room baseline
  GET  /api/config          - current tunable thresholds
  GET  /api/export.json     - full data export (raw series + derived signals)
  GET  /api/export.csv      - raw connected-link RSSI time series (CSV)
  GET  /api/zones           - RF-fingerprint rooms + live location match
  GET  /api/coverage        - coverage/dead-zone survey samples
  GET  /api/rules           - automation rules (triggers -> actions)
  WS   /ws                  - live stream of sensing state (~broadcast_hz)
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel

from .automation import VALID_ACTIONS, VALID_TRIGGERS
from .config import CONFIG
from .engine import SensingEngine


class CaptureZoneRequest(BaseModel):
    name: str


class CoverageSampleRequest(BaseModel):
    x: float
    y: float


class RuleRequest(BaseModel):
    name: str
    trigger: str
    action_type: str
    target: str
    zone: str | None = None
    min_count: int = 1


class RuleToggleRequest(BaseModel):
    enabled: bool

FORCE_SIM = os.environ.get("OPTIKOS_SIMULATE", "").lower() in ("1", "true", "yes")

engine = SensingEngine(force_simulated=FORCE_SIM)


@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.start()
    yield
    engine.stop()


app = FastAPI(title="Optikos WiFi Sensing", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "rssi_source": engine.reader.mode,
        "scan_source": engine.scanner.mode,
        "interface": engine.reader.interface_name(),
        "simulated": FORCE_SIM,
    }


@app.get("/api/state")
async def state():
    return JSONResponse(engine.snapshot())


@app.get("/api/routers")
async def routers():
    snap = engine.snapshot()
    return {"routers": snap["routers"], "summary": snap["router_summary"]}


@app.post("/api/recalibrate")
async def recalibrate():
    engine.recalibrate()
    return {"status": "recalibrating", "calibration_s": CONFIG.detection.calibration_s}


@app.get("/api/zones")
async def list_zones():
    snap = engine.snapshot()
    return {"zones": engine.list_zones(), "location": snap["location"]}


@app.post("/api/zones/capture")
async def capture_zone(req: CaptureZoneRequest):
    name = req.name.strip()
    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)
    zone = engine.capture_zone(name)
    return {"status": "captured", "zone": zone}


@app.delete("/api/zones/{zone_id}")
async def delete_zone(zone_id: str):
    ok = engine.delete_zone(zone_id)
    return {"status": "deleted" if ok else "not_found", "zone_id": zone_id}


# ---- coverage ------------------------------------------------------------
@app.get("/api/coverage")
async def list_coverage():
    return {"samples": engine.list_coverage()}


@app.post("/api/coverage")
async def add_coverage(req: CoverageSampleRequest):
    return {"status": "added", "sample": engine.add_coverage(req.x, req.y)}


@app.delete("/api/coverage/{sample_id}")
async def delete_coverage(sample_id: str):
    ok = engine.delete_coverage(sample_id)
    return {"status": "deleted" if ok else "not_found"}


@app.delete("/api/coverage")
async def clear_coverage():
    engine.clear_coverage()
    return {"status": "cleared"}


# ---- automations ---------------------------------------------------------
@app.get("/api/rules")
async def list_rules():
    return {"rules": engine.rules.list()}


@app.post("/api/rules")
async def add_rule(req: RuleRequest):
    if req.trigger not in VALID_TRIGGERS:
        return JSONResponse({"error": "invalid trigger"}, status_code=400)
    if req.action_type not in VALID_ACTIONS:
        return JSONResponse({"error": "invalid action_type"}, status_code=400)
    if not req.target.strip():
        return JSONResponse({"error": "target is required"}, status_code=400)
    rule = engine.rules.add(
        req.name.strip() or req.trigger,
        req.trigger,
        req.action_type,
        req.target.strip(),
        req.zone,
        req.min_count,
    )
    return {"status": "added", "rule": rule}


@app.patch("/api/rules/{rule_id}")
async def toggle_rule(rule_id: str, req: RuleToggleRequest):
    ok = engine.rules.set_enabled(rule_id, req.enabled)
    return {"status": "updated" if ok else "not_found"}


@app.delete("/api/rules/{rule_id}")
async def delete_rule(rule_id: str):
    ok = engine.rules.delete(rule_id)
    return {"status": "deleted" if ok else "not_found"}


@app.get("/api/export.json")
async def export_json():
    return JSONResponse(
        engine.export_json(),
        headers={"Content-Disposition": "attachment; filename=optikos_export.json"},
    )


@app.get("/api/export.csv")
async def export_csv():
    return PlainTextResponse(
        engine.export_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=optikos_rssi.csv"},
    )


@app.get("/api/config")
async def get_config():
    c = CONFIG
    return {
        "sampling": {
            "rssi_hz": c.sampling.rssi_hz,
            "window_size": c.sampling.window_size,
            "scan_interval_s": c.sampling.scan_interval_s,
            "broadcast_hz": c.sampling.broadcast_hz,
        },
        "detection": {
            "motion_quiet_below": c.detection.motion_quiet_below,
            "motion_active_above": c.detection.motion_active_above,
            "presence_hold_s": c.detection.presence_hold_s,
            "calibration_s": c.detection.calibration_s,
        },
        "mapping": {
            "tx_power_dbm": c.mapping.tx_power_dbm,
            "path_loss_exponent": c.mapping.path_loss_exponent,
        },
    }


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    period = 1.0 / CONFIG.sampling.broadcast_hz
    try:
        while True:
            await websocket.send_json(engine.snapshot())
            await asyncio.sleep(period)
    except WebSocketDisconnect:
        return
    except Exception:
        return
