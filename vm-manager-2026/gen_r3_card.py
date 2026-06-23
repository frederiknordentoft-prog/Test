#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R3-holdtegning (action-kort): opstilling, kaptajn, det ene skift + tjekliste."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mp

PURPLE, YELLOW = "#2a1545", "#ffd84d"
PITCH, PITCH2, LINE = "#3a9e57", "#43ab61", "#e8f5e9"
CARD, DARK, GOLD = "#ffffff", "#1c1130", "#f5c542"
SELL = "#ff6b6b"
NAT = {"Spanien": "#c60b1e", "Tyskland": "#1a1a1a", "Brasilien": "#ffdf00",
       "Canada": "#d52b1e", "Ecuador": "#ffd100", "Frankrig": "#0055a4",
       "Colombia": "#fcd116", "Norge": "#ba0c2f", "Argentina": "#75aadb"}

# (navn, land, R3-modstander, x, y, rolle)  rolle: cap/keep/sell/open
XI = [
    ("Unai Simon", "Spanien", "Uruguay", 0.50, 0.875, "keep"),
    ("N. Brown", "Tyskland", "Ecuador", 0.13, 0.66, "keep"),
    ("D. Santos", "Brasilien", "Skotland", 0.38, 0.62, "keep"),
    ("? (køb)", "", "skal vinde", 0.62, 0.62, "open"),
    ("De Fougerolles", "Canada", "Schweiz", 0.87, 0.66, "keep"),
    ("M. Caicedo", "Ecuador", "Tyskland", 0.22, 0.40, "keep"),
    ("Tchouameni", "Frankrig", "Norge", 0.50, 0.36, "keep"),
    ("Jhon Arias", "Colombia", "Portugal", 0.78, 0.40, "keep"),
    ("Oyarzabal", "Spanien", "Uruguay", 0.20, 0.15, "keep"),
    ("Mbappe", "Frankrig", "Norge", 0.50, 0.11, "cap"),
    ("Haaland", "Norge", "Frankrig", 0.80, 0.15, "keep"),
]

fig = plt.figure(figsize=(9.6, 13.8), facecolor=PURPLE)

# header
axh = fig.add_axes([0, 0.90, 1, 0.10]); axh.axis("off"); axh.set_xlim(0,1); axh.set_ylim(0,1)
axh.text(0.04, 0.62, "VM MANAGER 2026 — RUNDE 3", color=YELLOW, fontsize=20, fontweight="bold")
axh.text(0.04, 0.26, "Middelmådige Arkæologer · action-kort til i morgen", color="white", fontsize=12)

ax = fig.add_axes([0.05, 0.36, 0.90, 0.55]); ax.axis("off"); ax.set_xlim(0,1); ax.set_ylim(0,1)
ax.add_patch(mp.FancyBboxPatch((0,0),1,1,boxstyle="round,pad=0.005,rounding_size=0.02",fc=PITCH,ec="none"))
for i in range(7):
    if i%2==0: ax.add_patch(mp.Rectangle((0.005,0.01+i*0.14),0.99,0.14,fc=PITCH2,ec="none"))
ax.add_patch(mp.Rectangle((0.02,0.015),0.96,0.97,fill=False,ec=LINE,lw=1.8))
ax.add_patch(mp.Rectangle((0.32,0.915),0.36,0.07,fill=False,ec=LINE,lw=1.8))
ax.plot([0.02,0.98],[0.015,0.015],color=LINE,lw=1.8)
ax.add_patch(mp.Circle((0.5,0.015),0.10,fill=False,ec=LINE,lw=1.8))

for navn, land, opp, x, y, role in XI:
    w,h=0.215,0.092
    ec = {"cap":GOLD,"open":SELL,"keep":"#cfd8dc"}[role]
    lw = 3.0 if role in ("cap","open") else 1.0
    fc = "#fff4f4" if role=="open" else CARD
    ax.add_patch(mp.FancyBboxPatch((x-w/2,y-h/2),w,h,boxstyle="round,pad=0.004,rounding_size=0.012",
                 fc=fc,ec=ec,lw=lw,zorder=3))
    if land:
        ax.add_patch(mp.Rectangle((x-w/2+0.008,y+h/2-0.025),0.026,0.012,fc=NAT.get(land,"#888"),ec="none",zorder=4))
        ax.text(x+0.016,y+h/2-0.019,land,fontsize=7,color="#5f6b76",va="center",zorder=4)
    ax.text(x,y+0.006,navn,fontsize=9.3,fontweight="bold",color=DARK,ha="center",va="center",zorder=4)
    ax.text(x,y-h/2+0.017,f"mod {opp}",fontsize=7.4,color="#6a7681",ha="center",va="center",zorder=4)
    if role=="cap":
        ax.add_patch(mp.Circle((x+w/2-0.013,y+h/2-0.006),0.016,fc=GOLD,ec="white",lw=1.2,zorder=5))
        ax.text(x+w/2-0.013,y+h/2-0.0065,"C",fontsize=9,fontweight="bold",color=DARK,ha="center",va="center",zorder=6)

ax.text(0.5,-0.03,"4-3-3 · Kaptajn: Mbappe (mod Norge) · behold Haaland (form!)",
        color="white",fontsize=11,ha="center",fontweight="bold")

# action-panel
ax2 = fig.add_axes([0.05, 0.015, 0.90, 0.33]); ax2.axis("off"); ax2.set_xlim(0,1); ax2.set_ylim(0,1)
rows = [
    (SELL, "SÆLG", "Facundo Medina (Argentina) — dødt opgør mod Jordan, tung rotation + kun inde pga. Tagliafico-skade."),
    (GOLD, "KAPTAJN", "Mbappe (Frankrig mod Norge) — topopgør, ingen rotation, 4 mål, straffeskytte. Bedre end Haaland (Norges forsvar < Frankrigs)."),
    ("#2e7d46", "BEHOLD", "Haaland — 4 mål på 2 kampe, spiller højindsats-kampen. Mbappe+Haaland i SAMME kamp = hedge."),
    ("#3d2261", "KØB (åbent)", "Bekræftet billig forsvarer på et hold der SKAL vinde. 1. valg: spansk forsvarer (Cucurella) hvis budget rækker — ellers billigste sikre starter."),
]
y=0.92
for col,tag,txt in rows:
    ax2.add_patch(mp.FancyBboxPatch((0,y-0.15),1.0,0.16,boxstyle="round,pad=0.004,rounding_size=0.012",fc="#34215a",ec=col,lw=1.8))
    ax2.add_patch(mp.Rectangle((0.015,y-0.105),0.02,0.10,fc=col,ec="none"))
    ax2.text(0.05,y-0.03,tag,fontsize=11,fontweight="bold",color=col)
    import textwrap
    for j,ln in enumerate(textwrap.wrap(txt,92)):
        ax2.text(0.05,y-0.072-j*0.032,ln,fontsize=8.6,color="white")
    y-=0.205
ax2.text(0.0,y+0.03,"TJEK I MORGEN FØR DEADLINE: (1) Argentina hviler Medina  (2) din bank + Medinas salgspris  "
         "(3) Mbappe+Haaland starter i topopgøret.",fontsize=8.2,color=YELLOW,style="italic")

plt.savefig("out/r3_holdkort.png", dpi=160, bbox_inches="tight", facecolor=PURPLE)
print("gemt: out/r3_holdkort.png")
