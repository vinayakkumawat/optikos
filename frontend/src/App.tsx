import { StatusBar } from "./components/StatusBar";
import { PresenceCard } from "./components/PresenceCard";
import { MotionGauge } from "./components/MotionGauge";
import { SignalChart } from "./components/SignalChart";
import { OccupancyCard } from "./components/OccupancyCard";
import { MultiLinkPanel } from "./components/MultiLinkPanel";
import { VitalsCard } from "./components/VitalsCard";
import { RouterRadar } from "./components/RouterRadar";
import { RouterTable } from "./components/RouterTable";
import { HiddenNamesBanner } from "./components/HiddenNamesBanner";
import { RoomsPanel } from "./components/RoomsPanel";
import { ChannelPanel } from "./components/ChannelPanel";
import { HealthPanel } from "./components/HealthPanel";
import { GestureCard } from "./components/GestureCard";
import { CoveragePanel } from "./components/CoveragePanel";
import { AutomationPanel } from "./components/AutomationPanel";
import { SignalsPanel } from "./components/SignalsPanel";
import { SpectrumCard } from "./components/SpectrumCard";
import { useSensing } from "./useSensing";

export default function App() {
  const { snapshot, conn, recalibrate } = useSensing();
  const s = snapshot?.sensing ?? null;

  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6">
      <StatusBar snapshot={snapshot} conn={conn} onRecalibrate={recalibrate} />

      <HiddenNamesBanner routers={snapshot?.routers ?? []} />

      <div className="mt-4">
        <SignalsPanel snapshot={snapshot} />
      </div>

      <main className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Column 1 — presence + occupancy */}
        <div className="flex flex-col gap-4">
          <PresenceCard s={s} />
          <OccupancyCard s={s} />
          <MultiLinkPanel multi={snapshot?.multi_ap} />
        </div>

        {/* Column 2 — live signal + motion + spectrum + vitals */}
        <div className="flex flex-col gap-4">
          <SignalChart s={s} />
          <SpectrumCard s={s} />
          <MotionGauge s={s} />
          <GestureCard gestures={snapshot?.gestures} />
          <VitalsCard s={s} />
        </div>

        {/* Column 3 — router mapping + rooms + health */}
        <div className="flex flex-col gap-4">
          <RouterRadar routers={snapshot?.routers ?? []} />
          <HealthPanel health={snapshot?.link_health} />
          <RoomsPanel location={snapshot?.location ?? null} />
        </div>
      </main>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CoveragePanel />
        <AutomationPanel />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RouterTable routers={snapshot?.routers ?? []} summary={snapshot?.router_summary} />
        </div>
        <div className="lg:col-span-1">
          <ChannelPanel analysis={snapshot?.channels} />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-edge bg-panel/50 p-4 text-[12px] leading-relaxed text-slate-400">
        <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-300">
          How to read this
        </h3>
        <ul className="grid gap-2 md:grid-cols-2">
          <li>
            <span className="text-accent">Motion / presence</span> come from how much the
            signal to your router <em>fluctuates</em> — people moving disturb the radio waves.
          </li>
          <li>
            <span className="text-accent">Rooms map</span> uses each spot's unique set of
            router signal strengths as a fingerprint to detect which room you're in.
          </li>
          <li>
            <span className="text-accent">Router map / channels</span> show every access point
            your WiFi can hear, by distance and channel congestion.
          </li>
          <li>
            Occupancy and breathing are <span className="text-warn">rough estimates</span> — a
            single WiFi link is a coarse sensor; CSI hardware (ESP32) is needed for accuracy.
          </li>
        </ul>
      </div>

      <footer className="mt-6 pb-4 text-center text-[11px] text-slate-600">
        Optikos · WiFi spatial sensing · software-only demo · inspired by RuView / WiFi-DensePose
      </footer>
    </div>
  );
}
