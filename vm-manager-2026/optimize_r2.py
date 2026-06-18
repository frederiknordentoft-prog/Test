#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R2-optimering der forgrener fra det FAKTISKE låste R1-hold.

Budgetlogik (holdet.dk, guld): samlet formue = bank + Σ(aktuelle holdværdier).
- Beholdt spiller "koster" sin aktuelle værdi af formuen.
- Købt spiller koster basispris × 1.01 (1% transfergebyr).
- Guld = frie transfers, men hvert køb koster gebyret -> kun værd at skifte
  hvis EV-gevinsten overstiger gebyret.
Kør: python optimize_r2.py
"""
import sys, os
import numpy as np
import pulp

sys.path.insert(0, os.path.dirname(__file__))
from src.ingest import load_prices, load_outright, load_scorer_odds, match_scorer_to_prices
from src.model import Tournament, ROUNDS as SLOT_ROUNDS
from src.players import p_start_heuristic, assign_shares
from src.simulate import ev_table
from src.scoring import FORMATION, CAPTAIN_MULT, MAX_PER_NATION_GROUP

N_SIM = 24_000
BANK = 0.407                      # mio., efter R1 (Haalands kaptajnbonus)

# Faktisk låst R1-hold: (navn, hold) -> aktuel værdi i mio. (efter R1)
HELD = {
    ("Unai Simon", "Spanien"): 5.092,
    ("Nathaniel Brown", "Tyskland"): 2.809,
    ("Bremer", "Brasilien"): 2.995,
    ("Antonee Robinson", "USA"): 2.064,
    ("Luc De Fougerolles", "Canada"): 1.994,
    ("Moises Caicedo", "Ecuador"): 2.991,
    ("Aurelien Tchouameni", "Frankrig"): 3.554,
    ("Jhon Arias", "Colombia"): 3.044,
    ("Mikel Oyarzabal", "Spanien"): 7.522,
    ("Kylian Mbappe", "Frankrig"): 10.324,
    ("Erling Haaland", "Norge"): 8.907,
}


def k(v):
    return f"{v/1000:+.0f}k" if abs(v) < 1e6 else f"{v/1e6:+.2f}m"


def main():
    print("=" * 74)
    print("R2-OPTIMERING — forgrener fra faktisk låst R1-hold (guld, bank 0,407m)")
    print("=" * 74)

    players = load_prices()
    title = load_outright()
    scorer = load_scorer_odds()

    print("\n[1/4] Fitter holdstyrker til markedet ...")
    tour = Tournament(title)
    tour.fit(verbose=False)
    tour.rng = np.random.default_rng(99)
    tour.simulate(N_SIM, store=True)
    tix = tour.tix

    team_goals = {t: sum(tour.rounds[r]["tg"][:, i].mean() for r in SLOT_ROUNDS) for t, i in tix.items()}
    team_matches = {t: sum(tour.rounds[r]["played"][:, i].mean() for r in SLOT_ROUNDS) for t, i in tix.items()}

    print("[2/4] Spillerlag (p_start + målandele) ...")
    players = p_start_heuristic(players)
    matched, _ = match_scorer_to_prices(scorer, players)
    players = assign_shares(players, matched, team_goals, team_matches)
    for p in players:
        i = tix[p["team"]]
        p["rot3"] = float((tour.rounds["R1"]["win"][:, i] & tour.rounds["R2"]["win"][:, i]).mean())

    # markér holdets faktiske spillere + sæt aktuel værdi
    name2idx = {(p["name"], p["team"]): i for i, p in enumerate(players)}
    held_idx = {}
    for (nm, tm), val in HELD.items():
        i = name2idx[(nm, tm)]
        players[i]["held"] = True
        players[i]["cur_val"] = val
        held_idx[i] = val
    total_worth = BANK + sum(HELD.values())
    print(f"      Samlet formue: bank {BANK:.3f}m + holdværdi {sum(HELD.values()):.3f}m "
          f"= {total_worth:.3f}m")

    print(f"[3/4] Simulerer R2-vækst ({N_SIM:,} turneringer) ...")
    cand = [i for i, p in enumerate(players) if (not p["out"] and p["p_start"] >= 0.45) or i in held_idx]
    mean, std, posmean = ev_table(players, cand, tix, tour.rounds, ["R2"])
    ci = {i: k_ for k_, i in enumerate(cand)}  # global idx -> position i cand

    print("[4/4] ILP: R2-hold + kaptajn (guld, frie transfers, 1% gebyr) ...\n")
    N = len(cand)
    pos = [players[cand[k_]]["pos"] for k_ in range(N)]
    team = [players[cand[k_]]["team"] for k_ in range(N)]
    is_held = [cand[k_] in held_idx for k_ in range(N)]
    # budget-omkostning ved at have spiller på holdet i R2
    cost = [held_idx[cand[k_]] if is_held[k_] else players[cand[k_]]["price"] * 1.01 for k_ in range(N)]
    fee = [0.0 if is_held[k_] else players[cand[k_]]["price"] * 10_000 for k_ in range(N)]
    m2 = [mean["R2"][k_] for k_ in range(N)]
    pm2 = [posmean["R2"][k_] for k_ in range(N)]

    prob = pulp.LpProblem("R2", pulp.LpMaximize)
    x = {k_: pulp.LpVariable(f"x{k_}", cat="Binary") for k_ in range(N)}
    c = {k_: pulp.LpVariable(f"c{k_}", cat="Binary") for k_ in range(N)}
    # objektiv: R2-EV + kaptajnbonus (asymmetrisk) - transfergebyr
    prob += (pulp.lpSum(m2[k_] * x[k_] for k_ in range(N))
             + pulp.lpSum(pm2[k_] * (CAPTAIN_MULT - 1) * c[k_] for k_ in range(N))
             - pulp.lpSum(fee[k_] * x[k_] for k_ in range(N)))
    prob += pulp.lpSum(x[k_] for k_ in range(N)) == 11
    prob += pulp.lpSum(cost[k_] * x[k_] for k_ in range(N)) <= total_worth
    prob += pulp.lpSum(c[k_] for k_ in range(N)) == 1
    for ppos, (lo, hi) in FORMATION.items():
        idx = [k_ for k_ in range(N) if pos[k_] == ppos]
        prob += pulp.lpSum(x[k_] for k_ in idx) >= lo
        prob += pulp.lpSum(x[k_] for k_ in idx) <= hi
    for k_ in range(N):
        prob += c[k_] <= x[k_]
    for t in set(team):
        idx = [k_ for k_ in range(N) if team[k_] == t]
        if len(idx) > MAX_PER_NATION_GROUP:
            prob += pulp.lpSum(x[k_] for k_ in idx) <= MAX_PER_NATION_GROUP
    prob.solve(pulp.PULP_CBC_CMD(msg=0))

    squad = [k_ for k_ in range(N) if x[k_].value() and x[k_].value() > 0.5]
    cap = [k_ for k_ in range(N) if c[k_].value() and c[k_].value() > 0.5][0]
    order = {"GK": 0, "DEF": 1, "MID": 2, "ATT": 3}
    squad.sort(key=lambda k_: (order[pos[k_]], -m2[k_]))

    held_names = set(HELD.keys())
    cur_names = {(players[cand[k_]]["name"], players[cand[k_]]["team"]) for k_ in squad}
    ins = cur_names - held_names
    outs = held_names - cur_names

    counts = {pp: sum(1 for k_ in squad if pos[k_] == pp) for pp in order}
    spend = sum(cost[k_] for k_ in squad)
    fees = sum(fee[k_] for k_ in squad)
    gross = sum(m2[k_] for k_ in squad) + pm2[cap] * (CAPTAIN_MULT - 1)

    print("=" * 74)
    print(f"R2-HOLD  |  {counts['DEF']}-{counts['MID']}-{counts['ATT']}  |  "
          f"forbrug {spend:.2f}m / {total_worth:.2f}m  |  bank-rest {total_worth-spend:.2f}m")
    print("=" * 74)
    R2OPP = {"Spanien": "Saudi-Arabien", "Tyskland": "Elfenbenskysten", "Frankrig": "Irak",
             "England": "Ghana", "Portugal": "Usbekistan", "Brasilien": "Haiti",
             "Norge": "Senegal", "Colombia": "Congo DR", "Ecuador": "Curaçao",
             "Canada": "Qatar", "USA": "Australien", "Marokko": "Haiti", "Senegal": "Norge",
             "Belgien": "Iran", "Holland": "Sverige", "Argentina": "Østrig", "Mexico": "Sydkorea",
             "Schweiz": "Bosnien-Herc."}
    for k_ in squad:
        p = players[cand[k_]]
        held = "" if cand[k_] in held_idx else "  ← KØB"
        star = "  (C)" if k_ == cap else ""
        opp = R2OPP.get(p["team"], "?")
        print(f"  {p['pos']:<4}{p['name']:<22}{p['team']:<12}mod {opp:<14}"
              f"EV {k(m2[k_]):>7}{star}{held}")
    print("-" * 74)
    print(f"  IND : {', '.join(n for n, _ in ins) or '—'}")
    print(f"  UD  : {', '.join(n for n, _ in outs) or '—'}")
    print(f"  Kaptajn: {players[cand[cap]]['name']}  (mod {R2OPP.get(players[cand[cap]]['team'],'?')})")
    print(f"  Gebyr i alt: {k(fees)}  ({len(ins)} køb)")
    print(f"  Forventet R2-bruttovækst (incl. kaptajn): {k(gross)}")
    print(f"  Netto efter gebyr: {k(gross - fees)}")

    # vis de bedste alternative angribere til Haaland-pladsen (kontekst)
    print("\n  Top angribere efter R2-EV (kandidater til Haaland-pladsen):")
    atts = sorted([k_ for k_ in range(N) if pos[k_] == "ATT"], key=lambda k_: -m2[k_])[:8]
    for k_ in atts:
        p = players[cand[k_]]
        tag = "(på holdet)" if cand[k_] in held_idx else f"{p['price']:.1f}m"
        print(f"    {p['name']:<22}{p['team']:<12}mod {R2OPP.get(p['team'],'?'):<14}"
              f"EV {k(m2[k_]):>7}  {tag}")


if __name__ == "__main__":
    main()
