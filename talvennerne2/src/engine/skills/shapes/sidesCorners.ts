// sidesCorners — Sider og hjørner (SPEC §2.2, pædagogik-forslaget §1.3). Recall, 30 facts, prefix `sc:`.
//   sides    sc:s:<shape>:<variant>   "Hvor mange sider har figuren?"     15
//   corners  sc:c:<shape>:<variant>   "Hvor mange hjørner har figuren?"   15
// Figures: trekant, firkant, femkant, sekskant and ottekant, each standard (variant 0), turned (1) and
// skew (2, the irregular one), as the materials draw them. Introduced by family, then variant, then
// figure. The prompt is the figure ({ scene: 'shape' }); the answer is a number 0–12 (SPEC §2.2).
// choice: three number cards. keypad (production): 0–12, so a guess is 1 in 13.
// Wrong answers: one corner counted twice or one missed (±1) is 'near', anything else 'other'. There
// is no misconception for this skill in the catalogue (SPEC §4.2).
// Hint: the figure with its corners (or sides) marked — "Sæt en finger på et hjørne, og tæl hjørnerne
// hele vejen rundt. Figuren har seks hjørner." After a ±1 the strategy is to stop where you started.
import type { Fact, ShapeId, TaskKind } from '../../types'
import type { SkillModule } from '../types'
import { hintOf, metaOf, num, say, tagged, type Entry } from '../number/kit'
import { CORNERS } from './geo'

type Family = 'sides' | 'corners'

const SHAPES: readonly ShapeId[] = ['triangle', 'quadrilateral', 'pentagon', 'hexagon', 'octagon']
const VARIANTS = [0, 1, 2] as const
const FAMILIES: readonly Family[] = ['sides', 'corners']
const CODE: Readonly<Record<Family, string>> = { sides: 's', corners: 'c' }

interface Parsed {
  family: Family
  shape: ShapeId
  variant: number
  n: number
}

/** The question from its id (also for a fact the round screen rebuilt from its task). */
function parse(f: Pick<Fact, 'id'>): Parsed {
  const [, code, shape, variant] = f.id.split(':')
  const family: Family = code === 's' ? 'sides' : 'corners'
  return { family, shape: shape as ShapeId, variant: Number(variant), n: CORNERS[shape as ShapeId] }
}

const FACTS: readonly Fact[] = FAMILIES.flatMap((family, fi) =>
  VARIANTS.flatMap((variant, vi) =>
    SHAPES.map((shape, si) => ({
      id: `sc:${CODE[family]}:${shape}:${variant}`,
      skill: 'sidesCorners' as const,
      family,
      operands: [],
      answer: CORNERS[shape],
      rank: fi * 100 + vi * 10 + si,
    })),
  ),
)

function candidates(f: Fact) {
  const { n } = parse(f)
  const entries: Entry[] = [[n - 1, 'near'], [n + 1, 'near']]
  for (const other of [...new Set(Object.values(CORNERS))]) entries.push([other, 'other'])
  entries.push([n + 2, 'other'], [n - 2, 'other'])
  return tagged(n, entries)
}

function hint(f: Fact, tag: string | null) {
  const { family, shape, variant, n } = parse(f)
  const lead = tag === 'near' ? `hint.sidesCorners.once.${family}` : `hint.sidesCorners.count.${family}`
  return hintOf(
    [say(lead), say('hint.sidesCorners.has'), num(n, 'mid'), say(`hint.sidesCorners.${family}`)],
    { scene: 'shape', shape, variant, mark: family === 'corners' ? 'corners' : 'sides' },
  )
}

export default {
  ...metaOf('sidesCorners'),
  kinds: ['choice', 'keypad'],
  enumerate: () => [...FACTS],
  answerType: () => 'int',
  prompt: (f: Fact) => {
    const { shape, variant } = parse(f)
    return { scene: 'shape', shape, variant }
  },
  optionView: () => 'numeral',
  range: () => [0, 12],
  speech: (f: Fact, _kind: TaskKind) => [say(`s.sidesCorners.howMany.${parse(f).family}`)],
  candidates,
  hint: (f, tag) => hint(f, tag),
} satisfies SkillModule
