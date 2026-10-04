# Piktogrammer runde 1: blind navnetest (REVP)

Reviewer: REVP (uafhængig, har ikke tegnet noget af kunsten)
Dato: 2026-10-04

## Metode

- Jeg har kun åbnet `/tmp/tv2-pikto/blind-46.png` og `/tmp/tv2-pikto/blind-78.png`. Kode, rapporter, nøgle og øvrige filer er ikke åbnet før dette commit.
- Billederne er gengivet i 2x. Ikonerne fylder ca. 92 og ca. 156 fysiske px, svarende til 46 og 78 CSS-px på en retina-skærm. På en 1x-skærm er alle detaljer halvt så store. Det har jeg ikke testet i blindrunden.
- **Priming:** Briefen, som jeg skulle læse først, nævner forvekslingerne bus/lastbil, tog/bus, skib/hval og ske/gaffel og nabomaterialerne gulerod, blad, blyant og regnorm. Syv af de tolv kategorier (tog, bus, lastbil, skib, hval, ske, gaffel) var altså nævnt, før jeg så billederne, og det kan have gjort mig mere sikker på dem. Fly, sko, kam, bro og hus var ikke nævnt.
- "Sikker" betyder mindst 90 % sandsynlighed. Tallet i parentes er mit eget skøn.

## Svar

| # | Hvad (46 px) | Hvad (78 px) | Sikkerhed | Note |
|---|---|---|---|---|
| 1 | fly | fly | 46: sikker (~98 %) · 78: sikker (~99 %) | Kendetegn: vinger, halefinne, vinduesrække og cockpitrude. Kan næppe forveksles, højst med et legetøjsfly eller en raket. |
| 2 | sko | sko | 46: sikker (~90 %) · 78: sikker (~94 %) | Høj gummisko med krydsede snørebånd, sløjfe og sål. Sålen er en fritliggende grå "pille", der stikker ud foran og bagved, så den kan læses som en skøjteskinne (skøjte). Barnet kan også sige støvle eller kondisko. Grænsetilfælde ved 46 px. |
| 3 | skib | skib | 46: sikker (~97 %) · 78: sikker (~98 %) | Kendetegn: skrog med koøjer, kahyt med vinduer, gul skorsten med sort top og vand. Barnet kan sige båd eller færge i stedet for skib. Forveksling med hval er ikke sandsynlig. |
| 4 | hval | hval | 46: sikker (~98 %) · 78: sikker (~99 %) | Kendetegn: pust (vandsprøjt), halefinne, øje og lys bug. Uden pustet ville den kunne være en fisk eller delfin, men pustet afgør det. Ved 46 px ligner pustet lidt en lille fontæne eller blomst. |
| 5 | tog | tog | 46: sikker (~93 %) · 78: sikker (~96 %) | Rødt lokomotiv med førerhus og skorsten, grøn vogn og mange hjul. Silhuetten er legetøjstogets. Det kan forveksles med en traktor (rød, skorsten-agtig udstødning, ét større hjul i midten), men risikoen er lav. |
| 6 | ske | ske | 46: sikker (~95 %) · 78: sikker (~97 %) | Kendetegn: oval skål med højlys og smalt skaft. Den kan forveksles med en lup eller øse og er tydeligt forskellig fra gaflen. Den er tegnet tyndere og fylder mindre end de andre ikoner. |
| 7 | lastbil | lastbil | 46: sikker (~95 %) · 78: sikker (~97 %) | Orange lad, blåt førerhus med rude og tre hjul. Barnet kan sige varevogn eller flyttebil (samme kategori), men næppe bus. |
| 8 | kam | kam | 46: sikker (~91 %) · 78: sikker (~96 %) | Lyserød ryg med højlys og 8 tænder. Den kan forveksles med en børste, et rivehoved eller et hårspænde. Tænderne er tynde (ca. 4 fysiske px ved 46 px i 2x) og kan flyde sammen på en 1x-skærm. Grænsetilfælde ved 46 px. |
| 9 | bro | bro | 46: sikker (~92 %) · 78: sikker (~97 %) | Kendetegn: stenbue, gelænder på toppen og vand under buen. Den kan forveksles med en tunnel, en port eller en mur. Gelænderet er småt ved 46 px, men vandet redder læsningen. |
| 10 | hus | hus | 46: sikker (~99 %) · 78: sikker (~99 %) | Kendetegn: tag, skorsten, dør og to vinduer med sprosser. Ingen forveksling. |
| 11 | gaffel | gaffel | 46: sikker (~95 %) · 78: sikker (~98 %) | Fire tænder og skaft. Den kan forveksles med en rive eller et greb og er tydeligt forskellig fra skeen. |
| 12 | bus | bus | 46: sikker (~90 %) · 78: sikker (~95 %) | Gul, lang vinduesrække og to bilhjul. Karrosseriet er kort (ca. 1,3:1), og der er ingen dør eller tydelig front, så det kan læses som en togvogn, sporvogn eller minibus. Grænsetilfælde ved 46 px. |

## Sammenfatning før nøglen

- Svarene er de samme ved 46 og 78 px.
- Sikre svar: 12/12 ved 46 px og 12/12 ved 78 px. Om svarene er rigtige, afgøres mod nøglen i trin 2.
- Grænsetilfælde ved 46 px (ca. 90 %): 2 (sko/skøjte), 8 (kam/børste) og 12 (bus/togvogn).
