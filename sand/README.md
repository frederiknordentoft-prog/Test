# Falling Sand — neon-pixelfysik i browseren

Et falling-sand / pixel-fysik sandbox (à la Noita/Powder Toy) som én selvstændig
HTML-fil. Bygget efter Godot-spec'en i opgavebeskrivelsen, men implementeret som
ren HTML5/Canvas så det kører direkte på iPhone uden installation — Godot-webexports
er tunge og upålidelige i iOS Safari, og arkitekturen er den samme:

**fladt grid (`y*W+x`) → pixelbuffer (`ImageData`) → canvas i sim-opløsning →
nearest-neighbor-opskalering.**

## Kør det
Åbn `index.html` i en browser — intet build, ingen dependencies.

## Styring
- **Finger/mus**: tegn med valgt element (hold for at hælde)
- **Palette nederst**: Sand, Vand, Olie, Ild, Lava, Syre, Træ, Plante, Mur, Slet
- **Slider**: penselstørrelse (desktop: scrollhjul eller `[` / `]`)
- **⏸** pause · **☂** regn (drypper valgt element fra toppen) · **✕** ryd alt
- Desktop: `1–9`/`0` vælger element, `mellemrum` pause, `C` ryd, `R` regn

## Fysikken
- **Densitets-swaps**: tungere celler synker gennem lettere væsker/gasser — det
  giver olie-på-vand, bobler og røg-stiger "gratis" uden særregler.
- **Scanretning** skifter hver frame (venstre↔højre) så materiale ikke driver skævt.
- **Aktive chunks** (16×16): stillestående områder springes over; alt der ændrer
  sig vækker sin chunk og naboerne.
- Reaktioner: vand slukker ild (→damp), ild antænder olie/træ/plante, lava+vand→sten,
  damp kondenserer under lofter, syre opløser sten/mur/træ/sand, planter gror i vand.
- Glød: et separat emissivt lag (ild/lava/syre) blurres og screen-blendes ovenpå.

## Status
Alle faser fra spec'en er implementeret (kerne-loop, væsker, reaktioner,
chunks + glød). Verificeret med headless-tests: sand bunker, vand finder niveau
og bevares, olie stiger op gennem vand, lava+vand→sten+damp, ild æder olie,
syre æder sten. Simulation: ~0,25 ms/step på et 130×281-grid.
