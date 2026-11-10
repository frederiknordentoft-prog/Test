# Stella Nova · UI-demo

En casinoautomat med ringe i stedet for hjul: Tycho Brahes himmelmaskine i ægte 3D.
Ingen backend, ingen rigtige penge. Grafik, animation, lyd og matematik er lavet i kode uden eksterne assets.

## Kør

```bash
npm install
npm run dev              # udvikling
npm test                 # matematik- og flowtests
npm run build            # typecheck + én selvstændig dist/index.html
npm run build:artifact   # dist/stella-nova.html (sidefragment til indlejring)
npm run sim -- --spins=50000000 --seed=1 --policy=greedy   # Monte Carlo
```

## Spillet kort

- **Brættet:** 4 koncentriske ringe × 8 eger om en glødende stjerne.
- **Gevinst:** 3 eller 4 ens fra centrum og ud ad en eger.
- **Dit træk:** efter hvert spin må du dreje én ring ét hak.
- **Kædereaktion:** gevinststen splintres, nye falder ned, urværket tikker ét hak, multiplikatoren stiger.
- **Stella Nova:** stjernestøv lader stjernen op. Fuld ladning gør de to inderste ringe wild.
- **Kometnat:** 3 kometer giver gratisspil med en evig krans af wilds på inderste ring.

Regler, art bible og lydbibel står i `docs/GDD.md`. Modulgrænser og kontrakter står i `docs/ARCHITECTURE.md`. PAR-arket står i `docs/PAR.md`.

## Opbygning

| Sti | Indhold |
|---|---|
| `src/core` | Konstanter, kontrakter, seeded RNG, animationsur, loop |
| `src/math` | Udfaldsmotor, model, simulator, CLI |
| `src/render` | Three.js: scene, astrolabium, symboler, VFX, himmel, koreografi |
| `src/audio` | Syntetiseret musik og lydeffekter (WebAudio) |
| `src/ui` | HUD, menuer, gevinsttabel, matematik-lab |
| `src/game` | Director: forløb, saldo, træk-input |

Demo-menuen (☰ → Demo) kan udløse alle features med ét tryk.
`window.__SN` giver adgang til loop, director og motor til automatiseret afspilning.
