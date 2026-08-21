import { useMemo, useState } from 'react'
import { ISLANDS } from '../../content/islands'
import { factsFor } from '../../engine/facts'
import { GUESSABLE_CEILING, MAX_BOX, masteryOf } from '../../engine/mastery'
import type { SkillId } from '../../engine/types'
import { isIslandUnlocked, levelsDoneOn, useProfile } from '../../state/useProfile'
import { exportSave, importSave } from '../../state/storage'
import { hasDanishVoice } from '../../audio/speech'
import { BigButton } from '../components/BigButton'

const SKILL_LABELS: Partial<Record<SkillId, string>> = {
  count: 'Tælle 1–10',
  neighbour: 'Én mere / én mindre',
  addTo10: 'Plus inden for 10',
  subTo10: 'Minus inden for 10',
  tenFriends: 'Tiervenner',
  doubles: 'Dobbelt',
  halves: 'Halvdelen',
  addTo20: 'Plus over tieren',
  subTo20: 'Minus over tieren',
  tensAndOnes: 'Tiere og enere',
  addTo100: 'Plus inden for 100',
  subTo100: 'Minus inden for 100',
}

/** A grown-up gate: a sum that is deliberately outside 0.–2. klasse. */
function Gate({ onOpen, onBack }: { onOpen: () => void; onBack: () => void }) {
  const question = useMemo(() => {
    const a = 6 + Math.floor(Math.random() * 4)
    const b = 7 + Math.floor(Math.random() * 3)
    return { a, b, answer: a * b }
  }, [])
  const [entry, setEntry] = useState('')
  const wrong = entry.length >= String(question.answer).length && Number(entry) !== question.answer

  return (
    <div className="mx-auto flex max-w-xs flex-col items-center gap-4 pt-16">
      <p className="text-center text-lg font-bold">Kun for voksne</p>
      <p className="text-center text-sm opacity-85">Skriv svaret for at komme ind</p>
      <p className="text-5xl font-black tabular-nums">{question.a} × {question.b}</p>
      <input
        inputMode="numeric"
        value={entry}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 3)
          setEntry(next)
          if (Number(next) === question.answer) onOpen()
        }}
        aria-label="Svar"
        className={`w-40 rounded-2xl bg-black/30 px-4 py-3 text-center text-2xl font-black tabular-nums ring-2 outline-none ${
          wrong ? 'ring-rose-400/70' : 'ring-white/20'
        }`}
      />
      <button type="button" onClick={onBack} className="text-sm font-bold uppercase tracking-widest opacity-85">
        Tilbage til spillet
      </button>
    </div>
  )
}

/** Where multiple choice stops counting, as a percentage of the bar. */
const CEILING_PERCENT = Math.round((GUESSABLE_CEILING / MAX_BOX) * 100)

export function ParentScreen({ onBack }: { onBack: () => void }) {
  const save = useProfile((s) => s.save)
  const setSetting = useProfile((s) => s.setSetting)
  const setIslandUnlocked = useProfile((s) => s.setIslandUnlocked)
  const openThroughGrade = useProfile((s) => s.openThroughGrade)
  const replaceSave = useProfile((s) => s.replaceSave)
  const reset = useProfile((s) => s.reset)
  const [open, setOpen] = useState(false)
  const [transfer, setTransfer] = useState('')
  const [note, setNote] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  const skills = useMemo(() => {
    const used = [...new Set(ISLANDS.flatMap((i) => i.skills))]
    return used.map((skill) => ({
      skill,
      label: SKILL_LABELS[skill] ?? skill,
      value: masteryOf(factsFor(skill).map((f) => f.id), save.facts),
    }))
  }, [save.facts])

  const practised = Object.keys(save.facts).length

  return (
    <div className="app-height relative overflow-hidden bg-[#1b1233]">
      <div className="safe-top safe-x safe-bottom flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pb-1 pt-3">
          <button type="button" onClick={onBack} aria-label="Tilbage"
            className="tap-target grid h-12 w-12 min-h-0 place-items-center rounded-2xl bg-white/10 text-xl ring-1 ring-white/20">‹</button>
          <p className="text-xl font-black">For voksne</p>
        </header>

        {!open ? (
          <Gate onOpen={() => setOpen(true)} onBack={onBack} />
        ) : (
          <div className="scroll-y flex-1 px-4 py-3">
            <div className="mx-auto flex max-w-md flex-col gap-6 pb-10">
              <section className="grid grid-cols-3 gap-2 text-center">
                <Box value={save.totalRounds} label="ture" />
                <Box value={save.totalCorrect} label="rigtige" />
                <Box value={save.streak.best} label="bedste stime" />
              </section>

              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-widest opacity-80">Fremgang</h2>
                <p className="mb-2 text-sm opacity-85">
                  {practised === 0
                    ? 'Ingen opgaver øvet endnu.'
                    : `${practised} regnestykker er mødt mindst én gang.`}
                </p>
                <p className="mb-4 text-sm leading-relaxed opacity-75">
                  At trykke på det rigtige af tre svar kan være held, så svarmuligheder
                  tæller kun op til stregen ved {CEILING_PERCENT} %. Resten skal barnet
                  skrive selv på taltastaturet — og appen begynder af sig selv at bede om
                  det, når et regnestykke nærmer sig stregen.
                </p>
                <div className="flex flex-col gap-2.5">
                  {skills.map(({ skill, label, value }) => (
                    <div key={skill}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-bold">{label}</span>
                        <span className="tabular-nums opacity-80">{Math.round(value * 100)} %</span>
                      </div>
                      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/12">
                        <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-300 transition-[width] duration-500"
                          style={{ width: `${Math.max(2, value * 100)}%` }} />
                        <span className="absolute inset-y-0 w-px bg-white/60" style={{ left: `${CEILING_PERCENT}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-widest opacity-80">Niveau</h2>
                <p className="mb-3 text-sm leading-relaxed opacity-75">
                  Øerne åbner ellers én ad gangen. Vælg et klassetrin, så barnet kan
                  starte hvor det giver mening — et barn i 2. klasse skal ikke tælle til
                  ti i fire ture først.
                </p>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  {([0, 1, 2] as const).map((grade) => (
                    <BigButton key={grade} tone="soft" className="h-12 text-sm"
                      onPress={() => { openThroughGrade(grade); setNote(`Øerne til ${grade}. klasse er åbne.`) }}>
                      {grade}. klasse
                    </BigButton>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  {ISLANDS.map((island, index) => {
                    const previous = ISLANDS[index - 1]
                    const earned =
                      index === 0 || levelsDoneOn(save, previous.id) >= previous.unlockAfter
                    return (
                      <div key={island.id}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/12">
                        <span className="font-bold">{island.emoji} {island.name}</span>
                        {earned ? (
                          <span className="text-xs font-black uppercase tracking-widest opacity-75">
                            {index === 0 ? 'altid åben' : 'klaret'}
                          </span>
                        ) : (
                          <button type="button"
                            aria-label={`${island.name} åben`}
                            onClick={() => setIslandUnlocked(island.id, !isIslandUnlocked(save, index))}
                            className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                            style={{ background: isIslandUnlocked(save, index) ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.22)' }}>
                            <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                              style={{ left: isIslandUnlocked(save, index) ? 26 : 4 }} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-widest opacity-80">Indstillinger</h2>
                <div className="flex flex-col gap-2">
                  <Toggle label="Lyd" on={save.settings.sound} onChange={(v) => setSetting('sound', v)} />
                  <Toggle label="Oplæsning" on={save.settings.speech} onChange={(v) => setSetting('speech', v)}
                    hint={hasDanishVoice() ? undefined : 'Enheden har ingen dansk stemme — oplæsning er slået fra'} />
                  <Toggle label="Læs opgaven op af sig selv" on={save.settings.autoSpeak} onChange={(v) => setSetting('autoSpeak', v)} />
                  <Toggle label="Bevægelse og effekter" on={save.settings.motion} onChange={(v) => setSetting('motion', v)} />
                </div>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-widest opacity-80">Gem og flyt</h2>
                <p className="mb-2 text-sm opacity-80">
                  Fremgangen ligger kun i denne browser. iOS rydder browserdata efter cirka en uges pause —
                  læg appen på hjemmeskærmen, og tag en kopi her hvis samlingen skal kunne flyttes.
                </p>
                <textarea
                  value={transfer}
                  onChange={(e) => setTransfer(e.target.value)}
                  placeholder="Kopien lander her"
                  className="h-28 w-full rounded-2xl bg-black/35 p-3 font-mono text-xs ring-1 ring-white/15 outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <BigButton tone="soft" className="h-12 flex-1 text-sm"
                    onPress={() => { setTransfer(exportSave(save)); setNote('Kopi lavet — markér teksten og kopiér den.') }}>
                    Lav kopi
                  </BigButton>
                  <BigButton tone="soft" className="h-12 flex-1 text-sm"
                    onPress={() => {
                      const data = importSave(transfer)
                      if (data) { replaceSave(data); setNote('Fremgang indlæst.') }
                      else setNote('Kunne ikke læse den tekst.')
                    }}>
                    Indlæs kopi
                  </BigButton>
                </div>
                {note && <p className="mt-2 text-sm opacity-75">{note}</p>}
              </section>

              <section>
                <h2 className="mb-2 text-sm font-black uppercase tracking-widest opacity-80">Start forfra</h2>
                {confirmReset ? (
                  <div className="flex gap-2">
                    <BigButton tone="soft" className="h-12 flex-1 text-sm" onPress={() => setConfirmReset(false)}>Nej, behold</BigButton>
                    <BigButton tone="soft" className="h-12 flex-1 text-sm !bg-rose-500/25 !ring-rose-300/40"
                      onPress={() => { reset(); setConfirmReset(false); setNote('Alt er nulstillet.') }}>
                      Ja, slet alt
                    </BigButton>
                  </div>
                ) : (
                  <BigButton tone="ghost" className="h-12 w-full text-sm" onPress={() => setConfirmReset(true)}>
                    Slet al fremgang og samling
                  </BigButton>
                )}
              </section>

              <p className="text-center text-xs leading-relaxed opacity-75">
                Talvennerne sender ingen data nogen steder. Ingen konto, ingen reklamer, ingen køb,
                ingen måling. Alt bliver i browseren på denne enhed.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white/8 px-2 py-3 ring-1 ring-white/12">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[11px] font-bold uppercase tracking-widest opacity-85">{label}</div>
    </div>
  )
}

function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 px-4 py-3 text-left ring-1 ring-white/12">
      <span>
        <span className="block font-bold">{label}</span>
        {hint && <span className="block text-xs opacity-85">{hint}</span>}
      </span>
      <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ background: on ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.22)' }}>
        <span className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
          style={{ left: on ? 26 : 4 }} />
      </span>
    </button>
  )
}
