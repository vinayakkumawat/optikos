export interface Sensing {
  timestamp: number;
  rssi_dbm: number;
  noise_dbm: number | null;
  snr_db: number | null;
  motion_score: number;
  motion_state: "quiet" | "motion" | "active";
  presence: boolean;
  presence_confidence: number;
  occupancy_estimate: string;
  occupancy_hint: number;
  breathing_bpm: number | null;
  breathing_confidence: number;
  calibrated: boolean;
  baseline_std: number;
  source_mode: string;
  history: number[];
  spectrum: Spectrum;
}

export interface Spectrum {
  freqs_hz?: number[];
  mag?: number[];
  peak_hz?: number;
}

export interface RouterNode {
  name: string;
  key: string;
  rssi_dbm: number;
  noise_dbm: number | null;
  distance_m: number;
  quality: string;
  channel: number | null;
  band: string | null;
  phy_mode: string | null;
  security: string | null;
  is_current: boolean;
  hidden: boolean;
  bssid: string | null;
  angle_rad: number;
  x: number;
  y: number;
  last_seen: number;
}

export interface RouterSummary {
  total_aps: number;
  bands: Record<string, number>;
  busiest_channels: [number, number][];
  closest: string | null;
}

export interface ChannelInfo {
  channel: number;
  band: string | null;
  count: number;
  congestion: number;
}

export interface ChannelRecommendation {
  band: string;
  channel: number;
  congestion: number;
}

export interface ChannelAnalysis {
  channels: ChannelInfo[];
  recommendations: ChannelRecommendation[];
}

export interface LocationMatch {
  zone_id: string;
  zone_name: string;
  confidence: number;
  distance_db: number;
  ranking: { zone_id: string; name: string; confidence: number }[];
}

export interface Zone {
  id: string;
  name: string;
  created_at: number;
  ap_count: number;
  samples: number;
  connected_rssi: number | null;
}

export interface LinkDrop {
  ts: number;
  from: number;
  to: number;
}

export interface LinkHealth {
  available: boolean;
  rssi_dbm?: number;
  noise_dbm?: number | null;
  snr_db?: number | null;
  tx_rate_mbps?: number | null;
  quality?: string;
  rssi_min?: number;
  rssi_max?: number;
  rssi_avg?: number;
  stability_score?: number;
  recent_drops?: number;
  drops?: LinkDrop[];
  window_s?: number;
  rssi_history?: (number | null)[];
  rate_history?: (number | null)[];
}

export interface GestureEvent {
  ts: number;
  type: string;
  count: number;
}

export interface Gestures {
  last: GestureEvent | null;
  active: boolean;
  recent: GestureEvent[];
  total: number;
}

export interface CoverageSample {
  id: string;
  x: number;
  y: number;
  rssi_dbm: number | null;
  ts: number;
}

export interface Rule {
  id: string;
  name: string;
  trigger: "arrive" | "leave" | "motion" | "gesture" | "room_enter";
  zone: string | null;
  min_count: number;
  action_type: "command" | "webhook";
  target: string;
  enabled: boolean;
  last_fired: number | null;
  last_result: string | null;
  fire_count: number;
}

export interface MultiApLink {
  key: string;
  name: string;
  band: string | null;
  channel: number | null;
  is_current: boolean;
  rssi_dbm: number;
  motion: number;
  std_db: number;
  samples: number;
  active: boolean;
}

export interface MultiAp {
  available: boolean;
  scan_rate_s: number;
  links: MultiApLink[];
  active_links: number;
  total_links: number;
  spatial_activity: number;
  occupancy_estimate: string;
  occupancy_hint: number;
  confidence: number;
}

export interface Snapshot {
  type: string;
  time: number;
  uptime_s: number;
  rssi_source: string;
  scan_source: string;
  interface: string;
  sensing: Sensing | null;
  routers: RouterNode[];
  router_summary: RouterSummary;
  channels: ChannelAnalysis;
  location: LocationMatch | null;
  zone_count: number;
  link_health: LinkHealth;
  gestures: Gestures;
  multi_ap: MultiAp;
}
