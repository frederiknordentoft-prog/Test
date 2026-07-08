#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R6 FINAL: kvartfinaler 9.-11. juli 2026 — bekræftede matchups + odds 7-8/7.

QF1 Marokko-Frankrig (FRA -180/DK -410 adv) · QF2 Norge-England (ENG -105, NOR +260)
QF3 Spanien-Belgien (ESP -160) · QF4 Argentina-Schweiz (ARG -140).
Titelodds (FOX 7/7, de-vigged): FRA +175, ESP +370, ARG +390, ENG +480,
NOR +1400, MAR +2700, BEL +3000, SUI +3300.
Lineups (Sports Mole/Squawka/bulinews 7-8/7):
  FRA: Maignan; Kounde, Upamecano, Saliba, Digne; Kone, Rabiot; Dembele, Olise,
       Barcola; Mbappe. Tchouameni UDE (lår).
  MAR: Bounou; Hakimi, Diop, Riad, Mazraoui; ... Saibari UDE (baglår).
  ARG: E.Martinez; Molina, Romero, L.Martinez, Tagliafico; Paredes, De Paul,
       Mac Allister; Messi, Alvarez, Enzo. MEDINA BÆNK (Lisandro fit igen).
  ESP: Simon; Porro, Cubarsi, Laporte, Cucurella; Pedri, Rodri; Yamal, Olmo,
       Baena; Oyarzabal (4 mål, i form).
  NOR: Nyland; Ryerson, Ajer, Heggem, Østigård; Berg, Berge; Sørloth, Ødegaard,
       Nusa; Haaland (topscorer, 2 mål mod Brasilien).
  ENG: Pickford; Spence, Guehi, Konsa, O'Reilly; Anderson, Rice; Madueke,
       Bellingham, Gordon; Kane.
Positions-huller: Barcola=MID i holdet men LW i front-tre; Enzo=MID men i front-tre.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

N = 20000
B0 = np.log(1.30); CLIP = (0.18, 4.0)

# De-vigged titelodds 7/7 (FOX): normaliseret
TITLE = {"Frankrig":.326,"Spanien":.191,"Argentina":.183,"England":.154,
         "Norge":.060,"Marokko":.032,"Belgien":.029,"Schweiz":.026}

# (hjemme, ude, mu_h, mu_u) — kvartfinaler, fra 1X2-odds + defensive profiler.
# Marokko/Schweiz/Belgien defensive; Spanien 0 mål imod i 5 kampe.
QFM = [("Marokko","Frankrig",0.75,1.85),
       ("Norge","England",1.05,1.35),
       ("Spanien","Belgien",1.60,0.75),
       ("Argentina","Schweiz",1.45,0.70)]
SF = [(0,1),(2,3)]

# Bekræftede/forventede opstillinger 7-8/7 → p_start-overrides
PSTART = {
 # Frankrig
 ("Mike Maignan","Frankrig"):0.95,("Kylian Mbappe","Frankrig"):0.95,
 ("Adrien Rabiot","Frankrig"):0.92,("Ousmane Dembele","Frankrig"):0.92,
 ("Michael Olise","Frankrig"):0.90,("Bradley Barcola","Frankrig"):0.85,
 ("Jules Kounde","Frankrig"):0.90,("Dayot Upamecano","Frankrig"):0.90,
 ("William Saliba","Frankrig"):0.88,("Lucas Digne","Frankrig"):0.85,
 ("Manu Koné","Frankrig"):0.90,("Aurelien Tchouameni","Frankrig"):0.10,
 # Marokko
 ("Ismael Saibari","Marokko"):0.10,("Chadi Riad","Marokko"):0.88,
 ("Achraf Hakimi","Marokko"):0.92,("Yassine 'Bono' Bounou","Marokko"):0.92,
 # Argentina
 ("Lionel Messi","Argentina"):0.95,("Julian Alvarez","Argentina"):0.90,
 ("Enzo Fernandez","Argentina"):0.90,("Rodrigo de Paul","Argentina"):0.90,
 ("Alexis Mac Allister","Argentina"):0.90,("Leandro Paredes","Argentina"):0.85,
 ("Nahuel Molina","Argentina"):0.88,("Cristian Romero","Argentina"):0.90,
 ("Nicolas Tagliafico","Argentina"):0.85,("Facundo Medina","Argentina"):0.30,
 ("Lautaro Martinez","Argentina"):0.35,("Thiago Almada","Argentina"):0.30,
 # Spanien
 ("Unai Simon","Spanien"):0.92,("Mikel Oyarzabal","Spanien"):0.92,
 ("Lamine Yamal","Spanien"):0.95,("Pedri","Spanien"):0.92,
 ("Dani Olmo","Spanien"):0.88,("Alex Baena","Spanien"):0.85,
 ("Pedro Porro","Spanien"):0.88,("Pau Cubarsi","Spanien"):0.90,
 ("Aymeric Laporte","Spanien"):0.88,("Marc Cucurella","Spanien"):0.90,
 # Norge
 ("Erling Haaland","Norge"):0.95,("Alexander Sørloth","Norge"):0.90,
 ("Martin Ødegaard","Norge"):0.92,("Antonio Nusa","Norge"):0.88,
 ("Leo Østigård","Norge"):0.90,("Kristoffer Ajer","Norge"):0.90,
 ("Torbjørn Heggem","Norge"):0.88,("Julian Ryerson","Norge"):0.90,
 # England
 ("Harry Kane","England"):0.95,("Jude Bellingham","England"):0.92,
 ("Declan Rice","England"):0.92,("Djed Spence","England"):0.85,
 ("Nico O'Reilly","England"):0.85,
 ("Issa Diop","Marokko"):0.90,("Ayyoub Bouaddi","Marokko"):0.88,
 ("Neil El Aynaoui","Marokko"):0.88,("Patrick Berg","Norge"):0.90,
 ("Sander Berge","Norge"):0.90,("Ørjan Nyland","Norge"):0.92,
 # Belgien / Schweiz
 ("Kevin De Bruyne","Belgien"):0.92,("Jeremy Doku","Belgien"):0.90,
 ("Leandro Trossard","Belgien"):0.88,("Charles De Ketelaere","Belgien"):0.88,
 ("Thibaut Courtois","Belgien"):0.92,
 ("Granit Xhaka","Schweiz"):0.92,("Breel Embolo","Schweiz"):0.90,
 ("Manuel Akanji","Schweiz"):0.92,("Gregor Kobel","Schweiz"):0.92,
}
# Skadesflag i data er fra R3-snapshot — disse er fit og starter nu
INJ_CLEAR = {("William Saliba","Frankrig"),("Cristian Romero","Argentina"),
             ("Julian Ryerson","Norge")}


class KO6:
    def __init__(self):
        self.teams=sorted(TITLE); self.ix={t:i for i,t in enumerate(self.teams)}
        tgt=np.array([TITLE[t] for t in self.teams]); tgt/=tgt.sum()
        self.R=0.32*(np.log(tgt)-np.log(tgt).mean())
        for _ in range(80):
            for h,a,mh,ma in QFM:
                i,j=self.ix[h],self.ix[a]
                ch=np.clip(np.exp(B0+self.R[i]-self.R[j]),*CLIP)
                ca=np.clip(np.exp(B0+self.R[j]-self.R[i]),*CLIP)
                d=0.25*((np.log(mh)-np.log(ch))-(np.log(ma)-np.log(ca)))/2
                self.R[i]+=d; self.R[j]-=d
        self.rng=np.random.default_rng(26)

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
        self.rounds={r:mk() for r in ["R6","R7"]}
        F=lambda t: np.full(n,self.ix[t])
        qf=[]
        for h,a,mh,ma in QFM:
            qf.append(self._tie(F(h),F(a),self.rounds["R6"],mus=(np.full(n,mh),np.full(n,ma))))
        sf1=self._tie(qf[0],qf[1],self.rounds["R7"]); sf2=self._tie(qf[2],qf[3],self.rounds["R7"])
        l1=np.where(sf1==qf[0],qf[1],qf[0]); l2=np.where(sf2==qf[2],qf[3],qf[2])
        champ=self._tie(sf1,sf2,self.rounds["R7"]); self._tie(l1,l2,self.rounds["R7"])
        self.reach={"SF":self.rounds["R7"]["played"].mean(0),
                    "Final":np.bincount(np.concatenate([sf1,sf2]),minlength=T)/n,
                    "Champ":np.bincount(champ,minlength=T)/n}
        return self


def main():
    ko=KO6(); ko.simulate()
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
            p["ev"]={r:0 for r in["R6","R7"]}; p["ev_tot"]=0; p["pF"]=0; continue
        p["ev"]={r:K.player_growth(p,ko,q,r) for r in ["R6","R7"]}
        p["ev_tot"]=sum(p["ev"].values()); p["pF"]=ko.reach["Final"][ko.ix[p["team"]]]

    print("="*80); print("HOLD-SANDSYNLIGHEDER (kvartfinale-bracket, odds 7-8/7)"); print("="*80)
    print(f"{'Hold':<11}{'SF%':>6}{'Fin%':>7}{'Titel%':>8}")
    for t in sorted(ko.teams,key=lambda t:-ko.reach["Champ"][ko.ix[t]]):
        i=ko.ix[t]; print(f"{t:<11}{ko.reach['SF'][i]*100:5.0f}%{ko.reach['Final'][i]*100:6.0f}%{ko.reach['Champ'][i]*100:7.1f}%")

    OWN=[("Mike Maignan","Frankrig"),("Douglas Santos","Brasilien"),("Facundo Medina","Argentina"),
         ("Antonee Robinson","USA"),("Chadi Riad","Marokko"),("Adrien Rabiot","Frankrig"),
         ("Jhon Arias","Colombia"),("Ismael Saibari","Marokko"),("Mikel Oyarzabal","Spanien"),
         ("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina")]
    print("\n"+"="*80); print("DIT HOLD — R6/R7-EV + P(finale)"); print("="*80)
    print(f"{'Spiller':<20}{'Hold':<10}{'R6':>7}{'R7':>7}{'TOT':>8}{'Fin%':>6}")
    for nm,tm in OWN:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: print(f"{nm:<20}{tm:<10}"+"".join(f"{p['ev'][r]/1000:6.0f}k" for r in["R6","R7"])+f"{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")
        else: print(f"{nm:<20}{tm:<10}   (ude af turneringen — EV 0)")

    print("\n"+"="*80); print("KØBS-KANDIDATER — R6/R7-EV pr. spiller (pris = R3-snapshot!)"); print("="*80)
    CAND=[("Jules Kounde","Frankrig"),("Dayot Upamecano","Frankrig"),("William Saliba","Frankrig"),
          ("Lucas Digne","Frankrig"),("Manu Koné","Frankrig"),("Bradley Barcola","Frankrig"),
          ("Ousmane Dembele","Frankrig"),("Michael Olise","Frankrig"),
          ("Nahuel Molina","Argentina"),("Nicolas Tagliafico","Argentina"),("Cristian Romero","Argentina"),
          ("Rodrigo de Paul","Argentina"),("Alexis Mac Allister","Argentina"),("Enzo Fernandez","Argentina"),
          ("Julian Alvarez","Argentina"),
          ("Pedro Porro","Spanien"),("Pau Cubarsi","Spanien"),("Marc Cucurella","Spanien"),
          ("Aymeric Laporte","Spanien"),("Pedri","Spanien"),("Alex Baena","Spanien"),
          ("Dani Olmo","Spanien"),("Lamine Yamal","Spanien"),
          ("Erling Haaland","Norge"),("Alexander Sørloth","Norge"),("Martin Ødegaard","Norge"),
          ("Antonio Nusa","Norge"),("Leo Østigård","Norge"),("Kristoffer Ajer","Norge"),
          ("Harry Kane","England"),("Jude Bellingham","England"),("Declan Rice","England"),
          ("Djed Spence","England"),("Nico O'Reilly","England"),
          ("Issa Diop","Marokko"),("Ayyoub Bouaddi","Marokko"),
          ("Patrick Berg","Norge"),("Sander Berge","Norge"),("Torbjørn Heggem","Norge")]
    print(f"{'Spiller':<20}{'Hold':<10}{'Pos':<5}{'PrisR3':>7}{'R6':>7}{'R7':>7}{'TOT':>8}{'Fin%':>6}")
    rows=[]
    for nm,tm in CAND:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if p: rows.append(p)
    for p in sorted(rows,key=lambda x:-x["ev_tot"]):
        print(f"{p['name']:<20}{p['team']:<10}{p['pos']:<5}{p['price']:6.2f}m{p['ev']['R6']/1000:6.0f}k{p['ev']['R7']/1000:6.0f}k{p['ev_tot']/1000:7.0f}k{p['pF']*100:5.0f}%")

    print("\n"+"="*80); print("KAPTAJN-KANDIDATER R6 — E[max(vækst,0)] (asymmetrisk bonus)"); print("="*80)
    for nm,tm in [("Kylian Mbappe","Frankrig"),("Lionel Messi","Argentina"),
                  ("Erling Haaland","Norge"),("Harry Kane","England"),
                  ("Mikel Oyarzabal","Spanien"),("Lamine Yamal","Spanien"),
                  ("Ousmane Dembele","Frankrig")]:
        p=next((x for x in players if x["name"]==nm and x["team"]==tm),None)
        if not p: continue
        # kaptajnbonus: gensimulér R6-vækst og tag E[max(g,0)] via 200 gentagelser af mean? —
        # player_growth giver kun mean; approx: bonus ≈ EV_R6 * upliftfaktor (goals-tunge spillere ~1.15)
        print(f"{nm:<20}{tm:<10} R6-EV {p['ev']['R6']/1000:5.0f}k  (bonus ≈ E[max(g,0)] ≥ R6-EV)")

if __name__=="__main__":
    main()
