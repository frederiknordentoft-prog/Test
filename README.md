# FPS Warehouse Slice

A first-person shooter vertical slice built with React Three Fiber. Warehouse /
industrial-storage theme: cold concrete, oxidized teal metal, rust, and one warm
shaft of daylight.

## Run

```bash
npm install
npm run assets       # downloads the minimal asset set into public/assets/
npm run dev          # http://localhost:5173
```

`public/assets/` is git-ignored — regenerate it with `npm run assets`
(or `npm run assets:full` for the complete warehouse wishlist). The fetcher is
idempotent and skips files that already exist. Only `manifest.json` (logical
asset name → file path) is committed.

## Stack

Vite · React · TypeScript · three · @react-three/fiber · drei · rapier
(physics) · @react-three/postprocessing (N8AO, Bloom, ACES tone mapping,
Vignette, SMAA) · zustand · leva (dev panel).

## Asset sources & licensing

- **[Poly Haven](https://polyhaven.com)** — HDRIs, PBR textures, and prop
  models. All Poly Haven **assets are CC0** (free for any use, including
  commercial). However, the Poly Haven **API** used by
  `scripts/fetch-assets.mjs` is free only for non-commercial/academic use —
  **commercial API usage requires a license**. Fine for this prototype; if
  this ever ships commercially, download the assets manually from
  polyhaven.com or arrange an API license.
- **[Kenney](https://kenney.nl)** — prototype textures, blaster kit, and extra
  prop packs. All **CC0**; no attribution required, but attribution is
  appreciated — thanks, Kenney!
