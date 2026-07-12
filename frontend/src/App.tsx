import { useState } from "react";
import { ComparePage } from "./pages/ComparePage";
import { MonteCarloPage } from "./pages/MonteCarloPage";
import { RunPage } from "./pages/RunPage";
import { SetupPage } from "./pages/SetupPage";
import { useSimStore } from "./store/simStore";

type View = "setup" | "run" | "montecarlo" | "compare";

const NAV: { id: View; label: string }[] = [
  { id: "setup", label: "Setup" },
  { id: "run", label: "Run" },
  { id: "montecarlo", label: "Monte Carlo" },
  { id: "compare", label: "Compare" },
];

export default function App() {
  const [view, setView] = useState<View>("setup");
  const runId = useSimStore((s) => s.runId);

  return (
    <>
      <div className="topbar">
        <h1>Agent Market Simulator</h1>
        <span className="subtitle">
          exploratory agent-based simulation — not a forecasting tool
        </span>
        <div className="spacer" />
        {NAV.map((n) => (
          <button
            key={n.id}
            className={view === n.id ? "primary" : ""}
            disabled={n.id === "run" && !runId}
            onClick={() => setView(n.id)}
          >
            {n.label}
          </button>
        ))}
      </div>
      {view === "setup" && <SetupPage onCreated={() => setView("run")} />}
      {view === "run" && <RunPage />}
      {view === "montecarlo" && <MonteCarloPage />}
      {view === "compare" && <ComparePage />}
    </>
  );
}
