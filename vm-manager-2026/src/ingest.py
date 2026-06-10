# -*- coding: utf-8 -*-
"""Indlæsning af priser, outright-odds, topscorer-odds og kampprogram."""
import csv, unicodedata, os

DATA = os.path.join(os.path.dirname(__file__), "..", "data")

POS_MAP = {"Keeper": "GK", "Målvogter": "GK", "Forsvar": "DEF",
           "Midtbane": "MID", "Angreb": "ATT", "Angriber": "ATT"}


def norm_name(s):
    s = s.lower().replace("ø", "o").replace("æ", "ae").replace("å", "aa") \
         .replace("ß", "ss").replace("ð", "d").replace("þ", "th")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return " ".join(sorted(s.replace("-", " ").split()))


def load_prices():
    players = []
    with open(os.path.join(DATA, "prices.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f, delimiter=";"):
            players.append(dict(
                name=r["Navn"].strip(),
                team=r["Hold"].strip(),
                pos=POS_MAP[r["Position"].strip()],
                price=int(r["Pris"]) / 1e6,
                pop=float(r["Popularitet (%)"].replace(",", ".")),
                out=r["Ude"].strip().lower() == "ja",
            ))
    return players


def american_to_prob(am):
    am = float(am)
    return 100.0 / (am + 100.0) if am > 0 else -am / (-am + 100.0)


def load_outright():
    """Outright vinder-odds -> de-viggede titelsandsynligheder (sum=1)."""
    raw = {}
    with open(os.path.join(DATA, "odds_outright.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            raw[r["team"]] = american_to_prob(r["american"])
    s = sum(raw.values())
    return {t: p / s for t, p in raw.items()}


def load_scorer_odds():
    """Golden Boot-odds -> normaliserede sandsynligheder (sum=FIELD_MASS)."""
    FIELD_MASS = 0.92  # 8% til unavngivne spillere
    rows = []
    with open(os.path.join(DATA, "odds_scorer.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(dict(player=r["player"].strip(), team=r["team"].strip(),
                             q=american_to_prob(r["gb_american"]),
                             pen=r["pen_taker"].strip() == "1"))
    s = sum(r["q"] for r in rows)
    for r in rows:
        r["q"] *= FIELD_MASS / s
    return rows


def load_fixtures():
    out = []
    with open(os.path.join(DATA, "fixtures.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out.append((r["round"], r["group"], r["home"], r["away"]))
    return out


GROUPS = {
    "A": ["Mexico", "Sydafrika", "Sydkorea", "Tjekkiet"],
    "B": ["Canada", "Bosnien-Hercegovina", "Qatar", "Schweiz"],
    "C": ["Brasilien", "Marokko", "Haiti", "Skotland"],
    "D": ["USA", "Paraguay", "Australien", "Tyrkiet"],
    "E": ["Tyskland", "Curaçao", "Elfenbenskysten", "Ecuador"],
    "F": ["Holland", "Japan", "Sverige", "Tunesien"],
    "G": ["Belgien", "Egypten", "Iran", "New Zealand"],
    "H": ["Spanien", "Kap Verde", "Saudi-Arabien", "Uruguay"],
    "I": ["Frankrig", "Senegal", "Irak", "Norge"],
    "J": ["Argentina", "Algeriet", "Østrig", "Jordan"],
    "K": ["Portugal", "Congo DR", "Usbekistan", "Colombia"],
    "L": ["England", "Kroatien", "Ghana", "Panama"],
}


def match_scorer_to_prices(scorer_rows, players):
    """Match GB-odds-navne til pris-CSV via normaliseret navn + hold."""
    by_team = {}
    for i, p in enumerate(players):
        by_team.setdefault(p["team"], {}).setdefault(norm_name(p["name"]), i)
    matched, unmatched = {}, []
    for r in scorer_rows:
        team_map = by_team.get(r["team"], {})
        key = norm_name(r["player"])
        idx = team_map.get(key)
        if idx is None:
            # fallback: efternavnsmatch inden for holdet (sidste token i RÅT navn)
            raw_last = norm_name(r["player"].split()[-1])
            cands = [i for k_, i in team_map.items() if raw_last and raw_last in k_.split()]
            idx = cands[0] if len(cands) == 1 else None
        if idx is None:
            unmatched.append((r["player"], r["team"]))
        else:
            matched[idx] = r
    return matched, unmatched
