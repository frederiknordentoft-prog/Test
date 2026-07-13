import { useState } from "react";
import { api } from "../api/client";
import { useSimStore } from "../store/simStore";
import { toast } from "../format";

export function ControlBar() {
  const { runId, status, tick, ticksTarget, setRun, label, domain } = useSimStore();
  const [tps, setTps] = useState(20);
  if (!runId) return null;

  const running = status === "running";
  const done = status === "finished" || status === "stopped";
  const progress = ticksTarget > 0 ? Math.min(100, (tick / ticksTarget) * 100) : 0;
  const timeUnit = domain === "gambling" ? "md" : "tick";

  const changeSpeed = (v: number) => {
    setTps(v);
    api.speed(runId, v).catch(() => {});
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="controls">
        <span className={`badge ${status}`}>{statusDa(status)}</span>
        {!running && !done && (
          <button className="primary" onClick={() => api.control(runId, "start")}>
            ▶ Kør
          </button>
        )}
        {running && <button onClick={() => api.control(runId, "pause")}>⏸ Pause</button>}
        {!done && (
          <>
            <button onClick={() => api.step(runId, 1)}>+1 {timeUnit}</button>
            <button onClick={() => api.step(runId, 10)}>+10 {timeUnit}</button>
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
          ↺ Nulstil
        </button>
        <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          fart
          <input
            type="range"
            min={1}
            max={100}
            value={tps}
            style={{ width: 110 }}
            onChange={(e) => changeSpeed(+e.target.value)}
          />
          <span className="muted">{tps} {timeUnit}/s</span>
        </label>
        <div className="progress-outer">
          <div className="progress-inner" style={{ width: `${progress}%` }} />
        </div>
        <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
          {timeUnit} {tick} / {ticksTarget}
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
              .then((r) => toast(`Eksporterede ${r.files.length} filer til ${r.directory}`))
              .catch((err) => toast(String(err)));
          }}
        >
          <option value="">Eksportér…</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
          <option value="parquet">Parquet</option>
        </select>
        <button onClick={() => window.open(`/api/runs/${runId}/report`, "_blank")}>
          HTML-rapport
        </button>
      </div>
    </div>
  );
}

function statusDa(status: string): string {
  return { created: "oprettet", running: "kører", paused: "pauset",
           finished: "færdig", stopped: "stoppet", error: "fejl" }[status] ?? status;
}
