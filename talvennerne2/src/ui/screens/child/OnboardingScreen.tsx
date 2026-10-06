// A new child (SPEC §8 "Onboarding pr. barn", about five minutes): Pip says hello and asks for the
// name (optional; a grown-up often types it, else "Spiller N"), the little animals peek out of their
// eggs — only the drawn starters, each in the breed and colour it will hatch with — and the chosen
// egg hatches on the third tap (a gentle hand after 60 s, never a countdown), the new friend gets one
// of six suggested names (read aloud one by one) or a typed one, and the child picks a grade; Pip
// says honestly that everyone starts in Engdalen. Then the map, with the first round of Engdalen on
// top.
//
// A child in 3. klasse is offered "Vis Pip hvad du kan" (onboarding/placement/, its own chunk) once
// Stjernefjeldet is built: Pip says so instead of "Alle starter i Engdalen", "Næste" leads to the
// ladder (or "Spring over"), and the first round starts on the map's next stone in the child's own
// world. Before that, and for 0.–2. klasse always, the onboarding is the one above.
//
// The child is created at the hatch (see onboarding/flow.ts), with the id the eggs were drawn for:
// until the first crack every step can be undone; from there on there is no way back to an egg the
// child did not hatch.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { playSfx } from '../../../audio/sfx'
import type { SpeakHandle } from '../../../audio/voice'
import { STARTERS } from '../../../content/catalog'
import { nameClip, nameSuggestions } from '../../../content/names'
import { ProfileLimitError, defaultName } from '../../../data/repo/profiles'
import type { Animal, ClipId, Grade, SpeechPart, SpeciesId } from '../../../engine/types'
import { worldBuilt } from '../../../meta/built'
import { useSession } from '../../../state/useSession'
import { Button } from '../../design/Button'
import { SpokenText } from '../../design/SpokenText'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { TopBar } from '../../shell/TopBar'
import { preloadSpecies } from './onboarding/art'
import { finishOnboarding, hatchFirstFriend, nameFriend, newProfileId, offeredStarters, starterLooks } from './onboarding/flow'
import { PipFigure } from './onboarding/Pip'
import { EggChoice, EggHatch, FriendStep, GradeStep, NameStep, WriteNameSheet } from './onboarding/steps'
import './onboarding/first-start.css'

type Step = 'name' | 'egg' | 'friend' | 'grade' | 'placement'
/** The dots in the top bar ("Vis Pip hvad du kan" has its own screen after them). */
const STEPS: readonly Step[] = ['name', 'egg', 'friend', 'grade']

/** "Vis Pip hvad du kan": fetched on the grade step, and only once Stjernefjeldet is built. */
type Ladder = typeof import('./onboarding/placement')
const loadLadder = (): Promise<Ladder> => import('./onboarding/placement')

/** No hatch after this long: a gentle hand and Pip's hint (SPEC §8: "klæk inden for 60 s"). */
const HATCH_HELP_MS = 60_000
/** The third tap: the egg rocks a moment before it opens. */
const HATCH_MIN_MS = 420
const NAME_GAP_MS = 260
/** "Kom, så går vi i gang!" is heard before the round starts, but never holds it up for long. */
const GO_MAX_MS = 2500

preloadSpecies(STARTERS)

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const clips = (...ids: ClipId[]): SpeechPart[] => ids.map((clip) => ({ clip }))

export default function OnboardingScreen(_: ScreenProps<RouteOf<'onboarding'>>) {
  const speech = useSpeech()
  const canLeave = useNav((s) => s.stack.length > 0)
  const profiles = useSession((s) => s.profiles)
  // The child's id is picked before the eggs are shown: each baby peeks out in the breed and colour
  // it will hatch with, because both are drawn from the id (review P2-9).
  const [plannedId] = useState(newProfileId)
  const starters = useMemo(() => offeredStarters(), [])
  const looks = useMemo(() => starterLooks(plannedId, starters), [plannedId, starters])
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<SpeciesId | null>(null)
  const [cracks, setCracks] = useState<0 | 1 | 2>(0)
  const [taps, setTaps] = useState(0)
  const [hatching, setHatching] = useState(false)
  const [friend, setFriend] = useState<Animal | null>(null)
  const [error, setError] = useState<ClipId | null>(null)
  const [names, setNames] = useState<string[]>([])
  const [chosen, setChosen] = useState('')
  const [custom, setCustom] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [reading, setReading] = useState<number | null>(null)
  const [grade, setGrade] = useState<Grade | null>(null)
  /** The placement's chunk: null until fetched, 'failed' when it could not load (then as before). */
  const [ladder, setLadder] = useState<Ladder | 'failed' | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [help, setHelp] = useState(false)
  const [idle, setIdle] = useState(0)
  const [talking, setTalking] = useState(false)
  const voice = useRef<SpeakHandle | null>(null)
  /** Bumped to stop the names being read one by one. */
  const readToken = useRef(0)
  /** Pip says hello only on the way in, not when the child comes back to the name. */
  const leftName = useRef(false)

  const say = (parts: SpeechPart[]): SpeakHandle => {
    readToken.current++
    setReading(null)
    voice.current?.cancel()
    const h = speech.speak(parts)
    voice.current = h
    setTalking(true)
    void h.ended.then(() => {
      if (voice.current === h) setTalking(false)
    })
    return h
  }

  /** Pip's line for where the child is (the bubble shows its first clip). */
  const line = (): ClipId[] => {
    if (error) return [error]
    switch (step) {
      case 'name':
        return ['s.onb.name.ask']
      case 'egg':
        if (friend) return ['s.onb.hatched']
        if (picked) return help ? ['s.onb.egg.help'] : ['s.onb.egg.tap']
        // "Fire små dyr …" only while all four starters are there
        return help ? ['s.onb.egg.helpPick'] : [starters.length === 4 ? 's.onb.egg.ask' : 's.onb.egg.ask.some']
      case 'friend':
        return ['s.onb.friend.ask']
      case 'grade':
        return ['s.onb.grade.ask']
      case 'placement':
        // the placement's own screen speaks for itself
        return []
    }
  }
  const shown = line()[0]

  /** What Pip says (the hello comes first, once). */
  const speakLine = () => {
    const ids = line()
    if (step === 'name' && !leftName.current && !error) return say(clips('s.onb.hello', 's.onb.name.ask'))
    if (step === 'egg' && picked && !friend && !help && !error) return say(clips(`name.baby.${picked}`, 's.onb.egg.tap'))
    return say(clips(ids[0]))
  }

  /** The six names, one after another, each choice glowing while it is said. */
  const readNames = async (after: SpeakHandle) => {
    const token = readToken.current
    await after.ended
    for (let i = 0; i < names.length; i++) {
      if (readToken.current !== token) return
      setReading(i)
      const clip = nameClip(names[i])
      const h = speech.speak([clip ? { clip } : { free: names[i] }])
      voice.current = h
      await h.ended
      await wait(NAME_GAP_MS)
    }
    if (readToken.current === token) setReading(null)
  }

  // Pip speaks whenever the step (or the egg's state) changes, and once when the help appears; the
  // tap that ends the help is quiet.
  const lineKey = `${step}|${picked ?? ''}|${friend ? 1 : 0}|${error ?? ''}|${names.length}`
  useEffect(() => {
    if (step !== 'name') leftName.current = true
    if (step === 'placement') return
    const h = speakLine()
    if (step === 'friend' && names.length > 0) void readNames(h)
  }, [lineKey])
  useEffect(() => {
    if (help) say(clips(line()[0]))
  }, [help])

  useEffect(
    () => () => {
      readToken.current++
      voice.current?.cancel()
    },
    [],
  )

  // The gentle help: 60 s on the egg step without hatching. Any tap starts the wait over.
  useEffect(() => {
    if (step !== 'egg' || friend || help) return
    const t = window.setTimeout(() => setHelp(true), HATCH_HELP_MS)
    return () => window.clearTimeout(t)
  }, [step, friend, help, idle])
  const touched = () => {
    setHelp(false)
    setIdle((n) => n + 1)
  }

  // ── Steps ──
  const pick = (species: SpeciesId) => {
    touched()
    playSfx('pop')
    setPicked(species)
    setCracks(0)
    setTaps(0)
  }

  const tapEgg = async () => {
    if (!picked || friend || hatching) return
    touched()
    setError(null)
    setTaps((n) => n + 1)
    if (cracks < 2) {
      playSfx(cracks === 0 ? 'tik' : 'snap')
      setCracks((cracks + 1) as 1 | 2)
      return
    }
    setHatching(true)
    playSfx('klaek')
    try {
      const [animal] = await Promise.all([hatchFirstFriend({ name, species: picked, id: plannedId }), wait(HATCH_MIN_MS)])
      const suggestions = nameSuggestions(animal)
      setFriend(animal)
      setNames(suggestions.includes(animal.name) ? suggestions : [animal.name, ...suggestions.slice(0, 5)])
      setChosen(animal.name)
      playSfx('glimmer')
    } catch (err) {
      setError(err instanceof ProfileLimitError ? 's.onb.full' : 's.onb.error')
    } finally {
      setHatching(false)
    }
  }

  const chooseName = (n: string) => {
    readToken.current++
    setReading(null)
    setChosen(n)
    const clip = nameClip(n)
    say([clip ? { clip } : { free: n }])
  }

  // ── "Vis Pip hvad du kan" (3. klasse, once Stjernefjeldet is built: onboarding/placement/) ──
  const fjeld = worldBuilt('fjeld')
  const placement = ladder && ladder !== 'failed' ? ladder : null
  const offered = !!placement && placement.placementOffered(grade)
  /** 3. klasse is chosen while the placement's chunk is still on its way: "Spil" waits a moment. */
  const waiting = grade === 3 && fjeld && ladder === null
  /** The grade tapped last (Pip's line for an earlier tap is dropped). */
  const lastGrade = useRef<Grade | null>(null)

  const fetchLadder = (): Promise<Ladder | null> => {
    if (ladder === 'failed') return Promise.resolve(null)
    if (ladder) return Promise.resolve(ladder)
    return loadLadder().then(
      (m) => {
        setLadder(m)
        if (m.placementOffered(m.PLACEMENT_GRADE)) m.preloadPlacementVoice()
        return m
      },
      () => {
        setLadder('failed')
        return null
      },
    )
  }
  useEffect(() => {
    if (step === 'grade' && fjeld && ladder === null) void fetchLadder()
  }, [step])

  /** Under the grades and after the grade's name: where the child starts. */
  const startLine = (g: Grade | null, m: Ladder | null): ClipId => (m?.placementOffered(g) ? 's.place.grade' : 's.onb.grade.start')

  const chooseGrade = (g: Grade) => {
    setGrade(g)
    lastGrade.current = g
    if (g === 3 && fjeld && ladder === null) {
      void fetchLadder().then((m) => {
        if (lastGrade.current === g) say(clips(`s.onb.grade.${g}`, startLine(g, m)))
      })
      return
    }
    say(clips(`s.onb.grade.${g}`, startLine(g, placement)))
  }

  const finish = async () => {
    if (grade === null || finishing) return
    setFinishing(true)
    const h = say(clips('s.onb.go'))
    try {
      // Pip's last line is heard before the round takes over the voice
      await Promise.race([h.ended, wait(GO_MAX_MS)])
      await finishOnboarding(grade)
    } catch {
      setFinishing(false)
      setError('s.onb.error')
    }
  }

  // ── Back (until the first crack every step can be undone) ──
  const back: (() => void) | null = (() => {
    switch (step) {
      case 'name':
        return canLeave ? () => useNav.getState().back() : null
      case 'egg':
        if (friend || hatching || cracks > 0) return null
        return picked ? () => setPicked(null) : () => setStep('name')
      case 'friend':
        return null
      case 'grade':
        return () => setStep('friend')
      case 'placement':
        return null
    }
  })()

  const actions = (() => {
    switch (step) {
      case 'name':
        return <Button clip="s.ui.next" iconEnd="next" onClick={() => setStep('egg')} data-next="" />
      case 'egg':
        if (friend) return <Button clip="s.ui.next" iconEnd="next" onClick={() => setStep('friend')} data-next="" />
        if (picked && cracks === 0 && !hatching) return <Button variant="secondary" clip="s.onb.egg.other" icon="egg" onClick={() => setPicked(null)} />
        return null
      case 'friend':
        return (
          <Button
            clip="s.ui.next"
            iconEnd="next"
            onClick={() => {
              if (friend) nameFriend(friend.uid, chosen)
              setStep('grade')
            }}
            data-next=""
          />
        )
      case 'grade':
        if (offered) return <Button clip="s.ui.next" iconEnd="next" onClick={() => setStep('placement')} data-next="" />
        return <Button clip="s.ui.play" icon="play" disabled={grade === null || finishing || waiting} onClick={() => void finish()} data-next="" />
      case 'placement':
        return null
    }
  })()

  if (step === 'placement' && placement && grade !== null) {
    const { PlacementStep } = placement
    return <PlacementStep grade={grade} onBack={() => setStep('grade')} />
  }

  const at = STEPS.indexOf(step)
  return (
    <div className="tv-first tv-onb" data-step={step}>
      <TopBar
        leading={back ? 'back' : null}
        onLeading={back ?? undefined}
        center={
          <span className="tv-onb__dots" aria-hidden>
            {STEPS.map((s, i) => (
              <i key={s} className={cx('tv-onb__dot', i < at && 'is-done', i === at && 'is-on')} />
            ))}
          </span>
        }
        onReplay={() => {
          const h = speakLine()
          if (step === 'friend') void readNames(h)
        }}
      />
      <div className="tv-first__body tv-first__body--talk">
        <div className="tv-say">
          <PipFigure talking={talking} className="tv-say__pip" />
          <div className={cx('tv-say__bubble', talking && 'is-talking')}>
            <SpokenText clip={shown} className="tv-say__text" key={shown} />
          </div>
        </div>

        {step === 'name' && <NameStep name={name} placeholder={defaultName(profiles.map((p) => p.name))} onName={setName} onDone={() => setStep('egg')} />}
        {step === 'egg' &&
          (picked ? (
            <EggHatch species={picked} cracks={cracks} taps={taps} friend={friend} help={help} label={speech.text('s.onb.egg.tap')} onTap={() => void tapEgg()} />
          ) : (
            <EggChoice help={help} starters={starters} looks={looks} onPick={pick} />
          ))}
        {step === 'friend' && friend && (
          <FriendStep friend={friend} names={names} chosen={chosen} custom={custom} reading={reading} onChoose={chooseName} onWrite={() => setWriting(true)} />
        )}
        {step === 'grade' && <GradeStep grade={grade} onGrade={chooseGrade} start={startLine(grade, placement)} />}

        <div className="tv-first__actions">{actions}</div>
      </div>
      <WriteNameSheet
        open={writing}
        initial={custom ?? ''}
        onClose={() => setWriting(false)}
        onDone={(n) => {
          setWriting(false)
          setCustom(n)
          chooseName(n)
        }}
      />
    </div>
  )
}
