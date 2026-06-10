# -*- coding: utf-8 -*-
"""Spillerlag: p_start, mål-/assistandele og skudrater.

Målandele ankres i Golden Boot-markedet: implied prob -> forventede
turneringsmål via konkav mapping (G = a*q^b), delt med holdets forventede
turneringsmål fra simulationen. Resten af holdets mål fordeles på unavngivne
spillere efter position og pris (xG-fallback, jf. spec §4.3).
"""
import numpy as np

EXP_MIN = {"GK": 90, "DEF": 87, "MID": 81, "ATT": 79}
SUB_PROB, SUB_MIN = 0.50, 15        # ikke-startere: 50% indhop a ~15 min
ASSIST_RATE = 0.62                  # andel af mål med holdet-gyldig assist
POS_GOAL_W = {"GK": 0.01, "DEF": 0.30, "MID": 1.00, "ATT": 2.30}
POS_AST_W = {"GK": 0.02, "DEF": 0.50, "MID": 1.30, "ATT": 0.95}
SOT_BASE = {"GK": 0.0, "DEF": 0.18, "MID": 0.40, "ATT": 0.55}
CARD_P = {"GK": 0.04, "DEF": 0.20, "MID": 0.18, "ATT": 0.11}

CREATORS = {  # kendte kreatører -> assistboost
    "Kevin De Bruyne", "Bruno Fernandes", "Florian Wirtz", "Michael Olise",
    "Lamine Yamal", "Lionel Messi", "Raphinha", "Martin Ødegaard",
    "James Rodriguez", "Pedri", "Jude Bellingham", "Giorgian De Arrascaeta",
    "Takefusa Kubo", "Arda Güler", "Jhon Arias", "Achraf Hakimi",
    "Jeremy Doku", "Ousmane Dembele", "Dani Olmo", "Rayan Cherki",
    "Kenan Yildiz", "Brahim Diaz", "Joshua Kimmich", "Vitinha",
    "Andrew Robertson", "Nuno Mendes", "Theo Hernandez", "Alphonso Davies",
}

P_START_OVERRIDE = {
    ("Kylian Mbappe", "Frankrig"): 0.96, ("Harry Kane", "England"): 0.96,
    ("Erling Haaland", "Norge"): 0.96, ("Lionel Messi", "Argentina"): 0.93,
    ("Cristiano Ronaldo", "Portugal"): 0.93, ("Lamine Yamal", "Spanien"): 0.92,
    ("Mikel Oyarzabal", "Spanien"): 0.88, ("Kevin De Bruyne", "Belgien"): 0.70,
    ("Neymar", "Brasilien"): 0.45, ("Marcus Rashford", "England"): 0.55,
    ("Ivan Toney", "England"): 0.25, ("Ollie Watkins", "England"): 0.30,
    ("Jean-Philippe Mateta", "Frankrig"): 0.35, ("Endrick", "Brasilien"): 0.35,
    ("Memphis Depay", "Holland"): 0.75, ("Brian Brobbey", "Holland"): 0.35,
    ("Donyell Malen", "Holland"): 0.55, ("Joao Felix", "Portugal"): 0.55,
    ("Goncalo Ramos", "Portugal"): 0.40, ("Leroy Sane", "Tyskland"): 0.55,
    ("Deniz Undav", "Tyskland"): 0.40, ("Nick Woltemade", "Tyskland"): 0.80,
    ("Kai Havertz", "Tyskland"): 0.60, ("Julian Alvarez", "Argentina"): 0.90,
    ("Lautaro Martinez", "Argentina"): 0.70, ("Ferran Torres", "Spanien"): 0.45,
    ("Nico Williams", "Spanien"): 0.80, ("Mikel Merino", "Spanien"): 0.75,
    ("Marcus Thuram", "Frankrig"): 0.55, ("Bradley Barcola", "Frankrig"): 0.40,
    ("Desire Doue", "Frankrig"): 0.65, ("Rayan Cherki", "Frankrig"): 0.45,
    ("Ousmane Dembele", "Frankrig"): 0.85, ("Michael Olise", "Frankrig"): 0.90,
    ("Eberechi Eze", "England"): 0.65, ("Morgan Rogers", "England"): 0.60,
    ("Anthony Gordon", "England"): 0.50, ("Bukayo Saka", "England"): 0.90,
    ("Jude Bellingham", "England"): 0.88, ("Igor Thiago", "Belgien"): 0.60,
    ("Romelu Lukaku", "Belgien"): 0.65, ("Christian Pulisic", "USA"): 0.90,
    ("Heung-Min Son", "Sydkorea"): 0.90, ("Mohamed Salah", "Egypten"): 0.95,
    ("Sadio Mane", "Senegal"): 0.85, ("Viktor Gyökeres", "Sverige"): 0.90,
    ("Alexander Isak", "Sverige"): 0.85, ("Scott McTominay", "Skotland"): 0.95,
    ("Enner Valencia", "Ecuador"): 0.75, ("Casemiro", "Brasilien"): 0.85,
}


def p_start_heuristic(players):
    """Tildel p_start ud fra pris- og popularitetsrang inden for (hold,position)."""
    by_tp = {}
    for i, p in enumerate(players):
        by_tp.setdefault((p["team"], p["pos"]), []).append(i)
    TIER = {
        "GK": [0.90, 0.08, 0.02],
        "DEF": [0.86, 0.86, 0.86, 0.74, 0.45, 0.25, 0.12],
        "MID": [0.85, 0.85, 0.74, 0.58, 0.40, 0.24, 0.10],
        "ATT": [0.85, 0.68, 0.42, 0.22, 0.10],
    }
    for (team, pos), idxs in by_tp.items():
        prices = np.array([players[i]["price"] for i in idxs])
        pops = np.array([players[i]["pop"] for i in idxs])
        z = 0.55 * (prices - prices.mean()) / (prices.std() + 1e-6) \
            + 0.45 * (pops - pops.mean()) / (pops.std() + 1e-6)
        order = np.argsort(-z)
        for rank, k in enumerate(order):
            i = idxs[k]
            tiers = TIER[pos]
            players[i]["p_start"] = tiers[rank] if rank < len(tiers) else 0.06
    for i, p in enumerate(players):
        if p["pop"] >= 15.0:
            p["p_start"] = max(p["p_start"], 0.85)
        elif p["pop"] >= 8.0:
            p["p_start"] = max(p["p_start"], 0.75)
        ov = P_START_OVERRIDE.get((p["name"], p["team"]))
        if ov is not None:
            p["p_start"] = ov
        if p["out"]:
            p["p_start"] = 0.0
        p["exp_min"] = EXP_MIN[p["pos"]]
        p["mf_exp"] = p["p_start"] * p["exp_min"] / 90.0 \
            + (1 - p["p_start"]) * SUB_PROB * SUB_MIN / 90.0
    return players


def assign_shares(players, matched_scorer, team_tour_goals, team_exp_matches):
    """sigma = andel af holdets mål; fra GB-odds for navngivne, pris/pos for resten."""
    qs = {i: r["q"] for i, r in matched_scorer.items()}
    # GB-floor på p_start: markedet tror på spilletid
    for i, r in matched_scorer.items():
        q = r["q"]
        if players[i]["out"]:
            continue
        floor = 0.93 if q > 0.03 else 0.85 if q > 0.008 else 0.75 if q > 0.003 else 0.62
        ov = P_START_OVERRIDE.get((players[i]["name"], players[i]["team"]))
        if ov is None:
            players[i]["p_start"] = max(players[i]["p_start"], floor)
            players[i]["mf_exp"] = players[i]["p_start"] * players[i]["exp_min"] / 90.0 \
                + (1 - players[i]["p_start"]) * SUB_PROB * SUB_MIN / 90.0
        players[i]["pen"] = r["pen"]

    # Inden for hvert hold fordeles målene RELATIVT efter GB-markedet:
    # holdets samlede målproduktion (Tt) kommer fra kampodds-laget, så
    # GB-oddsenes run-længde-information bruges kun til indbyrdes vægtning
    # (ellers dobbelttælles turneringslængden). Longshot-bias gør halens odds
    # for korte; b=1.0 + et ABSOLUT loft pr. spiller fra den globale mapping
    # (G = a*q^b, ankret top/hale) holder små holds enere nede.
    B_REL = 1.0
    SIGMA_CAP = 0.45
    q_top = max(qs.values())
    G_TOP, G_TAIL, Q_TAIL = 4.8, 0.70, 1e-3
    b_abs = np.log(G_TOP / G_TAIL) / np.log(q_top / Q_TAIL)
    a_abs = G_TOP / q_top ** b_abs

    teams = {p["team"] for p in players}
    by_team = {t: [i for i, p in enumerate(players) if p["team"] == t] for t in teams}
    for t in teams:
        idxs = by_team[t]
        Tt = max(team_tour_goals[t], 0.5)
        named = [k for k, i in enumerate(idxs) if i in qs and not players[i]["out"]]
        w_named = np.zeros(len(idxs))
        for k in named:
            w_named[k] = qs[idxs[k]] ** B_REL
        n_named = len(named)
        u_t = float(np.clip(0.50 - 0.035 * n_named, 0.16, 0.50))  # unavngivnes andel
        sig = np.zeros(len(idxs))
        if w_named.sum() > 0:
            sig = (1.0 - u_t) * w_named / w_named.sum()
            for k in named:  # absolut loft: forventede mål fra global q->G-mapping
                g_abs = a_abs * qs[idxs[k]] ** b_abs
                sig[k] = min(sig[k], 1.2 * g_abs / Tt, SIGMA_CAP)
        resid = max(1.0 - sig.sum(), 0.10)
        w = np.zeros(len(idxs))
        for k, i in enumerate(idxs):
            p = players[i]
            if k in named or p["out"]:
                continue
            w[k] = POS_GOAL_W[p["pos"]] * (p["price"] ** 1.5) * max(p["mf_exp"], 0.02)
        if w.sum() > 0:
            sig += resid * w / w.sum()
        # assists
        wa = np.zeros(len(idxs))
        for k, i in enumerate(idxs):
            p = players[i]
            if p["out"]:
                continue
            boost = 1.6 if p["name"] in CREATORS else 1.0
            wa[k] = POS_AST_W[p["pos"]] * (0.4 + p["price"] / 10.0) * boost * max(p["mf_exp"], 0.02)
        wa = ASSIST_RATE * wa / max(wa.sum(), 1e-9)
        for k, i in enumerate(idxs):
            p = players[i]
            p["sigma_g"] = float(sig[k])
            p["sigma_a"] = float(wa[k])
            mf = max(p["mf_exp"], 0.05)
            p["s_g"] = min(p["sigma_g"] / mf, 0.75)   # binomial-andel givet på banen
            p["s_a"] = min(p["sigma_a"] / mf, 0.75)
            em = max(team_exp_matches[t], 1.0)
            g_per_match = p["sigma_g"] * Tt / em
            p["sot90"] = min(SOT_BASE[p["pos"]] + 1.3 * g_per_match, 1.9)
            p.setdefault("pen", False)
    return players
