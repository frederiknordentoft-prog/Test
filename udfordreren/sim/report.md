# Balanceringsrapport

200 seeds pr. bot (6 bots) + 60 passive seeds til markedskalibrering. Kørt på 394 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.425, Forsigtig 47, Balanceret 4.950, AI-afviser 4.950, AI-hensynsløs 4.950, Tilfældig 2; højeste eftermæle i 0 seeds; bøde i 98 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 28,8, Forsigtig 66,8, Balanceret 85,6, AI-afviser 80,5, AI-hensynsløs 60,7, Tilfældig 45,3; værdi Grådig 0, Forsigtig 24, Balanceret 90.553, AI-afviser 16.861, AI-hensynsløs 196.679, Tilfældig 0; dk-licens 99 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 88 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 26.037 vs. 12.851; eftermæle 60,7 vs. 85,6; påbud 98 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 85 %; værdi 24 vs. 90.553 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 83,7, kasino 86,9 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 90 %, se 2025 84 % (kasino 80 % < betting 93 %), nl 51 %, on 89 %, dk kasino-BSI 4,48 mia., DL nr. 1 93 %, Balanceret dk-andel 2020 10 % |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 184 sek., Top 10 2.012,33, Guldkupon 2.015,60, tidligste nr. 1 2.016,87, tidligste HoF 2.022,88, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 426 pauser, 42 % i AI-akten, spilletid 195 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 28,8 | 25 % | 98 % | 100 % | 0 % | 181 |
| Forsigtig | 24 | 24 | 66,8 | 85 % | 0 % | 28 % | 52 % | 302 |
| Balanceret | 90.553 | 40.042 | 85,6 | 99 % | 1 % | 2 % | 99 % | 425 |
| AI-afviser | 16.861 | 7.456 | 80,5 | 99 % | 1 % | 9 % | 42 % | 389 |
| AI-hensynsløs | 196.679 | 86.971 | 60,7 | 99 % | 98 % | 98 % | 30 % | 446 |
| Tilfældig | 0 | 0 | 45,3 | 0 % | 6 % | 26 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 4 | 121 | 531 | 715 | 2.111 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 2 | 5 | 6 | 5 | 6 | 9 | 16 | 11 | 0 | 0 | 0 | 0 |
| Balanceret | 3 | 34 | 195 | 891 | 1.683 | 2.376 | 2.363 | 2.892 | 3.459 | 5.305 | 6.543 | 7.067 |
| AI-afviser | 3 | 34 | 195 | 891 | 1.683 | 2.388 | 2.520 | 2.564 | 2.837 | 3.504 | 3.124 | 1.706 |
| AI-hensynsløs | 3 | 34 | 195 | 891 | 1.683 | 2.376 | 2.363 | 2.960 | 6.708 | 12.376 | 15.854 | 15.539 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 18 | 745 | 2.302 | 3.859 | 12.217 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 6 | 23 | 28 | 24 | 28 | 49 | 80 | 5 | 2 | 1 | 1 | 1 |
| Balanceret | 12 | 255 | 933 | 6.158 | 12.007 | 17.339 | 20.504 | 26.745 | 33.224 | 49.207 | 70.450 | 84.828 |
| AI-afviser | 12 | 255 | 933 | 6.158 | 12.007 | 16.610 | 21.406 | 23.559 | 28.618 | 35.471 | 32.066 | 0 |
| AI-hensynsløs | 12 | 255 | 933 | 6.158 | 12.007 | 17.339 | 20.504 | 29.053 | 57.235 | 121.381 | 172.851 | 184.940 |
| Tilfældig | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 19 % | 0 % | 0 % | 0 % | 0 % | 6 % | 44 % | 31 % |
| Forsigtig | 0 % | 0 % | 0 % | 4 % | 0 % | 82 % | 0 % | 15 % |
| Balanceret | 0 % | 63 % | 0 % | 32 % | 4 % | 0 % | 0 % | 2 % |
| AI-afviser | 7 % | 9 % | 34 % | 0 % | 0 % | 50 % | 0 % | 2 % |
| AI-hensynsløs | 0 % | 23 % | 0 % | 1 % | 75 % | 0 % | 1 % | 1 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 3 % | 98 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5592 | 4158 | 41617 | 20060 | 6201 | 801 | 6804 | 4711 | 38698 | 1114 | 7603 | 5694 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 51 % (forventet 50 %)
- Kanaliseringens tilbagetog: 25 % (forventet 25 %)
- Prediction market-omvæltningen: 20 % (forventet 20 %)
- Den hårde hånd: 16 % (forventet 15 %)
