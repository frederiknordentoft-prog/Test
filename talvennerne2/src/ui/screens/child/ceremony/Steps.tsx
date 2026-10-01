// The full-screen moments of the end of a round (SPEC §5.8, spildesign §7.2): "Det lærte du" with
// the stars and the count-up, the bridge, a medal, a new level with its thing and "Prøv den på",
// growth, a new thing or friend (with its name), and the choice of a golden or rainbow animal. Each
// screen says what it shows; the screen around them reads it aloud and moves on.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ITEM_BY_ID } from '../../../../content/catalog'
import { REGION_BY_ID, WORLD_BY_ID } from '../../../../content/curriculum'
import type { Animal, ClipId, ItemId, SpeciesId, SpeechPart } from '../../../../engine/types'
import type { CeremonyStep } from '../../../../meta/ceremonyQueue'
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
import { Buddy } from '../round/Buddy'
import { AnimalPicture, ItemPicture } from '../map/art'
import { goalSpeech, lineText } from '../map/words'
import { canDoClip, learnedItems } from './describe'
import { NameAnimal } from './NameAnimal'

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

export function summarySpeech(steps: readonly CeremonyStep[]): SpeechPart[] {
  const learned = steps.find((s) => s.kind === 'learned')
  const r = learned ? first(learned.rewards, 'learned') : undefined
  const parts: SpeechPart[] = [{ clip: 's.reward.learned' }]
  if (r) parts.push(...(learnedItems(r)[0]?.speech ?? []))
  const stars = steps.find((s) => s.kind === 'stars')
  if (stars) parts.push(...stars.speech)
  return parts
}

export function SummaryScreen({ steps, rewards }: { steps: readonly CeremonyStep[]; rewards: readonly Reward[] }) {
  const speech = useSpeech()
  const learned = steps.find((s) => s.kind === 'learned')
  const r = learned ? first(learned.rewards, 'learned') : undefined
  const items = r ? learnedItems(r) : []
  const starsStep = steps.find((s) => s.kind === 'stars')
  const stars = starsStep ? first(starsStep.rewards, 'stars') : undefined
  const perler = useCountUp(totalPerler(rewards))
  const xp = useCountUp(totalXp(rewards), 1100)
  const showTally = steps.some((s) => s.kind === 'tally') || totalPerler(rewards) > 0
  return (
    <div className="tv-cer-summary" data-cer-summary="">
      <SpokenText as="h1" clip="s.reward.learned" className="tv-cer__title" />
      <ul className="tv-learned">
        {items.map((item, i) => (
          <li key={item.key} className="tv-learned__item" style={{ '--i': i } as CSSProperties}>
            <LearnedCard item={item} />
          </li>
        ))}
      </ul>
      {r?.next && <NextGoal parts={goalSpeech(r.next)} />}
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

/** One thing learned: the fact (or what the child can now) and how well it sits; a tap reads it. */
function LearnedCard({ item }: { item: ReturnType<typeof learnedItems>[number] }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className="tv-learned__card tv-touch"
      aria-label={lineText(item.speech, speech.text)}
      onClick={(e) => {
        e.stopPropagation()
        speech.speak(item.speech)
      }}
      data-learned={item.key}
      {...pressProps}
    >
      <LearnedFace terms={item.terms} canDo={item.canDo} />
      <SpokenText clip={item.badge} silent className="tv-learned__badge" />
    </button>
  )
}

function LearnedFace({ terms, canDo }: { terms: ReturnType<typeof learnedItems>[number]['terms']; canDo: ClipId | null }) {
  if (terms) return <Equation terms={terms} size="answer" nowrap className="tv-learned__eq" />
  if (canDo) return <SpokenText clip={canDo} silent className="tv-learned__cando" />
  return <Icon name="sparkle" size={44} />
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
  if (trial && !trial.passed) parts.push({ clip: 's.reward.trial.best' }, { num: trial.best, form: 'mid' }, { clip: 's.reward.trial.planks' })
  const opened = first(step.rewards, 'opened')
  if (opened && trial?.passed) parts.push({ clip: opened.worlds.length > 0 ? 's.reward.world.open' : 's.reward.region.open' })
  if (opened) for (const r of opened.regions) parts.push({ clip: REGION_BY_ID[r].nameClip })
  if (opened) for (const w of opened.worlds) parts.push({ clip: WORLD_BY_ID[w].nameClip })
  return parts
}

export function TrialScreen({ step }: { step: CeremonyStep }) {
  const speech = useSpeech()
  const trial = first(step.rewards, 'trial')
  const opened = first(step.rewards, 'opened')
  const lead = step.rewards[0]
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
          {opened.worlds.map((w) => (
            <SpokenText key={w} clip={WORLD_BY_ID[w].nameClip} className="tv-cer-opened__place is-world" />
          ))}
          {opened.regions.map((r) => (
            <SpokenText key={r} clip={REGION_BY_ID[r].nameClip} className="tv-cer-opened__place" />
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
      <span className={cx('tv-medal', `is-${tier}`)} aria-hidden>
        <Icon name="medal" size="62%" strokeWidth={2} solid />
      </span>
      {step.speech[0] && 'clip' in step.speech[0] && <SpokenText as="h1" clip={step.speech[0].clip} className="tv-cer__title" />}
      {c && <SpokenText clip={c} className="tv-cer__line" />}
    </div>
  )
}

// ─── A new level, and its thing ─────────────────────────────────────────────

/** Things earned with this level-up (anywhere in the plan, so the card shows what came with it). */
export function levelItems(level: number, all: readonly Reward[]): ItemId[] {
  return all.filter((r): r is Of<'item'> => r.t === 'item' && r.source.kind === 'level' && r.source.level <= level).map((r) => r.item)
}

export function levelSpeech(step: CeremonyStep, all: readonly Reward[]): SpeechPart[] {
  const up = first(step.rewards, 'levelUp')
  if (!up) return step.speech
  const parts: SpeechPart[] = [...step.speech, { clip: 's.map.level' }, { num: up.level, form: 'end' }]
  if (up.title) {
    const clip = `s.reward.title.${up.level}`
    parts.push({ clip: 's.reward.title.new' }, { clip })
  }
  for (const item of levelItems(up.level, all)) parts.push({ clip: 's.reward.item.new' }, { clip: ITEM_BY_ID[item].nameClip })
  return parts
}

export function LevelUpScreen({ step, all, onTryOn }: { step: CeremonyStep; all: readonly Reward[]; onTryOn(item: ItemId): void }) {
  const speech = useSpeech()
  const up = first(step.rewards, 'levelUp')
  if (!up) return null
  const items = levelItems(up.level, all)
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
          <Button clip="s.ceremony.tryOn" icon="shirt" variant="star" size="md" onClick={() => onTryOn(item)} data-try-on={item} />
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

export function thingSpeech(step: CeremonyStep): SpeechPart[] {
  const r = step.rewards[0]
  const parts = [...step.speech]
  if (r?.t === 'item') parts.push({ clip: ITEM_BY_ID[r.item].nameClip })
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

export function ThingScreen({ step, nextSignal, onAdvance, onTryOn }: ThingScreenProps) {
  const r = step.rewards[0]
  const signal = useRef(nextSignal)
  const [picked, setPicked] = useState<Animal | null>(null)
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
        <Button clip="s.ceremony.tryOn" icon="shirt" variant="star" size="md" onClick={() => onTryOn(r.item)} data-try-on={r.item} />
      </div>
    )
  }
  if (r.t === 'animal' || picked) {
    const animal = picked ?? (r.t === 'animal' ? r.animal : null)!
    return <NewFriend animal={animal} title={picked ? 's.reward.animal.magic' : (step.speech[0] && 'clip' in step.speech[0] ? step.speech[0].clip : 's.reward.animal.friend')} />
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
