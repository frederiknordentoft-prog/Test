#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R5 FINAL: bekræftede R16-kampe + Bold-opstillinger (4/7) + fee-bevidst plan.

R16: Canada-Marokko · Paraguay-Frankrig · Brasilien-Norge · Mexico-England ·
Portugal-Spanien · USA-Belgien · Argentina-Egypten · Schweiz-Colombia.
Bold-status: Tchouameni UDE af Frankrigs XI (4-2-4) · Spence bænk-risiko ·
Medina gul (baglår, Tagliafico backup) · Saibari/Arias/Robinson/Kane/Messi grønne.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

N = 20000
B0 = np.log(1.30); CLIP = (0.18, 4.0)

TITLE = {"Frankrig":.36,"Argentina":.20,"Spanien":.10,"England":.10,"Brasilien":.09,
 "Portugal":.055,"Mexico":.025,"Belgien":.02,"Colombia":.022,"Marokko":.018,"Norge":.014,
 "USA":.014,"Schweiz":.008,"Paraguay":.004,"Canada":.004,"Egypten":.003}

# (hjemme, ude, mu_h, mu_u) — R16, markeds-/formbaseret. Paraguay=bus, Egypten svag.
R16 = [("Canada","Marokko",1.0,1.45),("Paraguay","Frankrig",0.55,1.95),
       ("Brasilien","Norge",1.75,1.0),("Mexico","England",0.95,1.55),
       ("Portugal","Spanien",1.2,1.5),("USA","Belgien",1.15,1.4),
       ("Argentina","Egypten",2.05,0.5),("Schweiz","Colombia",1.05,1.35)]
QF = [(0,1),(2,3),(4,5),(6,7)]; SF=[(0,1),(2,3)]

# Bold-opstillinger 4/7 → p_start-overrides
PSTART = {("Aurelien Tchouameni","Frankrig"):0.10,("Djed Spence","England"):0.15,
 ("Facundo Medina","Argentina"):0.50,("Ismael Saibari","Marokko"):0.92,
 ("Jhon Arias","Colombia"):0.92,("Antonee Robinson","USA"):0.90,
 ("Douglas Santos","Brasilien"):0.92,("Unai Simon","Spanien"):0.92,
 ("Mikel Oyarzabal","Spanien"):0.92,("Kylian Mbappe","Frankrig"):0.95,
 ("Erling Haaland","Norge"):0.95,("Lionel Messi","Argentina"):0.95,
 ("Harry Kane","England"):0.95,("Lautaro Martinez","Argentina"):0.55,
 ("Nahuel Molina","Argentina"):0.92,("Nicolas Tagliafico","Argentina"):0.60,
 ("Manu Kone","Frankrig"):0.92,("Adrien Rabiot","Frankrig"):0.92,
 ("Bradley Barcola","Frankrig"):0.60,("Ousmane Dembele","Frankrig"):0.92,
 ("Michael Olise","Frankrig"):0.92,("Chadi Riad","Marokko"):0.88,
 ("Bukayo Saka","England"):0.60,("Marcus Rashford","England"):0.60,
 ("Enzo Fernandez","Argentina"):0.92,("Thiago Almada","Argentina"):0.90,
 ("Luis Diaz","Colombia"):0.92,("Daniel Muñoz","Colombia"):0.92,
 ("Lamine Yamal","Spanien"):0.92,("Cristiano Ronaldo","Portugal"):0.92}


class KO5F:
    def __init__(self):
        self.teams=sorted(TITLE); self.ix={t:i for i,t in enumerate(self.teams)}
        tgt=np.array([TITLE[t] for t in self.teams]); tgt/=tgt.sum()
        self.R=0.32*(np.log(tgt)-np.log(tgt).mean())
        # ankr R16-kampe direkte via mu-par (justér begge ratings)
        for _ in range(80):
            for h,a,mh,ma in R16:
                i,j=self.ix[h],self.ix[a]
                ch=np.clip(np.exp(B0+self.R[i]-self.R[j]),*CLIP)
                ca=np.clip(np.exp(B0+self.R[j]-self.R[i]),*CLIP)
                d=0.25*((np.log(mh)-np.log(ch))-(np.log(ma)-np.log(ca)))/2
                self.R[i]+=d; self.R[j]-=d
        self.rng=np.random.default_rng(21)

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
        self.rounds={r:mk() for r in ["R5","R6","R7"]}
        F=lambda t: np.full(n,self.ix[t])
        r16=[]
        for h,a,mh,ma in R16:
            r16.append(self._tie(F(h),F(a),self.rounds["R5"],mus=(np.full(n,mh),np.full(n,ma))))
        qf=[self._tie(r16[x],r16[y],self.rounds["R6"]) for x,y in QF]
        sf1=self._tie(qf[0],qf[1],self.rounds["R7"]); sf2=self._tie(qf[2],qf[3],self.rounds["R7"])
        l1=np.where(sf1==qf[0],qf[1],qf[0]); l2=np.where(sf2==qf[2],qf[3],qf[2])
        champ=self._tie(sf1,sf2,self.rounds["R7"]); self._tie(l1,l2,self.rounds["R7"])
        self.reach={"QF":self.rounds["R6"]["played"].mean(0),"SF":self.rounds["R7"]["played"].mean(0),
                    "Final":np.bincount(np.concatenate([sf1,sf2]),minlength=T)/n,
                    "Champ":np.bincount(champ,minlength=T)/n}
        return self


def main():
    ko=KO5F(); ko.simulate()
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
            ov=PSTART.get((p["name"],tm))
            p["p_start"]=ov if ov is not None else (0.90 if (p["qw"]>0.004 or p["price"]>=4.5 or p["goals"]>=1) else (0.8 if p["price"]>=3 else 0.65))
    for p in players:
        if p["team"] not in ko.ix:
            p["ev"]={r:0 for r in["R5","R6","R7"]}; p["ev_tot"]=0; p["pF"]=0; continue
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["R5","R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); p["pF"]=ko.reach["Final"][ko.ix[p["team"]]]

    print("="*80); print("HOLD-SANDSYNLIGHEDER (fra bekræftet R16-bracket)"); print("="*80)
    print(f"{'Hold':<11}{'QF%':>6}{'SF%':>6}{'Fin%':>7}{'Titel%':>8}")
    for t in ["Frankrig","Argentina","Spanien","England","Brasilien","Portugal","Colombia","Marokko","Belgien","Mexico","USA","Norge"]:
        i=ko.ix[t]; print(f"{t:<11}{ko.reach['QF'][i]*100:5.0f}%{ko.reach['SF'][i]*100:5.0f}%{ko.reach['Final'][i]*100:6.0f}%{ko.reach['Champ'][i]*100:7.1f}%")

    OWN=[("Unai Simon","Spanien"),("Douglas Santos","Brasilien"),("Facundo Medina","Argentina"),
         ("Antonee Robinson","USA"),("Djed Spence","England"),("Aurelien Tchouameni","Frankrig"),
         ("Jhon Arias","Colombia"),("Ismael Saibari","Marokko"),("Mikel Oyarzabal","Spanien"),
         ("Kylian Mbappe","Frankrig"),("Erling Haaland","Norge")]
    print("\n"+"="*80); print("DIT HOLD — R5/R6/R7-EV + P(finale)  [Bold-status indregnet]"); print("="*80)
    print(f"{'Spiller':<20}{'Hold':<10}{'R5':>7}{'R6':>7}{'R7':>7}{'TOT':>8}{'Fin%':>6}")
    for nm,tm in OWN:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: print(f"{nm:<20}{tm:<10}"+"".join(f"{p['ev'][r]/1000:6.0f}k" for r in["R5","R6","R7"])+f"{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

    print("\n"+"="*80); print("NØGLE-ALTERNATIVER (skifte-kandidater)"); print("="*80)
    print(f"{'Spiller':<20}{'Hold':<10}{'Pos':<5}{'Pris':>5}{'R5':>7}{'TOT':>8}{'Fin%':>6}")
    for nm,tm in [("Lionel Messi","Argentina"),("Manu Kone","Frankrig"),("Adrien Rabiot","Frankrig"),
                  ("Chadi Riad","Marokko"),("Nahuel Molina","Argentina"),("Enzo Fernandez","Argentina"),
                  ("Thiago Almada","Argentina"),("Ousmane Dembele","Frankrig"),("Daniel Muñoz","Colombia"),
                  ("Luis Diaz","Colombia"),("Harry Kane","England")]:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: print(f"{nm:<20}{tm:<10}{p['pos']:<5}{p['price']:4.1f}m{p['ev']['R5']/1000:6.0f}k{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

if __name__=="__main__":
    main()
