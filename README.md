# Vindtunnel 🌬️

En interaktiv aerodynamik-sandkasse i browseren. Tegn en form, skru på vinden, og **se og mål** hvordan luften opfører sig — drag, lift, hvirvelgader og stall, målt som i en rigtig vindtunnel.

## Hvad kan den?

- **Tegn dit eget objekt** med fingeren/musen, eller vælg en primitiv (cirkel, firkant, plade, dråbe)
- **Vind fra venstre** med justerbar styrke (1–30 m/s) — drag vokser med v², og det kan måles
- **Røg** (streaklines fra en røg-rake) viser strømningen live
- **Kraftvægt**: drag og lift måles ved impuls-udveksling på objektets rand (momentum exchange) — ikke fra en formel
- **Ophæng med fysik**: objektet sidder på en pind med torsionsfjeder; et tungt objekt svinger mindre end et let (F=ma)
- **Feltvisninger**: fart, hvirvler (vorticitet), tryk, strømlinjer — colorblind-sikre farveskalaer
- **Probe**: tryk et sted i tunnelen og aflæs lokal fart og tryk
- **Læringslag**: forklaringsbobler på dansk, aha-labels (stagnationspunkt, hvirvelgade), udfordringer og sammenlign-mode

## Fysikken

2D lattice-Boltzmann (D2Q9, BGK + Smagorinsky) på GPU'en via WebGL2 fragment-shaders — samme metode som Dan Schroeders vindtunnel og SimScales Pacefish. Distributioner lagres som afvigelser fra hvile (`g = f − w`), så 16-bit float rækker på mobil. CPU-fallback med samme fysik på mindre gitter.

**Ærlighed:** Det er et lærerigt 2D-legetøj, ikke certificeret CFD. Kræfter er pr. meter dybde; objektets bevægelse kobles kvasi-statisk til luften.

## Verifikation

Fysikken testes empirisk, ikke antaget:

```bash
npm run verify:physics   # CPU-kernen i Node: v²-lov, dråbe<plade, Strouhal, symmetri, stabilitet, determinisme
```

I browseren: åbn `/?harness=1` (eller `&auto=1`) — kører samme tests mod GPU-backenden.

## Udvikling

```bash
npm install
npm run dev      # dev-server
npm run build    # typecheck + produktion
npm run lint     # eslint (håndhæver bl.a. at src/engine/** er React-fri)
```

Deployes automatisk til GitHub Pages fra branchen via `.github/workflows/deploy.yml`.
⚠️ Kræver at Pages er slået til i repo-settings med **GitHub Actions** som source.

## Arkitektur

- `src/engine/` — ren TypeScript sim-motor (ingen React): LBM-backends (GPU/CPU), ophængsdynamik, enheder, geometri
- `src/engine/gpu/shaders/lbm.frag` — hjertet: fused stream+collide med alle randbetingelser
- `src/state/store.ts` — Zustand-store (UI-parametre ind, målinger ud, 10 Hz)
- `src/ui/` — React-komponenter (kun meta-UI)
- `src/harness/` — fysik-verifikation (browser + Node)
