#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R3 FINAL action-kort: 3-4-3, kaptajn Mbappe, 2 skift, budget tjekket."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mp
import textwrap

PURPLE, YELLOW = "#2a1545", "#ffd84d"
PITCH, PITCH2, LINE = "#3a9e57", "#43ab61", "#e8f5e9"
CARD, DARK, GOLD = "#ffffff", "#1c1130", "#f5c542"
NEW = "#2e7d46"
NAT = {"Spanien": "#c60b1e", "Brasilien": "#ffdf00", "Canada": "#d52b1e",
       "Ecuador": "#ffd100", "Frankrig": "#0055a4", "Colombia": "#fcd116",
       "Norge": "#ba0c2f", "Marokko": "#c1272d"}

# (navn, land, R3-modstander, x, y, rolle)  rolle: cap/keep/new/yellow
XI = [
    ("Unai Simon", "Spanien", "Uruguay", 0.50, 0.875, "keep"),
    ("D. Santos", "Brasilien", "Skotland", 0.22, 0.63, "keep"),
    ("Chadi Riad", "Marokko", "Haiti", 0.50, 0.66, "new"),
    ("De Fougerolles", "Canada", "Schweiz", 0.78, 0.63, "keep"),
    ("M. Caicedo", "Ecuador", "Tyskland", 0.15, 0.40, "keep"),
    ("Tchouameni", "Frankrig", "Norge", 0.38, 0.37, "yellow"),
    ("Saibari", "Marokko", "Haiti", 0.62, 0.37, "new"),
    ("Jhon Arias", "Colombia", "Portugal", 0.85, 0.40, "keep"),
    ("Oyarzabal", "Spanien", "Uruguay", 0.22, 0.14, "keep"),
    ("Mbappe", "Frankrig", "Norge", 0.50, 0.11, "cap"),
    ("Haaland", "Norge", "Frankrig", 0.78, 0.14, "keep"),
]

fig = plt.figure(figsize=(9.6, 13.8), facecolor=PURPLE)
axh = fig.add_axes([0, 0.905, 1, 0.095]); axh.axis("off"); axh.set_xlim(0,1); axh.set_ylim(0,1)
axh.text(0.04, 0.60, "VM MANAGER 2026 — RUNDE 3  ·  ENDELIGT", color=YELLOW, fontsize=18, fontweight="bold")
axh.text(0.04, 0.22, "Middelmådige Arkæologer · 3-4-3 · kaptajn Mbappe", color="white", fontsize=12)

ax = fig.add_axes([0.05, 0.37, 0.90, 0.535]); ax.axis("off"); ax.set_xlim(0,1); ax.set_ylim(0,1)
ax.add_patch(mp.FancyBboxPatch((0,0),1,1,boxstyle="round,pad=0.005,rounding_size=0.02",fc=PITCH,ec="none"))
for i in range(7):
    if i%2==0: ax.add_patch(mp.Rectangle((0.005,0.01+i*0.14),0.99,0.14,fc=PITCH2,ec="none"))
ax.add_patch(mp.Rectangle((0.02,0.015),0.96,0.97,fill=False,ec=LINE,lw=1.8))
ax.add_patch(mp.Rectangle((0.32,0.915),0.36,0.07,fill=False,ec=LINE,lw=1.8))
ax.plot([0.02,0.98],[0.015,0.015],color=LINE,lw=1.8)
ax.add_patch(mp.Circle((0.5,0.015),0.10,fill=False,ec=LINE,lw=1.8))

for navn, land, opp, x, y, role in XI:
    w,h=0.205,0.092
    ec = {"cap":GOLD,"new":NEW,"keep":"#cfd8dc","yellow":"#e8b53a"}[role]
    lw = 3.0 if role in ("cap","new") else (2.2 if role=="yellow" else 1.0)
    ax.add_patch(mp.FancyBboxPatch((x-w/2,y-h/2),w,h,boxstyle="round,pad=0.004,rounding_size=0.012",
                 fc=CARD,ec=ec,lw=lw,zorder=3))
    ax.add_patch(mp.Rectangle((x-w/2+0.008,y+h/2-0.025),0.026,0.012,fc=NAT.get(land,"#888"),ec="none",zorder=4))
    ax.text(x+0.016,y+h/2-0.019,land,fontsize=7,color="#5f6b76",va="center",zorder=4)
    tag = "  NY" if role=="new" else ("  ?" if role=="yellow" else "")
    ax.text(x,y+0.006,navn+tag,fontsize=9.0,fontweight="bold",color=DARK,ha="center",va="center",zorder=4)
    ax.text(x,y-h/2+0.017,f"mod {opp}",fontsize=7.2,color="#6a7681",ha="center",va="center",zorder=4)
    if role=="cap":
        ax.add_patch(mp.Circle((x+w/2-0.013,y+h/2-0.006),0.016,fc=GOLD,ec="white",lw=1.2,zorder=5))
        ax.text(x+w/2-0.013,y+h/2-0.0065,"C",fontsize=9,fontweight="bold",color=DARK,ha="center",va="center",zorder=6)

ax.text(0.5,-0.03,"3-4-3 · Kaptajn: Mbappe (mod Norge) · Saibari+Riad = Marokko-stak mod udslået Haiti",
        color="white",fontsize=10.5,ha="center",fontweight="bold")

ax2 = fig.add_axes([0.05, 0.015, 0.90, 0.34]); ax2.axis("off"); ax2.set_xlim(0,1); ax2.set_ylim(0,1)
rows = [
    ("#ff6b6b", "SÆLG (2)", "Medina (Argentina, dødt opgør mod Jordan) + Brown (Tyskland, Nagelsmann roterer — Bold-grafik blank)."),
    (NEW, "KØB (2)", "Saibari (MID, Marokko mod Haiti, grøn — starter som angriber) + Chadi Riad (DEF, Marokko mod Haiti, grøn, 2,0m)."),
    (GOLD, "KAPTAJN", "Mbappe (Frankrig mod Norge) — bekræftet starter, topopgør om førstepladsen. Behold Haaland (samme kamp = hedge)."),
    ("#e8b53a", "HOLD ØJE", "Tchouameni (?) er i Frankrigs XI men kan spares minutter. Behold — billig og central."),
]
y=0.95
for col,tag,txt in rows:
    ax2.add_patch(mp.FancyBboxPatch((0,y-0.155),1.0,0.165,boxstyle="round,pad=0.004,rounding_size=0.012",fc="#34215a",ec=col,lw=1.8))
    ax2.add_patch(mp.Rectangle((0.015,y-0.11),0.02,0.105,fc=col,ec="none"))
    ax2.text(0.05,y-0.03,tag,fontsize=11,fontweight="bold",color=col)
    for j,ln in enumerate(textwrap.wrap(txt,94)):
        ax2.text(0.05,y-0.072-j*0.032,ln,fontsize=8.5,color="white")
    y-=0.215
ax2.text(0.0,y+0.03,"BUDGET: bank 0,686m + salg (Medina ~2,24m + Brown ~2,86m) = ~5,79m.  Køb Saibari (~3,5m) + Riad (2,0m) "
         "+ gebyr ≈ 5,55m → rest ~0,24m. Går op (tjek Saibaris pris ≤ 3,7m).",fontsize=7.8,color=YELLOW,style="italic")

plt.savefig("out/r3_final.png", dpi=160, bbox_inches="tight", facecolor=PURPLE)
print("gemt: out/r3_final.png")
