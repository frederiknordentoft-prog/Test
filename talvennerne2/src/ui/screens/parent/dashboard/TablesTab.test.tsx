// The times-table tab before the grid has anything to show: the note says where the tables are,
// without claiming they are not in the game yet.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { skillRegistry } from '../../../../engine/registry'
import { buildDashboard } from '../../../../parent/dashboard'
import { profile, source } from '../../../../parent/fixtures'
import { keyIndexOf } from '../../../../parent/load'
import { TablesTab } from './TablesTab'

describe('Tabeller', () => {
  it('without a times-table skill or answer: says the grid fills in when the child starts, and where the tables are', () => {
    const d = buildDashboard(profile(), source())
    expect(d.tables.available).toBe(false)
    const html = renderToStaticMarkup(<TablesTab d={d} />)
    expect(html).toContain('Gitteret fyldes ud, når Ada begynder på gangetabellerne.')
    expect(html).toContain('2-, 5- og 10-tabellen hører til i Regnbueskoven (2. klasse), 3- og 4-tabellen og 6- til 9-tabellen i Stjernefjeldet (3. klasse).')
    expect(html).not.toMatch(/kommer med i spillet|senere/)
  })

  it('shows the grid as soon as the table skills are known (all of them are registered)', () => {
    const d = buildDashboard(profile(), source({ index: keyIndexOf(skillRegistry()) }))
    expect(d.tables.available).toBe(true)
    const html = renderToStaticMarkup(<TablesTab d={d} />)
    expect(html).toContain('Ada er ikke begyndt på gangetabellerne endnu.')
    expect(html).not.toContain('Gitteret fyldes ud')
  })
})
