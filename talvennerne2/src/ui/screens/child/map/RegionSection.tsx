// One region on the path (SPEC §5.3, §5.6): its sign, its six stepping stones along a winding trail,
// the trail walked so far, the colour that has come back (pastel → lanterns → flowers and water →
// full colour with the region's animal), the fog over a region still closed, and the training hut
// beside the bridge when a trial failed. Every stone is a ≥ 60 px button; a locked one is shown and
// says what opens it.
import type { CSSProperties, ReactNode } from 'react'
import { NODE_BY_ID, REGION_BY_ID } from '../../../../content/curriculum'
import type { RegionId, SpeciesId } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import { ProgressStones } from '../../../design/ProgressStones'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import { AnimalPicture, ItemPicture } from './art'
import type { RegionView, StoneView } from './model'
import { SLOT_CLIP, nodeIcon, regionTone, toneStyle } from './nodes'

/** Where the stones stand across the path (percent of the width), in node order. */
const STONE_X = [50, 73, 52, 27, 47, 50]
/** The hut stands beside the bridge. */
const HUT_X = 17

const xOf = (i: number) => STONE_X[i % STONE_X.length]

/** The trail through the stones' centres, in the SVG's units (x 0–100, 100 per step). */
function trail(points: readonly [number, number][]): string {
  if (points.length === 0) return ''
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const dy = (y1 - y0) / 2
    d += `C${x0} ${y0 + dy} ${x1} ${y1 - dy} ${x1} ${y1}`
  }
  return d
}

export interface RegionSectionProps {
  region: RegionView
  highlight?: boolean
  onStone(stone: StoneView): void
  onRegion(region: RegionView): void
  onHut(region: RegionId): void
  /** The buddy, standing beside the next stone when it is in this region. */
  buddy?: ReactNode
}

/** The buddy stands on the inner side of its stone (on the far side of the bridge, away from the hut). */
const buddyX = (x: number, trial: boolean) => (trial ? 80 : x >= 50 ? x - 25 : x + 25)

export function RegionSection({ region, highlight, onStone, onRegion, onHut, buddy }: RegionSectionProps) {
  const def = REGION_BY_ID[region.id]
  const tone = regionTone(region.id)
  const stones = region.stones
  const points = stones.map((_, i): [number, number] => [xOf(i), i * 100 + 50])
  const walked = stones.reduce((last, s, i) => (s.state === 'done' ? i : last), -1)
  const species: SpeciesId | null = def.node3.kind === 'friend' ? def.node3.species : null
  const trialIndex = stones.findIndex((s) => s.slot === 'trial')
  const nextIndex = stones.findIndex((s) => s.next)
  return (
    <section
      className={cx('tv-region', !region.open && 'is-locked', highlight && 'is-highlight', region.fresh && 'is-fresh')}
      style={{ ...toneStyle(tone), '--stones': stones.length } as CSSProperties}
      data-region={region.id}
      data-tier={region.tier}
      data-open={region.open ? '' : undefined}
    >
      <RegionSign region={region} onTap={() => onRegion(region)} />
      <div className="tv-region__ground">
        <svg className="tv-region__trail" viewBox={`0 0 100 ${stones.length * 100}`} preserveAspectRatio="none" aria-hidden>
          <path className="tv-region__trail-bed" d={trail(points)} />
          {walked > 0 && <path className="tv-region__trail-walked" d={trail(points.slice(0, walked + 1))} />}
        </svg>
        <Decor tier={region.tier} species={species} count={stones.length} />
        {stones.map((s, i) => (
          <Stone key={s.id} stone={s} x={xOf(i)} row={i} onTap={onStone} />
        ))}
        {buddy && nextIndex >= 0 && (
          <div
            className="tv-pathbuddy"
            style={{ '--x': `${buddyX(xOf(nextIndex), nextIndex === trialIndex)}%`, '--row': nextIndex } as CSSProperties}
            aria-hidden
          >
            {buddy}
          </div>
        )}
        {region.hut && trialIndex >= 0 && (
          <HutButton region={region.id} row={trialIndex} onTap={() => onHut(region.id)} />
        )}
        {!region.open && <Fog />}
      </div>
    </section>
  )
}

// ─── The sign ───────────────────────────────────────────────────────────────

const TIER_CLIP = {
  start: 's.map.region.tier.start',
  bronze: 's.map.region.tier.bronze',
  silver: 's.map.region.tier.silver',
  gold: 's.map.region.tier.gold',
} as const

function RegionSign({ region, onTap }: { region: RegionView; onTap(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const lit = region.tier === 'gold' ? 3 : region.tier === 'silver' ? 2 : region.tier === 'bronze' ? 1 : 0
  return (
    <div className="tv-region__sign">
      <button
        type="button"
        className="tv-region__name tv-touch"
        onClick={onTap}
        aria-label={speech.text(region.nameClip)}
        data-region-sign={region.id}
        {...pressProps}
      >
        <span className="tv-region__badge" aria-hidden>
          <Icon name={region.open ? 'flag' : 'lock'} size="58%" strokeWidth={2.4} />
        </span>
        <SpokenText clip={region.nameClip} silent className="tv-region__title" />
      </button>
      {region.fresh && (
        <SpokenText clip="s.map.region.new" className="tv-region__new" />
      )}
      {region.open && (
        <button
          type="button"
          className="tv-region__lanterns tv-touch"
          aria-label={speech.text(TIER_CLIP[region.tier])}
          onClick={() => speech.speak([{ clip: TIER_CLIP[region.tier] }])}
          data-tier-lights={lit}
          {...pressProps}
        >
          {[0, 1, 2].map((i) => (
            <Lantern key={i} lit={i < lit} />
          ))}
        </button>
      )}
    </div>
  )
}

/** A small lantern: dark until the region's colour comes back, then lit (one per tier). */
function Lantern({ lit }: { lit: boolean }) {
  return (
    <svg className={cx('tv-region__lantern', lit && 'is-lit')} viewBox="0 0 16 24" width="16" height="24" aria-hidden>
      <path className="tv-region__lantern-hook" d="M8 1.5v3" />
      <path className="tv-region__lantern-cap" d="M3.5 7.5h9l-1.5-3h-6z" />
      <rect className="tv-region__lantern-glass" x="4.5" y="7.5" width="7" height="11" rx="2.5" />
      <path className="tv-region__lantern-cap" d="M3.5 18.5h9v2.2h-9z" />
    </svg>
  )
}

// ─── A stepping stone ───────────────────────────────────────────────────────

function StoneFace({ stone }: { stone: StoneView }) {
  const node = NODE_BY_ID[stone.id]
  if (stone.friend) {
    return <AnimalPicture species={stone.friend.species} size={64} crop="head" mood={stone.state === 'locked' ? 'sleep' : 'happy'} className="tv-stone__pic" />
  }
  if (stone.chest) {
    return (
      <>
        <Icon name="chest" size="54%" strokeWidth={2.3} />
        <span className="tv-stone__item" aria-hidden>
          {stone.chest.opened ? <Icon name="check" size="70%" strokeWidth={3} /> : <ItemPicture item={stone.chest.item} size={34} />}
        </span>
      </>
    )
  }
  if (stone.skipped) return <Icon name="next" size="50%" strokeWidth={2.6} />
  return <Icon name={node ? nodeIcon(node) : 'star'} size="50%" strokeWidth={2.4} />
}

export function Stars({ stars, className }: { stars: 0 | 1 | 2 | 3; className?: string }) {
  return (
    <span className={cx('tv-stars', className)} aria-hidden>
      {[1, 2, 3].map((n) => (
        <Icon key={n} name="star" solid={n <= stars} size={18} strokeWidth={2.2} className={cx('tv-stars__star', n <= stars && 'is-on')} />
      ))}
    </span>
  )
}

export function Stone({ stone, x, row, onTap }: { stone: StoneView; x: number; row: number; onTap(stone: StoneView): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const isTrial = !!stone.trial
  const label = speech.text(SLOT_CLIP[stone.slot])
  const style = { '--x': `${x}%`, '--row': row } as CSSProperties
  return (
    <div className={cx('tv-stone-spot', isTrial && 'is-trial')} style={style}>
      {stone.next && <span className="tv-stone__halo" aria-hidden />}
      <button
        type="button"
        className={cx('tv-stone tv-touch', `is-${stone.state}`, stone.next && 'is-next', stone.skipped && 'is-skipped')}
        aria-label={label}
        data-stone={stone.id}
        data-state={stone.state}
        data-slot={stone.slot}
        data-next={stone.next ? '' : undefined}
        onClick={() => onTap(stone)}
        {...pressProps}
      >
        <span className="tv-stone__disc">
          <StoneFace stone={stone} />
          {stone.state === 'locked' && (
            <span className="tv-stone__lock" aria-hidden>
              <Icon name="lock" size="62%" strokeWidth={2.6} />
            </span>
          )}
          {stone.next && (
            <span className="tv-stone__play" aria-hidden>
              <Icon name="play" size="56%" solid strokeWidth={2.2} />
            </span>
          )}
        </span>
      </button>
      {isTrial ? (
        <TrialPlanks stone={stone} />
      ) : (
        stone.state === 'done' && !stone.skipped && <Stars stars={stone.stars} className="tv-stone__stars" />
      )}
    </div>
  )
}

function TrialPlanks({ stone }: { stone: StoneView }) {
  const speech = useSpeech()
  const t = stone.trial!
  const laid = t.passed ? t.size : t.best
  return (
    <span className="tv-stone__bridge" aria-hidden>
      <ProgressStones total={t.size} done={laid} variant="planks" label={speech.text('s.map.about.trial')} />
      {t.passed ? (
        <Stars stars={stone.stars} className="tv-stone__stars" />
      ) : t.attempts > 0 && !t.resting ? (
        <SpokenText clip="s.reward.trial.ready" silent className="tv-stone__ready" />
      ) : null}
    </span>
  )
}

function HutButton({ region, row, onTap }: { region: RegionId; row: number; onTap(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  return (
    <div className="tv-stone-spot is-hut" style={{ '--x': `${HUT_X}%`, '--row': row } as CSSProperties}>
      <button
        type="button"
        className="tv-hut tv-touch"
        aria-label={speech.text('s.map.hut')}
        onClick={() => {
          speech.speak([{ clip: 's.map.hut' }])
          onTap()
        }}
        data-hut={region}
        {...pressProps}
      >
        <span className="tv-hut__glow" aria-hidden />
        <Icon name="hut" size="56%" strokeWidth={2.3} />
      </button>
      <SpokenText clip="s.map.hut" silent className="tv-hut__label" />
    </div>
  )
}

// ─── Colour that comes back, and the fog ───────────────────────────────────

/** Lanterns light up at bronze, flowers come back at silver, and at gold the region's animal walks the path. */
function Decor({ tier, species, count }: { tier: RegionView['tier']; species: SpeciesId | null; count: number }) {
  const out: ReactNode[] = []
  const rows = Array.from({ length: Math.max(1, count - 1) }, (_, i) => i)
  if (tier !== 'start') {
    for (const i of rows.filter((r) => r % 2 === 0)) {
      out.push(
        <span key={`l${i}`} className="tv-decor tv-decor--lantern" style={{ '--x': `${i % 4 === 0 ? 88 : 10}%`, '--row': i + 0.9 } as CSSProperties} aria-hidden>
          <span className="tv-decor__post" />
          <span className="tv-decor__lamp" />
        </span>,
      )
    }
  }
  if (tier === 'silver' || tier === 'gold') {
    for (const i of rows) {
      out.push(
        <span key={`f${i}`} className="tv-decor tv-decor--flower" style={{ '--x': `${i % 2 === 0 ? 26 : 80}%`, '--row': i + 0.55 } as CSSProperties} aria-hidden>
          <span className="tv-decor__petals" />
        </span>,
      )
    }
  }
  if (tier === 'gold') {
    out.push(
      <span key="animal" className="tv-decor tv-decor--animal" style={{ '--x': '84%', '--row': count - 1.6 } as CSSProperties} aria-hidden>
        {species ? <AnimalPicture species={species} size={64} crop="fit" mood="happy" /> : <Icon name="sparkle" size={40} />}
      </span>,
    )
  }
  return <>{out}</>
}

function Fog() {
  return (
    <span className="tv-region__fog" aria-hidden>
      <span className="tv-region__cloud is-a" />
      <span className="tv-region__cloud is-b" />
      <span className="tv-region__cloud is-c" />
    </span>
  )
}
