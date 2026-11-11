# Tiere og enere

En lille app i én fil (`index.html`), der lærer et barn på cirka 7 år, hvad tiere og enere er. Den kræver ingen installation eller server: åbn filen i en browser, gerne på en iPad.

## Sådan virker den

Øverst står en fliptæller med tiercifret og enercifret side om side. Under den ligger bakken med klodserne: blå tierstænger til venstre og orange enere i en tierramme til højre. Når bakken ændrer sig, flipper tallet, og linjen under tælleren viser tallet på tre måder: `2 tiere og 4 enere · 20 + 4 · fireogtyve`.

**Veksl er kernen.** Ener nummer 10 lægger sig ikke bare til. Tælleren viser et rødt "10", fordi ét ciffer ikke kan rumme 10, og så skal barnet selv trykke **Veksl** og se de 10 enere blive til 1 tier. Det virker også baglæns: 30 − 1 kræver, at en tier veksles til 10 enere.

**Leg** er fri bakke. **Øv** giver en runde på 10 opgaver af fire slags, der skiftes på tur:

| Opgave | Barnet … | Træner |
|---|---|---|
| Byg | hører et tal og bygger det med klodser | ord → mængde |
| Hvor mange? | ser en bakke og taster tallet | mængde → cifre |
| Skriv | hører et talord og taster cifrene | ombytningen i "fireogtyve" |
| Hvad sker der? | gætter 39 + 1, 40 − 1 eller 14 + 10, og ser så vekslingen | tierovergange |

Niveauerne er 0–20, 0–49, 0–99 og 0–99 med skjult tæller. Appen går et niveau op efter 4 rigtige i træk og et ned ved en fejl. Barnet ser ikke niveauet. Et forkert svar giver ét forsøg til med en konkret besked. Typiske danske fejl har deres egen besked: 42 for "fireogtyve" og 204 for 24.

🔊 læser opgaven op igen, når enheden har en dansk stemme. 🪙 skifter klodserne ud med enkroner (en tier er 10 enkroner i en rulle). Under "For voksne" kan du se niveauet, slå oplæsning fra og starte forfra.

## Hvorfor sådan

Kort fortalt (hele researchen med kilder står i [research.md](research.md)):

- **Klodser før mønter.** En tierstang består synligt af 10 enere. En 10-krone gør ikke, og den er endda mindre end 20-, 5- og 2-kronen.
- **Mængde, cifre og ord skifter i samme øjeblik.** Det er koblingen af de tre, der giver forståelsen. En tæller alene lærer ikke positionssystemet.
- **Barnet veksler selv.** Ingen automatik, så øjeblikket "10 enere = 1 tier" bliver noget, barnet gør, ikke noget, der bare sker.
- **Dansk siger enerne først** ("fireogtyve"). Derfor skriver børn ofte 42 eller 204, og appen øver præcis det.
- **Konkret feedback, ingen point, stjerner eller timer.**

## Bevidst udeladt

Utraditionelle bakker (2 tiere og 14 enere), tal over 99, butiksleg med rigtige mønter, point og konti. Det holder koden lille, og det kan komme senere.
