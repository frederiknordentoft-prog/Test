#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""VM Manager 2026-optimizer: markedsdrevet Monte Carlo + flerrunde-ILP.

Kør:  python run.py            (fuld pipeline, gold-hold = frie transfers)
      python run.py --basis    (3-kontrakters basishold)
"""
import sys, os, time
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from src.ingest import (load_prices, load_outright, load_scorer_odds,
                        match_scorer_to_prices, GROUPS)
from src.model import Tournament, ROUNDS as SLOT_ROUNDS
from src.players import p_start_heuristic, assign_shares
from src.simulate import ev_table, simulate_player_round, ROUND_SLOTS
from src.optimize import solve_plan, ROUND_WEIGHTS, BUDGET_R
from src.scoring import CAPTAIN_MULT

N_SIM = 24_000
PLAN_ROUNDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"]
RNAME = {"R1": "Runde 1 (gruppekamp 1)", "R2": "Runde 2 (gruppekamp 2)",
         "R3": "Runde 3 (gruppekamp 3)", "R4": "Runde 4 (1/16-finaler)",
         "R5": "Runde 5 (1/8-finaler)", "R6": "Runde 6 (kvartfinaler)",
         "R7": "Runde 7 (semi + bronze + finale)"}


def k(v):
    return f"{v/1000:+.0f}k" if abs(v) < 1e6 else f"{v/1e6:+.2f}m"


def main():
    basis = "--basis" in sys.argv
    t0 = time.time()
    out_lines = []

    def emit(s=""):
        print(s)
        out_lines.append(s)

    emit("=" * 78)
    emit("VM MANAGER 2026 — MARKEDSDREVET MODEL (odds -> Dixon-Coles-agtig sim -> ILP)")
    emit("=" * 78)

    players = load_prices()
    title = load_outright()
    scorer = load_scorer_odds()

    emit(f"\n[1/5] Fitter holdstyrker til outright-markedet ({len(title)} hold) ...")
    tour = Tournament(title)
    tour.fit(verbose=True)
    emit(f"      Endelig simulation: {N_SIM:,} turneringer ...")
    tour.rng = np.random.default_rng(99)
    tour.simulate(N_SIM, store=True)

    tix = tour.tix
    emit("\n  P(VM-titel): model vs. marked (top 12)")
    top = sorted(title.items(), key=lambda kv: -kv[1])[:12]
    for t, p in top:
        emit(f"    {t:<12} marked {p*100:5.1f}%   model {tour.champ[tix[t]]*100:5.1f}%   "
             f"P(SF) {tour.reach['SF'][tix[t]]*100:4.1f}%   P(finale) {tour.reach['Final'][tix[t]]*100:4.1f}%")

    # holdets forventede turneringsmål og antal kampe
    team_goals, team_matches = {}, {}
    for t, i in tix.items():
        tg = sum(tour.rounds[r]["tg"][:, i].mean() for r in SLOT_ROUNDS)
        m = sum(tour.rounds[r]["played"][:, i].mean() for r in SLOT_ROUNDS)
        team_goals[t] = tg
        team_matches[t] = m

    emit("\n[2/5] Spillerlag: p_start + mål-/assistandele fra Golden Boot-markedet ...")
    players = p_start_heuristic(players)
    matched, unmatched = match_scorer_to_prices(scorer, players)
    emit(f"      GB-odds matchet: {len(matched)}/{len(scorer)}"
         + (f" — umatchede: {unmatched}" if unmatched else ""))
    players = assign_shares(players, matched, team_goals, team_matches)

    emit("\n  Forventede turneringsmål (modellens top 12):")
    eg = [(p["name"], p["team"], p["sigma_g"] * team_goals[p["team"]]) for p in players if not p["out"]]
    for n_, t_, g_ in sorted(eg, key=lambda x: -x[2])[:12]:
        emit(f"    {n_:<22} {t_:<10} {g_:4.2f} mål")

    emit("\n[3/5] Simulerer spillervækst pr. runde (korreleret, eksakt pointsystem) ...")
    cand_idx = [i for i, p in enumerate(players) if not p["out"] and p["p_start"] >= 0.45]
    mean, std = ev_table(players, cand_idx, tix, tour.rounds, PLAN_ROUNDS)

    # ILP-pulje: bedste EV + bedste EV/pris pr. runde
    w_ev = np.zeros(len(cand_idx))
    for r in PLAN_ROUNDS:
        w_ev += ROUND_WEIGHTS[r] * mean[r]
    price_arr = np.array([players[i]["price"] for i in cand_idx])
    keep = set(np.argsort(-w_ev)[:200]) | set(np.argsort(-(w_ev / price_arr))[:160])
    for r in PLAN_ROUNDS:
        keep |= set(np.argsort(-mean[r])[:60])
    keep = sorted(keep)
    pool = [cand_idx[k_] for k_ in keep]
    mean_pool = {r: mean[r][keep] for r in PLAN_ROUNDS}
    emit(f"      Kandidater: {len(cand_idx)} -> ILP-pulje: {len(pool)}")

    emit(f"\n[4/5] Flerrunde-ILP (R1-R7, {'basis: max 3 kontrakter' if basis else 'guld: frie transfers'}) ...")
    plan, status = solve_plan(players, pool, mean_pool, PLAN_ROUNDS,
                              contracts=3 if basis else None)
    emit(f"      Status: {status}")

    emit("\n[5/5] Rapport\n")
    order = {"GK": 0, "DEF": 1, "MID": 2, "ATT": 3}
    rng = np.random.default_rng(123)
    prev = set()
    total_net = 0.0
    for r in PLAN_ROUNDS:
        sq = plan[r]["squad"]; cap = plan[r]["captain"]
        idxs = [pool[k_] for k_ in sq]
        cap_i = pool[cap] if cap is not None else None
        cur = set(idxs)
        ins = sorted(cur - prev) if r != "R1" else []
        outs = sorted(prev - cur) if r != "R1" else []
        fee = sum(players[i]["price"] * 10_000 for i in ins)
        spend = sum(players[i]["price"] for i in idxs)
        gross = sum(mean[r][cand_idx.index(i)] for i in idxs)
        if cap_i is not None:
            gross += mean[r][cand_idx.index(cap_i)] * (CAPTAIN_MULT - 1)
        net = gross - fee
        total_net += net
        counts = {pp: sum(1 for i in idxs if players[i]["pos"] == pp) for pp in order}
        emit("=" * 78)
        emit(f"{RNAME[r]}  |  {counts['DEF']}-{counts['MID']}-{counts['ATT']}  |  "
             f"forbrug {spend:.1f}m / {BUDGET_R[r]:.1f}m")
        emit("-" * 78)
        for i in sorted(idxs, key=lambda i: (order[players[i]['pos']], -mean[r][cand_idx.index(i)])):
            p = players[i]
            star = "  (C)" if i == cap_i else ""
            emit(f"  {p['pos']:<4}{p['name']:<24}{p['team']:<12}{p['price']:>4.1f}m  "
                 f"EV {k(mean[r][cand_idx.index(i)]):>7}{star}")
        if r != "R1":
            emit(f"  IND : {', '.join(players[i]['name'] for i in ins) or '—'}")
            emit(f"  UD  : {', '.join(players[i]['name'] for i in outs) or '—'}")
            emit(f"  Gebyr: {k(fee)}  ({len(ins)} køb{'' if not basis else ', kontrakter brugt'})")
        emit(f"  Kaptajn: {players[cap_i]['name'] if cap_i is not None else '—'}  |  "
             f"netto-EV (u. vægt): {k(net)}")
        prev = cur

    emit("\n" + "=" * 78)
    emit(f"SAMLET forventet nettovækst over alle runder: {k(total_net)}")
    emit("=" * 78)

    # Korreleret fordeling af R1-holdets vækst
    r1_idxs = [pool[k_] for k_ in plan["R1"]["squad"]]
    r1_cap = pool[plan["R1"]["captain"]]
    tot = np.zeros(N_SIM)
    for i in r1_idxs:
        g = simulate_player_round(players[i], tix, tour.rounds, "R1", rng)
        tot += g * (2.0 if i == r1_cap else 1.0)
    q = np.percentile(tot, [10, 25, 50, 75, 90])
    emit(f"\nR1-holdets fordeling (korreleret): middel {k(tot.mean())}, "
         f"P10 {k(q[0])}, P25 {k(q[1])}, median {k(q[2])}, P75 {k(q[3])}, P90 {k(q[4])}")

    # 'Skal aldrig skiftes ud'-analyse
    emit("\nHOLDBARHED (P(holdet stadig med) pr. runde) for R1-holdet:")
    emit(f"  {'Spiller':<24}{'Hold':<12}{'R32':>6}{'R16':>6}{'QF':>6}{'SF':>6}{'Finale':>8}")
    for i in r1_idxs:
        t = players[i]["team"]
        emit(f"  {players[i]['name']:<24}{t:<12}"
             f"{tour.reach['R32'][tix[t]]*100:5.0f}%{tour.reach['R16'][tix[t]]*100:5.0f}%"
             f"{tour.reach['QF'][tix[t]]*100:5.0f}%{tour.reach['SF'][tix[t]]*100:5.0f}%"
             f"{tour.reach['Final'][tix[t]]*100:7.0f}%")

    # Value-tabel R1
    emit("\nVALUE-TABEL R1 (vækst pr. mio., top 15 i kandidatpuljen):")
    vals = sorted(((mean["R1"][k_] / players[i]["price"], i, mean["R1"][k_])
                   for k_, i in enumerate(cand_idx)), reverse=True)[:15]
    for v, i, ev in vals:
        p = players[i]
        emit(f"  {p['pos']:<4}{p['name']:<24}{p['team']:<12}{p['price']:>4.1f}m  "
             f"EV {k(ev):>7}  ({v/1000:.0f}k/mio., p_start {p['p_start']:.2f})")

    # Deadline-tjekliste
    emit("\nDEADLINE-TJEKLISTE (verificér før kampstart):")
    risky = [i for i in r1_idxs if players[i]["p_start"] < 0.80]
    if risky:
        emit("  Startrisiko på R1-holdet (tjek bekræftede opstillinger):")
        for i in risky:
            emit(f"    - {players[i]['name']} ({players[i]['team']}), p_start {players[i]['p_start']:.2f}")
    else:
        emit("  Ingen spillere med p_start < 0.80 på R1-holdet.")
    emit("  Husk: odds/opstillinger flytter sig — genkør pipeline før hver deadline.")
    emit("  R4+ er vejledende (modstandere kendes først efter gruppespillet).")

    emit(f"\nKørselstid: {time.time()-t0:.0f}s")
    with open(os.path.join(os.path.dirname(__file__), "out",
                           "report_basis.md" if basis else "report.md"), "w",
              encoding="utf-8") as f:
        f.write("\n".join(out_lines))


if __name__ == "__main__":
    main()
