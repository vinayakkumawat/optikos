"""WiFi data acquisition layer.

Two independent sources:
  * `rssi.RSSIReader`      - fast (~3ms) signal strength of the *connected* AP,
                             used for motion / presence / occupancy analysis.
  * `scanner.APScanner`    - slower (~3-4s) list of *nearby* routers, used for
                             router mapping and building-level visualization.

Both degrade gracefully to a simulator when real WiFi APIs are unavailable
(e.g. running on Linux/CI, or when macOS denies access).
"""
