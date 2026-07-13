"""Self-contained HTML analysis report for a run.

Charts are Plotly figures inlined into one HTML file (plotly.js embedded), so
the report can be archived or shared without a running server. The report is
explicitly framed as scenario exploration, not prediction.
"""
from __future__ import annotations

import json
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from simcore.engine.simulation import Simulation

_STYLE = """
body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 0 auto;
       max-width: 1100px; padding: 24px; color: #1a1a19; }
h1 { font-size: 22px; } h2 { font-size: 16px; margin-top: 28px; }
.disclaimer { background: #fff6e0; border: 1px solid #eda100; border-radius: 8px;
              padding: 12px 16px; font-size: 14px; }
table { border-collapse: collapse; font-size: 13px; width: 100%; }
th, td { text-align: left; padding: 5px 10px; border-bottom: 1px solid #e5e5e2; }
th { color: #52514e; font-size: 11px; text-transform: uppercase; }
.meta { color: #52514e; font-size: 13px; }
"""


def _line_fig(x, series: dict[str, list], title: str, events=None, ytitle: str = ""):
    import plotly.graph_objects as go

    palette = ["#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948", "#e87ba4"]
    fig = go.Figure()
    for i, (name, ys) in enumerate(series.items()):
        fig.add_trace(go.Scatter(x=x, y=ys, name=name, mode="lines",
                                 line={"width": 2, "color": palette[i % len(palette)]}))
    for ev in events or []:
        fig.add_vline(x=ev.tick, line_dash="dash", line_color="#e34948", opacity=0.5)
    fig.update_layout(
        title=title, template="plotly_white", height=340,
        margin={"l": 50, "r": 20, "t": 45, "b": 35},
        legend={"orientation": "h", "y": -0.15},
        yaxis_title=ytitle,
    )
    return fig


def generate_report(sim: "Simulation") -> str:
    """Domain-aware report entry point (the finance layout raised KeyError on
    gambling runs — a user-reported bug)."""
    if getattr(sim.config, "sim_domain", "finance") == "gambling":
        return _gambling_report(sim)
    return _finance_report(sim)


def _rolling12(vals: list[float]) -> list[float]:
    """Trailing 12-month sum, annualized for the first partial year."""
    out = []
    for i in range(len(vals)):
        window = vals[max(0, i - 11): i + 1]
        out.append(sum(window) * 12.0 / len(window))
    return out


def _gambling_report(sim) -> str:
    import plotly.io as pio

    cfg = sim.config
    g = sim.gcfg
    mh = sim.metrics_history
    ticks = [m["tick"] for m in mh]
    starts = [r for r in sim.events_log if r.phase == "start"]

    def col(key):
        return [float(m.get(key, 0.0)) for m in mh]

    track_names = {t.track_id: t.name for t in g.tracks}
    figs = []
    rolling = {"Hele markedet (inkl. offshore)": [v / 1000.0 for v in _rolling12(col("market_size_total"))]}
    for t in g.tracks:
        rolling[track_names[t.track_id]] = [v / 1000.0 for v in _rolling12(col(f"bsi_{t.track_id}"))]
    figs.append(_line_fig(ticks, rolling, "Markedets størrelse — rullende 12 måneder",
                          events=starts, ytitle="mia. kr./år"))
    figs.append(_line_fig(
        ticks,
        {"DS samlet andel": col("ds_share_total"),
         "DS andel, liberaliseret marked": col("ds_share_liberalized")},
        "Danske Spils markedsandel", events=starts, ytitle="andel"))
    figs.append(_line_fig(
        ticks,
        {"Kanalisering (antagelse)": col("channelization"),
         "korridor lav (72 %)": col("channelization_low"),
         "korridor høj (92 %)": col("channelization_high"),
         "Offshore-andel": col("offshore_share")},
        "Kanalisering — omstridt interval, ikke et punkt", events=starts, ytitle="andel"))
    figs.append(_line_fig(
        ticks,
        {track_names[t.track_id]: col(f"customers_{t.track_id}") for t in g.tracks},
        "Kunder pr. spor (alle udbydere)", events=starts, ytitle="personer"))
    figs.append(_line_fig(
        ticks,
        {"Målt skade": col("measured_harm"), "Sand skade": col("true_harm"),
         "Skjult (offshore)": col("harm_gap")},
        "Kernespændingen: målt vs. sand skade", events=starts, ytitle="indeks"))
    figs.append(_line_fig(
        ticks,
        {"Afgiftsprovenu": col("state_revenue"), "Udlodning": col("udlodning")},
        "Statens provenu & udlodning (mio. kr./md)", events=starts, ytitle="mio. kr./md"))

    fig_html = "".join(
        pio.to_html(f, include_plotlyjs=("cdn" if i > 0 else True), full_html=False)
        for i, f in enumerate(figs)
    )

    m_end = mh[-1] if mh else {}
    kpis = [
        ("DS markedsandel (samlet)", f'{m_end.get("ds_share_total", 0) * 100:.1f} %'),
        ("DS andel, liberaliseret marked", f'{m_end.get("ds_share_liberalized", 0) * 100:.1f} %'),
        ("Kanalisering", f'{m_end.get("channelization", 0) * 100:.1f} %'),
        ("Marked, rullende 12 mdr.", f'{_rolling12(col("market_size_total"))[-1] / 1000:.1f} mia. kr.' if mh else "—"),
        ("Kunder (unikke, est.)", f'{m_end.get("customers_total", 0):,.0f}'.replace(",", ".")),
        ("Licenserede udbydere (repr.)", f'{m_end.get("n_licensees", 0):.0f}'),
        ("Statens provenu (md)", f'{m_end.get("state_revenue", 0):.0f} mio. kr.'),
        ("Udlodning (md)", f'{m_end.get("udlodning", 0):.0f} mio. kr.'),
        ("ROFUS-bestand", f'{m_end.get("rofus_stock", 0):,.0f}'.replace(",", ".")),
    ]
    summary_rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in kpis)
    event_rows = "".join(
        f"<tr><td>{r.tick}</td><td>{r.name}</td><td>{r.event_type}</td><td>{r.phase}</td></tr>"
        for r in sim.events_log
    ) or "<tr><td colspan=4>ingen</td></tr>"

    try:
        from simcore.gambling.params import load_params
        param_rows = "".join(
            f"<tr><td>{p.name}</td><td>{p.value}</td><td>{p.confidence}</td><td>{p.source}</td></tr>"
            for p in load_params()
        )
    except Exception:  # pragma: no cover
        param_rows = "<tr><td colspan=4>register utilgængeligt</td></tr>"

    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>Spilmarkeds-rapport — {cfg.name}</title><style>{_STYLE}</style></head><body>
<h1>Spilmarkeds-rapport — {cfg.name}</h1>
<p class="meta">kørsel {sim.run_id} · seed {cfg.seed} · {sim.tick} måneder · {g.population} spilleragenter</p>
<div class="disclaimer"><b>Illustrativ foresight — ikke en prognose.</b>
Kanalisering er omstridt (72–92 %) og behandles som et interval; operatør-markedsandele har
ingen officiel kilde; indtægtskoncentrationen er den vigtigste usikre parameter. Rapportér kun
konklusioner, der er robuste på tværs af antagelserne (se parameterregistret nederst).</div>
<h2>Nøgletal (slutmåned)</h2><table><tbody>{summary_rows}</tbody></table>
{fig_html}
<h2>Hændelser</h2>
<table><thead><tr><th>måned</th><th>navn</th><th>type</th><th>fase</th></tr></thead>
<tbody>{event_rows}</tbody></table>
<h2>Parameterregister (værdi · konfidens · kilde)</h2>
<table><thead><tr><th>parameter</th><th>værdi</th><th>konfidens</th><th>kilde</th></tr></thead>
<tbody>{param_rows}</tbody></table>
<h2>Konfiguration</h2>
<details><summary>fuld config-JSON</summary><pre>{json.dumps(cfg.model_dump(), indent=2, default=str)}</pre></details>
</body></html>"""


def _finance_report(sim: "Simulation") -> str:
    import plotly.graph_objects as go
    import plotly.io as pio

    cfg = sim.config
    mh = sim.metrics_history
    ticks = [m["tick"] for m in mh]
    starts = [r for r in sim.events_log if r.phase == "start"]

    figs: list = []
    asset_series: dict[str, list] = {}
    for row in sim.asset_history:
        asset_series.setdefault(row["asset_id"], []).append(row["price"])
    figs.append(_line_fig(ticks, asset_series, "Asset prices", events=starts, ytitle="price"))
    figs.append(_line_fig(
        ticks,
        {"price index": [m["price_index"] for m in mh],
         "systemic risk (0-100)": [m["systemic_risk"] for m in mh]},
        "Price index & systemic risk", events=starts,
    ))
    figs.append(_line_fig(
        ticks,
        {"mean sentiment": [m["mean_sentiment"] for m in mh],
         "mean stress": [m["mean_stress"] for m in mh]},
        "Sentiment & stress (population means)",
    ))
    figs.append(_line_fig(
        ticks,
        {"liquidity index": [m["liquidity_index"] for m in mh],
         "credit tightness": [m["credit_tightness"] for m in mh],
         "forced volume share": [m["forced_volume_share"] for m in mh]},
        "Liquidity, credit and forced sales",
    ))

    prices = sim.market.prices()
    wealth = [a.state.wealth(prices) for a in sim.actors if a.state.alive]
    fig_w = go.Figure(go.Histogram(x=np.log10(np.clip(wealth, 1, None)), nbinsx=25,
                                   marker_color="#2a78d6"))
    fig_w.update_layout(title="Wealth distribution (log10, living actors)",
                        template="plotly_white", height=320,
                        margin={"l": 50, "r": 20, "t": 45, "b": 35})
    figs.append(fig_w)

    fig_html = "".join(
        pio.to_html(f, include_plotlyjs=("cdn" if i > 0 else True), full_html=False)
        for i, f in enumerate(figs)
    )

    m_end = mh[-1] if mh else {}
    summary_rows = "".join(
        f"<tr><td>{k}</td><td>{round(float(m_end.get(k, 0)), 3)}</td></tr>"
        for k in ("price_index", "drawdown", "mean_volatility", "systemic_risk",
                  "wealth_gini", "mean_leverage", "bankruptcies_total",
                  "margin_calls_total", "defaults_total", "credit_tightness")
    )
    event_rows = "".join(
        f"<tr><td>{r.tick}</td><td>{r.name}</td><td>{r.event_type}</td>"
        f"<td>{r.magnitude}</td><td>{r.phase}</td></tr>"
        for r in sim.events_log
    ) or "<tr><td colspan=5>none</td></tr>"

    sample_decisions = list(sim.recent_decisions)[-12:]
    decision_rows = "".join(
        "<tr><td>{tick}</td><td>{actor_type}_{actor_id}</td><td>{model}</td>"
        "<td>{action}</td><td>{drv}</td></tr>".format(
            drv=", ".join(f"{d['driver']} ({d['contribution']:+.2f})"
                          for d in (dec["explanation"] or {}).get("main_drivers", [])),
            **dec,
        )
        for dec in sample_decisions
    )

    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>Simulation report — {cfg.name}</title><style>{_STYLE}</style></head><body>
<h1>Simulation report — {cfg.name}</h1>
<p class="meta">run {sim.run_id} · seed {cfg.seed} · {sim.tick} ticks ({cfg.tick_resolution})
· {len(sim.actors)} actors · {len(sim.market.assets)} assets</p>
<div class="disclaimer"><b>Scenario exploration — not a forecast.</b>
This report is produced by an agent-based simulation built for studying reaction
patterns, feedback loops and systemic risk under explicit assumptions. Outcomes are
illustrative and highly sensitive to configuration; they must not be used as
predictions or investment advice.</div>
<h2>Final indicators</h2><table><tbody>{summary_rows}</tbody></table>
{fig_html}
<h2>Events</h2>
<table><thead><tr><th>tick</th><th>name</th><th>type</th><th>magnitude</th><th>phase</th></tr></thead>
<tbody>{event_rows}</tbody></table>
<h2>Decision samples (with actual drivers)</h2>
<table><thead><tr><th>tick</th><th>actor</th><th>model</th><th>action</th><th>main drivers</th></tr></thead>
<tbody>{decision_rows}</tbody></table>
<h2>Configuration</h2>
<details><summary>full config JSON</summary><pre>{json.dumps(cfg.model_dump(), indent=2)}</pre></details>
</body></html>"""
