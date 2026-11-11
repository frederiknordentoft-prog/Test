# Research: sådan lærer et barn tiere og enere

Designbriefen bag appen. Den bygger på fire researchspor (pædagogik, dansk sprog, eksisterende værktøjer og øvelsesdesign), og en kritisk gennemlæsning har rettet den bagefter. Appen følger kernen. Nogle ting er bevidst ikke med i første version for at holde koden lille: utraditionelle bakker (2 tiere + 14 enere), opgaven "tryk på det, 2-tallet betyder" og visningen "vis som enere". Se README.md.

---

# Designbrief: Tiere og enere (7 år)

## 1. Kernen

1. **Én idé: 10 enere = 1 tier, og tilbage igen.** En tier er én ting, der stadig er ti: 34 = 3T 4E = 2T 14E. Et barn kan sige "fireogtredive" og skrive 34 uden at forstå det. *(Ladel m.fl. 2023; Nunes & Bryant 2009)*
2. **Mængde, talord og cifre skifter i samme øjeblik, også under veksling.** Forståelsen kommer af at koble de tre igen og igen. *(Fuson m.fl. 1997; Moyer-Packenham & Westenskow 2013)*
3. **Én enkel model, hvor tieren synligt er 10 enere.** Realistiske penge sænkede præstationen hos ældre børn (4.-6. klasse) i regnehistorier, og billedrige diagrammer gjorde det samme i 0.-2. klasse. *(Laski m.fl. 2015; McNeil m.fl. 2009; Kaminski & Sloutsky 2013; medium sikkerhed for 7-årige)*
4. **På dansk siger man enerne først (fra 13 og op).** Tysk gør det samme. Når tyske elever i 1. klasse skriver tal efter diktat, skyldes omkring halvdelen af fejlene ombytning (42 for 24). Ombytningsfejl i 1. klasse forudsagde svagere regning i 3. klasse. Der findes ingen dansk måling. *(Zuber m.fl. 2009; Moeller m.fl. 2011; begge via Klein m.fl. 2013)*
5. **Barnet gør selv, og appen guider med konkret feedback.** Konkrete materialer virker bedre med vejledning end i fri leg *(Carbonneau m.fl. 2013, via Laski m.fl. 2015)*. Feedback, der viser mere end rigtigt/forkert, hjælper mest *(Fyfe m.fl. 2023)*.

## 2. Forælderens idé: hvad holder, og hvad bør ændres

**Bakken bevares.** Den deles i to kolonner: tiere til venstre under tiercifret og enere til højre under enercifret. Enerne ligger i en 2×5-ramme, så 7 ses som "3 mangler". I øvelser med utraditionelle bakker er der to rammer (plads til 19).

**Flip-tælleren bevares, men vises aldrig alene.** En tæller viser kolonner ligesom en kilometertæller, og kolonneværdi er den svære del. Thompson interviewede 144 børn i Years 2-4. Kun 24 % kunne sige, hvad en kilometertæller viser efter 6.299 + 1. Det var en firecifret opgave med tre overgange, så tallet siger ikke direkte noget om tocifrede tal *(Thompson 2002, medium sikkerhed)*. Mængden skal derfor altid stå lige under tælleren. Skiftene 9→10, 29→30 og 30→29 er de vigtigste øjeblikke.

**Mønterne skal ændres, og den rigtige 10-krone hører ikke til i første version.** Pengehistorien ("put penge i", "veksl") kan blive. Problemet er, at en 10-krone ikke viser sine ti enere, og at størrelserne snyder: 1 kr. måler 20,25 mm og 10 kr. 23,35 mm, og 2, 5 og 20 kr. er alle større end 10 kr. Børn har vist sig at pege ti gange på tieren for at tælle "usynlige" enere, og at blande tiere og enere er netop det, de ikke kan endnu.

Tieren tegnes derfor som en *tierstang*: 10 flade 1-kroner side om side, så de kan tælles. Den tegnes ikke som en møntrulle set fra siden. Faghæftets læseplan nævner legepenge. Den er vejledende og gælder, indtil de nye fagplaner træder i kraft i skoleåret 2027/28. Udkastet til ny fagplan (juni 2026) kræver for 1.-3. klasse "konkrete, visuelle og symbolske repræsentationer", og at eleverne repræsenterer tal "på forskellige måder". *(Nunes & Bryant 2009; Nationalbanken; Faghæfte 2019; UVM udkast 2026)*

## 3. Kerne-mekanik

- **Knapper:** fem store knapper på mindst 80 px (ca. 2 cm): **+1, −1, +10, −10** og **Veksl**. På telefon står de fire i et 2×2-gitter. Bakken er kun til at se på og til at markere i øvelse 2. Et tryk fjerner aldrig noget. Ingen funktion må kræve træk. *(NN/g; Brown & Anthony 2012)*
- **+10** flipper kun tiercifret: 7, 17, 27 … (som i Faghæftets eksempel).
- **Veksling op:** Når den 10. ener lander, viser enerkortet "10" i rødt. Kortet er for bredt og ryster, fordi ét kort kun kan rumme 0-9. Linjen viser "2 tiere og 10 enere · 20 + 10 · tredive", og alle knapper undtagen **Veksl** er grå. Barnet trykker Veksl. Så glider enerne sammen til en stang, tierkortet flipper op, enerkortet går til 0, og der står "10 enere = 1 tier".
- **Veksling ned:** −1 med 0 enere er ikke grå. En stang ryster, og Veksl pulserer. Veksl bryder stangen op til 10 enere, så tælleren viser 2|10 i rødt, og næste −1 giver 29.
- **Grænser:** Tallene går fra 0 til 99. Grå er −1 ved 0, −10 uden tiere, +1 ved 99 og +10 over 89.
- **Tempo:** Et flip tager højst 300 ms, og vekslingsanimationen cirka 0,5 s. Tilstanden opdateres med det samme, så hurtige tryk aldrig går tabt eller hober sig op.
- **Tekstlinjen:** Under tælleren står altid fx "3 tiere og 4 enere · 30 + 4 · fireogtredive". Ental hedder "1 tier" og "1 ener". Nul-led udelades i summen ("3 tiere og 0 enere · 30 · tredive"), og 0 vises som "0 tiere og 0 enere · 0 · nul".
- **Farver:** Tiere er blå og enere orange, i de samme farver overalt.
- **"Vis som enere"** pakker tierne ud i rækker af ti. Hos Price (1997) overbeviste netop denne visning ét barn i timen, hvor en "7 tiere 3 enere"-visning ikke gjorde. Ved eftertesten havde hun stadig misforståelsen, så visningen skal bruges igen og igen. *(ét barn, lav sikkerhed)*

## 4. Øvelser

0. **Leg:** fri bakke som opvarmning.
1. **Byg tallet:** Barnet ser cifre eller et talord (oplæst eller læst af en voksen) og bygger tallet. Ombytningspar som 24/42, 36/63 og 14/41 kommer ofte. På lave niveauer er tælleren synlig, så barnet kan rette sig selv. Senere skjules den, indtil barnet trykker "Færdig", så det ikke bare prøver sig frem.
2. **Hvor meget er der?** Appen fylder bakken, og tælleren er skjult. Barnet skriver tallet fra venstre mod højre, og feltet tillader 3 cifre, så "204" og "214" kan fanges. Varianter:
   - **Skriv tallet:** Appen siger et talord, eller en voksen læser det højt, og barnet skriver cifrene. Det er i netop den opgave, ombytningsfejlene er målt.
   - **"Tryk på det, 2-tallet i 26 betyder":** Vælger barnet 2 enere i stedet for 2 stænger, har det taget cifret for pålydende.
   - **Senere:** bakker som 2 tiere + 14 enere.
3. **Hvad sker der?** Barnet gætter resultatet af ±1 eller ±10, før animationen kører.
   - ±1 tages mest fra tal på 9 (+1) og på 0 (−1), også 9+1 og 10−1.
   - ±10 tager også teens med tyverne (14 + 10 = 24: fjorten → fireogtyve).
   - Resultatet ligger altid i 0-99.

Niveauerne er løst inspireret af Herzog & Fritz 2022. Deres model har fem trin, fra standardopdeling til utraditionelle opdelinger uden materialer.
- N1: 0-20 (især 9↔10 og 19↔20) samt 30 og 40.
- N2: 21-49, derefter 50-99 med tierordene halvtreds-halvfems.
- N3: tierovergange i hele 0-99.
- N4: utraditionelle bakker eller skjult bakke.

**Regel:** 4 rigtige i træk i første forsøg giver ét niveau op, og 1 forkert giver ét ned. Simuleret giver det cirka 84 % rigtige på det niveau, barnet ender på. Reglen 5 op/2 ned giver kun cirka 71 %. Niveauet vises ikke for barnet. Målet på 80-90 % har *medium sikkerhed*: Jansen m.fl. 2013 fandt i 3.-6. klasse, at højere succesrate gav flere løste opgaver og større fremgang, og Wilson m.fl. 2019 er teori. Med fire grove niveauer er procenten et pejlemærke. En runde er cirka 10 opgaver, slutter på et rigtigt svar og har ingen timer. Niveauet gemmes i localStorage i try/catch, og appen virker også uden.

**Ved forkert svar** vises barnets bakke ved siden af målet, og den forkerte kolonne fremhæves ("Du har 3 tiere, vi skal bruge 4"). Barnet får ét forsøg til, og bagefter glider svaret på plads. Tre fejl får deres egen besked:
- **Ombytning** (kun når cifrene er forskellige): "Du lavede 42 = 4 tiere og 2 enere. Fireogtyve er 2 tiere og 4 enere." Bygger barnet 4 for fyrre, lyder beskeden "Du lavede 4 = 0 tiere og 4 enere. Fyrre er 4 tiere og 0 enere."
- **"204" for 24:** "Rigtigt tænkt: 20 og 4! Vi skriver 4'eren oven på 0'et." (Bower m.fl., *medium sikkerhed*)
- **"214" for 2 tiere og 14 enere:** "Rigtigt talt! Men 14 enere er 1 tier og 4 enere. Veksl, så står der 34."

## 5. Dansk sprog

- Skriv altid "2 tiere og 4 enere" ved siden af "fireogtyve". Den form viser allerede tierne først, i cifrenes rækkefølge, så appen behøver ikke et tredje navnesystem. Forælderen kan bruge "to-ti-fire" mundtligt som bro. Det bygger på ét skoleprojekt uden kontrolgruppe, og den danske stavning er ikke fastlagt.
- **11-19:** Skriv "1 tier og X enere" (11 = "1 tier og 1 ener"), og giv elleve og tolv ekstra gentagelser. 13-19 siger også enerne først, så teens hører med i ombytningsparrene.
- **50-90:** Øv tierordene for sig ("5 tiere = halvtreds") i anden halvdel af N2. Pas på tredive/tres og fyrre/firs, og på at halvtreds ikke er 3 og halvfems ikke er 5 (*egen analyse, lav sikkerhed*). At ordene bygger på et tyvetalssystem, er en note til forælderen og ikke noget for barnet.
- Appen bruger skolens ord: "tiere", "enere" og "veksle".
- **Tip til forælderen:** Når I tæller bakken sammen, så tæl tierne først: "ti, tyve, tredive, enogtredive, toogtredive". *(Laski & Siegler 2013; Chan m.fl. 2014; medium sikkerhed)*

```js
const O=['nul','en','to','tre','fire','fem','seks','syv','otte','ni'],
T=['ti','elleve','tolv','tretten','fjorten','femten','seksten','sytten','atten','nitten'],
D=['','ti','tyve','tredive','fyrre','halvtreds','tres','halvfjerds','firs','halvfems'];
const da=n=>n<10?O[n]:n<20?T[n-10]:(n%10?O[n%10]+'og':'')+D[n/10|0];
// kun heltal 0-99 (100 giver undefined); testet for alle 0-99
const lbl=(t,e)=>`${t} tier${t==1?'':'e'} og ${e} ener${e==1?'':'e'} · ${[t*10,e].filter(x=>x).join(' + ')||0} · ${da(t*10+e)}`;
// lbl(3,4) → "3 tiere og 4 enere · 30 + 4 · fireogtredive"; lbl(1,1) → "1 tier og 1 ener · 10 + 1 · elleve"
// lbl(2,10) → "2 tiere og 10 enere · 20 + 10 · tredive"; lbl(0,0) → "0 tiere og 0 enere · 0 · nul"
```

- **Oplæsning er valgfri** (*medium sikkerhed*). Find en dansk stemme med `getVoices().find(v=>/^da[-_]/i.test(v.lang))`, og tjek igen ved `voiceschanged`. Findes der ingen, skjules højttaleren. Sæt både `voice` og `lang='da-DK'`, og kald `speak()` direkte i tryk-handleren. Appen skal virke helt uden lyd. Uden stemme læser en voksen talordene højt, og ellers springes talord-opgaverne over.

## 6. Undlad

- 2-, 5- og 20-kroner, fotorealistiske mønter, en enkelt 10-krone som tier og et butiksniveau i første version.
- At vekslingen sker af sig selv uden at blive vist, og at tælleren viser et forkert tal (29 eller 20), mens der ligger 10 enere i bakken.
- At et tryk i bakken fjerner noget.
- Tal over 99.
- Et tredje navnesystem ("to-ti-fire") på skærmen.
- Konfetti, stjerner, lyd ved hvert tryk, liv, timer og summer.
- Små ikoner, styring der kun virker ved at trække, og lange tekster.
- Kun at teste med "hvilket ciffer er tieren?". Det kan barnet svare rigtigt på og stadig tro, at 2-tallet i 26 betyder 2.
- Pointsystemer, synlige niveauer, konti og backend.
- At tro, at én session er nok. Brug korte runder over flere uger og rigtige bundter derhjemme (*lav sikkerhed*).

## 7. Kilder

Ladel, Larkin & Kortenkamp 2023, The Concept of Place Value (zenodo.org/records/8229116) · Nunes & Bryant 2009, Nuffield Paper 2 · Fuson m.fl. 1997, JRME 28 · Laski m.fl. 2015, SAGE Open, doi:10.1177/2158244015589588 · Carbonneau, Marley & Selig 2013, J. Educ. Psych. 105 · McNeil m.fl. 2009, Learning & Instruction 19 · Kaminski & Sloutsky 2013, J. Educ. Psych., doi:10.1037/a0031040 · Moyer-Packenham & Westenskow 2013, IJVPLE 4(3) · Zuber m.fl. 2009, JECP 102:60-77 · Moeller m.fl. 2011, Res. Dev. Disabil. 32 · Klein m.fl. 2013, Front. Psychol. 4:480 · Ejersbo & Misfeldt 2017, CERME10 (vbn.aau.dk/ws/files/250753966/CERME10_0431.pdf) · Thompson 2002, Tes "No need to rush place value" · Price 1997, MERGA 20 · Herzog & Fritz 2022, Front. Educ. 6:642153 · Bower m.fl., "Smart errors in learning multidigit number meanings" (par.nsf.gov/servlets/purl/10506169) · Fyfe, Borriello & Merrick 2023, Educ. Psychologist 58(3) · Jansen m.fl. 2013, Learning & Individual Differences 24 · Wilson m.fl. 2019, Nature Communications 10:4646 · Laski & Siegler 2013, Dev. Psych., doi:10.1037/a0034321 · Chan, Au & Tang 2014, Learning & Instruction 29 · NN/g "Children's UX: Physical Development"; Brown & Anthony 2012 · Danmarks Nationalbank, møntrækken · BUVM Matematik Faghæfte 2019 (emu.dk) · UVM, Andet udkast: Fagplan for matematik, juni 2026 (uvm.dk/media/115b23fj/260624-fagplan-for-matematik-juni-2026.pdf) · Readium Speech, da.json