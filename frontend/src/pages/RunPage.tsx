import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useRunSocket } from "../api/useRunSocket";
import type { ActorsResponse, DecisionLogEntry } from "../api/types";
import { ActorOverview } from "../components/ActorOverview";
import { ControlBar } from "../components/ControlBar";
import { DecisionLog } from "../components/DecisionLog";
import { EventTimeline } from "../components/EventTimeline";
import { GamblingDashboard } from "../components/GamblingDashboard";
import { MarketOverview } from "../components/MarketOverview";
import { NetworkView } from "../components/NetworkView";
import { ReactionPanel } from "../components/ReactionPanel";
import { useSimStore } from "../store/simStore";

type Tab = "market" | "actors" | "network" | "decisions";

const TABS: { id: Tab; label: string }[] = [
  { id: "market", label: "Market" },
  { id: "actors", label: "Actors" },
  { id: "network", label: "Network" },
  { id: "decisions", label: "Decisions & events" },
];

export function RunPage() {
  const { runId, tick, status, domain } = useSimStore();
  const [tab, setTab] = useState<Tab>("market");
  const [actors, setActors] = useState<ActorsResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionLogEntry[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null);
  const isGambling = domain === "gambling";

  useRunSocket(runId);

  useEffect(() => {
    if (!runId || isGambling) return; // gambling views read the metrics frame only
    let stop = false;
    const poll = async () => {
      try {
        const [a, d] = await Promise.all([api.actors(runId), api.decisions(runId, 60)]);
        if (!stop) {
          setActors(a);
          setDecisions(d);
        }
      } catch {
        /* run may be resetting */
      }
    };
    poll();
    const iv = setInterval(poll, 2500);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [runId, status === "running" ? Math.floor(tick / 10) : status]);

  if (!runId) {
    return (
      <div className="page">
        <div className="muted">No simulation yet — create one from the setup page.</div>
      </div>
    );
  }

  if (isGambling) {
    return (
      <div className="page">
        <ControlBar />
        <GamblingDashboard />
      </div>
    );
  }

  return (
    <div className="page">
      <ControlBar />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "primary" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "market" && <MarketOverview />}
      {tab === "actors" && <ActorOverview actors={actors} />}
      {tab === "network" && <NetworkView />}
      {tab === "decisions" && (
        <>
          {selectedEvent !== null && (
            <div style={{ marginBottom: 16 }}>
              <ReactionPanel eventIndex={selectedEvent} onClose={() => setSelectedEvent(null)} />
            </div>
          )}
          <div className="grid grid-2">
            <DecisionLog decisions={decisions} />
            <EventTimeline onSelect={setSelectedEvent} />
          </div>
        </>
      )}
    </div>
  );
}
