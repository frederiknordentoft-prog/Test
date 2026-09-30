// Hash-regression (SPEC §11 pipeline pkt. 6): en hash af renderToStaticMarkup(<Rig/>) pr.
// (art, race, stadie, farve) og pr. genstands-fit. Ændres tegningen med vilje, opdateres
// snapshottet med `npx vitest run -u` – og kontaktarkene gennemses igen.
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { festHead } from './items/fest/fest-head'
import { hverdagBody } from './items/hverdag/hverdag-body'
import { hverdagHead } from './items/hverdag/hverdag-head'
import { Rig } from './rig/Rig'
import { NATURAL_COLORWAYS, STAGES } from './rig/types'
import type { Outfit } from './rig/types'
import { rabbit } from './species/rabbit'

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)

describe('hash-regression', () => {
  it('pr. (art, race, stadie, farve)', () => {
    const out: Record<string, string> = {}
    for (const b of rabbit.breeds)
      for (const stage of STAGES)
        for (const c of [...NATURAL_COLORWAYS, ...rabbit.magic])
          out[`${rabbit.id}/${b.id}/${stage}/${c}`] = hash(
            renderToStaticMarkup(<Rig species={rabbit} breed={b.id} stage={stage} colorway={c} mode="static" />),
          )
    for (const stage of STAGES)
      out[`${rabbit.id}/upright/${stage}/c1★`] = hash(renderToStaticMarkup(<Rig species={rabbit} stage={stage} star mode="static" />))
    expect(Object.keys(out)).toHaveLength(3 * 3 * 8 + 3)
    expect(out).toMatchSnapshot()
  })

  it('pr. genstands-fit (kanin, 3 stadier × 3 farvesæt)', () => {
    const out: Record<string, string> = {}
    for (const it of [hverdagHead, festHead, hverdagBody])
      for (const stage of STAGES)
        for (const cw of [0, 1, 2] as const)
          out[`${it.id}/rabbit/${stage}/${cw}`] = hash(
            renderToStaticMarkup(<Rig species={rabbit} stage={stage} mode="static" outfit={{ [it.slot]: { item: it, colorway: cw } } as Outfit} />),
          )
    expect(out).toMatchSnapshot()
  })
})
