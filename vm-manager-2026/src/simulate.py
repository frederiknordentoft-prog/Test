# -*- coding: utf-8 -*-
"""Korreleret spillervækst-simulation oven på turneringens kamparrays.

Alle spillere på samme hold deler samme scorelines (tg/tc pr. sim), så
stak-korrelation og kaptajn-robusthed er korrekt. Vækst = det eksakte
holdet-pointsystem fra scoring.py.
"""
import numpy as np
from .scoring import SCORING
from .players import CARD_P, SUB_PROB, SUB_MIN

ROUND_SLOTS = {"R1": ["R1"], "R2": ["R2"], "R3": ["R3"], "R4": ["R4"],
               "R5": ["R5"], "R6": ["R6"], "R7": ["R7a", "R7b"]}


def simulate_player_round(p, tix, rounds, rname, rng):
    """Returnér growth-array [n sims] for spilleren i runden (0 hvis holdet er ude)."""
    t = tix[p["team"]]
    total = None
    for slot in ROUND_SLOTS[rname]:
        d = rounds[slot]
        played_team = d["played"][:, t]
        n = played_team.shape[0]
        g = np.zeros(n)
        if played_team.any() and p["p_start"] > 0:
            tg = d["tg"][:, t].astype(np.float64)
            tc = d["tc"][:, t].astype(np.float64)
            win = d["win"][:, t]; draw = d["draw"][:, t]
            lam_f = d["lam_f"][:, t]; lam_a = d["lam_a"][:, t]

            starts = rng.random(n) < p["p_start"]
            minutes = np.where(
                starts, np.clip(rng.normal(p["exp_min"], 7, n), 45, 90),
                np.where(rng.random(n) < SUB_PROB, rng.uniform(5, 2 * SUB_MIN, n), 0.0))
            minutes = np.where(played_team, minutes, 0.0)
            on_pitch = (minutes > 0) & played_team
            mf = minutes / 90.0
            p60 = minutes >= 60

            pg = rng.binomial(tg.astype(np.int64), np.clip(p["s_g"] * mf, 0, 1))
            pa = rng.binomial(tg.astype(np.int64), np.clip(p["s_a"] * mf, 0, 1))
            opp_adj = np.clip(lam_f / 1.6, 0.55, 1.5)
            sot = rng.poisson(np.clip(p["sot90"] * mf * opp_adj, 0, 6))

            pos = p["pos"]
            g += pg * SCORING["goal"][pos]
            g += pa * SCORING["assist"]
            g += sot * SCORING["shot_on_target"]
            with np.errstate(divide="ignore", invalid="ignore"):
                dec_p = np.where(tg > 0, pg / np.maximum(tg, 1), 0.0)
            u = rng.random(n)
            g += np.where(win & (u < dec_p), SCORING["decisive_win"], 0)
            g += np.where(draw & (tg > 0) & (u < 0.5 * dec_p), SCORING["decisive_draw"], 0)
            motm_p = np.clip((p["s_g"] + 0.5 * p["s_a"]) * 0.45, 0.015, 0.30) \
                * np.where(win, 1.0, np.where(draw, 0.45, 0.15)) * mf
            g += (rng.random(n) < motm_p) * SCORING["motm"]
            g += (rng.random(n) < CARD_P[pos] * mf) * SCORING["yellow"]
            res = np.where(win, SCORING["result"]["W"],
                           np.where(draw, SCORING["result"]["D"], SCORING["result"]["L"]))
            g += np.where(on_pitch, res + tg * SCORING["team_goal"] + tc * SCORING["conceded"], 0)
            g += np.where(on_pitch, SCORING["appear"], 0)
            g += np.where(played_team & ~on_pitch, SCORING["no_appear"], 0)
            if pos in ("GK", "DEF"):
                g += ((tc == 0) & p60) * SCORING["clean_sheet"][pos]
            if pos == "GK":
                saves = rng.poisson(np.clip((0.85 + 1.05 * lam_a) * mf, 0, 8))
                g += saves * SCORING["gk_save"]
            g += (pg >= 3) * SCORING["hattrick"]
            g += np.where(d["so_win"][:, t] & on_pitch, SCORING["shootout_win"], 0)
            g = np.where(played_team, g, 0.0)
        total = g if total is None else total + g
    return total


def ev_table(players, cand_idx, tix, rounds, rnames, seed=11):
    """mean/std pr. (runde, spiller) for kandidatpuljen."""
    rng = np.random.default_rng(seed)
    mean = {r: np.zeros(len(cand_idx)) for r in rnames}
    std = {r: np.zeros(len(cand_idx)) for r in rnames}
    for k, i in enumerate(cand_idx):
        for r in rnames:
            g = simulate_player_round(players[i], tix, rounds, r, rng)
            mean[r][k] = g.mean()
            std[r][k] = g.std()
    return mean, std
