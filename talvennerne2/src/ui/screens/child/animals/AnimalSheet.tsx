// An animal's card in Dyrehaven (SPEC §6.3): its name (read aloud), what kind of animal it is, the
// friendship (level 1–10 as hearts, the way to the next level as a meter without numbers), the tricks
// it has learned (tap one and it shows it), the forms it has reached (baby, young, big, star — the
// child picks which one shows), and the ways on: take it along on the rounds, a new name, dress it.
// No hunger, no care, no guilt: friendship only ever grows.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Animal, Mood } from '../../../../engine/types'
import type { Outfit, SpeciesDef } from '../../../../art/rig/types'
import { playSfx } from '../../../../audio/sfx'
import { useMeta } from '../../../../state/useMeta'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import type { IconName } from '../../../design/icons'
import { Meter } from '../../../design/Meter'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { isCalm } from '../../../design/motion'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { Figure, lookOf, seedOf } from './art'
import { animalFacts, formLook, kindClips, lineText, nameParts, type Form, type TrickId } from './model'
import { Naming } from './Naming'

const TRICK_ICON: Readonly<Record<TrickId, IconName>> = {
  hop: 'chevronUp',
  cheer: 'star',
  spin: 'retry',
  call: 'soundOn',
  signature: 'sparkle',
  dance: 'heart',
}

/** How a trick looks: the rig's mood, an extra whole-figure move, and how long it lasts. */
const TRICK_SHOW: Readonly<Record<TrickId, { mood: Mood; move?: 'spin' | 'dance' | 'call' | 'shine'; ms: number }>> = {
  hop: { mood: 'happy', ms: 1700 },
  cheer: { mood: 'cheer', ms: 2000 },
  spin: { mood: 'happy', move: 'spin', ms: 1300 },
  call: { mood: 'happy', move: 'call', ms: 1400 },
  signature: { mood: 'wave', move: 'shine', ms: 2000 },
  dance: { mood: 'happy', move: 'dance', ms: 2400 },
}

const FORM_CLIP: Readonly<Record<string, string>> = { 1: 's.zoo.form.1', 2: 's.zoo.form.2', 3: 's.zoo.form.3', star: 's.zoo.form.star' }

export interface AnimalSheetProps {
  animal: Animal | null
  open: boolean
  isBuddy: boolean
  def: SpeciesDef | undefined
  outfit: Outfit | undefined
  onClose(): void
  onDress(uid: string): void
}

export function AnimalSheet({ animal, open, isBuddy, def, outfit, onClose, onDress }: AnimalSheetProps) {
  // the last animal stays drawn while the sheet slides away
  const last = useRef<Animal | null>(animal)
  if (animal) last.current = animal
  const shown = animal ?? last.current
  return (
    <Sheet open={open && !!shown} onClose={onClose} height="tall" className="zoo-sheet">
      {shown && <AnimalCard key={shown.uid} animal={shown} live={open && !!animal} isBuddy={isBuddy} def={def} outfit={outfit} onDress={onDress} />}
    </Sheet>
  )
}

function AnimalCard({ animal, live, isBuddy, def, outfit, onDress }: {
  animal: Animal
  /** False while the sheet slides away: the rig turns still, so the meadow can take its place in the plan. */
  live: boolean
  isBuddy: boolean
  def: SpeciesDef | undefined
  outfit: Outfit | undefined
  onDress(uid: string): void
}) {
  const speech = useSpeech()
  const facts = animalFacts(animal)
  const [trick, setTrick] = useState<TrickId | null>(null)
  const [renaming, setRenaming] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const kind = kindClips(animal).map((clip) => ({ clip }))
  const show = trick ? TRICK_SHOW[trick] : null

  const perform = (id: TrickId) => {
    const t = TRICK_SHOW[id]
    window.clearTimeout(timer.current)
    setTrick(null)
    // a new trick restarts its moves
    requestAnimationFrame(() => setTrick(id))
    timer.current = window.setTimeout(() => setTrick(null), t.ms)
    speech.speak([{ clip: `s.zoo.trick.${id}` }])
    if (id === 'call') playSfx('ven')
    else if (id === 'signature') playSfx('glimmer')
    else playSfx('boble')
  }

  const levelParts = [{ clip: 's.zoo.friendship.level' }, { num: facts.level, form: 'end' as const }]

  return (
    <div className="zoo-card" data-animal-card={animal.uid}>
      <header className="zoo-card__head">
        <div className={cx('zoo-card__stage', show?.move && !isCalm() && `is-${show.move}`)} data-trick={trick ?? undefined}>
          <Figure look={lookOf(animal)} def={def} outfit={outfit} animated={live} mood={show?.mood ?? 'happy'} seed={seedOf(animal.uid)} px={220} crop="fit" />
        </div>
        <div className="zoo-card__who">
          <SpokenText as="h2" parts={nameParts(animal.name)} text={animal.name} className="zoo-card__name" />
          <SpokenText parts={kind} text={lineText(kind, speech.text, ', ')} className="zoo-card__kind" />
          <div className="zoo-card__badges">
            {isBuddy && (
              <span className="zoo-badge zoo-badge--buddy" data-buddy="">
                <Icon name="heart" solid size={22} />
                <SpokenText clip="s.zoo.buddy.is" />
              </span>
            )}
            {animal.star && (
              <span className="zoo-badge zoo-badge--star">
                <Icon name="star" solid size={22} />
                <SpokenText clip="s.zoo.bestFriend" />
              </span>
            )}
          </div>
        </div>
      </header>
      {!isBuddy && (
        <Button
          clip="s.zoo.buddy.choose"
          icon="heart"
          size="md"
          variant="good"
          block
          silent
          onClick={() => {
            if (useMeta.getState().setBuddy(animal.uid)) {
              speech.speak([{ clip: 's.zoo.buddy.now' }])
              playSfx('ven')
            }
          }}
          data-set-buddy=""
        />
      )}

      <section className="zoo-card__sec" aria-label={speech.text('s.zoo.friendship')}>
        <SpokenText as="h3" clip="s.zoo.friendship" className="zoo-h3" />
        <button type="button" className="zoo-hearts tv-touch" aria-label={lineText(levelParts, speech.text)} onClick={() => speech.speak(levelParts)} data-level={facts.level}>
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={cx('zoo-hearts__h', i < facts.level && 'is-on')} style={{ '--i': i } as CSSProperties}>
              <Icon name="heart" solid={i < facts.level} size={22} strokeWidth={2.2} />
            </span>
          ))}
        </button>
        <Meter kind="heart" value={facts.progress} clip="s.zoo.friendship.how" size="md" className="zoo-meter-wide" />
      </section>

      <section className="zoo-card__sec">
        <SpokenText as="h3" clip="s.zoo.tricks" className="zoo-h3" />
        <div className="zoo-chips">
          {facts.tricks.map(({ id, unlocked }) => (
            <Chip
              key={id}
              icon={unlocked ? TRICK_ICON[id] : 'lock'}
              clip={`s.zoo.trick.${id}`}
              on={trick === id}
              locked={!unlocked}
              onTap={() => (unlocked ? perform(id) : speech.speak([{ clip: `s.zoo.trick.${id}` }, { clip: 's.zoo.trick.locked' }]))}
              data={{ 'data-trick-chip': id }}
            />
          ))}
        </div>
      </section>

      <section className="zoo-card__sec">
        <SpokenText as="h3" clip="s.zoo.forms" className="zoo-h3" />
        <div className="zoo-forms">
          {facts.forms.map(({ form, reached, shown }) => (
            <FormChoice key={String(form)} animal={animal} form={form} reached={reached} shown={shown} def={def} />
          ))}
        </div>
      </section>

      <section className="zoo-card__actions">
        <Button clip="s.zoo.rename" icon="pencil" size="md" variant="secondary" onClick={() => setRenaming((r) => !r)} data-rename="" />
        <Button clip="s.zoo.dress" icon="shirt" size="md" variant="primary" onClick={() => onDress(animal.uid)} data-dress="" />
      </section>
      {renaming && <Naming animal={animal} onNamed={() => setRenaming(false)} />}
    </div>
  )
}

function Chip({ icon, clip, on, locked, onTap, data }: { icon: IconName; clip: string; on: boolean; locked: boolean; onTap(): void; data?: Record<string, string> }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <button type="button" className={cx('zoo-chip tv-touch', on && 'is-on', locked && 'is-locked')} aria-label={speech.text(clip)} onClick={onTap} {...data} {...pressProps}>
      <Icon name={icon} size={24} solid={!locked} strokeWidth={2.3} />
      <SpokenText clip={clip} silent className="zoo-chip__label" />
    </button>
  )
}

function FormChoice({ animal, form, reached, shown, def }: { animal: Animal; form: Form; reached: boolean; shown: boolean; def: SpeciesDef | undefined }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const clip = FORM_CLIP[String(form)]
  const look = { ...lookOf(animal), ...formLook(form) }
  return (
    <button
      type="button"
      className={cx('zoo-form tv-touch', shown && 'is-on', !reached && 'is-locked')}
      aria-pressed={shown}
      aria-label={speech.text(clip)}
      onClick={() => {
        if (!reached) {
          speech.speak([{ clip }, { clip: 's.zoo.form.locked' }])
          return
        }
        if (!shown) useMeta.getState().setShownForm(animal.uid, form)
        speech.speak([{ clip }])
      }}
      data-form={String(form)}
      {...pressProps}
    >
      <Figure look={look} def={def} silhouette={!reached} crop="fit" px={72} mood={shown ? 'happy' : 'idle'} className="zoo-form__fig" />
      <SpokenText clip={clip} silent className="zoo-form__label" />
      {!reached && (
        <span className="zoo-form__lock" aria-hidden>
          <Icon name="lock" size={18} strokeWidth={2.4} />
        </span>
      )}
    </button>
  )
}
