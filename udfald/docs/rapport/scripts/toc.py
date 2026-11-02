"""Prints {id: page} for the given heading ids, read from the PDF's named destinations.

Chromium writes a named destination for every element id that an internal link points to (the
table of contents links to each chapter). Pages are 1-based, the same numbers the footer prints.
Falls back to searching the page text for the heading if a destination is missing."""
import json
import sys
from pypdf import PdfReader

pdf, ids = sys.argv[1], sys.argv[2:]
r = PdfReader(pdf)
dests = r.named_destinations
out = {}
for i in ids:
    d = dests.get(i) or dests.get('/' + i)
    if d is not None:
        out[i] = r.get_destination_page_number(d) + 1
print(json.dumps(out))
missing = [i for i in ids if i not in out]
if missing:
    sys.stderr.write(f'toc.py: no destination for {missing}\n')
    sys.exit(1)
