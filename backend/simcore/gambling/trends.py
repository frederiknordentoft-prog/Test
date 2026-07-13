"""Langsigtede trends: klikbare, styrke-justerbare drivkræfter (0 = svag,
1 = stærk) der former markedet over hele horisonten — i modsætning til events,
som er diskrete chok.

To slags effekter:
- ``config``-trends justerer parametre én gang ved kørslens start (fx
  væksttrends, AI-fart) — styrken er konstant over kørslen.
- ``drift``-trends flytter tilstanden lidt hver måned (fx gradvis regulatorisk
  stramning, offshore-professionalisering) — små skridt, der kumulerer over
  5-15 år.

Kataloget er data: navn, forklaring og realisme-vurdering vises i UI'et, og
effekten ved fuld styrke er dokumenteret pr. trend. Benchmarks er forankret i
EGBA's 2024-markedsdata og dossieret, med ærlig konfidens (se params.yaml).
"""
from __future__ import annotations

from typing import Any

# Effekt-konstanter ved fuld styrke (s = 1.0). Dokumenteret i kataloget.
GROWTH_SCALE_MAX = 0.5          # market_growth: ±50 % på de observerede vækstrater
EU_CONVERGENCE_RATE = 0.025     # +2,5 %/år på alle spor (lukker DK→UK-gabet over ~12 år)
GENERATIONAL_LOTTERY_DECLINE = 0.03   # lotteri/skrab −3 %/år
GENERATIONAL_CASINO_BOOST = 0.01      # casino +1 %/år (unge foretrækker hurtige formater)
RECESSION_DRAG = 0.025          # −2,5 %/år på alle spor
AI_ACCEL_FACTOR = 2.0           # ai_frontier_growth × (1 + 2s)
REG_DRIFT_FRICTION = 0.010      # rg_friction +0,010/md ved s=1 (≈ +0,6 på 5 år)
REG_DRIFT_ADBAN = 0.005
REG_DRIFT_BONUS = 0.005
OFFSHORE_PRO_CREEP = 0.002      # offshore breadth/bonus +0,002/md (≈ +0,12 på 5 år)
PREDICTION_CREEP = 0.060        # prediction_boost +0,06/md (≈ fuldt åbent smuthul over ~5,5 år)
RG_AGENDA_CREEP = 0.008         # rg_detection +0,008/md (branchen ruller RG 2.0 ud)

TREND_CATALOG: list[dict[str, Any]] = [
    {
        "id": "market_growth",
        "name": "Markedsvækst ift. nuværende trend",
        "kind": "config",
        "realism": "høj",
        "default": 0.5,
        "desc": ("Skalerer de observerede vækstrater (casino +14,7 %/år, sport +1,2 %). "
                 "Svag = væksten halveres (casino ~+7 %); midt = som i dag; "
                 "stærk = væksten halvanden-dobles (casino ~+22 %/år)."),
    },
    {
        "id": "eu_convergence",
        "name": "Konvergens mod nordvesteuropæisk niveau",
        "kind": "config",
        "realism": "middel",
        "default": 0.5,
        "desc": ("Danskernes spilleforbrug pr. voksen (~€420/år, EGBA 2024) nærmer sig "
                 "UK-niveau (~€550/år). Ved fuld styrke +2,5 %/år ekstra vækst på alle "
                 "spor — gabet lukkes over ~12 år."),
    },
    {
        "id": "generational_shift",
        "name": "Generationsskifte — unge fravælger lotteri",
        "kind": "config",
        "realism": "høj",
        "default": 0.5,
        "desc": ("Lotto-kernekunderne bliver ældre, og unge foretrækker hurtige formater. "
                 "Ved fuld styrke: lotteri/skrab −3 %/år, casino +1 %/år oveni trenden."),
    },
    {
        "id": "recession",
        "name": "Økonomisk afmatning",
        "kind": "config",
        "realism": "middel",
        "default": 0.5,
        "desc": ("Husholdningernes underholdningsbudget skrumper. Ved fuld styrke "
                 "−2,5 %/år på alle spor over hele horisonten."),
    },
    {
        "id": "ai_acceleration",
        "name": "AI-acceleration",
        "kind": "config",
        "realism": "middel",
        "default": 0.5,
        "desc": ("AI-fronten rykker hurtigere: personalisering, AI-native indtrædere og "
                 "big-tech-entry kommer tidligere. Ved fuld styrke tredobles frontens fart."),
    },
    {
        "id": "regulatory_drift",
        "name": "Gradvis regulatorisk stramning (EU-trend)",
        "kind": "drift",
        "realism": "høj",
        "default": 0.5,
        "desc": ("Europæisk retning (Holland, Tyskland, Sverige): friktion, reklame- og "
                 "bonusregler strammes lidt år for år — uden en stor pakke. Ved fuld "
                 "styrke svarer 5 års drift omtrent til en Spilpakke."),
    },
    {
        "id": "offshore_pro",
        "name": "Offshore professionaliseres (crypto-casinoer)",
        "kind": "drift",
        "realism": "middel",
        "default": 0.5,
        "desc": ("Uregulerede sider bliver løbende bedre: flere produkter, bedre UX, "
                 "streamer-marketing. Øger lækagen gradvist — især for halen."),
    },
    {
        "id": "prediction_growth",
        "name": "Prediction markets vokser gradvist",
        "kind": "drift",
        "realism": "lav",
        "default": 0.5,
        "desc": ("Finansielt-produkt-smuthullet åbner sig gradvist via fintech-apps i "
                 "stedet for som ét chok (~$220 mia./md globalt allerede). Kan ikke "
                 "DNS-blokeres. Spekulativ i dansk sammenhæng — derfor lav realisme."),
    },
    {
        "id": "rg_agenda",
        "name": "Ansvarlighedsagenda (RG 2.0 udrulles)",
        "kind": "drift",
        "realism": "middel",
        "default": 0.5,
        "desc": ("Branchen (eller lovkrav) udruller AI-baseret skadesdetektion gradvist: "
                 "målt skade falder, ROFUS-tilgangen stiger, licenseret spil får lidt "
                 "mere friktion for halen."),
    },
]

TREND_IDS = {t["id"] for t in TREND_CATALOG}


def apply_config_trends(gcfg) -> None:
    """Engangs-justeringer ved kørslens start (kaldes før population/marked
    bygges, så vækstrater m.m. flyder ind i kalibreringen af dynamikken —
    aldrig ind i t0-ankrene, som er niveau-kalibreret separat)."""
    tr = gcfg.trends
    if not tr:
        return
    s_growth = tr.get("market_growth")
    s_eu = tr.get("eu_convergence", 0.0)
    s_gen = tr.get("generational_shift", 0.0)
    s_rec = tr.get("recession", 0.0)
    for t in gcfg.tracks:
        if s_growth is not None:
            # 0 → halv vækst, 0.5 → observeret trend, 1 → halvanden gange
            t.growth_rate = t.growth_rate * (1.0 + GROWTH_SCALE_MAX * 2.0 * (s_growth - 0.5))
        extra = s_eu * EU_CONVERGENCE_RATE - s_rec * RECESSION_DRAG
        if t.track_id in ("lottery", "scratch"):
            extra -= s_gen * GENERATIONAL_LOTTERY_DECLINE
        elif t.track_id == "casino":
            extra += s_gen * GENERATIONAL_CASINO_BOOST
        t.growth_rate = max(-0.5, min(1.0, t.growth_rate + extra))
    s_ai = tr.get("ai_acceleration", 0.0)
    if s_ai:
        gcfg.ai_frontier_growth = min(0.5, gcfg.ai_frontier_growth * (1.0 + AI_ACCEL_FACTOR * s_ai))


def step_trends(sim) -> None:
    """Månedlige drift-effekter (små skridt, der kumulerer over horisonten)."""
    tr = sim.gcfg.trends
    if not tr:
        return
    reg = sim.reg
    s = tr.get("regulatory_drift", 0.0)
    if s:
        reg.rg_friction = min(3.0, reg.rg_friction + REG_DRIFT_FRICTION * s)
        reg.ad_ban = min(1.0, reg.ad_ban + REG_DRIFT_ADBAN * s)
        reg.bonus_restriction = min(1.0, reg.bonus_restriction + REG_DRIFT_BONUS * s)
    s = tr.get("prediction_growth", 0.0)
    if s:
        reg.prediction_boost = min(4.0, reg.prediction_boost + PREDICTION_CREEP * s)
    s = tr.get("rg_agenda", 0.0)
    if s:
        reg.rg_detection = min(1.0, reg.rg_detection + RG_AGENDA_CREEP * s)
    s = tr.get("offshore_pro", 0.0)
    if s:
        changed = False
        for op in sim.market.operators:
            if op.kind == "offshore":
                op.product_breadth = min(1.0, op.product_breadth + OFFSHORE_PRO_CREEP * s)
                op.bonus = min(1.0, op.bonus + OFFSHORE_PRO_CREEP * s)
                changed = True
        if changed:
            sim.market.refresh_attrs()
