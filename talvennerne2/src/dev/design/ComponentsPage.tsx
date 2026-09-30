// #components — every design-system component in every state. `#components/sheet` opens the sheet.
import { useState } from 'react'
import { AnswerCard } from '../../ui/design/AnswerCard'
import type { AnswerState } from '../../ui/design/AnswerCard'
import { Button, IconButton } from '../../ui/design/Button'
import { Card } from '../../ui/design/Card'
import { Equation } from '../../ui/design/Equation'
import { Meter } from '../../ui/design/Meter'
import { Pill } from '../../ui/design/Pill'
import { ProgressStones } from '../../ui/design/ProgressStones'
import { Sheet } from '../../ui/design/Sheet'
import { SpokenText } from '../../ui/design/SpokenText'

const STATES: AnswerState[] = ['idle', 'selected', 'correct', 'wrong', 'target', 'dim']

export function ComponentsPage({ sub }: { sub: string }) {
  const [sheet, setSheet] = useState(sub === 'sheet')
  return (
    <>
      <h1 className="h-title">Komponenter</h1>
      <p className="h-sub">Tryk på knapper og tekst: undertitlen nederst viser, hvad stemmen ville sige.</p>

      <div className="h-section">Knapper</div>
      <div className="h-row">
        <Button clip="s.ui.play" icon="play" />
        <Button clip="s.ui.next" variant="secondary" iconEnd="next" />
        <Button clip="s.ui.check" variant="good" icon="check" />
        <Button clip="s.ui.toMap" variant="star" icon="map" />
        <Button clip="s.ui.skip" variant="quiet" />
        <Button clip="s.ui.play" disabled />
      </div>
      <div className="h-row" style={{ marginTop: 16 }}>
        <Button clip="s.ui.next" size="md" iconEnd="next" />
        <Button clip="s.ui.back" size="md" variant="secondary" icon="back" />
        <div style={{ width: 280 }}>
          <Button clip="s.ui.play" block icon="play" />
        </div>
      </div>

      <div className="h-section">Ikonknapper (≥ 60 px)</div>
      <div className="h-row" style={{ padding: 16, borderRadius: 24, background: 'var(--sky)' }}>
        <IconButton icon="close" clip="s.ui.close" />
        <IconButton icon="back" clip="s.ui.back" variant="glass" />
        <IconButton icon="ear" clip="s.ui.replay" variant="primary" />
        <IconButton icon="hand" clip="s.ui.showMe" />
        <IconButton icon="bulb" clip="s.ui.hint" pulse />
        <IconButton icon="check" clip="s.ui.check" variant="good" size="lg" />
        <IconButton icon="backspace" clip="s.ui.delete" />
        <IconButton icon="parent" clip="s.ui.adult" variant="quiet" />
        <IconButton icon="soundOn" clip="s.ui.soundOn" variant="glass" />
        <IconButton icon="check" clip="s.ui.check" variant="good" disabled />
      </div>

      <div className="h-section">Svarkort</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 18, maxWidth: 760 }}>
        {STATES.map((s, i) => (
          <div key={s}>
            <AnswerCard state={s}>{[13, 12, 13, 14, 13, 3][i]}</AnswerCard>
            <span className="h-cap">{s}</span>
          </div>
        ))}
        <div>
          <AnswerCard speaking>
            <span style={{ fontSize: '0.5em', fontWeight: 900 }}>cm</span>
          </AnswerCard>
          <span className="h-cap">speaking</span>
        </div>
      </div>

      <div className="h-section">Ligninger</div>
      <Card>
        <div style={{ display: 'grid', gap: 22, justifyItems: 'center' }}>
          <Equation terms={[{ n: 8 }, { op: '+' }, { n: 5 }, { op: '=' }, { blank: true }]} />
          <Equation terms={[{ n: 7 }, { op: '·' }, { n: 3 }, { op: '=' }, { blank: true }]} entry="21" slot="good" />
          <Equation terms={[{ n: 12 }, { op: ':' }, { n: 4 }, { op: '=' }, { blank: true }]} entry="4" slot="oops" />
          <Equation terms={[{ n: 3 }, { op: '+' }, { blank: true }, { op: '=' }, { n: 10 }]} slot="active" />
          <Equation terms={[{ n: 15 }, { op: '−' }, { n: 7 }, { op: '<' }, { n: 9 }]} size="answer" />
        </div>
      </Card>

      <div className="h-section">Kort og piller</div>
      <div className="h-row" style={{ alignItems: 'stretch' }}>
        <Card style={{ width: 220 }}>
          <SpokenText as="div" clip="name.region.w0-plus10" className="text-title" />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Pill domain="addsub" icon="plus">
              Plus
            </Pill>
            <Pill tone="star" icon="star">
              3
            </Pill>
          </div>
        </Card>
        <Card tone="soft" style={{ width: 220 }}>
          <SpokenText as="p" clip="s.demo.hello" className="text-body" style={{ margin: 0 }} />
        </Card>
        <Card tone="glass" style={{ width: 220, background: 'var(--sky)' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill tone="primary" icon="sparkle">
              Ny
            </Pill>
            <Pill tone="good" icon="check">
              Kan selv
            </Pill>
            <Pill tone="oops" icon="bulb">
              Øver
            </Pill>
            <Pill tone="glass" icon="chest">
              Kiste
            </Pill>
            <Pill domain="clock" icon="clock" size="sm">
              Klokken
            </Pill>
          </div>
        </Card>
      </div>

      <div className="h-section">Målere uden tal</div>
      <div className="h-row" style={{ padding: 16, borderRadius: 24, background: 'var(--sky)' }}>
        <Meter kind="egg" value={0.62} />
        <Meter kind="wish" value={0.3} />
        <Meter kind="heart" value={0.85} />
        <Meter kind="egg" value={1} size="lg" />
      </div>

      <div className="h-section">Sten-sti og planker</div>
      <div style={{ display: 'grid', gap: 18, maxWidth: 560 }}>
        <ProgressStones total={10} done={0} />
        <ProgressStones total={10} done={4} />
        <ProgressStones total={10} done={7} glow />
        <ProgressStones total={8} done={8} />
        <ProgressStones total={10} done={5} variant="planks" />
      </div>

      <div className="h-section">Bundark</div>
      <Button clip="s.demo.sheetTitle" variant="secondary" size="md" icon="chevronUp" onClick={() => setSheet(true)} />
      <Sheet open={sheet} onClose={() => setSheet(false)} title="s.demo.sheetTitle">
        <SpokenText as="p" clip="s.demo.sheetBody" className="text-body" style={{ marginTop: 0 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[1, 2, 3].map((k) => (
            <AnswerCard key={k} size="lg" state={k === 2 ? 'selected' : 'idle'}>
              {k}
            </AnswerCard>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          <Button clip="s.ui.check" variant="good" icon="check" block onClick={() => setSheet(false)} />
        </div>
      </Sheet>
    </>
  )
}
