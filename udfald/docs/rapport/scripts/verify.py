"""Verifies docs/UDFALD-rapport.pdf: size, fonts, images, text lint, dark pages. Exit 1 on failure."""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image

R = Path(__file__).resolve().parent.parent
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else R.parent / 'UDFALD-rapport.pdf'
F = json.loads((R / 'data' / 'fakta.json').read_text())
fails, warns = [], []


def run(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout


info = run('pdfinfo', str(PDF))
pages = int(re.search(r'Pages:\s+(\d+)', info).group(1))
size = PDF.stat().st_size
print(f'pages {pages} · {size / 1e6:.1f} MB')
if not 30 <= pages <= 48:
    warns.append(f'page count {pages} outside 30–48')
if 'A4' not in info:
    fails.append('not A4')
if 'UDFALD' not in re.search(r'Title:\s+(.*)', info).group(1):
    fails.append('title missing')
if size > 25e6:
    fails.append('larger than 25 MB')
elif size > 12e6:
    warns.append('larger than 12 MB')

fonts = run('pdffonts', str(PDF)).splitlines()[2:]
not_emb = [l for l in fonts if l.split()[-5] != 'yes']
if not_emb:
    fails.append(f'fonts not embedded: {not_emb}')
families = sorted({re.sub(r'^[A-Z]{6}\+', '', l.split()[0]) for l in fonts})
print('fonts', families)

imgs = run('pdfimages', '-list', str(PDF)).splitlines()[2:]
print('images', len(imgs))

text = run('pdftotext', '-layout', str(PDF), '-')
for bad in ['{{', '⟦', 'NaN', 'undefined', 'TODO', 'null kr']:
    if bad in text:
        fails.append(f'text contains {bad!r}')
for m in re.finditer(r'\børe\b', text):
    ctx = text[max(0, m.start() - 60): m.end() + 40].replace('\n', ' ')
    warns.append(f'"øre": …{" ".join(ctx.split())}…')
for term in ['kurs', 'point', 'Sikring', 'Parken-puljen', 'Over 2,5', 'stop-loss', 'Sikr gevinst', 'Mål og slutresultat']:
    if term.lower() not in text.lower():
        fails.append(f'term missing: {term}')
for k in ['stop.bif.kr', 'udenVagt.kr', 'take.over.kr', 'pulje.udbetaling', 'pulje.lukning.total', 'slut.resultat']:
    if F[k] not in text:
        fails.append(f'fact {k} = {F[k]} not in the text')
for m in re.finditer(r'(?<![\w.])\d+\.\d{1,2}(?![\d.])', text):
    ctx = text[max(0, m.start() - 30): m.end() + 30].replace('\n', ' ')
    if not re.search(r'[a-z_]+\.\d|tot:|\.ts|\.mjs|v\d|\d\.\d\.\d', ctx):
        warns.append(f'decimal point: …{" ".join(ctx.split())}…')

with tempfile.TemporaryDirectory() as d:
    subprocess.run(['pdftoppm', '-r', '18', '-png', str(PDF), f'{d}/p'], check=True)
    for i, f in enumerate(sorted(Path(d).glob('p-*.png')), 1):
        im = Image.open(f).convert('RGB')
        w, h = im.size
        for (x, y) in [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)]:
            r, g, b = im.getpixel((x, y))
            if max(r, g, b) > 40:
                fails.append(f'page {i}: light corner {r, g, b}')
                break

for w in warns:
    print('WARN', w)
for f in fails:
    print('FAIL', f)
print('verify:', 'OK' if not fails else f'{len(fails)} failures')
sys.exit(1 if fails else 0)
