#!/usr/bin/env python3
"""Samler S1-målingerne (meta.jsonl + asr*.jsonl) til tal og tabeller for docs/voice.md.

  python3 report.py            # skriver voice/probe/s1-results.json og printer markdown

Kun standardbiblioteket, så scriptet kan køres med ethvert python3.
"""
from __future__ import annotations

import json
import statistics as stats
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[1]
TAKES = ROOT / "voice" / "probe" / "takes"
OUT = ROOT / "voice" / "probe" / "s1-results.json"

TIE_PP = 0.5            # stemmevalg: lighed inden for ±0,5 procentpoint → Nic
WINDOW = (0.5, 2.0)     # varighedsvindue × forventet
RULE_SHARE = 0.20       # > 20 % uden for vinduet → bæresætning
INVENTORY_CLIPS = 2000
INVENTORY_MIN = 48.0
RETAKE_SHARE = 0.15
MIN_SYLL_ALONE = 3      # SPEC §10.4: klip under 3 stavelser tjekkes kun i sammensætning

# Inventarets sammensætning (SPEC §10.2) med anslået varighed pr. klip; skaleres til 48 min.
# kind: "short" batches som ord/fraser (K=10), "sentence" som hele sætninger (K=4).
INVENTORY_MIX = [
    ("tal, hundreder, tusind", 233, 0.75, "short"),
    ("tidsfraser og dagtid", 174, 1.2, "short"),
    ("operatorer og forbindere", 180, 0.6, "short"),
    ("katalognavneord", 150, 0.7, "short"),
    ("hint-skabelonled", 100, 1.0, "short"),
    ("navne", 370, 0.8, "short"),
    ("hele spørgesætninger q.*", 271, 2.1, "sentence"),
    ("faste sætninger s.*", 480, 2.4, "sentence"),
]


def load(tag: str, name: str = "meta.jsonl") -> list[dict]:
    p = TAKES / tag / name
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()]


def joined(tag: str, asr_name: str = "asr.jsonl") -> list[dict]:
    meta = {(r["id"], r["voice"], r["take"]): r for r in load(tag)}
    return [{**meta.get((a["id"], a["voice"], a["take"]), {}), **a} for a in load(tag, asr_name)]


def agg_cer(rows: list[dict]) -> float:
    e = sum(r["edits"] for r in rows)
    n = sum(r["ref_len"] for r in rows)
    return e / n if n else float("nan")


def linfit(xs: list[float], ys: list[float]):
    mx, my = stats.fmean(xs), stats.fmean(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    return my - b * mx, b


def pct(x: float) -> str:
    return f"{100 * x:.1f} %"


def syll(text: str) -> int:
    from da_text import syllables
    return syllables(text)


def in_window(r: dict) -> bool:
    return WINDOW[0] <= r["dur"] / r["exp_dur"] <= WINDOW[1]


# --- stemmevalg -------------------------------------------------------------

def voices_section(res: dict):
    rows = joined("probe12")
    if not rows:
        return
    wh = {(r["id"], r["voice"], r["take"]): r for r in load("probe12", "asr-whisper.jsonl")}
    vs = {}
    for v in sorted({r["voice"] for r in rows}):
        rv = [r for r in rows if r["voice"] == v]
        takes = sorted({r["take"] for r in rv})
        best = [min((r for r in rv if r["id"] == sid), key=lambda r: r["cer"])
                for sid in sorted({r["id"] for r in rv})]
        rw = [wh[(r["id"], v, r["take"])] for r in rv if (r["id"], v, r["take"]) in wh]
        both_fail = [r for r in rv if not r["pass"] and not wh.get((r["id"], v, r["take"]), {}).get("pass", False)]
        vs[v] = {
            "n": len(rv),
            "cer_all": agg_cer(rv),
            "cer_per_take": {t: agg_cer([r for r in rv if r["take"] == t]) for t in takes},
            "cer_best_of_takes": agg_cer(best),
            "pass_rate": sum(r["pass"] for r in rv) / len(rv),
            "whisper_cer_all": agg_cer(rw) if rw else None,
            "whisper_pass_rate": sum(r["pass"] for r in rw) / len(rw) if rw else None,
            "fail_both_asr_rate": len(both_fail) / len(rv) if rw else None,
            "per_sentence": {sid: [r["cer"] for r in sorted(rv, key=lambda r: r["take"]) if r["id"] == sid]
                             for sid in sorted({r["id"] for r in rv})},
        }
    res["voices"] = vs
    if {"mic", "nic"} <= vs.keys():
        d = 100 * (vs["mic"]["cer_all"] - vs["nic"]["cer_all"])
        winner = "nic" if d >= -TIE_PP else "mic"
        res["voice_winner"] = winner
        res["voice_delta_pp_mic_minus_nic"] = round(d, 2)
        res["voice_reason"] = ("lighed inden for ±0,5 pp → Nic" if abs(d) <= TIE_PP else
                               f"lavest samlet CER med roest-wav2vec2 ({winner})")
    print("\n### Stemmevalg (12 probesætninger × 2 takes)\n")
    print("| Stemme | CER wav2vec2 (alle takes) | take 0 | take 1 | bedste take pr. sætning | bestået | "
          "CER whisper (second opinion) | ingen ASR godkender |")
    print("|---|---|---|---|---|---|---|---|")
    for v, d in vs.items():
        t = list(d["cer_per_take"].values())
        print(f"| {v} | **{pct(d['cer_all'])}** | {pct(t[0])} | {pct(t[1]) if len(t) > 1 else '–'} | "
              f"{pct(d['cer_best_of_takes'])} | {d['pass_rate'] * 100:.0f} % | "
              f"{pct(d['whisper_cer_all']) if d['whisper_cer_all'] is not None else '–'} | "
              f"{d['fail_both_asr_rate'] * 100:.0f} % |" if d["fail_both_asr_rate"] is not None else "")
    if "voice_winner" in res:
        print(f"\nVinder: {res['voice_winner']} ({res['voice_reason']}; Mic − Nic = "
              f"{res['voice_delta_pp_mic_minus_nic']:+.2f} pp)")


# --- RTF --------------------------------------------------------------------

def rtf_section(res: dict):
    base = [r for r in load("probe12") if r["take"] == 0] + load("rtf8")
    if not base:
        return
    out = {}
    for v in sorted({r["voice"] for r in base}):
        rv = [r for r in base if r["voice"] == v and r["threads"] == 2]
        a, b = linfit([r["raw_dur"] for r in rv], [r["t_total"] for r in rv])
        a3, b3 = linfit([r["raw_dur"] for r in rv], [r.get("t_t3", 0) for r in rv])
        a_s, b_s = linfit([r["raw_dur"] for r in rv], [r.get("t_s3gen", 0) for r in rv])
        out[v] = {
            "n": len(rv),
            "sum_compute_s": round(sum(r["t_total"] for r in rv), 1),
            "sum_audio_raw_s": round(sum(r["raw_dur"] for r in rv), 2),
            "sum_audio_final_s": round(sum(r["dur"] for r in rv), 2),
            "rtf_aggregate_raw": sum(r["t_total"] for r in rv) / sum(r["raw_dur"] for r in rv),
            "rtf_aggregate_final": sum(r["t_total"] for r in rv) / sum(r["dur"] for r in rv),
            "rtf_median_per_clip": stats.median(r["t_total"] / r["raw_dur"] for r in rv),
            "overhead_s": a, "marginal_rtf": b,
            "t3_overhead_s": a3, "t3_marginal": b3, "s3gen_overhead_s": a_s, "s3gen_marginal": b_s,
            "t3_tokens_per_s": sum(r["n_tokens"] for r in rv) / sum(r.get("t_t3", 0) for r in rv),
            "mean_t3_s": stats.fmean(r.get("t_t3", 0) for r in rv),
            "mean_s3gen_s": stats.fmean(r.get("t_s3gen", 0) for r in rv),
            "mean_wm_s": stats.fmean(r.get("t_wm", 0) for r in rv),
            "raw_over_final": sum(r["raw_dur"] for r in rv) / sum(r["dur"] for r in rv),
            "mean_load1": stats.fmean(r["load1"] for r in rv),
        }
    res["rtf_2threads"] = out
    t4 = load("probe12-t4")
    if t4:
        two = {(r["id"], r["voice"]): r for r in load("probe12") if r["take"] == 0}
        pairs = [(two[(r["id"], r["voice"])], r) for r in t4 if (r["id"], r["voice"]) in two]
        s2 = sum(p[0]["t_total"] for p in pairs)
        s4 = sum(p[1]["t_total"] for p in pairs)
        d2 = sum(p[0]["raw_dur"] for p in pairs)
        d4 = sum(p[1]["raw_dur"] for p in pairs)
        med = stats.median(p[0]["t_total"] / p[1]["t_total"] for p in pairs)
        res["rtf_4threads"] = {
            "n": len(pairs), "rtf_2": s2 / d2, "rtf_4": s4 / d4, "speedup_sum": s2 / s4,
            "speedup_median": med, "same_audio": all(abs(p[0]["raw_dur"] - p[1]["raw_dur"]) < 1e-6 for p in pairs),
        }
    print("\n### RTF (2 tråde, 20 probeklip pr. stemme)\n")
    print("| Stemme | klip | beregning | lyd (rå) | RTF samlet | median RTF pr. klip | overhead pr. kald | "
          "marginal RTF | T3 tokens/s |")
    print("|---|---|---|---|---|---|---|---|---|")
    for v, d in out.items():
        print(f"| {v} | {d['n']} | {d['sum_compute_s']:.0f} s | {d['sum_audio_raw_s']:.1f} s | "
              f"{d['rtf_aggregate_raw']:.2f} | {d['rtf_median_per_clip']:.2f} | {d['overhead_s']:.1f} s | "
              f"{d['marginal_rtf']:.2f} | {d['t3_tokens_per_s']:.1f} |")
    if "rtf_4threads" in res:
        d = res["rtf_4threads"]
        print(f"\n4 tråde ({d['n']} klip): RTF {d['rtf_4']:.2f} mod {d['rtf_2']:.2f} ved 2 tråde "
              f"(faktor {d['speedup_sum']:.2f}, median {d['speedup_median']:.2f}); samme lyd: {d['same_audio']}")


# --- enkeltord og bæresætning -----------------------------------------------

def words_section(res: dict):
    rows = joined("words20")
    if not rows:
        return
    n = len(rows)
    out_share = sum(not in_window(r) for r in rows) / n
    out_sp = sum(not (WINDOW[0] <= r["speech_dur"] / r["exp_dur"] <= WINDOW[1]) for r in rows) / n
    fail = sum(not r["pass"] for r in rows) / n
    wh = {(r["id"], r["take"]): r for r in load("words20", "asr-whisper.jsonl")}
    fail_wh = (sum(not wh[(r["id"], r["take"])]["pass"] for r in rows if (r["id"], r["take"]) in wh) / len(wh)
               if wh else None)
    order = []
    for r in rows:
        if r["id"] not in order:
            order.append(r["id"])
    per_word = {}
    for w in order:
        rw = sorted((r for r in rows if r["id"] == w), key=lambda r: r["take"])
        per_word[w] = {"exp": rw[0]["exp_dur"], "durs": [r["dur"] for r in rw],
                       "ratios": [round(r["dur"] / r["exp_dur"], 2) for r in rw],
                       "asr": [r["asr"] for r in rw], "pass": [r["pass"] for r in rw],
                       "whisper": [wh[(w, r["take"])]["asr"] for r in rw if (w, r["take"]) in wh]}
    res["words"] = {
        "n_takes": n, "voice": rows[0]["voice"], "outside_window_share": out_share,
        "outside_window_share_speech_only": out_sp, "asr_fail_share": fail, "whisper_fail_share": fail_wh,
        "cer_aggregate": agg_cer(rows), "rule_triggered_duration": out_share > RULE_SHARE,
        "rule_triggered_asr": fail > RULE_SHARE, "carrier_decision": out_share > RULE_SHARE or fail > RULE_SHARE,
        "per_word": per_word,
    }
    print(f"\n### Svære enkeltord ({n} takes, {rows[0]['voice']}, ét kald pr. ord)\n")
    print(f"Uden for [{WINDOW[0]}; {WINDOW[1]}] × forventet: {pct(out_share)} (kun tale: {pct(out_sp)}); "
          f"ASR ikke bestået: {pct(fail)}" + (f" (whisper: {pct(fail_wh)})" if fail_wh is not None else "")
          + f"; samlet CER {pct(agg_cer(rows))}")
    print("\n| Ord | forventet | varighed (3 takes) | × forventet | wav2vec2 | whisper |")
    print("|---|---|---|---|---|---|")
    for w, d in per_word.items():
        print(f"| {w[2:]} | {d['exp']:.2f} s | {' / '.join(f'{x:.2f}' for x in d['durs'])} | "
              f"{' / '.join(str(x) for x in d['ratios'])} | {' / '.join(d['asr'])} | {' / '.join(d['whisper'])} |")


def carrier_section(res: dict):
    cut = load("carrier-cut")
    if not cut:
        return
    car = joined("carrier")
    res["carrier"] = {
        "n": len(cut),
        "carrier_cer": agg_cer(car) if car else None,
        "carrier_pass": sum(r["pass"] for r in car) if car else None,
        "cut_in_window_share": sum(in_window(r) for r in cut) / len(cut),
        "cut_risk": sum(r["cut_risk"] for r in cut),
        "align_score_mean": stats.fmean(r["align_score"] for r in cut),
    }
    d = res["carrier"]
    print(f"\n### Bæresætning \"Tallet er X.\" ({d['n']} talklip)\n")
    print(f"Bæresætninger: CER {pct(d['carrier_cer'])}, bestået {d['carrier_pass']}/{len(car)}; "
          f"udklip i varighedsvinduet: {pct(d['cut_in_window_share'])}; risikable snit: {d['cut_risk']}")


# --- sammensat vs. hel ------------------------------------------------------

COMPOSE_VARIANTS = [
    ("whole10", "hel sætning (1 kald pr. sætning)"),
    ("composed", "sammensat, klip fra enkeltkald"),
    ("composed-batch", "sammensat, klip fra batch-kald"),
    ("composed-carrier", "sammensat, tal fra bæresætning"),
]


def compose_section(res: dict):
    out = {}
    for tag, label in COMPOSE_VARIANTS:
        rows = joined(tag)
        if rows:
            wh = load(tag, "asr-whisper.jsonl")
            out[tag] = {"label": label, "cer": agg_cer(rows), "pass": sum(r["pass"] for r in rows),
                        "n": len(rows), "nums_ok": sum(r["nums_ok"] for r in rows),
                        "whisper_cer": agg_cer(wh) if wh else None,
                        "per_expression": {f"{r['id']}.t{r['take']}": [r["cer"], r["asr"]] for r in rows}}
    if not out:
        return
    res["compose"] = out
    print("\n### Sammensat vs. hel sætning (10 regnestykker × 2 takes)\n")
    print("| Variant | CER wav2vec2 | bestået | talfølge rigtig | CER whisper |")
    print("|---|---|---|---|---|")
    for tag, d in out.items():
        wc = pct(d["whisper_cer"]) if d["whisper_cer"] is not None else "–"
        print(f"| {d['label']} | {pct(d['cer'])} | {d['pass']}/{d['n']} | {d['nums_ok']}/{d['n']} | {wc} |")


# --- batch-generering -------------------------------------------------------

BATCH_FAMILIES = [
    ("b.w10", "enkeltord, end-form, K=10"),
    ("b.w5", "enkeltord, end-form, K=5"),
    ("b.nmid", "tal, mid-form, K=10"),
    ("b.nend", "tal, end-form, K=9"),
    ("b.frag", "fragmenter/hundrede-hoveder, mid-form, K=8"),
    ("b.s4", "hele sætninger, K=4"),
    ("b.s6", "hele sætninger, K=6"),
]


def batch_section(res: dict):
    calls = load("batch")
    if not calls:
        return
    items = joined("batch-cut")
    whole = load("batch-cut", "whole.jsonl")
    out = {}
    for fam, label in BATCH_FAMILIES:
        fc = [c for c in calls if c["id"].startswith(fam + ".") or c["id"] == fam]
        if not fc:
            continue
        ids = {c["id"] for c in fc}
        fi = [r for r in items if r.get("batch") in ids]
        fw = [w for w in whole if w["id"] in ids]
        alone = [r for r in fi if syll(r["expected"]) >= MIN_SYLL_ALONE]
        out[fam] = {
            "label": label, "calls": len(fc), "k": fc[0]["k"],
            "cpu_per_clip": stats.fmean(c["cpu_per_clip"] for c in fc),
            "cpu_per_call": stats.fmean(c["t_total"] for c in fc),
            "raw_per_clip": stats.fmean(c["raw_dur"] / c["k"] for c in fc),
            "tokens_per_call": stats.fmean(c["n_tokens"] for c in fc),
            "whole_cer": agg_cer(fw) if fw else None,
            "whole_pass": sum(w["pass"] for w in fw) if fw else None,
            "items": len(fi),
            "in_window_share": sum(in_window(r) for r in fi) / len(fi) if fi else None,
            "cut_risk": sum(r["cut_risk"] for r in fi),
            "sil_ms_min_median": stats.median([r["sil_ms_min"] for r in fi if r["sil_ms_min"] is not None])
            if fi else None,
            "align_score_mean": stats.fmean(r["align_score"] for r in fi) if fi else None,
            "align_score_min": min((r["align_score"] for r in fi), default=None),
            "item_cer_3syll": agg_cer(alone) if alone else None,
            "item_pass_3syll": (sum(r["pass"] for r in alone), len(alone)) if alone else None,
            "item_cer_all": agg_cer(fi) if fi else None,
            "item_pass_all": (sum(r["pass"] for r in fi), len(fi)) if fi else None,
            "final_dur_per_clip": stats.fmean(r["dur"] for r in fi) if fi else None,
        }
    res["batch"] = out
    print("\n### Batch-generering (flere klip pr. kald, udklip med forced alignment)\n")
    print("| Batch | kald | CPU/klip | hel ytring CER | udklip | i vindue | risikable snit | "
          "min. stilhed (median) | align-score | CER udklip ≥3 stavelser | bestået |")
    print("|---|---|---|---|---|---|---|---|---|---|---|")
    for fam, d in out.items():
        p3 = f"{d['item_pass_3syll'][0]}/{d['item_pass_3syll'][1]}" if d["item_pass_3syll"] else "–"
        c3 = pct(d["item_cer_3syll"]) if d["item_cer_3syll"] is not None else "–"
        wc = pct(d["whole_cer"]) if d["whole_cer"] is not None else "–"
        iw = pct(d["in_window_share"]) if d["in_window_share"] is not None else "–"
        print(f"| {d['label']} | {d['calls']} | {d['cpu_per_clip']:.1f} s | {wc} | {d['items']} | {iw} | "
              f"{d['cut_risk']} | {d['sil_ms_min_median']:.0f} ms | {d['align_score_mean']:.2f} | {c3} | {p3} |")


# --- fremskrivning ----------------------------------------------------------

def projection_section(res: dict):
    r2 = res.get("rtf_2threads")
    if not r2:
        return
    v = res.get("voice_winner", "nic")
    d = r2.get(v) or next(iter(r2.values()))
    a, b, k_raw = d["overhead_s"], d["marginal_rtf"], d["raw_over_final"]
    scale = INVENTORY_MIN * 60 / sum(n * s for _c, n, s, _k in INVENTORY_MIX)
    n_mix = sum(n for _c, n, _s, _k in INVENTORY_MIX)
    mix = [(c, n * INVENTORY_CLIPS / n_mix, s * scale * n_mix / INVENTORY_CLIPS, k) for c, n, s, k in INVENTORY_MIX]
    speed4 = res.get("rtf_4threads", {}).get("speedup_sum") or 1.0
    retake = 1 + RETAKE_SHARE

    def per_call_cost(dur):
        return a + b * dur * k_raw

    strategies = {}
    single = sum(n * per_call_cost(s) for _c, n, s, _k in mix) * retake
    strategies["enkeltkald"] = single
    bt = res.get("batch", {})
    # batch: overhead delt på K + marginal × (klip + pause), målt som rå batchlyd pr. klip
    # relativt til udklippenes færdige varighed.
    fam_short = bt.get("b.w10") or bt.get("b.nmid")
    fam_sent = bt.get("b.s4")
    if fam_short and fam_sent:
        def batch_cost(dur, fam):
            ratio = fam["raw_per_clip"] / fam["final_dur_per_clip"]
            return a / fam["k"] + b * dur * ratio
        total = 0.0
        for _c, n, s, kind in mix:
            fam = fam_short if kind == "short" else fam_sent
            total += n * batch_cost(s, fam)
        strategies["batch"] = total * retake
        # kontrol: modellen mod de målte CPU-tider pr. klip
        res["batch_model_check"] = {
            fam: {"measured": dd["cpu_per_clip"],
                  "model": a / dd["k"] + b * dd["raw_per_clip"]} for fam, dd in bt.items()}
    res["projection"] = {
        "voice": v, "clips": INVENTORY_CLIPS, "audio_min": INVENTORY_MIN, "retake_share": RETAKE_SHARE,
        "overhead_s": a, "marginal_rtf": b, "raw_over_final": k_raw, "speedup_4threads": speed4,
        "mix": [{"category": c, "clips": round(n), "avg_s": round(s, 2), "kind": k} for c, n, s, k in mix],
        "hours_2threads": {k: round(v_ / 3600, 2) for k, v_ in strategies.items()},
        "hours_4threads": {k: round(v_ / 3600 / speed4, 2) for k, v_ in strategies.items()},
    }
    print(f"\n### Fremskrivning ({INVENTORY_CLIPS} klip, {INVENTORY_MIN:.0f} min lyd, 1 take + "
          f"{RETAKE_SHARE:.0%} gentagelser)\n")
    print("| Strategi | 2 tråde | 4 tråde |")
    print("|---|---|---|")
    for k, sec in strategies.items():
        print(f"| {k} | {sec / 3600:.1f} t | {sec / 3600 / speed4:.1f} t |")
    if "batch_model_check" in res:
        print("\nModel mod måling (CPU pr. klip): " + ", ".join(
            f"{f}: {m['measured']:.1f} s målt / {m['model']:.1f} s model" for f, m in res["batch_model_check"].items()))


def main():
    res: dict = {}
    voices_section(res)
    rtf_section(res)
    words_section(res)
    carrier_section(res)
    compose_section(res)
    batch_section(res)
    projection_section(res)
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1, default=float) + "\n")
    print(f"\nskrevet: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
