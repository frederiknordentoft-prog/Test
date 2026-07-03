#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R5-forberedelse: simulerer fra NUVÆRENDE bracket-tilstand (efter de fleste R32).

Kendte R32-resultater (28/6-1/7): Canada 1-0 Sydafrika · Brasilien 2-1 Japan ·
Paraguay slår Tyskland (straffe!) · Marokko slår Holland (straffe!) ·
Norge 2-1 Elfenbenskysten · Frankrig 3-0 Sverige · Mexico 2-0 Ecuador ·
England 2-1 Congo DR · USA 2-0 Bosnien.
Udestående R32: Spanien-Østrig, Portugal-Kroatien, Schweiz-Algeriet,
Australien-Egypten, Argentina-Kap Verde, Colombia-Ghana (simuleres betinget).

R16 (R5): Canada-Marokko · Paraguay-Frankrig · Brasilien-Norge · Mexico-England ·
W(Por/Kro)-W(Spa/Øst) · USA-Belgien · W(Arg/KV)-W(Aus/Egy) · W(Sch/Alg)-W(Col/Gha)
QF: (1v2)(3v4)(5v6)(7v8) · SF: (QF1vQF2)(QF3vQF4) · Finale.
"""
import sys, os, csv
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

N = 20000
B0 = np.log(1.30); CLIP = (0.18, 4.0)

# Friske titel-sandsynligheder (Kalshi/Polymarket/books, 2-3. juli)
TITLE = {"Frankrig":.335,"Argentina":.184,"Spanien":.118,"England":.09,"Brasilien":.08,
 "Portugal":.05,"Mexico":.026,"Belgien":.02,"Colombia":.02,"Marokko":.016,"Norge":.015,
 "USA":.015,"Kroatien":.009,"Schweiz":.008,"Østrig":.004,"Paraguay":.0045,"Canada":.004,
 "Egypten":.003,"Australien":.002,"Algeriet":.002,"Ghana":.002,"Kap Verde":.0006}

# Kamp-ankre (favorit, modstander, favorit-mu). Bus-effekt: Paraguay parkerede
# mod Tyskland (1-1 + straffe) → Frankrigs mål-mu dæmpes.
PENDING_R32 = [("Spanien","Østrig",2.1),("Portugal","Kroatien",1.5),
 ("Schweiz","Algeriet",1.3),("Australien","Egypten",1.25),
 ("Argentina","Kap Verde",1.9),("Colombia","Ghana",1.5)]
R16_MU = {("Frankrig","Paraguay"):1.9,("Brasilien","Norge"):1.7,("England","Mexico"):1.55,
 ("Marokko","Canada"):1.45,("Belgien","USA"):1.45,("Argentina","Australien"):2.1,
 ("Argentina","Egypten"):2.0,("Spanien","Portugal"):1.55,("Spanien","Kroatien"):1.7,
 ("Colombia","Schweiz"):1.45,("Colombia","Algeriet"):1.6}


class KO5:
    """Kompatibel med K.player_growth: .ix, .rounds, .reach."""
    def __init__(self):
        self.teams = sorted(TITLE)
        self.ix = {t: i for i, t in enumerate(self.teams)}
        tgt = np.array([TITLE[t] for t in self.teams]); tgt /= tgt.sum()
        self.R = 0.30*(np.log(tgt)-np.log(tgt).mean())
        # ankr kendte kampe
        for _ in range(60):
            for fav,opp,mu in PENDING_R32+[(a,b,m) for (a,b),m in R16_MU.items()]:
                i,j=self.ix[fav],self.ix[opp]
                cur=np.clip(np.exp(B0+self.R[i]-self.R[j]),*CLIP)
                self.R[j]-=0.4*(np.log(mu)-np.log(cur))
        self.rng = np.random.default_rng(11)

    def _tie(self, ia, ja, rec):
        la=np.clip(np.exp(B0+self.R[ia]-self.R[ja]),*CLIP)
        lb=np.clip(np.exp(B0+self.R[ja]-self.R[ia]),*CLIP)
        ga=self.rng.poisson(la); gb=self.rng.poisson(lb)
        lvl=ga==gb
        ga=ga+np.where(lvl,self.rng.poisson(la/3.0),0); gb=gb+np.where(lvl,self.rng.poisson(lb/3.0),0)
        still=ga==gb
        wa=(ga>gb)|(still&(self.rng.random(len(ia))<la/(la+lb)))
        if rec is not None:
            s=np.arange(len(ia))
            for arr,gf,gc,lf,sw in ((ia,ga,gb,la,still&wa),(ja,gb,ga,lb,still&~wa)):
                rec["played"][s,arr]=True; rec["gf"][s,arr]=gf; rec["ga"][s,arr]=gc
                rec["win"][s,arr]=gf>gc; rec["lam_a"][s,arr]=lf; rec["so"][s,arr]=sw
        return np.where(wa,ia,ja)

    def simulate(self, n=N):
        T=len(self.teams)
        mk=lambda: dict(played=np.zeros((n,T),bool),gf=np.zeros((n,T),np.int16),
                        ga=np.zeros((n,T),np.int16),win=np.zeros((n,T),bool),
                        so=np.zeros((n,T),bool),lam_a=np.zeros((n,T),np.float32))
        self.rounds={r:mk() for r in ["R4","R5","R6","R7"]}
        ix=self.ix; F=lambda t: np.full(n,ix[t])
        # udestående R32 (registreres i R4-slot for fuldstændighed)
        w={}
        for fav,opp,_ in PENDING_R32:
            w[fav+opp]=self._tie(F(fav),F(opp),self.rounds["R4"])
        # R16 (R5)
        r16=[]
        r16.append(self._tie(F("Canada"),F("Marokko"),self.rounds["R5"]))
        r16.append(self._tie(F("Paraguay"),F("Frankrig"),self.rounds["R5"]))
        r16.append(self._tie(F("Brasilien"),F("Norge"),self.rounds["R5"]))
        r16.append(self._tie(F("Mexico"),F("England"),self.rounds["R5"]))
        r16.append(self._tie(w["PortugalKroatien"],w["SpanienØstrig"],self.rounds["R5"]))
        r16.append(self._tie(F("USA"),F("Belgien"),self.rounds["R5"]))
        r16.append(self._tie(w["ArgentinaKap Verde"],w["AustralienEgypten"],self.rounds["R5"]))
        r16.append(self._tie(w["SchweizAlgeriet"],w["ColombiaGhana"],self.rounds["R5"]))
        # QF (R6)
        qf=[self._tie(r16[0],r16[1],self.rounds["R6"]),self._tie(r16[2],r16[3],self.rounds["R6"]),
            self._tie(r16[4],r16[5],self.rounds["R6"]),self._tie(r16[6],r16[7],self.rounds["R6"])]
        # SF+F (R7)
        sf1=self._tie(qf[0],qf[1],self.rounds["R7"]); sf2=self._tie(qf[2],qf[3],self.rounds["R7"])
        l1=np.where(sf1==qf[0],qf[1],qf[0]); l2=np.where(sf2==qf[2],qf[3],qf[2])
        champ=self._tie(sf1,sf2,self.rounds["R7"]); self._tie(l1,l2,self.rounds["R7"])
        self.reach={"R5":self.rounds["R5"]["played"].mean(0),"QF":self.rounds["R6"]["played"].mean(0),
                    "SF":self.rounds["R7"]["played"].mean(0),
                    "Final":np.bincount(np.concatenate([sf1,sf2]),minlength=T)/n,
                    "Champ":np.bincount(champ,minlength=T)/n}
        return self


def main():
    ko=KO5(); ko.simulate()
    players=K.load_players(); q=K.load_scorer_q()
    POSW={"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}; byt={}
    for p in players:
        if p["team"] in ko.ix: byt.setdefault(p["team"],[]).append(p)
    for tm,ps in byt.items():
        for p in ps: p["qw"]=q.get((p["name"],tm),0.0)
        base=np.array([POSW[p["pos"]]*(p["price"]**1.1)*(1+(p["goals"]+0.6*p["assists"])*0.5+max(p["index"],0)/100) for p in ps])
        gbw=np.array([p["qw"] for p in ps]); gbw=gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew=base/base.sum() if base.sum()>0 else gbw; share=0.55*gbw+0.45*basew
        for i,p in enumerate(ps):
            p["s_g"]=float(np.clip(share[i],0,0.6)); p["s_a"]=float(np.clip(0.5*share[i]+0.15*basew[i],0,0.5))
            p["p_start"]=0.92 if (p["qw"]>0.004 or p["price"]>=4.5 or p["goals"]>=1) else (0.8 if p["price"]>=3 else 0.65)
    for p in players:
        if p["team"] not in ko.ix:
            p["ev"]={r:0 for r in ["R5","R6","R7"]}; p["pF"]=0; p["ev_tot"]=0; continue
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["R5","R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); p["pF"]=ko.reach["Final"][ko.ix[p["team"]]]

    print("="*80); print(f"R5-SIM ({N:,} forløb fra aktuel bracket) — P(runde) pr. hold"); print("="*80)
    print(f"{'Hold':<12}{'QF%':>6}{'SF%':>6}{'Fin%':>7}{'Titel%':>8}   R16-modstander")
    R16OPP={"Frankrig":"Paraguay (bus!)","Argentina":"Australien/Egypten","Spanien":"Portugal/Kroatien",
     "Brasilien":"Norge","England":"Mexico","Norge":"Brasilien","Marokko":"Canada","Canada":"Marokko",
     "USA":"Belgien","Colombia":"Schweiz/Algeriet","Mexico":"England","Portugal":"Spanien/Østrig","Belgien":"USA"}
    for t in ["Frankrig","Argentina","Spanien","England","Brasilien","Marokko","Colombia","USA","Norge","Canada","Mexico","Portugal"]:
        i=ko.ix[t]
        print(f"{t:<12}{ko.reach['QF'][i]*100:5.0f}%{ko.reach['SF'][i]*100:5.0f}%{ko.reach['Final'][i]*100:6.0f}%{ko.reach['Champ'][i]*100:7.1f}%   {R16OPP.get(t,'')}")

    mine=["Unai Simon","Douglas Santos","Luc De Fougerolles","Facundo Medina","Antonee Robinson",
          "Aurelien Tchouameni","Jhon Arias","Ismael Saibari","Mikel Oyarzabal","Kylian Mbappe","Erling Haaland"]
    print("\n"+"="*80); print("DIT HOLD — forventet vækst R5/R6/R7 + P(finale)"); print("="*80)
    print(f"{'Spiller':<20}{'Hold':<11}{'R5':>7}{'R6':>7}{'R7':>7}{'TOT':>8}{'Fin%':>6}")
    for nm in mine:
        p=next((x for x in players if x["name"]==nm),None)
        if p is None: continue
        print(f"{nm:<20}{p['team']:<11}"+"".join(f"{p['ev'][r]/1000:6.0f}k" for r in ["R5","R6","R7"])+f"{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

    print("\n"+"="*80); print("KAPTAJN-KANDIDATER R5"); print("="*80)
    for nm,tm in [("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina"),("Harry Kane","England"),
                  ("Lautaro Martinez","Argentina"),("Julian Alvarez","Argentina"),("Mikel Oyarzabal","Spanien")]:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: print(f"  {nm:<18}{tm:<10}R5-EV {p['ev']['R5']/1000:5.0f}k  (R16: {R16OPP.get(tm,'?')})")

    print("\n"+"="*80); print("TOP KØBSKANDIDATER (R5-R7 EV, aktive)"); print("="*80)
    cand=sorted([p for p in players if not p["inj"] and p["ev_tot"]>150_000],key=lambda x:-x["ev_tot"])[:18]
    print(f"{'Spiller':<20}{'Hold':<11}{'Pos':<5}{'Pris':>5}{'R5':>7}{'TOT':>8}{'Fin%':>6}")
    for p in cand:
        print(f"{p['name']:<20}{p['team']:<11}{p['pos']:<5}{p['price']:4.1f}m{p['ev']['R5']/1000:6.0f}k{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

if __name__=="__main__":
    main()
