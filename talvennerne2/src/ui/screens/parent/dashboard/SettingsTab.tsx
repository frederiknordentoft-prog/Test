// Indstillinger (SPEC §9.1 point 12, §9.2): sound and motion, topics, a copy of the child's data
// (export/import per profile), deleting the profile, and "Om oplæsningen".
import { useEffect, useRef, useState } from 'react'
import { MAX_PROFILES } from '../../../../content/catalog'
import { DOMAINS } from '../../../../content/skills'
import {
  exportFileName, readImportFile, shareExport, type ExportFile, type ExportProfile, type ImportTarget,
} from '../../../../data/export'
import type { DomainId, ProfileDoc, ProfileSettings } from '../../../../engine/types'
import { fmtTsDate, genitive, nameOf } from '../../../../parent/format'
import { useProfile } from '../../../../state/useProfile'
import { useSession } from '../../../../state/useSession'
import { Sheet } from '../../../design/Sheet'
import { DashButton, Panel, Section, Toggle } from './parts'

const VOICE_CREDIT = 'Stemme: Røst-v3 Chatterbox fra CoRal-projektet (Alexandra Instituttet), OpenRAIL-licens'

export interface SettingsTabProps {
  profile: ProfileDoc
  /** After an import: read the data again. */
  onImported: () => void
  /** Delete the profile (the screen leaves afterwards). */
  onDelete: (id: string) => Promise<void>
}

export function SettingsTab({ profile, onImported, onDelete }: SettingsTabProps) {
  const device = useSession((s) => s.device)
  const count = useSession((s) => s.profiles.length)
  const name = nameOf(profile.name)
  const st = profile.settings
  const set = (patch: Partial<ProfileSettings>) => useProfile.getState().setSettings(patch)
  const toggleDomain = (id: DomainId, on: boolean) =>
    set({ domainsOff: on ? st.domainsOff.filter((d) => d !== id) : [...new Set([...st.domainsOff, id])] })

  // The copy is built before the tap (and again after a change): Safari only opens the share sheet
  // straight from a gesture, so nothing may be awaited between the tap and navigator.share().
  const [built, setBuilt] = useState<{ id: string; file: ExportFile } | null>(null)
  const [version, setVersion] = useState(0)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    useSession.getState().exportProfiles([profile.id])
      .then((file) => live && setBuilt({ id: profile.id, file }))
      .catch(() => live && setExportMsg('Kopien kunne ikke laves. Prøv igen om lidt.'))
    return () => {
      live = false
    }
  }, [profile, version])
  const file = built?.id === profile.id ? built.file : null
  const save = () => {
    if (!file) return
    setExportMsg(null)
    void shareExport(file).then((r) =>
      setExportMsg(r === 'shared' ? 'Kopien er delt.' : r === 'downloaded' ? `Filen ${exportFileName(file)} er hentet.` : r === 'failed' ? 'Kopien kunne ikke gemmes.' : null),
    )
  }

  const input = useRef<HTMLInputElement>(null)
  const [incoming, setIncoming] = useState<ExportFile | null>(null)
  const [pick, setPick] = useState(0)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const onFile = async (f: File | undefined) => {
    if (!f) return
    setImportMsg(null)
    const r = await readImportFile(f)
    if (r.ok) {
      setIncoming(r.file)
      setPick(0)
    } else setImportMsg(r.message)
  }
  const doImport = async (entry: ExportProfile, target: ImportTarget) => {
    setBusy(true)
    try {
      const doc = await useSession.getState().importProfile(entry, target)
      setImportMsg(target.mode === 'replace' ? `${genitive(name)} data er erstattet med filens.` : `${nameOf(doc.name)} er tilføjet som ny spiller.`)
      setIncoming(null)
      setVersion((v) => v + 1)
      if (target.mode === 'replace') onImported()
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : 'Filen kunne ikke hentes ind.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const [confirm, setConfirm] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null)
  const doDelete = async () => {
    setBusy(true)
    try {
      await onDelete(profile.id)
    } catch {
      setDeleteMsg('Profilen kunne ikke slettes. Prøv igen.')
      setBusy(false)
    }
  }

  const entry = incoming?.profiles[pick] ?? null
  return (
    <>
      <Section title="Lyd og bevægelse" sub={`Lydløs-knappen gælder hele enheden. Resten gælder for ${name}.`}>
        <Panel className="tv-dsettings">
          <Toggle
            label="Følg lydløs-knappen" checked={device.followSilentSwitch} onChange={(v) => useSession.getState().setDevice({ followSilentSwitch: v })}
            hint="Slået fra kan oplæsningen høres, selv om enheden står på lydløs – børn ved sjældent, at kontakten er slået til."
          />
          <Toggle label="Lydeffekter" checked={st.sfx} onChange={(v) => set({ sfx: v })} hint="Små lyde ved knapper, rigtige svar og belønninger." />
          <Toggle label="Oplæsning" checked={st.speech} onChange={(v) => set({ speech: v })} hint="Pip læser opgaver, knapper og forklaringer op. Børn, der ikke kan læse endnu, har brug for den." />
          <Toggle
            label="Læs opgaven op med det samme" checked={st.autoSpeak} disabled={!st.speech} onChange={(v) => set({ autoSpeak: v })}
            hint="Slået fra læses opgaven først op, når barnet trykker på øret."
          />
          <Toggle label="Rolig animation" checked={st.calm} onChange={(v) => set({ calm: v })} hint="Færre bevægelser på skærmen." />
        </Panel>
      </Section>

      <Section title="Emner" sub="Et fravalgt emne kommer ikke med i Blandet øvelse og i gentagelserne på andre ture og bliver ikke foreslået her. Områderne på kortet er der stadig.">
        <Panel className="tv-dsettings">
          {DOMAINS.map((d) => (
            <Toggle key={d.id} label={d.label} hint={d.group} checked={!st.domainsOff.includes(d.id)} onChange={(v) => toggleDomain(d.id, v)} />
          ))}
        </Panel>
      </Section>

      <Section title={`${genitive(name)} data`} sub={`Alt om ${name} ligger kun på denne enhed. Gem en kopi, hvis I skifter enhed – eller hvis Safari rydder op efter en lang pause.`}>
        <Panel>
          <div className="tv-dactions">
            <DashButton tone="primary" onClick={save} disabled={!file}>{file ? 'Gem en kopi' : 'Gør kopien klar …'}</DashButton>
            <DashButton onClick={() => input.current?.click()} disabled={busy}>Hent fra en fil</DashButton>
          </div>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          {exportMsg && <p className="tv-dmsg" role="status">{exportMsg}</p>}
          {importMsg && <p className="tv-dmsg" role="status">{importMsg}</p>}
          {incoming && entry && (
            <div className="tv-dimport">
              {incoming.profiles.length > 1 && (
                <div className="tv-dactions">
                  {incoming.profiles.map((p, i) => (
                    <DashButton key={p.doc.id} tone={i === pick ? 'primary' : 'plain'} onClick={() => setPick(i)}>{nameOf(p.doc.name)}</DashButton>
                  ))}
                </div>
              )}
              <p>
                Filen indeholder {nameOf(entry.doc.name)} ({entry.doc.grade}. klasse), gemt {fmtTsDate(incoming.exportedAt)}.
              </p>
              <div className="tv-dactions">
                <DashButton disabled={busy} onClick={() => void doImport(entry, { mode: 'replace', profileId: profile.id })}>Erstat {genitive(name)} data</DashButton>
                <DashButton disabled={busy || count >= MAX_PROFILES} onClick={() => void doImport(entry, { mode: 'new' })}>Tilføj som ny spiller</DashButton>
                <DashButton tone="quiet" onClick={() => setIncoming(null)}>Fortryd</DashButton>
              </div>
              {count >= MAX_PROFILES && <p className="tv-dmuted">Der er allerede {MAX_PROFILES} spillere på enheden.</p>}
            </div>
          )}
        </Panel>
        <Panel>
          <DashButton onClick={() => setConfirm(true)}>Slet {genitive(name)} profil</DashButton>
        </Panel>
      </Section>

      <Section title="Om oplæsningen">
        <Panel>
          <p>Pips stemme er computergenereret med en af talemodellens to faste stemmer. Alle sætninger er lavet på forhånd og ligger i appen, så intet sendes videre.</p>
          <p className="tv-dline">{VOICE_CREDIT}.</p>
          <p className="tv-dline">
            <a className="tv-dlink" href="./lyt.html" target="_blank" rel="noopener">Lyt til stemmens klip</a>
          </p>
        </Panel>
      </Section>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <div className="tv-dconfirm">
          <h2 className="tv-dsec__title">Slet {genitive(name)} profil?</h2>
          <p>Alt om {name} bliver slettet fra denne enhed: fremskridt, dyr, ting og historik. Det kan ikke fortrydes. Gem en kopi først, hvis I vil kunne hente det igen.</p>
          <div className="tv-dactions">
            <DashButton tone="primary" onClick={() => setConfirm(false)}>Behold {name}</DashButton>
            <DashButton disabled={busy} onClick={() => void doDelete()}>Slet</DashButton>
          </div>
          {deleteMsg && <p className="tv-dmsg" role="alert">{deleteMsg}</p>}
        </div>
      </Sheet>
    </>
  )
}
