# Optikos — Architecture & Design

This document explains *how* Optikos is built and *why* it's built that way. It's
written to make the system-design reasoning explicit: the constraints, the data
flow, the concurrency model, and the trade-offs behind each decision.

---

## 1. Problem statement & constraints

**Goal:** extract as much spatial/environmental information as possible from a
laptop's existing Wi-Fi connection, in software only.

Hard constraints that shaped every decision:

| Constraint | Consequence |
| --- | --- |
| One Wi-Fi radio, associated to one AP | Only the connected AP gives a *fast* RSSI stream; neighbors are only observable via slow scans. |
| RSSI is a single scalar per link | No spatial/phase info → motion is inferable, imaging is not. |
| macOS scans are slow (1–4 s) and may redact SSIDs | Scan-derived features are low-rate; UI must degrade gracefully. |
| Must run on a normal laptop, no root ideally | Prefer CoreWLAN userspace APIs; treat privileged data as a bonus. |
| Real-time UI | Need a streaming transport and non-blocking acquisition. |

The central design principle: **separate the fast path from the slow path**, and
**never let the slow path block the fast path or the UI.**

---

## 2. Component overview

```
backend/app/
├── main.py          FastAPI app: REST + WebSocket, request models, DI of the engine
├── engine.py        Orchestrator: 2 daemon threads, shared state, snapshot assembly
├── config.py        Central tunable configuration (sampling, detection, mapping)
├── dsp/analyzer.py  RSSI → motion/presence/occupancy + FFT spectrum/breathing
├── link_health.py   Connection-quality tracker (trends, drops, stability)
├── gesture.py       Sharp-spike (wave/knock) detector with sequence grouping
├── multi_ap.py      Per-AP RSSI variability → spatial-activity estimate
├── mapping.py       RSSI → distance (path-loss), dedupe, channel analysis
├── zones.py         RF-fingerprint capture + room matching (persisted)
├── coverage.py      Coverage/dead-zone survey samples (persisted)
├── automation.py    Rules engine: triggers → command/webhook actions (persisted)
└── wifi/
    ├── rssi.py      CoreWLAN fast RSSI reader (+ simulator fallback)
    └── scanner.py   system_profiler / CoreWLAN AP scanner (+ simulator)

frontend/src/
├── useSensing.ts    WebSocket hook → live snapshot
├── use{Zones,Coverage,Rules}.ts   REST hooks for stateful features
└── components/      One card per concern (presence, spectrum, radar, signals…)
```

Each backend module owns exactly one concern and exposes a small, testable surface
(`add()/update()` + `snapshot()`), which keeps the orchestrator thin.

---

## 3. Concurrency model

Two daemon threads, one asyncio server — chosen because the acquisition work is
blocking/synchronous (CoreWLAN calls, subprocess scans) and would otherwise stall
the event loop.

```
┌─────────────────────────────────────────────────────────────┐
│ RSSI loop (fast, ~8 Hz)                                        │
│   read RSSI → analyzer.add_sample → analyze()                  │
│            → health.add → gesture.add                          │
│            → write shared state → check automations            │
├─────────────────────────────────────────────────────────────┤
│ Scan loop (slow, ~every 6 s)                                   │
│   scan APs → build_map → channel_analysis                      │
│           → multi_ap.update → zones.match                      │
│           → write shared state → fire room_enter automations   │
├─────────────────────────────────────────────────────────────┤
│ FastAPI (asyncio)                                              │
│   WebSocket: snapshot() every ~200 ms                          │
│   REST: reads snapshot(), mutates stores                       │
└─────────────────────────────────────────────────────────────┘
```

- A single `threading.Lock` guards the shared-state dict. Critical sections are
  tiny (dict field assignments), so contention is negligible.
- The scan loop sleeps in 0.5 s increments so `stop()` stays responsive.
- **Why threads, not asyncio tasks?** CoreWLAN and `system_profiler` are
  synchronous and blocking; running them in threads keeps the event loop free to
  serve the WebSocket at a steady rate.

---

## 4. Signal-processing pipeline (the core)

**Motion.** Keep a rolling window (240 samples ≈ 30 s). Compute short-term σ of
the most recent samples. During the first ~20 s, learn an empty-room baseline as a
low percentile of observed σ (robust to occasional early movement). Motion score =
`clip((σ / baseline − 1) · k, 0, 100)`, then exponentially smoothed for a stable UI
value. Discrete states come from thresholds; presence is motion sustained beyond a
hold time.

**Spectrum / breathing.** Detrend the window with a quadratic fit (removes slow
drift/roaming), apply a Hann window (reduces spectral leakage), take the real FFT.
The 0.1–0.6 Hz band (6–36 breaths/min) is scanned for a dominant peak; confidence
is the peak's share of total spectral energy. The 0–2 Hz slice is downsampled to
48 bins for the live visualization. Confidence is intentionally capped — the
physics is weak for a single link.

**Distance.** Log-distance path-loss inversion:
`d = 10 ^ ((tx_power − RSSI) / (10 · n))`, with `n` (path-loss exponent) tunable for
open space vs. walls. Explicitly coarse; used for relative radar layout, not metrology.

**Multi-AP spatial activity.** Track each strong neighbor's RSSI across scans, learn
a per-link quiet floor, score variability above it. Counting how many *independent*
links are simultaneously disturbed approximates whether activity is localized or
spread out. Confidence is capped and scales with scan cadence — an honest reflection
of the slow-scan limitation.

**RF-fingerprint localization.** A room's fingerprint is the vector of per-AP mean
RSSI at that spot. Live location = the captured fingerprint minimizing mean absolute
RSSI difference over shared APs; confidence derived from the match distance.

---

## 5. Robustness & graceful degradation

- **Layered data sources:** CoreWLAN (best) → `system_profiler` → simulator. The
  scanner reports which mode is active so the UI can be honest about it.
- **Privacy-aware:** when macOS redacts SSIDs (no Location permission), APs are
  deduped by `BSSID` when available, else `name::channel`, and shown with friendly
  band/channel labels — no crashes, no duplicate React keys.
- **Simulator parity:** every source has a physics-flavored simulator, so the whole
  stack (and UI) runs on any machine and in CI.
- **Fail-soft loops:** acquisition threads swallow per-iteration exceptions so a
  single bad read never kills the stream.

---

## 6. Frontend design

- A single WebSocket hook (`useSensing`) holds the latest snapshot; every card is a
  pure function of that snapshot → predictable, easy to reason about.
- Stateful features (zones, coverage, rules) use small REST hooks with optimistic
  refresh.
- Visual-heavy pieces (router radar, coverage heatmap, FFT spectrum) render on
  Canvas 2D for smooth updates without React churn.
- Tailwind design tokens keep a consistent instrument-panel aesthetic.

---

## 7. Key trade-offs (summary)

| Decision | Why | Cost |
| --- | --- | --- |
| Threads for acquisition | blocking OS calls; keep event loop free | manual locking |
| Snapshot polling over granular events | simple, race-free UI contract | slight redundancy |
| Faster scan cadence (6 s) | more multi-AP samples | more CPU / scan churn |
| Cap confidence on weak features | intellectual honesty > hype | looks "less impressive" |
| Per-concern modules | testability, pluggability (future CSI) | more files |

---

## 8. Extending to CSI (the upgrade path)

The engine treats acquisition as pluggable. A CSI source (e.g. ESP32-S3) would add
a module under `backend/app/wifi/` producing per-subcarrier amplitude/phase; the
analyzer would gain a CSI branch, and the existing state/stream/UI contract stays
the same. That's the whole point of keeping the fast/slow split and the thin
orchestrator: the *hard* part (real vitals, pose) becomes an additive change, not a
rewrite.
