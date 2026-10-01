// Materials library: renders every material in its variants (no NaN, no forbidden SVG elements),
// and checks the facts the tasks rely on – coin sizes and colours, clock hands, digital time,
// notes marked "legepenge", the number-line mapping.
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  AnalogClock, BarChart, Banknote, Base10Block, Base10Group, BeadString, Coin, COIN_MM, COIN_VALUES, CoordGrid, Die,
  DigitalClock, digitalText, DoubleTenFrame, Fingers, FractionBars, FractionShape, handAngles, Hand, HundredBoard, MAT,
  MINUTE_HAND, NL, NOTE_VALUES, NumberLine, PanScale, Pictogram, Ruler, Seesaw, Shape2D, SHAPE_IDS, SHAPE_VARIANTS, Solid3D, SOLID_IDS,
  SquareGrid, TenFrame, Thing, THING_IDS, xOf,
} from '.'

const FORBIDDEN = /<(filter|mask|foreignObject|image)[\s>/]/i
const render = (el: ReactElement) => renderToStaticMarkup(el)

function clean(html: string, what: string) {
  expect(html, what).not.toMatch(FORBIDDEN)
  expect(html, what).not.toMatch(/NaN|undefined|Infinity/)
}

describe('every material renders cleanly', () => {
  const cases: [string, ReactElement][] = [
    ...COIN_VALUES.map((v) => [`coin ${v}`, <Coin ore={v} />] as [string, ReactElement]),
    ...NOTE_VALUES.map((v) => [`note ${v}`, <Banknote kr={v} />] as [string, ReactElement]),
    ['clock', <AnalogClock minutes={585} sweep={{ from: 135, to: 165 }} />],
    ['clock no hands', <AnalogClock minutes={null} />],
    ['digital', <DigitalClock minutes={870} />],
    ['ruler', <Ruler cm={20} mark={{ from: 2, to: 9 }} />],
    ['base10', <Base10Group h={3} t={9} o={9} />],
    ['base10 fanned', <Base10Group h={7} t={0} o={4} order="oth" />],
    ['block', <Base10Block kind="flat" />],
    ['tenframe', <TenFrame n={8} extra={2} ghosts />],
    ['double', <DoubleTenFrame n={17} />],
    ...[1, 2, 3, 4, 5, 6].map((d) => [`die ${d}`, <Die n={d as 1 | 2 | 3 | 4 | 5 | 6} />] as [string, ReactElement]),
    ...[0, 1, 2, 3, 4, 5].map((k) => [`hand ${k}`, <Hand n={k} side={k % 2 ? 'left' : 'right'} />] as [string, ReactElement]),
    ['fingers 8', <Fingers n={8} skin="c" />],
    ['beads', <BeadString total={20} left={7} />],
    ...THING_IDS.map((id) => [`thing ${id}`, <Thing id={id} />] as [string, ReactElement]),
    ...SOLID_IDS.map((s) => [`solid ${s}`, <Solid3D solid={s} />] as [string, ReactElement]),
    ['seesaw', <Seesaw tilt={1} left="a" right="b" />],
    ['scale', <PanScale tilt={-1} left="a" right="b" />],
    ['bars', <BarChart data={[{ cat: 'cat', n: 3 }, { cat: 'fox', n: 9 }]} />],
    ['picto', <Pictogram data={[{ cat: 'cat', n: 3 }]} />],
    ['fraction circle', <FractionShape shape="circle" parts={3} colored={2} equal={false} />],
    ['fraction rect', <FractionShape shape="rect" parts={4} colored={1} on={[0, 2]} />],
    ['fraction bar', <FractionShape shape="bar" parts={8} colored={5} />],
    ['bars of fractions', <FractionBars fracs={['1/2', '2/3', '3/4']} whole />],
    ['coords', <CoordGrid points={[{ x: 0, y: 0 }, { x: 6, y: 6 }]} guide={[2, 5]} />],
    ['grid', <SquareGrid w={6} h={6} filled={[0, 7, 35]} axis="h" />],
    ['board', <HundredBoard highlight={[1, 100]} mark={[50]} blank={64} />],
    ['line 20', <NumberLine min={0} max={20} hops={[8, 10, 13]} arrowAt={4} target={13} />],
    ['line 100', <NumberLine min={0} max={100} endsOnly hops={[38, 40, 83]} />],
    ['line 1000', <NumberLine min={0} max={1000} target={640} />],
  ]
  for (const [name, el] of cases) it(name, () => clean(render(el), name))

  it('every plane figure in all six variants, with hint overlays', () => {
    for (const s of SHAPE_IDS)
      for (let v = 0; v < SHAPE_VARIANTS.length; v++) clean(render(<Shape2D shape={s} variant={v} mark={v === 0 ? 'corners' : v === 1 ? 'sides' : undefined} cut={v === 2 ? 'unequal' : undefined} />), `${s}/${v}`)
  })
})

describe('money', () => {
  it('keeps the real relative coin sizes', () => {
    const order = [...COIN_VALUES].sort((a, b) => COIN_MM[a] - COIN_MM[b])
    expect(order).toEqual([100, 50, 1000, 200, 2000, 500])
    const width = (v: (typeof COIN_VALUES)[number]) => Number(/width="([\d.]+)"/.exec(render(<Coin ore={v} mm={4} />))![1])
    expect(width(500) / width(100)).toBeCloseTo(28.5 / 20.25, 2)
  })

  it('colours copper, silver with a hole, and gold', () => {
    expect(render(<Coin ore={50} />)).toContain(MAT.copper.fill)
    for (const v of [100, 200, 500] as const) {
      const html = render(<Coin ore={v} />)
      expect(html).toContain(MAT.silver.fill)
      expect(html).toContain('evenodd')
    }
    for (const v of [1000, 2000] as const) {
      const html = render(<Coin ore={v} />)
      expect(html).toContain(MAT.gold.fill)
      expect(html).not.toContain('evenodd')
    }
  })

  it('writes the value on every coin and "legepenge" on every note; there is no 1000 note', () => {
    expect(render(<Coin ore={2000} />)).toContain('>20<')
    expect(render(<Coin ore={50} />)).toContain('>50<')
    for (const v of NOTE_VALUES) {
      const html = render(<Banknote kr={v} />)
      expect(html).toContain('legepenge')
      expect(html).toContain(`>${v}<`)
    }
    expect(NOTE_VALUES as readonly number[]).not.toContain(1000)
  })
})

describe('clocks', () => {
  it('turns the hands like a real clock', () => {
    expect(handAngles(180)).toEqual({ hour: 90, minute: 0 })
    expect(handAngles(270)).toEqual({ hour: 135, minute: 180 })
    expect(handAngles(585)).toEqual({ hour: 292.5, minute: 270 })
    expect(handAngles(720 + 30)).toEqual(handAngles(30))
  })

  it('draws a short ink hour hand, a long coral minute hand and 12 numbers', () => {
    const html = render(<AnalogClock minutes={0} />)
    expect(html).toContain(MAT.face.fill)
    expect(html).toContain(MINUTE_HAND)
    for (let h = 1; h <= 12; h++) expect(html).toContain(`>${h}<`)
  })

  it('formats digital time', () => {
    expect(digitalText(870)).toBe('14:30')
    expect(digitalText(545, false)).toBe('9:05')
    expect(digitalText(780, false)).toBe('1:00')
    expect(digitalText(5)).toBe('0:05')
  })
})

describe('number line', () => {
  it('maps the ends to the padded edges', () => {
    expect(xOf(0, 0, 100)).toBe(NL.PAD)
    expect(xOf(100, 0, 100)).toBe(NL.W - NL.PAD)
    expect(xOf(50, 0, 100)).toBe(NL.W / 2)
  })

  it('labels 0–100 in tens and 0–1000 in hundreds', () => {
    const labels = (html: string) => [...html.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]))
    expect(labels(render(<NumberLine min={0} max={100} />))).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(labels(render(<NumberLine min={0} max={1000} />))).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000])
    expect(labels(render(<NumberLine min={0} max={20} />))).toHaveLength(21)
  })
})
