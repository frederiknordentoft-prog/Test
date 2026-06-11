#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Holdtegning: R1-startopstilling (guldplan) + udskiftningsplan R2-R7."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

GREEN, LINE = "#2e7d46", "#e8f5e9"
DARK, GOLD = "#13233a", "#f5c542"

XI = [  # (navn, land, pris, x, y, kaptajn)
    ("Simon", "Spanien", 5.0, 0.50, 0.08, False),
    ("N. Brown", "Tyskland", 2.5, 0.14, 0.30, False),
    ("Bremer", "Brasilien", 3.0, 0.38, 0.28, False),
    ("Robinson", "USA", 2.0, 0.62, 0.28, False),
    ("De Fougerolles", "Canada", 2.0, 0.86, 0.30, False),
    ("Caicedo", "Ecuador", 3.0, 0.26, 0.52, False),
    ("Tchouameni", "Frankrig", 3.5, 0.50, 0.55, False),
    ("Arias", "Colombia", 3.0, 0.74, 0.52, False),
    ("Oyarzabal", "Spanien", 7.5, 0.20, 0.80, False),
    ("Haaland", "Norge", 8.5, 0.50, 0.84, True),
    ("Mbappe", "Frankrig", 10.0, 0.80, 0.80, False),
]

PLAN = [
    ("R1 · 11. jun", "Startholdet ovenfor — 50,0 mio., 4-3-3. Alle 11 bekræftet (Bold 9/6 + nyhedstjek 11/6)", "Haaland (mod Irak)"),
    ("R2 · 18. jun", "UD: Haaland   →   IND: Kane (9,5m)", "Mbappe (mod Irak)"),
    ("R3 · 24. jun", "UD: Arias, Caicedo, De Fougerolles  →  IND: Sarr (3,5m), Ounahi (3,0m), Koulibaly (2,5m)", "Kane (mod Panama)"),
    ("R4 · 1/16", "UD: Koulibaly   →   IND: Kounde (3,5m)", "Mbappe"),
    ("R5 · 1/8", "UD: Robinson   →   IND: Reece James (3,5m)", "Mbappe"),
    ("R6-R7 · KF-finale", "Ingen skift — kernen Spanien/Frankrig/England står til finalen", "Mbappe"),
]

fig = plt.figure(figsize=(9.5, 13.5), facecolor="white")

# ---------------- bane ----------------
ax = fig.add_axes([0.04, 0.40, 0.92, 0.57])
ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
ax.add_patch(mpatches.FancyBboxPatch((0.01, 0.01), 0.98, 0.98,
             boxstyle="round,pad=0.005,rounding_size=0.02",
             fc=GREEN, ec="none", zorder=0))
for y0 in (0.01, 0.51):  # banehalvdele-striber
    for i in range(5):
        if i % 2:
            ax.add_patch(mpatches.Rectangle((0.01, y0 - 0.5 * 0 + i * 0.098),
                         0.98, 0.098, fc="#318a4c", ec="none", zorder=0.5))
ax.add_patch(mpatches.Rectangle((0.02, 0.02), 0.96, 0.96, fill=False,
             ec=LINE, lw=2, zorder=1))
ax.plot([0.02, 0.98], [0.5, 0.5], color=LINE, lw=2, zorder=1)
ax.add_patch(mpatches.Circle((0.5, 0.5), 0.09, fill=False, ec=LINE, lw=2, zorder=1))
ax.add_patch(mpatches.Rectangle((0.30, 0.02), 0.40, 0.10, fill=False, ec=LINE, lw=2, zorder=1))
ax.add_patch(mpatches.Rectangle((0.30, 0.88), 0.40, 0.10, fill=False, ec=LINE, lw=2, zorder=1))

for navn, land, pris, x, y, cap in XI:
    fc = GOLD if cap else DARK
    tc = DARK if cap else "white"
    ax.add_patch(mpatches.Circle((x, y), 0.040, fc=fc, ec="white", lw=2.2, zorder=3))
    ax.text(x, y, "C" if cap else navn[0], ha="center", va="center",
            fontsize=13, fontweight="bold", color=tc, zorder=4)
    label = f"{navn}\n{land} · {pris:.1f}m".replace(".", ",")
    ax.text(x, y - 0.072, label, ha="center", va="top", fontsize=10.5,
            fontweight="bold", color="white", zorder=4,
            bbox=dict(boxstyle="round,pad=0.25", fc="#00000055", ec="none"))

ax.text(0.5, 1.035, "VM MANAGER 2026 — RUNDE 1  (4-3-3 · 50,0 mio.)",
        ha="center", fontsize=15, fontweight="bold", color=DARK)
ax.text(0.5, 0.995, "Kaptajn: Erling Haaland (mod Irak) · forventet vækst +1,13 mio.",
        ha="center", fontsize=11.5, color=DARK)

# ---------------- udskiftningsplan ----------------
ax2 = fig.add_axes([0.04, 0.015, 0.92, 0.355])
ax2.set_xlim(0, 1); ax2.set_ylim(0, 1); ax2.axis("off")
ax2.text(0.0, 0.97, "FORVENTET UDSKIFTNINGSPLAN", fontsize=14,
         fontweight="bold", color=DARK, va="top")

y = 0.84
for rund, skift, cap in PLAN:
    ax2.add_patch(mpatches.FancyBboxPatch((0.0, y - 0.115), 1.0, 0.125,
                  boxstyle="round,pad=0.004,rounding_size=0.012",
                  fc="#f2f5f9", ec="#d4dde8", lw=1))
    ax2.text(0.015, y - 0.022, rund, fontsize=11.5, fontweight="bold", color=DARK)
    ax2.text(0.015, y - 0.075, skift, fontsize=10.3, color="#33475e")
    ax2.text(0.985, y - 0.022, f"Kaptajn: {cap}", fontsize=10.3,
             fontweight="bold", color="#9a7b10", ha="right")
    y -= 0.150
ax2.text(0.0, y + 0.02,
         "Guldhold · forventet nettovækst +5,93 mio. · Basishold (3 kontrakter): "
         "R2 Haaland→Kane, R3 Arias→Sarr, R4 De Fougerolles→Kounde.",
         fontsize=9.5, color="#5a6b7e", style="italic")

plt.savefig("out/holdtegning.png", dpi=160, bbox_inches="tight")
print("gemt: out/holdtegning.png")
