# -*- coding: utf-8 -*-
"""Holdstyrker fra outright-odds + korreleret turneringssimulation.

Rating-modellen er en tynd transformation af bettingmarkedet:
ratings fittes så simuleret P(vinder VM) matcher de de-viggede outright-odds.
Kampmål: mu_i = exp(b0 + (R_i - R_j)), clip [0.20, 4.20]. Neutral bane.
"""
import numpy as np
from .ingest import GROUPS, load_fixtures

B0 = np.log(1.30)          # ligevægts-mål pr. hold pr. kamp (VM-snit ~2.6/kamp)
MU_CLIP = (0.20, 4.20)
HOST_EDGE = {"Mexico": 0.10, "USA": 0.08, "Canada": 0.06}  # lille værtsfordel

# Round of 32-skabelon (Wikipedia, kampe 73-88).
# (slot_a, slot_b): "W_X"=gruppevinder, "R_X"=toer, "T_XYZ.."=bedste 3'er fra grupperne
R32 = [
    ("R_A", "R_B"),      # 73
    ("W_E", "T_ABCDF"),  # 74
    ("W_F", "R_C"),      # 75
    ("W_C", "R_F"),      # 76
    ("W_I", "T_CDFGH"),  # 77
    ("R_E", "R_I"),      # 78
    ("W_A", "T_CEFHI"),  # 79
    ("W_L", "T_EHIJK"),  # 80
    ("W_D", "T_BEFIJ"),  # 81
    ("W_G", "T_AEHIJ"),  # 82
    ("R_K", "R_L"),      # 83
    ("W_H", "R_J"),      # 84
    ("W_B", "T_EFGIJ"),  # 85
    ("W_J", "R_H"),      # 86
    ("W_K", "T_DEIJL"),  # 87
    ("R_D", "R_G"),      # 88
]
# R16: (kamp 89-96) vinder-par fra R32-kampe (0-indekseret i R32-listen)
R16_PAIRS = [(1, 4), (0, 2), (3, 5), (6, 7), (10, 11), (8, 9), (13, 15), (12, 14)]
QF_PAIRS = [(0, 1), (4, 5), (2, 3), (6, 7)]   # 97=89v90, 98=93v94, 99=91v92, 100=95v96
SF_PAIRS = [(0, 1), (2, 3)]

ROUNDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7a", "R7b"]

# Kamp-ankre fra bettingmarkedet (mu for favoritten i konkrete kampe, juni 2026
# — fra den market-deriverede ekspertmodel). Titel-odds identificerer ikke
# bundholdenes styrke (P(titel)~0 for alle), så ankrene pinner dem via
# modstander-rating: (favorit, modstander, mu_favorit).
MATCH_ANCHORS = [
    ("Norge", "Irak", 2.10),
    ("Spanien", "Kap Verde", 2.70),
    ("Tyskland", "Curaçao", 2.90),
    ("Portugal", "Congo DR", 2.30),
    ("Frankrig", "Senegal", 1.60),
    ("Schweiz", "Qatar", 1.90),
    ("Iran", "New Zealand", 1.50),
    ("Skotland", "Haiti", 1.80),
    ("Colombia", "Usbekistan", 1.70),
    ("Østrig", "Jordan", 1.90),
    ("Mexico", "Sydafrika", 1.70),
    ("England", "Kroatien", 1.50),
    ("Spanien", "Saudi-Arabien", 2.40),
    ("England", "Panama", 2.40),
    ("Tyskland", "Elfenbenskysten", 1.80),
    ("Mexico", "Sydkorea", 1.40),
    ("England", "Ghana", 2.00),
    ("Ecuador", "Elfenbenskysten", 1.30),
    # --- R2-ankre (friske markedsodds, hentet 14. juni efter R1) ---
    ("Frankrig", "Irak", 2.55),
    ("Spanien", "Saudi-Arabien", 2.50),
    ("Ecuador", "Curaçao", 2.70),
    ("Norge", "Senegal", 1.50),
    ("Portugal", "Usbekistan", 2.10),
    ("England", "Ghana", 2.00),
    ("Tyskland", "Elfenbenskysten", 1.90),
    ("Brasilien", "Haiti", 2.60),
    ("Colombia", "Congo DR", 1.85),
]


class Tournament:
    def __init__(self, title_probs, seed=7):
        self.teams = sorted(title_probs.keys())
        self.tix = {t: i for i, t in enumerate(self.teams)}
        self.target = np.array([title_probs[t] for t in self.teams])
        self.rng = np.random.default_rng(seed)
        self.fixtures = load_fixtures()
        self.R = 0.28 * (np.log(self.target) - np.log(self.target).mean())

    # ---------- kamp-niveau ----------
    def lambdas(self, i, j):
        e_i = HOST_EDGE.get(self.teams[i], 0.0) if isinstance(i, int) else 0.0
        e_j = HOST_EDGE.get(self.teams[j], 0.0) if isinstance(j, int) else 0.0
        li = np.exp(B0 + (self.R[i] + e_i) - (self.R[j] + e_j))
        lj = np.exp(B0 + (self.R[j] + e_j) - (self.R[i] + e_i))
        return np.clip(li, *MU_CLIP), np.clip(lj, *MU_CLIP)

    def lambdas_vec(self, ia, ja):
        ea = np.array([HOST_EDGE.get(self.teams[k], 0.0) for k in ia])
        eb = np.array([HOST_EDGE.get(self.teams[k], 0.0) for k in ja])
        la = np.exp(B0 + (self.R[ia] + ea) - (self.R[ja] + eb))
        lb = np.exp(B0 + (self.R[ja] + eb) - (self.R[ia] + ea))
        return np.clip(la, *MU_CLIP), np.clip(lb, *MU_CLIP)

    # ---------- fuld turnering, vektoriseret over n sims ----------
    def simulate(self, n, store=False):
        rng = self.rng
        T = len(self.teams)
        rounds = {r: dict(played=np.zeros((n, T), bool), tg=np.zeros((n, T), np.int16),
                          tc=np.zeros((n, T), np.int16), win=np.zeros((n, T), bool),
                          draw=np.zeros((n, T), bool), so_win=np.zeros((n, T), bool),
                          lam_f=np.zeros((n, T), np.float32), lam_a=np.zeros((n, T), np.float32))
                  for r in ROUNDS}

        pts = np.zeros((n, T)); gd = np.zeros((n, T)); gf = np.zeros((n, T))
        for rnd, _g, h, a in self.fixtures:
            i, j = self.tix[h], self.tix[a]
            li, lj = self.lambdas(i, j)
            gh = rng.poisson(li, n); ga = rng.poisson(lj, n)
            pts[:, i] += np.where(gh > ga, 3, np.where(gh == ga, 1, 0))
            pts[:, j] += np.where(ga > gh, 3, np.where(gh == ga, 1, 0))
            gd[:, i] += gh - ga; gd[:, j] += ga - gh
            gf[:, i] += gh; gf[:, j] += ga
            d = rounds[rnd]
            for t, g_own, g_opp, lf, la_ in ((i, gh, ga, li, lj), (j, ga, gh, lj, li)):
                d["played"][:, t] = True
                d["tg"][:, t] = g_own; d["tc"][:, t] = g_opp
                d["win"][:, t] = g_own > g_opp; d["draw"][:, t] = g_own == g_opp
                d["lam_f"][:, t] = lf; d["lam_a"][:, t] = la_

        # gruppeplaceringer
        score = pts * 1e6 + gd * 1e3 + gf + rng.random((n, T))
        winners = {}; runners = {}; thirds = {}
        for g, members in GROUPS.items():
            idx = np.array([self.tix[t] for t in members])
            order = np.argsort(-score[:, idx], axis=1)
            winners[g] = idx[order[:, 0]]; runners[g] = idx[order[:, 1]]; thirds[g] = idx[order[:, 2]]

        # bedste 8 treere
        letters = list(GROUPS.keys())
        tidx = np.stack([thirds[g] for g in letters], axis=1)            # [n,12]
        tscore = np.take_along_axis(score, tidx, axis=1)
        trank = np.argsort(-tscore, axis=1)                              # bedste først
        qual3 = trank[:, :8]                                             # kolonneindeks i letters

        # alloker treere til T_-slots (grådigt, per sim)
        t_slots = [(k, set(spec[2:])) for k, (a, spec) in enumerate(
            [(a, b) for a, b in R32]) if spec.startswith("T_")]
        slot_team = np.full((n, len(R32)), -1, np.int32)
        for k, (a_spec, b_spec) in enumerate(R32):
            if a_spec.startswith("W_"):
                slot_a = winners[a_spec[2:]]
            else:
                slot_a = runners[a_spec[2:]]
            slot_team[:, k] = slot_a
        b_fixed = {}
        for k, (a_spec, b_spec) in enumerate(R32):
            if b_spec.startswith("R_"):
                b_fixed[k] = runners[b_spec[2:]]
        third_slots = [(k, set(b[2:])) for k, (a, b) in enumerate(R32) if b.startswith("T_")]
        third_slots.sort(key=lambda kv: len(kv[1]))
        b_team = np.full((n, len(R32)), -1, np.int32)
        for k, arr in b_fixed.items():
            b_team[:, k] = arr
        for s in range(n):
            avail = [letters[c] for c in qual3[s]]
            used = set()
            for k, allowed in third_slots:
                pick = next((g for g in avail if g not in used and g in allowed), None)
                if pick is None:
                    pick = next(g for g in avail if g not in used)
                used.add(pick)
                b_team[s, k] = thirds[pick][s]

        def ko_round(rname, ia, ja):
            la, lb = self.lambdas_vec_idx(ia, ja)
            ga = rng.poisson(la); gb = rng.poisson(lb)
            level = ga == gb
            ea = rng.poisson(la / 3.0); eb = rng.poisson(lb / 3.0)
            ga = ga + np.where(level, ea, 0); gb = gb + np.where(level, eb, 0)
            still = ga == gb
            p_a = la / (la + lb)
            shoot_a = rng.random(ia.shape) < p_a
            win_a = (ga > gb) | (still & shoot_a)
            d = rounds[rname]
            s_ = np.arange(len(ia))
            for team_arr, g_own, g_opp, lf, lat, w, sw in (
                    (ia, ga, gb, la, lb, win_a, still & shoot_a),
                    (ja, gb, ga, lb, la, ~win_a, still & ~shoot_a)):
                d["played"][s_, team_arr] = True
                d["tg"][s_, team_arr] = g_own; d["tc"][s_, team_arr] = g_opp
                d["win"][s_, team_arr] = g_own > g_opp
                d["draw"][s_, team_arr] = g_own == g_opp
                d["so_win"][s_, team_arr] = sw
                d["lam_f"][s_, team_arr] = lf; d["lam_a"][s_, team_arr] = lat
            return np.where(win_a, ia, ja), np.where(win_a, ja, ia)

        # R32
        a32 = slot_team; b32 = b_team
        w32 = np.zeros((n, 16), np.int32)
        for k in range(16):
            w, _l = ko_round("R4", a32[:, k], b32[:, k])
            w32[:, k] = w
        # R16
        w16 = np.zeros((n, 8), np.int32)
        for m, (x, y) in enumerate(R16_PAIRS):
            w, _l = ko_round("R5", w32[:, x], w32[:, y])
            w16[:, m] = w
        # QF
        wqf = np.zeros((n, 4), np.int32)
        for m, (x, y) in enumerate(QF_PAIRS):
            w, _l = ko_round("R6", w16[:, x], w16[:, y])
            wqf[:, m] = w
        # SF (R7a)
        wsf = np.zeros((n, 2), np.int32); lsf = np.zeros((n, 2), np.int32)
        for m, (x, y) in enumerate(SF_PAIRS):
            w, l = ko_round("R7a", wqf[:, x], wqf[:, y])
            wsf[:, m] = w; lsf[:, m] = l
        # finale + bronze (R7b)
        wf, _ = ko_round("R7b", wsf[:, 0], wsf[:, 1])
        ko_round("R7b", lsf[:, 0], lsf[:, 1])

        champ = np.bincount(wf, minlength=T) / n
        if store:
            self.rounds = rounds
            self.champ = champ
            reach = {}
            reach["R32"] = rounds["R4"]["played"].mean(0)
            reach["R16"] = rounds["R5"]["played"].mean(0)
            reach["QF"] = rounds["R6"]["played"].mean(0)
            reach["SF"] = rounds["R7a"]["played"].mean(0)
            reach["Final"] = np.bincount(wsf.ravel(), minlength=T) / n
            reach["Champ"] = champ
            self.reach = reach
        return champ

    def lambdas_vec_idx(self, ia, ja):
        ea = np.zeros(len(ia)); eb = np.zeros(len(ja))
        for t, e in HOST_EDGE.items():
            k = self.tix[t]
            ea = ea + np.where(ia == k, e, 0.0)
            eb = eb + np.where(ja == k, e, 0.0)
        la = np.exp(B0 + (self.R[ia] + ea) - (self.R[ja] + eb))
        lb = np.exp(B0 + (self.R[ja] + eb) - (self.R[ia] + ea))
        return np.clip(la, *MU_CLIP), np.clip(lb, *MU_CLIP)

    # ---------- fit ratings til outright-markedet ----------
    def fit(self, verbose=True):
        """Dæmpet iterativ kalibrering: P(titel|model) -> P(titel|marked).

        Titelsandsynligheden er meget stejl i rating (d ln p / dR ~ 4-6 for
        favoritter), så der bruges lille eta + aftagende skema, og det bedste
        ratings-sæt (lavest log-fejl på favoritterne) beholdes.
        """
        def anchor_pass(n_iter=12, eta_a=0.5):
            """Justér MODSTANDER-rating så kamp-ankrene rammes (svage hold)."""
            for _ in range(n_iter):
                for fav_t, opp_t, mu_t in MATCH_ANCHORS:
                    i, j = self.tix[fav_t], self.tix[opp_t]
                    mu_cur, _ = self.lambdas(i, j)
                    self.R[j] -= eta_a * (np.log(mu_t) - np.log(mu_cur))

        schedule = [(0.20, 8000)] * 4 + [(0.10, 12000)] * 6
        fav = self.target > 0.005
        for it, (eta, n_fit) in enumerate(schedule):
            champ = self.simulate(n_fit)
            sim = np.maximum(champ, 1.0 / (4 * n_fit))
            err = np.abs(np.log(sim[fav]) - np.log(self.target[fav])).mean()
            upd = eta * (np.log(self.target) - np.log(sim))
            self.R += np.clip(upd, -0.20, 0.20)
            self.R -= self.R.mean()
            if verbose:
                print(f"  fit iter {it+1:2d}: eta={eta:.2f} n={n_fit}  "
                      f"mean |log-fejl| (favoritter) = {err:.3f}")

        # vekslende: kamp-ankre (svage hold) <-> titel-fit (kun favoritter)
        best_err, best_R = np.inf, self.R.copy()
        for cyc in range(4):
            anchor_pass()
            for _ in range(3):
                champ = self.simulate(20000)
                sim = np.maximum(champ, 1.0 / 80000)
                err = np.abs(np.log(sim[fav]) - np.log(self.target[fav])).mean()
                if err < best_err:
                    best_err, best_R = err, self.R.copy()
                upd = 0.06 * (np.log(self.target) - np.log(sim))
                upd[~fav] = 0.0          # bundhold styres af ankrene
                self.R += np.clip(upd, -0.15, 0.15)
            if verbose:
                print(f"  anker-cyklus {cyc+1}: titel-fejl (favoritter) = {err:.3f}")
        self.R = best_R
        anchor_pass()
        if verbose:
            print(f"  -> beholder bedste favorit-fit (fejl {best_err:.3f}) + ankre")
        return self
