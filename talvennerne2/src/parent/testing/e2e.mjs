// Click-through of the parent dashboard on the dev server with the demo household: tabs, a profile
// switch and back, a setting, export → import as a new child, the print report, and deleting a child.
//   flock /tmp/tv2-chromium.lock node src/parent/testing/e2e.mjs
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { launch } from '../../../scripts/browser.mjs'

const BASE = process.env.BASE ?? 'http://localhost:4311/'
const OUT = fileURLToPath(new URL('../../../artifacts/dash/', import.meta.url))
mkdirSync(OUT, { recursive: true })

const fails = []
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`)
  if (!ok) fails.push(what)
}

const browser = await launch()
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(BASE)
  await page.waitForSelector('.tv-shell', { timeout: 30_000 })
  const ids = await page.evaluate(async () => {
    const { seedDemo } = await import('/src/parent/testing/demo.ts')
    const { useSession } = await import('/src/state/useSession.ts')
    const { useNav } = await import('/src/app/nav.ts')
    const ids = await seedDemo()
    await useSession.getState().refreshProfiles()
    await useSession.getState().selectProfile(ids.ada)
    useNav.getState().root({ id: 'map' })
    useNav.getState().go({ id: 'parent' })
    return ids
  })
  await page.waitForSelector('.tv-dash .tv-dstats', { timeout: 30_000 })
  const active = () => page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile?.name ?? null)
  const route = () => page.evaluate(async () => (await import('/src/app/nav.ts')).useNav.getState().route)

  // every tab renders
  for (const tab of ['Pensumkort', 'Færdigheder', 'Tabeller', 'Misforståelser', 'Belønninger', 'Indstillinger', 'Overblik']) {
    await page.getByRole('button', { name: tab, exact: true }).click()
    await page.waitForTimeout(150)
    check((await page.locator('.tv-dash__content .tv-dsec').count()) > 0, `fanen ${tab} viser indhold`)
  }
  check((await route()).tab === 'overview', 'ruten husker fanen')

  // the curriculum row opens to name its skills
  await page.getByRole('button', { name: 'Pensumkort', exact: true }).click()
  await page.locator('.tv-dmap__row').first().click()
  check(await page.getByText('Tælle til 10').first().isVisible(), 'pensumkortets række viser færdighedernes navne')

  // looking at a sibling and going back restores the child who was playing
  await page.getByRole('radio', { name: /Bo/ }).click()
  await page.waitForFunction(() => document.querySelector('.tv-dash__title')?.textContent?.startsWith('Bos'))
  check((await active()) === 'Bo', 'profilskift viser Bo')
  await page.getByRole('button', { name: 'Overblik', exact: true }).click()
  await page.waitForSelector('.tv-dstats')
  check(await page.getByText('Vi ved endnu for lidt').isVisible(), 'Bo: niveau "Vi ved endnu for lidt"')
  await page.getByRole('radio', { name: /Ada/ }).click()
  await page.waitForFunction(() => document.querySelector('.tv-dash__title')?.textContent?.startsWith('Adas'))

  // a setting is saved on the child
  await page.getByRole('button', { name: 'Indstillinger', exact: true }).click()
  await page.getByRole('switch', { name: /Rolig animation/ }).click()
  const calm = await page.evaluate(async () => (await import('/src/state/useProfile.ts')).useProfile.getState().profile?.settings.calm)
  check(calm === true, 'rolig animation slås til for Ada')
  await page.getByRole('switch', { name: /Rolig animation/ }).click()

  // export (built before the tap) → import as a new child
  await page.getByRole('button', { name: 'Gem en kopi' }).waitFor({ timeout: 10_000 })
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Gem en kopi' }).click()])
  const file = `${OUT}e2e-export.json`
  await download.saveAs(file)
  const json = JSON.parse(readFileSync(file, 'utf8'))
  check(json.format === 'talvennerne2-export' && json.profiles[0].doc.name === 'Ada', `eksporten er en talvennerne2-fil (${download.suggestedFilename()})`)
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByText('Filen indeholder Ada').waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Tilføj som ny spiller' }).click()
  await page.getByText('er tilføjet som ny spiller').waitFor({ timeout: 10_000 })
  check((await page.getByRole('radio').count()) === 3, 'importen tilføjer en tredje spiller')

  // the print report: alone, grouped by Fælles Mål, without perler or animals
  await page.emulateMedia({ media: 'print' })
  const report = await page.locator('.tv-print').innerText()
  check(report.includes('Tal og algebra') && report.includes('Geometri og måling'), 'rapporten er grupperet efter Fælles Mål')
  check(!/perle|kanin|kat\b|hvalp|dyr/i.test(report), 'rapporten nævner hverken perler eller dyr')
  check(!(await page.locator('.tv-dash').isVisible()), 'kun rapporten vises ved udskrift')
  await page.screenshot({ path: `${OUT}print.png`, fullPage: true })
  await page.emulateMedia({ media: 'screen' })

  // delete the imported child: confirmation first, then the picker
  await page.getByRole('radio').nth(2).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Indstillinger', exact: true }).click()
  await page.getByRole('button', { name: /^Slet .* profil$/ }).click()
  await page.getByRole('button', { name: 'Slet', exact: true }).click()
  await page.waitForFunction(async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'profiles', null, { timeout: 10_000 })
  const left = await page.evaluate(async () => (await import('/src/state/useSession.ts')).useSession.getState().profiles.map((p) => p.name))
  check(left.length === 2 && left.includes('Ada') && left.includes('Bo'), `slet fjerner kun den valgte (${left.join(', ')})`)

  // back from the dashboard returns to the map with Ada
  await page.evaluate(async (ada) => {
    const { useSession } = await import('/src/state/useSession.ts')
    const { useNav } = await import('/src/app/nav.ts')
    await useSession.getState().selectProfile(ada)
    useNav.getState().root({ id: 'map' })
    useNav.getState().go({ id: 'parent' })
  }, ids.ada)
  await page.waitForSelector('.tv-dash .tv-dstats')
  await page.getByRole('radio', { name: /Bo/ }).click()
  await page.waitForFunction(() => document.querySelector('.tv-dash__title')?.textContent?.startsWith('Bos'))
  await page.getByRole('button', { name: 'Tilbage' }).click()
  await page.waitForFunction(async () => (await import('/src/app/nav.ts')).useNav.getState().route.id === 'map', null, { timeout: 10_000 })
  check((await active()) === 'Ada', 'tilbage-knappen giver kortet med Ada igen')

  check(errors.length === 0, `ingen sidefejl${errors.length ? `: ${errors.join(' | ')}` : ''}`)
} finally {
  await browser.close()
}
if (fails.length) {
  console.error(`${fails.length} fejl`)
  process.exit(1)
}
