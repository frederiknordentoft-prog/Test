#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R4-finalizer: positions-huller + fee-bevidst transfer-optimering (bank-låst).

Beholder kernen, sælger Marokko-trioen, optimerer 1 DEF + 2 MID under reel bank
(0,32m + salgsprovenu) MINUS 1% transfergebyr. Bruger fremadskuende EV fra
knockout-simulatoren. Markerer positions-huller (DEF/MID der scorer som angreb).
"""
import sys, os
import numpy as np, pulp
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

BANK = 0.319965
# nuværende salgsværdier (fra app/CSV)
OWN_VAL = {"Unai Simon":5.376,"Chadi Riad":2.222,"Douglas Santos":2.718,
 "Luc De Fougerolles":2.119,"Aurelien Tchouameni":3.653,"Ismael Saibari":4.115,
 "Jhon Arias":3.128,"Mikel Oyarzabal":7.979,"Kylian Mbappe":10.913,
 "Lionel Messi":9.152,"Azzedine Ounahi":3.056}
SELL = ["Chadi Riad","Ismael Saibari","Azzedine Ounahi"]   # Marokko (1% finale)
KEEP = [n for n in OWN_VAL if n not in SELL]               # 8 spillere beholdes

# holdet-position pr. spiller (fra prices.csv) — til positions-hul-detektion
def holdet_pos():
    import csv
    pos={}
    with open(os.path.join(K.DATA,"prices.csv"),encoding="utf-8") as f:
        for r in csv.DictReader(f,delimiter=";"):
            pos[(r["Navn"].strip(),r["Hold"].strip())]={"Keeper":"GK","Forsvar":"DEF",
              "Midtbane":"MID","Angreb":"ATT"}.get(r["Position"].strip(),"?")
    return pos


def main():
    ko = K.KO(K.load_title()); ko.simulate(K.N)
    players = K.load_players(); q = K.load_scorer_q()
    # målandele (samme logik som knockout.main)
    POSW={"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}; byt={}
    for p in players: byt.setdefault(p["team"],[]).append(p)
    for tm,ps in byt.items():
        for p in ps: p["qw"]=q.get((p["name"],tm),0.0)
        base=np.array([POSW[p["pos"]]*(p["price"]**1.3)*(1+p["index"]/120) for p in ps])
        gbw=np.array([p["qw"] for p in ps]); gbw=gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew=base/base.sum() if base.sum()>0 else gbw; share=0.6*gbw+0.4*basew
        for i,p in enumerate(ps):
            p["s_g"]=float(np.clip(share[i],0,0.6)); p["s_a"]=float(np.clip(0.55*share[i]+0.15*basew[i],0,0.5))
            p["p_start"]=0.92 if (p["qw"]>0.004 or p["price"]>=4.5) else (0.82 if p["price"]>=3 else 0.7)
    for p in players:
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["R4","R5","R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); t=ko.ix.get(p["team"]); p["pF"]=ko.reach["Final"][t] if t is not None else 0
        p["starter"]= (p["index"]>22 or p["goals"]>0 or p["assists"]>0)  # proxy for regelmæssig starter

    # ---- POSITIONS-HULLER: holdet-pos lavere end reel angrebsrolle ----
    hp=holdet_pos()
    print("="*80); print("POSITIONS-HULLER (DEF/MID med angrebsoutput — scorer i billig position)"); print("="*80)
    holes=[]
    for p in players:
        if p["inj"] or not p["starter"]: continue
        hpos=hp.get((p["name"],p["team"]),p["pos"])
        att=p["goals"]+0.7*p["assists"]
        # hul = klassificeret DEF/MID men har reelt angrebsoutput (mål+assist højt)
        if hpos in("DEF","MID") and att>=2 and p["s_g"]>=0.12:
            holes.append((p["s_g"],p,hpos))
    print(f"{'Spiller':<20}{'Hold':<11}{'Holdet-pos':<10}{'Mål':>4}{'Ast':>4}{'Pris':>6}{'Fin%':>6}")
    for s,p,hpos in sorted(holes,key=lambda x:-x[0])[:14]:
        akt="✓" if ko.ix.get(p["team"]) is not None else ""
        print(f"{p['name']:<20}{p['team']:<11}{hpos:<10}{int(p['goals']):>4}{int(p['assists']):>4}{p['price']:5.1f}m{p['pF']*100:5.0f}%")

    # ---- FEE-BEVIDST OPTIMERING af 3 køb (1 DEF + 2 MID) ----
    budget = BANK + sum(OWN_VAL[n] for n in SELL)    # ~8.86m til 3 køb
    pool=[p for p in players if not p["inj"] and p["starter"] and p["name"] not in OWN_VAL
          and p["pos"] in("DEF","MID") and p["price"]>0]
    M=len(pool); pr=pulp.LpProblem("r4",pulp.LpMaximize)
    x={i:pulp.LpVariable(f"x{i}",cat="Binary") for i in range(M)}
    # objektiv: EV(tot) - 1% gebyr;  (kaptajn håndteres separat = Messi)
    pr += pulp.lpSum((pool[i]["ev_tot"]-0.01*pool[i]["price"]*1e6)*x[i] for i in range(M))
    pr += pulp.lpSum(pool[i]["price"]*1.01*x[i] for i in range(M)) <= budget
    pr += pulp.lpSum(x[i] for i in range(M))==3
    # kerne har DEF2,MID2 -> køb DEF_add+MID_add=3, hver i [1,3] (lovlig 4-3-3 el. 3-4-3)
    pr += pulp.lpSum(x[i] for i in range(M) if pool[i]["pos"]=="DEF")>=1
    pr += pulp.lpSum(x[i] for i in range(M) if pool[i]["pos"]=="DEF")<=3
    pr += pulp.lpSum(x[i] for i in range(M) if pool[i]["pos"]=="MID")>=1
    # nationsgrænse: Messi er Argentina (1) -> max 3 nye Argentina; generelt max 4 totalt
    keepnat={}
    for n in KEEP:
        tm=[p["team"] for p in players if p["name"]==n][0]; keepnat[tm]=keepnat.get(tm,0)+1
    for tm in set(p["team"] for p in pool):
        cap=4-keepnat.get(tm,0)
        pr += pulp.lpSum(x[i] for i in range(M) if pool[i]["team"]==tm)<=max(cap,0)
    pr.solve(pulp.PULP_CBC_CMD(msg=0))
    buys=[pool[i] for i in range(M) if x[i].value() and x[i].value()>0.5]
    spend=sum(b["price"]*1.01 for b in buys)
    print("\n"+"="*80); print(f"R4-KØB (fee-bevidst, bank {BANK:.2f}m + Marokko-salg {sum(OWN_VAL[n] for n in SELL):.2f}m = {budget:.2f}m)"); print("="*80)
    for b in buys:
        hpos=hp.get((b["name"],b["team"]),b["pos"]); hole=" ⟵ HUL" if (hpos!=b["pos"]) else ""
        print(f"  KØB {b['pos']:<4}{b['name']:<20}{b['team']:<11}{b['price']:4.1f}m  EV {b['ev_tot']/1000:5.0f}k  Fin {b['pF']*100:3.0f}%{hole}")
    print(f"  forbrug {spend:.2f}m (incl. gebyr)  ·  rest {budget-spend:.2f}m")
    print(f"  SÆLG: {', '.join(SELL)}")
    # samlet R4-EV for det nye hold (kerne + køb), kaptajn Messi
    newxi=[p for p in players if p["name"] in KEEP]+buys
    r4=sum(p["ev"]["R4"] for p in newxi)
    messi=[p for p in players if p["name"]=="Lionel Messi"][0]
    print(f"\n  Kaptajn: Messi (R4-EV {messi['ev']['R4']/1000:.0f}k → +{messi['ev']['R4']/1000:.0f}k bonus)")
    print(f"  Forventet R4-vækst (nyt hold + kaptajn): {(r4+messi['ev']['R4'])/1e6:.2f}m")

if __name__=="__main__":
    main()
