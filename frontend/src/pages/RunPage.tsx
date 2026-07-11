import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useRunSocket } from "../api/useRunSocket";
import type { ActorsResponse, DecisionLogEntry } from "../api/types";
import { ActorOverview } from "../components/ActorOverview";
import { ControlBar } from "../components/ControlBar";
import { DecisionLog } from "../components/DecisionLog";
import { EventTimeline } from "../components/EventTimeline";
import { MarketOverview } from "../components/MarketOverview";
import { useSimStore } from "../store/simStore";

type Tab = "market" | "actors" | "decisions";

export function RunPage() {
  const { runId, tick, status } = useSimStore();
  const [tab, setTab] = useState<Tab>("market");
  const [actors, setActors] = useState<ActorsResponse | null>(null);
  const [decisions, setDecisions] = useState<DecisionLogEntry[]>([]);

  useRunSocket(runId);

  useEffect(() => {
    if (!runId) return;
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

  return (
    <div className="page">
      <ControlBar />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["market", "actors", "decisions"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "primary" : ""}
            onClick={() => setTab(t)}
          >
            {t === "market" ? "Market" : t === "actors" ? "Actors" : "Decisions & events"}
          </button>
        ))}
      </div>
      {tab === "market" && <MarketOverview />}
      {tab === "actors" && <ActorOverview actors={actors} />}
      {tab === "decisions" && (
        <div className="grid grid-2">
          <DecisionLog decisions={decisions} />
          <EventTimeline />
        </div>
      )}
    </div>
  );
}
