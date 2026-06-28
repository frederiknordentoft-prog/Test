#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Differential-finder (nr. 4/15 → skal hente feltet).

Bruger knockout-EV + ejerskab% (popularitet) til at finde LAV-EJEDE, HØJ-EV
spillere på stærk-mod-svag R32-kampe. Differential-score = EV × (1 - pop-vægt).
Anchorer de kendte R32-kampodds, så favoritternes mål-mu er realistiske.
"""
import sys, os, csv
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

# R32 match-odds anchors (favoritens forventede mål) — fra markedet
# Sverige lukkede 8 mål ind/3 kampe → Frankrig højt; Kap Verde bus → Argentina lavt.
MATCH_MU = {
    ("Frankrig","Sverige"):2.5, ("Argentina","Kap Verde"):1.9, ("Spanien","Østrig"):2.1,
    ("England","Congo DR"):2.6, ("Brasilien","Japan"):1.9, ("Colombia","Ghana"):1.5,
    ("Portugal","Kroatien"):1.4, ("Holland","Marokko"):1.6, ("Tyskland","Paraguay"):2.1,
    ("Belgien","Senegal"):1.3, ("USA","Bosnien-Hercegovina"):1.5, ("Mexico","Ecuador"):1.4,
    ("Schweiz","Algeriet"):1.3, ("Australien","Egypten"):1.2, ("Sydafrika","Canada"):1.2,
    ("Norge","Elfenbenskysten"):1.7,
}


def pop_lookup():
    pop={}
    with open(os.path.join(K.DATA,"stats_after_r3.csv"),encoding="utf-8-sig") as f:
        for r in csv.DictReader(f,delimiter=";"):
            try: pop[(r["Navn"].strip(),r["Hold"].strip())]=float(str(r["Popularitet %"]).replace(",","."))
            except: pass
    return pop


def main():
    ko = K.KO(K.load_title())
    # ankr R32-mål: justér modstander-rating så favoritens mu rammer markedet
    for _ in range(60):
        for (fav,opp),mu in MATCH_MU.items():
            if fav in ko.ix and opp in ko.ix:
                i,j=ko.ix[fav],ko.ix[opp]; cur,_=ko.mus(np.array([i]),np.array([j]))
                ko.R[j]-=0.5*(np.log(mu)-np.log(cur[0]))
    ko.simulate(K.N)
    players=K.load_players(); q=K.load_scorer_q(); pop=pop_lookup()
    POSW={"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}; byt={}
    for p in players: byt.setdefault(p["team"],[]).append(p)
    for tm,ps in byt.items():
        for p in ps: p["qw"]=q.get((p["name"],tm),0.0)
        # FORM-VÆGTNING: brug faktiske mål/assist + index oven i pris/pos
        base=np.array([POSW[p["pos"]]*(p["price"]**1.1)*(1+(p["goals"]+0.6*p["assists"])*0.5+p["index"]/100) for p in ps])
        gbw=np.array([p["qw"] for p in ps]); gbw=gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew=base/base.sum() if base.sum()>0 else gbw; share=0.55*gbw+0.45*basew
        for i,p in enumerate(ps):
            p["s_g"]=float(np.clip(share[i],0,0.6)); p["s_a"]=float(np.clip(0.5*share[i]+0.15*basew[i],0,0.5))
            p["p_start"]=0.92 if (p["qw"]>0.004 or p["price"]>=4.5 or p["goals"]>=1) else (0.8 if p["price"]>=3 else 0.65)
    for p in players:
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["R4","R5","R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); p["ev4"]=p["ev"]["R4"]
        t=ko.ix.get(p["team"]); p["pF"]=ko.reach["Final"][t] if t is not None else 0
        p["pop"]=pop.get((p["name"],p["team"]),0.0)
        # differential-score: EV vægtet ned med ejerskab (jo lavere pop, jo bedre edge)
        p["diff"]=p["ev_tot"]*(1.0/(1.0+p["pop"]/4.0))

    print("KAPTAJN-TJEK (R4-EV, mål-mu fra markedet):")
    for nm,tm in [("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina"),("Harry Kane","England")]:
        p=[x for x in players if x["name"]==nm and x["team"]==tm][0]
        print(f"  {nm:<16}{tm:<10}R4-EV {p['ev4']/1000:5.0f}k  (mod-mu {MATCH_MU.get((tm,[o for f,o in MATCH_MU if f==tm][0]),0)})")

    print("\nDIFFERENTIALS — lav ejerskab + høj EV, billige DEF/MID til frie slots (≤4,6m):")
    print(f"{'Spiller':<20}{'Hold':<11}{'Pos':<5}{'Pris':>5}{'Pop%':>6}{'EVtot':>7}{'EV/mio':>7}{'Fin%':>6}")
    R32OPP={"Argentina":"KapVerde","Frankrig":"Sverige","Spanien":"Østrig","England":"DRCongo",
            "Brasilien":"Japan","Colombia":"Ghana","Tyskland":"Paraguay","Holland":"Marokko","Norge":"ElfKyst"}
    cand=[p for p in players if not p["inj"] and p["pos"] in("DEF","MID") and 1.5<=p["price"]<=4.6
          and p["pF"]>0.10 and p["ev_tot"]>120_000 and p["team"] in R32OPP and p["pop"]<8
          and (p["index"]>20 or p["goals"]>0 or p["assists"]>0 or p["pos"]=="DEF")]
    seen=set()
    for p in sorted(cand,key=lambda x:-x["diff"]):
        if p["team"] in seen and len([1 for s in seen if s==p["team"]])>=2: pass
        print(f"{p['name']:<20}{p['team']:<11}{p['pos']:<5}{p['price']:4.1f}m{p['pop']:5.1f}%{p['ev_tot']/1000:6.0f}k"
              f"{p['ev_tot']/1000/max(p['price'],.1):6.0f}k{p['pF']*100:5.0f}%")
        seen.add(p["team"])
        if list(sorted(cand,key=lambda x:-x['diff'])).index(p)>=15: break

if __name__=="__main__":
    main()
