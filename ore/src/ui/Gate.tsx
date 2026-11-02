import { unlockAudio } from '../diag/audio';

/** First tap: unlocks audio and lifts WebKit's rAF throttle for cross-origin iframes. */
export function Gate({ onOpen, demo = false }: { onOpen: () => void; demo?: boolean }) {
  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="gate-mark" aria-hidden="true">Ø<span>RE</span></div>
      <ol id="gate-title">
        <li><b>Kurs 55 ≈ 55 % chance.</b> En andel koster 55 øre og betaler 1 kr, hvis udfaldet sker, ellers 0.</li>
        <li><b>100 fremtider.</b> Viften viser kampens mulige forløb. Tallet ved højre kant tæller, hvor mange der ender med hvert udfald, og prisen er det tal plus husets andel.</li>
        <li><b>Sælg når som helst.</b> Prisen lever med kampen, og alt her er fiktivt.</li>
      </ol>
      <button
        className="gate-btn"
        onClick={() => {
          unlockAudio();
          onOpen();
        }}
      >
        {demo ? 'Se demoen' : 'Tryk for at åbne handlen'}
      </button>
      <p className="gate-foot">Prototype · fiktive kurser · ingen rigtige penge</p>
    </div>
  );
}
