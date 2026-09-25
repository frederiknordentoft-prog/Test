// Sponsorauktion (signal 'sponsorAuktion', R7): et stort sponsorat er ledigt. Skyder for buddet pr. år (fra
// mindstebuddet), pris i alt over varigheden og hvad CAC-rabatten giver. "Byd" → bydSponsorat, "Byd ikke" lukker.
import { useState } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Modal, Monogram, Skyder } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { MARKETS } from '../../data/markets';
import { datoTekst, ejerInfo } from '../../sim/selectors';
import { mio } from '../format';
import { SPONSOR_RABAT, SPONSOR_RABAT_OEVRIGE, sponsorBydere, sponsorMaxBud, ugerTilbage } from '../lib/konkurrentHjaelp';

const rund = (v: number) => Math.round(v * 10) / 10;
const aarTekst = (uger: number) => {
  const a = Math.round((uger / 52) * 10) / 10;
  return `${String(a).replace('.', ',')} år`;
};

export default function SponsorDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const a = g?.sponsorAuktion ?? null;
  const start = a ? rund(Math.max(a.mindstebud, a.spillerBud ?? a.mindstebud * 1.2)) : 0;
  const [bud, setBud] = useState(start);
  if (!g || signal.k !== 'sponsorAuktion') return null;

  if (!a) {
    return (
      <Modal
        titel="Sponsorauktion"
        onLuk={onLuk}
        testId="dialog-sponsorAuktion"
        bredde={520}
        fod={
          <Btn variant="primaer" onClick={onLuk} testId="sponsor-ok" className="w-full sm:w-auto">
            OK
          </Btn>
        }
      >
        <p className="text-sm text-muted">Auktionen om {signal.navn} er allerede afgjort. Se resultatet under Rivaler.</p>
      </Modal>
    );
  }

  const def = MARKETS[a.marked];
  const aar = a.varighedUger / 52;
  const maxKasse = Math.floor(sponsorMaxBud(g, a) * 10) / 10;
  const kanByde = maxKasse >= a.mindstebud;
  const skyderMax = Math.max(a.mindstebud, Math.min(rund(a.mindstebud * 3), maxKasse));
  const vaerdi = Math.min(skyderMax, Math.max(a.mindstebud, bud));
  const bydere = sponsorBydere(g, a);
  const licens = g.markeder[a.marked].licens === 'aktiv';
  const tilbage = ugerTilbage(g, a.afgoeresUge);

  const byd = () => {
    if (useGame.getState().dispatch({ t: 'bydSponsorat', bud: vaerdi })) {
      useGame.getState().toast(`Bud afgivet: ${mio(vaerdi)} om året på ${a.navn}.`, 'godt');
      onLuk();
    }
  };

  return (
    <Modal
      titel="Sponsorauktion"
      onLuk={onLuk}
      testId="dialog-sponsorAuktion"
      bredde={620}
      fod={
        <>
          <Btn onClick={onLuk} testId="sponsor-byd-ikke">
            Byd ikke
          </Btn>
          <Btn variant="primaer" onClick={byd} disabled={!kanByde} title={kanByde ? undefined : 'Kassen er for tynd til mindstebuddet.'} testId="sponsor-byd">
            <Ikon navn="hammer" farve="currentColor" str={14} /> {a.spillerBud !== null ? 'Hæv buddet' : 'Byd'} {mio(vaerdi)}/år
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2">
          <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
          <div className="flex items-start gap-3 p-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border-2 border-line bg-good pixel-skygge">
              <Ikon navn="bold" farve="var(--color-line)" indre="var(--color-ink)" str={30} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-pixel text-[0.7rem] font-black uppercase tracking-wider text-muted">
                {def.navn} · {aarTekst(a.varighedUger)}
              </p>
              <h3 className="font-pixel text-base font-black leading-snug text-ink" data-testid="sponsor-navn">
                {a.navn} søger en ny spilsponsor
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                Jeres logo på trøjerne, i tv-pauserne og på hver eneste stadionhøjttaler. Højeste bud vinder {datoTekst(a.afgoeresUge)} (om {tilbage} uge
                {tilbage === 1 ? '' : 'r'}).
              </p>
            </div>
          </div>
        </section>

        {kanByde ? (
          <Skyder
            min={a.mindstebud}
            max={skyderMax}
            trin={0.1}
            vaerdi={vaerdi}
            onSkift={(v) => setBud(rund(v))}
            label={`Jeres bud pr. år (mindst ${mio(a.mindstebud)})`}
            vis={(v) => <span className="text-gold">{mio(v)}</span>}
            testId="sponsor-skyder"
          />
        ) : (
          <p className="flex items-start gap-1.5 rounded-md border-2 border-line bg-bg2 px-2.5 py-2 text-sm text-warn" data-testid="sponsor-for-dyrt">
            <Ikon navn="laas" farve="var(--color-warn)" className="mt-0.5 shrink-0" str={14} />
            Kassen er for tynd: I kan højst byde {mio(Math.max(0, maxKasse))} om året, og mindstebuddet er {mio(a.mindstebud)}.
          </p>
        )}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="sponsor-pris">
          {[
            { navn: 'Pr. år', v: mio(vaerdi), ikon: 'penge', farve: 'var(--color-gold)' },
            { navn: 'Pr. uge', v: mio(vaerdi / 52), ikon: 'kalender', farve: 'var(--color-gold)' },
            { navn: 'Varighed', v: aarTekst(a.varighedUger), ikon: 'ur', farve: 'var(--color-ink)' },
            { navn: 'I alt', v: mio(vaerdi * aar), ikon: 'penge', farve: 'var(--color-gold)' },
          ].map((f) => (
            <div key={f.navn} className="rounded-md border-2 border-line bg-panel px-2 py-1.5">
              <div className="flex items-center gap-1 text-[0.66rem] uppercase tracking-wide text-muted">
                <Ikon navn={f.ikon} farve={f.farve} indre="var(--color-line)" str={11} /> {f.navn}
              </div>
              <div className="tal font-pixel text-sm font-black" style={{ color: f.farve }}>
                {f.v}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-md border-2 border-line bg-bg2 p-2.5">
          <h4 className="mb-1.5 flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wider text-ink">
            <Ikon navn="stjerne" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Det får I, hvis I vinder
          </h4>
          <ul className="flex flex-col gap-1 text-sm text-ink" data-testid="sponsor-rabat">
            <li className="flex items-start gap-1.5">
              <Ikon navn="folk" farve="var(--color-sky)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
              <span>
                <b className="text-good">{Math.round(SPONSOR_RABAT * 100)} % billigere kunder</b> (CAC) via sponsorat og tv i {def.navn} — og{' '}
                {Math.round(SPONSOR_RABAT_OEVRIGE * 100)} % via de andre kanaler — i {aarTekst(a.varighedUger)}.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <Ikon navn="penge" farve="var(--color-gold)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
              <span>Prisen trækkes løbende som marketing: {mio(vaerdi / 52)} om ugen, så længe aftalen kører.</span>
            </li>
            {!licens && (
              <li className="flex items-start gap-1.5 text-warn">
                <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" str={14} />
                <span>I har ingen aktiv licens i {def.navn} endnu. Rabatten virker først, når I har kunder dér.</span>
              </li>
            )}
          </ul>
        </section>

        <section className="flex flex-wrap items-center gap-2 text-sm text-muted" data-testid="sponsor-bydere">
          <span className="flex items-center gap-1.5">
            <Ikon navn="svaerd" farve="var(--color-warn)" str={14} /> Medbydere:
          </span>
          {bydere.length === 0 ? (
            <span>ingen lige nu</span>
          ) : (
            bydere.slice(0, 6).map((c) => {
              const i = ejerInfo(g, c.id);
              return (
                <span key={c.id} className="inline-flex items-center gap-1" title={c.navn}>
                  <Monogram tekst={i.monogram} farve={i.farve} str={24} />
                  <span className="text-xs text-ink">{c.navn}</span>
                </span>
              );
            })
          )}
          <span className="basis-full text-xs">App-first-firmaerne byder typisk højest — ofte godt over mindstebuddet.</span>
        </section>

        {a.spillerBud !== null && (
          <p className="flex items-center gap-1.5 text-sm text-ink" data-testid="sponsor-jeres-bud">
            <Ikon navn="flueben" farve="var(--color-good)" str={14} /> Jeres nuværende bud: <b className="text-gold">{mio(a.spillerBud)}/år</b>
          </p>
        )}
      </div>
    </Modal>
  );
}
