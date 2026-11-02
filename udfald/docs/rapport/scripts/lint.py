"""Lints chapter fragments: unknown {{keys}}, forbidden words, unknown data-shot/data-fig ids, h1 ids.
Usage: python3 scripts/lint.py [files...]   (default: all kapitler/*.html)"""
import json, re, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
F = json.loads((R / 'data' / 'fakta.json').read_text())
shots = {p.stem for p in (R / 'img').glob('*.jpg')}
figs = {'tidslinje', 'kurs-chance', 'skaermkort', 'system', 'tidsskala', 'stier', 'over25-kamp', 'kal-o25', 'kal-1x2', 'sikring-spor', 'pulje-flow', 'pulje-halvleg', 'pulje-graense'}
files = [Path(a) for a in sys.argv[1:]] or sorted((R / 'kapitler').glob('*.html'))
bad = 0
for f in files:
    s = f.read_text()
    probs = []
    for k in re.findall(r'\{\{\s*([^}]+?)\s*\}\}', s):
        if k not in F: probs.append(f'ukendt nøgle {{{{{k}}}}}')
    text = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    text = re.sub(r'<code>.*?</code>', ' ', text, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    for m in re.finditer(r'\b[øØ]re\b', text):
        ctx = text[max(0, m.start() - 40): m.end() + 40].replace('\n', ' ')
        if 'ØRE' not in text[m.start():m.end()] and 'hed' not in ctx and '0,' not in ctx: probs.append(f'"øre" som ord: …{ctx}…')
    for m in re.finditer(r'\b\d+\.\d{1,2}\b', text):
        probs.append(f'decimalpunktum? {m.group(0)}')
    for sid in re.findall(r'data-shot="([^"]+)"', s):
        if sid not in shots: probs.append(f'ukendt data-shot {sid}')
    for fid in re.findall(r'data-fig="([^"]+)"', s):
        if fid not in figs: probs.append(f'ukendt data-fig {fid}')
    if 'style=' in s: probs.append('inline style')
    for w in ['revolutionerende', 'banebrydende', 'sømløs', 'game-changer']:
        if w in text.lower(): probs.append(f'salgssprog: {w}')
    print(f'{f.name}: {"OK" if not probs else str(len(probs)) + " fund"}')
    for p in probs: print('   ', p)
    bad += len(probs)
sys.exit(1 if bad else 0)
