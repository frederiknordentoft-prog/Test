# -*- coding: utf-8 -*-
"""Det eksakte holdet.dk VM Manager 2026-pointsystem (aflæst fra Regler.txt)."""

SCORING = {
    # Mål og assist (vækst i kr.)
    "goal":        {"GK": 250_000, "DEF": 175_000, "MID": 150_000, "ATT": 125_000},
    "own_goal":    -50_000,
    "assist":       60_000,   # ikke ved straffe, selvmål, riposter
    "shot_on_target": 10_000, # KUN skud på mål der IKKE bliver mål (jf. Regler.txt)

    # Afgørende scoring (én pr. kamp, til målscoreren)
    "decisive_win":  40_000,
    "decisive_draw": 20_000,

    "motm":          33_000,  # kampens spiller (1 pr. kamp)

    # Fairplay
    "yellow":       -20_000,
    "second_yellow":-20_000,
    "red":          -50_000,

    # Holdpræstation (alle spillere der var på banen)
    "result":      {"W": 25_000, "D": 5_000, "L": -8_000},
    "team_goal":     10_000,  # pr. mål holdet scorer
    "conceded":      -8_000,  # pr. mål holdet indkasserer

    # Special
    "appear":         7_000,  # på banen
    "no_appear":     -5_000,  # i truppen men ikke på banen
    "clean_sheet":  {"GK": 75_000, "DEF": 50_000, "MID": 0, "ATT": 0},  # kræver 60+ min
    "gk_save":        5_000,
    "saved_penalty": 100_000,
    "missed_penalty":-30_000,
    "hattrick":      100_000,
    "shootout_win":   25_000,
}

CAPTAIN_MULT  = 2.0    # kaptajnbonus = vækst * 1  =>  x2
BANK_RATE     = 0.01   # 1% pr. runde af uforbrugt budget (rapporteres, driver ikke optimering)
TRANSFER_RATE = 0.01   # 1% af KØBT spillers pris; R1-opbygning gratis
BUDGET        = 50.0   # mio.

# Holdet.dk fodbold-formationer: 3-4-3, 3-5-2, 4-3-3, 4-4-2, 4-5-1, 5-3-2, 5-4-1
# => GK=1, DEF 3-5, MID 3-5, ATT 1-3 (5-2-3 o.l. er IKKE tilladt)
FORMATION = {"GK": (1, 1), "DEF": (3, 5), "MID": (3, 5), "ATT": (1, 3)}
MAX_PER_NATION_GROUP = 4   # frem til kvartfinalerne; derefter fri
