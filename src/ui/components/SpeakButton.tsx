import { hasDanishVoice, speak } from '../../audio/speech'

/** Hear the question again. Hidden entirely when the device has no Danish voice. */
export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  if (!hasDanishVoice()) return null
  return (
    <button
      type="button"
      aria-label="Hør opgaven igen"
      onClick={() => speak(text)}
      className={`tap-target grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/12 text-2xl ring-1 ring-white/25 ${className}`}
    >
      🔊
    </button>
  )
}
