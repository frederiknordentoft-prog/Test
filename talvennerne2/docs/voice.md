# Oplæsning: stemme, målinger og teknik (spike S1)

Spike S1 fra SPEC §14 (F0). Alle tal er målt på denne container (4 vCPU Intel Xeon @ 2,1 GHz med AVX-512/AMX, 15 GB RAM) med `nice -n 19` og 2 tråde, mens andre agenter arbejdede. Rådata: `voice/probe/s1-results.json` (genereres af `scripts/tts/report.py`). Rå takes ligger uden for git i `voice/probe/takes/`.

## 1. Beslutninger

| Emne | Beslutning | Begrundelse (afsnit) |
|---|---|---|
| Generator | CoRal **Røst-v3 Chatterbox 500M** på CPU. A2-reserven (Piper) udløses ikke. | Installerer og kører; RTF 7,1–7,7 < 12; Mic har probe-CER 3,6 % (bedste af 2 takes) < 5 % (§7, §8, §13) |
| Stemme | **Mic** | Lavest samlet CER med roest-wav2vec2: Mic 5,3 % mod Nic 7,5 % (−2,3 pp, uden for lighedsbåndet ±0,5 pp). Whisper som second opinion peger svagt den anden vej (§7). |
| Bæresætning | **Ja** for talord og andre klip under 3 stavelser. | Beslutningsreglen udløses af ASR-ustabilitet: 35 % af enkeltord-takes består ikke (> 20 %). Varighedsvinduet alene udløser den ikke (5 % uden for) (§9). |
| Generering | ⟨BATCH-BESLUTNING⟩ | §11, §12 |
| CPU-tid | ⟨PROJEKTION⟩ | §12 |

## 2. Model, filer og revisioner

| Repo (HuggingFace) | Revision (commit) | Brug |
|---|---|---|
| `CoRal-project/roest-v3-chatterbox-500m` | `7ce205cea6b3b36d9f60f18abb88ff21fa04ea0d` (2/9-2026, "Update LICENSE") | TTS |
| `CoRal-project/roest-v3-wav2vec2-315m` | `beb3e790246d6b9dec1df596b0b21d5c42f4d99c` | ASR-tjek og forced alignment |
| `CoRal-project/roest-v3-whisper-1.5b` | `7182cced29631ef7d7776eb8c01f24624b9b9b04` | Second opinion (valgfri, `setup.sh --whisper`) |
| `rhasspy/piper-voices` | `c10ece1aade47bb51c153c893d14e5bf8e5b7117` | A2-reserve, kun med `setup.sh --piper` (ikke hentet) |

**Chatterbox-filer.** `ChatterboxMultilingualTTS.from_local` i chatterbox-tts 0.1.7 (`chatterbox/mtl_tts.py`) indlæser præcis disse filer, og kun de hentes (`download_models.py`, ca. 3,21 GB):

| Fil | Bytes | Note |
|---|---|---|
| `t3_mtl23ls_v2.safetensors` | 2 143 989 752 | Den danske finetune. LFS-hash `8ba307c4…` adskiller sig fra ResembleAI's `b1237586…`. |
| `s3gen.pt` | 1 057 165 844 | Identisk med ResembleAI/chatterbox |
| `ve.pt` | 5 698 626 | Identisk med upstream |
| `grapheme_mtl_merged_expanded_v1.json` | 70 011 | Tokenizer. CoRal-udgaven er 22 bytes større end upstream. |
| `conds.pt` | 107 374 | Upstreams indbyggede (engelske) stemme. Indlæses, men bruges ikke. |
| `audio_samples/00_{mic,nic}_{00,01}_t0.8_p0.95_e0.5_c0.5_m0.05_r2.0.wav` | 3 329 600 i alt | Stemmeprompts |
| `LICENSE`, `README.md` | 23 364 | Licens og modelkort |

Disse filer hentes ikke, fordi de ikke indlæses for dansk:

- `t3_23lang.safetensors` (2,1 GB, ældre checkpoint),
- `ve.safetensors`, `tokenizer.json`, `mtl_tokenizer.json`,
- `Cangjie5_TC.json` (kun kinesisk).

CoRals eget værktøj (`alexandrainst/coral_chatterbox`) bruger samme filsæt.

**ASR-filer.**

- wav2vec2: `model.safetensors` (631 MB) og config-, vocab- og tokenizer-json. Sprogmodellen `language_model/` (KenLM, 780 MB) hentes ikke med vilje: grådig CTC-afkodning uden sprogmodel retter ikke udtalefejl væk.
- whisper: 2 safetensors-filer (3,09 GB) og tokenizer-filer.

**Python-pakker** (fuldt låst i `scripts/tts/requirements-{tts,asr}.txt`):

- `/opt/tv2-tts` (1,9 GB): torch 2.6.0+cpu, torchaudio 2.6.0+cpu, chatterbox-tts 0.1.7, transformers 5.2.0, huggingface_hub 1.33.0, numpy 1.26.4, soundfile 0.14.0, pyloudnorm 0.2.0, scipy 1.17.1. Gradio 6.8.0 kommer med som afhængighed af chatterbox, men bruges ikke.
- `/opt/tv2-asr` (1,3 GB): torch og torchaudio 2.6.0+cpu (`forced_align`), transformers 5.2.0, jiwer 4.0.0, pyloudnorm og scipy (til `post.py`).

## 3. Opsætning

```
bash talvennerne2/scripts/tts/setup.sh            # venvs + modeller (idempotent)
bash talvennerne2/scripts/tts/setup.sh --smoke    # + én prøvegenerering med ASR-tjek
bash talvennerne2/scripts/tts/setup.sh --whisper  # + second opinion (3,1 GB)
bash talvennerne2/scripts/tts/setup.sh --piper    # + A2-reserven
```

Scriptet:

1. opretter venvs, der mangler, og installerer torch fra PyTorch' CPU-indeks før resten, så PyPI's CUDA-hjul aldrig vælges;
2. kører `pip check`;
3. henter modellerne på de låste revisioner;
4. forhåndshenter spacy-pkuseg-modellen. Chatterbox' tokenizer henter den fra en GitHub-release ved hver første indlæsning, også for dansk.

Genereringen kører med `HF_HUB_OFFLINE=1`, så ingen kald rammer nettet. Advarslen "Could not load Cangjie mapping" er harmløs, fordi den kun gælder kinesisk.

Efter en container-genstart tog første modelindlæsning 309 s, fordi disken var kold (ca. 10 MB/s). Varm tager den ca. 20 s.

## 4. Generering

- **Indstillinger:** `language_id="da"`, `temperature=0.6`, `top_p=0.95`, `min_p=0.05`, `repetition_penalty=2.0`, `cfg_weight=0.3`, `exaggeration=0.5` (standard).
  - De svarer præcis til modelkortets "rolige" eksempler `audio_samples/01_*` (t0.6 p0.95 e0.5 c0.3 m0.05 r2.0), så intet er justeret.
  - Modelkortet siger, at finetunen ikke understøtter exaggeration.
  - MOS-evalueringens `top_k=600` findes ikke som parameter i 0.1.7.
- **Stemmeprompt:** `audio_samples/00_<stemme>_01_…wav` (Københavnssætningen; Mic 8,3 s, Nic 7,5 s).
  - Conditionals beregnes én gang (15 s) og caches i `~/.cache/tv2-tts/conds-<stemme>-7ce205ce.pt`.
  - Mic: median-F0 ≈ 116 Hz. Nic: ≈ 152 Hz. CoRal-TTS har én mandlig og én kvindelig indlæser.
- **Seed:** `int(sha1(id)[:8], 16) + take`. torch, numpy og random seedes før hvert kald.
  - Samme seed giver bit-identisk lyd ved 2 og 4 tråde (verificeret på 10 klip).
- **Vandmærke:** Chatterbox' Perth-vandmærke (ikke hørbart) bevares. Det koster 0,01–0,02 s pr. kald.
- **Lap i chatterbox 0.1.7:** meget korte tekster (≤ 3 teksttokens, fx "En.") crasher med `IndexError` i `AlignmentStreamAnalyzer.step`.
  - `probe.py` (`patch_short_text_bug`) tilføjer kun vagten `S > 5` i den ene linje.
  - Længere tekster opfører sig uændret, og lappen fejler højlydt, hvis kilden ændres.
  - `generate.py` skal bruge samme lap.

## 5. Efterbehandling (`scripts/tts/post.py`)

Kæden følger SPEC §10.3:

1. Highpass 70 Hz (Butterworth, 2. orden, nulfase).
2. Trim ved −45 dBFS (5 ms-RMS), så der er 20 ms før og 40 ms efter.
3. Fade 5/10 ms (raised cosine).
4. Loudness efter BS.1770-4 med pyloudnorm. Klip under 0,4 s polstres med stilhed, kun til målingen.
5. Gain til −18 LUFS.
6. True-peak-limiter ved −1,5 dBTP (4× oversampling, 1,5 ms look-ahead, 60 ms release).

To præciseringer:

- **Trim-tærsklen** gælder det loudness-normaliserede niveau, så resultatet ikke afhænger af modellens råniveau, der varierer fra −19 til −26 LUFS.
- **Talesyntesen har 17–21 dB fra loudness til peak**, mens −18 LUFS og −1,5 dBTP kun giver plads til 16,5 dB. Første version endte derfor på −19,2 til −19,4 LUFS efter limiteren (uden for ±1 LU). Gain efterjusteres nu, til loudness efter limiteren er −18 ± 0,2 LU.

Resultat:

- Alle takes ligger på −18,0 til −18,3 LUFS med true peak −1,63 dBTP. Ingen clipping.
- Limiteren tager op til 6 dB på enkelte peaks (plosiver). Det er typisk 1–3 dB.

## 6. Udtaletjek (`scripts/tts/asr_check.py`)

- **ASR:** roest-v3-wav2vec2 transskriberer med grådig CTC. Lyden resamples til 16 kHz og får 0,1 s stilhed på hver side.
- **Normalisering af begge sider** (`da_text.normalize`):
  - små bogstaver;
  - cifre bliver talord efter SPEC §10.1, fordi ASR'en skriver tal som cifre ("7plus 5");
  - regnetegn fra whisper bliver ord ("6 x 7" → "seks gange syv");
  - ingen tegnsætning;
  - "en/et" og "(et) hundrede" foldes ens, fordi cifre ikke kan skelne dem.
- **CER** beregnes uden mellemrum (kunst-lyd-teknik §5.9).
- **Bestået** = CER ≤ 0,05 og samme talfølge (`da_text.parse_numbers`) på begge sider.
- **Second opinion:** `--engine whisper` bruger roest-v3-whisper-1.5b i bf16. Det tager ca. 9 s pr. klip ved 2 tråde.
- **Kendt begrænsning:** transformers 5.2 indlæser wav2vec2 i bf16 (checkpointets dtype). Den tvinges til fp32.

## 7. Stemmevalg

12 probesætninger × 2 takes × 2 stemmer (48 takes). CER er samlet over alle takes (redigeringer ÷ tegn).

| Stemme | CER wav2vec2 (24 takes) | take 0 | take 1 | bedste take pr. sætning | bestået | CER whisper | ingen ASR godkender |
|---|---|---|---|---|---|---|---|
| **Mic** | **5,3 %** | 4,8 % | 5,7 % | 3,6 % | 50 % | 4,1 % | 29 % |
| Nic | 7,5 % | 6,3 % | 8,7 % | 5,1 % | 58 % | 3,2 % | 17 % |

**Vinder: Mic.** Mic − Nic = −2,26 pp med reglens ASR (roest-wav2vec2). Det er uden for lighedsbåndet (±0,5 pp), så reglen om Nic ved lighed gælder ikke.

Forbehold, som brugeren bør kende:

- Whisper-1.5b vurderer svagt omvendt: Nic 3,2 % mod Mic 4,1 %.
  - Nic har også færre takes, som ingen af de to ASR'er godkender (4 mod 7 af 24).
  - wav2vec2's ekstra fejl på Nic sidder især i "Hvilket tal mangler: fem plus hvad giver tolv?" og "Del tolv æbler … venner". Whisper hører begge rigtigt.
- Mic's typiske fejl er ægte: "Hvad er" reduceres til noget, der lyder som "hver"/"va'" (p01, p05, p09, fanget af begge ASR'er).
- Valget følger SPEC-reglen. Stemmeprøven er til brugeren; et skift til Nic koster en regenerering (SPEC §14).
- Pipelinens ASR-gate er wav2vec2, så en stemme, den genkender bedre, giver færre falske afvisninger.

Fejlbilledet er domineret af ASR-artefakter på sjældne ord ("tiervennerne" → "tigvinderne") og sammentrækninger. Ingen take har forkert talfølge efter normalisering.

## 8. RTF og tidsforbrug pr. kald

20 probeklip pr. stemme ved 2 tråde: de 12 probesætninger (take 0) og 8 ekstra klip på 0,7–3,4 s.

| Stemme | beregning | lyd (rå) | RTF samlet | median RTF pr. klip | overhead pr. kald | marginal RTF | T3 |
|---|---|---|---|---|---|---|---|
| Mic | 338 s | 44,2 s | **7,65** | 8,1 | 7,1 s | 4,42 | 9,0 tokens/s |
| Nic | 319 s | 45,3 s | **7,05** | 7,1 | 6,2 s | 4,29 | 9,0 tokens/s |

- **Lineær model:** tid ≈ overhead + marginal-RTF × rå varighed. Rå lyd er i snit 1,23 × færdig lyd (stilhed, der trimmes).
- **T3** (0,5B Llama, CFG med batch 2) koster ca. 2,8 s pr. lydsekund og næsten intet fast.
- **S3Gen** (flow matching, 10 trin med CFG, plus HiFiGAN) koster 6,0–7,0 s fast og 1,6 s pr. lydsekund.
  - Det faste beløb skyldes, at referenceprompten (op til 10 s) gennemregnes ved hvert kald.
  - Mic's længere prompt (8,3 s mod 7,5 s) giver tilsvarende større fast omkostning.
- **Vandmærket** koster 0,02 s.
- **Korte klip:** ét ord koster ca. 11–13 s, altså RTF 13–19.
- **4 tråde:** 10 klip (5 × Mic/Nic) giver RTF 5,07 mod 7,13 ved 2 tråde (faktor 1,41, median 1,58) med identisk lyd.

## 9. Svære enkeltord og beslutning om bæresætning

20 ord × 3 takes med Mic, ét kald pr. ord i end-form ("tolv."). Forventet varighed er stavelser ÷ 3,2/s. Varigheden er det færdige klip inkl. 20/40 ms marginer.

- **Uden for vinduet [0,5; 2,0] × forventet:** 3 af 60 = **5,0 %**. Med kun talevarighed er det 10 %. "elleve" ligger ved 0,46–0,50 og "hundrede" ved 0,47–0,54, fordi de udtales "elve" og "hunnede".
- **ASR ikke bestået:** 21 af 60 = **35 %** (samlet CER 16 %).
  - Mange fejl er ASR-artefakter på isolerede ord: "1" for "et", "t000n" for "tusind", "jor/jyre/yre" for "øre", "550" for "halvtreds".
  - Enkelte er ægte. "tolv" blev hørt som "tøj" i én take, og "en" blev trimmet til 0,22 s ("i").

**Beslutning:** reglen udløses af ASR-ustabilitet (35 % > 20 %), ikke af varigheden (5 % < 20 %). Talord genereres derfor i bæresætningen "Tallet er X." (og "Tallet er X," for mid-form) og klippes ud med `torchaudio.functional.forced_align` (`scripts/tts/align.py carrier`). Korte klip verificeres kun i sammensætning. Prototypen og dens resultat står i §10–§11.

⟨CARRIER-RESULTAT⟩

## 10. Sammensat vs. hel sætning

⟨COMPOSE-TABEL⟩

## 11. Batch-generering: flere klip pr. kald

⟨BATCH⟩

## 12. Fremskrivning af CPU-tid

⟨PROJEKTION-TABEL⟩

## 13. A2-reserven (Piper)

Ingen af de tre betingelser er opfyldt:

- Chatterbox installerer og indlæses på CPU.
- RTF ved 2 tråde er 7,1–7,7, altså under 12. Den effektive RTF for inventaret ved enkeltkald er ca. 9,5.
- Mic's probe-CER efter takevalg er 3,6 %, altså under 5 %.

Piper er derfor ikke installeret. `setup.sh --piper` installerer piper-tts 1.8.0 og `da_DK-talesyntese-medium` på en låst revision, hvis beslutningen ændres. Stemmen er 22,05 kHz, så `post.resample` løfter den til 24 kHz.

## 14. Lytteprøver

⟨LYTTEPRØVER⟩

## 15. Licens

Den ordrette licens ligger i `voice/LICENSE-CoRal.txt` (sha256 `989fe7af…642d729`, fra modellens `LICENSE` på den låste revision). Licensgiver er Alexandra Instituttet A/S.

Licensen er "AI Pubs Open RAIL"-teksten med tre tilføjelser:

- dansk ret;
- mediation og voldgift i Aarhus;
- ugyldighed ved lovstridig brug.

Overskriften kalder grundlaget "OPEN RAIL-S", mens den vedlagte tekst er "OPEN RAIL-M". Vilkårene er de samme for vores brug.

Brugsbegrænsningerne (Attachment A) dækker diskrimination, militær, automatiske juridiske afgørelser, desinformation, privatliv og sundhed. **Et matematikspil for børn, der afspiller forudgenererede opgavetekster, rammer ingen af dem.** Tre punkter kræver alligevel opmærksomhed:

1. **4(b), at syntetisere en fysisk persons stemme uden samtykke.**
   - Mic og Nic er to professionelle indlæsere, som Nota indspillede til CoRal-TTS-datasættet (CC0) med talesyntese som formål.
   - Licensgiveren udbyder dem som modellens to foruddefinerede stemmer.
   - Vi bruger kun dem og kloner aldrig andres stemmer (fx forældres eller børns). Det skal forblive sådan.
2. **4(c), at interagere autonomt med en person uden at oplyse, at det ikke er et menneske.**
   - Spillet fører ingen samtale, men afspiller faste klip.
   - "Om oplæsningen" bør alligevel sige, at stemmen er computergenereret.
3. **Distribution.** Vi distribuerer kun output (lyd), ikke modellen.
   - Licensgiveren gør ikke krav på output (§5).
   - Kreditering kræves ikke, men anbefales i "Om oplæsningen": "Stemme: Røst-v3 Chatterbox fra CoRal-projektet (Alexandra Instituttet), OpenRAIL-licens".
   - Hvis modellen eller en afledt model nogensinde distribueres, skal licensen og brugsbegrænsningerne følge med.

ASR-modellerne (wav2vec2 og whisper) har ifølge deres modelkort en tilsvarende OpenRAIL-afledt licens. Den forbyder bl.a. at efterligne bestemte personer og biometrisk identifikation. Vi bruger dem kun til kvalitetskontrol og alignment af vores egen syntetiske tale, ikke til at skabe tale eller identificere personer.

## 16. Kendte problemer og afvigelser fra SPEC

⟨KENDTE⟩

## 17. Filer

| Fil | Indhold |
|---|---|
| `scripts/tts/setup.sh` | Idempotent opsætning (venvs, modeller, pkuseg, valgfri whisper/Piper) |
| `scripts/tts/requirements-tts.txt`, `requirements-asr.txt` | Fuldt låste pakker |
| `scripts/tts/download_models.py` | Låste revisioner og præcise filmønstre |
| `scripts/tts/probe.py` | Generering (`gen`, `gen-batch`), sammensætning (`compose`), efterbehandling igen (`repost`), lytteprøver (`listen`) |
| `scripts/tts/probe_sets.py` | Probe-, ord-, regnestykke-, bæresætnings- og batch-sæt |
| `scripts/tts/post.py` | Efterbehandling, måling og sammenkædning (genbrugelig) |
| `scripts/tts/asr_check.py` | Udtaletjek (wav2vec2, valgfri whisper, `--rescore`) |
| `scripts/tts/align.py` | Forced alignment: bæresætning (`carrier`) og batch-udklip (`batch`) |
| `scripts/tts/da_text.py` | Talord, normalisering, talparser, stavelser og CER |
| `scripts/tts/report.py` | Samler målingerne i `voice/probe/s1-results.json` |
| `voice/LICENSE-CoRal.txt` | Modellens licens, ordret |
| `voice/probe/stemmeproeve-mic.wav`, `voice/probe/sammensat-vs-hel.wav` | Lytteprøver |
