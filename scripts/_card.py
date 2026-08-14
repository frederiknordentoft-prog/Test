#!/usr/bin/env python3
"""Opret eller opdatér ét app-kort på forsidens index.html.

Rører kun det kort der peger på ./<slug>/ plus tælleteksten i <p class="lead">.
Alle andre kort står urørt — det er hele pointen. Kaldes af deploy-page.sh.
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

CARDS_OPEN = '<div class="cards">'
DANISH = {
    1: "Én", 2: "To", 3: "Tre", 4: "Fire", 5: "Fem", 6: "Seks",
    7: "Syv", 8: "Otte", 9: "Ni", 10: "Ti", 11: "Elleve", 12: "Tolv",
}


def card_markup(slug: str, title: str, emoji: str, sub: str, cls: str) -> str:
    e = html.escape
    return (
        f'      <a class="card {cls}" href="./{e(slug)}/">\n'
        f'        <span class="emoji">{e(emoji)}</span>\n'
        f'        <span class="card-body">\n'
        f'          <span class="card-title">{e(title)}</span>\n'
        f'          <span class="card-sub">{e(sub)}</span>\n'
        f'        </span>\n'
        f'        <span class="chev">›</span>\n'
        f'      </a>\n'
    )


def find_cards_block(doc: str) -> tuple[int, int]:
    """Returnér (start, end) for indholdet mellem <div class="cards"> og dens </div>."""
    open_at = doc.find(CARDS_OPEN)
    if open_at < 0:
        sys.exit('index.html har ingen <div class="cards"> — er det den rigtige forside?')
    i = open_at + len(CARDS_OPEN)
    depth = 1
    for m in re.finditer(r"<div\b|</div\s*>", doc[i:]):
        depth += 1 if m.group(0).startswith("<div") else -1
        if depth == 0:
            return i, i + m.start()
    sys.exit('index.html: <div class="cards"> lukkes aldrig')


def existing_card(block: str, slug: str) -> re.Match | None:
    return re.search(
        r'[ \t]*<a\b[^>]*href="\./%s/"[\s\S]*?</a>[ \t]*\n?' % re.escape(slug),
        block,
    )


def existing_class(match: re.Match | None) -> str | None:
    if not match:
        return None
    m = re.search(r'class="card\s+([^"]*)"', match.group(0))
    return m.group(1).strip() if m and m.group(1).strip() else None


def pick_class(slug: str, block: str) -> str:
    """Kort bruger en kort klasse (vm, el, ku …). Find en der ikke er taget."""
    taken = set(re.findall(r'class="card\s+([a-z0-9-]+)"', block))
    letters = re.sub(r"[^a-z0-9]", "", slug) or "app"
    for cand in (letters[:2], letters[:3], letters[:4], slug):
        if cand and cand not in taken:
            return cand
    n = 2
    while f"{letters[:2]}{n}" in taken:
        n += 1
    return f"{letters[:2]}{n}"


def update_lead(doc: str, count: int) -> str:
    word = DANISH.get(count, str(count))
    return re.sub(
        r'(<p class="lead">)[^<]*(</p>)',
        lambda m: f"{m.group(1)}{word} web-apps, hver på sin egen side.{m.group(2)}",
        doc,
        count=1,
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("index")
    p.add_argument("--slug", required=True)
    p.add_argument("--title", required=True)
    p.add_argument("--emoji", required=True)
    p.add_argument("--sub", required=True)
    a = p.parse_args()

    path = Path(a.index)
    doc = path.read_text(encoding="utf-8")
    start, end = find_cards_block(doc)
    block = doc[start:end]

    found = existing_card(block, a.slug)
    cls = existing_class(found) or pick_class(a.slug, block)
    card = card_markup(a.slug, a.title, a.emoji, a.sub, cls)

    if found:
        block = block[: found.start()] + card + block[found.end():]
        action = "opdateret"
    else:
        block = block.rstrip("\n \t") + "\n" + card + "    "
        action = "tilføjet"

    doc = doc[:start] + block + doc[end:]

    start, end = find_cards_block(doc)
    count = len(re.findall(r'<a\b[^>]*class="card\b', doc[start:end]))
    doc = update_lead(doc, count)

    path.write_text(doc, encoding="utf-8")
    print(f"  kort {action}: {a.emoji} {a.title} → ./{a.slug}/  ({count} apps i alt)")


if __name__ == "__main__":
    main()
