import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { CustomEvent, Preset, SavedConfig, ScenarioInfo } from "../api/types";
import { InfoTip } from "../components/charts";
import { useSimStore } from "../store/simStore";
import { EVENT_LABELS, toast } from "../format";

const RESOLUTIONS = ["minute", "hour", "day", "week", "month", "quarter"];
const GAMBLING_EVENT_TYPES = Object.keys(EVENT_LABELS);

const DEFAULT_LEVERS = {
  population: 500,
  ai_frontier_growth: 0.01,
  channelization_start: 0.82,
  spend_sigma: 1.7,
  monopoly_channelization: 0.95,
  entry_enabled: true,
};

/** σ → "top-5 % of players hold X % of revenue" (measured empirically in the
 *  model incl. the risk coupling) so the lever speaks human, not lognormal. */
const TOP5_MAP: [number, number][] = [
  [1.1, 0.33], [1.3, 0.39], [1.5, 0.46], [1.7, 0.54], [1.9, 0.61], [2.2, 0.71],
];
function top5Share(sigma: number): number {
  if (sigma <= TOP5_MAP[0][0]) return TOP5_MAP[0][1];
  for (let i = 1; i < TOP5_MAP.length; i++) {
    const [x1, y1] = TOP5_MAP[i - 1];
    const [x2, y2] = TOP5_MAP[i];
    if (sigma <= x2) return y1 + ((sigma - x1) / (x2 - x1)) * (y2 - y1);
  }
  return TOP5_MAP[TOP5_MAP.length - 1][1];
}

/** Operator-strategy panel defaults (mirror DEFAULT_OPERATORS in the backend).
 *  All named operators are adjustable — the user asked "is Betano the only one
 *  you can tune?"; now the whole named field is. */
const OP_DEFAULTS: Record<string, { name: string; marketing: number; bonus: number;
  ai_adoption: number; aggressiveness: number }> = {
  ds_lotteri: { name: "Danske Spil (Lotteri-monopol)", marketing: 0.70, bonus: 0.10,
                ai_adoption: 0.08, aggressiveness: 0.50 },
  ds_licens: { name: "Danske Spil (Licens)", marketing: 0.70, bonus: 0.35,
               ai_adoption: 0.08, aggressiveness: 0.50 },
  bet365: { name: "bet365", marketing: 0.60, bonus: 0.60,
            ai_adoption: 0.08, aggressiveness: 0.50 },
  unibet: { name: "Unibet (FDJ)", marketing: 0.60, bonus: 0.60,
            ai_adoption: 0.08, aggressiveness: 0.50 },
  betano: { name: "Betano (udfordrer)", marketing: 0.92, bonus: 0.90,
            ai_adoption: 0.08, aggressiveness: 0.92 },
  leovegas: { name: "LeoVegas (MGM)", marketing: 0.52, bonus: 0.62,
              ai_adoption: 0.08, aggressiveness: 0.50 },
  betsson: { name: "Betsson / NordicBet", marketing: 0.50, bonus: 0.58,
             ai_adoption: 0.08, aggressiveness: 0.50 },
  mrgreen: { name: "Mr Green (Evoke)", marketing: 0.45, bonus: 0.58,
             ai_adoption: 0.08, aggressiveness: 0.50 },
};

export function SetupPage({ onCreated }: { onCreated: () => void }) {
  const setRun = useSimStore((s) => s.setRun);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saved, setSaved] = useState<SavedConfig[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [domain, setDomain] = useState<"finance" | "gambling">("gambling");
  const [presetId, setPresetId] = useState<string | null>("dk_baseline");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string>("");
  const [label, setLabel] = useState("");
  const [seed, setSeed] = useState(42);
  const [ticks, setTicks] = useState(72);
  const [nActors, setNActors] = useState(300);
  const [resolution, setResolution] = useState("month");
  const [events, setEvents] = useState<CustomEvent[]>([]);
  const [levers, setLevers] = useState({ ...DEFAULT_LEVERS });
  const [ops, setOps] = useState(() => structuredClone(OP_DEFAULTS));
  const [trendCatalog, setTrendCatalog] = useState<
    { id: string; name: string; desc: string; realism: string; default: number }[]
  >([]);
  const [trends, setTrends] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    api.presets().then(setPresets).catch((e) => setError(String(e)));
    api.savedConfigs().then(setSaved).catch(() => {});
    api.scenarios().then(setScenarios).catch(() => {});
    api.eventTypes().then(setEventTypes).catch(() => {});
    api.trends().then(setTrendCatalog).catch(() => {});
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
        name: isGambling ? EVENT_LABELS[availableEventTypes[0]]?.name ?? "Hændelse" : "Custom event",
        event_type: availableEventTypes[0] ?? "rate_hike",
        start_tick: isGambling ? 12 : 50,
        duration: 1,
        magnitude: 1.0,
      },
    ]);

  const gamblingOverrides = () => {
    // Only send operator overrides that differ from the archetype defaults.
    const operator_overrides: Record<string, Record<string, number>> = {};
    for (const [oid, v] of Object.entries(ops)) {
      const d = OP_DEFAULTS[oid];
      const patch: Record<string, number> = {};
      if (v.marketing !== d.marketing) patch.marketing_reach = v.marketing;
      if (v.bonus !== d.bonus) patch.bonus = v.bonus;
      if (v.ai_adoption !== d.ai_adoption) patch.ai_adoption = v.ai_adoption;
      if (v.aggressiveness !== d.aggressiveness) patch.aggressiveness = v.aggressiveness;
      if (Object.keys(patch).length) operator_overrides[oid] = patch;
    }
    return {
      ...levers,
      channelization_low: Math.min(0.72, levers.channelization_start),
      channelization_high: Math.max(0.92, levers.channelization_start),
      ...(Object.keys(operator_overrides).length ? { operator_overrides } : {}),
      ...(Object.keys(trends).length ? { trends } : {}),
    };
  };

  const toggleTrend = (id: string, def: number) => {
    setTrends((t) => {
      const next = { ...t };
      if (id in next) delete next[id];
      else next[id] = def;
      return next;
    });
  };

  const body = () => ({
    preset_id: savedId ? null : presetId,
    saved_id: savedId,
    domain,
    label: label || (savedId ?? presetId ?? "eksperiment"),
    seed,
    ticks,
    tick_resolution: resolution,
    scenario: !isGambling && scenario ? scenario : null,
    events,
    ...(isGambling ? { gambling_overrides: gamblingOverrides() } : { n_actors: nActors }),
  });

  /** Create + auto-start: one click to a live answer (design-review fix). */
  const create = async (autostart = true) => {
    setBusy(true);
    setError(null);
    try {
      const b = body();
      const r = await api.createRun(b);
      if (autostart) await api.control(r.run_id, "start").catch(() => {});
      setRun(r.run_id, b.label);
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  /** The hero path: run the calibrated Danish baseline in a single click. */
  const runBaseline = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.createRun({
        preset_id: "dk_baseline", domain: "gambling",
        label: "DK baseline", ticks: 72, tick_resolution: "month", events: [],
      });
      await api.control(r.run_id, "start").catch(() => {});
      setRun(r.run_id, "DK baseline");
      onCreated();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveScenario = async () => {
    if (!saveName.trim()) return;
    try {
      await api.saveConfig({ name: saveName.trim(), ...body() });
      setSaved(await api.savedConfigs());
      setShowSave(false);
      setSaveName("");
      toast(`Scenariet "${saveName.trim()}" er gemt.`);
    } catch (e) {
      setError(String(e));
    }
  };

  const selectedScenario = scenarios.find((s) => s.id === scenario);
  const resetLevers = () => {
    setLevers({ ...DEFAULT_LEVERS });
    setOps(structuredClone(OP_DEFAULTS));
  };

  return (
    <div className="page">
      {error && <div className="error-box">{error}</div>}

      <div className="card hero" style={{ marginBottom: 16 }}>
        <h2 style={{ margin: "0 0 6px" }}>Simulér det danske spilmarked</h2>
        <p className="muted" style={{ margin: "0 0 12px", maxWidth: 720 }}>
          Se markedsstørrelse, Danske Spils andel, kundetal og kanalisering udvikle sig
          måned for måned under forskellige politik- og AI-scenarier — med usikkerheden
          tegnet ind. Illustrativ foresight, ikke en prognose.
        </p>
        <button className="primary" onClick={runBaseline} disabled={busy}>
          ▶ Kør baseline (2024/25-kalibreret)
        </button>
      </div>

      <div className="section-title">1 · Vælg marked</div>
      <div className="preset-grid">
        <div
          role="button"
          tabIndex={0}
          className={`preset-card ${domain === "gambling" ? "selected" : ""}`}
          onClick={() => switchDomain("gambling")}
          onKeyDown={(e) => e.key === "Enter" && switchDomain("gambling")}
        >
          <div className="name">🎲 Spilmarkedet (Danske Spil)</div>
          <div className="desc">
            Hvad sker der med markedet, DS' andel og kunderne, når politik eller AI ændrer sig?
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          className={`preset-card ${domain === "finance" ? "selected" : ""}`}
          onClick={() => switchDomain("finance")}
          onKeyDown={(e) => e.key === "Enter" && switchDomain("finance")}
        >
          <div className="name">📈 Finansmarked</div>
          <div className="desc">
            Hvordan opstår kriser, kaskader og systemisk risiko blandt hundredvis af investorer?
          </div>
        </div>
      </div>

      <div className="section-title">2 · Vælg scenarie</div>
      <div className="preset-grid">
        {!isGambling && (
          <div
            role="button"
            tabIndex={0}
            className={`preset-card ${presetId === null && savedId === null ? "selected" : ""}`}
            onClick={() => { setPresetId(null); setSavedId(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setPresetId(null); setSavedId(null); } }}
          >
            <div className="name">Standardmarked</div>
            <div className="desc">Balanceret 300-aktør-mix, moderat dybde og gearing.</div>
          </div>
        )}
        {domainPresets.map((p) => (
          <div
            key={p.id}
            role="button"
            tabIndex={0}
            className={`preset-card ${presetId === p.id ? "selected" : ""}`}
            onClick={() => { setPresetId(p.id); setSavedId(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setPresetId(p.id); setSavedId(null); } }}
          >
            <div className="name">{p.name}</div>
            <div className="desc">{p.description}</div>
          </div>
        ))}
        {saved.map((sc) => (
          <div
            key={sc.id}
            role="button"
            tabIndex={0}
            className={`preset-card ${savedId === sc.id ? "selected" : ""}`}
            onClick={() => { setSavedId(sc.id); setPresetId(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setSavedId(sc.id); setPresetId(null); } }}
          >
            <div className="name">💾 {sc.name}</div>
            <div className="desc">{sc.description || `gemt · seed ${sc.seed} · ${sc.ticks} ticks`}</div>
          </div>
        ))}
      </div>

      {isGambling && (
        <>
          <div className="section-title">3 · Politik- og markeds-løftestænger</div>
          <div className="card">
            <div className="lever-group">
              <div className="lever-group-title">Marked &amp; kunder</div>
              <div className="form-grid">
                <Slider
                  label={<>Spillekoncentration <span className="chip warn">mest følsom</span></>}
                  value={levers.spend_sigma}
                  display={`top-5 % står for ~${Math.round(top5Share(levers.spend_sigma) * 100)} %`}
                  hint="Hvor stor en del af omsætningen kommer fra de 5 % mest spillende. Ingen dansk statistik findes — internationale studier peger på 50-70 %. Alle policy-konklusioner afhænger af den her."
                  min={1.1} max={2.2} step={0.05}
                  onChange={(v) => setLevers({ ...levers, spend_sigma: v })} />
                <Slider
                  label={<>Kanalisering, startantagelse <span className="chip warn">omstridt 72–92 %</span></>}
                  value={levers.channelization_start}
                  display={`${(levers.channelization_start * 100).toFixed(0)} %`}
                  hint="Hvor stor en andel af spillet ligger hos licenserede operatører i dag. Rapportér kun konklusioner, der holder i hele intervallet."
                  min={0.72} max={0.92} step={0.01}
                  onChange={(v) => setLevers({ ...levers, channelization_start: v })} />
                <Slider
                  label="Monopol-kanalisering"
                  value={levers.monopoly_channelization}
                  display={`${(levers.monopoly_channelization * 100).toFixed(0)} %`}
                  hint="Licenseret andel på lotteri/skrab (nær-monopolet)."
                  min={0.8} max={1} step={0.01}
                  onChange={(v) => setLevers({ ...levers, monopoly_channelization: v })} />
              </div>
            </div>
            <div className="lever-group">
              <div className="lever-group-title">AI &amp; konkurrence</div>
              <div className="form-grid">
                <Slider
                  label="AI-udviklingsfart"
                  value={levers.ai_frontier_growth}
                  display={`${(levers.ai_frontier_growth * 100).toFixed(1)} %/md`}
                  hint="Hvor hurtigt AI-fronten rykker. Vælg preset 'Wild AI boom' for chok-scenariet."
                  min={0} max={0.1} step={0.005}
                  onChange={(v) => setLevers({ ...levers, ai_frontier_growth: v })} />
                <div className="field">
                  <label style={{ margin: 0 }}>
                    <input type="checkbox" checked={levers.entry_enabled}
                      onChange={(e) => setLevers({ ...levers, entry_enabled: e.target.checked })} />{" "}
                    Nye indtrædere &amp; opkøb mulige
                  </label>
                  <div className="hint">AI-native udfordrere, big-tech, konsolidatorer og crypto-casinoer.</div>
                </div>
              </div>
            </div>
            <div className="lever-group">
              <div className="lever-group-title">
                Langsigtede trends — klik en trend til, og sæt styrken
              </div>
              <div className="trend-list">
                {trendCatalog.map((t) => {
                  const active = t.id in trends;
                  return (
                    <div key={t.id} className={`trend-row ${active ? "active" : ""}`}>
                      <label className="trend-toggle">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleTrend(t.id, t.default)}
                        />
                        <span className="trend-name">{t.name}</span>
                        <span className={`chip realism-${t.realism === "høj" ? "high" : t.realism === "middel" ? "mid" : "low"}`}>
                          {t.realism === "høj" ? "realistisk" : t.realism === "middel" ? "plausibel" : "spekulativ"}
                        </span>
                        <InfoTip text={t.desc} />
                      </label>
                      {active && (
                        <div className="trend-slider">
                          <span className="muted" style={{ fontSize: 11 }}>Svag</span>
                          <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={trends[t.id]}
                            onChange={(e) => setTrends({ ...trends, [t.id]: +e.target.value })}
                          />
                          <span className="muted" style={{ fontSize: 11 }}>Stærk</span>
                          <span className="trend-value">{Math.round(trends[t.id] * 100)} %</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                <span className="muted" style={{ fontSize: 11 }}>Horisont:</span>
                {[["6 år", 72], ["10 år", 120], ["15 år", 180]].map(([lbl, n]) => (
                  <button
                    key={lbl}
                    className={ticks === n ? "primary" : ""}
                    style={{ fontSize: 12, padding: "3px 10px" }}
                    onClick={() => setTicks(n as number)}
                  >
                    {lbl}
                  </button>
                ))}
                <span className="muted" style={{ fontSize: 11 }}>
                  ({ticks} måneder — trends kumulerer over hele horisonten)
                </span>
              </div>
            </div>

            <div className="lever-group">
              <div className="lever-group-title">
                Operatør-strategier — alle 8 navngivne operatører (long-tail på ~32 licenser justeres ikke enkeltvis)
              </div>
              <div className="grid grid-2">
                {Object.entries(ops).map(([oid, v]) => (
                  <div key={oid} style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>{v.name}</div>
                    <Slider label="Marketingtryk" value={v.marketing}
                      display={`${Math.round(v.marketing * 100)} %`}
                      hint="Synlighed/acquisition-muskel. Rammes af reklameforbud."
                      min={0.1} max={1} step={0.02}
                      onChange={(x) => setOps({ ...ops, [oid]: { ...v, marketing: x } })} />
                    <Slider label="Bonusintensitet" value={v.bonus}
                      display={`${Math.round(v.bonus * 100)} %`}
                      hint="Velkomst-/retention-bonusser. Rammes af bonusrestriktioner."
                      min={0} max={1} step={0.05}
                      onChange={(x) => setOps({ ...ops, [oid]: { ...v, bonus: x } })} />
                    <Slider label="AI-adoptionsfart" value={v.ai_adoption}
                      display={`${(v.ai_adoption * 100).toFixed(0)} %/md`}
                      hint="Hvor hurtigt operatøren indhenter AI-fronten (personalisering, retention)."
                      min={0.02} max={0.30} step={0.01}
                      onChange={(x) => setOps({ ...ops, [oid]: { ...v, ai_adoption: x } })} />
                    <Slider label="Risikovillighed" value={v.aggressiveness}
                      display={`${Math.round(v.aggressiveness * 100)} %`}
                      hint="Hvor hårdt operatøren omallokerer budget og brænder kapital, når markedet skifter."
                      min={0.1} max={1} step={0.02}
                      onChange={(x) => setOps({ ...ops, [oid]: { ...v, aggressiveness: x } })} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
              <button onClick={resetLevers} style={{ fontSize: 12 }}>↺ Nulstil til kalibrerede værdier</button>
              <span className="muted" style={{ fontSize: 11 }}>
                Alle antagelser er dokumenteret i parameterregistret (kilde + usikkerhed pr. parameter).
              </span>
            </div>
          </div>
        </>
      )}

      <div className="section-title">{isGambling ? "4" : "3"} · Egne hændelser (valgfrit)</div>
      <div className="card">
        {events.length === 0 && (
          <div className="muted">Ingen egne hændelser. Tilføj én for at indsprøjte dit eget chok.</div>
        )}
        {events.map((ev, i) => (
          <div key={i} className="form-grid" style={{ marginBottom: 8 }}>
            <div className="field">
              <label>Navn</label>
              <input value={ev.name} onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="field">
              <label>Type</label>
              <select
                value={ev.event_type}
                onChange={(e) => update(i, {
                  event_type: e.target.value,
                  name: EVENT_LABELS[e.target.value]?.name ?? ev.name,
                })}
              >
                {availableEventTypes.map((t) => (
                  <option key={t} value={t}>{EVENT_LABELS[t]?.name ?? t}</option>
                ))}
              </select>
              {isGambling && EVENT_LABELS[ev.event_type] && (
                <div className="hint">{EVENT_LABELS[ev.event_type].desc}</div>
              )}
            </div>
            <div className="field">
              <label>{isGambling ? "Start (måned)" : "Start tick"}</label>
              <input type="number" value={ev.start_tick} onChange={(e) => update(i, { start_tick: +e.target.value })} />
            </div>
            <div className="field">
              <label>{isGambling ? "Indfasning (mdr.)" : "Duration"}</label>
              <input type="number" min={1} value={ev.duration} onChange={(e) => update(i, { duration: +e.target.value })} />
            </div>
            <div className="field">
              <label>Styrke (1,0 = fuld effekt)</label>
              <input type="number" step={0.1} value={ev.magnitude} onChange={(e) => update(i, { magnitude: +e.target.value })} />
            </div>
            <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
              <button className="danger" onClick={() => setEvents(events.filter((_, j) => j !== i))}>
                Fjern
              </button>
            </div>
          </div>
        ))}
        <button onClick={addEvent}>+ Tilføj hændelse</button>
      </div>

      <details className="card" style={{ marginTop: 16 }}>
        <summary className="section-title" style={{ cursor: "pointer", margin: 0 }}>
          Avanceret (seed, opløsning{isGambling ? ", population" : ", aktører, scenarie"})
        </summary>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Navn på kørslen</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mit eksperiment" />
          </div>
          <div className="field">
            <label>Random seed (reproducerbarhed)</label>
            <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} />
          </div>
          <div className="field">
            <label>{isGambling ? "Måneder" : "Ticks"}</label>
            <input type="number" min={10} max={5000} value={ticks} onChange={(e) => setTicks(+e.target.value)} />
          </div>
          {isGambling ? (
            <div className="field">
              <label>Population (spilleragenter)</label>
              <input type="number" min={100} max={5000} step={100} value={levers.population}
                onChange={(e) => setLevers({ ...levers, population: +e.target.value })} />
            </div>
          ) : (
            <div className="field">
              <label>Aktører</label>
              <input type="number" min={50} max={2000} value={nActors} onChange={(e) => setNActors(+e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Tidsopløsning</label>
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
                <option value="">— ingen (kun preset-hændelser) —</option>
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
      </details>

      <div style={{ marginTop: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="primary" onClick={() => create(true)} disabled={busy}>
          {busy ? "Opretter…" : "▶ Opret og kør"}
        </button>
        <button onClick={() => create(false)} disabled={busy}>Opret (pauset)</button>
        {!showSave && <button onClick={() => setShowSave(true)}>Gem som scenarie…</button>}
        {showSave && (
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              autoFocus
              placeholder="navn på scenariet"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveScenario()}
              style={{ width: 200 }}
            />
            <button onClick={saveScenario}>Gem</button>
            <button onClick={() => setShowSave(false)}>Annullér</button>
          </span>
        )}
      </div>
    </div>
  );

  function update(i: number, patch: Partial<CustomEvent>) {
    setEvents(events.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }
}

function Slider({ label, hint, display, min, max, step, value, onChange }: {
  label: ReactNode; hint?: string; display: string;
  min: number; max: number; step: number; value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <label style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(+e.target.value)} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
