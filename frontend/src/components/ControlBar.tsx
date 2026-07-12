import { useState } from "react";
import { api } from "../api/client";
import { useSimStore } from "../store/simStore";

export function ControlBar() {
  const { runId, status, tick, ticksTarget, setRun, label } = useSimStore();
  const [tps, setTps] = useState(20);
  if (!runId) return null;

  const running = status === "running";
  const done = status === "finished" || status === "stopped";
  const progress = ticksTarget > 0 ? Math.min(100, (tick / ticksTarget) * 100) : 0;

  const changeSpeed = (v: number) => {
    setTps(v);
    api.speed(runId, v).catch(() => {});
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="controls">
        <span className={`badge ${status}`}>{status}</span>
        {!running && !done && (
          <button className="primary" onClick={() => api.control(runId, "start")}>
            ▶ Run
          </button>
        )}
        {running && <button onClick={() => api.control(runId, "pause")}>⏸ Pause</button>}
        {!done && (
          <>
            <button onClick={() => api.step(runId, 1)}>Step 1</button>
            <button onClick={() => api.step(runId, 10)}>Step 10</button>
            <button className="danger" onClick={() => api.control(runId, "stop")}>
              ■ Stop
            </button>
          </>
        )}
        <button
          onClick={async () => {
            const r = await api.reset(runId);
            setRun(r.run_id, label);
          }}
        >
          ↺ Reset
        </button>
        <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          speed
          <input
            type="range"
            min={1}
            max={100}
            value={tps}
            style={{ width: 110 }}
            onChange={(e) => changeSpeed(+e.target.value)}
          />
          <span className="muted">{tps} t/s</span>
        </label>
        <div className="progress-outer">
          <div className="progress-inner" style={{ width: `${progress}%` }} />
        </div>
        <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
          tick {tick} / {ticksTarget}
        </span>
        <select
          style={{ width: 130 }}
          defaultValue=""
          onChange={(e) => {
            const fmt = e.target.value;
            e.target.value = "";
            if (!fmt) return;
            api
              .exportRun(runId, fmt)
              .then((r) => alert(`Exported ${r.files.length} files to\n${r.directory}`))
              .catch((err) => alert(String(err)));
          }}
        >
          <option value="">Export…</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="parquet">Parquet</option>
        </select>
        <button onClick={() => window.open(`/api/runs/${runId}/report`, "_blank")}>
          HTML report
        </button>
      </div>
    </div>
  );
}
