# Oplæsning: stemme, målinger og teknik (spike S1)

Spike S1 fra SPEC §14 (F0). Alle tal er målt på denne container (4 vCPU Intel Xeon @ 2,1 GHz med AVX-512/AMX, 15 GB RAM) med `nice -n 19` og 2 tråde, mens andre agenter arbejdede. Rådata: `voice/probe/s1-results.json` (genereres af `scripts/tts/report.py`). Rå takes ligger uden for git i `voice/probe/takes/`.

## 1. Beslutninger

| Emne | Beslutning | Begrundelse (afsnit) |
|---|---|---|
| Generator | CoRal **Røst-v3 Chatterbox 500M** på CPU. A2-reserven (Piper) udløses ikke. | Installerer og kører. RTF er 7,1–7,7 (< 12). Probe-CER efter takevalg er 3,0 % for Nic (bedste af 4 takes) og 3,6 % for Mic (bedste af 2), begge < 5 % (§7, §8, §13). |
| Stemme | **Nic**. Det afviger fra reglens bogstav (se §7). | På de 12 probesætninger giver reglen Mic (CER 5,3 % mod 7,5 % med roest-wav2vec2). På alle 22 målte sætninger (44 takes pr. stemme) har Nic dog lavest CER: 4,6 % mod 6,3 %, og 32 mod 19 beståede takes. Whisper peger også på Nic (3,2 % mod 4,1 %). Mic's "Hvad er" høres som "hver er" i 17 af 20 regnestykke-takes (Nic: 2 af 20). "Hvad er" indleder spillets 271 hele spørgesætninger. |
| Bæresætning | **Ja**, for talord og hundrede-hoveder. | Reglen udløses af ASR-ustabilitet: 35 % af enkeltord-takes består ikke (> 20 %). Varigheden udløser den ikke (5 % uden for vinduet). Hundrede-hoveder ("tre hundrede og") hallucinerer, når de genereres alene (4 af 4), men er fejlfri i bæresætning (§9). |
| Generering | **Strategi D**: hele sætninger 4 pr. kald; talord og hundrede-hoveder i bæresætning ca. 10 pr. kald; øvrige korte klip ét kald hver. Alle udklip laves med forced alignment. | Samme udtalekvalitet som ét kald pr. klip, men 14 % mindre CPU-tid. Batch af enkeltord og K=6 sætninger koster kvalitet (§11). |
| CPU-tid | **7,6 t ved 2 tråde, 5,4 t ved 4 tråde** (D). Ét kald pr. klip: 8,8 / 6,3 t. | Målet under 6 t nås ved 4 tråde (SPEC: 4 tråde, når containeren er ledig). Ved 2 tråde nås det ikke uden kvalitetsrisiko. Med S3Gen-referencen forkortet til 4 s (E) bliver det 6,6 / 4,7 t; E kræver en lyttetest først (§12). |

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
6. True-peak-limiter ved −1,5 dBTP (4 gange oversampling, 1,5 ms look-ahead, 60 ms release).

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

12 probesætninger · 2 takes · 2 stemmer (48 takes). CER er samlet over alle takes (redigeringer : tegn).

| Stemme | CER wav2vec2 (24 takes) | take 0 | take 1 | bedste take pr. sætning | bestået | CER whisper | ingen ASR godkender |
|---|---|---|---|---|---|---|---|
| Mic | **5,3 %** | 4,8 % | 5,7 % | 3,6 % | 50 % | 4,1 % | 29 % |
| Nic | 7,5 % | 6,3 % | 8,7 % | 5,1 % | 58 % | 3,2 % | 17 % |

**Reglen alene giver Mic.** Mic − Nic = −2,26 pp med roest-wav2vec2, uden for lighedsbåndet på ±0,5 pp.

**Valgt: Nic.** Mic-resultatet holdt ikke, da der kom mere data til. De 10 regnestykker fra §10 blev genereret med begge stemmer (2 takes):

| Stemme | 10 regnestykker: CER | bestået | "Hvad er" hørt rigtigt | alle 22 sætninger: CER | bestået |
|---|---|---|---|---|---|
| Mic | 7,5 % | 7/20 | 3/20 | 6,3 % | 19/44 |
| **Nic** | **1,3 %** | **18/20** | **18/20** | **4,6 %** | **32/44** |

Begrundelse:

1. **Mic har en systematisk udtalefejl i spillets vigtigste skabelon.** Mic reducerer "Hvad er" til noget, der høres som "hver er"/"ver". Det sker i 17 af 20 regnestykke-takes med wav2vec2 og 9 af 20 med whisper. Skabelonen indleder spillets 271 hele spørgesætninger (SPEC §10.2).
2. **Mic's forspring på de 12 sætninger skyldes ASR-artefakter.** wav2vec2's ekstra fejl på Nic sidder i to sætninger ("… hvad giver tolv?" og "… venner", som høres som "vinder"). Whisper hører begge rigtigt.
3. **Whisper vurderer Nic bedst.** Nic får 3,2 % mod 4,1 % for Mic, og færre Nic-takes afvises af begge ASR'er (4 mod 7 af 24).
4. **Driften bliver billigere med Nic.** Med Mic ville ca. 65 % af "Hvad er …?"-takes fejle ASR-gaten og skulle genereres igen. Nic's kortere stemmeprompt giver også ca. 1 s mindre overhead pr. kald (§8).

SPEC §14 forudser, at stemmen kan skiftes. Hvis man vil følge reglens bogstav, er Mic-takes og Mic-målinger bevaret, og prisen er alene en ny lytteprøve.

Med op til 4 takes har Nic probe-CER 3,0 % (bedste take pr. sætning, wav2vec2), så A2 og G0 (≤ 5 %) er opfyldt.

Fejlbilledet er ellers domineret af ASR-artefakter på sjældne ord ("tiervennerne" → "tigvinderne") og sammentrækninger.

- wav2vec2 finder forkert talfølge i 7 af 88 sætningstakes (takes 0–1): Mic 2 og Nic 5.
- Whisper hører talfølgen rigtigt i alle seks af disse, som findes i probe-sættet. Eksempler: "hvad giver 12" (wav2vec2: "1o") og "6 x 7" (wav2vec2: "6s gange y").

## 8. RTF og tidsforbrug pr. kald

20 probeklip pr. stemme ved 2 tråde: de 12 probesætninger (take 0) og 8 ekstra klip på 0,7–3,4 s.

| Stemme | beregning | lyd (rå) | RTF samlet | median RTF pr. klip | overhead pr. kald | marginal RTF | T3 |
|---|---|---|---|---|---|---|---|
| Mic | 338 s | 44,2 s | **7,65** | 8,1 | 7,1 s | 4,42 | 9,0 tokens/s |
| Nic | 319 s | 45,3 s | **7,05** | 7,1 | 6,2 s | 4,29 | 9,0 tokens/s |

- **Lineær model:** tid ≈ overhead + marginal-RTF · rå varighed. Rå lyd er i snit 1,23 · færdig lyd (stilhed, der trimmes).
- **T3** (0,5B Llama, CFG med batch 2) koster ca. 2,8 s pr. lydsekund og næsten intet fast.
- **S3Gen** (flow matching, 10 trin med CFG, plus HiFiGAN) koster 6,0–7,0 s fast og 1,6 s pr. lydsekund.
  - Det faste beløb skyldes, at referenceprompten (op til 10 s) gennemregnes ved hvert kald.
  - Mic's længere prompt (8,3 s mod 7,5 s) giver tilsvarende større fast omkostning.
- **Vandmærket** koster 0,02 s.
- **Korte klip:** ét ord koster ca. 11–13 s, altså RTF 13–19.
- **4 tråde:** 10 klip (5 · Mic/Nic) giver RTF 5,07 mod 7,13 ved 2 tråde (faktor 1,41, median 1,58) med identisk lyd.

## 9. Svære enkeltord og beslutning om bæresætning

20 ord · 3 takes med Mic, ét kald pr. ord i end-form ("tolv."). Forventet varighed er stavelser : 3,2/s. Varigheden er det færdige klip inkl. 20/40 ms marginer.

- **Uden for vinduet [0,5; 2,0] · forventet:** 3 af 60 = **5,0 %**. Med kun talevarighed er det 10 %. "elleve" ligger ved 0,46–0,50 og "hundrede" ved 0,47–0,54, fordi de udtales "elve" og "hunnede".
- **ASR ikke bestået:** 21 af 60 = **35 %** (samlet CER 16 %).
  - Mange fejl er ASR-artefakter på isolerede ord: "1" for "et", "t000n" for "tusind", "jor/jyre/yre" for "øre", "550" for "halvtreds".
  - Enkelte er ægte. "tolv" blev hørt som "tøj" i én take, og "en" blev trimmet til 0,22 s ("i").

**Beslutning:** reglen udløses af ASR-ustabilitet (35 % > 20 %), ikke af varigheden (5 % < 20 %). Talord genereres derfor i bæresætningen "Tallet er X." (og "Tallet er X," for mid-form) og klippes ud med `torchaudio.functional.forced_align` (`scripts/tts/align.py carrier`). Korte klip verificeres kun i sammensætning. Prototypen og dens resultat står i §10–§11.

Ordene blev målt med Mic, før det endelige stemmevalg. Ustabiliteten skyldes modellen og meget korte input, ikke stemmen.

**Prototype (`align.py carrier`).**

1. Hver bæresætning genereres med ét kald.
2. Teksten tvangsalignes med wav2vec2.
3. Snittet lægges i det stilleste 5 ms-vindue mellem "er" og talordet. Det begrænses til 0,2 s før første tegn.
4. Udklippet efterbehandles som et almindeligt klip.

Mid-form bruger "Tallet er X,", end-form "Tallet er X.". De 19 talklip, som de 10 regnestykker i §10 bruger, gav:

| Stemme | bæresætninger: CER | bestået | udklip: ASR bestået | talord rigtige | i varighedsvinduet | tid pr. klip |
|---|---|---|---|---|---|---|
| Mic | 4,5 % | 14/19 | 15/19 | 17/19 | 18/19 | 15,3 s |
| Nic | 1,0 % | 17/19 | 14/19 | 17/19 | 18/19 | 15,1 s |

**Hundrede-hoveder.** Klippet `hog.H` ("tre hundrede og,") hallucinerer, når det genereres alene. Med Nic gik 4 af 4 galt, fx "to hundrede og forskeller" og "seks hundrede og 7 25600".

Hovederne genereres derfor som hele tal i bæresætning ("Tallet er tre hundrede og syvogfyrre."), og de tre ord efter "tallet er" klippes ud. Bæresætningerne var fejlfri (4/4, CER 0 %). Udklippene kan ASR ikke genkende alene (0/4), men i sammensætning er alle fire rigtige.

**Demonstration "sat sammen i et udsagn".** De 10 regnestykker blev sat sammen af:

- de 19 udklippede talklip,
- de 4 udklippede hundrede-hoveder,
- 4 fragmenter med ét kald hver ("Hvad er,", "plus,", "minus,", "gange,").

Resultatet med Nic: 8/10 består med wav2vec2 (CER 4,7 %) og 9/10 med whisper (2,3 %). De to fejl skyldes enkelte talklip ("femogfyrre" og "femogtyve" i end-form). Gaten ville generere dem igen.

## 10. Sammensat vs. hel sætning

10 regnestykker, fx "Hvad er 347 plus 28?", blev genereret dels som hel sætning, dels sammensat af klip:

- **Opbygning:** `frag.hvad_er` + `hog.3` + `n.mid.47` + `op.plus` + `n.end.28`.
- **Former:** mid-form er tekst + "," og end-form er tekst + ".".
- **Mellemrum (SPEC §10.2):**
  - 20 ms ved hundrede-sømmen,
  - 120 ms efter et tal i mid-form,
  - 40 ms efter fragment eller operator (inden for frasen).

| Variant | CER wav2vec2 | bestået | talfølge rigtig | CER whisper |
|---|---|---|---|---|
| **Nic, hel sætning** (2 takes) | **1,3 %** | **18/20** | 20/20 | 1,3 % |
| **Nic, sammensat**: tal og hundrede-hoveder fra bæresætning, fragmenter ét kald hver | 4,7 % | 8/10 | 8/10 | 2,3 % |
| Mic, hel sætning (2 takes) | 7,5 % | 7/20 | 19/20 | 4,8 % |
| Mic, sammensat af enkeltkald | 10,4 % | 2/10 | 7/10 | – |
| Mic, sammensat, tal fra bæresætning | 10,7 % | 3/10 | 6/10 | – |
| Mic, sammensat af batch-klip (kommaliste og sætninger) | 15,7 % | 3/10 | 8/10 | – |
| Mic, sammensat, tal fra bæresætnings-batch | 13,7 % | 3/10 | 8/10 | – |

Konklusioner:

1. **Hele sætninger er bedst.** Det støtter D8: hele spørgesætninger for recall-facts til og med 1. kl.
2. **Sammensætning fungerer, når hvert klip er verificeret.** Med Nic er talfølgen rigtig i 8 af 10.
3. **Ét dårligt delt fragment ødelægger alle sammensætninger.** Mic's take af "Hvad er," lød som "vade"/"hver er", og derfor fejler næsten alle Mic-varianter. Delte fragmenter (`frag.*`, `op.*`) bør derfor have flere takes, og takes vælges ud fra ASR i sammensætning, ikke alene.

## 11. Batch-generering: flere klip pr. kald

**Hvorfor.** Hvert kald koster 6–7 s fast, næsten alt i S3Gen (§8). Ved ét kald pr. klip er det over halvdelen af tiden for korte klip.

**Fremgangsmåde** (`probe.py gen-batch` + `align.py batch`):

1. K klip-tekster genereres i ét kald:
   - end-form som hver sin sætning ("Syv. Otte."),
   - mid-form som kommaliste ("syv, otte,"),
   - eventuelt med bærefrase ("Tallet er syv. Tallet er otte."),
   - hele sætninger med deres egne tegn.
2. Teksten tvangsalignes med wav2vec2.
3. Snittet mellem to klip lægges i det stilleste 5 ms-vindue mellem dem, højst 0,2 s før første og 0,25 s efter sidste aligned tegn.
4. Hvert udklip efterbehandles for sig.

Målt med Mic, 1 take pr. batch. CPU-tiden er væguret ved 2 tråde under samme last som en genkørsel af enkeltkald (`calib-single`): 19,3 s pr. sætning og 12,8 s pr. kort klip. "Hel ytring" er ASR på hele batch-lyden.

| Batch | kald | tid/klip | hel ytring CER | udklip i vindue | risikable snit | ASR på udklip | enkeltkald (samme klip) |
|---|---|---|---|---|---|---|---|
| **hele sætninger, K=4** | 3 | **12,8 s** | 9,0 % | 9/12 | 0 | **CER 4,2 %, 8/12** | CER 5,3 %, 12/24 |
| hele sætninger, K=6 | 2 | 12,5 s | 14,2 % | 10/12 | 0 | CER 8,4 %, 7/12 | CER 5,3 %, 12/24 |
| **tal i bærefrase, mid, K=10** | 1 | **8,2 s** | 24,0 %¹ | 9/10 | 1 | **9/10, tal 10/10** | bæresætning ét kald: 15/19, tal 17/19, 15,3 s |
| **tal i bærefrase, end, K=9** | 1 | **8,8 s** | 19,0 %¹ | 7/9 | 0 | **8/9, tal 9/9** | (som ovenfor) |
| tal som kommaliste, mid, K=10 | 1 | 3,8 s | 32,9 % | 9/10 | 0 | 7/10, tal 8/10 | (som ovenfor) |
| tal som sætninger, end, K=9 | 1 | 4,6 s | 32,9 % | 8/9 | 0 | 8/9, tal 9/9 | ét kald uden bærefrase: 14/19, tal 18/19 |
| fragmenter og hundrede-hoveder, kommaliste, K=8 | 1 | 5,2 s | 33,3 % | 4/8 | 0 | 4/8, hoveder 0/4 | 4/8, hoveder 1/4 |
| enkeltord som sætninger, K=10 | 2 | 3,9 s | 30,8 % | 18/20 | 0 | 12/20 | 39/60 (65 %), 12,8 s |
| enkeltord som sætninger, K=5 | 4 | 4,7 s | 43,3 % | 19/20 | 0 | 11/20 | 39/60 |
| enkeltord i bærefrase, K=5 | 4 | 7,6 s | 26,7 % | 20/20 | 1 | 10/20 | 39/60 |

¹ Bærefrasen høres som "tallet af" i den gentagne frase. Den kasseres, så det betyder ikke noget for udklippet.

**Hvad batch kan bruges til:**

- **Hele sætninger med K=4 bevarer kvaliteten.** CER er 4,2 % mod 5,3 % ved ét kald, og CPU-tiden falder 34 %.
  - Pausen mellem sætningerne er 37–320 ms, og ingen snit lå i tale.
  - Tempoet varierer mere. I snit er udklippene 12 % kortere end enkeltkald, enkelte op til 30 % (p04, p05, p10). Det ligger inden for forskellen mellem to enkeltkald (p01: 1,58 mod 1,03 s), men gaten bør have en nedre varighedsgrænse for sætninger.
- **K=6 er for meget.** Anden batch blev rodet ("… hvad giver tolv? Del tolv …" smeltede sammen), og CER blev 8,4 %. T3 bliver også langsommere med længere kontekst: 7,3 mod 9,0 tokens/s ved 350 tokens.
- **Talord i bærefrase, ca. 10 pr. kald, er lige så gode som ét kald pr. bæresætning.** ASR består 17/19 og talordet er rigtigt 19/19, mod 15/19 og 17/19 ved ét kald. Prisen er 8,2–8,8 s mod 15,1–15,3 s pr. klip.
  - Uden grænsen på 0,25 s efter ordet tog udklippene pauser og vejrtrækning med (13/19 i vinduet). Med grænsen er det 16/19.

**Hvad batch ikke kan bruges til:**

- **Enkeltord, med eller uden bærefrase.** Ordene smelter sammen, springes over eller forvrænges, fx "Tallet er elleve" → "tallet af træ" og "To. Tre." → "23". ASR består 50–60 % mod 65 % ved ét kald. Det er billigt, men et kvalitetstab.
- **Kommalister uden pauser.** Fragmenter og hundrede-hoveder ("Hvad er, tre hundrede og, plus,") kan ikke klippes rent, og "og" smelter sammen med næste ord.

**Anbefalet strategi (D):**

| Klip | Teknik | Andel af inventaret |
|---|---|---|
| Hele sætninger (`q.*`, `s.*`) | 4 pr. kald, udklip med forced alignment | ca. 750 klip, 2/3 af lyden |
| Talord (`n.*`, `h.*`) og hundrede-hoveder (`hog.*`) | Bæresætning ("Tallet er X." / "tallet er X," / "Tallet er N hundrede og Y."), ca. 10 pr. kald | ca. 230 klip |
| Øvrige korte klip (operatorer, fragmenter, navneord, navne, tidsfraser, hint-led) | Ét kald pr. klip, verificeres i sammensætning | ca. 1.000 klip |

Tidsfraser og hint-led på mindst 3 stavelser kan sandsynligvis også køre som sætnings-batch. Det er ikke målt og derfor ikke regnet med.

**Forsøg med de faste omkostninger** (samme 8 tekster og seeds som `calib-single`, Mic):

- **S3Gen-reference forkortet til 4 s (fra 8,3 s), snit i en pause.** T3-conditioning og T3-tokens er de samme.
  - S3Gen-tiden falder 43 % (forhold 0,57), og hele kaldet ca. 30 %.
  - ASR er uændret: CER 5,6 % mod 4,8 %, 5/8 består i begge.
  - Stemmeligheden falder lidt: cosinus mellem VoiceEncoder-embedding og prompten er 0,746 mod 0,763 (n=8).
  - Det er strategi E i §12. Den kræver en lyttetest af klangen, før den tages i brug.
- **bf16-autocast.** Hele modellen crasher i HiFiGAN's iSTFT. Kun på T3 giver det ingen gevinst (5,4 s mod 5,3–6,0 s). Forsøget er droppet.

## 12. Fremskrivning af CPU-tid

**Inventaret:** ca. 2.000 klip og 48 min lyd (SPEC §10.2), fordelt på kategorier med anslået varighed og skaleret til 48 min:

| Kategori | klip | snit |
|---|---|---|
| Tal, hundreder, tusind | 238 | 0,78 s |
| Tidsfraser og dagtid | 178 | 1,25 s |
| Operatorer og forbindere | 184 | 0,62 s |
| Katalognavneord | 153 | 0,73 s |
| Hint-led | 102 | 1,04 s |
| Navne | 378 | 0,83 s |
| `q.*` | 277 | 2,18 s |
| `s.*` | 490 | 2,49 s |

**Antagelser:**

- 1 take pr. klip plus 15 % nye takes.
- Grundmodellen er Nic's: 6,24 s fast + 4,29 · rå lyd, hvor rå lyd = 1,23 · færdig lyd.
- Bæresætninger koster 0,94 s ekstra rå lyd pr. klip.
- Batch-tiderne er målt under samme last som enkeltkald og omregnet til lav last med faktor 0,88. De skaleres til kategoriens varighed med modellen.
- 4 tråde er faktor 1,41 hurtigere (målt i §8).

Timerne er beregningstid for én proces:

| Strategi | 2 tråde | 4 tråde |
|---|---|---|
| A. Ét kald pr. klip | 8,8 t | 6,3 t |
| B. Ét kald pr. klip, talord i bæresætning (SPEC uden batch) | 9,2 t | 6,5 t |
| C. Som D, men alle korte klip i bærefrase-batch (kvalitetstab, §11) | 7,0 t | 4,9 t |
| **D. Anbefalet: sætninger 4 pr. kald, talord og hoveder i bæresætning ca. 10 pr. kald, resten ét kald** | **7,6 t** | **5,4 t** |
| E. D + S3Gen-reference på 4 s (kræver lyttetest) | 6,6 t | 4,7 t |

**Målet "under 6 CPU-timer uden tab af udtalekvalitet":**

- Med 4 tråde nås det: D giver 5,4 t, og E giver 4,7 t. Det svarer til SPEC §10.3: "4 tråde når containeren er ledig".
- Med 2 tråde nås det ikke uden kvalitetsrisiko. E giver 6,6 t, og C giver 7,0 t med dårligere enkeltord.

Den resterende tid ligger i ca. 1.000 korte klip med ét kald hver: 3,4 t ved 2 tråde i D. Disse muligheder er ikke målt i spiken:

- tidsfraser og hint-led som sætnings-batch;
- en T3, der ikke beregner attention-vægte for alle 30 lag (`output_attentions=True` tvinger eager attention, men alignment-analysatoren bruger kun lag 9).

Groft regnet forholdsmæssigt koster bølge 1 (ca. 900 klip, SPEC §14) med D ca. 3,4 t ved 2 tråde og 2,4 t ved 4 tråde.

## 13. A2-reserven (Piper)

Ingen af de tre betingelser er opfyldt:

- Chatterbox installerer og indlæses på CPU.
- RTF ved 2 tråde er 7,1–7,7, altså under 12. Den effektive RTF for inventaret ved enkeltkald er ca. 9,5.
- Probe-CER efter takevalg er 3,0 % for Nic (bedste af 4 takes) og 3,6 % for Mic (bedste af 2), altså under 5 %.

Piper er derfor ikke installeret. `setup.sh --piper` installerer piper-tts 1.8.0 og `da_DK-talesyntese-medium` på en låst revision, hvis beslutningen ændres. Stemmen er 22,05 kHz, så `post.resample` løfter den til 24 kHz.

## 14. Lytteprøver

Begge er 24 kHz mono 16-bit, −18,4 LUFS og true peak ≤ −1,6 dBTP. De er committet i `voice/probe/`.

| Fil | Indhold | Længde |
|---|---|---|
| `stemmeproeve-nic.wav` | De 12 probesætninger med Nic, bedste af take 0–1 pr. sætning (ASR), 400 ms pause imellem | 31,2 s |
| `sammensat-vs-hel.wav` | 5 regnestykker (347 + 28, 6 · 7, 56 + 39, 83 − 19, 604 − 71). Først hel sætning (bedste take), 400 ms pause, så sammensat (fragmenter + tal og hundrede-hoveder klippet ud af bæresætninger). 0,9 s mellem parrene. | 34,7 s |

De to sammensætninger, der fejlede ASR (100 − 45 og 250 + 125), er ikke med. I produktionen ville gaten generere dem igen.

Mic-takes til en sammenligning ligger uden for git i `voice/probe/takes/probe12/mic/` og `whole10/mic/`.

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

1. **Stemmevalget afviger fra reglens bogstav** (Nic i stedet for Mic). Begrundelsen står i §7. Alle Mic-data er bevaret.
2. **ASR på isolerede korte ord er upålidelig.** Eksempler: "1" for "et", "t000n" for "tusind", "jor" for "øre" og "t vonedet" for "tre hundrede og". Som SPEC siger, tjekkes klip under 3 stavelser kun i bæresætning eller sammensætning.
3. **Varighedsvinduet passer dårligt til sætninger.** Stavelser tælles som vokalbogstaver, men talt dansk sluger mange ("lige", "hundrede"). 4 % af sætningerne fra enkeltkald og 25 % fra batch ligger under 0,5 · forventet, selv om ASR er fin. Vinduet bør gælde enkeltklip; for sætninger foreslås en nedre grænse på ca. 0,35.
4. **Hundrede-hoveder må ikke genereres alene.** Det dinglende "og," får modellen til at fortsætte ("… og forskeller"). De skal genereres i bæresætning (§9).
5. **Delte fragmenter er et enkelt fejlpunkt.** Én dårlig take af "Hvad er," ødelægger alle sammensætninger, der bruger den. Generér flere takes, og vælg ud fra ASR i sammensætning.
6. **chatterbox-tts 0.1.7 crasher på tekster med ≤ 3 teksttokens.** `probe.py` lapper det (§4). `generate.py` skal genbruge `patch_short_text_bug`.
7. **Kold disk efter genstart:** første modelindlæsning tog 309 s. `snapshot_download(local_files_only=True)` kræver samme `allow_patterns` som ved hentningen, ellers opstår `IncompleteSnapshotError`. Brug `download_models.fetch`.
8. **Transformers 5.2 indlæser wav2vec2 i bf16.** `asr_check.py` tvinger fp32.
9. **Limiteren tager op til 6 dB på enkelte plosiver.** Det skyldes målet på −18 LUFS og −1,5 dBTP, som giver mindre plads end talens 17–21 dB fra loudness til peak. Det er ikke hørbart i stikprøverne, men bør vurderes på lyttesiden.
10. **Batch ændrer tempoet en smule** (§11). Brug højst 4 sætninger pr. kald.
11. **Last fra andre agenter:** loadavg lå på 2–6 under målingerne. Baseline-RTF er målt ved load ca. 2. Batch-tider er korrigeret med en kalibrering (0,88).
12. **Afvigelser fra SPEC §10.3/kunst-lyd-teknik §5.1:**
    - `/opt/tv2-asr` har transformers 5.2.0 + jiwer i stedet for faster-whisper. Whisper-second-opinion kører via transformers i bf16.
    - roest-v3-whisper-1.5b er hentet (valgfrit).
    - Trim-tærsklen gælder det loudness-normaliserede niveau.
    - Gain efterjusteres efter limiteren.
    - torch-tråde er 2 (ikke 3) efter opgavens regel.
13. **Ikke gjort i spiken:** Piper er ikke installeret (A2 udløses ikke), og en egentlig lyttetest af den forkortede S3Gen-reference mangler.

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
| `voice/probe/stemmeproeve-nic.wav`, `voice/probe/sammensat-vs-hel.wav` | Lytteprøver |
| `voice/probe/s1-results.json` | Alle målinger (fra `report.py`) |
| `voice/config.json` | Stemme, model, indstillinger og pipeline-version (hashens "settings") |
| `voice/inventory.json` | Inventaret fra koden (`scripts/voice/inventory.ts`) |
| `voice/masters/<pakke>/<id>.flac`, `voice/masters/index.json` | FLAC-mastere og deres tjek (fil, hash, varighed, LUFS, CER, ASR-tekst, take) |
| `voice/qa.json` | Sammensætningstesten (`scripts/voice/render.ts`) |
| `voice/logs/generate-*.log` | Én linje pr. kald, take og sammensætning |
| `voice/probe/pipeline-sample.wav`, `pipeline-sample.json` | 5 sammensatte regnestykker optaget i Chromium, og resultaterne |
| `scripts/voice/run-wave.sh` | Hele kæden for én bølge |
| `scripts/voice/run-vite.mjs` | Kører TS-scripts med appens moduler via Vites `ssrLoadModule` |
| `scripts/voice/inventory.ts`, `render.ts`, `pack.mjs`, `e2e.mjs` | Inventar, sammensætningstest, pakning og Chromium-test |
| `scripts/tts/generate.py`, `pipeline.py` | Produktionsgenereringen (strategi D, tjek, sammensætning, mastere) |
| `scripts/tts/da_numbers.py` | Uafhængig dansk talordsparser (grammatik, ASR-varianter, cifre) |
| `scripts/tts/sequence.py` | Python-udgave af `src/audio/sequence.ts` og mellemrummene i `compile.ts` |
| `scripts/tts/qa_asr.py` | ASR for sammensætningstesten (wav2vec2, whisper, skyld) |
| `src/assets/voice/*.mp3`, `voice-manifest.json`, `voice-qa.json` | Sprites, manifest og QA-data til lyttesiden |
| `lyt.html`, `src/lyt/*` | Lyttesiden |

## 18. Produktionspipeline (W6)

Kæden fra klip-katalog til færdige sprites. Den følger beslutningerne ovenfor: stemmen Nic, strategi D, bæresætning for talord og hundrede-hoveder, efterbehandling til −18 LUFS og ASR-tjek pr. klip.

### Kommandoer

```
bash talvennerne2/scripts/voice/run-wave.sh 1                 # hele bølge 1 (2 tråde, bidder à 100 min)
TV2_THREADS=4 bash talvennerne2/scripts/voice/run-wave.sh 1   # 4 tråde, når containeren er ledig
```

`run-wave.sh <bølge>` kører:

1. `scripts/tts/setup.sh`, hvis en venv mangler (efter en ny container).
2. `node scripts/voice/run-vite.mjs scripts/voice/inventory.ts`: inventaret fra koden.
3. `nice -n 19 /opt/tv2-tts/bin/python scripts/tts/generate.py --wave N --threads 2 --max-minutes 100` i bidder, til alt er færdigt. Efter hver bid committes nye mastere i commits på højst 10 MB.
4. `node scripts/voice/run-vite.mjs scripts/voice/render.ts`: sammensætningstesten. Peger den på klip, får de nye takes (`generate.py --retake-from voice/qa.json`), højst 2 runder.
5. `node scripts/voice/pack.mjs`: sprites, manifest og QA-data til lyttesiden. Commit.
6. En kort status: klip bestået, ikke bestået og manglende, genereringstid og sammensætningstestens tal.

Enkeltdele kan køres alene:

| Kommando | Gør |
|---|---|
| `generate.py --pack core,n0-20` / `--ids n.end.7,op.plus` / `--ids-file fil` | kun de klip |
| `generate.py --status --wave 1` | status uden at generere |
| `generate.py --dry-run --wave 1` | viser kaldene (batches) uden at indlæse modellen |
| `generate.py --no-whisper` | ingen second opinion |
| `render.ts --no-asr` / `--templates 30` | kun WAV-filerne / antal skabelonsætninger pr. skill |
| `pack.mjs --dry-run` | kun budgetterne |
| `flock /tmp/tv2-chromium.lock node scripts/voice/e2e.mjs [--dist]` | afspilning i Chromium (se nedenfor) |

### Genoptagelse

Kør den samme kommando igen. Intet arbejde går tabt:

- `generate.py` er idempotent på klippets hash. Et klip er færdigt, når `voice/masters/index.json` har den hash, inventaret giver det.
- Tilstanden (`state.jsonl`), de rå takes og kandidaterne ligger i `voice/probe/takes/pipeline/` (uden for git, på disken). En take, der allerede er genereret og tjekket, genereres ikke igen. Rå lyd fra et kald, der blev afbrudt under udklipningen, bruges igen (samme seed giver samme lyd).
- Exitkoder: 0 færdig, 3 tidsbudgettet er brugt (run-wave.sh starter næste bid), 4 ingen fremdrift (klip venter på partnere, der aldrig kommer), 1 fejl.
- Kun én `run-wave.sh` ad gangen pr. checkout (lås i `voice/probe/takes/run-wave.lock`).
- Efter en genstart af containeren tager første modelindlæsning ca. 5 min (kold disk), ellers ca. 15 s.

### Inventar og hash

`voice/inventory.json` skrives af `inventory.ts` (via Vites `ssrLoadModule`, så `import.meta.glob` virker som i appen) og må aldrig rettes i hånden. Hvert klip har `{id, text, genText, pack, wave, hash}` og desuden `form`, `cls` og `opens`, som Python-siden bruger til at sætte klip sammen som `compile()` (mellemrum).

- `genText` er `generationText(id)`.
- `hash = sha1(genText|voice|settings|modelRev)`. `settings` er generatorindstillingerne plus pipeline-versionen (`"pipeline": "D1"`) som kanonisk JSON fra `voice/config.json`. Ændres stemme, model, indstillinger eller pipeline-version, genereres de berørte klip igen.

### Generering (strategi D)

| Klip | Metode | Tekst til modellen | Udklip |
|---|---|---|---|
| Talord og runde hundreder (`n.*`, `h.*`) | `carrier`, ca. 10 pr. kald, mid- og slutform hver for sig | "Tallet er syv, tallet er otte, …," / "Tallet er syv. Tallet er otte. …" | ordet efter "tallet er" |
| Hundrede-hoveder (`hog.*`) | `head`, ca. 10 pr. kald | "Tallet er tre hundrede og otteogtredive." (en hale pr. hoved) | de tre ord efter "tallet er" |
| Hele sætninger (≥ 4 stavelser, slutter med . ? !) | `sentence`, 4 pr. kald (højst 56 stavelser), fordelt round-robin i pakken | sætningerne efter hinanden | hver sætning |
| Alt andet | `single`, ét kald pr. klip; `frag.*` og `op.*` får 2 takes fra start | `genText`; uden tegn får den "," (se under) | hele ytringen, højst 0,2 s før og 0,25 s efter de alignede tegn |

- Alle udklip laves med forced alignment (`align.py`, roest-wav2vec2) og efterbehandles enkeltvis (`post.py`).
- **Stramning af snittet** (`tighten` i `generate.py`, pipeline D2). Snittet mellem to naboer ligger i deres stilleste punkt, men når næste frase følger tæt ("… seksten. Tallet er …"), kunne halen få starten af næste ord med (målt på `n.end.16` i D1). Klippet slutter derfor i den første pause på 25 ms under −42 dB efter sit sidste alignede tegn (+30 ms til udklingning) og starter efter den sidste pause på 20 ms før sit første tegn. Uden en pause bliver snittet, hvor det var.
- **Komma efter sætningsstykker.** Chatterbox sætter punktum efter en tekst uden tegn (`punc_norm`), og den faldende slutintonation ødelægger sammensatte sætninger ("Hvad er. tre, plus. fire."). Stykker uden tegn ("Hvad er", "plus", "i kurven", "æbler") genereres derfor med komma, som spiken målte fragmenterne. Navne (`name.*`) og knaptekster (`s.ui.*`) siges alene og beholder punktummet.
- **Seed:** `int(sha1(nøgle)[:8], 16) + take`, hvor nøglen er klippets id (ét kald) eller kaldets klip-liste (batch).
- **Takes:** take 0 (og take 1 for delte fragmenter). Fejler et klip, får det en ny take som ét kald, højst take 4 (4 nye takes). Klip, der stadig fejler, får den bedste take som master og `"pass": false` i indekset.
- Lappen for tekster med ≤ 3 teksttokens (`probe.patch_short_text_bug`) bruges via `probe.Engine`.
- **Samme tekst, én master.** Klip med samme hash (samme `genText`) deler master: "guld" er guldfarven for 17 arter og "regnbue" for 16. Det første klip genereres, og de andre kopieres (`"copyOf"` i indekset). I hele inventaret er det 97 klip (36 i bølge 1). `pack.mjs` lægger ens lyd i samme sprite på ét sted. Peger sammensætningstesten på en kopi, får originalen en ny take, og kopierne laves igen.

### Tjek

| Klip | Tjek |
|---|---|
| Alle | efterbehandling (−18 ± 1 LU, true peak ≤ −1 dBTP, ingen clipping); varighed i [0,4; 2,2] gange forventet (sætninger [0,35; 2,0], hoveder [0,3; 2,2]) |
| ≥ 3 stavelser | ASR på klippet alene: CER ≤ 0,05 og samme talfølge (`da_numbers.py`) |
| Talord og hoveder | ASR på bæresætningen ("tallet er syv"): talfølgen skal være rigtig, og ordets egne tegn skal være rigtige (CER ≤ 0,05 på ordet; "tallet af" er ligegyldigt) |
| Under 3 stavelser, talord, hoveder og alle `frag.*`/`op.*` | i sammensætning (se under) |
| Navne, knaptekster, navneord og andre stykker på højst 3 ord, der ikke er sætninger | i rammen "Det er X" i stedet for alene: ASR på et isoleret ord er upålidelig ("trekanten", "Tiervennernes hule" bestod først i rammen) |
| Alle, der fejler hos wav2vec2 | whisper-1.5b som second opinion (se under) |

**Hvorfor whisper får alle fejl.** roest-wav2vec2 uden sprogmodel skriver tal over 100 som sammenklistrede cifre ("1104" for "et hundrede og fire", "11006" for "et hundrede og seks") og staver talesprog fonetisk ("finn tallet", "va er", "hvagiver"). Det er rigtig udtale, men ikke ordret. I valideringens første QA-runde bestod 34 af 61 hundredetal hos wav2vec2 og 60 af 61 med whisper. En CER-grænse for second opinion ville netop holde de tal ude, så hver fejl går til whisper. Skylden for en fejl fordeles efter den transskription, der hørte mest.

**Sammensætning i `generate.py`.** Når alle takes er lavet, sættes hvert af disse klip sammen med andre klip, som appen gør (`scripts/tts/sequence.py` er en Python-udgave af `src/audio/sequence.ts` og mellemrummene i `compile.ts`), og ASR-tjekkes:

| Klip | Sammensætninger |
|---|---|
| `n.mid.N`, `h.mid.H` | Hvad er + N + plus + 5 |
| `n.end.N`, `h.end.H` | Hvad er + 7 + plus + N; Find tallet + N ("plus" ender på s og kan skjule et svagt s i "[s]eksten") |
| `hog.H` | H + 47; Hvad er + 7 + plus + H + 25 |
| `op.*` | 7 + op + 5 (plus og minus også: Hvad er + 3 + op + 4) |
| `frag.hvad_er` | Hvad er + 7 + plus + 5; Hvad er + 3 + minus + 4 |
| andre `frag.*` | frag + 5 og frag + 4 (åbner en sætning) eller 7 + frag + 5 |
| andre korte klip | Det er + klip |

Partnerne er de første brugbare klip i en fast liste (7, 3, 12 …; 5, 4, 9 …). Fejler en sammensætning, finder en tegnvis alignment af ASR-teksten mod klippenes tekster det klip, hvis tegn blev hørt forkert (mindst 2 tegn eller 15 %; et indskudt tegn ved en klipgrænse tæller for begge naboer). Det får en ny take. En partner, der allerede er færdig fra en tidligere kørsel, udskiftes med en anden partner. Hvert fejlet tjek markerer altså en take, så løkken ender, når alt er bestået, eller takes er brugt. Et delt fragment ødelægger derfor ikke de sammensætninger, der bruger det.

### Sammensætningstest (`render.ts`, SPEC §10.4)

- Bruger appens egen kode: `compile()` → `findBounds` → `planSequence` → `renderSequence` på FLAC-masterne (afkodet med ffmpeg-static).
- **Tal:** alle 899 tal 101–999 i slutform. ASR + `da_numbers.py` skal give n i 100 %. Kun tal, hvis klip alle har mastere, kan bygges. Hundrederne er bølge 2, så en ren bølge 1 bygger 0 af 899.
- **Skabeloner:** 30 tilfældige udsagn pr. skill (fact og kind, seed `hashSeed('qa:<skill>')`), hvis klip alle har mastere. Kriteriet er ordret: ASR-teksten er lig `toDanishText()` efter normalisering. Mål ≥ 97 %.
- Fejl går til whisper som second opinion. Resultatet står i `voice/qa.json` (tal, skabeloner pr. skill, klip-statistik og `retake`: de klip, fejlene peger på).

### Pakning (`pack.mjs`)

- Én sprite pr. pakke (kataloget), delt i `<pakke>.1`, `<pakke>.2` … over 60 s. Klip i id-orden med 120 ms stilhed, 100 ms før første klip og 200 ms efter sidste.
- `-c:a libmp3lame -b:a 40k -ar 24000 -ac 1` (ffmpeg-static). Filnavn `<sprite>-<sha1 af mp3>[:8].mp3`, så uændret lyd giver uændrede filer.
- `src/assets/voice/voice-manifest.json` i formatet fra `docs/voice-manifest.md`. Kun mastere, hvis hash svarer til inventaret, pakkes.
- `src/assets/voice/voice-qa.json`: ASR-tekst, CER, LUFS og take pr. klip til lyttesiden (ikke en del af manifestet).
- Budgetterne tjekkes, før noget skrives: n0-20, core og ui ≤ 1,2 MB tilsammen, hver sprite ≤ 300 KB, alt ≤ 20 MB (SPEC A20; før bølge 3: 16 MB). Ved overskridelse fejler scriptet.

### Lyttesiden (`lyt.html`)

`src/lyt/`: alle klip pr. sprite med id, tekst, hvad ASR hørte (og i hvilken sammenhæng), CER, LUFS og take; "Byg en sætning" (skill, fact og opgavetype, med hjælpen); skydere for tal 0–1000 og klokkeslæt (analog, analog med halv-form, digital); et flag pr. klip i `talvennerne2.lyt-flags` (via `localGetJson`/`localSetJson`) med note, og eksport af listen som JSON. Med `?e2e=1` får Chromium testkroge (`window.__lyt`), som `scripts/voice/e2e.mjs` bruger.

### Validering på et udsnit (1/10-2026)

64 klip (`scripts/voice/validation-ids.txt`): tallene 0–20 i mid- og slutform (42), hundrede-hovederne `hog.100`, `hog.300`, `hog.600` og `h.end.300`, `h.mid.600` (5), `op.plus`, `op.minus` og 5 fragmenter (7) samt 10 hele spørgesætninger `q.*`. Genereret med 2 tråde og `nice -n 19`, mens andre agenter arbejdede.

| Mål | Resultat |
|---|---|
| Klip bestået | **64/64** (CER 0 hos den afgørende ASR; whisper afgjorde 13 af 64) |
| Takes | 77: 64 + 7 ekstra takes af delte fragmenter + 6 nye takes (`hog.600` 3, `n.end.5`, `n.end.9`, `n.end.16`) |
| Loudness | −18,23 til −18,00 LUFS, true peak ≤ −1,54 dBTP |
| Lyd | 39,4 s i alt |
| Modelkald | 40 i alt: 24 første takes (6 talbatches à 7–8, 1 hovedbatch à 3, 3 sætningsbatches à 3–4, 14 fragmentkald) og 16 nye takes som enkeltkald. D2-kørslen genbrugte de rå takes og kostede kun ASR. |
| Genereringstid | 15–17 min væguret for de 64 klip (CPU-tid 0,43 t), dertil modelindlæsning 330 s med kold disk (18 s varm) og whisper-indlæsning ca. 4,5 min med kold disk |
| Tid pr. klip | talord i batch 9,3 s, sætninger 11 s, hoveder 14,5 s, ét kald 12–17 s |
| Hukommelse | Chatterbox 4,5 GB, med wav2vec2 og whisper 5,4 GB RSS (top 6,7 GB) i én proces |
| Sammensætning i `generate.py` | 54 klip, alle bestået i første runde (D2) |
| **Tal 101–999** (`render.ts`) | **61/61** af dem, der kunne bygges (101–120, 300, 301–320, 601–620); wav2vec2 alene 21/61 |
| **Skabeloner** | **61/61 ordret** (addTo10 4/4, subTo10 4/4, tenFriends 2/2, hear20 21/21, order20 30/30); wav2vec2 alene 37/61 |
| Sprites | n0-20 102,5 KB (42 klip, 20,9 s), core 31,2 KB (7), hundreds 22,8 KB (5), addsub-1 78,1 KB (10); 0,23 MB i alt, fast indlæst 133,7 KB |
| Chromium (`e2e.mjs`, dev-server og produktionsbuild) | `__voiceLog` får præcis de forventede klip i 4 udsagn, og planen er spillet fra spritesene (ingen enhedsstemme). 5 sammensatte regnestykker er optaget fra voiceBus: hørbare, længste stille stykke 120 ms (mellemrummet efter midtform), alle 5 ordret efter ASR (ét via whisper). |
| Lytteprøve | `voice/probe/pipeline-sample.wav`: 15,6 s, 24 kHz, 730 KB (optaget i Chromium); resultaterne i `pipeline-sample.json` |

Forløbet viste tre ting, som er rettet i pipeline D2:

1. **Rest af næste ord i halen.** `n.end.16` havde starten af næste "Tallet" med (energien steg igen i de sidste 100 ms) og blev hørt som "Deisten"/"vejsten" i "Find tallet seksten" og "seks hundrede og seksten". Snittet strammes nu til pauserne (se Generering). Efter D2 bestod alle 54 sammensætninger i første runde. Før bestod 51, og `hog.600` brugte alle 5 takes.
2. **wav2vec2 og tal over 100.** Uden sprogmodel skriver den "1104", "11006", "600 9en" og "finn tallet". Derfor går alle fejl til whisper (se Tjek).
3. **"plus" skjuler et svagt s.** `n.end.16` bestod "Hvad er syv plus seksten", men ikke efter "og" eller "tallet". Slutformer tjekkes nu også efter "Find tallet".

Den første QA-runde med D2 fandt 2 fejl (105 hørt som 115, 616 som "seks hundrede af vejsten"). Den pegede på `hog.600`, `n.end.16` og `n.end.5`. De fik nye takes (`--retake-from voice/qa.json`, som `run-wave.sh` gør), og anden runde var 61/61.

### Forventet tid for bølge 1

Session-branchen har nu 926 klip i bølge 1 (1.717 i alt), og 59 af dem er lavet i valideringen. Kaldplanen (`generate.py --wave 1 --dry-run`) er 18 talbatches, 88 sætningsbatches og 342 enkeltkald. 37 klip er kopier af et andet klip med samme tekst. Med de målte tider:

| Del | Tid ved 2 tråde |
|---|---|
| talord (162 klip, 9,3 s pr. klip) | 25 min |
| sætninger (ca. 336, 11 s pr. klip) | 60 min |
| enkeltkald (ca. 330, 13,5 s pr. kald) | 75 min |
| nye takes (ca. 10 %) | 20 min |
| ASR, whisper og sammensætninger (ca. 520 klip i sammensætning) | 35 min |
| sammensætningstest (ca. 300 tal og 30 pr. skill) | 25 min |
| modelindlæsning (3 bidder) | 1–15 min |

Det giver **ca. 4,2 timer væguret ved 2 tråde (CPU-tid ca. 7,5 timer for processen) og ca. 3,1 timer ved 4 tråde**, i 3 bidder à 100 min. Hele inventaret på 1.717 klip skønnes til ca. 7,5 timer ved 2 tråde (16 s pr. klip).

Med bølge 1 kan sammensætningstesten bygge ca. 300 af de 899 tal: 101–199, 300–399 og 601–699 med valideringens hoveder. Alle 899 kræver bølge 2.

**Dovent katalog.** `inventory.ts`, `render.ts` og lyttesiden kalder `loadAllClips()`, når kataloget har den (`Reflect.get`, så koden virker med både det tidlige og det dovne katalog). Det er afprøvet på en sammenfletning med session-branchen: inventaret, sammensætningstesten, mine tests, buildet og `e2e.mjs --dist` er grønne, og valideringens 64 hashes er uændrede.

### Kendte problemer (pipeline)

1. **wav2vec2 er en streng og stavende dommer.** Den skriver tal over 100 som cifre, der hænger sammen, og staver talesprog fonetisk. I valideringens sammensætningstest bestod kun 21/61 tal og 37/61 skabeloner hos wav2vec2 alene, mod 61/61 og 61/61 med whisper. Whisper (1,5B, bf16) koster ca. 5 s pr. tjek og 4,5 min at indlæse fra kold disk. Med `--no-whisper` er pipelinen hurtigere, men laver mange unødige takes.
2. **Hundrede-hovederne er sværest.** "og" er reduceret og hænger sammen med halen, så sømmen på 20 ms afgør meget. `hog.600` krævede 4 takes. Bølge 2 bør køres med 4 tråde og QA-runder (standard 2).
3. **Tilskrivningen er en heuristik.** Et indskudt tegn ved en klipgrænse tæller for begge naboer, så det klip, der testes, kan få skylden for en nabos fejl og bruge en take ekstra. Det er afgrænset af højst 5 takes pr. klip.
4. **`voice/.gitignore` ligger uden for scope-globben** (`voice/**` matcher ikke filer, der starter med punktum). Arbejdsfilerne ligger derfor i den allerede ignorerede `voice/probe/takes/pipeline/` og `voice/probe/takes/qa/`.
5. **Nogle enkeltord udtales forkert af modellen.** "regnbue" blev hørt som "Heimboe"/"heinbu" i alle 5 takes, både alene og i "Det er regnbue" og af begge ASR'er. Det ligner et svagt R. Sådanne klip får den bedste take og `"pass": false`. Lyttesiden viser dem under "kun ikke bestået", og de bør vurderes af et menneske. Hjælper det ikke, kan katalogteksten ændres.
6. **Stramningen kan klippe svage slutlyde.** Snittet flyttes kun ind i en pause på mindst 25 ms under −42 dB efter ordets sidste alignede tegn. Varighedstjekket og sammensætningerne fanger et klip, der er blevet for kort (`n.end.9` take 0: 0,09 s, ny take).
7. **Et klip kunne blive hængende uden master** (rettet 4/10). Hvis sammensætningstesten afviste et kort klips eneste beståede take, og alle takes var brugt, kom klippet hverken i "takes brugt op" eller i oprydningen. Den afviste take beholdt nemlig `pass_a`.
   - Følgen: `s.order.countBackHundreds` ("Tæl baglæns i hundreder fra") manglede i manifestet, og hele sætningen blev læst af enhedens stemme.
   - Nu sender `generate.py` den bedste take som `"pass": false`. Det er den med lavest CER, også selvom sammensætningstesten har afvist den. Her blev det t1 (CER 0,0435); whisper hørte "Tal" for "Tæl".
   - `pack.mjs` fejler nu, hvis et klip i en indspillet bølge mangler master. `--allow-missing` pakker alligevel.
   - Bølge 2 står herefter på 949 beståede og 113 ikke beståede klip, og ingen mangler.
