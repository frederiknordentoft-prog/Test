// Unit tests for the voice pipeline's TypeScript side: the inventory (hash rule, completeness),
// the composition renderer (runtime planning) and the sprite layout of pack.mjs.
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { allClips, generationText } from '../../src/speech/catalog'
import { compile } from '../../src/speech/compile'
import { buildInventory, clipHash, formatInventory, settingsKey, type VoiceConfig } from './inventory'
import { renderClips, wavBytes, SR } from './render'
// @ts-expect-error plain ES module without types
import { BUDGET, PINNED, layout } from './pack.mjs'

const CONFIG: VoiceConfig = {
  voice: 'nic',
  modelRepo: 'CoRal-project/roest-v3-chatterbox-500m',
  modelRev: '7ce205cea6b3b36d9f60f18abb88ff21fa04ea0d',
  prompt: 'audio_samples/00_nic_01_t0.8_p0.95_e0.5_c0.5_m0.05_r2.0.wav',
  settings: { language_id: 'da', temperature: 0.6, top_p: 0.95, min_p: 0.05, repetition_penalty: 2.0, cfg_weight: 0.3, exaggeration: 0.5 },
  pipeline: 'D1',
}

describe('inventory', () => {
  const inv = buildInventory(allClips(), CONFIG, 'x')

  it('has every catalogue clip once, sorted, with the generator text', () => {
    expect(inv.count).toBe(allClips().length)
    const ids = inv.clips.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
    for (const c of inv.clips) expect(c.genText).toBe(generationText(c.id))
  })

  it('hashes sha1(genText|voice|settings|modelRev)', () => {
    const c = inv.clips.find((x) => x.id === 'n.mid.7')!
    expect(c.genText).toBe('syv,')
    const want = createHash('sha1').update(`syv,|nic|${settingsKey(CONFIG)}|${CONFIG.modelRev}`).digest('hex')
    expect(c.hash).toBe(want)
    expect(clipHash('syv,', { ...CONFIG, voice: 'mic' })).not.toBe(want)
    expect(clipHash('syv,', { ...CONFIG, pipeline: 'D2' })).not.toBe(want)
    expect(clipHash('syv,', { ...CONFIG, settings: { ...CONFIG.settings, temperature: 0.7 } })).not.toBe(want)
  })

  it('keeps settings canonical (sorted keys, pipeline included)', () => {
    const key = settingsKey(CONFIG)
    expect(Object.keys(JSON.parse(key))).toEqual([...Object.keys(JSON.parse(key))].sort())
    expect(JSON.parse(key).pipeline).toBe('D1')
  })

  it('carries what the Python side needs to compose like the runtime', () => {
    const by = new Map(inv.clips.map((c) => [c.id, c]))
    expect(by.get('hog.300')).toMatchObject({ cls: 'seam', form: null })
    expect(by.get('n.mid.7')).toMatchObject({ cls: 'mid', form: 'mid', opens: false })
    expect(by.get('frag.hvad_er')).toMatchObject({ cls: 'phrase', opens: true })
    expect(JSON.parse(formatInventory(inv)).clips.length).toBe(inv.count)
  })
})

describe('renderClips (runtime planning on masters)', () => {
  const tone = (ms: number, hz: number) => {
    const lead = Math.round(0.02 * SR)
    const tail = Math.round(0.04 * SR)
    const n = Math.round((ms / 1000) * SR)
    const out = new Float32Array(lead + n + tail)
    for (let i = 0; i < n; i++) out[lead + i] = 0.4 * Math.sin((2 * Math.PI * hz * i) / SR)
    return out
  }

  it('puts the requested silences between the audible parts', () => {
    const parts = compile([{ clip: 'frag.hvad_er' }, { num: 7, form: 'mid' }, { clip: 'op.plus' }, { num: 5, form: 'end' }])
    expect(parts.gapsMs).toEqual([40, 120, 40])
    const src: Record<string, Float32Array> = {}
    parts.clips.forEach((id, i) => (src[id] = tone(300, 300 + 100 * i)))
    const out = renderClips(parts.clips, parts.gapsMs, (id) => src[id])
    const thr = Math.pow(10, -45 / 20)
    const runs: [number, number][] = []
    for (let i = 0; i < out.length; i++) {
      if (Math.abs(out[i]) < thr) continue
      const last = runs[runs.length - 1]
      if (last && i - last[1] < SR * 0.003) last[1] = i
      else runs.push([i, i])
    }
    expect(runs.length).toBe(4)
    const gaps = runs.slice(1).map((r, i) => ((r[0] - runs[i][1] - 1) * 1000) / SR)
    gaps.forEach((g, i) => expect(Math.abs(g - parts.gapsMs[i])).toBeLessThan(1.5))
  })

  it('writes 16-bit mono WAV', () => {
    const b = wavBytes(new Float32Array([0, 0.5, -0.5]))
    expect(b.subarray(0, 4).toString()).toBe('RIFF')
    expect(b.readUInt32LE(24)).toBe(SR)
    expect(b.length).toBe(44 + 6)
  })
})

describe('sprite layout (pack.mjs)', () => {
  it('keeps every sprite at or under 60 s and names splits <pack>.1, <pack>.2', () => {
    const clips = Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, samples: 2 * SR }))
    const sprites = layout('names-1', clips)
    expect(sprites.length).toBe(2)
    expect(sprites.map((s: { id: string }) => s.id)).toEqual(['names-1.1', 'names-1.2'])
    for (const s of sprites as { clips: { samples: number }[] }[]) {
      const ms = 100 + s.clips.reduce((t, c) => t + (c.samples / SR) * 1000, 0) + 120 * (s.clips.length - 1) + 200
      expect(ms).toBeLessThanOrEqual(60_000)
    }
    expect(layout('core', clips.slice(0, 3))[0].id).toBe('core')
  })

  it('has the SPEC budgets and preloaded packs', () => {
    expect(BUDGET.sprite).toBe(300 * 1024)
    expect(BUDGET.pinned).toBeCloseTo(1.2 * 1024 * 1024)
    expect(BUDGET.total).toBe(16 * 1024 * 1024)
    expect([...PINNED].sort()).toEqual(['core', 'n0-20', 'ui'])
  })
})
