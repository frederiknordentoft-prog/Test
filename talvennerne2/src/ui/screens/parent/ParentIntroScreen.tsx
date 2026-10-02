// First start on a device (SPEC §8 "Første opstart", step 1): three cards for the grown-up, in plain
// Danish and without read-aloud (like the dashboard): put the app on the home screen first, all
// data stays on the device, and every reward is earned by doing maths. "Kom i gang" goes on to the
// sound check, or straight to onboarding when the device has been checked before (the last child
// was deleted and the intro is shown again).
import type { ReactNode } from 'react'
import { useNav } from '../../../app/nav'
import type { RouteOf } from '../../../app/routes'
import type { ScreenProps } from '../../../app/screens'
import { useSession } from '../../../state/useSession'
import { Button } from '../../design/Button'
import { Icon } from '../../design/Icon'
import type { IconName } from '../../design/icons'
import { PipFigure } from '../child/onboarding/Pip'
import '../child/onboarding/first-start.css'

/** Opened from the home screen (iOS `navigator.standalone`, or the web app display mode). */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return ios || (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches)
}

function IntroCard({ n, icon, title, art, children }: { n: number; icon: IconName; title: string; art?: ReactNode; children: ReactNode }) {
  return (
    <li className="tv-intro__card">
      <div className="tv-intro__head">
        <span className="tv-intro__icon" aria-hidden>
          <Icon name={icon} size={30} />
        </span>
        <h2 className="tv-intro__title">
          <span className="tv-intro__n">{n}.</span> {title}
        </h2>
      </div>
      {art}
      <div className="tv-intro__text">{children}</div>
    </li>
  )
}

/** Safari's Share button, then "Føj til hjemmeskærm" in the share sheet. */
function HomeScreenArt() {
  return (
    <div className="tv-intro__how" aria-hidden>
      <span className="tv-intro__key">
        <Icon name="share" size={30} strokeWidth={2.2} />
      </span>
      <Icon name="next" size={26} className="tv-intro__then" />
      <span className="tv-intro__menu">
        <span>Føj til hjemmeskærm</span>
        <span className="tv-intro__plus">
          <Icon name="plus" size={20} strokeWidth={2.4} />
        </span>
      </span>
    </div>
  )
}

export default function ParentIntroScreen(_: ScreenProps<RouteOf<'parentIntro'>>) {
  const installed = isStandalone()
  const start = () => {
    const checked = useSession.getState().device.audioVerified !== null
    useNav.getState().go(checked ? { id: 'onboarding' } : { id: 'soundCheck' })
  }
  return (
    <div className="tv-intro" data-installed={installed ? '' : undefined}>
      <div className="tv-intro__scroll">
        <header className="tv-intro__hello">
          <PipFigure className="tv-intro__pip" />
          <div>
            <h1 className="tv-intro__h1">Velkommen til Talvennerne</h1>
            <p className="tv-intro__lead">
              Matematik fra 0. til 3. klasse, hvor barnet regner sig til dyr, tøj og nye steder på kortet. Alle børn starter i Engdalen; i forældredelen kan I
              åbne flere steder. Tre ting, før I går i gang:
            </p>
          </div>
        </header>
        <ol className="tv-intro__cards">
          <IntroCard n={1} icon="home" title="Læg appen på hjemmeskærmen først" art={<HomeScreenArt />}>
            <p>
              Tryk på Del-knappen i Safari, og vælg »Føj til hjemmeskærm«. Åbn så Talvennerne fra ikonet på hjemmeskærmen, før I opretter spillere: appen på
              hjemmeskærmen gemmer sine data for sig selv, adskilt fra Safari.
            </p>
            {installed && (
              <p className="tv-intro__done">
                <Icon name="check" size={22} strokeWidth={2.8} /> Det er gjort. Appen kører fra hjemmeskærmen.
              </p>
            )}
          </IntroCard>
          <IntroCard n={2} icon="lock" title="Alt bliver på enheden">
            <p>
              Navne, svar og fremskridt gemmes kun på denne enhed. Der er ingen konto, ingen reklamer og ingen målinger, og intet sendes videre. Under »For
              voksne« kan I gemme en sikkerhedskopi.
            </p>
          </IntroCard>
          <IntroCard n={3} icon="star" title="Alle belønninger optjenes ved at regne – intet kan købes">
            <p>Dyr, tøj og perler kommer kun af at regne. Der er ingen køb, ingen tidsbegrænsede tilbud og ingen krav om at spille hver dag.</p>
          </IntroCard>
        </ol>
      </div>
      <div className="tv-intro__foot">
        <Button block iconEnd="next" onClick={start} data-next="">
          <span className="tv-btn__label">Kom i gang</span>
        </Button>
      </div>
    </div>
  )
}
