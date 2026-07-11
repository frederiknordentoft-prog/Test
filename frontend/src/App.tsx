import { useState } from "react";
import { SetupPage } from "./pages/SetupPage";
import { RunPage } from "./pages/RunPage";
import { useSimStore } from "./store/simStore";

export default function App() {
  const [view, setView] = useState<"setup" | "run">("setup");
  const runId = useSimStore((s) => s.runId);
  const label = useSimStore((s) => s.label);

  return (
    <>
      <div className="topbar">
        <h1>Agent Market Simulator</h1>
        <span className="subtitle">
          exploratory agent-based simulation — not a forecasting tool
        </span>
        <div className="spacer" />
        {runId && view === "run" && (
          <button onClick={() => setView("setup")}>New simulation</button>
        )}
        {runId && view === "setup" && (
          <button onClick={() => setView("run")}>Back to run: {label}</button>
        )}
      </div>
      {view === "setup" ? (
        <SetupPage onCreated={() => setView("run")} />
      ) : (
        <RunPage />
      )}
    </>
  );
}
