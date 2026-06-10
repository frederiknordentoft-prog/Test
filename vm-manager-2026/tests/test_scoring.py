# -*- coding: utf-8 -*-
"""Enhedstest: pointsystemet matcher Regler.txt 1:1 + sim-sanity."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from src.scoring import SCORING, CAPTAIN_MULT


def test_point_values_match_rules():
    assert SCORING["goal"] == {"GK": 250_000, "DEF": 175_000, "MID": 150_000, "ATT": 125_000}
    assert SCORING["own_goal"] == -50_000
    assert SCORING["assist"] == 60_000
    assert SCORING["shot_on_target"] == 10_000
    assert SCORING["decisive_win"] == 40_000
    assert SCORING["decisive_draw"] == 20_000
    assert SCORING["motm"] == 33_000
    assert SCORING["yellow"] == -20_000
    assert SCORING["red"] == -50_000
    assert SCORING["result"] == {"W": 25_000, "D": 5_000, "L": -8_000}
    assert SCORING["team_goal"] == 10_000
    assert SCORING["conceded"] == -8_000
    assert SCORING["appear"] == 7_000
    assert SCORING["no_appear"] == -5_000
    assert SCORING["clean_sheet"]["GK"] == 75_000
    assert SCORING["clean_sheet"]["DEF"] == 50_000
    assert SCORING["gk_save"] == 5_000
    assert SCORING["saved_penalty"] == 100_000
    assert SCORING["missed_penalty"] == -30_000
    assert SCORING["hattrick"] == 100_000
    assert SCORING["shootout_win"] == 25_000
    assert CAPTAIN_MULT == 2.0


def test_defender_4_0_example():
    # Regler-eksempel fra spec: forsvarer, 4-0-sejr, fuld tid, ingen egne aktioner:
    # 25k(sejr) + 4*10k(holdmål) + 50k(rent mål) + 7k(på banen) = 122k
    total = (SCORING["result"]["W"] + 4 * SCORING["team_goal"]
             + SCORING["clean_sheet"]["DEF"] + SCORING["appear"])
    assert total == 122_000


if __name__ == "__main__":
    test_point_values_match_rules()
    test_defender_4_0_example()
    print("Alle scoring-tests bestået.")
