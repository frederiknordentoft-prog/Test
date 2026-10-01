// Beside the path (on a phone: above it): the four worlds (closed ones shown closed), the stored
// round ("Fortsæt turen"), the next stone with one big tap, Blandet øvelse (always open), the lit
// training huts, and "Næste tre mål" — goals that never expire and never count down (SPEC §13.9).
import type { CSSProperties } from 'react'
import type { ClipId, Goal, RegionId, SpeechPart, WorldId } from '../../../../engine/types'
import { Icon } from '../../../design/Icon'
import type { IconName } from '../../../design/icons'
import { SpokenText } from '../../../design/SpokenText'
import { useSpeech } from '../../../design/speech'
import { usePress } from '../../../design/usePress'
import { cx } from '../../../design/cx'
import type { MapModel } from './model'
import { targetInfo, toneStyle, type PlayTarget } from './nodes'
import { WorldGlyph } from './WorldGlyph'
import { GOAL_ICON, goalSpeech, lineText } from './words'

export interface SidePanelProps {
  model: MapModel
  onWorld(world: WorldId): void
  onPlay(target: PlayTarget, opts?: { resume?: boolean; region?: RegionId }): void
}

export function SidePanel({ model, onWorld, onPlay }: SidePanelProps) {
  const next = model.next
  return (
    <div className="tv-side">
      <WorldPicker model={model} onWorld={onWorld} />
      {model.resume && (
        <ActionTile
          kind="resume"
          target={model.resume.target}
          title="s.map.resume"
          onTap={() => onPlay(model.resume!.target, { resume: true })}
        />
      )}
      <div className="tv-side__tiles">
        {next && !(model.resume && model.resume.target === next) && (
          <ActionTile kind="next" target={next} title="s.map.next" onTap={() => onPlay(next)} />
        )}
        <ActionTile kind="practice" target="practice" title="s.map.practice" onTap={() => onPlay('practice')} />
        {model.huts.map((region) => (
          <ActionTile key={region} kind="hut" target="hut" hutRegion={region} title="s.map.hut" onTap={() => onPlay('hut', { region })} />
        ))}
      </div>
      <Goals goals={model.goals} className="tv-goals--side" />
    </div>
  )
}

// ─── Worlds ─────────────────────────────────────────────────────────────────

const WORLD_TONE: Readonly<Record<WorldId, string>> = { eng: 'shapes', bakke: 'addsub', skov: 'fractions', fjeld: 'number' }

function WorldPicker({ model, onWorld }: { model: MapModel; onWorld(w: WorldId): void }) {
  const speech = useSpeech()
  const current = model.worlds.find((w) => w.id === model.world)!
  return (
    <div className="tv-worlds">
      <SpokenText as="h1" clip={current.nameClip} className="tv-worlds__title" />
      <div className="tv-worlds__row" role="group" aria-label={speech.text('s.map.world.choose')}>
        {model.worlds.map((w) => (
          <WorldButton
            key={w.id}
            world={w.id}
            open={w.open}
            current={w.id === model.world}
            label={speech.text(w.nameClip)}
            onTap={() => {
              if (w.open) {
                speech.speak([{ clip: w.nameClip }])
                if (w.id !== model.world) onWorld(w.id)
              } else speech.speak([{ clip: w.nameClip }, { clip: 's.map.locked.world' }])
            }}
          />
        ))}
      </div>
    </div>
  )
}

function WorldButton({ world, open, current, label, onTap }: { world: WorldId; open: boolean; current: boolean; label: string; onTap(): void }) {
  const { pressProps } = usePress()
  const tone = WORLD_TONE[world]
  const style = { '--tone': `var(--color-d-${tone})`, '--tone-deep': `var(--color-d-${tone}-deep)`, '--tone-soft': `var(--color-d-${tone}-soft)` } as CSSProperties
  return (
    <button
      type="button"
      className={cx('tv-world tv-touch', current && 'is-current', !open && 'is-locked')}
      style={style}
      aria-label={label}
      aria-current={current ? 'true' : undefined}
      data-world={world}
      data-open={open ? '' : undefined}
      onClick={onTap}
      {...pressProps}
    >
      <span className="tv-world__face">
        <WorldGlyph world={world} size="64%" />
      </span>
      {!open && (
        <span className="tv-world__lock" aria-hidden>
          <Icon name="lock" size="64%" strokeWidth={2.6} />
        </span>
      )}
    </button>
  )
}

// ─── Action tiles ───────────────────────────────────────────────────────────

const TILE_ICON: Readonly<Record<'resume' | 'next' | 'practice' | 'hut', IconName>> = { resume: 'play', next: 'play', practice: 'retry', hut: 'hut' }

function ActionTile({ kind, target, hutRegion, title, onTap }: {
  kind: 'resume' | 'next' | 'practice' | 'hut'
  target: PlayTarget
  hutRegion?: RegionId
  title: ClipId
  onTap(): void
}) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const info = targetInfo(target, hutRegion)
  const sub: SpeechPart[] =
    kind === 'practice' ? [] : kind === 'hut' ? (info.label ? [{ clip: info.label }] : []) : [{ clip: info.title }, ...(info.label ? [{ clip: info.label }] : [])]
  const said: SpeechPart[] = [{ clip: title }, ...sub]
  return (
    <button
      type="button"
      className={cx('tv-tile tv-touch', `is-${kind}`)}
      style={toneStyle(kind === 'practice' ? 'algebra' : info.tone)}
      aria-label={lineText(said, speech.text)}
      data-tile={kind}
      onClick={() => {
        speech.speak(said)
        onTap()
      }}
      {...pressProps}
    >
      <span className="tv-tile__badge" aria-hidden>
        <Icon name={TILE_ICON[kind]} size="56%" solid={kind === 'next' || kind === 'resume'} strokeWidth={2.3} />
      </span>
      <span className="tv-tile__text">
        <SpokenText clip={title} silent className="tv-tile__title" />
        {sub.length > 0 && (
          <SpokenText parts={sub} text={sub.map((p) => ('clip' in p ? speech.text(p.clip) : '')).join('\n')} silent className="tv-tile__sub" />
        )}
      </span>
    </button>
  )
}

// ─── Næste tre mål ──────────────────────────────────────────────────────────

/** "Næste tre mål": beside the path when there is room, after it on a phone (MapView places both). */
export function Goals({ goals, className }: { goals: readonly Goal[]; className?: string }) {
  if (goals.length === 0) return null
  return (
    <div className={cx('tv-goals', className)} data-goals="">
      <SpokenText as="h2" clip="s.map.goals" className="tv-goals__title" />
      <ul className="tv-goals__list">
        {goals.map((g, i) => (
          <GoalRow key={`${g.kind}${i}`} goal={g} />
        ))}
      </ul>
    </div>
  )
}

function GoalRow({ goal }: { goal: Goal }) {
  const speech = useSpeech()
  const { pressProps } = usePress()
  const parts = goalSpeech(goal)
  const said = goal.done ? [...parts, { clip: 's.map.goal.done' }] : parts
  const dots = goal.need > 1 ? Array.from({ length: goal.need }, (_, i) => i < goal.progress) : null
  return (
    <li>
      <button
        type="button"
        className={cx('tv-goal tv-touch', goal.done && 'is-done')}
        aria-label={lineText(said, speech.text)}
        data-goal={goal.kind}
        onClick={() => speech.speak(said)}
        {...pressProps}
      >
        <span className="tv-goal__icon" aria-hidden>
          <Icon name={goal.done ? 'stamp' : GOAL_ICON[goal.kind]} size="58%" strokeWidth={2.3} solid={goal.done} />
        </span>
        <span className="tv-goal__text">
          <SpokenText parts={parts} text={lineText(parts, speech.text)} silent className="tv-goal__label" />
          {dots && !goal.done && (
            <span className="tv-goal__dots" aria-hidden>
              {dots.map((on, i) => (
                <span key={i} className={cx('tv-goal__dot', on && 'is-on')} />
              ))}
            </span>
          )}
        </span>
        {goal.done && (
          <span className="tv-goal__check" aria-hidden>
            <Icon name="check" size="60%" strokeWidth={3} />
          </span>
        )}
      </button>
    </li>
  )
}
