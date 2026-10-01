// The `round` route (SPEC §5.4): a round at a map stone, Blandet øvelse or the Træningshytte. The
// intro shows at once while the round module, the skill registry and the voice sprites load; then
// the stored round is resumed (`resume`, a reload, the same stone again) or a new one is planned, and
// RoundScreen takes over. ✕ → "Til kortet" stores the round and goes back; the end of the round
// hands over to the ceremonies. Nothing heavy is imported statically, so the screen paints at once.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { isAudioUnlocked } from '../../../audio/unlock'
import { preloadSpeech } from '../../../audio/voice'
import type { RegionId } from '../../../engine/types'
import { useProfile } from '../../../state/useProfile'
import type { RoundHooks } from '../../../state/useRound'
import type { RoundScreenProps } from './RoundScreen'
import { NODE_BY_ID } from '../../../content/curriculum'
import { PlayIntro } from './play/PlayIntro'
import { exitRound, noteRound } from './play/flow'
import type { Start } from './play/prepare'
import type { PlayTarget } from './map/nodes'

/** The intro stays at least this long: its words, and time for the sprites to arrive. */
const INTRO_MS = 1200
/** Sprites still missing after this are read by the device voice instead (voice.ts). */
const PRELOAD_MAX_MS = 2500

/** The round route may name the hut's region (proposed contract: `region?: RegionId`). */
type PlayRoute = RouteOf<'round'> & { region?: RegionId }

type Loaded =
  | { kind: 'ready'; start: Extract<Start, { kind: 'plan' | 'resume' }>; hooks: RoundHooks; Round: ComponentType<RoundScreenProps> }
  | { kind: 'closed' }

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function load(target: PlayTarget, hutRegion: RegionId | null): Promise<Loaded> {
  const t0 = performance.now()
  // useMeta is installed at boot; importing it here makes sure its round-finished handler is in
  // place before a round can finish
  const [prep, round] = await Promise.all([import('./play/prepare'), import('./RoundScreen'), import('../../../state/useMeta')])
  const profile = useProfile.getState().profile
  if (!profile) return { kind: 'closed' }
  const { sessionId, audioVerified } = useProfile.getState().context
  const start = prep.chooseStart(target, profile, { sessionId, audioVerified, now: Date.now(), hutRegion })
  if (start.kind === 'closed') return { kind: 'closed' }
  const hooks = prep.hooksFor(start, { audioVerified })
  await Promise.race([preloadSpeech(prep.roundStatements(start)).catch(() => undefined), wait(PRELOAD_MAX_MS)])
  const left = INTRO_MS - (performance.now() - t0)
  if (left > 0) await wait(left)
  return { kind: 'ready', start, hooks, Round: round.RoundScreen }
}

export default function PlayScreen({ route }: ScreenProps<RouteOf<'round'>>) {
  const target = route.node
  const hutRegion = (route as PlayRoute).region ?? null
  const profile = useProfile((s) => s.profile)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [tapped, setTapped] = useState(false)
  const job = useRef<Promise<Loaded> | null>(null)

  useEffect(() => {
    if (!useProfile.getState().profile) {
      useNav.getState().root({ id: 'profiles' }, 'back')
      return
    }
    let alive = true
    job.current ??= load(target, hutRegion)
    job.current.then(
      (r) => {
        if (alive) setLoaded(r)
      },
      (err: unknown) => {
        console.error(err)
        if (alive) setLoaded({ kind: 'closed' })
      },
    )
    return () => {
      alive = false
    }
    // one round per screen: the route is its seed
  }, [])

  const onClose = useCallback(() => useNav.getState().back(), [])
  const onStart = useCallback(() => setTapped(true), [])

  const buddy = profile?.animals.find((a) => a.uid === profile.buddyUid) ?? null
  // after a reload nothing has woken the sound yet: the intro waits for one tap
  const needTap = loaded?.kind === 'ready' && !tapped && !isAudioUnlocked()

  useEffect(() => {
    if (loaded?.kind === 'ready') noteRound(target)
  }, [loaded, target])

  if (loaded?.kind === 'ready' && !needTap) {
    const { Round, start, hooks } = loaded
    return (
      <div className="tv-play-round">
        <Round
          plan={start.kind === 'plan' ? start.plan : null}
          snapshot={start.kind === 'resume' ? start.snapshot : null}
          hooks={hooks}
          buddy={buddy}
          onExit={exitRound}
        />
      </div>
    )
  }

  const node = target === 'practice' || target === 'hut' ? null : NODE_BY_ID[target]
  const trialKey = node ? (node.slot === 'finale' ? node.world : node.slot === 'trial' ? node.region : null) : null
  return (
    <PlayIntro
      target={target}
      hutRegion={hutRegion}
      resume={!!route.resume || profile?.round?.nodeId === target}
      state={loaded?.kind === 'closed' ? 'closed' : needTap ? 'tap' : 'loading'}
      buddy={buddy}
      trial={trialKey ? (profile?.trials[trialKey] ?? null) : null}
      onStart={onStart}
      onClose={onClose}
    />
  )
}
