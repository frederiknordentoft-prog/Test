# World Cup 2026 ⚽

A simple, fast, Google-style web app (installable on iPhone) for the 2026 FIFA
World Cup — group standings, the full match schedule with results, and the
knockout bracket. Team flags throughout, light/dark mode, works offline.

**Hosts:** Canada · Mexico · USA — **Final:** July 19, 2026, MetLife Stadium.

## Open it

- **Live (GitHub Pages):** enabled via the workflow below.
- **Locally:** serve the folder and open `index.html`, e.g.
  ```bash
  python3 -m http.server 8000   # then visit http://localhost:8000
  ```
  (Opening the file directly with `file://` works too, but the live-refresh
  fetch only runs over `http(s)://`.)

### Add to iPhone home screen
Open the page in Safari → Share → **Add to Home Screen**. It launches
full-screen like a native app (PWA) and keeps working offline.

## How the data works (hybrid)

- **`data.js`** is the bundled snapshot — it renders instantly and is what makes
  the app work offline. This is the file to edit when you want to change scores
  or fixtures.
- **`data.json`** is the same data served as a file. On load (and every ~90s,
  and the **LIVE** button) the app re-fetches it so a redeploy updates scores
  without anyone reloading. The service worker is network-first on this file.
- **Optional real-time API:** point `CONFIG.liveUrl` in `app.js` at any endpoint
  that returns the same JSON shape (e.g. a small proxy in front of a football
  data API). Must be same-origin or CORS-enabled. Leave it on `data.json` to run
  purely on the bundled data.

### Updating results
Edit a match in **`data.json`**, set its `hs` (home score) and `as` (away score),
then regenerate the bundled copy and redeploy:

```bash
{ printf 'window.WC2026 = '; cat data.json; printf ';\n'; } > data.js
git commit -am "Update results" && git push
```

Standings (points, goal difference, ranking) are computed automatically from the
played matches — you never edit a table by hand.

## Enable GitHub Pages (one-time)

The workflow at `.github/workflows/pages.yml` deploys on every push to this
branch. To turn it on:

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to the branch (or run the workflow manually). The deploy URL appears in
   the Actions run summary.

## Sources

Group draw, fixtures and results compiled from Wikipedia's
[2026 FIFA World Cup](https://en.wikipedia.org/wiki/2026_FIFA_World_Cup) group
pages and FIFA. Data snapshot taken June 15, 2026 (group stage in progress).
