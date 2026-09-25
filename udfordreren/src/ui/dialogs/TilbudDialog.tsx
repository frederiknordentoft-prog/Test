// Opkøbstilbud (signal 'tilbud'): byderens monogram, prisen, stifternes andel og hvad et ja og et nej betyder.
// "Sælg firmaet" slutter spillet som exit (to trin, så det ikke sker ved et uheld). "Nej tak" gør byderen mere
// aggressiv i to år. Lukkes dialogen uden svar, står tilbuddet til udløb — og så er det et nej.
import { useState } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Modal, Monogram } from '../components/kit';
import { ejerInfo, vaerdiansaettelse, aarligBsi, datoTekst } from '../../sim/selectors';
import { R2 } from '../../data/reactionRules';
import { mio, pct } from '../format';
import { ARKETYPE, stifterAndel, tilbudSlutning, ugerTilbage } from '../lib/konkurrentHjaelp';

const fmtX = (v: number) => `${(Math.round(v * 10) / 10).toFixed(1).replace('.', ',')}×`;

export default function TilbudDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const [bekraeft, setBekraeft] = useState(false);
  if (!g || signal.k !== 'tilbud') return null;

  const t = g.opkoebstilbud;
  const gyldigt = t !== null && t.competitorId === signal.competitorId;
  const c = g.konkurrenter.find((k) => k.id === signal.competitorId);
  const info = ejerInfo(g, signal.competitorId);
  const pris = gyldigt ? t.pris : signal.pris;
  const stiftere = stifterAndel(g, pris);
  const vaerdi = vaerdiansaettelse(g);
  const bsi = aarligBsi(g);
  const slut = tilbudSlutning(signal.competitorId);
  const tilbage = gyldigt ? ugerTilbage(g, t.udloeberUge) : 0;

  const saelg = () => {
    if (!bekraeft) {
      setBekraeft(true);
      return;
    }
    if (useGame.getState().dispatch({ t: 'acceptOffer', competitorId: signal.competitorId })) onLuk();
  };
  const afvis = () => {
    if (useGame.getState().dispatch({ t: 'afvisTilbud' })) {
      useGame.getState().toast(`I sagde nej tak til ${info.navn}. De bliver mere aggressive i to år.`, 'info');
      onLuk();
    }
  };

  if (!gyldigt) {
    return (
      <Modal
        titel="Opkøbstilbud"
        onLuk={onLuk}
        testId="dialog-tilbud"
        bredde={520}
        fod={
          <Btn variant="primaer" onClick={onLuk} testId="tilbud-ok" className="w-full sm:w-auto">
            OK
          </Btn>
        }
      >
        <div className="flex items-center gap-3">
          <Monogram tekst={info.monogram} farve={info.farve} str={44} />
          <p className="text-sm text-muted">Tilbuddet fra {info.navn} er ikke længere på bordet. Firmaet er stadig jeres.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      titel="Opkøbstilbud"
      onLuk={onLuk}
      testId="dialog-tilbud"
      bredde={640}
      fod={
        <>
          <Btn variant="ghost" onClick={onLuk} testId="tilbud-senere" className="mr-auto">
            <Ikon navn="ur" farve="currentColor" str={14} /> Tænk over det
          </Btn>
          <Btn onClick={afvis} testId="tilbud-afvis">
            <Ikon navn="kryds" farve="var(--color-bad)" str={14} /> Nej tak
          </Btn>
          <Btn variant={bekraeft ? 'fare' : 'primaer'} onClick={saelg} testId="tilbud-accepter">
            <Ikon navn="penge" farve="currentColor" indre={bekraeft ? 'var(--color-bad)' : 'var(--color-gold)'} str={14} />
            {bekraeft ? 'Ja, sælg — spillet slutter' : 'Sælg firmaet'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <section className="flex items-start gap-3 rounded-lg border-2 border-line bg-bg2 p-3">
          <Monogram tekst={info.monogram} farve={info.farve} str={56} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
              {c && <Ikon navn={ARKETYPE[c.arketype].ikon} farve="var(--color-muted)" indre="var(--color-line)" str={12} />}
              {c ? ARKETYPE[c.arketype].navn : 'Køber'}
            </p>
            <h3 className="font-pixel text-base font-black leading-snug text-ink" data-testid="tilbud-overskrift">
              {info.navn} vil købe {g.firmaNavn}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {signal.competitorId === 'danskeLykke'
                ? 'Statsselskabet vil have udfordreren ind i folden. Pengene er gode, men jeres brand bliver en afdeling i det store hus.'
                : 'En stor spiller har set jeres vækst og vil hellere eje jer end kæmpe mod jer. Det er et kompliment med en check vedhæftet.'}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="tilbud-tal">
          <div className="rounded-md border-2 border-line bg-panel p-2.5">
            <div className="flex items-center gap-1 text-[0.68rem] uppercase tracking-wide text-muted">
              <Ikon navn="penge" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Pris for firmaet
            </div>
            <div className="tal font-pixel text-xl font-black text-gold" data-testid="tilbud-pris">
              {mio(pris)}
            </div>
            <div className="text-xs text-muted">
              {bsi > 0 ? `${fmtX(pris / bsi)} jeres årlige BSI` : 'I har endnu ingen BSI'}
            </div>
          </div>
          <div className="rounded-md border-2 border-line bg-panel p-2.5">
            <div className="flex items-center gap-1 text-[0.68rem] uppercase tracking-wide text-muted">
              <Ikon navn="folk" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Til stifterne
            </div>
            <div className="tal font-pixel text-xl font-black text-gold" data-testid="tilbud-stiftere">
              {mio(stiftere)}
            </div>
            <div className="text-xs text-muted">I ejer {pct(g.investorer.ejerandelStiftere)} af firmaet</div>
          </div>
          <div className="rounded-md border-2 border-line bg-panel p-2.5">
            <div className="flex items-center gap-1 text-[0.68rem] uppercase tracking-wide text-muted">
              <Ikon navn="diamant" farve="var(--color-sky)" indre="var(--color-line)" str={12} /> Jeres værdi i dag
            </div>
            <div className="tal font-pixel text-xl font-black text-ink">{mio(vaerdi)}</div>
            <div className="flex items-center gap-1 text-xs" style={{ color: pris >= vaerdi ? 'var(--color-good)' : 'var(--color-warn)' }}>
              <Ikon navn={pris >= vaerdi ? 'op' : 'ned'} farve="currentColor" str={10} />
              Buddet er {fmtX(pris / Math.max(0.1, vaerdi))} værdiansættelsen
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="tilbud-ja">
            <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-gold">
              <Ikon navn="penge" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Hvis I sælger
            </h4>
            <ul className="flex flex-col gap-1 text-sm text-ink">
              <li className="flex items-start gap-1.5">
                <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>
                  <b>Spillet slutter her</b> med slutningen «{slut.titel}».
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Ikon navn="folk" farve="var(--color-gold)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>Stifterne går derfra med {mio(stiftere)} i lommen.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <Ikon navn="trofae" farve="var(--color-sky)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>Eftermælet gøres op, og I kan starte et nyt spil eller New Game+.</span>
              </li>
            </ul>
          </div>
          <div className="rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="tilbud-nej">
            <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
              <Ikon navn="kryds" farve="var(--color-bad)" str={12} /> Hvis I siger nej
            </h4>
            <ul className="flex flex-col gap-1 text-sm text-ink">
              <li className="flex items-start gap-1.5">
                <Ikon navn="hype" farve="var(--color-bad)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>
                  {info.navn} tager det ilde: <b>aggressivitet +{R2.aggressivitet} i to år</b> — mere marketing og højere bud mod jer.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Ikon navn="raket" farve="var(--color-good)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>I fortsætter som udfordrer. Garagedrømmen lever.</span>
              </li>
            </ul>
          </div>
        </section>

        <p className="flex items-start gap-1.5 text-xs text-muted" data-testid="tilbud-udloeb">
          <Ikon navn="ur" farve="var(--color-muted)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={12} />
          Tilbuddet gælder til {datoTekst(t.udloeberUge)} ({tilbage} uge{tilbage === 1 ? '' : 'r'}). Siger I ingenting, er det et nej. I kan finde det igen under Rivaler.
        </p>
      </div>
    </Modal>
  );
}
