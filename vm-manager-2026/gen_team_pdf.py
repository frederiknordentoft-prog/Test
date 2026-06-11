#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Holdplan-PDF i holdet.dk-stil: bane, kampprogram, plan og appendiks."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mp
from matplotlib.backends.backend_pdf import PdfPages

# ---- farver (holdet.dk-app-inspireret) ----
PURPLE = "#2a1545"
PURPLE2 = "#3d2261"
YELLOW = "#ffd84d"
PITCH = "#3a9e57"
PITCH2 = "#43ab61"
LINE = "#e8f5e9"
CARD = "#ffffff"
DARK = "#1c1130"
GOLD = "#f5c542"
GREEN_OK = "#c8e6c9"
YELL_MID = "#fff3c4"
RED_HARD = "#ffcdd2"

NATION_COL = {"Spanien": "#c60b1e", "Tyskland": "#1a1a1a", "Brasilien": "#ffdf00",
              "USA": "#3c3b6e", "Canada": "#d52b1e", "Ecuador": "#ffd100",
              "Frankrig": "#0055a4", "Colombia": "#fcd116", "Norge": "#ba0c2f",
              "England": "#cf081f", "Senegal": "#00853f", "Marokko": "#c1272d"}

# (navn, land, pris, x, y, kaptajn)
XI = [
    ("Unai Simon", "Spanien", "5.000.000", 0.50, 0.875, False),
    ("N. Brown", "Tyskland", "2.500.000", 0.13, 0.66, False),
    ("Bremer", "Brasilien", "3.000.000", 0.38, 0.62, False),
    ("A. Robinson", "USA", "2.000.000", 0.62, 0.62, False),
    ("L. De Fougerolles", "Canada", "2.000.000", 0.87, 0.66, False),
    ("M. Caicedo", "Ecuador", "3.000.000", 0.22, 0.40, False),
    ("A. Tchouameni", "Frankrig", "3.500.000", 0.50, 0.36, False),
    ("Jhon Arias", "Colombia", "3.000.000", 0.78, 0.40, False),
    ("M. Oyarzabal", "Spanien", "7.500.000", 0.20, 0.15, False),
    ("K. Mbappe", "Frankrig", "10.000.000", 0.50, 0.11, False),
    ("E. Haaland", "Norge", "8.500.000", 0.80, 0.15, True),
]

# spiller -> [(runde, modstander, dato, sværhed g/y/r)]
FIXTURES = {
    "Unai Simon":        ("Spanien",  [("R1", "Kap Verde", "15/6", "g"), ("R2", "Saudi-Arabien", "21/6", "g"), ("R3", "Uruguay", "26/6", "y")]),
    "M. Oyarzabal":      ("Spanien",  [("R1", "Kap Verde", "15/6", "g"), ("R2", "Saudi-Arabien", "21/6", "g"), ("R3", "Uruguay", "26/6", "y")]),
    "N. Brown":          ("Tyskland", [("R1", "Curaçao", "14/6", "g"), ("R2", "Elfenbenskysten", "20/6", "y"), ("R3", "Ecuador", "25/6", "y")]),
    "Bremer":            ("Brasilien",[("R1", "Marokko", "13/6", "y"), ("R2", "Haiti", "19/6", "g"), ("R3", "Skotland", "24/6", "g")]),
    "A. Robinson":       ("USA",      [("R1", "Paraguay", "12/6", "y"), ("R2", "Australien", "19/6", "y"), ("R3", "Tyrkiet", "25/6", "r")]),
    "L. De Fougerolles": ("Canada",   [("R1", "Bosnien-Herc.", "12/6", "y"), ("R2", "Qatar", "18/6", "g"), ("R3", "Schweiz", "24/6", "r")]),
    "M. Caicedo":        ("Ecuador",  [("R1", "Elfenbenskysten", "14/6", "y"), ("R2", "Curaçao", "20/6", "g"), ("R3", "Tyskland", "25/6", "r")]),
    "A. Tchouameni":     ("Frankrig", [("R1", "Senegal", "16/6", "y"), ("R2", "Irak", "22/6", "g"), ("R3", "Norge", "26/6", "y")]),
    "K. Mbappe":         ("Frankrig", [("R1", "Senegal", "16/6", "y"), ("R2", "Irak", "22/6", "g"), ("R3", "Norge", "26/6", "y")]),
    "Jhon Arias":        ("Colombia", [("R1", "Usbekistan", "17/6", "y"), ("R2", "Congo DR", "23/6", "g"), ("R3", "Portugal", "27/6", "r")]),
    "E. Haaland":        ("Norge",    [("R1", "Irak", "16/6", "g"), ("R2", "Senegal", "22/6", "y"), ("R3", "Frankrig", "26/6", "r")]),
}
SHADE = {"g": GREEN_OK, "y": YELL_MID, "r": RED_HARD}

PLAN = [
    ("RUNDE 2", "18.-23. juni", "UD: Haaland → IND: Harry Kane (9,5m, England)",
     "Mbappe (mod Irak)", "Norge får Senegal/Frankrig — England får Ghana + Panama. Kane overtager den lette sti."),
    ("RUNDE 3", "24.-27. juni", "UD: Arias, Caicedo, De Fougerolles → IND: Sarr (3,5m, Senegal), Ounahi (3,0m, Marokko), Koulibaly (2,5m, Senegal)",
     "Kane (mod Panama)", "Senegal-Irak og Marokko-Haiti er rundens favoritkampe. England er sjældent 'safe' før kamp 3 — Kane spiller."),
    ("RUNDE 4", "1/16-finaler", "UD: Koulibaly → IND: Kounde (3,5m, Frankrig)",
     "Mbappe", "Konsolidering mod Frankrig-blokken. Genoptimér når bracketen kendes!"),
    ("RUNDE 5", "1/8-finaler", "UD: Robinson → IND: Reece James (3,5m, England)",
     "Mbappe", "USA's forventede exit — England-blokken udvides."),
    ("RUNDE 6-7", "KF → Finale", "Ingen skift",
     "Mbappe", "Kernen Spanien/Frankrig/England (23/21/18% finalesandsynlighed) står hele vejen."),
]

APPENDIX = [
    ("MÅL & FORSVAR", [
        ("Unai Simon", "Spanien", "Bekræftet førstevalg af De la Fuente i sidste testkamp. Spanien har turneringens bedste holdbarhed (98% R32, 23% finale) og clean sheet-favorit i R1-R2 — købes én gang, skiftes aldrig."),
        ("Nathaniel Brown", "Tyskland", "Bekræftet venstre back hos R1's største favorit (mu 2,9 mod Curaçao). Spillets bedste value (31k/mio.) og offensivt potentiale. Også Bold-ekspertens topvalg."),
        ("Bremer", "Brasilien", "Fast CB efter Militãos korsbåndsskade (ESPN 10/6). Brasilien møder Haiti og Skotland i R2-R3 — høj clean sheet-frekvens og holdbarhed til 1/8-finalen (62% R16)."),
        ("Antonee Robinson", "USA", "Bekræftet wingback (klassificeret FORSVAR i spillet = clean sheet-bonus trods offensiv rolle). Værtsnation, og Paraguay mangler deres profil Enciso i R1. OBS: Antonee — ikke Miles!"),
        ("Luc De Fougerolles", "Canada", "Starter i midterforsvaret pga. Bombito-skade (Bold 9/6). Canada er hjemmefavorit mod Bosnien og storfavorit mod Qatar i R2 — til spillets billigste pris."),
    ]),
    ("MIDTBANE", [
        ("Moises Caicedo", "Ecuador", "Bekræftet starter. Ecuador indkasserede kun 5 mål i 18 kvalifikationskampe — og R2 mod Curaçao er en af turneringens største clean sheet-chancer."),
        ("Aurelien Tchouameni", "Frankrig", "Bekræftet starter og billigste vej ind i Frankrig-blokken (21% finale). Beholdes hele turneringen — nul transfergebyr, ren holdbarhed."),
        ("Jhon Arias", "Colombia", "Bekræftet starter, scorede 2 mål i sidste testkamp. Kreativ dødboldsprofil med Usbekistan og Congo DR i de to første runder."),
    ]),
    ("ANGREB", [
        ("Mikel Oyarzabal", "Spanien", "Straffeskytte hos R1's næststørste favorit. 6 mål + 4 assists og 1,25 xG/90 i kvalifikationen. GB-odds +1400. Beholdes hele vejen — Spanien er modellens mest sandsynlige finalist."),
        ("Kylian Mbappe", "Frankrig", "Golden Boot-favorit (+600), straffeskytte, modellens højeste samlede EV (4,5 forventede turneringsmål). Kaptajn fra R2 (mod Irak!) og hele knockoutfasen."),
        ("Erling Haaland (C)", "Norge", "KAPTAJN R1: Højeste enkeltkamp-EV i hele runden (Irak, mu 2,1) og mest sandsynlige hattrickskytte — 16 mål i 8 kval-kampe. Sælges bevidst efter R1: Norge har dødens gruppe (Senegal + Frankrig) bagefter. 1-rundes leje med dobbelt kaptajnbonus."),
    ]),
    ("PLANLAGTE KØB", [
        ("Harry Kane (R2)", "England", "Straffeskytte, GB-odds +700, 4,5 forventede mål. England-stien (Ghana, Panama) er perfekt R2-R3, og han er R3-kaptajn mod Panama — England er sjældent 'safe' inden, så rotationsrisikoen er lav (29%)."),
        ("Ismaila Sarr (R3)", "Senegal", "Bekræftet starter (grøn). Senegal-Irak i R3 er en af rundens største favoritkampe."),
        ("Azzedine Ounahi (R3)", "Marokko", "Bekræftet starter (grøn). Marokko-Haiti i R3 — favoritkamp, og Marokko har 92% R32-sandsynlighed."),
        ("Kalidou Koulibaly (R3)", "Senegal", "Bekræftet starter (grøn), 2,5m — clean sheet-chance mod Irak. Sælges igen i R4 (1 rundes leje)."),
        ("Jules Kounde (R4)", "Frankrig", "Bekræftet starter. Udvider Frankrig-blokken til knockout — 21% finalesandsynlighed."),
        ("Reece James (R5)", "England", "I Englands XI (Bold). Offensiv back på finalistkandidat til 1/8-finalen og frem."),
    ]),
]

A4 = (8.27, 11.69)
out = "out/holdplan.pdf"

with PdfPages(out) as pdf:
    # ================= SIDE 1: HOLDET =================
    fig = plt.figure(figsize=A4, facecolor=PURPLE)
    # header
    axh = fig.add_axes([0, 0.88, 1, 0.12]); axh.axis("off")
    axh.set_xlim(0, 1); axh.set_ylim(0, 1)
    axh.add_patch(mp.Rectangle((0, 0), 1, 1, fc=PURPLE, ec="none"))
    axh.text(0.05, 0.66, "VM MANAGER 2026", color=YELLOW, fontsize=20, fontweight="bold")
    axh.text(0.05, 0.36, "Middelmådige Arkæologer", color="white", fontsize=14)
    axh.text(0.05, 0.12, "FNordentoft  ·  Runde 1  ·  deadline 11. juni", color="#b9a8d8", fontsize=10)
    axh.add_patch(mp.FancyBboxPatch((0.70, 0.30), 0.25, 0.42, boxstyle="round,pad=0.01,rounding_size=0.02",
                                    fc=PURPLE2, ec=YELLOW, lw=1.2))
    axh.text(0.825, 0.585, "Forventet vækst R1", color="#b9a8d8", fontsize=8.5, ha="center")
    axh.text(0.825, 0.395, "+1,13 mio.", color=YELLOW, fontsize=15, fontweight="bold", ha="center")

    # bane
    ax = fig.add_axes([0.05, 0.05, 0.90, 0.80]); ax.axis("off")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.add_patch(mp.FancyBboxPatch((0, 0), 1, 1, boxstyle="round,pad=0.005,rounding_size=0.02", fc=PITCH, ec="none"))
    for i in range(7):
        if i % 2 == 0:
            ax.add_patch(mp.Rectangle((0.005, 0.01 + i * 0.14), 0.99, 0.14, fc=PITCH2, ec="none"))
    ax.add_patch(mp.Rectangle((0.02, 0.015), 0.96, 0.97, fill=False, ec=LINE, lw=1.8))
    ax.add_patch(mp.Rectangle((0.32, 0.915), 0.36, 0.07, fill=False, ec=LINE, lw=1.8))
    ax.add_patch(mp.Rectangle((0.40, 0.955), 0.20, 0.032, fill=False, ec=LINE, lw=1.8))
    ax.plot([0.02, 0.98], [0.015, 0.015], color=LINE, lw=1.8)
    ax.add_patch(mp.Circle((0.5, 0.015), 0.10, fill=False, ec=LINE, lw=1.8))

    for navn, land, pris, x, y, cap in XI:
        w, h = 0.215, 0.085
        ax.add_patch(mp.FancyBboxPatch((x - w/2, y - h/2), w, h,
                     boxstyle="round,pad=0.004,rounding_size=0.012",
                     fc=CARD, ec=GOLD if cap else "#cfd8dc", lw=2.6 if cap else 1.0, zorder=3))
        ax.add_patch(mp.Rectangle((x - w/2 + 0.008, y + h/2 - 0.0235), 0.028, 0.013,
                     fc=NATION_COL.get(land, "#888"), ec="none", zorder=4))
        ax.text(x + 0.018, y + h/2 - 0.017, land, fontsize=7.2, color="#5f6b76",
                ha="left", va="center", zorder=4)
        ax.text(x, y + 0.001, navn, fontsize=9.2, fontweight="bold", color=DARK,
                ha="center", va="center", zorder=4)
        ax.text(x, y - h/2 + 0.016, pris, fontsize=7.8, color="#5f6b76",
                ha="center", va="center", zorder=4)
        if cap:
            ax.add_patch(mp.Circle((x + w/2 - 0.012, y + h/2 - 0.004), 0.016, fc=GOLD, ec="white", lw=1.2, zorder=5))
            ax.text(x + w/2 - 0.012, y + h/2 - 0.0045, "C", fontsize=9, fontweight="bold",
                    color=DARK, ha="center", va="center", zorder=6)

    ax.text(0.5, -0.035, "4-3-3  ·  50,0 mio. / 50,0 mio.  ·  Kaptajn: Erling Haaland (mod Irak 16/6)",
            color="white", fontsize=10.5, ha="center", fontweight="bold")
    pdf.savefig(fig, facecolor=PURPLE); plt.close(fig)

    # ================= SIDE 2: KAMPPROGRAM + PLAN =================
    fig = plt.figure(figsize=A4, facecolor="white")
    ax = fig.add_axes([0.05, 0.04, 0.90, 0.93]); ax.axis("off")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.add_patch(mp.Rectangle((-0.06, 0.962), 1.12, 0.06, fc=PURPLE, ec="none"))
    ax.text(0.0, 0.978, "KAMPPROGRAM — GRUPPESPILLET", color=YELLOW, fontsize=14, fontweight="bold", va="center")

    y = 0.935
    ax.text(0.00, y, "Spiller", fontsize=9, fontweight="bold", color=DARK)
    ax.text(0.22, y, "Land", fontsize=9, fontweight="bold", color=DARK)
    ax.text(0.38, y, "Runde 1", fontsize=9, fontweight="bold", color=DARK)
    ax.text(0.60, y, "Runde 2", fontsize=9, fontweight="bold", color=DARK)
    ax.text(0.82, y, "Runde 3", fontsize=9, fontweight="bold", color=DARK)
    y -= 0.012
    for navn, _land, pris, _x, _y, cap in XI:
        land, fx = FIXTURES[navn]
        y -= 0.030
        ax.add_patch(mp.Rectangle((-0.01, y - 0.011), 1.02, 0.027, fc="#f6f4fa" , ec="none"))
        ax.text(0.00, y, navn + ("  (C)" if cap else ""), fontsize=8.8,
                fontweight="bold" if cap else "normal", color=DARK)
        ax.add_patch(mp.Rectangle((0.215, y - 0.004), 0.012, 0.012, fc=NATION_COL.get(land, "#888"), ec="none"))
        ax.text(0.235, y, land, fontsize=8.6, color="#444")
        for (col, (_r, opp, dato, s)) in zip([0.38, 0.60, 0.82], fx):
            ax.add_patch(mp.FancyBboxPatch((col - 0.008, y - 0.0115), 0.195, 0.026,
                         boxstyle="round,pad=0.002,rounding_size=0.006", fc=SHADE[s], ec="none"))
            ax.text(col, y, f"{opp}  ·  {dato}", fontsize=7.9, color=DARK)
    y -= 0.045
    ax.text(0.00, y, "■", color=GREEN_OK, fontsize=10)
    ax.text(0.025, y, "let kamp (favorit)", fontsize=8, color="#444")
    ax.text(0.22, y, "■", color=YELL_MID, fontsize=10)
    ax.text(0.245, y, "mellem", fontsize=8, color="#444")
    ax.text(0.38, y, "■", color=RED_HARD, fontsize=10)
    ax.text(0.405, y, "svær (planlagt solgt inden / accepteret)", fontsize=8, color="#444")

    y -= 0.055
    ax.add_patch(mp.Rectangle((-0.06, y - 0.012), 1.12, 0.052, fc=PURPLE, ec="none"))
    ax.text(0.0, y, "UDSKIFTNINGSPLAN — RUNDE FOR RUNDE", color=YELLOW, fontsize=14, fontweight="bold", va="center")
    y -= 0.045
    for rund, dato, skift, cap, why in PLAN:
        h = 0.082
        ax.add_patch(mp.FancyBboxPatch((-0.01, y - h + 0.012), 1.02, h,
                     boxstyle="round,pad=0.004,rounding_size=0.010", fc="#f6f4fa", ec="#ddd5ea", lw=1))
        ax.text(0.005, y - 0.006, rund, fontsize=10.5, fontweight="bold", color=PURPLE)
        ax.text(0.155, y - 0.006, dato, fontsize=8.6, color="#777")
        ax.text(0.995, y - 0.006, f"Kaptajn: {cap}", fontsize=9, fontweight="bold", color="#9a7b10", ha="right")
        ax.text(0.005, y - 0.031, skift, fontsize=8.8, color=DARK)
        ax.text(0.005, y - 0.054, why, fontsize=7.8, color="#666", style="italic")
        y -= h + 0.012
    ax.text(0.0, y - 0.005, "Guldhold: i alt ~8 skift, gebyrer ~455k — forventet samlet nettovækst +5,93 mio.   ·   "
            "Basishold (3 kontrakter): R2 Haaland→Kane · R3 Arias→Sarr · R4 De Fougerolles→Kounde",
            fontsize=8, color="#666")
    pdf.savefig(fig); plt.close(fig)

    # ================= SIDE 3: APPENDIKS =================
    fig = plt.figure(figsize=A4, facecolor="white")
    ax = fig.add_axes([0.05, 0.03, 0.90, 0.95]); ax.axis("off")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.add_patch(mp.Rectangle((-0.06, 0.97), 1.12, 0.05, fc=PURPLE, ec="none"))
    ax.text(0.0, 0.983, "APPENDIKS — DERFOR ER DE PÅ HOLDET", color=YELLOW, fontsize=14, fontweight="bold", va="center")

    import textwrap
    y = 0.945
    for sektion, rows in APPENDIX:
        ax.text(0.0, y, sektion, fontsize=11, fontweight="bold", color=PURPLE)
        y -= 0.008
        ax.plot([0, 1], [y, y], color="#ddd5ea", lw=1)
        y -= 0.020
        for navn, land, why in rows:
            ax.add_patch(mp.Rectangle((0.0, y - 0.003), 0.011, 0.011, fc=NATION_COL.get(land, "#888"), ec="none"))
            ax.text(0.02, y, f"{navn}  ·  {land}", fontsize=9.2, fontweight="bold", color=DARK)
            y -= 0.0155
            for ln in textwrap.wrap(why, 118):
                ax.text(0.02, y, ln, fontsize=7.8, color="#444")
                y -= 0.0126
            y -= 0.005
        y -= 0.010
    ax.text(0.0, 0.012, "Model: markedsdrevne odds (outright + Golden Boot) → 24.000 turneringssimulationer → eksakt holdet.dk-pointsystem → "
            "flerrunde-optimering. Genkøres før hver rundedeadline.", fontsize=7.2, color="#999")
    pdf.savefig(fig); plt.close(fig)

print(f"gemt: {out}")
