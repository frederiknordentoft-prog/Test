import { useEffect, useState } from 'react'

// Minimal type for the non-standard beforeinstallprompt event.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Shows an "install app" button only when the browser offers installation. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setHidden(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden || !deferred) return null

  return (
    <button
      type="button"
      onClick={async () => {
        await deferred.prompt()
        setDeferred(null)
      }}
      className="mx-auto mt-2 rounded-xl border border-sky-500/50 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-500/20 active:scale-95 touch-manipulation"
    >
      ⬇ Installér Kuglebanen
    </button>
  )
}
