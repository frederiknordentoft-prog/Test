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

### Data — updates itself automatically
Scores and goalscorers update on their own. No editing, no redeploy.

- **`vm/data.js`** is a bundled snapshot (fixtures, teams, last-known results) so
  the app renders instantly and works offline.
- On load, every 60 seconds, on the **LIVE** button, and whenever the app regains
  focus, it fetches **ESPN's public World Cup feed**
  (`site.api.espn.com/.../soccer/fifa.world/scoreboard`) directly in the browser
  and merges live scores, match state (LIVE / full-time) and goalscorers on top.
  ESPN needs no API key and allows cross-origin requests, so no backend is needed.
- Standings recalculate automatically from the merged results — no table is ever
  edited by hand.

This covers the group stage live. Knockout fixtures fill in once those teams are
known. If ESPN is unreachable, the app simply shows the last bundled snapshot.

To change the bundled fallback by hand, edit a match in **`vm/data.json`**
(`hs`/`as`, optional `goals`) and regenerate the bundle:

```bash
cd vm && { printf 'window.WC2026 = '; cat data.json; printf ';\n'; } > data.js && cd ..
git commit -am "Update snapshot" && git push
```

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
