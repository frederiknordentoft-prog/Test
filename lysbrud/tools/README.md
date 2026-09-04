# Værktøjer

Alt herinde er udviklings- og verifikationsværktøj. Intet af det indgår i spillet.

## Kør spillet

    node tools/serve.mjs [port]     # statisk server, default 8080

## Matematik

    node tools/balance.mjs --spins 120000 --eps 0.8
        Profilerer den committede config: RTP, døde spins, kaskader,
        klyngestørrelser og gevinstfordeling.

    node tools/curve.mjs --spins 60000 --size 1,6,45,350,2500
        Kalibrerer gevinstkurven mod et RTP-mål og udskriver en færdig
        pays-tabel klar til at klippe ind i config.js. Måler også bonusrunden.

    node tools/model.mjs [--all]
        Uafhængig Monte-Carlo-model skrevet fra bunden. Fejer parameterrummet
        (celletal, symbolantal, overlapstærskel, mindste klynge, wildvægt) og
        kontrollerer engine.js i stedet for at arve dens antagelser.

    node tools/session.mjs --spins 30 [--raw] [--seed 7]
        Spiller en hel demo-session igennem i Node med præcis samme kaldsrækkefølge
        som main.js og skriver ud hvad spilleren ville se, bonusrunden inklusive.
        Den hurtigste måde at vurdere demoens tempo uden at sidde og klikke.

## Browserverifikation (kræver Chromium)

    node tools/run-smoke.mjs        # boot + ét spin, fanger enhver konsolfejl
    node tools/shoot.mjs --out DIR  # skærmbilleder: hvile, modaler, spin, alle brydepunkter
    node tools/qa-bonus.mjs         # spiller frem til prisme-bonussen og fotograferer den
    node tools/qa-soak.mjs          # 30 autospins: fejl, hukommelse, billedrate
    node tools/qa-layers.mjs        # billedrate med hvert tegnelag slået fra ét ad gangen
    node tools/qa-perf.mjs          # billedrate i hvile og under spin, mod en tom referenceside
    node tools/qa-dist.mjs          # verificerer dist/lysbrud.html åbnet direkte fra disk
    node tools/qa-win.mjs --mult 120   # forhåndsviser lysbruddet og fotograferer hele sekvensen
    node tools/qa-winfps.mjs        # billedrate midt i lysbruddet
    node tools/qa-antic.mjs         # tvinger anticipation og et ringstop-glimt frem og fotograferer

`window.LYSBRUD.previewWin(mult)` afspiller gevinstpræsentationen for et vilkårligt multiplum
af indsatsen uden at spinne — det er dét, qa-win.mjs bruger. `window.LYSBRUD.fx.layers` og
`window.LYSBRUD.perf` slår tegnelag fra ét ad gangen.

`qa-layers.mjs` bruger `window.LYSBRUD.perf`, som slår de enkelte tegnelag fra.
Det var dét, der afslørede at bloom-passet alene kostede 33 fps.

## Forhåndsvisninger (åbn gennem serveren)

    /tools/preview-symbols.html     alle symboler i flere størrelser
    /tools/preview-wheel.html       hjulet alene, uden chrome
    /tools/preview-backdrop.html    krystalhulen med det animerede lag
    /tools/preview-audio.html       én knap pr. lyd
