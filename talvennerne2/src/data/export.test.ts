import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PROFILES } from '../content/catalog'
import { makeRng } from '../engine/rng'
import { buildAddTask } from '../engine/testing/addFacts'
import type { AnswerLogEntry, ProfileDoc } from '../engine/types'
import { roundHooks, useProfile } from '../state/useProfile'
import { useRound } from '../state/useRound'
import { getDb } from './db'
import {
  EXPORT_ANSWER_DAYS, EXPORT_FORMAT, EXPORT_VERSION, buildExport, exportFileName, importProfile, parseExport, readImportFile,
  serializeExport, shareExport, validateExport, type ExportFile,
} from './export'
import { answersBetween } from './repo/answers'
import { allDaily } from './repo/daily'
import { ProfileLimitError, createProfile, getProfile, listProfiles } from './repo/profiles'
import { freshDb } from './testing/freshDb'

const FIXTURE_V1 = fileURLToPath(new URL('../../test/fixtures/export-v1.json', import.meta.url))
const fixtureText = () => readFileSync(FIXTURE_V1, 'utf8')

const DAY_MS = 86_400_000
const NOW = Date.parse('2026-10-01T09:00:00Z')

function fixture(): ExportFile {
  const r = parseExport(fixtureText())
  if (!r.ok) throw new Error(`fixture: ${r.message} ${r.errors.join('; ')}`)
  return r.file
}

const strip = (rows: AnswerLogEntry[]) => rows.map(({ seq: _seq, ...rest }) => rest)

beforeEach(async () => {
  useRound.getState().quit()
  await useProfile.getState().unload({ discard: true })
  await freshDb()
})

afterEach(() => vi.restoreAllMocks())

/** A profile with a history: the v1 fixture imported, then a few more answers today. */
async function playedProfile(): Promise<ProfileDoc> {
  const doc = await importProfile(fixture().profiles[0], { mode: 'new' })
  await useProfile.getState().loadProfile(doc.id)
  useProfile.getState().setContext({ sessionId: 's_today', audioVerified: true })
  for (let i = 0; i < 4; i++) {
    const t = buildAddTask({ id: `add:${i}+5`, a: i, b: 5, answer: i + 5, rank: i + 5 }, 'keypad', makeRng(i), 0)
    useProfile.getState().recordAnswer({
      task: t, given: i + 5, correct: true, ms: 2500, fast: true, production: true, ceiling: 5, mode: 'round', assisted: false,
      retryOf: null, replays: 0, ts: NOW - 3600_000 + i * 5000, roundId: 'r_today', sessionId: 's_today', nodeId: 'w0-plus10-l1',
    })
  }
  await useProfile.getState().flush()
  return useProfile.getState().profile!
}

describe('export', () => {
  it('holds the document, every day and the last 30 days of answers', async () => {
    const doc = await playedProfile()
    // an answer older than 30 days stays on the device but is not exported
    const old = { ...(await answersBetween(doc.id, 0))[0], ts: NOW - (EXPORT_ANSWER_DAYS + 1) * DAY_MS }
    delete old.seq
    await getDb().answers.add(old)
    const file = await buildExport([doc.id], NOW)
    expect(file).toMatchObject({ format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: NOW })
    const [entry] = file.profiles
    expect(entry.doc).toEqual(await getProfile(doc.id))
    expect(entry.daily).toEqual(await allDaily(doc.id))
    expect(entry.answers.every((a) => a.ts >= NOW - EXPORT_ANSWER_DAYS * DAY_MS && !('seq' in a))).toBe(true)
    expect(entry.answers).toHaveLength((await answersBetween(doc.id, 0)).length - 1)
    expect(validateExport(JSON.parse(serializeExport(file)))).toMatchObject({ ok: true })
  })

  it('then import gives an identical profile (Erstat denne profil)', async () => {
    const doc = await playedProfile()
    const text = serializeExport(await buildExport([doc.id], NOW))
    // the child plays on after the export …
    useProfile.getState().update((d) => ({ ...d, economy: { ...d.economy, perler: d.economy.perler + 50 } }))
    useProfile.getState().trackPlay(60_000, NOW)
    await useProfile.getState().unload()
    // … and the parent restores the backup
    const parsed = parseExport(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const restored = await importProfile(parsed.file.profiles[0], { mode: 'replace', profileId: doc.id })
    const again = await buildExport([doc.id], NOW)
    expect(restored).toEqual(parsed.file.profiles[0].doc)
    expect(again.profiles[0]).toEqual(parsed.file.profiles[0])
    expect(await listProfiles()).toHaveLength(1)
  })

  it('imports as a new profile with a new id and a free frame colour, at most six', async () => {
    const doc = await playedProfile()
    const file = await buildExport([doc.id], NOW)
    const copy = await importProfile(file.profiles[0], { mode: 'new' })
    expect(copy.id).not.toBe(doc.id)
    expect(copy.frameColor).not.toBe(doc.frameColor)
    const { id: _a, frameColor: _b, ...sameA } = copy
    const { id: _c, frameColor: _d, ...sameB } = doc
    expect(sameA).toEqual(sameB)
    const copied = await buildExport([copy.id], NOW)
    expect(copied.profiles[0].daily).toEqual(file.profiles[0].daily.map((d) => ({ ...d, profileId: copy.id })))
    expect(copied.profiles[0].answers).toEqual(file.profiles[0].answers.map((a) => ({ ...a, profileId: copy.id })))
    // the original is untouched
    expect((await buildExport([doc.id], NOW)).profiles[0]).toEqual(file.profiles[0])

    for (let i = (await listProfiles()).length; i < MAX_PROFILES; i++) await createProfile({ grade: 0 })
    await expect(importProfile(file.profiles[0], { mode: 'new' })).rejects.toBeInstanceOf(ProfileLimitError)
    expect(new Set((await listProfiles()).map((p) => p.frameColor)).size).toBe(MAX_PROFILES)
  })

  it('keeps the frame colour of the file on a device where it is free', async () => {
    const entry = fixture().profiles[0]
    const doc = await importProfile(entry, { mode: 'new' })
    expect(doc.frameColor).toBe(entry.doc.frameColor)
  })

  it('names the file after the child and the date', () => {
    const file = fixture()
    expect(exportFileName({ ...file, exportedAt: new Date(2026, 8, 30, 12).getTime() })).toBe('talvennerne2-aase-oersted-2026-09-30.json')
    expect(exportFileName({ ...file, profiles: [file.profiles[0], file.profiles[0]] })).toMatch(/^talvennerne2-2-spillere-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('the v1 fixture', () => {
  it('can always be imported, and its paused round resumes', async () => {
    const file = fixture()
    expect(file.version).toBe(1)
    const entry = file.profiles[0]
    const doc = await importProfile(entry, { mode: 'new' })
    const loaded = await useProfile.getState().loadProfile(doc.id)
    const { id: _a, ...rest } = loaded!
    const { id: _b, ...expected } = entry.doc
    expect(rest).toEqual(expected)
    expect(strip(await answersBetween(doc.id, 0))).toEqual(entry.answers.map((a) => ({ ...a, profileId: doc.id })))
    expect(await allDaily(doc.id)).toEqual(entry.daily.map((d) => ({ ...d, profileId: doc.id })))

    const round = loaded!.round!
    expect(round.current).not.toBeNull()
    let clock = file.exportedAt
    useRound.getState().resume(round, roundHooks({ now: () => clock }))
    expect(useRound.getState().current?.id).toBe(round.current!.id)
    const t = useRound.getState().current!
    clock += 2000
    useRound.getState().submit(t.answer)
    await useProfile.getState().flush()
    expect(await answersBetween(doc.id, 0)).toHaveLength(entry.answers.length + 1)
  })

  it('is read from a file picked by the parent', async () => {
    const result = await readImportFile(new Blob([fixtureText()], { type: 'application/json' }))
    expect(result.ok).toBe(true)
  })
})

describe('the validator', () => {
  const bad = (mutate: (f: ExportFile) => void) => {
    const f = fixture()
    mutate(f)
    return validateExport(JSON.parse(JSON.stringify(f)))
  }

  it('refuses files that are not ours, from a newer app, or empty', () => {
    expect(parseExport('{')).toMatchObject({ ok: false, message: 'Filen er ikke en gyldig JSON-fil.' })
    expect(validateExport({ format: 'noget-andet' })).toMatchObject({ ok: false })
    expect(bad((f) => (f.version = EXPORT_VERSION + 1))).toMatchObject({ ok: false, message: expect.stringContaining('nyere version') })
    expect(bad((f) => (f.profiles = []))).toMatchObject({ ok: false })
    expect(bad((f) => (f.profiles = Array(MAX_PROFILES + 1).fill(f.profiles[0])))).toMatchObject({ ok: false })
  })

  it('points at damaged data', () => {
    const cases: [string, (f: ExportFile) => void][] = [
      ['doc.name', (f) => delete (f.profiles[0].doc as Partial<ProfileDoc>).name],
      ['doc.grade', (f) => ((f.profiles[0].doc as { grade: number }).grade = 4)],
      ['doc.frameColor', (f) => ((f.profiles[0].doc as { frameColor: string }).frameColor = 'black')],
      ['.box', (f) => (Object.values(f.profiles[0].doc.keys)[0].box = 6 as never)],
      ['doc.skillStats.flying', (f) => ((f.profiles[0].doc.skillStats as Record<string, unknown>).flying = { prodCorrect: 1, prodDays: [] })],
      ['doc.economy.perler', (f) => (f.profiles[0].doc.economy.perler = -3)],
      ['doc.animals[0].species', (f) => ((f.profiles[0].doc.animals[0] as { species: string }).species = 'griffin')],
      ['doc.round.current.answer', (f) => ((f.profiles[0].doc.round!.current as { answer: unknown }).answer = { x: 1 })],
      ['doc.inventory.krone', (f) => ((f.profiles[0].doc.inventory as Record<string, unknown>).krone = { at: 1, colors: [0] })],
      ['answers[0].skill', (f) => ((f.profiles[0].answers[0] as { skill: string }).skill = 'flying')],
      ['answers[1].profileId', (f) => (f.profiles[0].answers[1].profileId = 'p_someone_else')],
      ['answers[2].ms', (f) => (f.profiles[0].answers[2].ms = Number.NaN)],
      ['daily[0].bySkill.addTo10.msHist', (f) => (f.profiles[0].daily[0].bySkill.addTo10!.msHist = [1, 2] as never)],
      ['daily[1].day', (f) => (f.profiles[0].daily[1].day = f.profiles[0].daily[0].day)],
    ]
    for (const [path, mutate] of cases) {
      const r = bad(mutate)
      expect(r.ok, path).toBe(false)
      if (!r.ok) expect(r.errors.join('\n'), path).toContain(path)
    }
  })
})

describe('sharing the file', () => {
  const file = () => fixture()

  it('uses the share sheet with a JSON file where it can', async () => {
    const share = vi.fn(async (_data: ShareData) => undefined)
    const r = await shareExport(file(), { navigator: { share, canShare: () => true } })
    expect(r).toBe('shared')
    const shared = share.mock.calls[0][0].files![0]
    expect(shared.name).toMatch(/^talvennerne2-aase-oersted-\d{4}-\d{2}-\d{2}\.json$/)
    expect(shared.type).toBe('application/json')
    expect(parseExport(await shared.text()).ok).toBe(true)
  })

  it('reports a cancelled share sheet, and downloads when sharing is refused or missing', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    expect(await shareExport(file(), { navigator: { share: async () => Promise.reject(abort), canShare: () => true } })).toBe('cancelled')

    const clicks: string[] = []
    const fakeDoc = {
      body: { appendChild: () => undefined },
      createElement: () => {
        const a = { style: {}, download: '', href: '', rel: '', click: () => clicks.push(a.download), remove: () => undefined }
        return a as unknown as HTMLAnchorElement
      },
    } as unknown as Document
    const url = { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }
    const notAllowed = Object.assign(new Error('no gesture'), { name: 'NotAllowedError' })
    expect(await shareExport(file(), { navigator: { share: async () => Promise.reject(notAllowed) }, document: fakeDoc, url })).toBe('downloaded')
    expect(await shareExport(file(), { navigator: { share: async () => undefined, canShare: () => false }, document: fakeDoc, url })).toBe('downloaded')
    expect(await shareExport(file(), { document: fakeDoc, url })).toBe('downloaded')
    expect(clicks).toHaveLength(3)
    expect(clicks.every((name) => /^talvennerne2-aase-oersted-.*\.json$/.test(name))).toBe(true)
    expect(await shareExport(file(), {})).toBe('failed')
  })
})
