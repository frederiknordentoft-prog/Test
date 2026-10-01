// "Tænd for lyden" (SPEC §8): a phone seen from the front with the silent switch and the volume
// buttons on its edge. The switch shows its orange stripe (muted) with an arrow to flip it, and the
// upper volume button has a plus. Colours from tokens (first-start.css).
import { arc, join, roundRect } from '../../../../art/materials/geom'
import { cx } from '../../../design/cx'

const SPEAKER = 'M86 76h9l12-10v32l-12-10h-9z'

export function SilentSwitchArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" className={cx('tv-switchart', className)} aria-hidden>
      {/* the phone */}
      <path d={roundRect(70, 6, 86, 148, 18)} className="tv-switchart__phone" />
      <path d={roundRect(78, 16, 70, 128, 10)} className="tv-switchart__screen" />
      <path d={SPEAKER} className="tv-switchart__speaker" />
      <path d={join(arc(104, 82, 12, -40, 40), arc(104, 82, 21, -40, 40))} className="tv-switchart__waves" />
      {/* the edge: silent switch (orange when muted) and the two volume buttons */}
      <path d={roundRect(62, 30, 9, 16, 3)} className="tv-switchart__switch" />
      <path d={roundRect(64, 58, 7, 24, 3)} className="tv-switchart__button tv-switchart__button--up" />
      <path d={roundRect(64, 88, 7, 24, 3)} className="tv-switchart__button" />
      {/* flip the switch */}
      <path d="M44 48q-14-10 0-24" className="tv-switchart__arrow" />
      <path d="M38 22l7 1-2 7" className="tv-switchart__arrow" />
      {/* turn it up */}
      <path d="M38 70h14M45 63v14" className="tv-switchart__plus" />
    </svg>
  )
}
