# Etisk tjekliste (SPEC §13), gennemgået ved G-slice

Status 2/10 for den første skive (Engdalen). Hvert punkt er enten håndhævet af en test eller en scan, eller tjekket manuelt i produkt-reviewet `docs/reviews/app-gslice-r1.md` (QA1, "Rækværk").

| # | Rækværk | Håndhævet af | Status |
|---|---|---|---|
| 1 | Ingen streak. Kun "Dage spillet i alt", der aldrig nulstilles. Trofæer ved 3, 7, 14, 30 og 100 dage. | `content/achievements.ts` (`daysTrophy`), Stempelbogen. Målet "5 rigtige i træk" gælder kun inden for én tur. | ✓ |
| 2 | Ingen notifikationer. | `data/namespace.scan.test.ts` forbyder `Notification` og `PushManager`. | ✓ |
| 3 | Ingen tidsbegrænsede tilbud, faste priser. | `scan.test.ts`: `Date` findes ikke i economy, goals eller wardrobe. Priserne er heltal i `content/catalog.ts`. | ✓ |
| 4 | Ingen sjældenheds-tiers. | `ids.lock.test.ts`: ingen genstand har `tier`. Ægget trækker kun blandt dyr, barnet ikke ejer, og alle tæller lige meget. | ✓ |
| 5 | Valuta kun optjent. Ingen penge, reklamer eller eksterne links. Kun netværk til samme origin. | Ingen betalings- eller reklamekode. `fetch` bruges kun til egne sprites og lyttesidens data. QA1 så kun netværk til samme origin. | ✓ |
| 6 | Ingen skyld. Humøret `sad` findes ikke. | `ids.lock.test.ts` (`MOODS`) og `scan.test.ts`, der scanner for skyldtekster. | ✓ |
| 7 | Ingen auto-start eller nedtælling. "Næste" og "Til kortet" er lige store og har ikke fokus. | Ceremoniernes slutkort (MAP) og onboardingens blide hjælp efter 60 s uden nedtælling. Tjekket i QA1. | ✓ |
| 8 | Ingen valutatal under turen og ingen "kun N til …". | RoundScreen viser stenstien og buddyen, aldrig perler. `scan.test.ts` scanner for "kun N til/mere". | ✓ |
| 9 | "Næste tre mål" udløber aldrig og giver kun stempler. | `content/goals.ts` og `meta/goals.test.ts`. | ✓ |
| 10 | Ingen ranglister og ingen sammenligning mellem søskende. | Dashboardet viser én profil ad gangen. Der findes ingen fælles visning. | ✓ |
| 11 | Intet optjent kan tabes. | `useProfile.update` afviser tab (`lostEarnings`), `meta/noLoss.test.ts` tjekker det, og butikstestene viser, at et afvist køb ikke ændrer noget. Utegnede ting, barnet ejer, bliver ejet. | ✓ |
| 12 | ✕ er altid tilgængelig og gemmer turen. | `state/round.test.ts` (A3) og gennemspilningen (pause, genoptag, genindlæs). | ✓ |
| 13 | Gennemsigtighed for forældre. | Dashboardets overblik (læringstid og legetid), belønningslog og forældreintroen ("Alle belønninger optjenes ved at regne"). | ✓ |
| 14 | Lange sessioner bliver mere konsoliderende, ikke mere belønnende. | Lofter over nyt stof og træthedsværn (`engine/plan.ts`, `roundBuilder.ts`). Genspil af en ★★★-node giver kun grundsatsen (`economy.sim` krav 7). | ✓ |
| 15 | OpenRAIL-licensen er læst, og ingen mekanik rammer brugsbegrænsningerne. | `docs/voice.md` (afsnittet om licens). Krediteringen står i dashboardets "Om oplæsningen". | ✓ |
| 16 | Data bliver på enheden. Ingen analytics. | IndexedDB `talvennerne2` og `talvennerne2.`-nøgler (navnerums-scan). Ingen analytics-kode. | ✓ |

**Låste valg med kendt risiko:**
- "Så længe barnet vil": ingen tidsgrænse. Afbødes af punkt 14.
- "Langsomt-men-rigtigt giver ingen boks-fremgang". Afbødes af dashboardets "rigtigt men langsomt" og anbefaling R2.
