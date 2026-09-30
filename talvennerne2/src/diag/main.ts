// Diagnosis page (SPEC A4, §16): what an iPad actually supports, measured on the device itself,
// because Chromium is not iOS. Plain DOM, no React. The parent opens diag.html, runs the tests and
// taps "Kopiér rapport". Storage is only touched through the app's own namespace: IndexedDB via
// getDb().meta (a `diag.*` row, deleted again) and Web Storage via src/data/namespace.ts.
import './diag.css'
import { ttsSpeak, danishVoice, deviceVoices, initDeviceTts } from '../audio/deviceTts'
import { audioGraph, existingAudioGraph } from '../audio/engine'
import { applyAudioSession, audioSession, followSilentSwitch, installAudioUnlock, unlockAudio } from '../audio/unlock'
import { debugLastPlan, speak, voiceAvailable, voiceStatus } from '../audio/voice'
import { playSfx } from '../audio/sfx'
import { BOOT_KEY, defaultBoot, localGet, localRemove, localSet, sessionGet, sessionRemove, sessionSet } from '../data/namespace'

type Status = 'ok' | 'warn' | 'bad' | 'info'
interface Row {
  label: string
  value: string
  status: Status
}

/** The meta row the storage test writes and deletes again. */
const DIAG_META_KEY = 'diag.test'

/** Every section's latest rows, in page order, for the copied report. */
const report = new Map<string, Row[]>()
const answers = new Map<string, string>()

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (text !== undefined) node.textContent = text
  return node
}

const row = (label: string, value: string | number | boolean, status: Status = 'info'): Row => ({
  label,
  value: typeof value === 'boolean' ? (value ? 'ja' : 'nej') : String(value),
  status,
})
const yes = (label: string, ok: boolean, good: Status = 'ok', bad: Status = 'bad') => row(label, ok, ok ? good : bad)

interface Section {
  root: HTMLElement
  body: HTMLElement
  buttons: HTMLElement
  set(rows: Row[]): void
}

function section(id: string, title: string, hint?: string): Section {
  const root = el('section', { id })
  root.append(el('h2', {}, title))
  if (hint) root.append(el('p', { class: 'hint' }, hint))
  const body = el('div')
  const buttons = el('div', { class: 'buttons' })
  root.append(body, buttons)
  document.querySelector('main')!.append(root)
  return {
    root,
    body,
    buttons,
    set(rows) {
      report.set(title, rows)
      const table = el('table')
      for (const r of rows) {
        const tr = el('tr')
        const label = el('td', { class: 'label' }, r.label)
        const value = el('td', { class: 'value' })
        value.append(el('span', { class: `dot ${r.status}` }), document.createTextNode(r.value))
        tr.append(label, value)
        table.append(tr)
      }
      body.replaceChildren(table)
    },
  }
}

function button(parent: HTMLElement, text: string, onClick: () => void | Promise<void>, soft = false): HTMLButtonElement {
  const b = el('button', soft ? { class: 'soft', type: 'button' } : { type: 'button' }, text)
  b.addEventListener('click', () => {
    void (async () => {
      b.disabled = true
      try {
        await onClick()
      } catch (err) {
        console.error(err)
      } finally {
        b.disabled = false
      }
    })()
  })
  parent.append(b)
  return b
}

/** "Hørte du …?" with Ja/Nej; the answer goes into the report. */
function ask(s: Section, key: string, question: string): void {
  const box = el('div', { class: 'answer' }, question)
  const row = el('div', { class: 'buttons' })
  const pick = (a: string) => {
    answers.set(key, a)
    box.textContent = `${question} Svar: ${a}`
    row.remove()
  }
  button(row, 'Ja', () => pick('ja'))
  button(row, 'Nej', () => pick('nej'), true)
  s.buttons.after(box, row)
}

function beep(freq = 440, seconds = 0.8): boolean {
  const g = audioGraph()
  if (!g) return false
  const { ctx, master } = g
  const t = ctx.currentTime + 0.02
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.frequency.value = freq
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(0.3, t + 0.03)
  amp.gain.setValueAtTime(0.3, t + seconds - 0.1)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  osc.connect(amp).connect(master)
  osc.start(t)
  osc.stop(t + seconds + 0.05)
  return true
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ─── Sections ───────────────────────────────────────────────────────────────

function iosVersion(): string {
  const ua = navigator.userAgent
  const os = /OS (\d+)_(\d+)(?:_(\d+))?/.exec(ua)
  if (/iP(hone|ad|od)/.test(ua) && os) return `${os[1]}.${os[2]}${os[3] ? `.${os[3]}` : ''}`
  const safari = /Version\/(\d+(?:\.\d+)*)/.exec(ua)
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && safari) return `${safari[1]} (iPadOS)`
  return 'ikke iOS'
}

function standalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

function deviceSection(): void {
  const s = section('enhed', 'Enhed')
  const v = iosVersion()
  const major = Number.parseFloat(v)
  s.set([
    row('iOS/iPadOS', v, Number.isNaN(major) ? 'info' : major >= 16.4 ? 'ok' : 'bad'),
    yes('Startet fra hjemmeskærmen', standalone(), 'ok', 'warn'),
    row('Skærm', `bredde ${screen.width}, højde ${screen.height} punkter`),
    row('Vindue', `bredde ${window.innerWidth}, højde ${window.innerHeight} punkter`),
    row('devicePixelRatio', window.devicePixelRatio),
    row('Berøringspunkter', navigator.maxTouchPoints),
    row('Sprog', navigator.language),
    row('Browser', navigator.userAgent),
  ])
}

function audioRows(): Row[] {
  const g = existingAudioGraph()
  const ctor = 'AudioContext' in window || 'webkitAudioContext' in window
  const session = audioSession()
  const rows: Row[] = [yes('Web Audio findes', ctor)]
  if (g) {
    const ctx = g.ctx as AudioContext & { outputLatency?: number }
    rows.push(
      row('Samplerate', `${ctx.sampleRate} Hz${ctx.sampleRate === 24000 ? ' (som ønsket)' : ' (24000 blev afvist)'}`, ctx.sampleRate === 24000 ? 'ok' : 'warn'),
      row('Tilstand', ctx.state, ctx.state === 'running' ? 'ok' : 'warn'),
      row('Latens', `base ${(ctx.baseLatency * 1000 || 0).toFixed(1)} ms, output ${((ctx.outputLatency ?? 0) * 1000).toFixed(1)} ms`),
    )
  } else {
    rows.push(row('AudioContext', 'oprettes ved første tryk'))
  }
  rows.push(
    yes('navigator.audioSession findes', !!session, 'ok', 'warn'),
    row('audioSession.type', session ? session.type : 'findes ikke (ældre iOS bruger lydløs <audio>-løkke)'),
    row('"Følg lydløs-knappen"', followSilentSwitch() ? 'til' : 'fra (standard)'),
  )
  return rows
}

function audioSection(): void {
  const s = section('lyd', 'Lyd', 'Tryk på knappen: det låser lyden op, præcis som når barnet trykker første gang i spillet.')
  s.set(audioRows())
  button(s.buttons, 'Afspil tone', async () => {
    unlockAudio()
    await sleep(80)
    beep(440)
    await sleep(900)
    s.set(audioRows())
    if (!answers.has('tone')) ask(s, 'tone', 'Hørte du tonen?')
  })
  button(s.buttons, 'Afspil lydeffekter', async () => {
    unlockAudio()
    for (const name of ['rigtigt', 'hmm', 'stjerne', 'klaek'] as const) {
      playSfx(name, { streak: 3 })
      await sleep(900)
    }
    if (!answers.has('sfx')) ask(s, 'sfx', 'Hørte du fire lydeffekter (og var fejl-lyden blød)?')
  }, true)
}

function silentSection(): void {
  const s = section(
    'lydloes',
    'Lydløs-kontakt',
    'Slå lydløs til (kontakten på siden eller Kontrolcenter). Spillet skal kunne læse op alligevel, fordi børnene ikke kan læse.',
  )
  const rows = () => {
    const session = audioSession()
    return [
      yes('navigator.audioSession', !!session, 'ok', 'warn'),
      row('Type nu', session?.type ?? 'findes ikke'),
      row('Svar: tone med lydløs slået til', answers.get('silent-playback') ?? 'ikke testet'),
      row('Svar: tone når appen følger lydløs', answers.get('silent-follow') ?? 'ikke testet'),
    ]
  }
  s.set(rows())
  button(s.buttons, 'Afspil som spillet (playback)', async () => {
    const session = audioSession()
    if (session) session.type = 'playback'
    unlockAudio()
    await sleep(80)
    beep(523)
    await sleep(900)
    s.set(rows())
    ask(s, 'silent-playback', 'Med lydløs slået til: hørte du tonen? (Det skal du.)')
  })
  button(s.buttons, 'Afspil og følg lydløs', async () => {
    const session = audioSession()
    if (session) session.type = 'auto'
    unlockAudio()
    await sleep(80)
    beep(392)
    await sleep(900)
    applyAudioSession()
    s.set(rows())
    ask(s, 'silent-follow', 'Med lydløs slået til: hørte du tonen? (Her må den gerne være tavs.)')
  }, true)
}

function ttsRows(): Row[] {
  const voices = deviceVoices()
  const danish = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('da'))
  const chosen = danishVoice()
  return [
    yes('speechSynthesis findes', 'speechSynthesis' in window),
    row('Stemmer i alt', voices.length),
    yes('Dansk stemme', danish.length > 0, 'ok', 'bad'),
    row('Danske stemmer', danish.map((v) => `${v.name} (${v.lang}${v.localService ? ', lokal' : ', netværk'}${v.default ? ', standard' : ''})`).join('; ') || 'ingen'),
    row('Valgt reservestemme', chosen ? `${chosen.name} (${chosen.lang})` : 'ingen'),
  ]
}

function ttsSection(): void {
  const s = section('tts', 'Enhedens stemme (reserve)', 'Bruges til navne, og hvis en optagelse mangler.')
  initDeviceTts()
  s.set(ttsRows())
  setTimeout(() => s.set(ttsRows()), 1500)
  button(s.buttons, 'Sig en sætning', async () => {
    unlockAudio()
    const t0 = performance.now()
    const h = ttsSpeak('Hej, jeg hedder Pip. Hvad er tre plus fire?')
    await h.ended
    const ms = Math.round(performance.now() - t0)
    s.set([...ttsRows(), row('Sætningen tog', `${ms} ms (skøn ${h.estimatedMs} ms)${h.audible ? '' : ' — tavs, ingen dansk stemme'}`, h.audible ? 'ok' : 'warn')])
    if (!answers.has('tts')) ask(s, 'tts', 'Hørte du en dansk stemme sige sætningen?')
  })
}

async function voiceSection(): Promise<void> {
  const s = section('stemme', 'Den indspillede stemme')
  const rows = async () => {
    const available = await voiceAvailable()
    const st = voiceStatus()
    return [
      yes('Optagelser (voice-manifest.json)', available, 'ok', 'warn'),
      row('Stemme', st.voice ?? 'ingen endnu — alt læses af enhedens stemme'),
      row('Klip i manifestet', st.clips),
      row('Sprites', st.sprites.map((x) => `${x.id}: ${x.state}${x.pinned ? ' (fast)' : ''}`).join(', ') || 'ingen'),
      row('Dekodet lyd', `${(st.decodedBytes / 1048576).toFixed(1)} MB (heraf fast ${(st.pinnedBytes / 1048576).toFixed(1)} MB)`),
    ]
  }
  s.set(await rows())
  button(s.buttons, 'Sig "Hvad er otteogtredive plus femogfyrre?"', async () => {
    unlockAudio()
    const before = debugLastPlan()
    const t0 = performance.now()
    const h = speak([{ clip: 'frag.hvad_er' }, { num: 38, form: 'mid' }, { clip: 'op.plus' }, { num: 45, form: 'end' }])
    await h.ended
    const plan = debugLastPlan()
    const used = plan && plan !== before ? 'optagelser' : 'enhedens stemme (reserve)'
    s.set([...(await rows()), row('Seneste udsagn', `${used}, ${Math.round(performance.now() - t0)} ms (planlagt ${Math.round(h.durationMs)} ms)`)])
    if (!answers.has('voice')) ask(s, 'voice', 'Hørte du regnestykket?')
  })
}

async function idbTest(): Promise<Row[]> {
  if (!('indexedDB' in window)) return [row('IndexedDB', 'findes ikke', 'bad')]
  try {
    const t0 = performance.now()
    const { getDb } = await import('../data/db')
    const meta = getDb().meta
    const value = { at: 1, text: 'Talvennerne'.repeat(100) }
    await meta.put({ key: DIAG_META_KEY, value })
    const tWrite = performance.now()
    const back = await meta.get(DIAG_META_KEY)
    const tRead = performance.now()
    await meta.delete(DIAG_META_KEY)
    const gone = (await meta.get(DIAG_META_KEY)) === undefined
    const same = JSON.stringify(back?.value) === JSON.stringify(value)
    return [
      yes('IndexedDB: skrive, læse, slette', same && gone),
      row('Tider', `åbne og skrive ${(tWrite - t0).toFixed(0)} ms, læse ${(tRead - tWrite).toFixed(0)} ms`),
    ]
  } catch (err) {
    return [row('IndexedDB', `fejl: ${String(err)}`, 'bad')]
  }
}

/** Writes the boot value back unchanged (or the default, removed again) to see that writes work. */
function localStorageWorks(): boolean {
  const before = localGet(BOOT_KEY)
  const probe = before ?? JSON.stringify(defaultBoot())
  const ok = localSet(BOOT_KEY, probe) && localGet(BOOT_KEY) === probe
  if (before === null) localRemove(BOOT_KEY)
  return ok
}

function sessionStorageWorks(): boolean {
  const ok = sessionSet('diag', '1') && sessionGet('diag') === '1'
  sessionRemove('diag')
  return ok
}

async function storageRows(extra: Row[] = []): Promise<Row[]> {
  const rows: Row[] = [...(await idbTest())]
  const storage = navigator.storage
  if (storage?.estimate) {
    const e = await storage.estimate()
    rows.push(row('Plads', `${((e.usage ?? 0) / 1048576).toFixed(1)} MB brugt af ${((e.quota ?? 0) / 1048576).toFixed(0)} MB`))
  } else rows.push(row('storage.estimate()', 'findes ikke', 'warn'))
  if (storage?.persisted) rows.push(yes('Varig lagring (persisted)', await storage.persisted(), 'ok', 'warn'))
  else rows.push(row('storage.persisted()', 'findes ikke', 'warn'))
  rows.push(yes('localStorage', localStorageWorks()), yes('sessionStorage', sessionStorageWorks()))
  return [...rows, ...extra]
}

async function storageSection(): Promise<void> {
  const s = section('lagring', 'Lagring', 'Tester appens egen database (en diag-række, som slettes igen) og Web Storage i appens navnerum.')
  s.set(await storageRows())
  button(s.buttons, 'Bed om varig lagring', async () => {
    const granted = navigator.storage?.persist ? await navigator.storage.persist() : false
    s.set(await storageRows([yes('persist() svarede', granted, 'ok', 'warn')]))
  }, true)
}

function featureSection(): void {
  const s = section('visning', 'Visning og input')
  const supports = (p: string, v?: string) => {
    try {
      return v === undefined ? CSS.supports(p) : CSS.supports(p, v)
    } catch {
      return false
    }
  }
  s.set([
    yes('CSS color-mix()', supports('color', 'color-mix(in srgb, red, red)')),
    yes('CSS :has()', supports('selector(:has(*))')),
    yes('Container queries', supports('container-type', 'inline-size')),
    yes('Pointer Events', 'PointerEvent' in window),
    yes('Touch Events', 'ontouchstart' in window || 'TouchEvent' in window, 'ok', 'info'),
    yes('Web Animations (element.animate)', typeof Element.prototype.animate === 'function'),
    yes('document.getAnimations', typeof document.getAnimations === 'function', 'ok', 'warn'),
    yes('visualViewport', 'visualViewport' in window, 'ok', 'warn'),
    row('Reduceret bevægelse', window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'slået til' : 'fra'),
    row('Mørk tilstand', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'ja' : 'nej'),
  ])
}

function perfSection(): void {
  const s = section('ydelse', 'Ydelse', 'Animerer 30 SVG-grupper i 3 sekunder (kun transform) og måler tiden mellem billeder.')
  s.set([row('Resultat', 'ikke kørt')])
  const svgNs = 'http://www.w3.org/2000/svg'
  button(s.buttons, 'Kør ydelsestest', async () => {
    const svg = document.createElementNS(svgNs, 'svg')
    svg.setAttribute('viewBox', '0 0 600 220')
    svg.setAttribute('class', 'stage')
    const groups: SVGGElement[] = []
    for (let i = 0; i < 30; i++) {
      const g = document.createElementNS(svgNs, 'g')
      const x = 30 + (i % 10) * 57
      const y = 45 + Math.floor(i / 10) * 65
      const hue = (i * 37) % 360
      g.innerHTML =
        `<ellipse cx="${x}" cy="${y + 8}" rx="22" ry="18" fill="hsl(${hue} 70% 70%)"/>` +
        `<circle cx="${x}" cy="${y - 12}" r="14" fill="hsl(${hue} 70% 78%)"/>` +
        `<circle cx="${x - 5}" cy="${y - 14}" r="2.5" fill="rgb(43 33 68)"/><circle cx="${x + 5}" cy="${y - 14}" r="2.5" fill="rgb(43 33 68)"/>` +
        `<path d="M${x - 10} ${y - 24} l4 -12 l5 10 z M${x + 10} ${y - 24} l-4 -12 l-5 10 z" fill="hsl(${hue} 70% 65%)"/>`
      svg.append(g)
      groups.push(g)
    }
    s.body.after(svg)
    const animations = groups.map((g, i) =>
      typeof g.animate === 'function'
        ? g.animate(
            [
              { transform: 'translate(0px, 0px) rotate(0deg) scale(1)' },
              { transform: `translate(0px, -12px) rotate(${i % 2 ? 8 : -8}deg) scale(1.08)` },
            ],
            { duration: 450 + (i % 5) * 60, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
          )
        : null,
    )
    const frames: number[] = []
    await new Promise<void>((resolve) => {
      let last = performance.now()
      const until = last + 3000
      const tick = (now: number) => {
        frames.push(now - last)
        last = now
        if (now < until) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
    for (const a of animations) a?.cancel()
    svg.remove()
    const sorted = frames.slice(1).sort((a, b) => a - b)
    const avg = sorted.reduce((x, y) => x + y, 0) / sorted.length
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
    const max = sorted[sorted.length - 1] ?? 0
    const slow = sorted.filter((f) => f > 20).length
    s.set([
      row('Billeder pr. sekund', (1000 / avg).toFixed(1), avg <= 18 ? 'ok' : 'warn'),
      row('Frametid', `snit ${avg.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${max.toFixed(1)} ms`, p95 <= 20 ? 'ok' : 'warn'),
      row('Billeder over 20 ms', `${slow} af ${sorted.length}`, slow <= sorted.length * 0.05 ? 'ok' : 'warn'),
    ])
  })
}

function reportText(): string {
  const lines = [`Talvennerne 2 · diagnoserapport`, `Tid: ${new Date().toISOString()}`, `Adresse: ${location.href}`, '']
  for (const [title, rows] of report) {
    lines.push(`## ${title}`)
    for (const r of rows) lines.push(`- ${r.label}: ${r.value}${r.status === 'bad' ? '  [PROBLEM]' : r.status === 'warn' ? '  [OBS]' : ''}`)
    lines.push('')
  }
  lines.push('## Svar')
  if (answers.size === 0) lines.push('- ingen')
  for (const [k, v] of answers) lines.push(`- ${k}: ${v}`)
  return lines.join('\n')
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = el('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    area.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

function reportSection(): void {
  const root = el('section', { id: 'rapport' })
  root.append(el('h2', {}, 'Rapport'), el('p', { class: 'hint' }, 'Kør testene ovenfor, svar på spørgsmålene, og kopiér så rapporten.'))
  const buttons = el('div', { class: 'buttons' })
  const out = el('pre')
  const status = el('p', { class: 'hint' })
  root.append(buttons, status, out)
  document.querySelector('main')!.append(root)
  button(buttons, 'Kopiér rapport', async () => {
    const text = reportText()
    out.textContent = text
    status.textContent = (await copy(text)) ? 'Rapporten er kopieret.' : 'Kunne ikke kopiere automatisk: markér teksten herunder og kopiér den.'
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

const root = document.getElementById('root')!
const main = el('main')
main.append(
  el('h1', {}, 'Talvennerne 2 · Diagnose'),
  el('p', { class: 'lead' }, 'Tjekker lyd, oplæsning, lagring og ydelse på denne enhed. Intet sendes nogen steder hen.'),
)
root.replaceChildren(main)
installAudioUnlock()
deviceSection()
audioSection()
silentSection()
ttsSection()
void voiceSection().then(async () => {
  await storageSection()
  featureSection()
  perfSection()
  reportSection()
})
