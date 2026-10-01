// "Byg en sætning": pick a skill, a fact and a presentation and hear the statement the game would
// speak, composed from the recorded clips exactly as during play. Loaded lazily: it pulls in the skill
// register.
import { useMemo, useState } from 'react'
import { factsOf, registeredSkills } from '../engine/registry'
import type { SkillId, TaskKind } from '../engine/types'
import { SpeechLine } from './parts'

export default function BuildSentence() {
  const skills = useMemo(() => [...registeredSkills()].sort((a, b) => a.stage - b.stage || (a.id < b.id ? -1 : 1)), [])
  const [skillId, setSkillId] = useState<SkillId | undefined>(skills[0]?.id)
  const def = skills.find((s) => s.id === skillId)
  const facts = useMemo(() => (def ? factsOf(def) : []), [def])
  const [factId, setFactId] = useState('')
  const [kind, setKind] = useState<TaskKind | ''>('')
  if (!def) return null
  const fact = facts.find((f) => f.id === factId) ?? facts[0]
  const k: TaskKind = kind && def.kinds.includes(kind) ? kind : def.kinds[0]
  const pickRandom = () => {
    const f = facts[Math.floor(Math.random() * facts.length)]
    setFactId(f.id)
    setKind(def.kinds[Math.floor(Math.random() * def.kinds.length)])
  }
  const hint = fact ? def.hint(fact, null, k) : null
  return (
    <section className="lyt-card" id="byg">
      <h2>Byg en sætning</h2>
      <div className="lyt-row">
        <select value={skillId ?? ''} onChange={(e) => { setSkillId(e.target.value as SkillId); setFactId(''); setKind('') }} aria-label="Færdighed">
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.id})
            </option>
          ))}
        </select>
        <select value={fact?.id ?? ''} onChange={(e) => setFactId(e.target.value)} aria-label="Opgave">
          {facts.map((f) => (
            <option key={f.id} value={f.id}>
              {f.id}
            </option>
          ))}
        </select>
        <select value={k} onChange={(e) => setKind(e.target.value as TaskKind)} aria-label="Opgavetype">
          {def.kinds.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button type="button" className="lyt-btn lyt-btn--quiet" onClick={pickRandom}>
          Tilfældig
        </button>
      </div>
      {fact ? <SpeechLine parts={def.speech(fact, k)} label="Opgaven" /> : null}
      {hint ? <SpeechLine parts={hint.speech} label="Hjælpen" /> : null}
    </section>
  )
}
