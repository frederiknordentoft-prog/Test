import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CustomEvent, Preset, SavedConfig, ScenarioInfo } from "../api/types";
import { useSimStore } from "../store/simStore";

const RESOLUTIONS = ["minute", "hour", "day", "week", "month", "quarter"];
const GAMBLING_EVENT_TYPES = [
  "spilpakke_1", "spilpakke_2", "ad_ban", "tax_change", "enforcement_boost",
  "rg_2_0", "crash_games_licensed", "liberalize", "ai_breakthrough", "offshore_surge",
];

const DEFAULT_LEVERS = {
  population: 500,
  ai_frontier_growth: 0.01,
  channelization_start: 0.82,
  spend_sigma: 1.1,
  monopoly_channelization: 0.95,
  entry_enabled: true,
};

export function SetupPage({ onCreated }: { onCreated: () => void }) {
  const setRun = useSimStore((s) => s.setRun);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState<SavedConfig[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [domain, setDomain] = useState<"finance" | "gambling">("finance");
  const [presetId, setPresetId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("");
  const [label, setLabel] = useState("");
  const [seed, setSeed] = useState(42);
  const [ticks, setTicks] = useState(300);
  const [nActors, setNActors] = useState(300);
  const [resolution, setResolution] = useState("day");
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [levers, setLevers] = useState({ ...DEFAULT_LEVERS });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.presets().then(setPresets).catch((e) => setError(String(e)));
    api.savedConfigs().then(setSaved).catch(() => {});
    api.scenarios().then(setScenarios).catch(() => {});
    api.eventTypes().then(setEventTypes).catch(() => {});
  }, []);

  const isGambling = domain === "gambling";
  const domainPresets = useMemo(
    () => presets.filter((p) => (p.domain ?? "finance") === domain),
    [presets, domain],
  );
  const availableEventTypes = isGambling ? GAMBLING_EVENT_TYPES : eventTypes;

  const switchDomain = (d: "finance" | "gambling") => {
    setDomain(d);
    setPresetId(d === "gambling" ? "dk_baseline" : null);
    setSavedId(null);
    setScenario("");
    setEvents([]);
    setTicks(d === "gambling" ? 72 : 300);
    setResolution(d === "gambling" ? "month" : "day");
  };

  const addEvent = () =>
    setEvents([
      ...events,
      {
        name: "Custom event",
        event_type: availableEventTypes[0] ?? "rate_hike",
        start_tick: isGambling ? 12 : 50,
        duration: 1,
        magnitude: 1.0,
      },
    ]);

  const gamblingOverrides = () => ({
    ...levers,
    channelization_low: Math.min(0.72, levers.channelization_start),
    channelization_high: Math.max(0.92, levers.channelization_start),
  });

  const body = () => ({
    preset_id: savedId ? null : presetId,
    saved_id: savedId,
    domain,
    label: label || (savedId ?? presetId ?? "custom run"),
    seed,
    ticks,
    tick_resolution: resolution,
    scenario: !isGambling && scenario ? scenario : null,
    events,
    ...(isGambling ? { gambling_overrides: gamblingOverrides() } : { n_actors: nActors }),
  });

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const b = body();
      const r = await api.createRun(b);
      setRun(r.run_id, b.label);
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
      await api.saveConfig({ name, ...body() });
      setSaved(await api.savedConfigs());
    } catch (e) {
      setError(String(e));
    }
  };

  const selectedScenario = scenarios.find((s) => s.id === scenario);

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}

      <div className="section-title">1 · Domain</div>
      <div className="preset-grid">
        <div
          className={`preset-card ${domain === "finance" ? "selected" : ""}`}
          onClick={() => switchDomain("finance")}
        >
          <div className="name">📈 Financial market</div>
          <div className="desc">Batch-auction market of heterogeneous investors + real economy.</div>
        </div>
        <div
          className={`preset-card ${domain === "gambling" ? "selected" : ""}`}
          onClick={() => switchDomain("gambling")}
        >
          <div className="name">🎲 Gambling market (Danske Spil)</div>
          <div className="desc">
            Branche-foresight: 4 spor, markedsandel, kanalisering, AI-adoption, indtrædere.
          </div>
        </div>
      </div>

      <div className="section-title">2 · Choose a preset</div>
      <div className="preset-grid">
        {!isGambling && (
          <div
            className={`preset-card ${presetId === null && savedId === null ? "selected" : ""}`}
            onClick={() => { setPresetId(null); setSavedId(null); }}
          >
            <div className="name">Default Market</div>
            <div className="desc">Balanced 300-actor mix, moderate depth and leverage.</div>
          </div>
        )}
        {domainPresets.map((p) => (
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
            <div className="desc">{sc.description || `saved · seed ${sc.seed} · ${sc.ticks} ticks`}</div>
          </div>
        ))}
      </div>

      <div className="section-title">3 · Parameters</div>
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
            <label>Ticks {isGambling ? "(måneder)" : ""}</label>
            <input type="number" min={10} max={5000} value={ticks} onChange={(e) => setTicks(+e.target.value)} />
          </div>
          {!isGambling && (
            <div className="field">
              <label>Actors</label>
              <input type="number" min={50} max={2000} value={nActors} onChange={(e) => setNActors(+e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Tick resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {RESOLUTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {!isGambling && (
            <div className="field">
              <label>Scenario</label>
              <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="">— none (preset events only) —</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.id}</option>
                ))}
              </select>
            </div>
          )}
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

      {isGambling && (
        <>
          <div className="section-title">4 · Policy &amp; market levers</div>
          <div className="card">
            <div className="form-grid">
              <Slider label={`AI-front vækst / md: ${levers.ai_frontier_growth.toFixed(3)}`}
                min={0} max={0.1} step={0.005} value={levers.ai_frontier_growth}
                onChange={(v) => setLevers({ ...levers, ai_frontier_growth: v })} />
              <Slider label={`Kanalisering (start): ${(levers.channelization_start * 100).toFixed(0)} %`}
                min={0.5} max={0.98} step={0.01} value={levers.channelization_start}
                onChange={(v) => setLevers({ ...levers, channelization_start: v })} />
              <Slider label={`Indtægtskoncentration (σ): ${levers.spend_sigma.toFixed(2)}`}
                min={0.3} max={2.5} step={0.1} value={levers.spend_sigma}
                onChange={(v) => setLevers({ ...levers, spend_sigma: v })} />
              <Slider label={`Monopol-kanalisering: ${(levers.monopoly_channelization * 100).toFixed(0)} %`}
                min={0.5} max={1} step={0.01} value={levers.monopoly_channelization}
                onChange={(v) => setLevers({ ...levers, monopoly_channelization: v })} />
              <div className="field">
                <label>Population (spilleragenter)</label>
                <input type="number" min={100} max={5000} step={100} value={levers.population}
                  onChange={(e) => setLevers({ ...levers, population: +e.target.value })} />
              </div>
              <div className="field" style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <label style={{ margin: 0 }}>
                  <input type="checkbox" checked={levers.entry_enabled}
                    onChange={(e) => setLevers({ ...levers, entry_enabled: e.target.checked })} />{" "}
                  Entry / M&amp;A aktiv
                </label>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
              Kanalisering behandles som et interval; indtægtskoncentrationen er den vigtigste
              usikre parameter — kør den i sensitivitet.
            </div>
          </div>
        </>
      )}

      <div className="section-title">{isGambling ? "5" : "4"} · Custom events (optional)</div>
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
                {availableEventTypes.map((t) => (
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
        <span className="muted">The run is created paused — start it from the run view.</span>
      </div>
    </div>
  );

  function update(i: number, patch: Partial<CustomEvent>) {
    setEvents(events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }
}

function Slider({ label, min, max, step, value, onChange }: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}
