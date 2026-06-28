#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R4-tabeller: anbefalet hold + udskiftninger + forventet værdi (anchored)."""
import sys, os, csv
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K
from diff_finder import MATCH_MU  # genbrug kampodds-ankre

def setup():
    ko=K.KO(K.load_title())
    for _ in range(60):
        for (fav,opp),mu in MATCH_MU.items():
            if fav in ko.ix and opp in ko.ix:
                i,j=ko.ix[fav],ko.ix[opp]; cur,_=ko.mus(np.array([i]),np.array([j]))
                ko.R[j]-=0.5*(np.log(mu)-np.log(cur[0]))
    ko.simulate(K.N)
    players=K.load_players(); q=K.load_scorer_q()
    POSW={"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}; byt={}
    for p in players: byt.setdefault(p["team"],[]).append(p)
    for tm,ps in byt.items():
        for p in ps: p["qw"]=q.get((p["name"],tm),0.0)
        base=np.array([POSW[p["pos"]]*(p["price"]**1.1)*(1+(p["goals"]+0.6*p["assists"])*0.5+p["index"]/100) for p in ps])
        gbw=np.array([p["qw"] for p in ps]); gbw=gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew=base/base.sum() if base.sum()>0 else gbw; share=0.55*gbw+0.45*basew
        for i,p in enumerate(ps):
            p["s_g"]=float(np.clip(share[i],0,0.6)); p["s_a"]=float(np.clip(0.5*share[i]+0.15*basew[i],0,0.5))
            p["p_start"]=0.92 if (p["qw"]>0.004 or p["price"]>=4.5 or p["goals"]>=1) else (0.8 if p["price"]>=3 else 0.65)
    for p in players:
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in["R4","R5","R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); t=ko.ix.get(p["team"]); p["pF"]=ko.reach["Final"][t] if t is not None else 0
    return ko,{(p["name"]):p for p in players}

def g(pl,name):
    return pl.get(name,{"ev":{"R4":0},"ev_tot":0,"pF":0,"price":0,"team":"?","pos":"?"})

ko,pl=setup()
R32={"Spanien":"Østrig","Argentina":"KapVerde","Frankrig":"Sverige","Brasilien":"Japan",
     "Canada":"Sydafrika","Colombia":"Ghana","Norge":"ElfKyst"}

# R4-hold: BEHOLD Haaland (skift til Messi før R5). Billig mid = pladsholder.
XI=[("Unai Simon","GK"),("Nicolas Otamendi","DEF"),("Lisandro Martinez","DEF"),
    ("Douglas Santos","DEF"),("Luc De Fougerolles","DEF"),("Aurelien Tchouameni","MID"),
    ("Jhon Arias","MID"),("billig mid","MID"),("Mikel Oyarzabal","ATT"),
    ("Kylian Mbappe","ATT*C"),("Erling Haaland","ATT")]
R5OPP={"Spanien":"Portugal/Kroatien","Argentina":"Australien/Egypten","Frankrig":"Tyskland",
       "Brasilien":"Norge/Elfenbenskyst","Colombia":"Schweiz/Algeriet","Canada":"Holland/Marokko",
       "Norge":"Brasilien"}
print("="*78); print("R4-HOLD (4-3-3) — BEHOLD Haaland, kaptajn Mbappe"); print("="*78)
print(f"{'Spiller':<20}{'Hold':<10}{'Pos':<6}{'R4-EV':>7}{'Fin%':>6}")
tot4=0; cap=None
for nm,pos in XI:
    p=g(pl,nm); ev4=(p['ev']['R4'] if nm!='billig mid' else 30000); tot4+=ev4
    if "C" in pos: cap=p
    print(f"{nm:<20}{p['team']:<10}{pos:<6}{ev4/1000:6.0f}k{p['pF']*100:5.0f}%")
print("-"*78)
print(f"Sum R4-EV: {tot4/1000:.0f}k  + kaptajnbonus Mbappe {cap['ev']['R4']/1000:.0f}k  => R4 i alt ~{(tot4+cap['ev']['R4'])/1e6:.2f}m")
print(f"UDSKIFT R4: SÆLG Riad+Ounahi+Saibari → KØB Otamendi+L.Martinez+billig mid")

print("\n"+"="*78); print("R5-FORVENTNINGER (1/8-finaler) — efter Haaland→Messi-byttet"); print("="*78)
print(f"{'Spiller':<20}{'Hold':<10}{'sandsynlig R5-modst.':<20}{'R5-EV':>7}{'Fin%':>6}")
R5XI=[("Unai Simon","Spanien"),("Nicolas Otamendi","Argentina"),("Lisandro Martinez","Argentina"),
      ("Douglas Santos","Brasilien"),("Aurelien Tchouameni","Frankrig"),("Jhon Arias","Colombia"),
      ("Mikel Oyarzabal","Spanien"),("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina")]
for nm,tm in R5XI:
    p=g(pl,nm)
    print(f"{nm:<20}{tm:<10}{R5OPP.get(tm,'?'):<20}{p['ev']['R5']/1000:6.0f}k{p['pF']*100:5.0f}%")
print("-"*78)
mb=g(pl,"Kylian Mbappe"); me=g(pl,"Lionel Messi")
print(f"R5-KAPTAJN: Messi (mod Australien/Egypten, R5-EV {me['ev']['R5']/1000:.0f}k) > Mbappe (mod Tyskland, {mb['ev']['R5']/1000:.0f}k)")

print("\n"+"="*78); print("HAALAND vs MESSI (begrunder byttet før R5)"); print("="*78)
for nm in ["Erling Haaland","Lionel Messi"]:
    p=g(pl,nm)
    print(f"{nm:<16}{p['team']:<10}R4-EV {p['ev']['R4']/1000:5.0f}k  R5-EV {p['ev']['R5']/1000:5.0f}k  R4-7 {p['ev_tot']/1000:5.0f}k  Fin {p['pF']*100:3.0f}%")
