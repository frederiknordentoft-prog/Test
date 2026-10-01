// The listening page (SPEC §10.4 "Lytteside"): every recorded clip per sprite with its text, what
// the speech recogniser heard, CER and loudness; "Byg en sætning" (skill × fact × kind); sliders for
// numbers 0–1000 and clock times; and a flag per clip with an export of the flagged list. For adults
// reviewing the voice, so plain Danish text is fine here (no child screen).
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import type { VoiceManifest } from '../audio/manifest'
import { allClips, clipText } from '../speech/catalog'
import { Icon } from '../ui/design/Icon'
import { exportFlags, loadManifest, loadQa, readFlags, setNote, toggleFlag, type FlagStore, type VoiceQa } from './data'
import { PlayButton, SpeechLine } from './parts'

const BuildSentence = lazy(() => import('./BuildSentence'))

const fmt = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? '–' : n.toLocaleString('da-DK', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const CHECK_LABEL: Record<string, string> = {
  alone: 'alene',
  carrier: 'bæresætning',
  comp: 'sammensat',
  none: 'kun længde',
}

function NumberSlider() {
  const [n, setN] = useState(347)
  const [form, setForm] = useState<'mid' | 'end'>('end')
  return (
    <section className="lyt-card" id="tal">
      <h2>Tal fra 0 til 1000</h2>
      <div className="lyt-row">
        <input type="range" min={0} max={1000} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Tal" />
        <input type="number" min={0} max={1000} value={n} onChange={(e) => setN(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} className="lyt-num" aria-label="Tal" />
        <select value={form} onChange={(e) => setForm(e.target.value as 'mid' | 'end')} aria-label="Form">
          <option value="end">slutform (.)</option>
          <option value="mid">midtform (,)</option>
        </select>
      </div>
      <SpeechLine parts={[{ num: n, form }]} />
    </section>
  )
}

function ClockSlider() {
  const [minutes, setMinutes] = useState(15 * 60 + 45)
  const [style, setStyle] = useState<'analog' | 'analogHalfForm' | 'digital'>('analog')
  const step = style === 'digital' ? 1 : 5
  const value = style === 'digital' ? minutes : Math.round(minutes / 5) * 5
  const hh = String(Math.floor(value / 60)).padStart(2, '0')
  const mm = String(value % 60).padStart(2, '0')
  return (
    <section className="lyt-card" id="klokken">
      <h2>Klokken</h2>
      <div className="lyt-row">
        <input type="range" min={0} max={1439} step={step} value={value} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Klokkeslæt" />
        <span className="lyt-num">
          {hh}.{mm}
        </span>
        <select value={style} onChange={(e) => setStyle(e.target.value as typeof style)} aria-label="Måde">
          <option value="analog">analog</option>
          <option value="analogHalfForm">analog med halv-form</option>
          <option value="digital">digital</option>
        </select>
      </div>
      <SpeechLine parts={[{ clock: { minutes: value, style, form: 'end' } }]} />
    </section>
  )
}

interface ClipRowProps {
  id: string
  qa: VoiceQa | null
  flags: FlagStore
  onFlag: (id: string) => void
}

function ClipRow({ id, qa, flags, onFlag }: ClipRowProps) {
  const q = qa?.clips[id]
  const flagged = !!flags.flags[id]
  return (
    <tr className={q && !q.pass ? 'lyt-fail' : undefined}>
      <td>
        <PlayButton parts={[{ clip: id }]} label={`Afspil ${id}`} />
      </td>
      <td>
        <code>{id}</code>
      </td>
      <td>{clipText(id)}</td>
      <td className="lyt-asr">
        {q?.asr ?? '–'}
        {q?.check && q.check !== 'alone' && q.expected ? <div className="lyt-sub">{CHECK_LABEL[q.check] ?? q.check}: {q.expected}</div> : null}
      </td>
      <td className="lyt-n">{q?.cer === null || q?.cer === undefined ? '–' : `${fmt(q.cer * 100, 1)} %`}</td>
      <td className="lyt-n">{fmt(q?.lufs, 1)}</td>
      <td className="lyt-n">{q ? `${q.take + 1}/${q.takes}` : '–'}</td>
      <td>
        <button type="button" className={flagged ? 'lyt-flag lyt-flag--on' : 'lyt-flag'} aria-pressed={flagged} onClick={() => onFlag(id)} title={flagged ? 'Fjern flag' : 'Flag klippet'}>
          <Icon name="flag" size={18} solid={flagged} />
        </button>
      </td>
    </tr>
  )
}

function ClipList({ manifest, qa, flags, onFlag }: { manifest: VoiceManifest; qa: VoiceQa | null; flags: FlagStore; onFlag: (id: string) => void }) {
  const [filter, setFilter] = useState('')
  const [onlyFailed, setOnlyFailed] = useState(false)
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const f = filter.trim().toLowerCase()
  const match = (id: string) =>
    (!f || id.toLowerCase().includes(f) || clipText(id).toLowerCase().includes(f)) &&
    (!onlyFailed || qa?.clips[id]?.pass === false) &&
    (!onlyFlagged || !!flags.flags[id])
  const sprites = Object.entries(manifest.sprites).sort(([a], [b]) => (a < b ? -1 : 1))
  return (
    <section className="lyt-card" id="klip">
      <h2>Alle klip</h2>
      <div className="lyt-row">
        <input type="search" placeholder="Søg i id eller tekst" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Søg" />
        <label>
          <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> kun ikke bestået
        </label>
        <label>
          <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> kun flagede
        </label>
      </div>
      {sprites.map(([sprite, entry]) => {
        const ids = Object.keys(entry.clips).filter(match).sort()
        if (ids.length === 0) return null
        return (
          <details key={sprite} open={!!f || onlyFailed || onlyFlagged || sprites.length === 1}>
            <summary>
              <strong>{sprite}</strong> · {Object.keys(entry.clips).length} klip · {fmt((entry.durationMs ?? 0) / 1000, 1)} s ·{' '}
              {fmt((entry.bytes ?? 0) / 1024, 0)} KB{entry.pinned ? ' · indlæses ved start' : ''}
            </summary>
            <div className="lyt-table-wrap">
              <table className="lyt-table">
                <thead>
                  <tr>
                    <th aria-label="Afspil" />
                    <th>Id</th>
                    <th>Tekst</th>
                    <th>ASR hørte</th>
                    <th>CER</th>
                    <th>LUFS</th>
                    <th>Take</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => (
                    <ClipRow key={id} id={id} qa={qa} flags={flags} onFlag={onFlag} />
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )
      })}
    </section>
  )
}

function FlagPanel({ flags, voice, onNote, onFlag }: { flags: FlagStore; voice: string | null; onNote: (id: string, note: string) => void; onFlag: (id: string) => void }) {
  const ids = Object.keys(flags.flags).sort()
  const [copied, setCopied] = useState(false)
  const json = () => exportFlags(flags, clipText, voice, new Date().toISOString())
  const download = () => {
    const url = URL.createObjectURL(new Blob([json()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'lyt-flag.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      download()
    }
  }
  return (
    <section className="lyt-card" id="flag">
      <h2>Flagede klip ({ids.length})</h2>
      {ids.length === 0 ? (
        <p className="lyt-muted">Ingen endnu. Tryk på flaget ud for et klip, der lyder forkert.</p>
      ) : (
        <ul className="lyt-flags">
          {ids.map((id) => (
            <li key={id}>
              <PlayButton parts={[{ clip: id }]} label={`Afspil ${id}`} />
              <code>{id}</code> <span>{clipText(id)}</span>
              <input type="text" placeholder="Note (fx hvad der lyder forkert)" defaultValue={flags.flags[id].note ?? ''} onBlur={(e) => onNote(id, e.target.value)} aria-label={`Note til ${id}`} />
              <button type="button" className="lyt-flag lyt-flag--on" onClick={() => onFlag(id)} title="Fjern flag">
                <Icon name="close" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="lyt-row">
        <button type="button" className="lyt-btn" onClick={download} disabled={ids.length === 0}>
          <Icon name="download" size={18} /> Hent listen (JSON)
        </button>
        <button type="button" className="lyt-btn lyt-btn--quiet" onClick={() => void copy()} disabled={ids.length === 0}>
          {copied ? 'Kopieret' : 'Kopiér listen'}
        </button>
      </div>
    </section>
  )
}

export function LytApp() {
  const [manifest, setManifest] = useState<VoiceManifest | null | undefined>(undefined)
  const [qa, setQa] = useState<VoiceQa | null>(null)
  const [flags, setFlags] = useState<FlagStore>(() => readFlags())
  useEffect(() => {
    void loadManifest().then(setManifest)
    void loadQa().then(setQa)
  }, [])
  const recorded = useMemo(() => {
    const ids = new Set<string>()
    for (const s of Object.values(manifest?.sprites ?? {})) for (const id of Object.keys(s.clips)) ids.add(id)
    return ids
  }, [manifest])
  const total = useMemo(() => allClips().length, [])
  const failed = qa ? Object.values(qa.clips).filter((c) => !c.pass).length : 0
  const onFlag = (id: string) => setFlags((f) => toggleFlag(f, id, qa?.clips[id]?.take ?? null, new Date().toISOString()))
  const onNote = (id: string, note: string) => setFlags((f) => setNote(f, id, note))

  return (
    <div className="lyt">
      <header className="lyt-head">
        <h1>Lyt til stemmen</h1>
        <p>
          Alle oplæste klip i Talvennerne 2. Stemmen er computergenereret: Røst-v3 Chatterbox fra CoRal-projektet (Alexandra Instituttet), OpenRAIL-licens,
          stemmen Nic. Hvert klip er tjekket med talegenkendelse; tal og korte ord er tjekket i sætninger.
        </p>
        <p className="lyt-stats">
          {manifest === undefined
            ? 'Henter manifestet …'
            : manifest === null
              ? 'Der er ingen optagelser endnu: alt læses op af enhedens stemme.'
              : `${recorded.size} af ${total} klip er optaget i ${Object.keys(manifest.sprites).length} sprites${qa ? `; ${failed} bestod ikke tjekket` : ''}.`}
        </p>
        <nav className="lyt-nav">
          <a href="#klip">Klip</a>
          <a href="#byg">Byg en sætning</a>
          <a href="#tal">Tal</a>
          <a href="#klokken">Klokken</a>
          <a href="#flag">Flag ({Object.keys(flags.flags).length})</a>
        </nav>
      </header>
      <Suspense fallback={<section className="lyt-card">Henter opgaverne …</section>}>
        <BuildSentence />
      </Suspense>
      <NumberSlider />
      <ClockSlider />
      <FlagPanel flags={flags} voice={manifest?.voice ?? null} onNote={onNote} onFlag={onFlag} />
      {manifest ? <ClipList manifest={manifest} qa={qa} flags={flags} onFlag={onFlag} /> : null}
    </div>
  )
}
