// Naming a new friend (SPEC §6.3): six suggestions, each read aloud when tapped, or the child's own
// name (at most 14 characters, read by the device voice). The animal already has the first
// suggestion, so skipping is fine; it can be renamed any time later.
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { NAME_MAX_LENGTH, nameClip, nameSuggestions } from '../../../../content/names'
import type { Animal, SpeechPart } from '../../../../engine/types'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'

const nameSpeech = (name: string): SpeechPart[] => {
  const clip = nameClip(name)
  return [clip ? { clip } : { free: name }]
}

export function NameAnimal({ animal }: { animal: Animal }) {
  const speech = useSpeech()
  const profile = useProfile((s) => s.profile)
  const current = profile?.animals.find((a) => a.uid === animal.uid)?.name ?? animal.name
  const names = useMemo(() => {
    const taken = (useProfile.getState().profile?.animals ?? []).filter((a) => a.uid !== animal.uid).map((a) => a.name)
    const list = nameSuggestions(animal, taken)
    return list.includes(animal.name) ? list : [animal.name, ...list.slice(0, 5)]
  }, [animal])
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')

  const choose = (name: string) => {
    useMeta.getState().nameAnimal(animal.uid, name)
    speech.speak([{ clip: 's.ceremony.name.is' }, ...nameSpeech(name)])
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const name = text.trim()
    if (!name) return
    choose(name)
    setTyping(false)
  }

  return (
    <div className="tv-name" onClick={(e) => e.stopPropagation()} data-name-animal={animal.uid}>
      <SpokenText as="h2" clip="s.reward.name.choose" className="tv-name__title" />
      <div className="tv-name__grid">
        {names.map((n) => (
          <NameOption key={n} name={n} on={n === current} onPick={() => choose(n)} />
        ))}
      </div>
      {typing ? (
        <form className="tv-name__own" onSubmit={submit}>
          <input
            className="tv-name__input"
            value={text}
            maxLength={NAME_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            aria-label={speech.text('s.ceremony.name.hint')}
            placeholder={speech.text('s.ceremony.name.hint')}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            enterKeyHint="done"
            // the child asked to write: the keyboard comes up at once
            autoFocus
            data-name-input=""
          />
          <Button clip="s.ui.check" icon="check" type="submit" size="md" variant="good" data-name-done="" />
        </form>
      ) : (
        <Button clip="s.ceremony.name.own" icon="pencil" size="md" variant="secondary" onClick={() => setTyping(true)} data-name-own="" />
      )}
    </div>
  )
}

function NameOption({ name, on, onPick }: { name: string; on: boolean; onPick(): void }) {
  const { pressProps } = usePress()
  return (
    <button type="button" className={cx('tv-name__opt tv-touch', on && 'is-on')} aria-pressed={on} onClick={onPick} data-name-option={name} {...pressProps}>
      <SpokenText parts={nameSpeech(name)} text={name} silent className="tv-name__label" />
    </button>
  )
}
