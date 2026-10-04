// Export and import per profile (SPEC §9.2). A Safari tab can lose its storage after a week without
// visits, and a new iPad starts empty, so the parent can take a child's data along as one JSON file:
// the profile document, all daily aggregates and the last 30 days of answers.
//
// Import either replaces a profile on this device ("Erstat denne profil": keeps that profile's id and
// frame colour) or adds the child as a new profile ("Tilføj som ny": new id, a free frame colour,
// at most six profiles). Either way it is one transaction: all of it or none of it.
import { MAX_PROFILES } from '../content/catalog'
import type { AnswerLogEntry, DailyAggregate, FrameColor, ProfileDoc, ProfileId } from '../engine/types'
import { DAY_MAX, DAY_MIN, TS_MAX, TS_MIN, getDb } from './db'
import { newId } from './ids'
import { ANSWER_MAX_ROWS, DAILY_MAX_AGE_DAYS } from './prune'
import { withoutSeq } from './repo/answers'
import { ProfileLimitError, ProfileNotFoundError, freeFrameColors, requestPersistentStorage, withProfileDefaults } from './repo/profiles'
import { answerLogEntry, dailyAggregate, isObj, profileDoc, type Check } from './validate'

export const EXPORT_FORMAT = 'talvennerne2-export'
/** Bump with a migrate step and a new test/fixtures/export-vN.json; every older fixture must keep importing. */
export const EXPORT_VERSION = 1
export const EXPORT_ANSWER_DAYS = 30
/** Sanity limits for a file from outside: 3 years of days, and the answer log's own cap. */
const MAX_IMPORT_DAYS = DAILY_MAX_AGE_DAYS + 31

const DAY_MS = 86_400_000

export interface ExportProfile {
  doc: ProfileDoc
  daily: DailyAggregate[]
  /** The last 30 days, oldest first, without the local `seq`. */
  answers: AnswerLogEntry[]
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: number
  profiles: ExportProfile[]
}

export type ImportTarget = { mode: 'replace'; profileId: ProfileId } | { mode: 'new' }

export type ValidationResult = { ok: true; file: ExportFile } | { ok: false; message: string; errors: string[] }

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Read profiles for export in one consistent snapshot. Flush the write queue first
 * (useSession.exportProfiles does) so the last answers are included.
 */
export async function buildExport(ids: readonly ProfileId[], now: number = Date.now()): Promise<ExportFile> {
  const db = getDb()
  const since = now - EXPORT_ANSWER_DAYS * DAY_MS
  const profiles = await db.transaction('r', [db.profiles, db.answers, db.daily], async () => {
    const out: ExportProfile[] = []
    for (const id of ids) {
      const doc = await db.profiles.get(id)
      if (!doc) throw new ProfileNotFoundError(id)
      const daily = await db.daily.where('[profileId+day]').between([id, DAY_MIN], [id, DAY_MAX], true, true).toArray()
      const answers = await db.answers.where('[profileId+ts]').between([id, since], [id, TS_MAX], true, true).toArray()
      out.push({ doc: withProfileDefaults(doc), daily, answers: answers.map(withoutSeq) })
    }
    return out
  })
  return { format: EXPORT_FORMAT, version: EXPORT_VERSION, exportedAt: now, profiles }
}

export function serializeExport(file: ExportFile): string {
  return JSON.stringify(file)
}

const ASCII: Record<string, string> = { æ: 'ae', ø: 'oe', å: 'aa', Æ: 'ae', Ø: 'oe', Å: 'aa' }

/** 'talvennerne2-ada-2026-09-30.json' (several profiles: 'talvennerne2-3-spillere-…'). */
export function exportFileName(file: ExportFile): string {
  const date = new Date(file.exportedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const who =
    file.profiles.length === 1
      ? file.profiles[0].doc.name
          .replace(/[æøåÆØÅ]/g, (c) => ASCII[c])
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'spiller'
      : `${file.profiles.length}-spillere`
  return `talvennerne2-${who}-${stamp}.json`
}

export interface ShareEnv {
  navigator?: { share?: (data: ShareData) => Promise<void>; canShare?: (data: ShareData) => boolean }
  document?: Document
  url?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void }
}

function defaultEnv(): ShareEnv {
  const g = globalThis as { navigator?: ShareEnv['navigator']; document?: Document; URL?: ShareEnv['url'] }
  return { navigator: g.navigator, document: g.document, url: g.URL }
}

/**
 * Hand the file to the share sheet (iOS: "Gem i Arkiver", AirDrop, mail …), else download it.
 * Call it straight from the tap (build the file beforehand): Safari only shares on a user gesture,
 * and a refused share falls back to the download.
 */
export async function shareExport(file: ExportFile, env: ShareEnv = defaultEnv()): Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'> {
  const name = exportFileName(file)
  const blob = new Blob([serializeExport(file)], { type: 'application/json' })
  const nav = env.navigator
  if (nav?.share && typeof File !== 'undefined') {
    const data: ShareData = { files: [new File([blob], name, { type: 'application/json' })], title: 'Talvennerne 2' }
    let can = true
    try {
      can = nav.canShare ? nav.canShare(data) : true
    } catch {
      can = false
    }
    if (can) {
      try {
        await nav.share(data)
        return 'shared'
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
        // NotAllowedError (no user gesture) or anything else: fall back to a download
      }
    }
  }
  return download(blob, name, env) ? 'downloaded' : 'failed'
}

function download(blob: Blob, name: string, env: ShareEnv): boolean {
  const doc = env.document
  const url = env.url
  if (!doc?.body || !url) return false
  try {
    const href = url.createObjectURL(blob)
    const a = doc.createElement('a')
    a.href = href
    a.download = name
    a.rel = 'noopener'
    a.style.display = 'none'
    doc.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => url.revokeObjectURL(href), 10_000)
    return true
  } catch {
    return false
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function check(c: Check, v: unknown, path: string, errs: string[]): void {
  c(v, path, errs)
}

/** Validate a parsed file. On success the file is returned as-is (typed); nothing is changed. */
export function validateExport(raw: unknown): ValidationResult {
  const bad = (message: string, errors: string[] = []): ValidationResult => ({ ok: false, message, errors })
  if (!isObj(raw) || raw.format !== EXPORT_FORMAT) return bad('Filen er ikke en eksport fra Talvennerne 2.')
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) return bad('Filen har ikke et gyldigt versionsnummer.')
  if (raw.version > EXPORT_VERSION) return bad('Filen er lavet af en nyere version af Talvennerne 2. Opdatér appen, og prøv igen.')
  if (typeof raw.exportedAt !== 'number' || !Number.isFinite(raw.exportedAt)) return bad('Filen mangler et gyldigt tidspunkt for eksporten.')
  if (!Array.isArray(raw.profiles) || raw.profiles.length === 0) return bad('Filen indeholder ingen spillere.')
  if (raw.profiles.length > MAX_PROFILES) return bad(`Filen indeholder mere end ${MAX_PROFILES} spillere.`)

  const errs: string[] = []
  raw.profiles.forEach((p: unknown, i: number) => {
    const at = `profiles[${i}]`
    if (!isObj(p)) {
      errs.push(`${at}: skal være et objekt`)
      return
    }
    check(profileDoc, p.doc, `${at}.doc`, errs)
    if (!Array.isArray(p.daily)) errs.push(`${at}.daily: skal være en liste`)
    else if (p.daily.length > MAX_IMPORT_DAYS) errs.push(`${at}.daily: har for mange dage`)
    if (!Array.isArray(p.answers)) errs.push(`${at}.answers: skal være en liste`)
    else if (p.answers.length > ANSWER_MAX_ROWS) errs.push(`${at}.answers: har for mange svar`)
    if (errs.length > 0 || !isObj(p.doc) || !Array.isArray(p.daily) || !Array.isArray(p.answers)) return
    const id = p.doc.id
    const days = new Set<string>()
    p.daily.forEach((d: unknown, j: number) => {
      check(dailyAggregate, d, `${at}.daily[${j}]`, errs)
      if (isObj(d)) {
        if (d.profileId !== id) errs.push(`${at}.daily[${j}].profileId: tilhører en anden spiller`)
        if (days.has(String(d.day))) errs.push(`${at}.daily[${j}].day: dagen findes to gange`)
        days.add(String(d.day))
      }
    })
    p.answers.forEach((a: unknown, j: number) => {
      if (errs.length >= 20) return
      check(answerLogEntry, a, `${at}.answers[${j}]`, errs)
      if (isObj(a) && a.profileId !== id) errs.push(`${at}.answers[${j}].profileId: tilhører en anden spiller`)
    })
  })
  if (errs.length > 0) return bad('Filen kunne ikke læses, fordi den er beskadiget eller ændret.', errs.slice(0, 20))
  return { ok: true, file: raw as unknown as ExportFile }
}

export function parseExport(text: string): ValidationResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, message: 'Filen er ikke en gyldig JSON-fil.', errors: [] }
  }
  return validateExport(raw)
}

/** For `<input type=file>`: read and validate the chosen file. */
export async function readImportFile(file: Blob): Promise<ValidationResult> {
  return parseExport(await file.text())
}

// ─── Import ─────────────────────────────────────────────────────────────────

/**
 * Store one exported profile. Validate first (parseExport). If the replaced profile is the active
 * one, store it through useProfile.replaceLoaded, which drops its queued writes and reloads it in
 * place (useSession.importProfile does).
 */
export async function importProfile(entry: ExportProfile, target: ImportTarget): Promise<ProfileDoc> {
  const db = getDb()
  let first = false
  const stored = await db.transaction('rw', [db.profiles, db.answers, db.daily], async () => {
    const all = await db.profiles.toArray()
    first = all.length === 0
    let id: ProfileId
    let frameColor: FrameColor
    if (target.mode === 'replace') {
      const old = all.find((p) => p.id === target.profileId)
      if (!old) throw new ProfileNotFoundError(target.profileId)
      id = old.id
      frameColor = old.frameColor
      await db.answers.where('[profileId+ts]').between([id, TS_MIN], [id, TS_MAX], true, true).delete()
      await db.daily.where('profileId').equals(id).delete()
    } else {
      if (all.length >= MAX_PROFILES) throw new ProfileLimitError()
      id = newId('p')
      const free = freeFrameColors(all.map((p) => p.frameColor))
      frameColor = free.includes(entry.doc.frameColor) ? entry.doc.frameColor : free[0]
    }
    const doc = withProfileDefaults({ ...entry.doc, id, frameColor })
    await db.profiles.put(doc)
    if (entry.daily.length > 0) await db.daily.bulkPut(entry.daily.map((d) => ({ ...d, profileId: id })))
    if (entry.answers.length > 0) await db.answers.bulkAdd(entry.answers.map((a) => ({ ...withoutSeq(a), profileId: id })))
    return doc
  })
  // a new device often starts with an import: it is the first profile there
  if (first) void requestPersistentStorage()
  return stored
}
