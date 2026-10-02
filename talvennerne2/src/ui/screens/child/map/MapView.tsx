// The map screen's picture (SPEC §5.3–5.7): the top bar with the buddy, level, meters and perler;
// beside the path the worlds, "Fortsæt turen", the next stone, Blandet øvelse, the huts and the
// three goals; and the path itself — region by region, stone by stone, with the buddy standing at
// the next stone, then the world's party and the next world on the horizon. A world scene can be
// laid behind it all (Backdrop). Pure props in, callbacks out: MapScreen does the navigation.
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { FrameColor, RegionId, WorldId } from '../../../../engine/types'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { cx } from '../../../design/cx'
import { TopBar } from '../../../shell/TopBar'
import { Buddy } from '../round/Buddy'
import { Backdrop } from './Backdrop'
import { HudBuddy, HudMeters, HudSwitch, PerlerPill } from './Hud'
import type { MapModel, RegionView, StoneView } from './model'
import type { PlayTarget } from './nodes'
import { RegionSection, Stone } from './RegionSection'
import { Goals, SidePanel } from './SidePanel'
import { StoneSheet, stoneLines } from './StoneSheet'
import { lineText } from './words'
import { WorldGlyph } from './WorldGlyph'
import './map.css'

export interface MapViewProps {
  model: MapModel
  frame: FrameColor
  /** A region to bring into view and light up (the fog that just lifted). */
  highlight?: RegionId | null
  /** Drawn behind the map instead of the world's scene or placeholder. */
  background?: ReactNode
  /** The child's first look at the map (onboarding's last step): the path zooms in. */
  first?: boolean
  onWorld(world: WorldId): void
  onPlay(target: PlayTarget, opts?: { resume?: boolean; region?: RegionId }): void
  onBuddy(): void
  onAdult(): void
  /** "Skift spiller" with two or more children: the child's letter and frame, and the tap. */
  switcher?: { initial: string; frame: FrameColor; onSwitch(): void } | null
}

export function MapView({ model, frame, highlight, background, first, onWorld, onPlay, onBuddy, onAdult, switcher }: MapViewProps) {
  const speech = useSpeech()
  const [open, setOpen] = useState<{ stone: StoneView; region: RegionView | null } | null>(null)
  const pathRef = useRef<HTMLDivElement>(null)
  const tiers = Object.fromEntries(model.regions.map((r) => [r.id, r.tier]))

  // bring the next stone (or the region that just opened) into view, once per world
  useEffect(() => {
    const root = pathRef.current
    if (!root) return
    const target =
      (highlight && root.querySelector<HTMLElement>(`[data-region="${CSS.escape(highlight)}"]`)) ||
      root.querySelector<HTMLElement>('[data-next]')?.closest<HTMLElement>('.tv-stone-spot')
    if (target) revealIn(target, highlight ? 0.3 : 0.55)
  }, [model.world, highlight])

  const regionOf = (stone: StoneView) => model.regions.find((r) => r.id === stone.region) ?? null
  const onStone = (stone: StoneView) => setOpen({ stone, region: regionOf(stone) })
  const onRegion = (region: RegionView) => {
    if (region.open) {
      speech.speak([{ clip: region.nameClip }, { clip: `s.map.region.tier.${region.tier}` }])
      return
    }
    const first = region.stones[0]
    speech.speak([{ clip: region.nameClip }, ...stoneLines(first, region)[0]])
  }

  return (
    <div className={cx('tv-map', first && 'is-first')} data-world={model.world}>
      {background ?? <Backdrop world={model.world} tiers={tiers} />}
      <TopBar
        className="tv-map__top"
        leading={<HudBuddy buddy={model.buddy} frame={frame} hud={model.hud} onBuddy={onBuddy} />}
        center={
          switcher ? (
            <>
              <HudMeters hud={model.hud} />
              <HudSwitch initial={switcher.initial} frame={switcher.frame} onSwitch={switcher.onSwitch} />
            </>
          ) : (
            <HudMeters hud={model.hud} />
          )
        }
        extra={<PerlerPill perler={model.hud.perler} />}
        onAdult={onAdult}
      />
      <div className="tv-map__body">
        <aside className="tv-map__side">
          <SidePanel model={model} onWorld={onWorld} onPlay={onPlay} />
        </aside>
        <div ref={pathRef} className="tv-map__path" data-map-path="">
          {model.regions.map((region) => (
            <RegionSection
              key={region.id}
              region={region}
              highlight={highlight === region.id}
              onStone={onStone}
              onRegion={onRegion}
              onHut={(r) => onPlay('hut', { region: r })}
              buddy={region.stones.some((s) => s.next) ? <Buddy animal={model.buddy} mood="wave" className="tv-pathbuddy__rig" /> : null}
            />
          ))}
          <Finale stone={model.finale} onStone={onStone} buddy={model.finale.next ? <Buddy animal={model.buddy} mood="wave" className="tv-pathbuddy__rig" /> : null} />
          {model.beyond && <Beyond world={model.beyond} onWorld={onWorld} />}
          <div className="tv-map__end">
            <Goals goals={model.goals} className="tv-goals--end" />
          </div>
        </div>
      </div>
      <StoneSheet
        stone={open?.stone ?? null}
        region={open?.region ?? null}
        onClose={() => setOpen(null)}
        onPlay={(stone) => {
          setOpen(null)
          onPlay(stone.id)
        }}
        onHut={(region) => {
          setOpen(null)
          onPlay('hut', { region })
        }}
      />
    </div>
  )
}

/** Scrolls the nearest scrolling ancestor so `el` sits at `at` of its height, unless it is in view already. */
function revealIn(el: HTMLElement, at: number): void {
  let box: HTMLElement | null = el.parentElement
  while (box && !(box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
  if (!box) return
  const r = el.getBoundingClientRect()
  const b = box.getBoundingClientRect()
  const top = r.top - b.top
  if (top > b.height * 0.12 && top + r.height < b.height * 0.92) return
  box.scrollTop += top - b.height * at + r.height / 2
}

function Finale({ stone, onStone, buddy }: { stone: StoneView; onStone(s: StoneView): void; buddy: ReactNode }) {
  return (
    <section className={cx('tv-region tv-finale', stone.state === 'locked' && 'is-locked')} style={{ '--stones': 1 } as CSSProperties} data-finale={stone.id}>
      <div className="tv-region__sign">
        <SpokenText clip="s.map.node.finale" className="tv-region__title tv-finale__title" />
      </div>
      <div className="tv-region__ground">
        <Stone stone={stone} x={50} row={0} onTap={onStone} />
        {buddy && (
          <div className="tv-pathbuddy" style={{ '--x': '22%', '--row': 0 } as CSSProperties} aria-hidden>
            {buddy}
          </div>
        )}
      </div>
    </section>
  )
}

function Beyond({ world, onWorld }: { world: MapModel['beyond'] & object; onWorld(w: WorldId): void }) {
  const speech = useSpeech()
  const note = world.soon ? 's.map.soon.world' : 's.map.locked.world'
  const parts = world.open ? [{ clip: world.nameClip }] : [{ clip: world.nameClip }, { clip: note }]
  return (
    <button
      type="button"
      className={cx('tv-beyond tv-touch', !world.open && 'is-locked')}
      aria-label={lineText(parts, speech.text)}
      data-beyond={world.id}
      onClick={() => {
        speech.speak(parts)
        if (world.open) onWorld(world.id)
      }}
    >
      <span className="tv-beyond__glyph" aria-hidden>
        <WorldGlyph world={world.id} size="62%" />
      </span>
      <SpokenText clip={world.nameClip} silent className="tv-beyond__name" />
      {!world.open && <SpokenText clip={note} silent className="tv-beyond__note" />}
    </button>
  )
}
