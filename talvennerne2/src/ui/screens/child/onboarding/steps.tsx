// The four onboarding steps' bodies (SPEC §8): the child's name, the first friend's egg, the friend's
// name and the grade. OnboardingScreen owns the state and Pip's words; these only draw and report.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { NAME_MAX_LENGTH, cleanAnimalName, nameClip } from '../../../../content/names'
import type { Animal, ClipId, Grade, SpeciesId } from '../../../../engine/types'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { AnimalArt, lookOf, type AnimalLook } from './art'
import { HatchEgg, PeekEgg } from './Egg'

/** A big choice (a name, a grade): pressed feedback, selected and "being read" states. */
function Choice({ selected, speaking, className, onClick, children, ...data }: {
  selected?: boolean
  speaking?: boolean
  className?: string
  onClick: () => void
  children: ReactNode
  [data: `data-${string}`]: string | undefined
}) {
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className={cx('tv-choice', selected && 'is-selected', speaking && 'is-speaking', 'tv-touch', className)}
      aria-pressed={selected}
      onClick={onClick}
      {...pressProps}
      {...data}
    >
      <span className="tv-choice__face">{children}</span>
    </button>
  )
}

// ─── 1. The child's name ──────────────────────────────────────────────────────

export function NameStep({ name, placeholder, onName, onDone }: { name: string; placeholder: string; onName: (n: string) => void; onDone: () => void }) {
  const speech = useSpeech()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onDone()
  }
  return (
    <form className="tv-onb__stage tv-onb__stage--name" onSubmit={submit}>
      <input
        className="tv-onb__input"
        type="text"
        value={name}
        placeholder={placeholder}
        maxLength={20}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="next"
        aria-label={speech.text('s.onb.name.ask')}
        onChange={(e) => onName(e.target.value)}
        data-name-input=""
      />
      <SpokenText as="p" clip="s.onb.name.hint" className="tv-onb__hint" />
    </form>
  )
}

// ─── 2. The first friend's egg ────────────────────────────────────────────────

/**
 * The starters' eggs (onboarding/flow.ts offeredStarters: only drawn species), each with the baby
 * that will hatch from it in its own breed and colour (`looks`).
 */
export function EggChoice({ help, starters, looks, onPick }: {
  help: boolean
  starters: readonly SpeciesId[]
  looks: Partial<Record<SpeciesId, AnimalLook>>
  onPick: (s: SpeciesId) => void
}) {
  const speech = useSpeech()
  return (
    <div className={cx('tv-onb__stage tv-eggs', help && 'is-help')} data-count={starters.length}>
      {starters.map((species) => (
        <EggButton key={species} species={species} look={looks[species]} label={speech.text(`name.baby.${species}`)} onPick={() => onPick(species)} />
      ))}
    </div>
  )
}

function EggButton({ species, look, label, onPick }: { species: SpeciesId; look?: AnimalLook; label: string; onPick: () => void }) {
  const { pressProps } = usePress()
  return (
    <button
      type="button"
      className="tv-eggbtn tv-touch"
      onClick={onPick}
      aria-label={label}
      data-species={species}
      data-breed={look?.breed}
      data-colorway={look?.colorway}
      {...pressProps}
    >
      <span className="tv-eggbtn__egg">
        <PeekEgg species={species} look={look} />
      </span>
      <SpokenText silent clip={`name.baby.${species}`} className="tv-eggbtn__label" />
    </button>
  )
}

export function EggHatch({ species, cracks, taps, friend, help, label, onTap }: {
  species: SpeciesId
  cracks: 0 | 1 | 2
  taps: number
  friend: Animal | null
  help: boolean
  label: string
  onTap: () => void
}) {
  return (
    <div className="tv-onb__stage">
      <button
        type="button"
        className={cx('tv-hatchbtn', 'tv-touch', friend && 'is-hatched')}
        onClick={onTap}
        aria-label={label}
        aria-disabled={friend ? true : undefined}
        data-hatch={friend ? 'done' : cracks}
      >
        <HatchEgg species={species} cracks={cracks} split={!!friend} tapKey={taps}>
          {friend && <AnimalArt look={lookOf(friend)} mood="cheer" />}
        </HatchEgg>
        {help && !friend && (
          <span className="tv-onb__hand" aria-hidden>
            <Icon name="hand" size={64} strokeWidth={2.2} />
          </span>
        )}
      </button>
    </div>
  )
}

// ─── 3. The friend's name ────────────────────────────────────────────────────

export function FriendStep({ friend, names, chosen, custom, reading, onChoose, onWrite }: {
  friend: Animal
  /** The six suggestions. */
  names: readonly string[]
  chosen: string
  /** A name the child typed (shown as its own choice). */
  custom: string | null
  /** Index of the suggestion being read aloud. */
  reading: number | null
  onChoose: (name: string) => void
  onWrite: () => void
}) {
  return (
    <div className="tv-onb__stage tv-onb__stage--friend">
      <AnimalArt look={lookOf(friend)} mood="happy" className="tv-onb__friend" />
      <div className="tv-names">
        {names.map((n, i) => (
          <Choice key={n} selected={chosen === n} speaking={reading === i} onClick={() => onChoose(n)} className="tv-name" data-name={n}>
            <SpokenText silent parts={[nameClip(n) ? { clip: nameClip(n)! } : { free: n }]} text={n} />
          </Choice>
        ))}
        {custom && (
          <Choice selected={chosen === custom} onClick={() => onChoose(custom)} className="tv-name tv-name--custom" data-name={custom}>
            <SpokenText silent parts={[{ free: custom }]} text={custom} />
          </Choice>
        )}
        <Choice onClick={onWrite} className="tv-name tv-name--write" data-write="">
          <Icon name="pencil" size={26} strokeWidth={2.4} />
          <SpokenText silent clip="s.onb.friend.write" />
        </Choice>
      </div>
    </div>
  )
}

/** "Skriv selv": the system keyboard, at most 14 characters, read back by the device voice. */
export function WriteNameSheet({ open, initial, onClose, onDone }: { open: boolean; initial: string; onClose: () => void; onDone: (name: string) => void }) {
  const speech = useSpeech()
  const [text, setText] = useState(initial)
  const input = useRef<HTMLInputElement>(null)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setText(initial)
  }
  useEffect(() => {
    if (open) input.current?.focus()
  }, [open])
  const clean = cleanAnimalName(text)
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (clean) onDone(clean)
  }
  return (
    <Sheet open={open} onClose={onClose} title="s.onb.friend.write">
      <form className="tv-onb__write" onSubmit={submit}>
        <input
          ref={input}
          className="tv-onb__input"
          type="text"
          value={text}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="done"
          aria-label={speech.text('s.onb.friend.ask')}
          onChange={(e) => setText(e.target.value)}
          data-friend-input=""
        />
        <Button type="submit" clip="s.ui.check" icon="check" block disabled={!clean} />
      </form>
    </Sheet>
  )
}

// ─── 4. The grade ────────────────────────────────────────────────────────────

export const GRADES: readonly Grade[] = [0, 1, 2, 3]

/**
 * Four big grades, and the honest line under them: every child starts in Engdalen (review P2-10);
 * Pip says it too once a grade is chosen. `start` replaces the line for a child who is offered
 * "Vis Pip hvad du kan" (3. klasse once Stjernefjeldet is built).
 */
export function GradeStep({ grade, onGrade, start = 's.onb.grade.start' }: { grade: Grade | null; onGrade: (g: Grade) => void; start?: ClipId }) {
  return (
    <div className="tv-onb__stage tv-onb__stage--grade">
      <div className="tv-grades">
        {GRADES.map((g) => (
          <Choice key={g} selected={grade === g} onClick={() => onGrade(g)} className="tv-grade" data-grade={String(g)}>
            <span className="tv-grade__n" aria-hidden>
              {`${g}.`}
            </span>
            <SpokenText silent clip={`s.onb.grade.${g}`} className="tv-grade__label" />
          </Choice>
        ))}
      </div>
      <div className="tv-onb__start" data-grade-start={start === 's.onb.grade.start' ? '' : start}>
        <SpokenText as="p" clip={start} className="tv-onb__hint" key={start} />
      </div>
    </div>
  )
}
