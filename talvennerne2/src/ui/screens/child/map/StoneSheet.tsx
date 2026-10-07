// The card behind a stepping stone: what the stone is, what it holds (the very animal the friend
// node gives, the chest's thing, the things of the world's party — shown before they are won), its
// stars, the bridge's planks ("Bedst: 7 planker", "Klar, når du er", or a normal round first), what
// opens a locked stone, and one big "Spil". The card reads itself aloud when it opens.
import { useEffect, useMemo } from 'react'
import { ITEM_BY_ID } from '../../../../content/catalog'
import { NODE_BY_ID, REGION_BY_ID, WORLD_BY_ID } from '../../../../content/curriculum'
import type { ClipId, NodeId, RegionId, SpeechPart, WorldId } from '../../../../engine/types'
import { friendOnCard } from '../../../../meta/animals'
import { useProfile } from '../../../../state/useProfile'
import { Button } from '../../../design/Button'
import { Icon } from '../../../design/Icon'
import { ProgressStones } from '../../../design/ProgressStones'
import { Sheet } from '../../../design/Sheet'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { AnimalPicture, ItemPicture } from './art'
import type { RegionView, StoneView } from './model'
import { SLOT_ABOUT, SLOT_CLIP, nodeIcon, regionTone, toneStyle } from './nodes'
import { Stars } from './RegionSection'
import { lineText } from './words'

const clip = (id: ClipId): SpeechPart => ({ clip: id })

/** What the stone's card says, as spoken parts (shown with the same words). */
export function stoneLines(stone: StoneView, region: RegionView | null): SpeechPart[][] {
  const lines: SpeechPart[][] = []
  if (stone.state === 'locked') {
    if (stone.slot === 'finale') lines.push([clip('s.map.locked.finale')])
    else if (region && !region.open && region.lock) {
      if (region.lock.kind === 'requires') {
        lines.push([clip('s.map.locked.requires'), ...region.lock.regions.map((r) => clip(REGION_BY_ID[r].nameClip))])
      } else lines.push([clip(region.lock.kind === 'world' ? 's.map.locked.world' : 's.map.locked.more')])
    } else lines.push([clip('s.map.locked.node')])
  }
  if (stone.friend) {
    lines.push([clip(stone.friend.met ? 's.map.about.friendMet' : 's.map.about.friend'), clip(`name.species.${stone.friend.species}`)])
  } else if (stone.chest) {
    lines.push([clip(stone.chest.opened ? 's.map.about.chestOpen' : 's.map.about.chest'), clip(ITEM_BY_ID[stone.chest.item].nameClip)])
  } else if (stone.trial) {
    const t = stone.trial
    lines.push([clip(SLOT_ABOUT[stone.slot])])
    if (t.passed) lines.push([clip('s.map.trial.passed')])
    else if (t.bridge) lines.push([clip('s.reward.helpBridge')])
    if (!t.passed && stone.state !== 'locked') {
      if (t.resting) lines.push([clip('s.map.trial.rest')])
      else if (t.attempts > 0) lines.push([clip('s.reward.trial.ready')])
      else if (t.fromStart && stone.slot === 'trial') lines.push([clip('s.map.about.skip')])
    }
  } else if (stone.skipped) {
    lines.push([clip('s.map.about.skipped')])
  } else {
    lines.push([clip(SLOT_ABOUT[stone.slot])])
  }
  if (stone.state !== 'locked' && !stone.trial) lines.push([clip(`s.map.stars.${stone.stars}`)])
  return lines
}

export interface StoneSheetProps {
  stone: StoneView | null
  region: RegionView | null
  onClose(): void
  onPlay(stone: StoneView): void
  onHut(region: RegionId): void
}

export function StoneSheet({ stone, region, onClose, onPlay, onHut }: StoneSheetProps) {
  const speech = useSpeech()
  const open = stone !== null
  useEffect(() => {
    if (!stone) return
    const where = stone.region ? REGION_BY_ID[stone.region].nameClip : null
    const parts: SpeechPart[] = [clip(SLOT_CLIP[stone.slot]), ...(where ? [clip(where)] : [])]
    for (const line of stoneLines(stone, region)) parts.push(...line)
    const h = speech.speak(parts)
    return () => h.cancel()
  }, [stone, region, speech])

  return (
    <Sheet open={open} onClose={onClose} title={stone ? SLOT_CLIP[stone.slot] : undefined} className="tv-stonesheet">
      {stone && <SheetBody stone={stone} region={region} onPlay={onPlay} onHut={onHut} />}
    </Sheet>
  )
}

/**
 * The friend stone's animal in its breed, colour and size: exactly the one the node gives (the same
 * seeded draw the round makes), or the one it gave (review app-w2-r1 P2-2). Without a profile, or
 * when the node gives no animal, the species.
 */
function FriendPicture({ nodeId, friend }: { nodeId: NodeId; friend: NonNullable<StoneView['friend']> }) {
  const profile = useProfile((s) => s.profile)
  const animal = useMemo(() => (profile ? friendOnCard(profile, friend.species, nodeId) : null), [profile, friend.species, nodeId])
  return <AnimalPicture animal={animal} species={friend.species} size={132} crop="fit" mood={friend.met ? 'happy' : 'wave'} />
}

/** The things the world's party gives, shown like a chest's thing (review app-w3-r1 P3-5, QA2 P2-7). */
export function FinaleThings({ world }: { world: WorldId }) {
  return (
    <div className="tv-stonesheet__show tv-stonesheet__things" data-finale-things={world}>
      {WORLD_BY_ID[world].finaleItems.map((item) => (
        <ItemPicture key={item} item={item} size={84} />
      ))}
    </div>
  )
}

function SheetBody({ stone, region, onPlay, onHut }: { stone: StoneView; region: RegionView | null; onPlay(s: StoneView): void; onHut(r: RegionId): void }) {
  const speech = useSpeech()
  const node = NODE_BY_ID[stone.id]
  const tone = regionTone(stone.region)
  const where = stone.region ? REGION_BY_ID[stone.region].nameClip : `name.world.${node.world}`
  const lines = stoneLines(stone, region)
  const t = stone.trial
  return (
    <div className="tv-stonesheet__body" style={toneStyle(tone)} data-stone-sheet={stone.id}>
      <div className="tv-stonesheet__where">
        <span className="tv-stonesheet__badge" aria-hidden>
          <Icon name={nodeIcon(node)} size="56%" strokeWidth={2.3} />
        </span>
        <SpokenText clip={where} className="tv-stonesheet__region" />
      </div>
      {stone.friend && (
        <div className="tv-stonesheet__show">
          <FriendPicture nodeId={stone.id} friend={stone.friend} />
        </div>
      )}
      {stone.chest && (
        <div className="tv-stonesheet__show">
          <ItemPicture item={stone.chest.item} size={112} />
        </div>
      )}
      {stone.slot === 'finale' && <FinaleThings world={node.world} />}
      {t && (
        <div className="tv-stonesheet__planks">
          <ProgressStones total={t.size} done={t.passed ? t.size : t.best} variant="planks" label={speech.text('s.map.about.trial')} />
          {t.attempts > 0 && !t.passed && (
            <SpokenText
              parts={[{ clip: 's.reward.trial.best' }, { num: t.best, form: 'mid' }, { clip: 's.reward.trial.planks' }]}
              text={`${speech.text('s.reward.trial.best')}: ${t.best} ${speech.text('s.reward.trial.planks')}`}
              className="tv-stonesheet__best"
            />
          )}
        </div>
      )}
      <div className="tv-stonesheet__lines">
        {lines.map((parts, i) => (
          <SpokenText key={i} as="p" parts={parts} text={lineText(parts, speech.text)} className="tv-stonesheet__line" />
        ))}
      </div>
      {stone.state !== 'locked' && !t && stone.stars > 0 && <Stars stars={stone.stars} className="tv-stonesheet__stars" />}
      {t?.passed && <Stars stars={stone.stars} className="tv-stonesheet__stars" />}
      <div className="tv-stonesheet__actions">
        {stone.playable && (
          <Button clip="s.ui.play" icon="play" block onClick={() => onPlay(stone)} data-sheet-play="" />
        )}
        {t && region?.hut && stone.slot === 'trial' && (
          <Button clip="s.map.hut" icon="hut" variant="secondary" block onClick={() => onHut(region.id)} data-sheet-hut="" />
        )}
      </div>
    </div>
  )
}
