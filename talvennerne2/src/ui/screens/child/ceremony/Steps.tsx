// The full-screen moments of the end of a round (SPEC §5.8, spildesign §7.2): "Det lærte du" with
// the stars and the count-up, the bridge, a world finale's party with all its things, a medal, a new
// level with its thing and "Prøv den på", growth, a new thing or friend (with its name), and the
// choice of a golden or rainbow animal. Each screen says what it shows; the screen around them reads
// it aloud and moves on.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { AnalogClock, CoordGrid, DigitalClock, FractionBars, FractionShape, SquareGrid } from '../../../../art/materials'
import { Shape2D } from '../../../../art/materials/Shapes'
import { circle, ellipse } from '../../../../art/materials/geom'
import { HIGHLIGHT, MAT } from '../../../../art/materials/palette'
import { ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID, WORLD_BY_ID } from '../../../../content/curriculum'
import type { Animal, ClipId, ItemId, ItemSource, SpeciesId, SpeechPart, Term, WorldId } from '../../../../engine/types'
import { useNav } from '../../../../app/nav'
import { speciesOfWorld } from '../../../../meta/animals'
import { clockWords } from '../../../../speech/clock'
import { toDanishText } from '../../../../speech/compile'
import { openedClip, type CeremonyStep } from '../../../../meta/ceremonyQueue'
import { totalPerler, totalXp, type Reward } from '../../../../meta/rewards'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { Equation } from '../../../design/Equation'
import { Icon } from '../../../design/Icon'
import { ProgressStones } from '../../../design/ProgressStones'
import { SpokenText } from '../../../design/SpokenText'
import { isCalm } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { ObjectsScene } from '../../../scenes/ObjectsScene'
import { formatMoney, formatNumber } from '../../../task/answers'
import { PieceArt, pieceScale } from '../../../task/faces'
import { isPiece } from '../../../task/pay/logic'
import { Buddy } from '../round/Buddy'
import { AnimalPicture, ItemPicture } from '../map/art'
import { isItemDrawn } from '../wardrobe/drawn'
import { howToGet } from '../wardrobe/model'
import { goalSpeech, lineText } from '../map/words'
import { canDoClip, learnedItems, type LearnedContext, type LearnedFace, type LearnedItem, type LearnedPic } from './describe'
import { finaleThings, progressOf, setProgress } from './flow'
import { NameAnimal } from './NameAnimal'
import '../../../scenes/scenes.css'

type Of<T extends Reward['t']> = Extract<Reward, { t: T }>
const first = <T extends Reward['t']>(rs: readonly Reward[], t: T): Of<T> | undefined => rs.find((r): r is Of<T> => r.t === t)

// ─── Count-up ───────────────────────────────────────────────────────────────

/** A number counting up from 0 (content changes only; calm mode shows the end at once). */
export function useCountUp(target: number, ms = 900, delay = 250): number {
  const [n, setN] = useState(() => (isCalm() ? target : 0))
  useEffect(() => {
    if (isCalm() || target <= 0) {
      setN(target)
      return
    }
    let raf = 0
    const t0 = performance.now() + delay
    const tick = () => {
      const p = Math.max(0, Math.min(1, (performance.now() - t0) / ms))
      setN(Math.round(target * (1 - (1 - p) * (1 - p))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, delay])
  return n
}

// ─── "Det lærte du", the stars and the count-up ────────────────────────────

/** "Det lærte du", each thing learned with how well it sits, then the stars. */
export function summarySpeech(steps: readonly CeremonyStep[], ctx: LearnedContext = {}): SpeechPart[] {
  const learned = steps.find((s) => s.kind === 'learned')
  const r = learned ? first(learned.rewards, 'learned') : undefined
  const parts: SpeechPart[] = [{ clip: 's.reward.learned' }]
  if (r) for (const item of learnedItems(r, ctx)) parts.push(...item.speech)
  const stars = steps.find((s) => s.kind === 'stars')
  if (stars) parts.push(...stars.speech)
  return parts
}

/**
 * The summary does not fit its stage (it would scroll: three clocks on a 375 by 667 phone put the stars,
 * perler and points under the buttons, QA3b): the same things a size smaller (ceremony.css
 * `is-tight`). Only then: a summary that fits keeps its look. Once tight it stays tight, so it never
 * flickers between the two.
 */
function useTight(): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null)
  const [tight, setTight] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    const stage = el?.closest('.tv-cer__stage')
    if (tight || !el || !stage) return
    const check = () => {
      if (stage.scrollHeight - stage.clientHeight > 1) setTight(true)
    }
    check()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check)
    ro?.observe(el)
    ro?.observe(stage)
    return () => ro?.disconnect()
  }, [tight])
  return [ref, tight]
}

export function SummaryScreen({ steps, rewards, ctx }: { steps: readonly CeremonyStep[]; rewards: readonly Reward[]; ctx: LearnedContext }) {
  const speech = useSpeech()
  const [ref, tight] = useTight()
  const learned = steps.find((s) => s.kind === 'learned')
  const r = learned ? first(learned.rewards, 'learned') : undefined
  const items = r ? learnedItems(r, ctx) : []
  const starsStep = steps.find((s) => s.kind === 'stars')
  const stars = starsStep ? first(starsStep.rewards, 'stars') : undefined
  const perler = useCountUp(totalPerler(rewards))
  const xp = useCountUp(totalXp(rewards), 1100)
  const showTally = steps.some((s) => s.kind === 'tally') || totalPerler(rewards) > 0
  return (
    <div ref={ref} className={cx('tv-cer-summary', (stars || showTally) && 'has-earn', tight && 'is-tight')} data-cer-summary="">
      <div className="tv-cer-summary__learn">
        <SpokenText as="h1" clip="s.reward.learned" className="tv-cer__title" />
        <ul className={cx('tv-learned', `tv-learned--n${items.length}`)}>
          {items.map((item, i) => (
            <li key={item.key} className="tv-learned__item" style={{ '--i': i } as CSSProperties}>
              <LearnedCard item={item} />
            </li>
          ))}
        </ul>
        {r?.next && <NextGoal parts={goalSpeech(r.next)} />}
      </div>
      {(stars || showTally) && (
        <div className="tv-cer-summary__earn">
          {stars && <StarBurst from={stars.from} to={stars.stars} />}
          {showTally && (
            <div className="tv-tally" data-tally="">
              <span className="tv-tally__pill is-perler">
                <Icon name="pearl" size={30} solid />
                <SpokenText
                  parts={[{ num: totalPerler(rewards), form: 'mid' }, { clip: 's.ceremony.perler' }]}
                  text={`+${perler} ${speech.text('s.ceremony.perler')}`}
                  className="tv-tally__n"
                />
              </span>
              <span className="tv-tally__pill is-xp">
                <Icon name="star" size={28} solid />
                <SpokenText
                  parts={[{ num: totalXp(rewards), form: 'mid' }, { clip: 's.ceremony.xp' }]}
                  text={`+${xp} ${speech.text('s.ceremony.xp')}`}
                  className="tv-tally__n"
                />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NextGoal({ parts }: { parts: SpeechPart[] }) {
  const speech = useSpeech()
  const said: SpeechPart[] = [{ clip: 's.reward.nextGoal' }, ...parts]
  return (
    <div className="tv-cer-goal">
      <Icon name="flag" size={26} strokeWidth={2.4} />
      <SpokenText parts={said} text={`${speech.text('s.reward.nextGoal')}: ${lineText(parts, speech.text)}`} className="tv-cer-goal__text" />
    </div>
  )
}

/** One thing learned: the fact or number itself and how well it sits; a tap reads it. */
function LearnedCard({ item }: { item: LearnedItem }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className={cx('tv-learned__card tv-touch', `is-${item.face.t}`)}
      aria-label={toDanishText(item.speech)}
      onClick={(e) => {
        e.stopPropagation()
        speech.speak(item.speech)
      }}
      data-learned={item.key}
      {...pressProps}
    >
      <LearnedPicture face={item.face} />
      <SpokenText clip={item.badge} silent className="tv-learned__badge" />
    </button>
  )
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A time as the child learned to say it: "Klokken ni", "Halv ti", "Kvart i ni". */
export function clockText(minutes: number): string {
  const words = clockWords(minutes, 'analog')
  return capital(minutes % 60 === 0 ? `klokken ${words}` : words)
}

/** A part as the card writes it: numbers, money, lengths and fractions as numerals, times in words. */
function partText(p: SpeechPart, textOf: (id: ClipId) => string): string {
  if ('clip' in p) return textOf(p.clip)
  if ('num' in p) return formatNumber(p.num)
  // a number never wraps away from its unit ("88 cm", "45 kr.")
  if ('money' in p) return formatMoney(p.money.ore).replace(' ', '\u00a0')
  if ('measure' in p) return `${formatNumber(p.measure.value)}\u00a0${p.measure.unit}`
  if ('frac' in p) return `${p.frac.n}/${p.frac.d}`
  if ('clock' in p) return clockWords(p.clock.minutes, p.clock.style)
  return p.free
}

/**
 * A fact's words with its numbers as numerals: "Halvdelen af 8 er 4", "3 sider", "Fra 74 til 100 er
 * 26 kr.". Two values in a row are a list: "25, 50, 75", "1/5, 1/4, 1/3 og 1/2".
 */
export function phraseText(parts: readonly SpeechPart[], textOf: (id: ClipId) => string): string {
  let out = ''
  parts.forEach((p, i) => {
    const word = partText(p, textOf)
    if (!word) return
    const list = i > 0 && !('clip' in p) && !('clip' in parts[i - 1]) && !('free' in p)
    out += out ? `${list ? ',' : ''} ${word}` : word
  })
  return capital(out)
}

/** Three-digit sums and balances (3. klasse) get a smaller size, so "403 − 158 = 245" fits its card. */
export function isLongSum(terms: readonly Term[]): boolean {
  return terms.length > 5 || terms.reduce((n, t) => n + ('n' in t ? String(t.n).length : 0), 0) >= 8
}

function LearnedPicture({ face }: { face: LearnedFace }) {
  const speech = useSpeech()
  switch (face.t) {
    case 'eq':
      return <Equation terms={face.terms} size="answer" nowrap className={cx('tv-learned__eq', isLongSum(face.terms) && 'is-long')} />
    case 'number':
      return (
        <span className="tv-learned__number">
          {face.picture?.scene === 'objects' ? (
            <span className="tv-learned__pic">
              <ObjectsScene prompt={face.picture} seed={`learned:${face.n}`} />
            </span>
          ) : (
            <span className="tv-learned__heard" aria-hidden>
              <Icon name="ear" size={30} strokeWidth={2.4} />
            </span>
          )}
          <span className="tv-learned__n">{formatNumber(face.n)}</span>
        </span>
      )
    case 'clock':
      return (
        <span className="tv-learned__fact">
          <AnalogClock minutes={face.minutes} size={68} className="tv-learned__clock" />
          <SpokenText parts={[{ clock: { minutes: face.minutes, style: 'analog', form: 'end' } }]} text={clockText(face.minutes)} silent className="tv-learned__phrase" />
        </span>
      )
    case 'money':
      return (
        <span className="tv-learned__fact is-row">
          {isPiece(face.ore) && (
            <span className="tv-face__money tv-learned__money" style={pieceScale(52)}>
              <PieceArt piece={face.ore} />
            </span>
          )}
          <span className="tv-learned__n">{formatMoney(face.ore)}</span>
        </span>
      )
    case 'phrase':
      return (
        <span className={cx('tv-learned__fact', face.figure && 'is-row')}>
          {face.figure && <Shape2D shape={face.figure.shape} variant={face.figure.variant} mark={face.figure.mark} size={60} className="tv-learned__shape" />}
          <SpokenText parts={face.parts} text={phraseText(face.parts, speech.text)} silent className="tv-learned__phrase" />
        </span>
      )
    case 'shape':
      return <Shape2D shape={face.shape} variant={face.variant} size={64} className="tv-learned__shape" />
    case 'beads':
      return (
        <span className="tv-learned__beads" aria-hidden>
          {face.beads.map((b, i) => (
            <Bead key={i} tone={b} />
          ))}
        </span>
      )
    case 'label':
      return <SpokenText clip={face.clip} silent className="tv-learned__label" />
    case 'fact': {
      const text = phraseText(face.parts, speech.text)
      return (
        <span className="tv-learned__fact" data-learned-fact={face.pic?.t ?? 'words'}>
          {face.pic && <LearnedPicOf pic={face.pic} />}
          <SpokenText parts={face.parts} text={text} silent className={cx('tv-learned__phrase', text.length > 28 && 'is-long')} />
        </span>
      )
    }
    case 'none':
      return <Icon name="sparkle" size={44} />
  }
}

/** The small picture of a fact of 3. klasse: the dial, the coins, the point, the figure, the bars. */
function LearnedPicOf({ pic }: { pic: LearnedPic }) {
  switch (pic.t) {
    case 'dial':
      return (
        <span className="tv-learned__pics">
          <AnalogClock minutes={pic.minutes} size={68} sweep={pic.sweep} className="tv-learned__clock" />
          {pic.digital && <DigitalClock minutes={pic.minutes} size={96} className="tv-learned__digital" />}
        </span>
      )
    case 'digital':
      return <DigitalClock minutes={pic.minutes} size={110} className="tv-learned__digital" />
    case 'coins':
      return (
        <span className="tv-learned__coins">
          {pic.ore.map((piece, i) =>
            isPiece(piece) ? (
              <span key={i} className="tv-face__money tv-learned__money" style={pieceScale(34)}>
                <PieceArt piece={piece} />
              </span>
            ) : null,
          )}
        </span>
      )
    case 'coords':
      return <CoordGrid w={pic.w} h={pic.h} points={[{ x: pic.x, y: pic.y }]} size={96} className="tv-learned__grid" />
    case 'area':
      return <SquareGrid w={pic.w} h={pic.h} filled={pic.cells} cellPx={12} className="tv-learned__grid" />
    case 'fraction':
      return <FractionShape shape={pic.shape} parts={pic.parts} colored={pic.colored} size={64} className="tv-learned__shape" />
    case 'bars':
      return <FractionBars fracs={pic.fracs} size={120} className="tv-learned__bars" />
    case 'shapes':
      return (
        <span className="tv-learned__pics">
          {pic.items.map((it, i) => (
            <Shape2D key={i} shape={it.shape} variant={it.variant} size={44} className="tv-learned__shape" />
          ))}
        </span>
      )
  }
}

const BEAD_TONES = { red: MAT.apple, blue: MAT.fish, yellow: MAT.star } as const

/** A glass bead of a pattern (the same drawing as the pattern tasks' beads). */
function Bead({ tone }: { tone: string }) {
  const t = BEAD_TONES[tone as keyof typeof BEAD_TONES] ?? MAT.counterA
  return (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden>
      <path d={circle(24, 24, 20)} fill={t.fill} />
      <path d={ellipse(17, 16, 5, 3)} fill={HIGHLIGHT} />
      <path d={circle(24, 24, 20)} fill="none" stroke={t.outline} strokeWidth={3} />
    </svg>
  )
}

function StarBurst({ from, to }: { from: number; to: number }) {
  return (
    <div className="tv-starburst" data-stars={to} aria-hidden>
      {[1, 2, 3].map((n) => (
        <span key={n} className={cx('tv-starburst__star', n <= from && 'is-had', n > from && n <= to && 'is-new')} style={{ '--i': n - from } as CSSProperties}>
          <Icon name="star" size="100%" solid={n <= to} strokeWidth={2} />
        </span>
      ))}
    </div>
  )
}

// ─── The bridge, the fog, the hut ───────────────────────────────────────────

export function trialSpeech(step: CeremonyStep): SpeechPart[] {
  const parts = [...step.speech]
  const trial = first(step.rewards, 'trial')
  const things = finaleThings(step)
  if (trial?.finale && trial.passed) parts.push({ clip: WORLD_BY_ID[trial.trial as WorldId].nameClip })
  if (things.length > 0) parts.push({ clip: 's.ceremony.finale.things' }, ...things.map((i) => ({ clip: ITEM_BY_ID[i].nameClip })))
  if (trial && !trial.passed) parts.push({ clip: 's.reward.trial.best' }, { num: trial.best, form: 'mid' }, { clip: 's.reward.trial.planks' })
  const opened = first(step.rewards, 'opened')
  if (opened && trial?.passed) parts.push({ clip: openedClip(opened) })
  if (opened) for (const r of opened.regions) parts.push({ clip: REGION_BY_ID[r].nameClip })
  if (opened) for (const w of opened.worlds) parts.push({ clip: WORLD_BY_ID[w].nameClip })
  return parts
}

export function TrialScreen({ step }: { step: CeremonyStep }) {
  const speech = useSpeech()
  const trial = first(step.rewards, 'trial')
  const opened = first(step.rewards, 'opened')
  const lead = step.rewards[0]
  if (trial?.finale && trial.passed) return <FinaleParty step={step} world={trial.trial as WorldId} />
  return (
    <div className="tv-cer-trial" data-cer-trial="">
      {trial ? (
        <>
          <div className={cx('tv-cer-trial__bridge', trial.passed && 'is-held')}>
            <ProgressStones total={trial.total} done={trial.score} variant="planks" label={speech.text('s.ceremony.trial.score')} />
          </div>
          <SpokenText as="h1" clip={step.speech[0] && 'clip' in step.speech[0] ? step.speech[0].clip : 's.reward.trial.ready'} className="tv-cer__title" />
          {!trial.passed && (
            <SpokenText
              parts={[{ clip: 's.reward.trial.best' }, { num: trial.best, form: 'mid' }, { clip: 's.reward.trial.planks' }]}
              text={`${speech.text('s.reward.trial.best')}: ${trial.best} ${speech.text('s.reward.trial.planks')}`}
              className="tv-cer__line"
            />
          )}
        </>
      ) : (
        <>
          <span className="tv-cer__medallion" aria-hidden>
            <Icon name={lead.t === 'hut' ? 'hut' : lead.t === 'helpBridge' ? 'bridge' : lead.t === 'regionTier' ? 'sparkle' : 'map'} size="56%" strokeWidth={2.2} />
          </span>
          {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
        </>
      )}
      {opened && (opened.regions.length > 0 || opened.worlds.length > 0) && (
        <div className="tv-cer-opened">
          {opened.worlds.map((w, i) => (
            <SpokenText key={w} clip={WORLD_BY_ID[w].nameClip} className="tv-cer-opened__place is-world" style={{ '--i': i } as CSSProperties} />
          ))}
          {opened.regions.map((r, i) => (
            <SpokenText key={r} clip={REGION_BY_ID[r].nameClip} className="tv-cer-opened__place" style={{ '--i': opened.worlds.length + i } as CSSProperties} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── A world finale passed: the party ───────────────────────────────────────

/** Confetti pieces: a fixed spread (no randomness), each with its own lane, delay and tone. */
const CONFETTI = Array.from({ length: 22 }, (_, i) => ({ x: (i * 37) % 100, delay: (i % 7) * 110, tone: i % 4, turn: i % 2 ? 1 : -1 }))

/** Every finale thing on the buddy at once, then to the wardrobe; back here, the next screen follows. */
function tryOnAll(items: readonly ItemId[]): void {
  if (items.length === 0) return
  const meta = useMeta.getState()
  const uid = useProfile.getState().profile?.buddyUid ?? null
  if (uid) for (const item of items) meta.wear(uid, item)
  if (meta.ceremony) setProgress(meta.ceremony, progressOf(meta.ceremony) + 1)
  useNav.getState().go({ id: 'wardrobe', item: items[0], ...(uid ? { uid } : {}) })
}

/**
 * A world finale passed (QA2 P2-7): its own party, not a trial's bridge — the trophy, the world's
 * animals cheering under confetti, and every thing the finale gave, with pictures and "Prøv dem på".
 */
export function FinaleParty({ step, world }: { step: CeremonyStep; world: WorldId }) {
  const things = finaleThings(step)
  const drawn = things.filter(isItemDrawn)
  const opened = first(step.rewards, 'opened')
  return (
    <div className="tv-cer-finale" data-cer-finale={world}>
      <span className="tv-cer-finale__confetti" aria-hidden>
        {CONFETTI.map((c, i) => (
          <span key={i} className={cx('tv-cer-finale__bit', `is-t${c.tone}`)} style={{ '--x': `${c.x}%`, '--d': `${c.delay}ms`, '--turn': c.turn } as CSSProperties} />
        ))}
      </span>
      <span className="tv-cer-finale__trophy" aria-hidden>
        <Icon name="trophy" size="58%" solid strokeWidth={2} />
      </span>
      <SpokenText as="h1" clip="s.reward.finale.passed" className="tv-cer__title" />
      <SpokenText clip={WORLD_BY_ID[world].nameClip} className="tv-cer-finale__world" />
      <div className="tv-cer-finale__animals" aria-hidden>
        {speciesOfWorld(world).map((s, i) => (
          <span key={s} className="tv-cer-finale__animal" style={{ '--i': i } as CSSProperties}>
            <AnimalPicture species={s} size={78} crop="fit" mood="cheer" />
          </span>
        ))}
      </div>
      {things.length > 0 && (
        <div className="tv-cer-finale__things" onClick={(e) => e.stopPropagation()} data-finale-things={things.length}>
          <SpokenText as="h2" clip="s.ceremony.finale.things" className="tv-cer-finale__head" />
          <ul className="tv-cer-finale__list">
            {things.map((item, i) => (
              <li key={item} className="tv-cer-finale__thing" style={{ '--i': i } as CSSProperties} data-finale-thing={item}>
                <ItemPicture item={item} size={92} className="tv-cer-finale__pic" />
                <SpokenText clip={ITEM_BY_ID[item].nameClip} className="tv-cer-finale__name" />
              </li>
            ))}
          </ul>
          {drawn.length > 0 && (
            <Button clip={drawn.length > 1 ? 's.ceremony.tryOnAll' : 's.ceremony.tryOn'} icon="shirt" variant="star" size="md" onClick={() => tryOnAll(drawn)} data-try-on-all="" />
          )}
        </div>
      )}
      {opened && (opened.regions.length > 0 || opened.worlds.length > 0) && (
        <div className="tv-cer-opened">
          {opened.worlds.map((w, i) => (
            <SpokenText key={w} clip={WORLD_BY_ID[w].nameClip} className="tv-cer-opened__place is-world" style={{ '--i': i } as CSSProperties} />
          ))}
          {opened.regions.map((r, i) => (
            <SpokenText key={r} clip={REGION_BY_ID[r].nameClip} className="tv-cer-opened__place" style={{ '--i': opened.worlds.length + i } as CSSProperties} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── A medal ────────────────────────────────────────────────────────────────

export function medalSpeech(step: CeremonyStep): SpeechPart[] {
  const medal = first(step.rewards, 'medal')
  const c = medal ? canDoClip(medal.skill) : null
  return [...step.speech, ...(c ? [{ clip: c }] : [])]
}

export function MedalScreen({ step }: { step: CeremonyStep }) {
  const medal = first(step.rewards, 'medal')
  const tier = medal?.medal ?? 'gold'
  const c = medal ? canDoClip(medal.skill) : null
  return (
    <div className="tv-cer-medal" data-cer-medal={tier}>
      <MedalArt tier={tier} />
      {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
      {c && <SpokenText clip={c} className="tv-cer__line" />}
    </div>
  )
}

/**
 * A medal on its ribbon: two ribbon tails behind a round disc with a raised rim and a star (review
 * r1 P3-7: not a flat blob). The tier's colours come from the medal tokens in ceremony.css.
 */
function MedalArt({ tier }: { tier: string }) {
  const star = 'M60 66l7.1 14.4 15.9 2.3-11.5 11.2 2.7 15.8L60 102.2l-14.2 7.5 2.7-15.8L37 82.7l15.9-2.3z'
  return (
    <span className={cx('tv-medal', `is-${tier}`)} aria-hidden>
      <svg viewBox="0 0 120 150" className="tv-medal__svg">
        <path className="tv-medal__tail is-left" d="M30 6h26l14 52H44z" />
        <path className="tv-medal__tail is-right" d="M64 6h26L76 58H50z" />
        <path className="tv-medal__stripe" d="M38 6h10l13 48h-10z" />
        <circle className="tv-medal__rim" cx="60" cy="90" r="46" />
        <circle className="tv-medal__disc" cx="60" cy="90" r="36" />
        <path className="tv-medal__star" d={star} />
        <path className="tv-medal__shine" d="M33 74a32 32 0 0 1 22-18" />
      </svg>
    </span>
  )
}

// ─── A new level, and its thing ─────────────────────────────────────────────

/** The things that came with this level: the queue puts them on the level-up step itself. */
export function levelItems(step: CeremonyStep): ItemId[] {
  return step.rewards.filter((r): r is Of<'item'> => r.t === 'item').map((r) => r.item)
}

export function levelSpeech(step: CeremonyStep): SpeechPart[] {
  const up = first(step.rewards, 'levelUp')
  if (!up) return step.speech
  const parts: SpeechPart[] = [...step.speech, { clip: 's.map.level' }, { num: up.level, form: 'end' }]
  if (up.title) {
    const clip = `s.reward.title.${up.level}`
    parts.push({ clip: 's.reward.title.new' }, { clip })
  }
  for (const item of levelItems(step)) parts.push({ clip: 's.reward.item.new' }, { clip: ITEM_BY_ID[item].nameClip })
  return parts
}

export function LevelUpScreen({ step, onTryOn }: { step: CeremonyStep; onTryOn(item: ItemId): void }) {
  const speech = useSpeech()
  const up = first(step.rewards, 'levelUp')
  if (!up) return null
  const items = levelItems(step)
  return (
    <div className="tv-cer-level" data-cer-level={up.level}>
      <span className="tv-levelbadge" aria-hidden>
        <Icon name="crown" size={34} solid strokeWidth={2} className="tv-levelbadge__crown" />
        <span className="tv-levelbadge__n">{up.level}</span>
      </span>
      <SpokenText as="h1" clip="s.reward.level" className="tv-cer__title" />
      {up.title && (
        <SpokenText
          parts={[{ clip: 's.reward.title.new' }, { clip: `s.reward.title.${up.level}` }]}
          text={`${speech.text('s.reward.title.new')} ${speech.text(`s.reward.title.${up.level}`)}`}
          className="tv-cer__line"
        />
      )}
      {items.map((item) => (
        <div key={item} className="tv-cer-thing" onClick={(e) => e.stopPropagation()}>
          <ItemPicture item={item} size={120} className="tv-cer-thing__pic" />
          <SpokenText clip={ITEM_BY_ID[item].nameClip} className="tv-cer-thing__name" />
          {/* a thing without a drawing is a gift for now: nothing to see on the animal yet */}
          {isItemDrawn(item) && <Button clip="s.ceremony.tryOn" icon="shirt" variant="star" size="md" onClick={() => onTryOn(item)} data-try-on={item} />}
        </div>
      ))}
    </div>
  )
}

// ─── Growth ─────────────────────────────────────────────────────────────────

export function GrowthScreen({ step }: { step: CeremonyStep }) {
  const profile = useProfile((s) => s.profile)
  const lead = step.rewards[0]
  const uid = lead && 'uid' in lead ? lead.uid : profile?.buddyUid
  const animal = profile?.animals.find((a) => a.uid === uid) ?? null
  return (
    <div className="tv-cer-growth" data-cer-growth="">
      <div className="tv-cer-growth__buddy">
        <Buddy animal={animal} mood="cheer" />
      </div>
      {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
    </div>
  )
}

// ─── A thing, a friend, a trophy, a stamp; picking a magic animal ──────────

/**
 * What a new animal is called on its screen: a friend of a species the child has, in a breed the
 * child has not met yet, is "En ny race!" (review r1 P3-2), not "En ny farve!".
 */
export function animalTitle(step: CeremonyStep, animals: readonly Animal[]): ClipId {
  const r = step.rewards[0]
  const said = step.speech[0] && 'clip' in step.speech[0] ? step.speech[0].clip : 's.reward.animal.friend'
  if (r?.t !== 'animal' || said !== 's.reward.animal.color') return said
  const a = r.animal
  return animals.some((o) => o.uid !== a.uid && o.species === a.species && o.breed === a.breed) ? said : 's.reward.animal.breed'
}

export function thingSpeech(step: CeremonyStep, animals: readonly Animal[] = []): SpeechPart[] {
  const r = step.rewards[0]
  const parts = [...step.speech]
  if (r?.t === 'animal') parts[0] = { clip: animalTitle(step, animals) }
  if (r?.t === 'item') parts.push({ clip: ITEM_BY_ID[r.item].nameClip }, ...medalReason(r.source))
  if (r?.t === 'animal') parts.push({ clip: `name.species.${r.animal.species}` })
  if (r?.t === 'trophy') parts.push({ clip: `name.trophy.${r.id}` })
  return parts
}

export interface ThingScreenProps {
  step: CeremonyStep
  /** The parent's "Næste": an open choice is left for later, anything else moves on. */
  nextSignal: number
  onAdvance(): void
  onTryOn(item: ItemId): void
}

const NO_ANIMALS: readonly Animal[] = []

export function ThingScreen({ step, nextSignal, onAdvance, onTryOn }: ThingScreenProps) {
  const r = step.rewards[0]
  const signal = useRef(nextSignal)
  const [picked, setPicked] = useState<Animal | null>(null)
  const animals = useProfile((s) => s.profile?.animals ?? NO_ANIMALS)
  useEffect(() => {
    if (nextSignal === signal.current) return
    signal.current = nextSignal
    onAdvance()
  }, [nextSignal, onAdvance])

  if (!r) return null
  if (r.t === 'item') {
    return (
      <div className="tv-cer-thing is-big" data-cer-thing="item" onClick={(e) => e.stopPropagation()}>
        <span className="tv-cer-thing__rays" aria-hidden />
        <ItemPicture item={r.item} size={150} className="tv-cer-thing__pic" />
        {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
        <SpokenText clip={ITEM_BY_ID[r.item].nameClip} className="tv-cer-thing__name" />
        {r.source.kind === 'medal' && <MedalReason source={r.source} />}
        {isItemDrawn(r.item) && <Button clip="s.ceremony.tryOn" icon="shirt" variant="star" size="md" onClick={() => onTryOn(r.item)} data-try-on={r.item} />}
      </div>
    )
  }
  if (r.t === 'animal' || picked) {
    const animal = picked ?? (r.t === 'animal' ? r.animal : null)!
    return <NewFriend animal={animal} title={picked ? 's.reward.animal.magic' : animalTitle(step, animals)} />
  }
  if (r.t === 'choice') {
    return (
      <PickAnimal
        title={r.kind === 'gold' ? 's.reward.gold.choose' : 's.reward.rainbow.choose'}
        options={r.options}
        onPick={(species) => {
          const ok = r.kind === 'gold' ? useMeta.getState().chooseGolden(species) : useMeta.getState().chooseRainbow(species)
          const got = ok ? useMeta.getState().lastAction.find((x): x is Of<'animal'> => x.t === 'animal') : undefined
          if (got) setPicked(got.animal)
        }}
      />
    )
  }
  const icon = r.t === 'trophy' ? 'trophy' : r.t === 'goal' ? 'stamp' : 'sparkle'
  return (
    <div className="tv-cer-thing" data-cer-thing={r.t}>
      <span className="tv-cer__medallion is-star" aria-hidden>
        <Icon name={icon} size="56%" strokeWidth={2.2} solid={r.t !== 'goal'} />
      </span>
      {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
      {r.t === 'trophy' && <SpokenText clip={`name.trophy.${r.id}`} className="tv-cer__line" />}
    </div>
  )
}

/**
 * What a thing from medals is for ("Den får du, når du har fået 2 sølvmedaljer"). It waits for its
 * drawing (progression.ts, dueItems), so it may come rounds after the medal that earned it; the
 * line says why it comes now (review app-w2-r1 P2-6).
 */
const medalReason = (source: ItemSource): SpeechPart[] => (source.kind === 'medal' ? howToGet(source) : [])

function MedalReason({ source }: { source: ItemSource }) {
  const speech = useSpeech()
  const parts = medalReason(source)
  return <SpokenText parts={parts} text={lineText(parts, speech.text)} className="tv-cer__line" />
}

/** A new friend: the animal, its species and its name to choose. */
export function NewFriend({ animal, title }: { animal: Animal; title: ClipId }) {
  return (
    <div className="tv-cer-friend" data-cer-friend={animal.uid}>
      <div className="tv-cer-friend__pic">
        <AnimalPicture animal={animal} size={150} crop="fit" mood="happy" />
      </div>
      <SpokenText as="h1" clip={title} className="tv-cer__title" />
      <SpokenText clip={`name.species.${animal.species}`} className="tv-cer__line" />
      <NameAnimal animal={animal} />
    </div>
  )
}

export function PickAnimal({ title, options, onPick }: { title: ClipId; options: readonly SpeciesId[]; onPick(species: SpeciesId): void }) {
  return (
    <div className="tv-cer-pick" onClick={(e) => e.stopPropagation()} data-cer-pick="">
      <SpokenText as="h1" clip={title} className="tv-cer__title" />
      <SpokenText clip="s.ceremony.choose" className="tv-cer__line" />
      <div className="tv-cer-pick__grid">
        {options.map((s) => (
          <PickOption key={s} species={s} onPick={() => onPick(s)} />
        ))}
      </div>
    </div>
  )
}

function PickOption({ species, onPick }: { species: SpeciesId; onPick(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className="tv-cer-pick__opt tv-touch"
      aria-label={speech.text(`name.species.${species}`)}
      onClick={() => {
        speech.speak([{ clip: `name.species.${species}` }])
        onPick()
      }}
      data-pick={species}
      {...pressProps}
    >
      <AnimalPicture species={species} size={88} crop="head" mood="happy" />
      <SpokenText clip={`name.species.${species}`} silent className="tv-cer-pick__name" />
    </button>
  )
}
