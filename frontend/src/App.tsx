import { useState } from "react";
import { ComparePage } from "./pages/ComparePage";
import { ForecastPage } from "./pages/ForecastPage";
import { IntroPage } from "./pages/IntroPage";
import { InvesteringscasePage } from "./pages/InvesteringscasePage";
import { MonteCarloPage } from "./pages/MonteCarloPage";
import { RunPage } from "./pages/RunPage";
import { SetupPage } from "./pages/SetupPage";
import { useSimStore } from "./store/simStore";
import { APP_VERSION } from "./version";

type View = "intro" | "setup" | "run" | "montecarlo" | "forecast" | "investeringscase" | "compare";

const NAV: { id: View; label: string }[] = [
  { id: "intro", label: "Sådan virker det" },
  { id: "setup", label: "Opsætning" },
  { id: "run", label: "Kørsel" },
  { id: "montecarlo", label: "Monte Carlo" },
  { id: "forecast", label: "Prognose & validering" },
  { id: "investeringscase", label: "Investeringscase" },
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
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "active" : ""}
              disabled={n.id === "run" && !runId}
              onClick={() => setView(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>
      {view === "intro" && <IntroPage onStart={() => setView("setup")} />}
      {view === "setup" && <SetupPage onCreated={() => setView("run")} />}
      {view === "run" && <RunPage />}
      {view === "montecarlo" && <MonteCarloPage />}
      {view === "forecast" && <ForecastPage />}
      {view === "investeringscase" && <InvesteringscasePage />}
      {view === "compare" && <ComparePage />}
      <footer className="app-footer">
        <span>Agent Market Simulator</span>
        <span className="dot">·</span>
        <span className="ver">v{APP_VERSION}</span>
        <span className="dot">·</span>
        <span>Danske Spil branch-foresight — illustrativ, ikke et prognoseværktøj</span>
      </footer>
    </>
  );
}
