# Kalibrerings-datagrundlag — manifest

Dette er det virkelige, kildeangivne datagrundlag for modellens kalibrering og
backtest (flagskib Etape A). Hver serie er hentet fra offentlige kilder i juli
2026. Filosofien er perspektivdokumentets fælde 3/4: **hver værdi har en kilde
og en konfidens, og det, der ikke kan skaffes, står eksplicit som et hul** — det
skjules ikke.

Konfidens: 🟢 officiel, multipelt bekræftet · 🟡 enkelt/sekundær kilde eller
mindre uoverensstemmelse · 🔴 estimat/skøn.

## Filer

| Fil | Indhold |
|---|---|
| `historical.csv` | Dansk årsserie: GGR pr. vertikal, kanalisering, ROFUS, prævalens, Danske Spil-økonomi, håndhævelse |
| `concentration.csv` | Indtægtskoncentration (UK Patterns of Play, Finland) — det #1 manglende parameter |
| `experiments.csv` | Naturlige eksperimenter: Sverige-reregulering, Betano-entry, DK-operatørandele, PGSI-overgange, elasticiteter |

## Nøgletal og kilder

**Danske vertikal-GGR (mio. kr.):** Online casino overhalede betting i **2020**
(COVID: sportskalenderen kollapsede, casino steg). Casino 2.453 (2020) → 3.077
(2023) → 3.529 (2024) → 4.310 (2025). Betting fladt ~2.100–2.400. Lotteri
~3.400–3.720. Kilder: Spillemyndigheden "Spilmarkedet i tal" 2022–2025 via iGB,
SBC News, Intergame, World Casino Directory.

**Indtægtskoncentration (HIGH):** UK Patterns of Play (Forrest/McHale, Univ.
Liverpool for NatCen/GambleAware; 139.152 konti, 2018/19). Top-5 % = **67 %** af
al online-omsætning; **82 % for slots/RNG-casino**, 65 % for sportsbetting.
Finland (Salonen): 4,2 % af spillerne = 50 % af forbruget. Dette er den bedste
tilgængelige forankring af `spend_sigma` (der findes ingen dansk ækvivalent).

**Sverige-reregulering 2019 (naturligt eksperiment):** Betting ~94–95 %
kanaliseret, men online casino kun **57–72 %** (Spelinspektionen 70 %, ATG 57 %,
Copenhagen Economics 72–78 %). Asymmetrien tilskrives i høj grad bonusforbuddet
(én bonus ved tilmelding, ~SEK 100-loft). Forankrer Etape C.

**ROFUS:** 1.456 (2012) → 40.000 (2023) → 60.325 (maj 2025) → 73.192 (jun 2026).
78 % mænd; u. 20 er 96 % mænd.

**Prævalens (Rambøll for Spillemyndigheden 2021):** 478.000 voksne (10,9 %) med
PGSI 1+ (fordoblet fra 5,2 % i 2016); 29.500 (0,67 %) med PGSI 8+.

**Danske Spil:** omsætning 5,04 mia. (2023) → 5,26 mia. (2024); overskud 1,82 →
~1,95 mia.; udlodning 1,68 → ~1,80 mia. — bekræfter modellens grønne ankre.

**Håndhævelse 2025:** 695 undersøgt / 334 blokeret / −34 % trafik / 36 frivillige
exits. Bekræftet.

**DK-operatørandele (🟡, enkelt-analytiker):** Danske Spil 24,6 %, bet365 12,4 %,
Royal Casino 7,3 %, Spilnu 6,2 %, Mr Green 5,3 %, Betano 3,7 % (+157 % YoY).

## Vigtige forbehold

1. **Metode-break 2024/2025:** Spillemyndigheden rebasede tal i "Spilmarkedet i
   tal 2025" ~+5–9 % (2024-total ~11,0 mia. i 2024-rapporten vs. ~11,6 mia. i
   2025-rapporten). **Niveauer er basis-afhængige; trends er robuste.** Serien
   bruger konsistent basis hvor muligt og flagger skiftet.
2. **Kanalisering ≠ online-andel.** Pressen forveksler dem ofte. Vi holder dem
   adskilt (`channelization_*` vs `online_share`).
3. **Tre kanaliserings-lejre for Sverige** (Spelinspektionen / Copenhagen
   Economics / ATG) — vælg én metode pr. sammenligning, bland ikke.

## Datahuller (markeret 🔴 / mangler — hentes manuelt fra en browser)

- **Ren månedsserie 2012→nu** pr. vertikal: findes på Spillemyndighedens PowerBI-
  dashboard + `data-til-maanedsstatikken.xlsx` på spillemyndigheden.dk/statistik,
  men medie-URL'erne 404'er for scrapere, og web.archive.org er blokeret af
  miljøets egress-politik. **Hent disse to direkte fra en browser for den fulde
  serie.** Vi arbejder derfor med årlige ankre, ikke ~170 månedspunkter.
- **Primær-PDF'er** ("Gambling Market in Numbers" 2020–2024) kunne ikke åbnes
  (JS-SPA returnerer 404-skaller). Kanoniske stier: `…/uploads/2025-04/Gambling
  Market in Numbers 2024.pdf` m.fl.
- **Per-vertikal 2012–2019** kun spredte punkter; 2021-splits er estimater 🔴.
- **Punkt-elasticitet for bonus/reklame → tilvalg:** findes ikke publiceret
  (kun retningsbestemt evidens fra Sverige/Spanien/Italien).
- **Dansk koncentrations-tal:** findes ikke; Finland (Salonen) er nærmeste
  nordiske proxy.
- HMRC Report 313's sektor-elasticiteter (billed-PDF, ikke udtrækbar).

## Konsekvens for modellen

- `spend_sigma` hæves fra 1,70 → **2,00** (top-5 % ≈ 65 %, tæt på PoP's 67 %);
  casino er endnu mere skævt (82 %), noteret.
- Vækstrater bekræftet: casino ~+14,7 %/år (2023→24), accelererende til +22 %
  (2024→25); betting nær-fladt. Kalibreres formelt i Etape B.
- DS-ankre (5,16 / 1,79 mia.) bekræftet mod årsrapporterne.
