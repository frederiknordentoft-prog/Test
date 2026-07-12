import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { CustomEvent, Preset, SavedConfig, ScenarioInfo } from "../api/types";
import { useSimStore } from "../store/simStore";

const RESOLUTIONS = ["minute", "hour", "day", "week", "quarter"];

export function SetupPage({ onCreated }: { onCreated: () => void }) {
  const setRun = useSimStore((s) => s.setRun);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState<SavedConfig[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("");
  const [label, setLabel] = useState("");
  const [seed, setSeed] = useState(42);
  const [ticks, setTicks] = useState(300);
  const [nActors, setNActors] = useState(300);
  const [resolution, setResolution] = useState("day");
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch((e) => setError(String(e)));
    api.savedConfigs().then(setSaved).catch(() => {});
    api.scenarios().then(setScenarios).catch(() => {});
    api.eventTypes().then(setEventTypes).catch(() => {});
  }, []);

  const addEvent = () =>
    setEvents([
      ...events,
      { name: "Custom event", event_type: eventTypes[0] ?? "rate_hike", start_tick: 50, duration: 1, magnitude: 1.0 },
    ]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        preset_id: savedId ? null : presetId,
        saved_id: savedId,
        label: label || (savedId ?? presetId ?? "custom run"),
        seed,
        ticks,
        n_actors: nActors,
        tick_resolution: resolution,
        scenario: scenario || null,
        events,
      };
      const r = await api.createRun(body);
      setRun(r.run_id, body.label);
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveScenario = async () => {
    const name = window.prompt("Name for this scenario:");
    if (!name) return;
    try {
      await api.saveConfig({
        name,
        preset_id: savedId ? null : presetId,
        saved_id: savedId,
        seed,
        ticks,
        n_actors: nActors,
        tick_resolution: resolution,
        scenario: scenario || null,
        events,
      });
      setSaved(await api.savedConfigs());
    } catch (e) {
      setError(String(e));
    }
  };

  const selectedScenario = scenarios.find((s) => s.id === scenario);

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}
      <div className="section-title">1 · Choose a market preset</div>
      <div className="preset-grid">
        <div
          className={`preset-card ${presetId === null && savedId === null ? "selected" : ""}`}
          onClick={() => { setPresetId(null); setSavedId(null); }}
        >
          <div className="name">Default Market</div>
          <div className="desc">Balanced 300-actor mix, moderate depth and leverage.</div>
        </div>
        {presets.map((p) => (
          <div
            key={p.id}
            className={`preset-card ${presetId === p.id ? "selected" : ""}`}
            onClick={() => { setPresetId(p.id); setSavedId(null); }}
          >
            <div className="name">{p.name}</div>
            <div className="desc">{p.description}</div>
          </div>
        ))}
        {saved.map((sc) => (
          <div
            key={sc.id}
            className={`preset-card ${savedId === sc.id ? "selected" : ""}`}
            onClick={() => { setSavedId(sc.id); setPresetId(null); }}
          >
            <div className="name">💾 {sc.name}</div>
            <div className="desc">{sc.description || `saved scenario · seed ${sc.seed} · ${sc.ticks} ticks`}</div>
          </div>
        ))}
      </div>

      <div className="section-title">2 · Parameters</div>
      <div className="card">
        <div className="form-grid">
          <div className="field">
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="my experiment" />
          </div>
          <div className="field">
            <label>Random seed</label>
            <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} />
          </div>
          <div className="field">
            <label>Ticks</label>
            <input type="number" min={10} max={5000} value={ticks} onChange={(e) => setTicks(+e.target.value)} />
          </div>
          <div className="field">
            <label>Actors</label>
            <input type="number" min={50} max={2000} value={nActors} onChange={(e) => setNActors(+e.target.value)} />
          </div>
          <div className="field">
            <label>Tick resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Scenario</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
              <option value="">— none (preset events only) —</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>
        </div>
        {selectedScenario && selectedScenario.events.length > 0 && (
          <div className="muted">
            Scenario events:{" "}
            {selectedScenario.events
              .map((e) => `${e.name} @ tick ${e.start_tick ?? "?"} (×${e.magnitude})`)
              .join(" · ")}
          </div>
        )}
      </div>

      <div className="section-title">3 · Custom events (optional)</div>
      <div className="card">
        {events.length === 0 && <div className="muted">No custom events. Add one to inject your own shock.</div>}
        {events.map((ev, i) => (
          <div key={i} className="form-grid" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Name</label>
              <input value={ev.name} onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={ev.event_type} onChange={(e) => update(i, { event_type: e.target.value })}>
                {eventTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Start tick</label>
              <input type="number" value={ev.start_tick} onChange={(e) => update(i, { start_tick: +e.target.value })} />
            </div>
            <div className="field">
              <label>Duration</label>
              <input type="number" min={1} value={ev.duration} onChange={(e) => update(i, { duration: +e.target.value })} />
            </div>
            <div className="field">
              <label>Magnitude</label>
              <input type="number" step={0.1} value={ev.magnitude} onChange={(e) => update(i, { magnitude: +e.target.value })} />
            </div>
            <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="danger" onClick={() => setEvents(events.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button onClick={addEvent}>+ Add event</button>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center" }}>
        <button className="primary" onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create simulation"}
        </button>
        <button onClick={saveScenario}>Save as scenario</button>
        <span className="muted">
          The run is created paused — start it from the run view.
        </span>
      </div>
    </div>
  );

  function update(i: number, patch: Partial<CustomEvent>) {
    setEvents(events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }
}
