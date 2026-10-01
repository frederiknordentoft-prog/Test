# voice-manifest.json

Manifestet fortæller afspilningen (`src/audio/voice.ts`), hvor hvert klip ligger i stemme-spritesene. Lydpipelinen (`scripts/voice/pack.mjs`) skriver det. Runtime læser det. Formatet er versioneret. Typerne står i `src/audio/manifest.ts`, og `indexManifest()` validerer.

## Placering

- `src/assets/voice/voice-manifest.json` og spritesene `src/assets/voice/<navn>.<hash>.mp3`.
- `voice.ts` finder dem med `import.meta.glob`:
  - Manifestet hentes lazy, så det kommer i sin egen chunk.
  - Sprite-URL'erne er Vite-fingerprintede asset-URL'er.
- Findes filerne ikke, kører appen uden optagelser. Alt læses så op af enhedens stemme.
- `configureVoice({ manifest, resolveUrl })` kan pege på et andet manifest. Det bruges af timingtesten og lyttesiden.

## Format

```json
{
  "version": 1,
  "voice": "nic",
  "sampleRate": 24000,
  "leadMs": 20,
  "tailMs": 40,
  "sprites": {
    "n0-20": {
      "file": "n0-20.3f2a9c1b.mp3",
      "bytes": 81234,
      "durationMs": 41250.0,
      "pinned": true,
      "clips": {
        "n.mid.0": [0.0, 612.5],
        "n.end.0": [732.5, 598.0]
      }
    }
  }
}
```

| Felt | Betydning |
|---|---|
| `version` | Altid `1`. Andre værdier afvises. |
| `voice` | Stemmens id (`mic`/`nic`/`piper`). Vises på diagnosesiden. |
| `sampleRate` | Spritesenes rate (24000). |
| `leadMs`, `tailMs` | Stilhed før første og efter sidste sample over −45 dBFS i hvert klip. Det er efterbehandlingens trim (SPEC §10.3: 20 ms før, 40 ms efter). Standard er 20 og 40. |
| `sprites.<id>` | Én post pr. sprite. Id'et er pakkens navn fra kataloget (`clipInfo(id).pack`). En pakke over 60 s deles i `<pakke>.1`, `<pakke>.2` … |
| `file` | Filnavn i `src/assets/voice/`. |
| `bytes`, `durationMs` | Kodet størrelse og længde, til budgetter og diagnosesiden. |
| `pinned` | `true` for `n0-20`, `core` og `ui`. De hentes ved start og smides aldrig ud. |
| `clips` | Klip-id → `[startMs, durMs]` på spritens tidslinje (den ukodede sammenkædning), inkl. lead og tail. Hvert klip-id findes i præcis én sprite. |

Sprites bygges som SPEC §10.3 foreskriver:
- klip sat sammen med 120 ms stilhed imellem,
- højst 60 s pr. sprite,
- kodning `-c:a libmp3lame -b:a 40k -ar 24000 -ac 1`.

Positionerne i `clips` er fra før MP3-kodningen. Encoderens og dekoderens forsinkelse (priming) er forskellig i Safari og Chromium og må ikke regnes ind: afspilningen retter den selv.

## Hvad runtime gør med det

1. **Klip til sprite.** `speak(parts)` kører `compile()` → klip-id'er og mellemrum. Manifestet giver spriten for hvert klip.
2. **Hentning.** Mangler et klip i manifestet, læses hele udsagnet af enhedens stemme med det samme. Ellers hentes og dekodes de sprites, der mangler (`fetch` + `decodeAudioData`). Er de ikke klar 800 ms efter kaldet, læses hele udsagnet af enhedens stemme.
3. **Finjustering** (`findBounds` i `src/audio/sequence.ts`):
   - Klippets hørbare start søges fra `start − 60 ms` til `start + leadMs + 60 ms`: første sample ≥ −45 dBFS.
   - Den hørbare slutning søges tilsvarende baglæns fra `slut + 60 ms`.
   - Findes intet (stille klip), bruges `start + leadMs` og `slut − tailMs`.
4. **Plan** (`planSequence`):
   - Mellemrummene måles mellem hørbart indhold. Klip i+1 starter hørbart præcis `gapsMs[i]` efter klip i sluttede hørbart.
   - Hver kilde starter 4 ms før sin hørbare start og stopper 8 ms efter sin hørbare slutning.
   - Mellemrummene fra `compile()`: 20 ms ved hundrede-sømmen, 30 ms før et navneord bundet til tallet, 40 ms i en frase, 120 ms efter mid-form og 250 ms mellem sætninger.
5. **Afspilning.** `AudioBufferSourceNode.start(t, offset, dur)` for hvert klip, back-to-back på voiceBus.
   - `ended` resolver på den planlagte hørbare slutning, også når enheden er stum eller konteksten er låst.
   - `cancel()` fader ud på 30 ms.
6. **Hukommelse.**
   - Dekodet lyd ligger i en LRU på 64 MB.
   - Fastlåste sprites må fylde 24 MB. En pinned sprite ud over loftet behandles som almindelig.

Byggescripts (`scripts/voice/render.ts`) bør bruge de samme rene funktioner: `planSequence`, `findBounds` og `renderSequence` fra `src/audio/sequence.ts`. Så lyder de 899 sammensatte tal på lyttesiden og i ASR-tjekket præcis som i appen.

## Fra katalog til inventar

`src/speech/catalog.ts` giver pipelinen det, den skal bruge:

| Funktion | Giver |
|---|---|
| `allClips()` | `{ id, text, wave, pack, file }` for alle klip |
| `generationText(id)` | Teksten med formens tegnsætning: `.mid` får ",", `.end` får ".", og sætninger står som skrevet |
| `clipForm(id)` | `'mid'`, `'end'` eller `null` |

Bølge og pakke kommer fra katalogfilen (`export const wave`/`pack`), ellers fra standardreglerne i `catalog.ts`.

## Timingtest

```
cd talvennerne2 && flock /tmp/tv2-chromium.lock node src/audio/timing/run-timing.mjs
```

Scriptet gør følgende:
1. Syntetiserer en tone-sprite: ét klip pr. id med kendt frekvens, 20 ms lead, 40 ms tail og 120 ms mellem klip.
2. Koder den som WAV og som MP3 (40 kbps, som stemmen).
3. Starter Vite på port 4313 (`PORT=` overstyrer) og åbner `src/audio/timing/timing.html` i Chromium (`scripts/browser.mjs`).
4. Siden spiller "Hvad er otteogtredive plus tre hundrede og syvogfyrre? Find tallet tolv kroner og halvtreds øre." gennem den rigtige stemmemotor og optager voiceBus sample-præcist med en AudioWorklet.
5. Hver hørbar start, slutning og hvert mellemrum skal ligge inden for ±5 ms af planen, og tonerne skal komme i rigtig rækkefølge.

Det gælder i tre scenarier: WAV, MP3 og MP3 med en CPU sat 4 gange ned. Exit-kode 1 ved fejl.
