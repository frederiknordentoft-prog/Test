# Fælles regler for modul-agenter
You are building ONE module of "NORDLYS · SOLSTORM G5", a AAA procedural casino-slot UI demo (play money) in /home/user/Test/automat.
READ FIRST: /home/user/Test/automat/PLAN.md (full design; Danish) and /home/user/Test/automat/docs/CONTRACTS.md (binding module APIs + rules). Also read src/math/types.ts, src/core/palette.ts, src/game/tiers.ts, src/core/cosmeticRng.ts.

HARD RULES
- Only create/modify files you own (listed below) plus your dev harness files dev/<key>.html and dev/<key>.ts (and dev/<key>-*.mjs helper scripts). Never edit shared files (types.ts, palette.ts, tiers.ts, cosmeticRng.ts, package.json, vite.config.ts, tsconfig.json, index.html, PLAN.md, docs/*, src/main.ts). Other agents are working in the same tree concurrently on other modules — ignore their files and their type errors.
- Do NOT run npm install, do NOT git commit/push/stash/checkout. If you need a dependency or a shared-file change, put it in your final report.
- Match the exported API in CONTRACTS.md exactly (names, signatures). You may add extra exports.
- Pixi v8.21 API (check node_modules/pixi.js/lib/*.d.ts when unsure). Shaders: '#version 300 es' first line in BOTH vertex and fragment + 'precision highp float;'. Filters: resolution 'inherit' unless intentionally lower.
- TypeScript: erasableSyntaxOnly (no enum/namespace/param properties), imports with .ts extensions. Check your files with: cd /home/user/Test/automat && npx tsc --noEmit 2>&1 | grep -E '<your paths>' (ignore errors in other modules' files).
- Cosmetic randomness only via src/core/cosmeticRng.ts (crand). No Math.random in src/math.
- Zero allocations in per-frame update paths. Keep full-res fragment shaders cheap (mobile target 60 fps).

DEV HARNESS & VISUAL VERIFICATION
- Start your own dev server in the background on YOUR port: cd /home/user/Test/automat && (npx vite --host 127.0.0.1 --port <PORT> --strictPort > /tmp/claude-0/vite-<key>.log 2>&1 &) ; then open http://127.0.0.1:<PORT>/dev/<key>.html
- Screenshots: node scripts/shoot.mjs <url> shots/<key>-<name>.png <w> <h> <waitMs> [dpr]  (headless Chromium, WebGL2 via SwiftShader; prints pageerrors/console errors — there must be none except favicon 404). Make the harness deterministic via URL hash params (e.g. #t=2.5&kp=7) and set window.__probe = {...} for any values you want printed. You may write your own playwright-core script in dev/<key>-shoot.mjs (executablePath '/opt/pw-browsers/chromium', args ['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']).
- LOOK at your screenshots with the Read tool (it displays PNGs). Judge them like a AAA art director at a top slot studio (Pragmatic/Nolimit/Hacksaw/Push level, 2026). Iterate until it genuinely looks premium, not programmer-art. SwiftShader is slow — keep harness resolutions modest when iterating (e.g. 390x844 and 1280x720), and stop the dev server when you finish (kill the process on your port).
- Put screenshots in /home/user/Test/automat/shots/ (gitignored).

FINAL ANSWER: a concise report — files created, exported API (note any deviation from CONTRACTS.md and why), how to use it (integration notes: setup order, per-frame calls, sizes, costs), screenshot paths worth looking at, known limitations, and any shared-file/dependency requests.
