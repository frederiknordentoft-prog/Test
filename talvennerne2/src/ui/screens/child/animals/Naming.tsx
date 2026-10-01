// Naming an animal (SPEC §6.3): six suggestions from names.ts, each read aloud when tapped, or a name
// the child writes (at most 14 characters, read by the device voice). A new animal already carries the
// first suggestion, so nothing has to be chosen; renaming is always allowed.
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NAME_MAX_LENGTH, cleanAnimalName, nameSuggestions } from '../../../../content/names'
import type { Animal } from '../../../../engine/types'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { nameParts } from './model'

/** Six suggestions without names the other animals use; the current name is always among them. */
export function suggestionsFor(animal: Pick<Animal, 'uid' | 'species' | 'name'>, others: readonly Pick<Animal, 'uid' | 'name'>[]): string[] {
  const taken = others.filter((a) => a.uid !== animal.uid).map((a) => a.name)
  const list = nameSuggestions(animal, taken)
  return list.includes(animal.name) ? list : [animal.name, ...list.slice(0, 5)]
}

export function Naming({ animal, onNamed }: { animal: Animal; onNamed?: (name: string) => void }) {
  const speech = useSpeech()
  const animals = useProfile((s) => s.profile?.animals)
  const current = animals?.find((a) => a.uid === animal.uid)?.name ?? animal.name
  // suggestions are drawn once per animal, so the list never jumps while the child picks
  const names = useMemo(() => suggestionsFor(animal, useProfile.getState().profile?.animals ?? []), [animal.uid])
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')

  const choose = (name: string) => {
    if (name !== current) useMeta.getState().nameAnimal(animal.uid, name)
    speech.speak(nameParts(name))
    onNamed?.(name)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = cleanAnimalName(text)
    if (!name) return
    choose(name)
    setTyping(false)
    setText('')
  }

  return (
    <div className="zoo-name" data-naming={animal.uid}>
      <SpokenText as="h3" clip="s.reward.name.choose" className="zoo-name__title" />
      <div className="zoo-name__grid">
        {names.map((n) => (
          <NameOption key={n} name={n} on={n === current} onPick={() => choose(n)} />
        ))}
        {!names.includes(current) && <NameOption name={current} on onPick={() => choose(current)} />}
      </div>
      {typing ? (
        <form className="zoo-name__own" onSubmit={submit}>
          <input
            className="zoo-name__input"
            value={text}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            aria-label={speech.text('s.zoo.name.hint')}
            placeholder={speech.text('s.zoo.name.hint')}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            // the child asked to write: the keyboard comes up at once
            autoFocus
            data-name-input=""
          />
          <Button clip="s.ui.check" icon="check" type="submit" size="md" variant="good" silent data-name-done="" />
        </form>
      ) : (
        <Button clip="s.zoo.name.own" icon="pencil" size="md" variant="secondary" onClick={() => setTyping(true)} data-name-own="" />
      )}
    </div>
  )
}

function NameOption({ name, on, onPick }: { name: string; on: boolean; onPick(): void }) {
  const { pressProps } = usePress()
  return (
    <button type="button" className={cx('zoo-name__opt tv-touch', on && 'is-on')} aria-pressed={on} onClick={onPick} data-name-option={name} {...pressProps}>
      <SpokenText parts={nameParts(name)} text={name} silent className="zoo-name__label" />
    </button>
  )
}
