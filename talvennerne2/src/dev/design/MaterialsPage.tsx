// #materials — every material in its variants, at the sizes tasks use them.
import type { ReactNode } from 'react'
import {
  AnalogClock, BarChart, Banknote, Base10Block, Base10Group, BeadString, Coin, COIN_VALUES, CoordGrid, Die, DigitalClock,
  DoubleTenFrame, Fingers, FractionBars, FractionShape, HundredBoard, NOTE_VALUES, NumberLine, PanScale, Pictogram, Ruler,
  Seesaw, Shape2D, SHAPE_IDS, SHAPE_VARIANTS, Solid3D, SOLID_IDS, SquareGrid, TenFrame, Thing, THING_IDS,
} from '../../art/materials'
import { Equation } from '../../ui/design/Equation'
import { ObjectIcon } from '../../ui/scenes/objects'
import { UNIT_THINGS } from '../../engine/skills/measure/kit2'

/** unitChoice's length things (src/ui/scenes/objects.tsx), at the face sizes of the cards (sm, md, lg). */
const MEASURED = Object.entries(UNIT_THINGS.length)
/** unitChoice's weight things (3. klasse), at the same sizes, so their pictograms can be reviewed beside the length things. */
const WEIGHED = Object.entries(UNIT_THINGS.weight)

function Item({ cap, children }: { cap: string; children: ReactNode }) {
  return (
    <div className="h-tile">
      {children}
      <span className="h-cap">{cap}</span>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="h-cap" style={{ margin: 0, textAlign: 'right', paddingRight: 6 }}>
        {label}
      </span>
      {children}
    </>
  )
}

export function MaterialsPage() {
  return (
    <>
      <h1 className="h-title">Materialer</h1>
      <p className="h-sub">Flade farver, farvet kontur, blød cel-skygge. Samme stil som dyrene.</p>

      <div className="h-section">Mønter (korrekte relative størrelser)</div>
      <div className="h-row">
        {COIN_VALUES.map((v) => (
          <Item key={v} cap={v < 100 ? `${v} øre` : `${v / 100} kr`}>
            <Coin ore={v} />
          </Item>
        ))}
      </div>

      <div className="h-section">Sedler (legepenge)</div>
      <div className="h-row">
        {NOTE_VALUES.map((v) => (
          <Item key={v} cap={`${v} kr`}>
            <Banknote kr={v} />
          </Item>
        ))}
      </div>

      <div className="h-section">Ure</div>
      <div className="h-row">
        <Item cap="kl. 3">
          <AnalogClock minutes={180} size={150} />
        </Item>
        <Item cap="halv 5 (4:30)">
          <AnalogClock minutes={270} size={150} />
        </Item>
        <Item cap="kvart i 10">
          <AnalogClock minutes={585} size={150} />
        </Item>
        <Item cap="forløb 2:15 til 2:45">
          <AnalogClock minutes={165} sweep={{ from: 135, to: 165 }} size={150} />
        </Item>
        <Item cap="14:30">
          <DigitalClock minutes={870} size={170} />
        </Item>
        <Item cap="9:05 (12 t)">
          <DigitalClock minutes={545} h24={false} size={170} />
        </Item>
      </div>

      <div className="h-section">Lineal</div>
      <div style={{ display: 'grid', gap: 12, overflowX: 'auto' }}>
        <Ruler cm={15} />
        <Ruler cm={20} cmPx={17} mark={{ from: 2, to: 9 }} />
      </div>

      <div className="h-section">Multibase</div>
      <div className="h-row">
        <Item cap="ener, stang, plade">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <Base10Block kind="unit" unit={14} />
            <Base10Block kind="rod" unit={14} />
            <Base10Block kind="flat" unit={14} />
          </div>
        </Item>
        <Item cap="53 (5 tiere, 3 enere)">
          <Base10Group t={5} o={3} unit={11} />
        </Item>
        <Item cap="247">
          <Base10Group h={2} t={4} o={7} unit={8} />
        </Item>
      </div>

      <div className="h-section">Ti-rammer, terninger, fingre, perlesnor</div>
      <div className="h-row">
        <Item cap="7">
          <TenFrame n={7} size={200} />
        </Item>
        <Item cap="8 + 2">
          <TenFrame n={8} extra={2} size={200} />
        </Item>
        <Item cap="14">
          <DoubleTenFrame n={14} size={180} />
        </Item>
        {([1, 2, 3, 4, 5, 6] as const).map((d) => (
          <Item key={d} cap={`terning ${d}`}>
            <Die n={d} size={64} />
          </Item>
        ))}
        {[1, 3, 5, 7, 10].map((f) => (
          <Item key={f} cap={`${f} fingre`}>
            <Fingers n={f} size={f > 5 ? 70 : 84} skin={f === 3 ? 'a' : f === 7 ? 'c' : 'b'} />
          </Item>
        ))}
      </div>
      <div style={{ marginTop: 12, overflowX: 'auto' }}>
        <BeadString total={20} left={8} size={560} />
      </div>

      <div className="h-section">Tællelige ting</div>
      <div className="h-row">
        {THING_IDS.map((id) => (
          <Item key={id} cap={id}>
            <Thing id={id} size={56} />
          </Item>
        ))}
      </div>

      <div className="h-section">Ting man måler (46, 78 og 104 px)</div>
      {[46, 78, 104].map((px) => (
        <div key={px} className="h-row" style={{ marginBottom: 12 }}>
          {MEASURED.map(([id, [unit, noun]]) => (
            <Item key={id} cap={`${noun} (${unit}), ${px} px`}>
              <ObjectIcon id={id} size={px} />
            </Item>
          ))}
        </div>
      ))}

      <div className="h-section">Ting man vejer (46, 78 og 104 px)</div>
      {[46, 78, 104].map((px) => (
        <div key={px} className="h-row" data-things="weight" style={{ marginBottom: 12 }}>
          {WEIGHED.map(([id, [unit, noun]]) => (
            <Item key={id} cap={`${noun} (${unit}), ${px} px`}>
              <ObjectIcon id={id} size={px} />
            </Item>
          ))}
        </div>
      ))}

      <div className="h-section">Figurer · 6 varianter</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(6, 1fr)', gap: 6, alignItems: 'center', maxWidth: 640 }}>
        <span />
        {SHAPE_VARIANTS.map((v) => (
          <span key={v} className="h-cap" style={{ margin: 0 }}>
            {v}
          </span>
        ))}
        {SHAPE_IDS.map((s) => (
          <Row key={s} label={s}>
            {SHAPE_VARIANTS.map((_, v) => (
              <Shape2D key={v} shape={s} variant={v} size={64} />
            ))}
          </Row>
        ))}
      </div>
      <div className="h-row" style={{ marginTop: 12 }}>
        <Item cap="hjørner">
          <Shape2D shape="pentagon" mark="corners" size={96} />
        </Item>
        <Item cap="sider">
          <Shape2D shape="hexagon" mark="sides" size={96} />
        </Item>
        <Item cap="delt lige">
          <Shape2D shape="square" cut="equal" size={96} />
        </Item>
        <Item cap="delt skævt">
          <Shape2D shape="circle" cut="unequal" size={96} />
        </Item>
      </div>

      <div className="h-section">Rumlige figurer</div>
      <div className="h-row">
        {SOLID_IDS.map((s) => (
          <Item key={s} cap={s}>
            <Solid3D solid={s} size={96} />
          </Item>
        ))}
      </div>

      <div className="h-section">Vippebræt og skålvægt</div>
      <div className="h-row">
        <Item cap="8 + 4 = ? + 5">
          <Seesaw
            tilt={0}
            width={320}
            left={<Equation size="answer" nowrap terms={[{ n: 8 }, { op: '+' }, { n: 4 }]} />}
            right={<Equation size="answer" nowrap terms={[{ blank: true }, { op: '+' }, { n: 5 }]} />}
          />
        </Item>
        <Item cap="tungest til venstre">
          <PanScale tilt={-1} width={300} left={<Thing id="apple" size={64} />} right={<Thing id="strawberry" size={40} />} />
        </Item>
      </div>

      <div className="h-section">Søjlediagram og piktogram</div>
      <div className="h-row">
        <Item cap="søjler">
          <BarChart data={[{ cat: 'rabbit', n: 5 }, { cat: 'cat', n: 3 }, { cat: 'horse', n: 7 }, { cat: 'fox', n: 2 }]} size={320} />
        </Item>
        <Item cap="piktogram">
          <Pictogram data={[{ cat: 'rabbit', n: 4 }, { cat: 'cat', n: 2 }, { cat: 'horse', n: 5 }]} symbol="apple" size={320} />
        </Item>
      </div>

      <div className="h-section">Brøker</div>
      <div className="h-row">
        <Item cap="3/4 cirkel">
          <FractionShape shape="circle" parts={4} colored={3} size={110} />
        </Item>
        <Item cap="skæv (ikke halve)">
          <FractionShape shape="circle" parts={2} colored={1} equal={false} size={110} />
        </Item>
        <Item cap="2/3 rektangel">
          <FractionShape shape="rect" parts={3} colored={2} size={130} />
        </Item>
        <Item cap="1/4 skæv">
          <FractionShape shape="rect" parts={4} colored={1} equal={false} size={130} />
        </Item>
        <Item cap="5/8 stang">
          <FractionShape shape="bar" parts={8} colored={5} size={220} />
        </Item>
        <Item cap="brøkstænger">
          <FractionBars fracs={['1/2', '1/3', '1/4', '1/6']} whole size={240} />
        </Item>
      </div>

      <div className="h-section">Net, tallinje og 100-tavle</div>
      <div className="h-row">
        <Item cap="koordinatsystem (4, 3)">
          <CoordGrid points={[{ x: 4, y: 3 }]} guide={[4, 3]} size={300} />
        </Item>
        <Item cap="areal og spejling">
          <SquareGrid w={6} h={4} filled={[1, 2, 7, 8, 9, 13, 14, 15]} axis="v" cellPx={34} />
        </Item>
      </div>
      <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
        <NumberLine min={0} max={20} hops={[8, 10, 13]} />
        <NumberLine min={0} max={100} arrowAt={37} />
        <NumberLine min={0} max={1000} target={640} />
        <NumberLine min={0} max={100} endsOnly hops={[38, 40, 83]} />
      </div>
      <div style={{ marginTop: 16, maxWidth: 440 }}>
        <HundredBoard highlight={[23, 33, 43, 53]} mark={[5, 15, 25]} blank={63} size={420} />
      </div>
    </>
  )
}
