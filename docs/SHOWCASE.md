# Optikos — Showcase copy (resume + LinkedIn)

Ready-to-paste copy for your resume, LinkedIn, and portfolio. Swap the repo link
once it's public: `https://github.com/vinayakkumawat/optikos`.

---

## One-line pitch

> **Optikos** — a software-only Wi-Fi spatial-sensing platform that extracts ~30
> live signals (motion, presence, indoor localization, breathing, RF map) from a
> single laptop Wi-Fi link, with a real-time React dashboard.

---

## Resume — project bullets

**Optikos — Wi-Fi Spatial Sensing Platform** · *Python, FastAPI, NumPy, React, TypeScript*
`github.com/vinayakkumawat/optikos`

- Built a real-time sensing system that derives **~30 distinct signals** (motion, presence, coarse occupancy, indoor room localization, breathing estimate, RF coverage map) from a **single Wi-Fi link's RSSI**, using only software — no additional hardware.
- Designed a **DSP pipeline** in NumPy: rolling-window variance against an adaptively-calibrated baseline for motion/presence, plus detrended, Hann-windowed **FFT** for a live frequency spectrum and experimental breathing detection.
- Architected a **non-blocking concurrency model** (dual acquisition threads + FastAPI asyncio) that separates a fast 8 Hz RSSI stream from slow AP scans, streaming state to the UI over WebSockets at ~5 Hz.
- Implemented **RF-fingerprint indoor localization**, a **multi-AP spatial-activity** estimator, connection-health analytics, a coverage/dead-zone heatmap (IDW interpolation), and a trigger→action automations engine.
- Emphasized **engineering honesty**: explicit confidence scores and a documented capabilities matrix distinguishing reliable results from physical limitations (CSI-hardware boundary), plus graceful degradation and a full simulator for hardware-free development.

*(Use the top 3–4 bullets for a compact resume; keep all five for a portfolio page.)*

---

## Resume — shorter single bullet (if space is tight)

- **Optikos:** software-only Wi-Fi sensing platform (Python/FastAPI + React/TS) that turns one laptop's Wi-Fi RSSI into ~30 real-time signals — motion, presence, indoor localization, breathing (FFT), and a live RF map — with a WebSocket-streamed dashboard and honest, confidence-scored outputs.

---

## LinkedIn post (draft)

> **What can you actually sense with just the Wi-Fi your laptop is already on? Turns out — a lot. 📡**
>
> I built **Optikos**, a software-only spatial-sensing platform that treats a single Wi-Fi link as a scientific instrument. No extra hardware, no special router — just the signal strength (RSSI) of the access point you're already connected to, sampled a few times a second.
>
> That one number becomes **~30 live signals** across four layers:
> • **Raw radio** — RSSI, SNR, noise, Tx-rate, distance estimate
> • **DSP** — motion, presence, occupancy, a live FFT spectrum, breathing estimate
> • **Spatial** — multi-router activity, RF-fingerprint room localization, coverage/dead-zone maps
> • **Environment** — channel congestion, connection health & stability
>
> The engineering I'm most proud of isn't a flashy claim — it's the **honesty**. Every uncertain output carries a confidence score, and the README has a capabilities matrix that clearly marks what's reliable vs. what's a physical limitation of RSSI (imaging/pose needs CSI hardware). Knowing *where the physics stops* is the real skill.
>
> Under the hood: a **FastAPI + NumPy** backend with a non-blocking dual-thread acquisition model (fast RSSI stream vs. slow AP scans), WebSocket streaming, and a **React + TypeScript** instrument-panel dashboard with Canvas visualizations.
>
> Open source (MIT) 👉 github.com/vinayakkumawat/optikos
>
> #SignalProcessing #Python #React #SystemDesign #WiFi #DSP #OpenSource

---

## Talking points (for interviews)

- **System design:** why fast/slow acquisition are separated into threads; why the UI reads a single snapshot; the pluggable-source design that makes a future CSI upgrade additive.
- **Problem solving:** turning a hardware limitation into a scoped exploration; graceful degradation across CoreWLAN → system_profiler → simulator; handling macOS SSID redaction.
- **Data skills:** the DSP pipeline (baseline calibration, variance, detrending, windowing, FFT), the IDW coverage interpolation, fingerprint matching, and CSV/JSON export for reproducibility.
- **Judgment:** confidence scoring and the honest capabilities matrix — communicating uncertainty instead of overclaiming.
