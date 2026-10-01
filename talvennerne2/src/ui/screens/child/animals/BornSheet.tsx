// A new friend in Dyrehaven: just hatched from the egg, or a golden or rainbow animal just picked.
// It greets the child (cheer), says what kind of animal it is, and gets its name — one of six read-aloud
// suggestions or one the child writes. Closing keeps the first suggestion, which it already has.
import { useEffect, useRef } from 'react'
import type { Animal, ClipId } from '../../../../engine/types'
import type { Outfit, SpeciesDef } from '../../../../art/rig/types'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { Figure, lookOf, seedOf } from './art'
import { kindClips, lineText } from './model'
import { Naming } from './Naming'

export interface BornSheetProps {
  animal: Animal | null
  /** 's.reward.egg.hatched' after a hatch, 's.reward.animal.magic' for a golden or rainbow pick. */
  title: ClipId
  def: SpeciesDef | undefined
  outfit?: Outfit
  onClose(): void
}

export function BornSheet({ animal, title, def, outfit, onClose }: BornSheetProps) {
  const last = useRef<Animal | null>(animal)
  if (animal) last.current = animal
  const shown = animal ?? last.current
  return (
    <Sheet open={!!animal} onClose={onClose} className="zoo-sheet">
      {shown && <Born key={shown.uid} animal={shown} live={!!animal} title={title} def={def} outfit={outfit} onClose={onClose} />}
    </Sheet>
  )
}

function Born({ animal, live: open, title, def, outfit, onClose }: { animal: Animal; live: boolean; title: ClipId; def: SpeciesDef | undefined; outfit?: Outfit; onClose(): void }) {
  const speech = useSpeech()
  // the stored animal, so a new name shows at once
  const live = useProfile((s) => s.profile?.animals.find((a) => a.uid === animal.uid)) ?? animal
  const kind = kindClips(animal).map((clip) => ({ clip }))
  useEffect(() => {
    speech.speak([{ clip: title }])
    // greet once, when the friend arrives
  }, [animal.uid])
  return (
    <div className="zoo-born" data-born={animal.uid}>
      <SpokenText as="h2" clip={title} className="zoo-born__title" />
      <div className="zoo-born__stage">
        <Figure look={lookOf(live)} def={def} outfit={outfit} animated={open} mood="cheer" seed={seedOf(animal.uid)} px={210} crop="fit" />
      </div>
      <SpokenText parts={kind} text={lineText(kind, speech.text, ', ')} className="zoo-card__kind zoo-born__kind" />
      <Naming animal={live} />
      <Button clip="s.ui.check" icon="check" variant="good" size="md" block onClick={onClose} data-born-done="" />
    </div>
  )
}
