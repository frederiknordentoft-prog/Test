# -*- coding: utf-8 -*-
"""Flerrunde-ILP: vælger R1-hold + transfersti + kaptajner (EV-max, miniliga)."""
import pulp
import numpy as np
from .scoring import FORMATION, CAPTAIN_MULT, MAX_PER_NATION_GROUP

ROUND_WEIGHTS = {"R1": 1.0, "R2": 1.0, "R3": 0.80,
                 "R4": 0.85, "R5": 0.75, "R6": 0.65, "R7": 0.60}
BUDGET_R = {"R1": 50.0, "R2": 51.1, "R3": 52.2, "R4": 53.3,
            "R5": 54.5, "R6": 55.7, "R7": 56.9}
NATION_CAP_ROUNDS = ["R1", "R2", "R3", "R4", "R5"]  # frem til QF


def solve_plan(players, cand_idx, mean, rounds, pos_mean=None, contracts=None,
               time_limit=240):
    """pos_mean = E[max(vækst,0)]: kaptajnbonussen er kun stigningen (asymmetrisk)."""
    if pos_mean is None:
        pos_mean = mean
    N = len(cand_idx)
    price = [players[i]["price"] for i in cand_idx]
    fee = [pr * 10_000 for pr in price]
    pos = [players[i]["pos"] for i in cand_idx]
    team = [players[i]["team"] for i in cand_idx]

    prob = pulp.LpProblem("VM_plan", pulp.LpMaximize)
    x = {(r, k): pulp.LpVariable(f"x_{r}_{k}", cat="Binary") for r in rounds for k in range(N)}
    c = {(r, k): pulp.LpVariable(f"c_{r}_{k}", cat="Binary") for r in rounds for k in range(N)}
    buy = {(r, k): pulp.LpVariable(f"b_{r}_{k}", cat="Binary") for r in rounds[1:] for k in range(N)}

    obj = []
    for r in rounds:
        w = ROUND_WEIGHTS[r]
        for k in range(N):
            obj.append(w * mean[r][k] * x[(r, k)])
            obj.append(w * pos_mean[r][k] * (CAPTAIN_MULT - 1) * c[(r, k)])
    for r in rounds[1:]:
        for k in range(N):
            obj.append(-fee[k] * buy[(r, k)])
    prob += pulp.lpSum(obj)

    for r in rounds:
        prob += pulp.lpSum(x[(r, k)] for k in range(N)) == 11
        prob += pulp.lpSum(price[k] * x[(r, k)] for k in range(N)) <= BUDGET_R[r]
        prob += pulp.lpSum(c[(r, k)] for k in range(N)) == 1
        for pp, (lo, hi) in FORMATION.items():
            idx = [k for k in range(N) if pos[k] == pp]
            prob += pulp.lpSum(x[(r, k)] for k in idx) >= lo
            prob += pulp.lpSum(x[(r, k)] for k in idx) <= hi
        for k in range(N):
            prob += c[(r, k)] <= x[(r, k)]
        if r in NATION_CAP_ROUNDS:
            for t in set(team):
                idx = [k for k in range(N) if team[k] == t]
                if len(idx) > MAX_PER_NATION_GROUP:
                    prob += pulp.lpSum(x[(r, k)] for k in idx) <= MAX_PER_NATION_GROUP
    for ri in range(1, len(rounds)):
        r, prev = rounds[ri], rounds[ri - 1]
        for k in range(N):
            prob += buy[(r, k)] >= x[(r, k)] - x[(prev, k)]
    if contracts is not None:
        prob += pulp.lpSum(buy[(r, k)] for r in rounds[1:] for k in range(N)) <= contracts

    prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))
    status = pulp.LpStatus[prob.status]

    plan = {}
    for r in rounds:
        squad = [k for k in range(N) if x[(r, k)].value() and x[(r, k)].value() > 0.5]
        cap = [k for k in range(N) if c[(r, k)].value() and c[(r, k)].value() > 0.5]
        plan[r] = dict(squad=squad, captain=cap[0] if cap else None)
    return plan, status
