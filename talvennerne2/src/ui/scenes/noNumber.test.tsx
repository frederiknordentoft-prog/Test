// QA3b: an uneven deal on the share view is handed in as −1 (share/logic.ts SHARE_UNEQUAL), and the
// equation on the card showed it as the child's number: "4 : 2 = −1", struck. The blank shows "?"
// for it instead; a number the child really made is shown as before.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { factsOf, getSkill, kindsOf } from '../../engine/registry'
import { makeRng } from '../../engine/rng'
import { buildTask } from '../../engine/tasks'
import type { AnswerValue, Task } from '../../engine/types'
import { SHARE_UNEQUAL, shareValue } from '../task/share/logic'
import { PromptScene, noNumber } from './PromptScene'

function shareTask(factId: string): Task {
  const def = getSkill('div2510')!
  const fact = factsOf(def).find((f) => f.id === factId)!
  expect(kindsOf(def, fact)).toContain('share')
  return buildTask(def, fact, 'share', makeRng(1), 0, { mode: 'round', box: 1 }).task
}

/** The card as the round draws it after a wrong answer: the struck entry the round made, and the value. */
const struckCard = (task: Task, given: AnswerValue, shown: string) =>
  renderToStaticMarkup(
    <PromptScene prompt={task.prompt} task={task} entry={<span className="tv-struck">{shown}</span>} given={given} slot="oops" />,
  )

describe('a value that stands for no number (QA3b)', () => {
  it('"Hvad er 4 divideret med 2?" dealt 4 and 0: "4 : 2 = ?" with the ? struck, never −1', () => {
    const task = shareTask('div:4/2')
    expect(task.prompt.scene).toBe('equation')
    const given = shareValue(task, [4, 0])
    expect(given).toBe(SHARE_UNEQUAL)
    expect(noNumber(task, given)).toBe(true)
    const html = struckCard(task, given, '−1')
    expect(html).not.toMatch(/−1|-1/)
    expect(html).toMatch(/<span class="tv-struck">\?<\/span>/)
    expect(html).toContain('is-oops')
  })

  it('shows an even deal the child made, wrong or not, as its number', () => {
    const task = shareTask('div:4/2')
    expect(noNumber(task, 1)).toBe(false)
    expect(struckCard(task, 1, '1')).toMatch(/<span class="tv-struck">1<\/span>/)
    expect(noNumber(task, 0)).toBe(false)
  })

  it('is only the share view\'s −1: a −1 from any other kind is not taken for it', () => {
    const task = shareTask('div:4/2')
    expect(noNumber({ ...task, kind: 'keypad' }, -1)).toBe(false)
    expect(noNumber(undefined, -1)).toBe(false)
    expect(noNumber(task, null)).toBe(false)
  })
})
