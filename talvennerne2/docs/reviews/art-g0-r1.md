# Uafhængigt rubrik-review af kaninen (G0, runde 1)

Reviewer: frisk agent, der kun så PNG-arkene (closeup, species, moods, sizes, fit, silhouettes) og `docs/art-rubric.md`.
filmstrip.png og lineup.png var ikke med, så "animation" er foreløbig.

**Resultat: ikke bestået.** Middel 3,4 (krav: alle ≥ 4 og middel ≥ 4,3).

| Kriterium | Score |
|---|---|
| Genkendelighed ved 48 px | 4 |
| Silhuet | 4 |
| Proportioner | 4 |
| Kontur | 3 |
| Palet | 4 |
| Ansigtets appel | 4 |
| Pasform | 3 |
| Animation | 3 (foreløbig) |
| Butikskort ved 64 px | 2 |
| AAA-finish | 3 |

## Fund og rettelser

1. **Butikskort (blokerende):** trøjen alene fylder ca. 7×4 CSS-px i et 128 px kort og forsvinder (sizes.png ved [1064,1698]). Beregn ikonets viewBox ud fra genstandens egen bbox, så den fylder 75–80 % af kortet, og tilføj en lint der fejler under 50 %. Beskær "på kaninen"-kortet efter slot: hovedgenstande om hoved og hat, kropsgenstande fra hage til hofte. Festhatten fylder kun 25–30 % af kortbredden: beskær tættere eller skalér ca. 15 % op.
2. **Trøjens pasform:** ribkanten er et lige rektangel med kantede ender, der stikker 3–5 px ud over kroppen; lad den følge kroppens kurve med runde ender inden for konturen. Ingen ærmer: armene ligger påklistret ovenpå; tegn ærmer i trøjens farve og striber med ribmanchet over poten. På baby sidder ribkanten ved fødderne (tønde); tilpas til babyens kortere torso. Fyld stikker 1–2 px uden for konturen; centrér strøget og luk ribkantens ender med kontur.
3. **Huens ørehuller:** ørerne er klippet af med en skarp kurve uden kontur (spidse "tænder"); giv øret en blød, afrundet bund skjult i hullet, og læg hullets kant ovenpå. Huens højlys ligger op ad øret; clip det til kuplen, mindst 6 enheder fra hullerne.
4. **Sømme:** hårfin lys/mørk bue hvor hovedets fyld ligger over ører og pandelok (alle farver, også ved 256 px). Tegn hoved, ører og lok som én samlet fyldsti under detaljerne, eller lad fyldet ligge 0,5–1 enhed ind under ørerne.
5. **Konturfarve:** Hollænder (c4) har næsten sort kontur på ørerne og lys mauve på hoved og krop. Brug én konturfarve for hele figuren (fx mellemmørk plomme ca. #6A5670).
6. **Festhatten:** keglens kontur titter frem under flæsens venstre ende; afkort keglen eller gør flæsen bredere.
7. **Stadie 3** er næsten umuligt at skelne fra stadie 2 (samme højde, ca. 4 % større areal). Gør "stor" 10–15 % højere og mere moden: længere ører, større bagfødder, brystpels/halsflæse, lidt mindre øjne i forhold til hovedet.
8. **Armene** er frie ovaler midt på maven ("påklistrede pølser"). Lad armenes top forsvinde ind under hovedets kant eller kroppens side (åben kontur ved skulderen), og gør poterne rundere.
9. **Silhuet:** halen smelter sammen med højre fod, fødderne er flade ovaler, kroppen en generisk klokke. Større halekvast adskilt med negativt rum, lårbule, længere fremadrettede bagfødder. Lop-silhuetten ligner abe/hund med hætte: ørerne skal hænge længere og smallere forbi kinderne med synlig ørebase.
10. **48 px:** hvid baby og regnbue er svage (lys kontur på næsten hvid pels), knurhår bliver støj, babyen fylder kun 55–60 %. Lav en LOD til ≤ 64 px: mørkere og ca. 30 % tykkere kontur, ingen knurhår eller tåliner, og skalér babyen op.
11. **Palet:** regnbue og c1 hvid har næsten samme krop; giv regnbuen særpræg (bugplet eller halsflæse i pastelstriber, lok i alle regnbuens farver). Guld læses som almindelig gul: ravbrun kontur (ca. #7A4A10), ravskygge og et smalt glansbånd. Rosa (c6): næse og kinder for svag kontrast; brug ca. #E8628C med 60 % alfa på kinderne. Regnbuens inderører har gradient, men kun manke og hale må have det: brug flade pastelstriber.
12. **"Ups"** læses som bekymret/undskyldende (løftede indre bryn, sammenknebne øjne) og kan virke skyldfremkaldende efter en fejl. Gør det legende: neutrale bryn, ét øje lukket eller "> <", lille grin med tungen ude, behold sveddråben.
13. **Tænderne** er to svævende hvide firkanter; tegn ét sæt fortænder, der hænger fra overlæben (to afrundede rektangler med midterstreg, ca. dobbelt så store).
14. **Vinker** ligner at pege: løft poten ved siden af hovedet med bøjet albue og vip hovedet. **Jubel** ligner et kram: arme op i V, ørerne rejst. Tankebobler og Zzz ligger oven på øret: fast anker uden for hoved/øre-bbox med ca. 8 enheders luft.
15. **Animation:** krop og arme er ens i 5 af 7 humør; giv hvert humør en kropslig nøglepose (tænker: pote på hagen; sover: sammensunket med ørerne nede; ups: pote bag nakken). I "animeret"-rækken ligger hovedet ca. 50 px lavere end i "statisk" og skæres af billedteksten — tjek den lodrette forskydning.
16. **AAA-finish:** ligner en pæn men generisk kawaii-stockvektor. Tilføj ét ejerbart særpræg (fx et øre med et lille knæk, pelsflip på kinden eller hvid halsflæse), lårbule og fnug i brystkonturen; trøjens striber skal krumme med kroppen, og stoffet skal ikke have plastikglans.

Godt: harmonisk palet, store blanke øjne, hageskygge, tåliner, fnugget hale, øjnenes to højlys, øjensporing.
