"""Builds data/fakta.json: every number the report text may quote, formatted for Danish.

Inputs: data/story.json, data/edge.json, data/stats.json, data/qa-report.json, data/qa.txt and the
screenshot sidecars in data/shots/. Writers reference keys as {{key}}; build.mjs fails on unknown keys.
"""
import json
import math
import re
from pathlib import Path

D = Path(__file__).resolve().parent.parent / 'data'
story = json.loads((D / 'story.json').read_text())
edge = json.loads((D / 'edge.json').read_text())
stats = json.loads((D / 'stats.json').read_text())
qa = json.loads((D / 'qa-report.json').read_text())
qatxt = (D / 'qa.txt').read_text()
shots = {p.stem: json.loads(p.read_text()) for p in sorted((D / 'shots').glob('*.json'))}
MINUS = '−'


def num(v, d=0):
    s = f'{abs(v):,.{d}f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return (MINUS if v < 0 and round(abs(v), d) != 0 else '') + s


def kr(v):
    frac = abs(v - round(v)) > 0.004
    return f'{num(v, 2 if frac else 0)} kr'


def pct(p, d=1):
    return f'{num(p * 100, d)} %'


def sign(v):
    return f'+{v}' if v > 0 else (f'{MINUS}{abs(v)}' if v < 0 else '0')


def minute(t):
    return f'{math.floor(t + 1e-9)}′' if t <= 90 else f'90+{math.ceil(t - 90 - 1e-6)}′'


def clock(t):
    m = math.floor(t + 1e-9)
    s = round((t - m) * 60)
    if s == 60:
        m, s = m + 1, 0
    return f'{m}:{s:02d}'


F = {}
TEAM = ['FCK', 'BIF']

# --- the match --------------------------------------------------------------------------------
F['seed'] = story['seed']
F['slutresultat'] = story['final']['score'].replace('-', '–')
goals = [e for e in story['events'] if e['kind'] == 'goal']
for i, g in enumerate(goals, 1):
    F[f'maal{i}.hold'] = TEAM[g['team']]
    F[f'maal{i}.minut'] = minute(g['t'])
    F[f'maal{i}.ur'] = clock(g['t'])
    F[f'maal{i}.k'] = str(g['k'])
reopens = [e for e in story['events'] if e['kind'] == 'reopen']
for i, r in enumerate(reopens, 1):
    F[f'genaabning{i}.k'] = str(r['k'])
    F[f'genaabning{i}.ur'] = clock(r['t'])
    F[f'genaabning{i}.gabFCK'] = sign(r['gap'][0])
    F[f'genaabning{i}.gabX'] = sign(r['gap'][1])
    F[f'genaabning{i}.gabBIF'] = sign(r['gap'][2])
    F[f'genaabning{i}.gabOver'] = sign(r['gapO25'])
whales = [e for e in story['events'] if e['kind'] == 'whale']
for i, w in enumerate(whales, 1):
    F[f'hval{i}.minut'] = minute(w['t'])
    F[f'hval{i}.paa'] = TEAM[w['team']] if w.get('team') is not None else 'X'
    F[f'hval{i}.kr'] = kr(int(w['text']))
F['antalHvaler'] = str(len(whales))
F['kickoffKurs'] = re.sub(r'\D', '', story['events'][0]['text'])
halt = 12
F['maalStop.substeps'] = str(halt)

# --- 20′, before and after the buys --------------------------------------------------------------
b = story['before']
F['t20.kursFCK'], F['t20.kursX'], F['t20.kursBIF'] = map(str, b['ask'])
F['t20.salgFCK'], F['t20.salgX'], F['t20.salgBIF'] = map(str, b['bid'])
F['t20.sumKurs'] = str(sum(b['ask']))
F['t20.midFCK'] = pct(b['mid'][0])
F['t20.fairFCK'] = pct(b['fair'][0])
F['t20.over.kurs'], F['t20.under.kurs'] = map(str, b['o25']['ask'])
F['t20.over.salg'] = str(b['o25']['bid'][0])
F['t20.over.chance'] = pct(b['o25']['mid'])
F['t20.overUnderSum'] = str(sum(b['o25']['ask']))
F['laastKurs'] = str(story['lockedAsk'])
buys = [e for e in story['final']['log'] if e['kind'] == 'buy']
names = {'1x2:F': 'fck', '1x2:B': 'bif', 'tot:2.5:O': 'over', 'cs:1-1': 'cs11', 'cs:2-1': 'cs21'}
for e in buys:
    n = names[e['contract']]
    F[f'koeb.{n}.andele'] = num(e['shares'])
    F[f'koeb.{n}.kurs'] = str(e['price'])
    F[f'koeb.{n}.kr'] = kr(e['kr'])
    F[f'koeb.{n}.minut'] = minute(e['t'])
    F[f'koeb.{n}.k'] = str(e['k'])
F['koeb.fck.indsats'] = '250 kr'
F['koeb.bif.indsats'] = '200 kr'
F['koeb.over.indsats'] = '200 kr'
F['koeb.cs11.indsats'] = '50 kr'
F['koeb.cs21.indsats'] = '50 kr'
F['pulje.indsats'] = kr(story['final']['poolStakes'][0]['kr'])
F['pulje.side'] = ['FCK', 'uafgjort', 'BIF'][story['final']['poolStakes'][0]['side']]

# --- exits -------------------------------------------------------------------------------------------
ex = {f"{x['contract']}:{x['kind']}": x for x in story['final']['exits']}
F['stop.bif.niveau'] = str(ex['1x2:B:stop']['level'])
F['take.bif.niveau'] = str(ex['1x2:B:take']['level'])
F['stop.over.niveau'] = str(ex['tot:2.5:O:stop']['level'])
F['take.over.niveau'] = str(ex['tot:2.5:O:take']['level'])
s = ex['1x2:B:stop']['fill']
F['stop.bif.k'] = str(s['k'])
F['stop.bif.ur'] = clock(s['t'])
F['stop.bif.andele'] = num(s['shares'])
F['stop.bif.kurs'] = str(s['price'])
F['stop.bif.kr'] = kr(s['kr'])
F['stop.bif.substepsEfter'] = str(s['k'] - reopens[0]['k'])
t = ex['tot:2.5:O:take']['fill']
F['take.over.k'] = str(t['k'])
F['take.over.ur'] = clock(t['t'])
F['take.over.andele'] = num(t['shares'])
F['take.over.kurs'] = str(t['price'])
F['take.over.kr'] = kr(t['kr'])
cf = story['counterfactual']
F['udenVagt.kurs'] = str(cf['bidAtReopen'])
F['udenVagt.kr'] = kr(cf['noGuardKr'])
F['stop.bif.bakkeSkoen'] = kr(ex['1x2:B:stop']['fill']['shares'] * ex['1x2:B:stop']['level'] / 100)
tr = {r['k']: r for r in story['trace']}
r0 = tr[reopens[0]['k']]
F['genaabning1.bifKurs'] = str(r0['ask'][2])
F['genaabning1.bifSalg'] = str(r0['bid'][2])
F['genaabning1.overKurs'] = str(r0['o25']['ask'][0])
F['genaabning1.overSalg'] = str(r0['o25']['bid'][0])
r8 = tr[s['k']]
F['stopTidspunkt.bifKurs'] = str(r8['ask'][2])
F['stopTidspunkt.bifSalg'] = str(r8['bid'][2])
pre = tr[1179] if 1179 in tr else story['trace'][0]
F['foerMaal.bifKurs'] = str(pre['ask'][2])
F['foerMaal.overKurs'] = str(pre['o25']['ask'][0])

# --- the edge case -----------------------------------------------------------------------------------
lf = next(e for e in edge['log'] if e['kind'] == 'limit-fill')
es = next(e for e in edge['log'] if e['kind'] == 'sell')
F['kant.graense.niveau'] = '20'
F['kant.graense.indsats'] = '100 kr'
F['kant.graense.andele'] = num(lf['shares'])
F['kant.graense.kurs'] = str(lf['price'])
F['kant.graense.bedre'] = str(lf['better'])
F['kant.stop.andele'] = num(es['shares'])
F['kant.stop.kurs'] = str(es['price'])
F['kant.stop.kr'] = kr(es['kr'])

# --- final-score and totals quotes ------------------------------------------------------------------
q20 = story['quotes20']
for c in q20['single']:
    k = c['id'].replace('cs:', 'cs').replace('-', '')
    F[f'q20.{k}.p'] = pct(c['p'])
    F[f'q20.{k}.kurs'] = str(c['ask'])
    F[f'q20.{k}.salg'] = str(c['bid'])
    F[f'q20.{k}.raa'] = num(c['raw'], 2)
regkey = {'FCK med 2+': 'fck2', 'Begge scorer': 'btts', '0–0 eller 1–1': 'r0011', 'Mindst 4 mål': 'm4'}
for c in q20['regions']:
    k = regkey[c['name']]
    F[f'q20.{k}.n'] = str(c['n'])
    F[f'q20.{k}.p'] = pct(c['p'])
    F[f'q20.{k}.kurs'] = str(c['ask'])
    F[f'q20.{k}.salg'] = str(c['bid'])
    F[f'q20.{k}.ti'] = str(c['ten'])
    F[f'q20.{k}.loft'] = str(c['cap'])
    F[f'q20.{k}.gammeltLoft'] = str(c['oldCap'])
    F[f'q20.{k}.gammelKurs'] = str(c['oldAsk'])
    F[f'q20.{k}.fairPoint'] = num(c['p'] * 100, 1)
for c in q20['totals']:
    m = re.match(r'tot:([\d.]+):([OU])', c['id'])
    k = f"tot{m.group(1).replace('.', '')}{m.group(2)}"
    F[f'q20.{k}.kurs'] = str(c['ask'])
    F[f'q20.{k}.salg'] = str(c['bid'])
    F[f'q20.{k}.p'] = pct(c['p'])
q35 = story['quotes35']
for c in q35['single']:
    k = c['id'].replace('cs:', 'cs').replace('-', '')
    F[f'q35.{k}.p'] = pct(c['p'])
    F[f'q35.{k}.kurs'] = str(c['ask'])
F['sentKoeb.minut'] = minute(q35['t'])
worst_old = min((c['oldAsk'] - c['p'] * 100, c) for c in q20['regions'] + q35['regions'] for _ in [0])
F['gammelFejl.region'] = worst_old[1]['name']
F['gammelFejl.kurs'] = str(worst_old[1]['oldAsk'])
F['gammelFejl.fair'] = num(worst_old[1]['p'] * 100, 1)
F['gammelFejl.under'] = num(-(worst_old[0]), 1)

# --- the pool ---------------------------------------------------------------------------------------
pc = story['poolClose']
F['pulje.lukning.total'] = kr(round(pc['total']))
F['pulje.lukning.n'] = num(pc['n'])
for i, nm in enumerate(['fck', 'x', 'bif']):
    F[f'pulje.lukning.{nm}'] = kr(round(pc['sides'][i]))
    F[f'pulje.lukning.odds.{nm}'] = num(pc['odds'][i], 2)
    F[f'pulje.lukning.fair.{nm}'] = pct(pc['fair'][i])
    F[f'pulje.lukning.ev.{nm}'] = num(pc['fair'][i] * pc['odds'][i], 3)
F['pulje.udbetaling'] = kr(story['final']['poolResult']['payout'])
# The live estimate (fair × current pool odds) during the first half, against the value at the close.
half = [p for p in story['series'] if 0.4 < p['t'] <= 45 and p['phase'] not in ('HT',)]
for i, nm in enumerate(['fck', 'x', 'bif']):
    ev = [p['fair'][i] * p['pool']['odds'][i] for p in half]
    F[f'pulje.skoen.max.{nm}'] = num(max(ev), 3)
    F[f'pulje.skoen.min.{nm}'] = num(min(ev), 3)
F['pulje.skoen.overGraense'] = pct(sum(1 for p in half if max(p['fair'][i] * p['pool']['odds'][i] for i in range(3)) > 0.946) / len(half), 0)
F['pulje.start'] = '180.000 kr'
F['pulje.startN'] = '3.100'
sh10 = shots.get('10-pulje-aaben', {})
m = re.search(r'Puljen\s*\n?\s*([\d.]+ kr)', sh10.get('text', ''))
F['pulje.t24.total'] = m.group(1) if m else ''
m = re.search(r'([\d.]+) indsatser', sh10.get('text', ''))
F['pulje.t24.n'] = m.group(1) if m else ''

# --- the result ---------------------------------------------------------------------------------------
fin = story['final']
F['slut.indsat'] = kr(fin['staked'])
F['slut.udbetalt'] = kr(fin['paidOut'])
F['slut.resultat'] = ('+' if fin['paidOut'] >= fin['staked'] else MINUS) + kr(abs(fin['paidOut'] - fin['staked']))
F['slut.saldo'] = kr(fin['saldo'])
cs11 = next(p for p in fin['positions'] if p['id'] == 'cs:1-1')
F['slut.cs11.udbetaling'] = kr(cs11['settled']['payout'])
for g in fin['grades']:
    if g['grade'] != '—':
        k = 'fck' if g['label'].startswith('FCK') else 'bif'
        F[f'karakter.{k}'] = g['grade']
        F[f'karakter.{k}.clv'] = num(g['clv'], 3)

# --- statistics ----------------------------------------------------------------------------------
st = stats
F['kal.maalPrKamp'] = num(st['goals']['perMatch'], 2)
F['kal.fckSejr'] = pct(st['goals']['fckWin'])
F['kal.kampe'] = num(st['goals']['n'])
F['kal.o25.kickoffPris'] = pct(st['o25Kickoff']['p'])
F['kal.o25.kickoffFaktisk'] = pct(st['o25Kickoff']['y'])
F['kal.o25.kampe'] = num(st['o25Kickoff']['n'])
F['kal.o25.punkter'] = num(st['o25Kickoff']['samples'])
F['kal.o25.maxAfvigelse'] = num(max(abs(r['y'] - r['p']) for r in st['calO25']) * 100, 1)
F['kal.1x2.maxAfvigelse'] = num(max(abs(r['y'] - r['p']) for r in st['cal1x2'] if r['n'] >= 300) * 100, 1)
F['mc.maxAfvigelse'] = num(max(abs(r['mc'] - r['dp']) for r in st['mcVsDp']) * 100, 1)
_g = max(r['x12diff'] for r in st['mcVsDp'])
_e = math.floor(math.log10(_g))
_sup = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')
F['grid.maxAfvigelse1x2'] = f"{num(_g / 10 ** _e, 1)} · 10{str(_e).translate(_sup)}"
F['pulje.graense'] = num(st['poolBoundMax'], 3)
F['pulje.20.kampe'] = str(st['pool20']['n'])
for i, nm in enumerate(['fck', 'x', 'bif']):
    F[f'pulje.20.vaerst.{nm}'] = num(st['pool20']['worst'][i], 3)
    F[f'pulje.20.middel.{nm}'] = num(st['pool20']['mean'][i], 3)
F['test.antal'] = str(st['tests']['total'])
for k, v in st['tests']['perFile'].items():
    F[f'test.{k}'] = str(v)
F['commit'] = st['commit']
perf = qa['perf']
F['perf.1x.p95'] = f"{num(perf['cpu1x']['p95'], 1)} ms"
F['perf.4x.p95'] = f"{num(perf['cpu4x']['p95'], 1)} ms"
F['perf.4x.p95.tidligere'] = '66,7 ms'
F['perf.4x.lang'] = f"{num(perf['cpu4x']['maxLong'])} ms"
F['perf.mc'] = f"{num(perf['cpu1x']['mcMs'])} ms"
F['qa.antal'] = str(len(re.findall(r'^PASS', qatxt, re.M)))
m = re.search(r'demo reaches Afregning · #afregning after (\d+) s', qatxt)
F['qa.demoSek'] = f'{m.group(1)} s' if m else ''

# --- constants worth quoting ------------------------------------------------------------------------
C = {c['name']: c['value'] for c in st['constants']}
F['k.O25_MARGIN'] = '6 %'
F['k.HYST'] = num(float(C['HYST']), 1)
F['k.GOAL_HALT'] = C['GOAL_HALT']
F['k.RED_HALT'] = C['RED_HALT']
F['k.PRE_SUBS'] = C['PRE_SUBS']
F['k.B_LIQ'] = kr(int(C['B_LIQ'].replace('_', '')))
F['k.MU_TRADES'] = C['MU_TRADES']
F['k.POOL_P0'] = kr(int(C['POOL_P0']))
F['k.POOL_TAKE'] = '10 %'
F['k.STOP_REOPEN_GUARD'] = C['STOP_REOPEN_GUARD']
F['k.STOP_ASK_OFFSET'] = C['STOP_ASK_OFFSET']
F['k.START_SALDO'] = kr(int(C['START_SALDO']))
F['k.MAX_STAKE'] = kr(int(C['MAX_STAKE']))
F['k.MAX_LIMITS'] = C['MAX_LIMITS']
F['k.CS_MIN_P'] = '3 %'

(D / 'fakta.json').write_text(json.dumps(F, ensure_ascii=False, indent=1))
print(len(F), 'facts')
for k in ['maal1.ur', 'genaabning1.ur', 'stop.bif.kr', 'udenVagt.kr', 'take.over.kr', 'pulje.udbetaling', 'pulje.lukning.total', 'gammelFejl.region', 'gammelFejl.under', 'slut.resultat', 'kal.o25.maxAfvigelse', 'qa.antal', 'pulje.t24.total', 'karakter.fck']:
    print(k, '=', F.get(k))
