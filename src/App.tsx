import { useEffect, useState } from 'react'
import { HomeScreen } from './ui/screens/HomeScreen'
import { IslandScreen } from './ui/screens/IslandScreen'
import { RoundScreen } from './ui/screens/RoundScreen'
import { RewardScreen } from './ui/screens/RewardScreen'
import { AlbumScreen } from './ui/screens/AlbumScreen'
import { MyIslandScreen } from './ui/screens/MyIslandScreen'
import { ParentScreen } from './ui/screens/ParentScreen'
import { WelcomeScreen } from './ui/screens/WelcomeScreen'
import { ParticleCanvas } from './fx/ParticleCanvas'
import { nextLevel, useProfile } from './state/useProfile'
import { useRound } from './state/useRound'
import { setSoundEnabled, unlockAudio } from './audio/sfx'
import { setSpeechEnabled, stopSpeech } from './audio/speech'
import { setHapticsEnabled } from './fx/haptics'
import { clearParticles, setEffectIntensity } from './fx/particles'

type Screen =
  | { k: 'welcome' }
  | { k: 'map' }
  | { k: 'island'; id: string }
  | { k: 'round' }
  | { k: 'album' }
  | { k: 'myisland' }
  | { k: 'parent' }

export function App() {
  const save = useProfile((s) => s.save)
  const round = useRound()
  const [screen, setScreen] = useState<Screen>(() => (loadOnboarded() ? { k: 'map' } : { k: 'welcome' }))
  const [showInstallHint, setShowInstallHint] = useState(false)

  // settings drive the whole feedback layer
  useEffect(() => {
    setSoundEnabled(save.settings.sound)
    setSpeechEnabled(save.settings.speech)
    setHapticsEnabled(save.settings.sound)
  }, [save.settings.sound, save.settings.speech])

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setEffectIntensity(!save.settings.motion || reduced ? 0 : 1)
  }, [save.settings.motion])

  // iOS keeps every AudioContext asleep until a real gesture
  useEffect(() => {
    const wake = () => unlockAudio()
    window.addEventListener('pointerdown', wake, { once: true })
    return () => window.removeEventListener('pointerdown', wake)
  }, [])

  // stop talking and drop particles whenever the app goes to the background
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        stopSpeech()
        clearParticles()
      }
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  // a home-screen install keeps its own storage, which is what protects the collection
  useEffect(() => {
    const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (isApple && !standalone && save.totalRounds >= 1 && !sessionStorage.getItem('hint-seen')) {
      setShowInstallHint(true)
    }
  }, [save.totalRounds])

  const startLevel = (levelId: string) => {
    round.start(levelId)
    setScreen({ k: 'round' })
  }

  /** ✕ keeps the round instead of throwing it away. */
  const pauseToMap = () => {
    round.pause()
    setScreen({ k: 'map' })
  }

  const backToMap = () => {
    round.quit()
    setScreen({ k: 'map' })
  }

  const playNext = () => {
    const next = nextLevel(save)
    if (next) startLevel(next.levelId)
  }

  const resumePaused = () => {
    round.resume()
    setScreen({ k: 'round' })
  }

  if (screen.k === 'welcome') {
    return (
      <>
        <WelcomeScreen onDone={() => setScreen({ k: 'map' })} />
        <ParticleCanvas />
      </>
    )
  }

  return (
    <>
      {screen.k === 'map' && (
        <HomeScreen
          onOpenIsland={(id) => setScreen({ k: 'island', id })}
          onOpenAlbum={() => setScreen({ k: 'album' })}
          onOpenMyIsland={() => setScreen({ k: 'myisland' })}
          onOpenParent={() => setScreen({ k: 'parent' })}
          onPlayNext={playNext}
          onResume={resumePaused}
        />
      )}

      {screen.k === 'island' && (
        <IslandScreen
          islandId={screen.id}
          onBack={() => setScreen({ k: 'map' })}
          onStart={startLevel}
        />
      )}

      {screen.k === 'round' &&
        (round.status === 'finished' ? (
          <RewardScreen onDone={backToMap} onAgain={() => { round.quit(); playNext() }} />
        ) : (
          <RoundScreen onQuit={pauseToMap} />
        ))}

      {screen.k === 'album' && <AlbumScreen onBack={() => setScreen({ k: 'map' })} />}
      {screen.k === 'myisland' && <MyIslandScreen onBack={() => setScreen({ k: 'map' })} />}
      {screen.k === 'parent' && <ParentScreen onBack={() => setScreen({ k: 'map' })} />}

      {showInstallHint && screen.k === 'map' && (
        <div className="safe-bottom pop-in fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-3xl bg-[#241a44] px-4 py-3 text-sm shadow-2xl ring-1 ring-white/20">
          <span className="text-2xl">📲</span>
          <p className="flex-1 leading-snug">
            Læg Talvennerne på hjemmeskærmen: tryk <strong>Del</strong> og så <strong>Føj til hjemmeskærm</strong>.
            Så husker den også fremgangen bedre.
          </p>
          <button type="button" aria-label="Luk"
            onClick={() => { sessionStorage.setItem('hint-seen', '1'); setShowInstallHint(false) }}
            className="tap-target grid h-10 w-10 min-h-0 place-items-center rounded-xl bg-white/12 ring-1 ring-white/20">
            ✕
          </button>
        </div>
      )}

      <ParticleCanvas />
    </>
  )
}

function loadOnboarded(): boolean {
  return useProfile.getState().save.onboarded
}
