// convertCmM in Markedet (w3-penge-maal, SPEC §5.3–5.4) and the finale of Stjernefjeldet: regionSuite plays
// Markedet's five skills together (convertCmM, kronerOre and the 3. klasse families of change, payExact and
// unitChoice; money3.regions.test.ts has the region's own checks), so every node gets a playable round of
// recorded clips, the trial asks only for production, and every clip of clips/skills/measure3.ts is spoken
// and recorded in wave 3.
import { regionSuite } from '../algebra/testing/regions'
import type { SkillId } from '../../types'

const MARKET: ReadonlySet<SkillId> = new Set<SkillId>(['change', 'kronerOre', 'convertCmM', 'unitChoice', 'payExact'])

regionSuite('Markedet (convertCmM beside kronerOre, change, payExact and unitChoice)', MARKET, 'measure3.ts', 'measure-3', { wave: 3 })
