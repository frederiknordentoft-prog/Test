// #shell — the app shell in use: #shell/hub (map hub with HUD meters and the dock), #shell/task
// (a round: "8 + 5 = ?", three answer cards, hør igen, the stone path), #shell/wrong (after a
// mistake: struck answer, ten-frame hint, the right card to tap) and #shell/sheet (a bottom sheet).
// Mock screens for review only; the real screens are built by other areas from these parts.
import { useState } from 'react'
import { Rig } from '../../art/rig/Rig'
import { rabbit } from '../../art/species/rabbit'
import { TenFrame } from '../../art/materials'
import { AnswerCard } from '../../ui/design/AnswerCard'
import type { AnswerState } from '../../ui/design/AnswerCard'
import { Button, IconButton } from '../../ui/design/Button'
import { Card } from '../../ui/design/Card'
import { Equation } from '../../ui/design/Equation'
import { Icon } from '../../ui/design/Icon'
import { Meter } from '../../ui/design/Meter'
import { Pill } from '../../ui/design/Pill'
import { ProgressStones } from '../../ui/design/ProgressStones'
import { Sheet } from '../../ui/design/Sheet'
import { SpokenText } from '../../ui/design/SpokenText'
import type { ScreenDirection } from '../../ui/design/motion'
import { AppShell } from '../../ui/shell/AppShell'
import { Dock } from '../../ui/shell/Dock'
import type { DockId } from '../../ui/shell/Dock'
import { TopBar } from '../../ui/shell/TopBar'

export function ShellPage({ sub }: { sub: string }) {
  const route = sub || 'hub'
  const [screen, setScreen] = useState(route === 'task' || route === 'wrong' ? 'task' : 'hub')
  const [dir, setDir] = useState<ScreenDirection>('forward')
  const [tab, setTab] = useState<DockId>('map')
  const [sheet, setSheet] = useState(route === 'sheet')
  const go = (to: string, d: ScreenDirection) => {
    setDir(d)
    setScreen(to)
  }
  return (
    <>
      <AppShell screenKey={screen} direction={dir} dock={screen === 'hub' ? <Dock active={tab} onSelect={setTab} news={{ shop: true }} /> : undefined}>
        {screen === 'hub' ? <HubMock onPlay={() => go('task', 'forward')} onAdult={() => setSheet(true)} /> : <TaskMock wrong={route === 'wrong'} onClose={() => go('hub', 'back')} />}
      </AppShell>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="s.demo.parentGate">
        <div className="h-gate">
          <Equation terms={[{ n: 14 }, { op: '·' }, { n: 7 }, { op: '=' }, { blank: true }]} slot="active" size="answer" />
          <div className="h-gate__keys">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
              <AnswerCard key={k}>{k}</AnswerCard>
            ))}
            <AnswerCard label="Slet">
              <Icon name="backspace" size={40} />
            </AnswerCard>
            <AnswerCard>0</AnswerCard>
            <AnswerCard label="Færdig" state="target">
              <Icon name="check" size={40} strokeWidth={3} />
            </AnswerCard>
          </div>
        </div>
      </Sheet>
    </>
  )
}

function HubMock({ onPlay, onAdult }: { onPlay: () => void; onAdult: () => void }) {
  return (
    <>
      <TopBar
        leading={
          <button type="button" className="h-avatar tv-touch" aria-label="Ella">
            E
          </button>
        }
        center={
          <div className="h-hud">
            <Meter kind="egg" value={0.62} size="sm" />
            <Meter kind="wish" value={0.35} size="sm" />
            <Meter kind="heart" value={0.8} size="sm" />
          </div>
        }
        onAdult={onAdult}
      />
      <div className="h-hub">
        <Card pad="none" className="h-world">
          <div className="h-world__scene">
            <WorldScene />
          </div>
          <div className="h-world__body">
            <div className="h-world__text">
              <SpokenText as="div" clip="name.world.eng" className="tv-t-label h-eyebrow" />
              <SpokenText as="h1" clip="name.region.w0-plus10" className="tv-t-title h-world__title" />
              <div className="h-world__pills">
                <Pill domain="addsub" icon="plus" size="sm">
                  Plus
                </Pill>
                <Pill tone="star" icon="star" size="sm">
                  2
                </Pill>
              </div>
            </div>
            <div className="h-world__buddy">
              <Rig species={rabbit} mood="wave" size="100%" seed={3} />
            </div>
          </div>
          <div className="h-world__cta">
            <Button clip="s.ui.play" icon="play" block onClick={onPlay} />
          </div>
        </Card>
      </div>
    </>
  )
}

function TaskMock({ wrong, onClose }: { wrong: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<number | null>(wrong ? 12 : null)
  const answers = [13, 12, 14]
  const state = (v: number): AnswerState => {
    if (picked === null) return 'idle'
    if (picked === 13) return v === 13 ? 'correct' : 'dim'
    if (v === picked) return 'wrong'
    return v === 13 ? 'target' : 'dim'
  }
  return (
    <>
      <TopBar
        leading="close"
        onLeading={onClose}
        center={<ProgressStones total={10} done={3} glow label="Turen" />}
        extra={<IconButton icon="hand" clip="s.ui.showMe" variant="glass" sayLabel />}
      />
      <div className="h-task" data-wrong={wrong ? '' : undefined}>
        <div className="h-task__stage">
          <Card className="h-task__prompt">
            <Equation
              terms={[{ n: 8 }, { op: '+' }, { n: 5 }, { op: '=' }, { blank: true }]}
              slot={picked === 13 ? 'good' : 'empty'}
              entry={picked === 13 ? '13' : undefined}
            />
            {wrong && (
              <div className="h-task__hint">
                <TenFrame n={8} extra={2} size={150} />
                <TenFrame n={0} extra={3} size={150} />
              </div>
            )}
            <IconButton className="h-task__ear" icon="ear" clip="s.ui.replay" variant="primary" />
          </Card>
          <div className="h-task__buddy">
            <div className="h-task__rig">
              <Rig species={rabbit} mood={picked === 13 ? 'happy' : wrong ? 'think' : 'idle'} size="100%" seed={5} />
            </div>
            <IconButton icon="bulb" clip="s.ui.hint" variant="glass" pulse={!wrong} />
          </div>
        </div>
        <div className="h-task__answers">
          {answers.map((v) => (
            <AnswerCard key={v} state={state(v)} onClick={() => setPicked(v)}>
              {v}
            </AnswerCard>
          ))}
        </div>
      </div>
    </>
  )
}

/** A tiny meadow diorama standing in for the world scene (scenes are drawn elsewhere). */
function WorldScene() {
  return (
    <svg className="h-scene" viewBox="0 0 360 170" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <path className="h-scene__hill-far" d="M0 92C60 66 120 70 190 88S310 98 360 76V170H0Z" />
      <path className="h-scene__hill" d="M0 122C70 98 160 104 230 118S320 128 360 112V170H0Z" />
      <path className="h-scene__path" d="M28 160C70 140 70 124 120 122S190 132 214 116 262 92 300 96" />
      <g className="h-scene__tree">
        <path d="M58 104v-18" />
        <circle cx="58" cy="78" r="15" />
      </g>
      <g className="h-scene__tree">
        <path d="M322 92v-16" />
        <circle cx="322" cy="68" r="13" />
      </g>
      <circle className="h-scene__node is-done" cx="62" cy="142" r="10" />
      <circle className="h-scene__node is-done" cx="120" cy="122" r="10" />
      <circle className="h-scene__node is-current" cx="192" cy="126" r="12" />
      <circle className="h-scene__node" cx="246" cy="104" r="10" />
      <path className="h-scene__flag-pole" d="M300 96V66" />
      <path className="h-scene__flag" d="M301 67l20 7-20 7z" />
    </svg>
  )
}
