Research report: Danske Spil market and Danish slot regulation, for the NORDLYS/SOLSTORM planning step (researched 2026-09-22)

## The 10 most decision-relevant takeaways

1. **Each spin must take at least 3 seconds in Denmark. This is certain.** SCP.07.03.EN.1.1 (March 2026) §5.1.1.5 says at least 3 s must pass between each "settlement". Settlement means from pressing spin until the result is shown. The same 3 s gap applies between results in autoplay. The UK floor is 2.5 s, so Denmark is stricter. Turbo or slam-stop can never go below 3 s. The whole spin sequence, including anticipation, has to fill about 3.0–3.6 s.

2. **Denmark is banning both "losses disguised as wins" (LDWs) and bonus buy on slots.** Both are in the political agreement "Spilpakke 1" (24 Oct 2025). The agreement text is certain; the implementing order had not been seen when this was researched.
   - Results less than or equal to the stake may not use the same sound, light and graphic effects as real wins.
   - Players may not buy direct access to bonus games (online or land-based).
   - Target date is "as soon as possible and no later than 1 January 2027".
   - The UK already bans LDW celebration (RTS 14F), autoplay (8C), turbo/quick-spin/slam-stop (14E) and playing several slots at once (14C).
   - **Recommendation:** design to the union of UK rules and Danish 2027 rules. That makes the pitch future-proof.

3. **Extreme must be earned inside the main game, never bought.** Besides the bonus-buy ban, the explanatory notes to bill L 127 (introduced 25 Feb 2026) set three conditions for a slot:
   - the player always starts in the main game;
   - stakes can only be placed in the main game;
   - the main game must make up most of the game.

   So there should be no "buy Extreme" and no side-bet or ante to unlock it. An ante bet is legally uncertain in Denmark and should be avoided.

4. **A persistent meter that unlocks a better-paying mode is allowed if it is disclosed and not adaptive.** The relevant SCP.07.03 rules:
   - §5.1.2.6 guidance: the game's or player's history must not affect probabilities unless this is disclosed.
   - §5.1.4.3: games must not adapt to player behaviour, except through a player choice that is part of the game logic and described in the rules.
   - §3.1.2.6: the rules must explain every feature that increases the chance or size of wins.
   - §3.3.1.2–3: the stated RTP must be correct and not manipulated, and nothing may intervene to keep RTP constant.

   What this means for the design:
   - The stated RTP must be the blended total, including Extreme. Extreme's own RTP per spin can be shown as feature information.
   - The meter must fill from RNG symbol events, **not from money lost**. A "pity timer" or loss-based filling counts as adaptive or compensating behaviour.
   - Saved state must be kept for at least 90 days, and the rules must say what happens after that (§3.1.2.8, §7.1.2.5). Unfinished games must be resumable (§7.1.3).

5. **Advantage play: the online risk is stake switching.** On land, persistence machines attract "vultures" who take over half-full machines left by others. Online the meter belongs to one account, so the real exploit is filling at a low stake and cashing in at a high one. Standard fixes are one meter per stake level, or paying Extreme at the average stake that filled the meter. Most sources say to disclose whether progress persists or resets. GLI-11 v3 reportedly has a "Persistence Games" section; I could not read the encrypted PDF, so that is medium confidence.

6. **Constructed near-misses are explicitly banned.** SCP.07.03 §5.1.4.1 says constructed "near-miss" is not a correct presentation of chance. UK RTS 7 says a losing outcome may not be swapped for a different losing outcome. Anticipation (slowing reels after two scatters) is fine only if it is triggered by what has really landed and is applied the same way every time. The game must also not suggest that the player controls the outcome (§5.1.4.2).

7. **Honest "feels like winning more".** Cascade and cluster games reach roughly 25–35% hit frequency, but many of those hits are LDWs.
   - Figures from third-party review sites, so approximate: Gates of Olympus Super Scatter 27.78%, Le Bandit 32.47%, Reactoonz ~33%, Sugar Rush ~34%, Starburst ~22%, Big Bass Bonanza ~13%. Sweet Bonanza figures vary a lot (21–50%) and are unreliable.
   - Top configurations sit at 96–96.7% RTP. Operators can pick lower variants: Pragmatic 95.5/94.5%, Le Bandit down to 92.17/88.36%.
   - Once Denmark bans LDW effects in 2027, those sub-stake hits in competitor games will have to be shown neutrally.
   - **The opportunity:** tune the maths for a high *net-win* frequency (return greater than stake). Celebrate only when the whole sequence total is above the stake, and publish both hit frequency and net-win frequency.

8. **What Danske Spil looks like as a buyer.**
   - State-owned, with the slogan "Spil med omtanke".
   - Record profit of about DKK 2bn in 2025. Its casino business (Danske Licens Spil) had revenue of DKK 1.584bn, and casino grew while betting fell.
   - Online casino was the largest Danish gambling segment in 2025: gross gaming revenue (GGR) DKK 4.31bn, 38% of the market, up 12.1%.
   - Its share of high-risk players is down 69% since 2021, and strict limits apply to 18–24-year-olds.
   - Its exclusive "Kun hos os" titles are dated Danish-IP games: Olsen Banden (2012), Klovn, John Mogensen, Pølsevognen, Kaffeautomaten. Olsen Banden 2 is by Win Studios (Entain), with minimum stakes of 0.35–1 kr.
   - Its casino platform is moving to EveryMatrix (deal Nov 2025, go-live summer 2026). EveryMatrix owns the studios Fantasma, Armadillo and Spearhead.
   - Recently added studios include Push Gaming (Sep 2024), Peter & Sons (Jun 2025) and Quickspin. Hacksaw got its Danish licence from 1 Jan 2025.
   - **The pitch:** a modern, Danish-made exclusive with no licensed IP, compliant by design, with a par sheet and Monte Carlo report, Danish-first text, low minimum stake and a distinctive look.

9. **Theme constraints: avoid saturated themes and anything that appeals to children.** Saturated: Egypt, Greek gods, Norse/Vikings, fruit/777, candy, fishing (Big Bass), Wild West, Asian fortune, "Book of".
   - L 127's new marketing rule (§36(1)(3), largely from 1 Jan 2027) bans figures or animations that especially appeal to under-18s. Its examples: talking animals, colourful robots, monsters, fantasy creatures with a childlike look, exaggerated facial expressions. It also bans people under 25, including AI-generated people. Danske Spil could not market a cute-character game.
   - Slots must also look visibly different from monopoly products (scratch cards, instant games, keno, lotto), so the main game should not look like a scratch-card or lottery-draw reveal.

10. **Recommended theme: "NORDLYS", with the Extreme edition as "SOLSTORM G5".**
    - NOAA's geomagnetic storm scale literally names its top level "G5 – Extreme" (Kp 9). The G1→G5 steps (Minor, Moderate, Strong, Severe, Extreme) can be the progression ladder.
    - Danish hook: the G5 storm of 10–11 May 2024 showed red and green aurora over all of Denmark. DR called it one of the strongest in 500 years. Red aurora is naturally rare, so it signals rarity.
    - Aurora is not a saturated slot theme; I found only Aurora (Northern Lights Gaming/Relax, 2020), Aurora Wilds (2019) and Northern Lights (WGS).
    - It is abstract (plasma, ice crystals, magnetic field lines, a star/sun core), so it suits shaders, SDF, particles and bloom, and needs no characters, faces or IP.

## 1. Danske Spil: portfolio, providers, values, pitch fit
- **Catalogue:** over 2,000 slots with a daily "Dagens lancering" (launch of the day). Big titles include Gates of Olympus, Sweet Bonanza (Pragmatic), Book of Dead (Play'n GO) and Starburst (NetEnt). Other providers: Red Tiger, Yggdrasil, ELK, BTG, Relax, Microgaming, Quickspin, Push Gaming, Peter & Sons (via Light & Wonder), Gaming Realms. Certain.
- **Exclusives:** all Danish pop-culture IP. Klovn was made with Zentropa. The exclusives page says more will be added. Certain.
- **Values:** "Spil med omtanke". Game pages link to ROFUS, deposit limits, self-tests and StopSpillet, with the message "Spil aldrig for mere, end du har råd til at tabe".
- **What makes a pitch attractive (my inference):**
  - Danishness without IP costs.
  - Proof that the game already meets rules coming in 2027: no LDW effects, no bonus buy, 3 s cycle.
  - Maths the operator can check: par sheet, Monte Carlo run, hit and net-win frequency, how Extreme contributes to RTP.
  - Low minimum stake and a mobile-first build.
  - Clean integration through EveryMatrix or an aggregator.
- **Formal route to market:**
  - A Danish game-supplier licence has been mandatory since 1 Jan 2025 (valid up to 5 years; fee DKK 67,600 in 2026).
  - Each game must pass SCP.07.03 at a lab accredited to ISO 17025, 17020 or 17065, and the certificate goes into the regulator's games register before launch.
  - The RNG must be certified to SCP.01.00.
  - Since March 2026, re-certification is only needed when components change.

## 2. Danish regulation (Spillemyndigheden), with certainty
**Certain — SCP.07.03 v1.1 and the online casino order (BEK 682/2025):**
- **Language and rules:**
  - All rules and information in correct Danish (§3.1.1.2).
  - Rules available without placing a stake and throughout play (§3.1.2.4–5).
  - Rules must not change during a game (§3.1.2.7).
- **Stakes, wins and RTP on screen:**
  - Show all possible wins and the biggest possible win per stake, plus minimum and maximum stake (§3.2.1.3–5).
  - Theoretical RTP stated in the rules (§3.3.1.1).
- **Always visible:**
  - Game name and balance on every page (§4.1.1.1–2).
  - Stake per line and total stake (§4.1.4.1).
  - A clear status indicator whenever the game temporarily differs from the base game, such as a feature or bonus (§4.1.1.5). Extreme must be unmistakable.
- **Results and symbols:**
  - Results shown clearly and long enough to understand (§4.1.2.1–2).
  - Symbols keep the same shape and colour except when animated (§4.1.3.1).
  - Wins placed visually next to their symbols (§4.1.4.2).
- **Input and game logic:**
  - The player must actively choose to start; repeated clicks must not be queued (§5.1.1.2–3).
  - Game logic runs on the server (§5.1.1.4).
  - RNG output used in the order it is received, with no "adaptive behaviour", and traceable (§5.1.2.3–4).
- **Free-play (demo) games (§5.1.3.1):** must use the same RNG and game logic as real-money play and must not suggest a better chance of winning. For our build, the "force Extreme" button must be a clearly labelled pitch/presenter tool. It must never be in a free-play build, and the normal play-money mode must run the real maths.
- **Clock (BEK 682 §17 and the Feb 2026 responsible-gambling guidance):** the operator must show a clock that is always visible, is not based on the player's device, and cannot be scrolled or clicked away. The game UI should reserve a clock slot for fullscreen mobile.
- **Other player-protection rules:**
  - Deposit limit is mandatory (§21).
  - 24 h pause and exclusion of at least 30 days (§23).
  - ROFUS and StopSpillet information (§15).
  - Bonus cap DKK 1,000 with at most 10x wagering (§29).
- **Autoplay:** allowed in Denmark (SCP guidance: "This does not exclude auto play"), with the 3 s gap. Omitting it is advisable given the UK ban and Danske Spil's profile.
- **Not found anywhere (so probably none):** a statutory RTP minimum for online casino, a maximum stake, a mandatory periodic reality-check pop-up, or an explicit turbo rule. The 3 s floor covers turbo.

**Certain as political intent, implementing instrument not yet seen — Spilpakke 1, deadline 1 Jan 2027:**
- LDW-effects ban.
- Bonus-buy ban.
- Mandatory loss limit.
- A secondary source adds a 48 h cooling-off when raising limits and automatic logout after inactivity.
- A direct ROFUS link.
- The regulator's "MitSpil" app giving players an overview of spending across operators.
- L 127 is scheduled to take effect 1 Jul 2026 with most parts from 1 Jan 2027; I did not verify the final vote.

**UK comparison (certain):**
- 2.5 s minimum cycle (RTS 14D); no autoplay, turbo or slam-stop; no celebrating returns at or below stake.
- Net position (running win/loss) and elapsed session time must be shown (RTS 2E, 13C).
- Stake cap £5, or £2 for under-25s, since April/May 2025.
- Bonus buy has not been offered in the UK since 2019; it is widely described as a UKGC ban.

**Germany (medium confidence):** €1 maximum stake, 5 s per spin, no autoplay, no jackpots.

## 3. Precedents for an enhanced mode and persistent progression
- **Hacksaw:** bonus tiers by scatter count, topped by a rare 5-scatter "Hidden Epic Bonus" with wilder modifiers. This is the closest precedent for a rare, earned Extreme.
- **Pragmatic:**
  - "1000" editions with higher multiplier ceilings (e.g. Sweet Bonanza 1000 at 96.53%).
  - "Super Scatter" (Gates of Olympus Super Scatter, 28 Apr 2025, up to 50,000x).
  - Ante Bet (a higher stake for more frequent free spins) and Super Free Spins buys.
- **Nolimit City:** xNudge, xWays, xSplit, Enhancer Cells, and xGod/"God Mode" (a 3,800x buy in Outsourced). **Caveat:** most "enhanced modes" on the market are *sold* through bonus buy, which Denmark is banning. An earned Extreme is therefore a differentiator.
- **ELK** X-iter mode menus are also buy-based. **Play'n GO** Reactoonz charge meters are "perceived persistence" (they only last within a cascade sequence).
- **Must-drop / daily-drop jackpots** are allowed in Denmark if the rules say the jackpot is set to trigger by a certain time and state the probability of winning (SCP §6.3.2).
- **How a higher-RTP mode fits the rules:** every free-spins feature already pays back more than 100% per spin within the feature, so a mode with better payback is standard. It must be folded into the stated total RTP and described in the rules. Industry commentary (Mar 2026) says operators must state whether progress persists or resets and avoid inflating expectations.

## 4. Top 2024–2026 slots and "frequent win" mechanics
- **Mechanics:** tumble/cascade with scatter or cluster pays on 6x5 or 7x7 grids, multiplier orbs that build up during free spins, sticky or persistent in-feature multipliers, tiered bonuses, and "1000"/"Super" variants.
- **Hit frequency:** typically 25–35% for cascade and cluster games, about 22% for classic low-volatility line games, and 13% or less for high-volatility fishing/collect games.
- **RTP:** 96–96.7% in top configurations.
- **Research anchor:** Dixon et al. (2010, *Addiction*) found that LDWs are as physiologically arousing as real wins. This is the evidence base behind the UK and Danish bans.

## 5. Theme landscape
- **Saturated:** Egypt, Greek gods, Norse/Vikings (clichéd, especially in the Nordics), fruit/777, candy/sweets, fishing, Wild West, Asian fortune, "Book of".
- **Fresh and suited to procedural art:** aurora/nordlys (only a few titles exist), space weather and solar storms, ice crystals and prisms, Danish design minimalism for the UI shell.
- **Risky:** cute characters (marketing ban from 2027), national symbols such as Dannebrog or the crown (sensitive for a state-owned operator; my judgement), Christmas/elves (context-dependent under L 127), scratch-card or lottery-like reveals (must differ visibly from monopoly games).

## Sources
- SCP.07.03 Requirements for games – online casino v1.1: https://www.spillemyndigheden.dk/media/x1mlhl3k/scp0703en11-requirements-for-games-online-casino.pdf
- Certification programme index: https://www.spillemyndigheden.dk/en-us/businesses-and-associations/game-supplier/certification-programme
- BEK 682/2025 online casino order: https://www.retsinformation.dk/eli/lta/2025/682 (amended by BEK 1827/2025)
- Spilpakke 1 agreement text: https://skm.dk/media/vpvcn3x5/aftaletekst-spil.pdf
- L 127 bill: https://www.retsinformation.dk/eli/ft/202512L00127
- DGA responsible gambling guidance (2026): https://www.spillemyndigheden.dk/media/tt3mslpn/the-danish-gambling-authoritys-guidance-on-responsible-gambling-betting-and-online-casino.pdf
- UKGC RTS changes: https://www.gamblingcommission.gov.uk/consultation-response/online-games-design-and-reverse-withdrawals/ogdrw-annex-1-summary-of-changes-to-rts
- UKGC RTS 7: https://www.gamblingcommission.gov.uk/standards/remote-gambling-and-software-technical-standards/rts-7-generation-of-random-outcomes
- UK stake limits: https://www.olbg.com/news/ukgc-confirms-new-stake-limits-online-slots-starting-april-2025
- Danske Spil exclusives: https://danskespil.dk/casino/alle-spil/kategori/kun-hos-os
- Olsen Banden 2 page: https://danskespil.dk/casino/olsenbanden2
- Danske Spil 2025 results: https://sbcnews.co.uk/igaming/2026/03/16/danske-spil-record-2025/
- Danish market 2025: https://spillemyndigheden.dk/en-us/news-articles/the-gambling-market-in-numbers-2025-online-casino-becomes-danes-preferred-form-of-gambling-for-the-first-time
- EveryMatrix deal: https://publications.world-lotteries.org/blog-posts/danske-spil-selects-everymatrix-to-power-casino-and-bingo-offerings
- Push Gaming deal: https://europeangaming.eu/portal/latest-news/2024/09/17/166678/push-gaming-bolsters-danish-presence-with-danske-licens-spil/
- Peter & Sons: https://www.gamblinginsider.com/news/29702/peter-sons-content-goes-live-on-danske-spil-casino-via-light-wonder-integration
- Hacksaw Danish licence: https://www.gamblinginsider.com/news/27863/hacksaw-gaming-enters-danish-market-with-new-regulatory-licence
- Supplier licence: https://www.yogonet.com/international/news/2024/07/01/72912-danish-gambling-authority-mandates-new-licensing-for-game-suppliers-starting-january-2025
- Gates of Olympus Super Scatter: https://www.olbg.com/news/gates-olympus-super-scatter-slot-unleashes-50000x-max-wins
- Hacksaw tiers: https://www.ltccasino.io/cryptocasino/hacksaw-hidden-epic-bonuses/
- God Mode: https://nolimitcity.com/posts/god-mode-nolimit-city
- Persistence commentary: https://www.gamblingzone.com/uk/the-zone/casino/persistent-features-in-modern-slots/
- Slot vultures: https://cdcgaming.com/commentary/frank-floor-talk-persistence-and-slot-vultures/
- LDW study: https://onlinelibrary.wiley.com/doi/10.1111/j.1360-0443.2010.03050.x
- NOAA scales: https://www.spaceweather.gov/noaa-scales-explanation
- May 2024 storm over Denmark: https://www.dr.dk/nyheder/vejret/imponerende-nordlys-over-danmark-var-et-af-de-kraftigste-i-500-aar
- Aurora slot precedent: https://www.casino.org/slots/aurora/
- Theme saturation: https://www.yogonet.com/international/news/2025/10/24/115938-greek-and-egyptian-mythology-is-a-dominant-theme-in-slots

### Critical Files for Implementation
None of these exist yet. They are the files these rules constrain most:
- /home/user/Test/automat/src/math/model.ts — reel sets and paytable, meter filled by RNG symbol events, one meter per stake level, blended RTP including Extreme
- /home/user/Test/automat/scripts/simulate.ts — Monte Carlo par sheet: RTP, hit frequency, net-win frequency, Extreme trigger rate and its RTP contribution
- /home/user/Test/automat/src/game/spinController.ts — 3.0 s minimum settlement timer, no queued clicks, anticipation only from real landed state
- /home/user/Test/automat/src/fx/winPresentation.ts — celebration tiers by win/stake ratio, neutral "return" style for results at or below stake, clear Extreme state indicator
- /home/user/Test/automat/src/ui/Hud.tsx — Danish UI with clock slot, balance, total and min/max stake, max win, net position, rules/RTP screen, and a clearly labelled pitch-only "force Extreme" button