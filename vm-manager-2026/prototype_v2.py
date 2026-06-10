#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VM MANAGER 2026 (holdet.dk) - Monte Carlo + FLERRUNDE-OPTIMERING (v2)
=====================================================================
Bygget af Claude til Frederik.

Nyt i v2 ift. v1:
  * Transfergebyrer modelleret (1% / 10k pr. mio. af koebt spillers vaerdi).
    R1-opbygning er gratis; gebyr gaelder kun R1->R2 og R2->R3.
  * Bankrente (1% pr. runde af uforbrugt budget).
  * FAELLES optimering over R1+R2+R3: vaelger R1-hold OG transferstien samlet,
    saa "behold og amortiser gebyr" afvejes mod "skift til bedre kamp".
  * Kaptajn vaelges per runde (fordobler vaeksten) - og at kaptajne en
    nykoebt premium-spiller "halverer" reelt gebyret, fanges automatisk.
  * R3 medtaget (kendte gruppe-pairings) men nedvaegtet for rotation/stakes-usikkerhed.

ALLE antagelser ligger redigerbart oeverst. xG-andele, priser, p_start og CS%
stammer fra ekspertmodellen (Bisgaard/BetXpert) + outright-odds, juni 2026.
"""

import numpy as np, pulp
rng = np.random.default_rng(42)

# ===================== POINTSYSTEM / PARAMETRE =======================
SCORING = {                       # holdet.dk VM Manager 2026 (aflaest fra reglerne)
    "goal":        {"GK":250_000,"DEF":175_000,"MID":150_000,"ATT":125_000},
    "assist":      60_000,
    "shot":        10_000,        # pr. skud paa maal (inkl. maalskud)
    "decisive_win":40_000,        # maal der sikrer sejr (goalscorer)
    "decisive_drw":20_000,        # maal der sikrer uafgjort
    "motm":        33_000,        # kampens spiller (1 pr. kamp)
    "yellow":     -20_000,
    "result":      {"W":25_000,"D":5_000,"L":-8_000},   # holdpraestation
    "team_goal":   10_000,        # til ALLE spillere pr. holdmaal
    "conceded":   -8_000,         # til ALLE spillere pr. indkasseret maal
    "appear":      7_000,         # paa banen
    "no_appear":  -5_000,         # ikke paa banen (benket)
    "clean_sheet": {"GK":75_000,"DEF":50_000,"MID":0,"ATT":0},
    "gk_save":     5_000,
    "hattrick":    100_000,
}
CAPTAIN_MULT   = 2.0            # bekraeftet: Kaptajnbonus = Vaekst*1 => x2
N_SIMS         = 40_000
BUDGET         = 50.0           # mio.
BUDGET_R       = {"R1":50.0,"R2":51.1,"R3":52.2}   # holdvaerdi vokser ~2.2%/runde
TRANSFER_RATE  = 0.01           # 1% af koebt spillers pris (10k/mio.)
BANK_RATE      = 0.0            # rente fjernet som optimeringsdriver (se note)
ROUNDS         = ["R1","R2","R3"]
ROUND_WEIGHTS  = {"R1":1.0,"R2":1.0,"R3":0.80}   # R3 nedvaegtet (usikker)
FORMATION      = {"GK":(1,1),"DEF":(3,5),"MID":(2,5),"ATT":(1,3)}

# ===================== HOLDDATA: R1 fast, R2/R3 estimat ==============
# cs -> mu_against = -ln(cs).  R3-pairings er kendte fra gruppen men
# stakes/rotation goer dem usikre -> konservative tal + ROUND_WEIGHTS.
TEAMS = {
 "Norge":   {"R1":dict(opp="Irak",       mu_for=2.10,cs=0.57,win=0.74,draw=0.17),
             "R2":dict(opp="Senegal",    mu_for=1.50,cs=0.40,win=0.45,draw=0.28),
             "R3":dict(opp="Frankrig",   mu_for=1.30,cs=0.38,win=0.32,draw=0.28)},
 "Spanien": {"R1":dict(opp="Kap Verde",  mu_for=2.70,cs=0.61,win=0.82,draw=0.12),
             "R2":dict(opp="Saudi-Arab.",mu_for=2.40,cs=0.58,win=0.78,draw=0.15),
             "R3":dict(opp="Uruguay",    mu_for=1.80,cs=0.48,win=0.55,draw=0.27)},
 "Tyskland":{"R1":dict(opp="Curacao",    mu_for=2.90,cs=0.59,win=0.83,draw=0.12),
             "R2":dict(opp="Elfenbensk.",mu_for=1.80,cs=0.45,win=0.55,draw=0.25),
             "R3":dict(opp="Ecuador",    mu_for=1.90,cs=0.50,win=0.58,draw=0.25)},
 "Portugal":{"R1":dict(opp="DR Congo",   mu_for=2.30,cs=0.52,win=0.72,draw=0.18),
             "R2":dict(opp="Usbekistan", mu_for=2.20,cs=0.55,win=0.72,draw=0.18),
             "R3":dict(opp="Colombia",   mu_for=1.60,cs=0.45,win=0.45,draw=0.28)},
 "Frankrig":{"R1":dict(opp="Senegal",    mu_for=1.60,cs=0.42,win=0.55,draw=0.25),
             "R2":dict(opp="Irak",       mu_for=2.20,cs=0.62,win=0.78,draw=0.15),
             "R3":dict(opp="Norge",      mu_for=1.60,cs=0.45,win=0.52,draw=0.26)},
 "Schweiz": {"R1":dict(opp="Qatar",      mu_for=1.90,cs=0.60,win=0.62,draw=0.23),
             "R2":dict(opp="UEFA-PO A",  mu_for=1.70,cs=0.52,win=0.58,draw=0.25),
             "R3":dict(opp="Canada",     mu_for=1.50,cs=0.45,win=0.45,draw=0.27)},
 "Iran":    {"R1":dict(opp="New Zealand",mu_for=1.50,cs=0.41,win=0.52,draw=0.26),
             "R2":dict(opp="Egypten",    mu_for=1.10,cs=0.35,win=0.34,draw=0.30),
             "R3":dict(opp="Belgien",    mu_for=0.90,cs=0.30,win=0.22,draw=0.28)},
 "Skotland":{"R1":dict(opp="Haiti",      mu_for=1.80,cs=0.45,win=0.58,draw=0.24),
             "R2":dict(opp="Marokko",    mu_for=1.10,cs=0.33,win=0.30,draw=0.30),
             "R3":dict(opp="Brasilien",  mu_for=0.90,cs=0.28,win=0.18,draw=0.26)},
 "Colombia":{"R1":dict(opp="Usbekistan", mu_for=1.70,cs=0.54,win=0.58,draw=0.25),
             "R2":dict(opp="DR Congo",   mu_for=1.70,cs=0.50,win=0.58,draw=0.24),
             "R3":dict(opp="Portugal",   mu_for=1.30,cs=0.42,win=0.38,draw=0.28)},
 "Ostrig":  {"R1":dict(opp="Jordan",     mu_for=1.90,cs=0.50,win=0.62,draw=0.23),
             "R2":dict(opp="Algeriet",   mu_for=1.40,cs=0.42,win=0.42,draw=0.28),
             "R3":dict(opp="Argentina",  mu_for=1.00,cs=0.32,win=0.22,draw=0.26)},
 "Ecuador": {"R1":dict(opp="Elfenbensk.",mu_for=1.30,cs=0.45,win=0.42,draw=0.30),
             "R2":dict(opp="Curacao",    mu_for=2.20,cs=0.60,win=0.75,draw=0.16),
             "R3":dict(opp="Tyskland",   mu_for=1.00,cs=0.35,win=0.25,draw=0.30)},
 "Mexico":  {"R1":dict(opp="Sydafrika",  mu_for=1.70,cs=0.45,win=0.58,draw=0.25),
             "R2":dict(opp="Sydkorea",   mu_for=1.40,cs=0.42,win=0.45,draw=0.28),
             "R3":dict(opp="Tjekkiet",   mu_for=1.50,cs=0.45,win=0.50,draw=0.27)},
 "England": {"R1":dict(opp="Kroatien",   mu_for=1.50,cs=0.45,win=0.50,draw=0.27),
             "R2":dict(opp="Panama",     mu_for=2.40,cs=0.60,win=0.80,draw=0.14),
             "R3":dict(opp="Ghana",      mu_for=2.00,cs=0.52,win=0.68,draw=0.18)},
}

# ===================== SPILLERPULJE =================================
P = lambda **k: k
PLAYERS = [
 P(name="Haaland",     nat="Norge",   pos="ATT",price=8.5,p_start=0.97,min=88,g=0.50,a=0.12),
 P(name="Mbappe",      nat="Frankrig",pos="ATT",price=10.0,p_start=0.95,min=85,g=0.33,a=0.20),
 P(name="Oyarzabal",   nat="Spanien", pos="ATT",price=7.5,p_start=0.88,min=76,g=0.30,a=0.10),
 P(name="Ronaldo",     nat="Portugal",pos="ATT",price=7.0,p_start=0.89,min=85,g=0.38,a=0.08),
 P(name="Kane",        nat="England", pos="ATT",price=9.0,p_start=0.96,min=88,g=0.37,a=0.10),
 P(name="Havertz",     nat="Tyskland",pos="ATT",price=5.5,p_start=0.72,min=76,g=0.20,a=0.12),
 P(name="E. Valencia", nat="Ecuador", pos="ATT",price=4.0,p_start=0.90,min=80,g=0.48,a=0.10),
 P(name="Taremi",      nat="Iran",    pos="ATT",price=3.5,p_start=0.90,min=85,g=0.52,a=0.12),
 P(name="L. Yamal",    nat="Spanien", pos="ATT",price=9.0,p_start=0.80,min=74,g=0.22,a=0.22),
 P(name="Wirtz",       nat="Tyskland",pos="MID",price=7.5,p_start=0.95,min=85,g=0.18,a=0.25),
 P(name="Musiala",     nat="Tyskland",pos="MID",price=6.5,p_start=0.86,min=74,g=0.15,a=0.15),
 P(name="Pedri",       nat="Spanien", pos="MID",price=6.0,p_start=0.90,min=80,g=0.14,a=0.16),
 P(name="B. Fernandes",nat="Portugal",pos="MID",price=7.0,p_start=0.96,min=90,g=0.23,a=0.24),
 P(name="Kimmich",     nat="Tyskland",pos="MID",price=5.5,p_start=0.95,min=90,g=0.08,a=0.18),
 P(name="F. Ruiz",     nat="Spanien", pos="MID",price=4.5,p_start=0.85,min=80,g=0.10,a=0.12),
 P(name="McTominay",   nat="Skotland",pos="MID",price=4.5,p_start=0.95,min=88,g=0.28,a=0.10),
 P(name="J. Rodriguez",nat="Colombia",pos="MID",price=4.0,p_start=0.92,min=85,g=0.12,a=0.30),
 P(name="Sabitzer",    nat="Ostrig",  pos="MID",price=4.5,p_start=0.95,min=88,g=0.18,a=0.22),
 P(name="Alvarado",    nat="Mexico",  pos="MID",price=2.5,p_start=0.80,min=75,g=0.12,a=0.12),
 P(name="Nmecha",      nat="Tyskland",pos="MID",price=3.0,p_start=0.55,min=65,g=0.10,a=0.08),
 P(name="Cucurella",   nat="Spanien", pos="DEF",price=4.5,p_start=0.90,min=85,g=0.04,a=0.10),
 P(name="Laporte",     nat="Spanien", pos="DEF",price=4.5,p_start=0.88,min=85,g=0.06,a=0.04),
 P(name="N. Mendes",   nat="Portugal",pos="DEF",price=4.5,p_start=0.90,min=85,g=0.04,a=0.18),
 P(name="Schlotterbeck",nat="Tyskland",pos="DEF",price=4.0,p_start=0.90,min=86,g=0.05,a=0.04),
 P(name="D. Sanchez",  nat="Colombia",pos="DEF",price=3.5,p_start=0.92,min=88,g=0.08,a=0.04),
 P(name="Ajer",        nat="Norge",   pos="DEF",price=3.0,p_start=0.80,min=85,g=0.06,a=0.04),
 P(name="Ryerson",     nat="Norge",   pos="DEF",price=3.5,p_start=0.92,min=88,g=0.05,a=0.10),
 P(name="N. Brown",    nat="Tyskland",pos="DEF",price=2.5,p_start=0.60,min=80,g=0.05,a=0.08),
 P(name="Elvedi",      nat="Schweiz", pos="DEF",price=3.0,p_start=0.90,min=88,g=0.04,a=0.03),
 P(name="Widmer",      nat="Schweiz", pos="DEF",price=2.5,p_start=0.85,min=85,g=0.03,a=0.06),
 P(name="Robertson",   nat="Skotland",pos="DEF",price=3.5,p_start=0.95,min=88,g=0.04,a=0.12),
 P(name="Danso",       nat="Ostrig",  pos="DEF",price=3.0,p_start=0.90,min=88,g=0.05,a=0.03),
 P(name="Mojica",      nat="Colombia",pos="DEF",price=2.5,p_start=0.85,min=85,g=0.03,a=0.06),
 P(name="J. Vasquez",  nat="Mexico",  pos="DEF",price=2.5,p_start=0.88,min=88,g=0.04,a=0.04),
 P(name="Kobel",       nat="Schweiz", pos="GK", price=4.0,p_start=0.95,min=90,g=0.0,a=0.0),
 P(name="Nyland",      nat="Norge",   pos="GK", price=4.0,p_start=0.95,min=90,g=0.0,a=0.0),
 P(name="Beiranvand",  nat="Iran",    pos="GK", price=3.0,p_start=0.95,min=90,g=0.0,a=0.0),
 P(name="Malagon(MEX)",nat="Mexico",  pos="GK", price=3.0,p_start=0.90,min=90,g=0.0,a=0.0),
]

# ===================== MONTE CARLO =================================
CARD_P = {"ATT":0.12,"MID":0.20,"DEF":0.20,"GK":0.04}
def sot_rate(p):                  # skud paa maal pr. 90 ud fra rolle
    base={"ATT":1.0,"MID":0.4,"DEF":0.15,"GK":0.0}[p["pos"]]
    return base + {"ATT":2.0,"MID":1.5,"DEF":0.6,"GK":0.0}[p["pos"]]*p["g"]
def motm_base(p):                 # sandsynlighed for kampens spiller (ved sejr)
    return float(np.clip((p["g"]+p["a"])*0.55, 0.03, 0.30))

def sim(p, tr, n=N_SIMS):
    pos=p["pos"]; mu=tr["mu_for"]; muc=-np.log(tr["cs"])
    starts = rng.random(n) < p["p_start"]
    minutes = np.where(starts, np.clip(rng.normal(p["min"],6,n),30,90),
              np.where(rng.random(n)<0.5, rng.uniform(0,25,n), 0.0))
    plays = minutes>0; mf = minutes/90.0; p60 = minutes>=60
    # Holdets scoreline (Poisson) driver baade resultat, clean sheet og hold-bonus
    tg = rng.poisson(mu, n)            # holdets maal
    tc = rng.poisson(muc, n)           # indkasserede maal
    # Spillerens egne maal/assists = binomial paa holdets maal, skaleret med spilletid
    pg = rng.binomial(tg, np.clip(p["g"]*mf,0,1))
    pa = rng.binomial(tg, np.clip(p["a"]*0.75*mf,0,1))
    opp_adj = np.clip(mu/1.6, 0.55, 1.6)                 # faerre skud paa maal mod staerke forsvar
    sot = np.maximum(rng.poisson(sot_rate(p)*mf*opp_adj), pg)   # skud paa maal (mindst = maal)
    win = tg>tc; draw=tg==tc
    cs_hit = (tc==0) & p60 & (pos in ("DEF","GK"))
    # bidrag
    g_val   = pg*SCORING["goal"][pos]
    a_val   = pa*SCORING["assist"]
    s_val   = sot*SCORING["shot"]
    res     = np.where(win,SCORING["result"]["W"],np.where(draw,SCORING["result"]["D"],SCORING["result"]["L"]))
    team    = tg*SCORING["team_goal"] + tc*SCORING["conceded"]
    decis   = np.where(win & (pg>0), 0.35*SCORING["decisive_win"],
              np.where(draw & (pg>0), 0.35*SCORING["decisive_drw"], 0))
    motm    = np.where(win, motm_base(p), motm_base(p)*0.4)*SCORING["motm"]
    cs_val  = cs_hit*SCORING["clean_sheet"][pos]
    gk_sv   = (SCORING["gk_save"]*rng.poisson(np.maximum(muc*1.8+1.0,0))*mf) if pos=="GK" else 0
    hat     = (pg>=3)*SCORING["hattrick"]
    cards   = CARD_P[pos]*SCORING["yellow"]      # forventet kort
    # paa banen / ikke paa banen
    app = np.where(p60, SCORING["appear"], np.where(plays, SCORING["appear"]*mf, SCORING["no_appear"]))
    # nulstil kamp-bidrag hvis spilleren slet ikke spillede
    played = plays.astype(float)
    growth = (g_val+a_val+s_val+res*played+team*played+decis+motm*played+cs_val+gk_sv+hat) + app + cards*played
    return growth.mean(), growth.std()

# mean[r][i], std[r][i]
MEAN={r:[] for r in ROUNDS}; STD={r:[] for r in ROUNDS}
for r in ROUNDS:
    for p in PLAYERS:
        m,s = sim(p, TEAMS[p["nat"]][r]); MEAN[r].append(m); STD[r].append(s)

N=len(PLAYERS); price=[p["price"] for p in PLAYERS]
fee=[pr*10_000 for pr in price]                 # gebyr i kr ved koeb

# ===================== FAELLES FLERRUNDE-ILP ========================
prob=pulp.LpProblem("VM_plan",pulp.LpMaximize)
x={(r,i):pulp.LpVariable(f"x_{r}_{i}",cat="Binary") for r in ROUNDS for i in range(N)}
c={(r,i):pulp.LpVariable(f"c_{r}_{i}",cat="Binary") for r in ROUNDS for i in range(N)}
buy={(r,i):pulp.LpVariable(f"b_{r}_{i}",cat="Binary") for r in ROUNDS[1:] for i in range(N)}

obj=[]
for ri,r in enumerate(ROUNDS):
    w=ROUND_WEIGHTS[r]
    for i in range(N):
        obj.append(w*MEAN[r][i]*x[(r,i)])
        obj.append(w*MEAN[r][i]*(CAPTAIN_MULT-1)*c[(r,i)])
    # bankrente paa uforbrugt budget
    obj.append(BANK_RATE*1_000_000*(BUDGET_R[r] - pulp.lpSum(price[i]*x[(r,i)] for i in range(N))))
for r in ROUNDS[1:]:
    for i in range(N):
        obj.append(-fee[i]*buy[(r,i)])
prob += pulp.lpSum(obj)

for r in ROUNDS:
    prob += pulp.lpSum(x[(r,i)] for i in range(N))==11
    prob += pulp.lpSum(price[i]*x[(r,i)] for i in range(N))<=BUDGET_R[r]
    prob += pulp.lpSum(c[(r,i)] for i in range(N))==1
    for pos,(lo,hi) in FORMATION.items():
        idx=[i for i in range(N) if PLAYERS[i]["pos"]==pos]
        prob += pulp.lpSum(x[(r,i)] for i in idx)>=lo
        prob += pulp.lpSum(x[(r,i)] for i in idx)<=hi
    for i in range(N): prob += c[(r,i)]<=x[(r,i)]
for ri,r in enumerate(ROUNDS[1:],start=1):
    prev=ROUNDS[ri-1]
    for i in range(N):
        prob += buy[(r,i)] >= x[(r,i)]-x[(prev,i)]   # koebt hvis ind i runden
prob.solve(pulp.PULP_CBC_CMD(msg=0))

# ===================== RAPPORT =====================================
def k(v): return f"{v/1000:.0f}k"
order={"GK":0,"DEF":1,"MID":2,"ATT":3}
def squad(r): return sorted([i for i in range(N) if x[(r,i)].value()>0.5],
                            key=lambda i:(order[PLAYERS[i]["pos"]],-MEAN[r][i]))
def cap(r): return [i for i in range(N) if c[(r,i)].value()>0.5][0]

print("\n"+"#"*70)
print(f"#  VM MANAGER 2026 - OPTIMAL FLERRUNDE-PLAN  (R3 nedvaegtet {ROUND_WEIGHTS['R3']})")
print("#"*70)

cum_growth=0; cum_fee=0
prev=set()
for r in ROUNDS:
    s=squad(r); cp=cap(r); cur=set(s)
    ins=cur-prev if r!="R1" else cur
    outs=prev-cur if r!="R1" else set()
    counts={p:sum(1 for i in s if PLAYERS[i]["pos"]==p) for p in ["GK","DEF","MID","ATT"]}
    gross=sum(MEAN[r][i] for i in s)+MEAN[r][cp]*(CAPTAIN_MULT-1)
    rfee=sum(fee[i] for i in (ins if r!="R1" else set()))
    spend=sum(price[i] for i in s)
    interest=BANK_RATE*1_000_000*(BUDGET_R[r]-spend)
    net=gross-rfee+interest
    cum_growth+=gross; cum_fee+=rfee
    print(f"\n{'='*70}\n{r}  |  formation {counts['DEF']}-{counts['MID']}-{counts['ATT']}  |  "
          f"forbrug {spend:.1f}m  rest {BUDGET_R[r]-spend:.1f}m")
    print('='*70)
    print(f"{'Spiller':<15}{'Land':<11}{'Pos':<5}{'Pris':>5}{'Modst.':>13}{'Vaekst':>8}")
    print('-'*70)
    for i in s:
        tr=TEAMS[PLAYERS[i]['nat']][r]; star='  (C)' if i==cp else ''
        print(f"{PLAYERS[i]['name']:<15}{PLAYERS[i]['nat']:<11}{PLAYERS[i]['pos']:<5}"
              f"{price[i]:>4.1f}m{tr['opp']:>13}{k(MEAN[r][i]):>8}{star}")
    if r!="R1":
        print('-'*70)
        print(f"  IND : {', '.join(PLAYERS[i]['name'] for i in sorted(ins,key=lambda i:-MEAN[r][i])) or '-'}")
        print(f"  UD  : {', '.join(PLAYERS[i]['name'] for i in sorted(outs,key=lambda i:-MEAN[prev_r][i])) or '-'}")
        print(f"  Gebyr: {k(rfee)}  ({len(ins)} koeb)")
    print(f"  Kaptajn: {PLAYERS[cp]['name']}  |  brutto {k(gross)}  - gebyr {k(rfee)} "
          f"+ rente {k(interest)}  = NETTO {k(net)}")
    prev=cur; prev_r=r

print(f"\n{'#'*70}")
print(f"#  SAMLET (R1+R2+R3, vaegtet):  brutto {k(cum_growth)}  - gebyrer {k(cum_fee)} "
      f"= ~{(cum_growth-cum_fee)/1e6:.2f} mio. netto vaekst")
print(f"{'#'*70}")
