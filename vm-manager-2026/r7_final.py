#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R7 FINAL: semifinaler + bronzekamp + finale (14.-19. juli) — SIDSTE RUNDE.

SF1 Frankrig-Spanien (14/7): FRA +135 / X +210 / ESP +210; advance FRA -150.
SF2 England-Argentina (15/7): ENG +165 / X +190 / ARG +200; advance ENG -122.
Titelodds: FRA +150 (~40%), ESP +310 (~24%), ENG ~19%, ARG ~17%.
ALLE 4 hold spiller 2 kampe i R7 (SF + finale ELLER bronzekamp).

Bold-opstillinger (13/7):
  FRA: Maignan; Kounde, Saliba, Upamecano, Digne; Rabiot, TCHOUAMENI (L'Equipe:
       starter for KONÉ!); Dembele, Olise, Doué; Mbappe. Barcola/Koné = indhop.
  ESP: Simon; Porro, Cubarsi, Laporte, Cucurella; Rodri, F.RUIZ, Olmo (PEDRI
       droppet); Yamal, Oyarzabal, Baena-risiko.
  ENG: Pickford; JAMES (ind for Spence!), Konsa, Guehi, O'Reilly; Anderson,
       Rice (syg, starter hvis klar), Bellingham; Saka?, Kane, Gordon.
  ARG: E.Martinez; Molina, Romero, L.Martinez, Tagliafico; Paredes, De Paul,
       Mac Allister, Enzo (4-4-2); Messi, Alvarez. Medina/Lautaro bænk.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

N = 20000
B0 = np.log(1.30); CLIP = (0.18, 4.0)

TITLE = {"Frankrig":.40,"Spanien":.245,"England":.19,"Argentina":.165}

# (hjemme, ude, mu_h, mu_u) — semifinaler fra 1X2 + totals 2.5
SFM = [("Frankrig","Spanien",1.35,1.05),
       ("England","Argentina",1.15,1.05)]

PSTART = {
 # Frankrig
 ("Mike Maignan","Frankrig"):0.95,("Kylian Mbappe","Frankrig"):0.95,
 ("Ousmane Dembele","Frankrig"):0.95,("Adrien Rabiot","Frankrig"):0.92,
 ("Jules Kounde","Frankrig"):0.92,("William Saliba","Frankrig"):0.92,
 ("Dayot Upamecano","Frankrig"):0.92,("Lucas Digne","Frankrig"):0.90,
 ("Aurelien Tchouameni","Frankrig"):0.75,("Manu Koné","Frankrig"):0.35,
 ("Michael Olise","Frankrig"):0.90,("Desire Doue","Frankrig"):0.70,
 ("Bradley Barcola","Frankrig"):0.30,
 # Spanien
 ("Unai Simon","Spanien"):0.92,("Pedro Porro","Spanien"):0.90,
 ("Pau Cubarsi","Spanien"):0.90,("Aymeric Laporte","Spanien"):0.90,
 ("Marc Cucurella","Spanien"):0.90,("Fabian Ruiz","Spanien"):0.85,
 ("Dani Olmo","Spanien"):0.85,("Pedri","Spanien"):0.40,
 ("Alex Baena","Spanien"):0.40,("Lamine Yamal","Spanien"):0.95,
 ("Mikel Oyarzabal","Spanien"):0.92,
 # England
 ("Jordan Pickford","England"):0.92,("Reece James","England"):0.75,
 ("Ezri Konsa","England"):0.90,("Marc Guehi","England"):0.85,
 ("Nico O'Reilly","England"):0.88,("Djed Spence","England"):0.30,
 ("Declan Rice","England"):0.85,("Elliot Anderson","England"):0.85,
 ("Jude Bellingham","England"):0.92,("Harry Kane","England"):0.95,
 ("Anthony Gordon","England"):0.85,("Bukayo Saka","England"):0.55,
 ("Eberechi Eze","England"):0.15,("Noni Madueke","England"):0.50,
 ("Ollie Watkins","England"):0.15,
 # Argentina
 ("Emiliano Martinez","Argentina"):0.92,("Nahuel Molina","Argentina"):0.90,
 ("Cristian Romero","Argentina"):0.92,("Nicolas Tagliafico","Argentina"):0.88,
 ("Leandro Paredes","Argentina"):0.88,("Rodrigo de Paul","Argentina"):0.90,
 ("Alexis Mac Allister","Argentina"):0.90,("Enzo Fernandez","Argentina"):0.90,
 ("Lionel Messi","Argentina"):0.95,("Julian Alvarez","Argentina"):0.92,
 ("Facundo Medina","Argentina"):0.15,("Lautaro Martinez","Argentina"):0.25,
}
INJ_CLEAR = {("William Saliba","Frankrig"),("Cristian Romero","Argentina"),
             ("Reece James","England"),("Aurelien Tchouameni","Frankrig")}


class KO7:
    """SF + finale/bronze. To rekorder: 'SF' og 'M2' — hvert hold spiller 1 kamp i hver."""
    def __init__(self):
        self.teams=sorted(TITLE); self.ix={t:i for i,t in enumerate(self.teams)}
        tgt=np.array([TITLE[t] for t in self.teams]); tgt/=tgt.sum()
        self.R=0.32*(np.log(tgt)-np.log(tgt).mean())
        for _ in range(80):
            for h,a,mh,ma in SFM:
                i,j=self.ix[h],self.ix[a]
                ch=np.clip(np.exp(B0+self.R[i]-self.R[j]),*CLIP)
                ca=np.clip(np.exp(B0+self.R[j]-self.R[i]),*CLIP)
                d=0.25*((np.log(mh)-np.log(ch))-(np.log(ma)-np.log(ca)))/2
                self.R[i]+=d; self.R[j]-=d
        self.rng=np.random.default_rng(77)

    def _tie(self, ia, ja, rec, mus=None):
        if mus is None:
            la=np.clip(np.exp(B0+self.R[ia]-self.R[ja]),*CLIP)
            lb=np.clip(np.exp(B0+self.R[ja]-self.R[ia]),*CLIP)
        else:
            la,lb=mus
        ga=self.rng.poisson(la,size=len(ia)) if np.isscalar(la) else self.rng.poisson(la)
        gb=self.rng.poisson(lb,size=len(ja)) if np.isscalar(lb) else self.rng.poisson(lb)
        lvl=ga==gb
        ga=ga+np.where(lvl,self.rng.poisson(la/3.0 if np.isscalar(la) else la/3.0,size=len(ia)),0)
        gb=gb+np.where(lvl,self.rng.poisson(lb/3.0 if np.isscalar(lb) else lb/3.0,size=len(ja)),0)
        still=ga==gb
        pa=la/(la+lb)
        wa=(ga>gb)|(still&(self.rng.random(len(ia))<pa))
        s=np.arange(len(ia))
        for arr,gf,gc,lf,sw in ((ia,ga,gb,lb if np.isscalar(lb) else lb,still&wa),(ja,gb,ga,la if np.isscalar(la) else la,still&~wa)):
            rec["played"][s,arr]=True; rec["gf"][s,arr]=gf; rec["ga"][s,arr]=gc
            rec["win"][s,arr]=gf>gc; rec["lam_a"][s,arr]=lf; rec["so"][s,arr]=sw
        return np.where(wa,ia,ja)

    def simulate(self,n=N):
        T=len(self.teams)
        mk=lambda: dict(played=np.zeros((n,T),bool),gf=np.zeros((n,T),np.int16),
            ga=np.zeros((n,T),np.int16),win=np.zeros((n,T),bool),
            so=np.zeros((n,T),bool),lam_a=np.zeros((n,T),np.float32))
        self.rounds={r:mk() for r in ["SF","M2"]}
        F=lambda t: np.full(n,self.ix[t])
        sf=[]
        for h,a,mh,ma in SFM:
            sf.append(self._tie(F(h),F(a),self.rounds["SF"],mus=(np.full(n,mh),np.full(n,ma))))
        l1=np.where(sf[0]==F(SFM[0][0]),F(SFM[0][1])[0]*np.ones(n,int),F(SFM[0][0])[0]*np.ones(n,int))
        l1=np.where(sf[0]==self.ix[SFM[0][0]],self.ix[SFM[0][1]],self.ix[SFM[0][0]])
        l2=np.where(sf[1]==self.ix[SFM[1][0]],self.ix[SFM[1][1]],self.ix[SFM[1][0]])
        champ=self._tie(sf[0],sf[1],self.rounds["M2"])          # finale
        self._tie(l1,l2,self.rounds["M2"])                       # bronzekamp
        self.reach={"Final":np.bincount(np.concatenate([sf[0],sf[1]]),minlength=T)/n,
                    "Champ":np.bincount(champ,minlength=T)/n}
        return self


def main():
    ko=KO7(); ko.simulate()
    players=K.load_players(); q=K.load_scorer_q()
    POSW={"GK":0.01,"DEF":0.30,"MID":1.0,"ATT":2.3}; byt={}
    for p in players:
        if (p["name"],p["team"]) in INJ_CLEAR: p["inj"]=False
        if p["team"] in ko.ix: byt.setdefault(p["team"],[]).append(p)
    for tm,ps in byt.items():
        for p in ps: p["qw"]=q.get((p["name"],tm),0.0)
        base=np.array([POSW[p["pos"]]*(p["price"]**1.1)*(1+(p["goals"]+0.6*p["assists"])*0.5+max(p["index"],0)/100) for p in ps])
        gbw=np.array([p["qw"] for p in ps]); gbw=gbw/gbw.sum() if gbw.sum()>0 else base/base.sum()
        basew=base/base.sum() if base.sum()>0 else gbw; share=0.55*gbw+0.45*basew
        for i,p in enumerate(ps):
            p["s_g"]=float(np.clip(share[i],0,0.6)); p["s_a"]=float(np.clip(0.5*share[i]+0.15*basew[i],0,0.5))
            ov=PSTART.get((p["name"],tm))
            p["p_start"]=ov if ov is not None else (0.90 if (p["qw"]>0.004 or p["price"]>=4.5 or p["goals"]>=1) else (0.8 if p["price"]>=3 else 0.65))
    for p in players:
        if p["team"] not in ko.ix:
            p["ev"]={r:0 for r in["SF","M2"]}; p["ev_tot"]=0; p["pF"]=0; continue
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["SF","M2"]}
        p["ev_tot"]=sum(p["ev"].values()); p["pF"]=ko.reach["Final"][ko.ix[p["team"]]]

    print("="*80); print("HOLD-SANDSYNLIGHEDER (SF-odds 13-14/7)"); print("="*80)
    print(f"{'Hold':<11}{'Finale%':>8}{'Titel%':>8}")
    for t in sorted(ko.teams,key=lambda t:-ko.reach["Champ"][ko.ix[t]]):
        i=ko.ix[t]; print(f"{t:<11}{ko.reach['Final'][i]*100:7.0f}%{ko.reach['Champ'][i]*100:7.1f}%")

    OWN=[("Mike Maignan","Frankrig"),("Jules Kounde","Frankrig"),("Lucas Digne","Frankrig"),
         ("Djed Spence","England"),("Adrien Rabiot","Frankrig"),("Manu Koné","Frankrig"),
         ("Ousmane Dembele","Frankrig"),("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina")]
    print("\n"+"="*80); print("DIT HOLD — EV semifinale + finale/bronze (2 kampe)"); print("="*80)
    print(f"{'Spiller':<20}{'Hold':<10}{'SF':>7}{'M2':>7}{'TOT':>8}{'Fin%':>6}")
    for nm,tm in OWN:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: print(f"{nm:<20}{tm:<10}"+"".join(f"{p['ev'][r]/1000:6.0f}k" for r in["SF","M2"])+f"{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

    print("\n"+"="*80); print("KØBS-/SWAP-KANDIDATER (pris = R3-snapshot)"); print("="*80)
    CAND=[("Aurelien Tchouameni","Frankrig"),("William Saliba","Frankrig"),("Dayot Upamecano","Frankrig"),
          ("Michael Olise","Frankrig"),("Desire Doue","Frankrig"),("Bradley Barcola","Frankrig"),
          ("Reece James","England"),("Nico O'Reilly","England"),("Ezri Konsa","England"),
          ("Marc Guehi","England"),("Elliot Anderson","England"),("Declan Rice","England"),
          ("Jude Bellingham","England"),("Harry Kane","England"),("Anthony Gordon","England"),
          ("Eberechi Eze","England"),("Noni Madueke","England"),
          ("Pedro Porro","Spanien"),("Pau Cubarsi","Spanien"),("Aymeric Laporte","Spanien"),
          ("Marc Cucurella","Spanien"),("Fabian Ruiz","Spanien"),("Dani Olmo","Spanien"),
          ("Lamine Yamal","Spanien"),("Mikel Oyarzabal","Spanien"),
          ("Nahuel Molina","Argentina"),("Cristian Romero","Argentina"),("Nicolas Tagliafico","Argentina"),
          ("Rodrigo de Paul","Argentina"),("Alexis Mac Allister","Argentina"),("Enzo Fernandez","Argentina"),
          ("Julian Alvarez","Argentina")]
    print(f"{'Spiller':<20}{'Hold':<10}{'Pos':<5}{'PrisR3':>7}{'SF':>7}{'M2':>7}{'TOT':>8}")
    rows=[]
    for nm,tm in CAND:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: rows.append(p)
    for p in sorted(rows,key=lambda x:-x["ev_tot"]):
        print(f"{p['name']:<20}{p['team']:<10}{p['pos']:<5}{p['price']:6.2f}m{p['ev']['SF']/1000:6.0f}k{p['ev']['M2']/1000:6.0f}k{p['ev_tot']/1000:7.0f}k")

if __name__=="__main__":
    main()
