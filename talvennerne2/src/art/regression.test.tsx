// Hash-regression (SPEC §11 pipeline pkt. 6): en hash af renderToStaticMarkup(<Rig/>) pr.
// (art, race, stadie, farve) og pr. genstands-fit for alle arter. Ændres tegningen med vilje,
// opdateres snapshottet med `npx vitest run -u` – og kontaktarkene gennemses igen.
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { festHead } from './items/fest/fest-head'
import { hverdagBody } from './items/hverdag/hverdag-body'
import { hverdagHead } from './items/hverdag/hverdag-head'
import { Rig, magicOf } from './rig/Rig'
import { NATURAL_COLORWAYS, STAGES } from './rig/types'
import type { Outfit, SpeciesDef } from './rig/types'
import { cat } from './species/cat'
import { horse } from './species/horse'
import { rabbit } from './species/rabbit'
import { unicorn } from './species/unicorn'

// Tunge gennemløb af alle kombinationer: robuste når andre agenter belaster CPU'en.
vi.setConfig({ testTimeout: 120_000 })

const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const SPECIES: readonly SpeciesDef[] = [rabbit, cat, horse, unicorn]

describe.each(SPECIES.map((d) => [d.id, d] as const))('hash-regression · %s', (_id, def) => {
  it('pr. (art, race, stadie, farve) og stjerneform', () => {
    const out: Record<string, string> = {}
    let n = 0
    for (const b of def.breeds)
      for (const stage of STAGES)
        for (const c of [...NATURAL_COLORWAYS, ...magicOf(def, b.id)]) {
          out[`${def.id}/${b.id}/${stage}/${c}`] = hash(renderToStaticMarkup(<Rig species={def} breed={b.id} stage={stage} colorway={c} mode="static" />))
          n++
        }
    for (const stage of STAGES) out[`${def.id}/${def.breeds[0].id}/${stage}/c1★`] = hash(renderToStaticMarkup(<Rig species={def} stage={stage} star mode="static" />))
    expect(Object.keys(out)).toHaveLength(n + 3)
    expect(out).toMatchSnapshot()
  })

  it('pr. genstands-fit (3 stadier · 3 farvesæt)', () => {
    const out: Record<string, string> = {}
    for (const it of [hverdagHead, festHead, hverdagBody])
      for (const stage of STAGES)
        for (const cw of [0, 1, 2] as const)
          out[`${it.id}/${def.id}/${stage}/${cw}`] = hash(
            renderToStaticMarkup(<Rig species={def} stage={stage} mode="static" outfit={{ [it.slot]: { item: it, colorway: cw } } as Outfit} />),
          )
    expect(out).toMatchSnapshot()
  })
})
