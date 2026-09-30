#!/usr/bin/env python3
"""Samler S1-målingerne (meta.jsonl + asr.jsonl) til tal og tabeller for docs/voice.md.

  python report.py            # skriver voice/probe/s1-results.json og printer markdown

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


def load(tag: str, name: str) -> list[dict]:
    p = TAKES / tag / name
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()]


def joined(tag: str) -> list[dict]:
    meta = {(r["id"], r["voice"], r["take"]): r for r in load(tag, "meta.jsonl")}
    out = []
    for a in load(tag, "asr.jsonl"):
        m = meta.get((a["id"], a["voice"], a["take"]), {})
        out.append({**m, **a})
    return out


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


def voices_section(res: dict):
    rows = joined("probe12")
    if not rows:
        return
    vs = {}
    for v in sorted({r["voice"] for r in rows}):
        rv = [r for r in rows if r["voice"] == v]
        takes = sorted({r["take"] for r in rv})
        per_take = {t: agg_cer([r for r in rv if r["take"] == t]) for t in takes}
        # bedste take pr. sætning (sådan vælger generate.py mellem takes)
        best = []
        for sid in sorted({r["id"] for r in rv}):
            best.append(min((r for r in rv if r["id"] == sid), key=lambda r: r["cer"]))
        vs[v] = {
            "cer_all": agg_cer(rv),
            "cer_per_take": per_take,
            "cer_best_of_takes": agg_cer(best),
            "pass_rate": sum(r["pass"] for r in rv) / len(rv),
            "nums_ok_rate": sum(r["nums_ok"] for r in rv) / len(rv),
            "n": len(rv),
            "per_sentence": {sid: [r["cer"] for r in sorted(rv, key=lambda r: r["take"]) if r["id"] == sid]
                             for sid in sorted({r["id"] for r in rv})},
            "asr": {f"{r['id']}.t{r['take']}": r["asr"] for r in rv},
        }
    if {"mic", "nic"} <= vs.keys():
        d = 100 * (vs["mic"]["cer_all"] - vs["nic"]["cer_all"])
        winner = "nic" if d >= -TIE_PP else "mic"
        why = ("lighed inden for ±0,5 pp → Nic" if abs(d) <= TIE_PP
               else f"lavest samlet CER ({'Nic' if winner == 'nic' else 'Mic'})")
        res["voice_winner"] = winner
        res["voice_reason"] = why
        res["voice_delta_pp_mic_minus_nic"] = round(d, 2)
    res["voices"] = vs
    print("\n### Stemmevalg (12 probesætninger)\n")
    print("| Stemme | samlet CER (alle takes) | " + " | ".join(
        f"take {t}" for t in sorted(next(iter(vs.values()))["cer_per_take"])) + " | bedste take pr. sætning | bestået |")
    print("|---|---|" + "---|" * len(next(iter(vs.values()))["cer_per_take"]) + "---|---|")
    for v, d in vs.items():
        print(f"| {v} | {pct(d['cer_all'])} | " + " | ".join(pct(c) for c in d["cer_per_take"].values())
              + f" | {pct(d['cer_best_of_takes'])} | {d['pass_rate'] * 100:.0f} % |")
    if "voice_winner" in res:
        print(f"\nVinder: {res['voice_winner']} ({res['voice_reason']}; Mic − Nic = "
              f"{res['voice_delta_pp_mic_minus_nic']:+.2f} pp)")


def rtf_section(res: dict):
    base = [r for r in load("probe12", "meta.jsonl") if r["take"] == 0] + load("rtf8", "meta.jsonl")
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
    # 4 tråde: samme id/seed som ved 2 tråde
    t4 = load("probe12-t4", "meta.jsonl")
    if t4:
        two = {(r["id"], r["voice"]): r for r in load("probe12", "meta.jsonl") if r["take"] == 0}
        pairs = [(two[(r["id"], r["voice"])], r) for r in t4 if (r["id"], r["voice"]) in two]
        s2 = sum(p[0]["t_total"] for p in pairs)
        s4 = sum(p[1]["t_total"] for p in pairs)
        d2 = sum(p[0]["raw_dur"] for p in pairs)
        d4 = sum(p[1]["raw_dur"] for p in pairs)
        res["rtf_4threads"] = {
            "n": len(pairs), "ids": [p[1]["id"] + "/" + p[1]["voice"] for p in pairs],
            "rtf_2": s2 / d2, "rtf_4": s4 / d4, "speedup": s2 / s4 if s4 else None,
            "t3_2": sum(p[0].get("t_t3", 0) for p in pairs), "t3_4": sum(p[1].get("t_t3", 0) for p in pairs),
            "s3gen_2": sum(p[0].get("t_s3gen", 0) for p in pairs),
            "s3gen_4": sum(p[1].get("t_s3gen", 0) for p in pairs),
            "same_audio": all(abs(p[0]["raw_dur"] - p[1]["raw_dur"]) < 1e-6 for p in pairs),
            "mean_load1": stats.fmean(p[1]["load1"] for p in pairs),
        }
    print("\n### RTF (2 tråde, 20 probeklip pr. stemme)\n")
    print("| Stemme | klip | beregning | lyd (rå) | RTF samlet | median RTF pr. klip | overhead pr. kald | marginal RTF | T3 tokens/s |")
    print("|---|---|---|---|---|---|---|---|---|")
    for v, d in out.items():
        print(f"| {v} | {d['n']} | {d['sum_compute_s']:.0f} s | {d['sum_audio_raw_s']:.1f} s | "
              f"{d['rtf_aggregate_raw']:.2f} | {d['rtf_median_per_clip']:.2f} | {d['overhead_s']:.1f} s | "
              f"{d['marginal_rtf']:.2f} | {d['t3_tokens_per_s']:.1f} |")
    if "rtf_4threads" in res:
        d = res["rtf_4threads"]
        print(f"\n4 tråde ({d['n']} klip): RTF {d['rtf_4']:.2f} mod {d['rtf_2']:.2f} ved 2 tråde "
              f"(faktor {d['speedup']:.2f}); samme lyd: {d['same_audio']}")


def words_section(res: dict):
    rows = joined("words20")
    if not rows:
        return
    lo, hi = WINDOW
    for r in rows:
        r["ratio"] = r["dur"] / r["exp_dur"]
        r["ratio_speech"] = r["speech_dur"] / r["exp_dur"]
        r["in_window"] = lo <= r["ratio"] <= hi
        r["in_window_speech"] = lo <= r["ratio_speech"] <= hi
    n = len(rows)
    out_share = sum(not r["in_window"] for r in rows) / n
    out_share_sp = sum(not r["in_window_speech"] for r in rows) / n
    fail = sum(not r["pass"] for r in rows) / n
    per_word = {}
    for w in sorted({r["id"] for r in rows}, key=lambda s: [r["id"] for r in rows].index(s)):
        rw = sorted((r for r in rows if r["id"] == w), key=lambda r: r["take"])
        per_word[w] = {
            "durs": [r["dur"] for r in rw], "exp": rw[0]["exp_dur"],
            "ratios": [round(r["ratio"], 2) for r in rw], "asr": [r["asr"] for r in rw],
            "cer": [r["cer"] for r in rw], "pass": [r["pass"] for r in rw],
        }
    triggered_dur = out_share > RULE_SHARE
    triggered_asr = fail > RULE_SHARE
    res["words"] = {
        "n_takes": n, "voice": rows[0]["voice"],
        "outside_window_share": out_share, "outside_window_share_speech_only": out_share_sp,
        "asr_fail_share": fail, "cer_aggregate": agg_cer(rows),
        "rule_triggered_duration": triggered_dur, "rule_triggered_asr": triggered_asr,
        "carrier_decision": triggered_dur or triggered_asr, "per_word": per_word,
    }
    print(f"\n### Svære enkeltord ({n} takes, stemme {rows[0]['voice']})\n")
    print(f"Uden for vinduet [{lo}; {hi}] × forventet: {pct(out_share)} (kun tale: {pct(out_share_sp)}); "
          f"ASR ikke bestået: {pct(fail)}; samlet CER {pct(agg_cer(rows))}")
    print("\n| Ord | forventet | varighed (3 takes) | × forventet | ASR (3 takes) |")
    print("|---|---|---|---|---|")
    for w, d in per_word.items():
        print(f"| {w[2:]} | {d['exp']:.2f} s | {' / '.join(f'{x:.2f}' for x in d['durs'])} | "
              f"{' / '.join(str(x) for x in d['ratios'])} | {' / '.join(d['asr'])} |")


def compose_section(res: dict):
    whole = joined("whole10")
    if not whole:
        return
    out = {"whole": {"cer": agg_cer(whole), "pass": sum(r["pass"] for r in whole), "n": len(whole)}}
    variants = [("composed", "sammensat (direkte talklip)"), ("composed-carrier", "sammensat (tal fra bæresætning)")]
    for tag, _label in variants:
        rows = joined(tag)
        if rows:
            out[tag] = {"cer": agg_cer(rows), "pass": sum(r["pass"] for r in rows), "n": len(rows)}
    per = {}
    for r in whole:
        per.setdefault(r["id"], {})[f"whole.t{r['take']}"] = (r["cer"], r["asr"])
    for tag, _ in variants:
        for r in joined(tag):
            per.setdefault(r["id"], {})[f"{tag}.t{r['take']}"] = (r["cer"], r["asr"])
    out["per_expression"] = per
    res["compose"] = out
    print("\n### Sammensat vs. hel sætning (10 regnestykker)\n")
    print("| Variant | samlet CER | bestået |")
    print("|---|---|---|")
    print(f"| hel sætning | {pct(out['whole']['cer'])} | {out['whole']['pass']}/{out['whole']['n']} |")
    for tag, label in variants:
        if tag in out:
            print(f"| {label} | {pct(out[tag]['cer'])} | {out[tag]['pass']}/{out[tag]['n']} |")


def projection_section(res: dict):
    r2 = res.get("rtf_2threads")
    if not r2:
        return
    v = res.get("voice_winner", "nic")
    d = r2.get(v) or next(iter(r2.values()))
    avg_final = INVENTORY_MIN * 60 / INVENTORY_CLIPS
    avg_raw = avg_final * d["raw_over_final"]
    per_clip_2 = d["overhead_s"] + d["marginal_rtf"] * avg_raw
    calls = INVENTORY_CLIPS * (1 + RETAKE_SHARE)
    h2 = calls * per_clip_2 / 3600
    speed = res.get("rtf_4threads", {}).get("speedup") or 1.0
    h4 = h2 / speed
    res["projection"] = {
        "voice": v, "clips": INVENTORY_CLIPS, "audio_min": INVENTORY_MIN, "retake_share": RETAKE_SHARE,
        "calls": calls, "avg_final_s": avg_final, "avg_raw_s": avg_raw,
        "sec_per_call_2threads": per_clip_2, "hours_2threads": h2,
        "speedup_4threads": speed, "hours_4threads": h4,
        "effective_rtf_2threads": per_clip_2 / avg_final,
    }
    print(f"\n### Fremskrivning ({INVENTORY_CLIPS} klip, {INVENTORY_MIN:.0f} min, 1 take + {RETAKE_SHARE:.0%} nye)\n")
    print(f"{per_clip_2:.1f} s pr. kald ved 2 tråde (overhead {d['overhead_s']:.1f} s + "
          f"{d['marginal_rtf']:.2f} × {avg_raw:.2f} s) → {h2:.1f} t ved 2 tråde, {h4:.1f} t ved 4 tråde "
          f"(effektiv RTF {per_clip_2 / avg_final:.1f})")


def main():
    res: dict = {}
    voices_section(res)
    rtf_section(res)
    words_section(res)
    compose_section(res)
    projection_section(res)
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1, default=float) + "\n")
    print(f"\nskrevet: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
