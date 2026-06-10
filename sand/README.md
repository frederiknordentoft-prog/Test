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
- **Finger/mus**: tegn med valgt element (hold for at hælde); en ring viser penslen
- **Palette nederst**: Sand, Vand, Olie, Ild, Lava, Krudt, Fyrværkeri, Syre, Is,
  Virus, Træ, Plante, Mur, Slet
- **Slider**: penselstørrelse (desktop: scrollhjul eller `[` / `]`)
- **🔊** lyd til/fra · **⏸** pause · **☂** regn (drypper valgt element) · **✕** ryd alt
- Desktop: `1–9`/`0` vælger element, `mellemrum` pause, `C` ryd, `R` regn, `M` mute

## Fysikken
- **Densitets-swaps**: tungere celler synker gennem lettere væsker/gasser — det
  giver olie-på-vand, bobler og røg-stiger "gratis" uden særregler.
- **Scanretning** skifter hver frame (venstre↔højre) så materiale ikke driver skævt.
- **Aktive chunks** (16×16): stillestående områder springes over; alt der ændrer
  sig vækker sin chunk og naboerne.
- **Tyngdekraft med acceleration**: pulver og væsker accelererer i frit fald op til
  5 celler/frame (hastigheden gemmes pr. celle), så fald og stråler føles fysiske.
- Reaktioner: vand slukker ild (→damp), ild antænder olie/træ/plante, lava+vand→sten
  (8-nabo-tjek, så skorpen bliver tæt), damp kondenserer under lofter, syre opløser
  sten/mur/træ/sand/is, planter gror i vand, **krudt detonerer** med trykbølge og
  kædereaktioner, **is** fryser vand langsomt og smelter ved ild/lava,
  **lava/eksplosioner forglasser sand** til glas, **virus** æder alt undtagen mur
  (men kan brændes væk) og dør ud af sig selv, **fyrværkeri** stiger med gnisthale
  og brager i en ring af farvede gnister.
- Skæve vandspejl udlignes: væsker kan bytte vandret med en lettere væske, så vand
  under et olietæppe altid finder niveau. Screen shake ved eksplosioner; scenen
  bevares ved rotation/resize.
- Glød: et separat emissivt lag (ild/lava/syre) blurres og screen-blendes ovenpå.
- **Lyd**: proceduralt WebAudio (ingen lydfiler) — bas-tryk ved eksplosioner,
  knitren ved antændelse, syden når vand møder ild/lava. Mute med 🔊-knappen.

## Status
Alle faser fra spec'en er implementeret (kerne-loop, væsker, reaktioner,
chunks + glød) plus krudt/eksplosioner, is/frost, accelereret tyngdekraft og
procedural lyd. Verificeret med 20 headless-tests: sand bunker og accelererer,
vand finder niveau og bevares, olie stiger op gennem vand, lava+vand→sten+damp,
krudt detonerer i kædereaktion, is smelter/fryser, ild æder olie, syre æder sten.
Simulation: ~0,3 ms/step på et 130×281-grid.
