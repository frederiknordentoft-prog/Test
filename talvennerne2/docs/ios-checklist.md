# iOS-tjekliste – Talvennerne 2

Chromium er ikke iOS. Kun en rigtig iPad eller iPhone kan bekræfte de ti punkter nedenfor. Det tager cirka 15 minutter.

**Forberedelse**
- Brug en iPad eller iPhone med iPadOS/iOS 16.4 eller nyere.
- Åbn `https://frederiknordentoft-prog.github.io/Test/talvennerne2/` i Safari.
- Tryk på Del → **Føj til hjemmeskærm**, og start appen fra ikonet.

Lagringen på hjemmeskærmen er adskilt fra Safari-fanen. Brug derfor ikonet til alle punkter.

Skriv ✓ eller ✗ ud for hvert punkt. Ved ✗: skriv kort, hvad der skete, og åbn gerne `…/talvennerne2/diag.html` og send et skærmbillede.

| # | Punkt | Sådan tester du | Forventet | ✓/✗ |
|---|---|---|---|---|
| 1 | Oplæsning med lydløs slået til | Slå lydløs til (kontakten eller Kontrolcenter). Start en tur. | Opgaven læses højt alligevel. Under forældreindstillinger kan "Følg lydløs-knappen" slås til; så er appen tavs, når lydløs er slået til. | |
| 2 | Lydtjek | Første start: forældreintro, derefter "Tryk på katten". Tryk forkert to gange med lyden slukket. | Ved rigtigt tryk går appen videre. Efter to forkerte vises et kort med "Tænd for lyden" og en tegning af kontakten. | |
| 3 | Genoptag efter hjemknap | Midt i en tur: gå til hjemmeskærmen, vent 10 sekunder, åbn appen igen. | Appen viser "Tryk for at fortsætte". Efter et tryk læses opgaven igen, og turen fortsætter på samme opgave. | |
| 4 | Genoptag efter at appen er lukket | Midt i en tur: luk appen helt (stryg den væk i app-skifteren). Åbn den igen fra ikonet. | Samme barn, samme tur og samme opgave som før. | |
| 5 | Profil bevaret efter genstart | Opret et barn, spil én tur og luk appen helt. Genstart enheden, og åbn appen fra ikonet. | Barnet, dyrene og fremgangen er der stadig. | |
| 6 | To profiler adskilt | Opret et barn mere (voksen-gaten). Spil en tur med hvert barn. | Hvert barn har sine egne dyr, perler og fremgang. Profilvælgeren vises ved start og læser navnet op ved tryk. | |
| 7 | Flydende tur | Spil en hel tur på ti opgaver, inkl. træk på tallinjen og tælling. | Ingen hak ved tryk, træk eller skift mellem opgaver. Oplæsningen starter uden mærkbar forsinkelse. | |
| 8 | Flydende Dyrehave med 12 dyr | Når barnet har mindst 12 dyr: åbn Dyrehaven og rul rundt. | Animationerne er jævne, og enheden bliver ikke varm. | |
| 9 | Træk på uret og mønter | Når klokken og penge er med (bølge 2): stil viserne og træk mønter. | Viserne følger fingeren, og mønterne lander, hvor de slippes. | |
| 10 | Ingen andre apps påvirket | Åbn `…/Test/` og den første Talvennerne (`…/Test/talvennerne/`). | Forsiden viser alle apps. Den første Talvennerne har sine egne data som før. | |

**Hvis noget fejler:** `diag.html` viser lydens tilstand, stemmen, sprites og en timingtest. Et skærmbillede af den er den hurtigste vej til en rettelse.
