import { useState } from "react";
import { ComparePage } from "./pages/ComparePage";
import { IntroPage } from "./pages/IntroPage";
import { MonteCarloPage } from "./pages/MonteCarloPage";
import { RunPage } from "./pages/RunPage";
import { SetupPage } from "./pages/SetupPage";
import { useSimStore } from "./store/simStore";

type View = "intro" | "setup" | "run" | "montecarlo" | "compare";

const NAV: { id: View; label: string }[] = [
  { id: "intro", label: "Sådan virker det" },
  { id: "setup", label: "Opsætning" },
  { id: "run", label: "Kørsel" },
  { id: "montecarlo", label: "Monte Carlo" },
  { id: "compare", label: "Sammenlign" },
];

export default function App() {
  const [view, setView] = useState<View>("intro");
  const runId = useSimStore((s) => s.runId);

  return (
    <>
      <div className="topbar">
        <h1>Agent Market Simulator</h1>
        <span className="subtitle">
          eksplorativ agentbaseret simulation — ikke et prognoseværktøj
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
      {view === "intro" && <IntroPage onStart={() => setView("setup")} />}
      {view === "setup" && <SetupPage onCreated={() => setView("run")} />}
      {view === "run" && <RunPage />}
      {view === "montecarlo" && <MonteCarloPage />}
      {view === "compare" && <ComparePage />}
    </>
  );
}
