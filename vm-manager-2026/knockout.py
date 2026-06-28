#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""FREMADSKUENDE KNOCKOUT-SIMULATOR (R32 -> finale).

Det faste bracket propageres N gange. Ratings udledes af aktuelle titelodds.
For hver spiller beregnes: P(når hver runde), forventet vækst pr. runde (R4-R7)
via det eksakte holdet-pointsystem, og P(når finalen). Bruges til at maksimere
værdi under hensyn til transfergebyr (1%) og nationsgrænse (bortfalder ved KF).

Kør: python knockout.py
"""
import sys, os, csv
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from src.scoring import SCORING, CAPTAIN_MULT

DATA = os.path.join(os.path.dirname(__file__), "data")
N = 20000
B0 = np.log(1.30)          # mål-niveau pr. hold/kamp
MU_CLIP = (0.18, 4.2)

# ---------------- R32-bracket (faste opgør) + flow ----------------
R32 = [
    ("Sydafrika", "Canada"), ("Brasilien", "Japan"), ("Tyskland", "Paraguay"),
    ("Holland", "Marokko"), ("Elfenbenskysten", "Norge"), ("Frankrig", "Sverige"),
    ("Mexico", "Ecuador"), ("England", "Congo DR"), ("Belgien", "Senegal"),
    ("USA", "Bosnien-Hercegovina"), ("Spanien", "Østrig"), ("Portugal", "Kroatien"),
    ("Schweiz", "Algeriet"), ("Australien", "Egypten"), ("Argentina", "Kap Verde"),
    ("Colombia", "Ghana"),
]
# R16-par (0-indekserede R32-kampe). R4=R32, R5=R16, R6=QF, R7=SF+F.
R16 = [(0, 3), (2, 5), (1, 4), (6, 7), (11, 10), (9, 8), (14, 13), (12, 15)]
QF = [(0, 1), (2, 3), (4, 5), (6, 7)]
SF = [(0, 1), (2, 3)]

# straffeskytter (fra odds_scorer + kendt) — bonus til pen-andel
PEN = {"Mbappe","Kane","Haaland","Oyarzabal","Messi","Ronaldo","Raphinha","Havertz",
       "Lukaku","Salah","Son","Mane","Bruno Fernandes","Isak","James","Kudus"}


def am2p(a):
    a = float(a); return 100/(a+100) if a > 0 else -a/(-a+100)


def load_title():
    raw = {}
    with open(os.path.join(DATA, "odds_title_r32.csv")) as f:
        for r in csv.DictReader(f):
            raw[r["team"]] = am2p(r["american"])
    s = sum(raw.values())
    return {t: p/s for t, p in raw.items()}


def load_players():
    """Aktive spillere fra stats_after_r3.csv med pris + form-felter."""
    POS = {"Keeper":"GK","Målvogter":"GK","Forsvar":"DEF","Midtbane":"MID","Angreb":"ATT","Angriber":"ATT"}
    out = []
    with open(os.path.join(DATA, "stats_after_r3.csv"), encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            def n(x):
                try: return float(str(x).replace(".","").replace(",",".")) if x not in("",None) else 0.0
                except: return 0.0
            out.append(dict(name=r["Navn"].strip(), team=r["Hold"].strip(),
                pos=POS.get(r["Position"].strip(),"MID"), price=n(r["Pris"])/1e6,
                goals=n(r["Mål"]), assists=n(r["Assist"]), index=n(r["Index"]),
                inj=r.get("Skadet","").strip()!="" or r.get("Karantæne","").strip()!=""))
    return out


def load_scorer_q():
    """GB-odds -> relativ målandel-vægt pr. spiller (de-vigget global)."""
    q = {}
    with open(os.path.join(DATA, "odds_scorer.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            q[(r["player"].strip(), r["team"].strip())] = am2p(r["gb_american"])
    return q


# ---------------- ratings fra titelodds (fit på bracket) ----------------
class KO:
    def __init__(self, title, seed=7):
        self.teams = sorted(title)
        self.ix = {t: i for i, t in enumerate(self.teams)}
        self.target = np.array([title[t] for t in self.teams])
        self.R = 0.30*(np.log(self.target)-np.log(self.target).mean())
        self.rng = np.random.default_rng(seed)

    def mus(self, ia, ja):
        la = np.exp(B0 + self.R[ia] - self.R[ja]); lb = np.exp(B0 + self.R[ja] - self.R[ia])
        return np.clip(la,*MU_CLIP), np.clip(lb,*MU_CLIP)

    def _tie(self, ia, ja, rec, rname):
        """Spil ét knockout-opgør (vektoriseret). Returnér vinder-indeks."""
        la, lb = self.mus(ia, ja)
        ga = self.rng.poisson(la); gb = self.rng.poisson(lb)
        lvl = ga == gb
        ga = ga + np.where(lvl, self.rng.poisson(la/3.0), 0)
        gb = gb + np.where(lvl, self.rng.poisson(lb/3.0), 0)
        still = ga == gb
        wa = (ga > gb) | (still & (self.rng.random(len(ia)) < la/(la+lb)))
        s = np.arange(len(ia))
        for arr, gf, gca, lf, won, sw in ((ia,ga,gb,la,wa,still&wa),(ja,gb,ga,lb,~wa,still&~wa)):
            rec["played"][s, arr] = True
            rec["gf"][s, arr] = gf; rec["ga"][s, arr] = gca
            rec["win"][s, arr] = gf > gca; rec["lam_a"][s, arr] = lf
            rec["so"][s, arr] = sw
        return np.where(wa, ia, ja)

    def simulate(self, n):
        T = len(self.teams)
        rounds = {r: dict(played=np.zeros((n,T),bool), gf=np.zeros((n,T),np.int16),
                          ga=np.zeros((n,T),np.int16), win=np.zeros((n,T),bool),
                          so=np.zeros((n,T),bool), lam_a=np.zeros((n,T),np.float32))
                  for r in ["R4","R5","R6","R7"]}
        ix = self.ix
        a = np.array([[ix[h] for h,_ in R32]]*1)  # placeholder
        # R32
        A = np.array([ix[h] for h,_ in R32]); Bt = np.array([ix[a_] for _,a_ in R32])
        w32 = np.zeros((n,16),np.int32)
        for k in range(16):
            w32[:,k] = self._tie(np.full(n,A[k]), np.full(n,Bt[k]), rounds["R4"], "R4")
        w16 = np.zeros((n,8),np.int32)
        for m,(x,y) in enumerate(R16):
            w16[:,m] = self._tie(w32[:,x], w32[:,y], rounds["R5"], "R5")
        wqf = np.zeros((n,4),np.int32)
        for m,(x,y) in enumerate(QF):
            wqf[:,m] = self._tie(w16[:,x], w16[:,y], rounds["R6"], "R6")
        wsf = np.zeros((n,2),np.int32); lsf=np.zeros((n,2),np.int32)
        for m,(x,y) in enumerate(SF):
            w = self._tie(wqf[:,x], wqf[:,y], rounds["R7"], "R7"); wsf[:,m]=w
            lsf[:,m]=np.where(w==wqf[:,x],wqf[:,y],wqf[:,x])
        # finale + bronze (begge tæller som R7-kamp #2)
        self._tie(wsf[:,0], wsf[:,1], rounds["R7"], "R7")
        self._tie(lsf[:,0], lsf[:,1], rounds["R7"], "R7")
        champ = np.bincount(self._tie(wsf[:,0],wsf[:,1],rounds["R7"],"R7"),minlength=T)/n if False else None
        self.rounds = rounds
        # P(når runde) pr. hold
        self.reach = {r: rounds[r]["played"].mean(0) for r in rounds}
        self.reach["Final"] = (np.bincount(wsf.ravel(),minlength=T)/n)
        return rounds

    def fit(self, iters=10, n=6000):
        fav = self.target > 0.01
        for _ in range(iters):
            self.simulate(n)
            sim = np.maximum(self.reach["Final"], 1/(2*n))
            # match finalist-rate til ~2*titel (groft) — kalibrér via titel-relativ
            tgt = self.target / self.target.sum()
            upd = 0.25*(np.log(self.target)-np.log(np.maximum(self.reach["R7"].clip(1e-4),1e-4)))
            # enklere: træk ratings mod titel-implied styrke
            self.R += 0.0  # ratings holdes (titel-init er god nok til bracket-EV)
            break
        return self


# ---------------- spiller-vækst pr. runde ----------------
def player_growth(p, ko, scorer_q, rname):
    """Forventet vækst (kr.) for spiller i runden, korreleret m. holdets resultat."""
    t = ko.ix.get(p["team"])
    if t is None: return 0.0
    d = ko.rounds[rname]
    played = d["played"][:, t]
    if not played.any() or p["inj"]:
        return 0.0
    n = played.shape[0]
    gf = d["gf"][:, t].astype(float); ga = d["ga"][:, t].astype(float)
    win = d["win"][:, t]; lam_a = d["lam_a"][:, t]
    # spilletid: knockout = fuld styrke for startere (vi bruger p_start≈0.9 for ejede/kandidater)
    ps = p.get("p_start", 0.85)
    plays = (np.random.default_rng(abs(hash(p["name"]+rname))%2**32).random(n) < ps) & played
    mf = np.where(plays, 0.92, 0.0)
    # målandel: GB-odds-vægt -> andel af holdets mål
    sig = p.get("s_g", 0.06); sa = p.get("s_a", 0.05)
    pg = np.random.default_rng(1+abs(hash(p["name"]))%2**31).binomial(np.maximum(gf.astype(int),0), min(sig,0.9))*plays
    pa = np.random.default_rng(2+abs(hash(p["name"]))%2**31).binomial(np.maximum(gf.astype(int),0), min(sa,0.9))*plays
    pos = p["pos"]; g = np.zeros(n)
    g += pg*SCORING["goal"][pos] + pa*SCORING["assist"]
    g += np.where(win & (pg>0), 0.4*SCORING["decisive_win"], 0)
    res = np.where(win, SCORING["result"]["W"], np.where(gf==ga, SCORING["result"]["D"], SCORING["result"]["L"]))
    g += np.where(plays, res + gf*SCORING["team_goal"] + ga*SCORING["conceded"] + SCORING["appear"], 0)
    if pos in ("GK","DEF"):
        g += ((ga==0)&plays)*SCORING["clean_sheet"][pos]
    if pos=="GK":
        g += np.random.default_rng(3+abs(hash(p["name"]))%2**31).poisson(np.clip(lam_a*1.6+0.8,0,8))*plays*SCORING["gk_save"]
    g += (pg>=3)*SCORING["hattrick"]
    motm = np.clip((sig+0.5*sa)*0.5,0.02,0.32)*np.where(win,1.0,0.4)*plays
    g += (np.random.default_rng(4+abs(hash(p["name"]))%2**31).random(n)<motm)*SCORING["motm"]
    return float(g.mean())


def main():
    title = load_title()
    ko = KO(title); ko.simulate(N)
    players = load_players()
    q = load_scorer_q()
    # tildel målandele pr. spiller: GB-vægt inden for hold, ellers pos/pris-heuristik
    POSW = {"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}
    by_team = {}
    for p in players: by_team.setdefault(p["team"],[]).append(p)
    for tm, ps in by_team.items():
        # navngivne GB-vægte
        for p in ps:
            p["qw"] = q.get((p["name"],tm), 0.0)
        # mål-andel ~ blanding af GB-vægt og pos*pris*index
        base = np.array([POSW[p["pos"]]*(p["price"]**1.3)*(1+p["index"]/120) for p in ps])
        gbw = np.array([p["qw"] for p in ps])
        gbw = gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew = base/base.sum() if base.sum()>0 else gbw
        share = 0.6*gbw + 0.4*basew  # andel af holdets mål
        for p,s in zip(ps,share):
            p["s_g"] = float(np.clip(s,0,0.6))
            p["s_a"] = float(np.clip(0.55*s + 0.15*basew[ps.index(p)],0,0.5))
            p["p_start"] = 0.92 if (p["qw"]>0.004 or p["price"]>=4.5) else (0.82 if p["price"]>=3 else 0.7)

    # forventet vækst R4-R7 + reach
    rounds = ["R4","R5","R6","R7"]
    for p in players:
        ev = {r: player_growth(p, ko, q, r) for r in rounds}
        p["ev"] = ev; p["ev_tot"] = sum(ev.values())
        t = ko.ix.get(p["team"])
        p["pF"] = ko.reach["Final"][t] if t is not None else 0.0

    # ===== rapport =====
    print("="*82)
    print(f"KNOCKOUT-SIM ({N:,} brackets) — P(når runde) for nøglehold")
    print("="*82)
    print(f"{'Hold':<14}{'R16%':>7}{'QF%':>7}{'SF%':>7}{'Finale%':>9}")
    for t in ["Frankrig","Argentina","Spanien","Brasilien","England","Portugal","Holland","Marokko","Colombia","Canada"]:
        i=ko.ix[t]
        print(f"{t:<14}{ko.reach['R5'][i]*100:6.0f}%{ko.reach['R6'][i]*100:6.0f}%{ko.reach['R7'][i]*100:6.0f}%{ko.reach['Final'][i]*100:8.0f}%")

    mine = {"Unai Simon","Chadi Riad","Douglas Santos","Luc De Fougerolles","Aurelien Tchouameni",
            "Ismael Saibari","Jhon Arias","Mikel Oyarzabal","Kylian Mbappe","Lionel Messi","Azzedine Ounahi"}
    print("\n"+"="*82); print("DIT HOLD — forventet vækst pr. runde + P(finale)"); print("="*82)
    print(f"{'Spiller':<20}{'Hold':<11}{'R4':>7}{'R5':>7}{'R6':>7}{'R7':>7}{'TOT':>8}{'Fin%':>6}")
    tot_now=0
    for p in players:
        if p["name"] in mine:
            tot_now+=p["ev_tot"]
            print(f"{p['name']:<20}{p['team']:<11}"+"".join(f"{p['ev'][r]/1000:6.0f}k" for r in rounds)
                  +f"{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")
    print(f"{'  SUM (uden kaptajn)':<58}{tot_now/1e6:6.2f}m")

    print("\n"+"="*82); print("BEDSTE KANDIDATER (forventet R4-R7 vækst, aktive, pris-effektivt)"); print("="*82)
    cand=[p for p in players if not p["inj"] and p["ev_tot"]>200_000]
    cand.sort(key=lambda p:-p["ev_tot"])
    print("Top 20 efter samlet forventet vækst:")
    print(f"{'Spiller':<20}{'Hold':<11}{'Pos':<5}{'Pris':>5}{'TOT':>8}{'/mio':>7}{'Fin%':>6}")
    for p in cand[:20]:
        print(f"{p['name']:<20}{p['team']:<11}{p['pos']:<5}{p['price']:4.1f}m{p['ev_tot']/1000:7.0f}k"
              f"{p['ev_tot']/1000/max(p['price'],0.1):6.0f}k{p['pF']*100:5.0f}%")

    # ===== transfer-optimering: max forventet R4-R7 vækst under budget =====
    import pulp
    BUDGET = 56.5   # ~holdværdi + bank (BEKRÆFT). Nationsgrænse 4 (gælder R4-R5).
    FORM = {"GK":(1,1),"DEF":(3,5),"MID":(3,5),"ATT":(1,3)}
    pool = [p for p in players if not p["inj"] and p["price"]>0]
    M = len(pool)
    prob = pulp.LpProblem("ko", pulp.LpMaximize)
    x = {i: pulp.LpVariable(f"x{i}", cat="Binary") for i in range(M)}
    c = {i: pulp.LpVariable(f"c{i}", cat="Binary") for i in range(M)}
    prob += (pulp.lpSum(pool[i]["ev_tot"]*x[i] for i in range(M))
             + pulp.lpSum(pool[i]["ev"]["R4"]*(CAPTAIN_MULT-1)*c[i] for i in range(M)))
    prob += pulp.lpSum(x[i] for i in range(M)) == 11
    prob += pulp.lpSum(pool[i]["price"]*x[i] for i in range(M)) <= BUDGET
    prob += pulp.lpSum(c[i] for i in range(M)) == 1
    for pos,(lo,hi) in FORM.items():
        idx=[i for i in range(M) if pool[i]["pos"]==pos]
        prob += pulp.lpSum(x[i] for i in idx)>=lo; prob += pulp.lpSum(x[i] for i in idx)<=hi
    for i in range(M): prob += c[i]<=x[i]
    for tm in set(p["team"] for p in pool):
        idx=[i for i in range(M) if pool[i]["team"]==tm]
        if len(idx)>4: prob += pulp.lpSum(x[i] for i in idx)<=4
    prob.solve(pulp.PULP_CBC_CMD(msg=0))
    sq=[i for i in range(M) if x[i].value() and x[i].value()>0.5]
    cap=[i for i in range(M) if c[i].value() and c[i].value()>0.5]
    cap=cap[0] if cap else None
    order={"GK":0,"DEF":1,"MID":2,"ATT":3}
    sq.sort(key=lambda i:(order[pool[i]["pos"]],-pool[i]["ev_tot"]))
    print("\n"+"="*82); print("OPTIMALT R4-HOLD (max fremadskuende vækst, nationsgrænse 4, budget %.0fm)"%BUDGET); print("="*82)
    spend=sum(pool[i]["price"] for i in sq)
    for i in sq:
        star="  (C)" if i==cap else ""
        print(f"  {pool[i]['pos']:<4}{pool[i]['name']:<20}{pool[i]['team']:<11}{pool[i]['price']:4.1f}m"
              f"  EV {pool[i]['ev_tot']/1000:5.0f}k  Fin {pool[i]['pF']*100:3.0f}%{star}")
    print(f"  forbrug {spend:.1f}m  ·  kaptajn {pool[cap]['name']}")
    own={"Unai Simon","Chadi Riad","Douglas Santos","Luc De Fougerolles","Aurelien Tchouameni",
         "Ismael Saibari","Jhon Arias","Mikel Oyarzabal","Kylian Mbappe","Lionel Messi","Azzedine Ounahi"}
    new=[pool[i]["name"] for i in sq if pool[i]["name"] not in own]
    drop=own-{pool[i]["name"] for i in sq}
    print(f"  IND : {', '.join(new)}")
    print(f"  UD  : {', '.join(sorted(drop))}")
    return ko, players

if __name__ == "__main__":
    main()
