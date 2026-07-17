#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R8 FINAL: bronzekamp + finale (18.-19. juli) — ALLERSIDSTE runde.

BRONZE 18/7: Frankrig-England (Opta: FRA 50,7% / X 23,7% / ENG 25,6% i 90 min).
  Bronzekampe er åbne — mus 1,65/1,05. ROTATION er nøglerisikoen, MEN:
  Mbappé jagter Golden Boot (8 mål = Messi) → spiller. Rollespillere ~70%.
  England kan rotere kraftigt → Spence-chance for start.
FINALE 19/7: Spanien-Argentina (+130/X +200/ARG +240 → de-vig 41/31/28).
  Scorer-odds: Messi +130 (43%) · Oyarzabal +170 · Borja Iglesias +210 · Yamal +230.
"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
import knockout as K

N = 40000
MATCHES = {  # rname -> (hold_h, hold_a, mu_h, mu_a)
    "BRONZE": ("Frankrig", "England", 1.65, 1.05),
    "FINALE": ("Spanien", "Argentina", 1.20, 0.95),
}

PSTART = {
 # Frankrig — bronze: Mbappé jagter rekorden; øvrige = rotationsrisiko
 ("Kylian Mbappe","Frankrig"):0.92,("Mike Maignan","Frankrig"):0.70,
 ("Jules Kounde","Frankrig"):0.65,("Lucas Digne","Frankrig"):0.60,
 ("Adrien Rabiot","Frankrig"):0.65,("Aurelien Tchouameni","Frankrig"):0.70,
 ("Ousmane Dembele","Frankrig"):0.70,("William Saliba","Frankrig"):0.60,
 ("Dayot Upamecano","Frankrig"):0.60,("Michael Olise","Frankrig"):0.65,
 ("Desire Doue","Frankrig"):0.70,("Bradley Barcola","Frankrig"):0.55,
 ("Manu Koné","Frankrig"):0.55,
 # England — bronze: Tuchel-rotation sandsynlig
 ("Harry Kane","England"):0.70,("Jude Bellingham","England"):0.60,
 ("Djed Spence","England"):0.55,("Reece James","England"):0.50,
 ("Nico O'Reilly","England"):0.55,("Ezri Konsa","England"):0.55,
 ("Marc Guehi","England"):0.55,("Jordan Pickford","England"):0.65,
 ("Eberechi Eze","England"):0.60,("Ollie Watkins","England"):0.55,
 ("Ivan Toney","England"):0.45,("Anthony Gordon","England"):0.60,
 ("Noni Madueke","England"):0.55,("Bukayo Saka","England"):0.55,
 ("Declan Rice","England"):0.55,("Elliot Anderson","England"):0.60,
 # Finalen — fuld styrke
 ("Lionel Messi","Argentina"):0.95,("Julian Alvarez","Argentina"):0.92,
 ("Emiliano Martinez","Argentina"):0.92,("Nahuel Molina","Argentina"):0.90,
 ("Cristian Romero","Argentina"):0.92,("Nicolas Tagliafico","Argentina"):0.88,
 ("Enzo Fernandez","Argentina"):0.90,("Rodrigo de Paul","Argentina"):0.90,
 ("Alexis Mac Allister","Argentina"):0.90,("Leandro Paredes","Argentina"):0.88,
 ("Lautaro Martinez","Argentina"):0.25,("Facundo Medina","Argentina"):0.15,
 ("Unai Simon","Spanien"):0.92,("Pedro Porro","Spanien"):0.90,
 ("Pau Cubarsi","Spanien"):0.90,("Aymeric Laporte","Spanien"):0.90,
 ("Marc Cucurella","Spanien"):0.90,("Fabian Ruiz","Spanien"):0.85,
 ("Dani Olmo","Spanien"):0.85,("Pedri","Spanien"):0.40,
 ("Lamine Yamal","Spanien"):0.95,("Mikel Oyarzabal","Spanien"):0.90,
 ("Alex Baena","Spanien"):0.40,
}
INJ_CLEAR = {("William Saliba","Frankrig"),("Cristian Romero","Argentina"),
             ("Reece James","England"),("Aurelien Tchouameni","Frankrig")}


class KO8:
    """To uafhængige kampe. rounds['BRONZE'/'FINALE'] i K.player_growth-format."""
    def __init__(self):
        teams = sorted({t for m in MATCHES.values() for t in m[:2]})
        self.teams = teams; self.ix = {t: i for i, t in enumerate(teams)}
        self.rng = np.random.default_rng(88)

    def simulate(self, n=N):
        T = len(self.teams)
        self.rounds = {}
        self.winp = {}
        for rname, (h, a, mh, ma) in MATCHES.items():
            rec = dict(played=np.zeros((n, T), bool), gf=np.zeros((n, T), np.int16),
                       ga=np.zeros((n, T), np.int16), win=np.zeros((n, T), bool),
                       so=np.zeros((n, T), bool), lam_a=np.zeros((n, T), np.float32))
            i, j = self.ix[h], self.ix[a]
            ga_ = self.rng.poisson(mh, n); gb_ = self.rng.poisson(ma, n)
            lvl = ga_ == gb_   # uafgjort -> forlænget + straffe (begge kampe afgøres)
            ga_ = ga_ + np.where(lvl, self.rng.poisson(mh / 3.0, n), 0)
            gb_ = gb_ + np.where(lvl, self.rng.poisson(ma / 3.0, n), 0)
            still = ga_ == gb_
            wa = (ga_ > gb_) | (still & (self.rng.random(n) < mh / (mh + ma)))
            s = np.arange(n)
            for t, gf, gc, lo, sw in ((i, ga_, gb_, ma, still & wa),
                                       (j, gb_, ga_, mh, still & ~wa)):
                rec["played"][s, t] = True; rec["gf"][s, t] = gf; rec["ga"][s, t] = gc
                rec["win"][s, t] = np.where(t == i, wa, ~wa) if False else (gf > gc)
                rec["lam_a"][s, t] = lo; rec["so"][s, t] = sw
            # sejr ved straffe tæller som sejr i holdet? Nej: uafgjort efter forl. => so-bonus.
            rec["win"][s, i] |= (still & wa); rec["win"][s, j] |= (still & ~wa)
            self.rounds[rname] = rec
            self.winp[rname] = (h, a, float((rec["win"][:, i]).mean()), float((rec["win"][:, j]).mean()))
        return self


def main():
    ko = KO8(); ko.simulate()
    players = K.load_players(); q = K.load_scorer_q()
    POSW = {"GK": 0.01, "DEF": 0.30, "MID": 1.0, "ATT": 2.3}; byt = {}
    for p in players:
        if (p["name"], p["team"]) in INJ_CLEAR: p["inj"] = False
        if p["team"] in ko.ix: byt.setdefault(p["team"], []).append(p)
    for tm, ps in byt.items():
        for p in ps: p["qw"] = q.get((p["name"], tm), 0.0)
        base = np.array([POSW[p["pos"]] * (p["price"] ** 1.1) * (1 + (p["goals"] + 0.6 * p["assists"]) * 0.5 + max(p["index"], 0) / 100) for p in ps])
        gbw = np.array([p["qw"] for p in ps]); gbw = gbw / gbw.sum() if gbw.sum() > 0 else base / base.sum()
        basew = base / base.sum() if base.sum() > 0 else gbw; share = 0.55 * gbw + 0.45 * basew
        for i, p in enumerate(ps):
            p["s_g"] = float(np.clip(share[i], 0, 0.6)); p["s_a"] = float(np.clip(0.5 * share[i] + 0.15 * basew[i], 0, 0.5))
            ov = PSTART.get((p["name"], tm))
            p["p_start"] = ov if ov is not None else (0.75 if (p["qw"] > 0.004 or p["price"] >= 4.5 or p["goals"] >= 1) else 0.5)
    rn = list(MATCHES)
    for p in players:
        if p["team"] not in ko.ix:
            p["ev"] = {r: 0 for r in rn}; p["ev_tot"] = 0; continue
        p["ev"] = {r: K.player_growth(p, ko, q, r) for r in rn}
        p["ev_tot"] = sum(p["ev"].values())

    for r, (h, a, wh, wa) in ko.winp.items():
        print(f"{r}: {h} {wh*100:.0f}% (inkl. forl./straffe) — {a} {wa*100:.0f}%")

    OWN = [("Mike Maignan", "Frankrig"), ("Jules Kounde", "Frankrig"), ("Lucas Digne", "Frankrig"),
           ("Djed Spence", "England"), ("Adrien Rabiot", "Frankrig"), ("Aurelien Tchouameni", "Frankrig"),
           ("Ousmane Dembele", "Frankrig"), ("Kylian Mbappe", "Frankrig"), ("Lionel Messi", "Argentina")]
    print("\n" + "=" * 72); print("DIT HOLD — EV sidste kamp (bronze/finale)"); print("=" * 72)
    print(f"{'Spiller':<20}{'Kamp':<9}{'EV':>7}   p_start")
    for nm, tm in OWN:
        p = next((x for x in players if x["name"] == nm and x["team"] == tm), None)
        if p:
            kamp = "BRONZE" if tm in ("Frankrig", "England") else "FINALE"
            print(f"{nm:<20}{kamp:<9}{p['ev_tot']/1000:6.0f}k   {p['p_start']:.2f}")

    print("\n" + "=" * 72); print("KØBS-KANDIDATER (finalen, 1 kamp) — pris R3-snapshot"); print("=" * 72)
    CAND = [("Mikel Oyarzabal", "Spanien"), ("Lamine Yamal", "Spanien"), ("Dani Olmo", "Spanien"),
            ("Fabian Ruiz", "Spanien"), ("Pau Cubarsi", "Spanien"), ("Pedro Porro", "Spanien"),
            ("Marc Cucurella", "Spanien"), ("Aymeric Laporte", "Spanien"), ("Unai Simon", "Spanien"),
            ("Julian Alvarez", "Argentina"), ("Enzo Fernandez", "Argentina"), ("Nahuel Molina", "Argentina"),
            ("Cristian Romero", "Argentina"), ("Nicolas Tagliafico", "Argentina"),
            ("Rodrigo de Paul", "Argentina"), ("Alexis Mac Allister", "Argentina"),
            ("Emiliano Martinez", "Argentina")]
    print(f"{'Spiller':<20}{'Hold':<10}{'Pos':<5}{'PrisR3':>7}{'EV':>7}{'−1% gebyr':>10}")
    rows = [next((x for x in players if x["name"] == nm and x["team"] == tm), None) for nm, tm in CAND]
    for p in sorted([r for r in rows if r], key=lambda x: -x["ev_tot"]):
        print(f"{p['name']:<20}{p['team']:<10}{p['pos']:<5}{p['price']:6.2f}m{p['ev_tot']/1000:6.0f}k{p['ev_tot']/1000 - p['price']*10.1:9.0f}k")

    print("\nKAPTAJN (E[maks(vækst,0)]-proxy = EV, begge er sikre startere):")
    for nm, tm in [("Kylian Mbappe", "Frankrig"), ("Lionel Messi", "Argentina"),
                   ("Ousmane Dembele", "Frankrig"), ("Harry Kane", "England")]:
        p = next((x for x in players if x["name"] == nm and x["team"] == tm), None)
        if p: print(f"  {nm:<18} {p['ev_tot']/1000:5.0f}k")

if __name__ == "__main__":
    main()
