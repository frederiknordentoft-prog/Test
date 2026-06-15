# Web apps

This branch hosts two independent web apps behind one landing page, so both can
be live on the same GitHub Pages site at once:

| Path | App |
|------|-----|
| `/` | Landing page linking to both |
| `/vm/` | **World Cup 2026** — groups, fixtures, results, scorers, bracket |
| `/elpriser/` | **Elpriser** — hourly electricity spot prices (Østdanmark) |

## Open it locally

Serve the folder root and open it (root shows the landing page):

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

(`file://` works too, but the World Cup app's live-refresh fetch only runs over
`http(s)://`.)

### Add to iPhone home screen
Open an app in Safari → Share → **Add to Home Screen**. The World Cup app
launches full-screen like a native app (PWA) and works offline.

---

## World Cup 2026 (`/vm/`)

- **Groups** — all 12 groups (A–L), 48 teams with flags. Standings computed
  automatically from played matches (top 2 green, 3rd place amber).
- **Matches** — the full 72-match group schedule with results, kick-off times
  and venues, plus a day filter. Tap a match for goalscorers and details.
- **Bracket** — the official Round of 32 pairings and the path to the final.
- **Language** — English / Danish toggle (top-right), remembered between visits.

### Data (hybrid)
- **`vm/data.js`** is the bundled snapshot — renders instantly and works offline.
- **`vm/data.json`** is the same data served as a file. On load (and every ~90s,
  and the **LIVE** button) the app re-fetches it so a redeploy updates scores
  without a reload. The service worker is network-first on this file.
- **Optional real-time API:** point `CONFIG.liveUrl` in `vm/app.js` at any
  endpoint returning the same JSON shape (same-origin or CORS-enabled).

To update results, edit a match in **`vm/data.json`** (set `hs`/`as`, optionally
add `goals`), then regenerate the bundled copy and push:

```bash
cd vm && { printf 'window.WC2026 = '; cat data.json; printf ';\n'; } > data.js && cd ..
git commit -am "Update results" && git push
```

Standings recalculate automatically — you never edit a table by hand.

World Cup data compiled and cross-checked against Wikipedia's
[2026 FIFA World Cup](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup) group
pages and FIFA. Snapshot taken June 15, 2026 (group stage in progress).

## Elpriser (`/elpriser/`)

Hourly electricity spot prices for Østdanmark (DK2), pulled live from
[elprisenligenu.dk](https://www.elprisenligenu.dk). Unchanged from its original
branch — just moved into a subfolder so it can be served alongside the World
Cup app.

---

## Publish on GitHub Pages

Plain static files, no build step. In **Settings → Pages → Build and
deployment**:

1. **Source:** Deploy from a branch.
2. **Branch:** this branch, folder **/ (root)** → **Save**.

Within a minute both apps are live: `…github.io/<repo>/vm/` and
`…github.io/<repo>/elpriser/`, with the landing page at the root.
