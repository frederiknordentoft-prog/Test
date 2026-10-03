import { describe, expect, it } from 'vitest'
import { planCeremonies } from '../../../../meta/ceremonyQueue'
import type { Reward } from '../../../../meta/rewards'
import type { SpeechPart } from '../../../../engine/types'
import { hasClip } from '../../../../speech/catalog'
import { thingSpeech } from './Steps'

/**
 * A thing from medals waits for its drawing (review app-w2-r1 P2-6), so its ceremony may come
 * rounds after the medal that earned it. The screen then says why it comes: "Den får du, når du har
 * fået 2 sølvmedaljer" after its name. Other things keep their own words.
 */
const clips = (parts: readonly SpeechPart[]) => parts.flatMap((p) => ('clip' in p ? [p.clip] : []))
const learned: Reward = { t: 'learned', promoted: [], firsts: [], statuses: [], practiced: ['addTo10'], next: null }
const thingStep = (r: Reward) => planCeremonies([learned, r]).steps.find((s) => s.kind === 'thing')!

describe('the ceremony of a thing earned by medals', () => {
  it('says what the medals were after the name, also when it comes in a round without a medal', () => {
    const step = thingStep({ t: 'item', item: 'ridder-head', source: { kind: 'medal', tier: 'silver', count: 2 } })
    const parts = thingSpeech(step)
    expect(clips(parts)).toEqual(['s.reward.item.new', 'name.item.ridder-head', 's.wardrobe.how.medal', 's.wardrobe.how.silver.end'])
    expect(parts).toContainEqual({ num: 2, form: 'mid' })
    for (const id of clips(parts).filter((c) => c.startsWith('s.'))) expect(hasClip(id), id).toBe(true)
  })

  it('uses one gold medal in the singular', () => {
    const step = thingStep({ t: 'item', item: 'talmagiker-head', source: { kind: 'medal', tier: 'gold', count: 1 } })
    expect(clips(thingSpeech(step)).slice(-1)).toEqual(['s.wardrobe.how.gold.one.end'])
  })

  it('leaves a chest thing as it was', () => {
    const step = thingStep({ t: 'item', item: 'opdager-head', source: { kind: 'chest', nodeId: 'w0-former-chest' } })
    expect(clips(thingSpeech(step))).toEqual(['s.reward.chest', 'name.item.opdager-head'])
  })
})
