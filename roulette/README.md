# Roulette — Vertical Slice

Near-photorealistic European roulette wheel in React Three Fiber.
**RNG decides the outcome; physics only illustrates it** — ball trajectories are
pre-baked in the stationary bowl frame, and the rotor's final angle is computed
per spin so the RNG-chosen number sits under the ball's capture angle.

Built phase by phase; full architecture docs land in Phase 5.

## Status

- ✅ Phase 0 — scaffold + parametric wheel geometry, number↔angle mapping + debug tool
- ⬜ Phase 1 — trajectory baking pipeline
- ⬜ Phase 2 — playback engine (RNG → animation)
- ⬜ Phase 3 — realism pass (materials, lighting, motion)
- ⬜ Phase 4 — audio & camera feel
- ⬜ Phase 5 — variety, audit & polish

## Commands

```bash
npm run dev        # dev server
npm run build      # type-check + production build
node --experimental-strip-types scripts/check-mapping.mjs   # verify number↔angle math
node scripts/screenshot.mjs [url] [numbers...]              # headless visual check (needs playwright chromium)
```

Dev URL param: `?cam=top` for a straight top-down camera (mapping screenshots).
