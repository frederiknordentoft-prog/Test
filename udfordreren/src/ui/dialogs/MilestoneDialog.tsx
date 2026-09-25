// Fejring (signal 'top10' / 'nr1'): "Ind på Top 10!" / "Nr. 1 i Danmark!" med konfetti og fanfare.
// Når samme produkt rammer listen i flere markeder i samme uge, samles det i én fejring med en række pr. marked.
import { useEffect } from 'react';
import type { MarketId, Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { MARKETS } from '../../data/markets';
import { Btn, Ikon, Modal } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { PixelTekst } from '../components/ShellPixelFont';
import { Konfetti } from '../components/ShellKonfetti';
import { spil } from '../../audio/sfx';
import { listeTekst } from '../lib/dialogSamling';

type Plads = { marked: MarketId; placering: number; nr1: boolean };

function pladser(signal: Signal, gruppe?: Signal[]): Plads[] {
  const ud: Plads[] = [];
  for (const s of gruppe && gruppe.length > 0 ? gruppe : [signal]) {
    if (s.k === 'nr1') ud.push({ marked: s.marked, placering: 1, nr1: true });
    else if (s.k === 'top10') ud.push({ marked: s.marked, placering: s.placering, nr1: false });
  }
  return ud;
}

const iMarked = (m: MarketId) => `i ${MARKETS[m]?.navn ?? 'Danmark'}`;

export default function MilestoneDialog({ signal, gruppe, onLuk }: { signal: Signal; gruppe?: Signal[]; onLuk: () => void }) {
  const firma = useGame((s) => s.game?.firmaNavn ?? 'jer');
  const produkt = useGame((s) =>
    signal.k === 'top10' || signal.k === 'nr1' ? s.game?.produkter.find((p) => p.id === signal.productId) : undefined,
  );
  const alle = pladser(signal, gruppe);
  const hoved = alle[0] ?? { marked: 'dk' as MarketId, placering: 1, nr1: true };
  const nr1 = hoved.nr1;
  const placering = hoved.placering;
  const flere = alle.length > 1;
  const nr1Markeder = alle.filter((p) => p.nr1).map((p) => MARKETS[p.marked].navn);
  const topMarkeder = alle.filter((p) => !p.nr1);
  const navn = produkt?.navn ?? 'Produktet';

  useEffect(() => {
    spil('fanfareSlut');
  }, []);

  const seListen = () => {
    useUi.getState().setPanel('hitliste');
    onLuk();
  };

  const titel = nr1
    ? nr1Markeder.length > 1
      ? `Nr. 1 i ${nr1Markeder.length} markeder!`
      : `Nr. 1 ${iMarked(hoved.marked)}!`
    : flere
      ? `Top 10 i ${alle.length} markeder!`
      : 'Ind på Top 10!';

  let tekst: string;
  if (nr1) {
    tekst = `${navn} topper den ugentlige hitliste i ${listeTekst(nr1Markeder)}. Hele branchen taler om ${firma}.`;
    if (topMarkeder.length) tekst += ` Og så er det gået ind på Top 10 i ${listeTekst(topMarkeder.map((p) => `${MARKETS[p.marked].navn} (nr. ${p.placering})`))}.`;
  } else if (flere) {
    tekst = `${navn} går ind på den ugentlige Top 10 i ${listeTekst(alle.map((p) => `${MARKETS[p.marked].navn} (nr. ${p.placering})`))}. Hitlisterne opdateres hver uge — hold produktet friskt, så det bliver der.`;
  } else {
    tekst = `${navn} går ind som nr. ${placering} på den ugentlige Top 10 ${iMarked(hoved.marked)}. Hitlisten opdateres hver uge — hold produktet friskt, så det bliver der.`;
  }

  return (
    <Modal
      titel={titel}
      onLuk={onLuk}
      testId="dialog-milepael"
      bredde={480}
      fod={
        <>
          <Btn onClick={seListen} testId="milepael-hitliste">
            <Ikon navn="hitliste" /> Se hitlisten
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="milepael-ok">
            Fedt!
          </Btn>
        </>
      }
    >
      <Konfetti antal={nr1 ? 180 : 120} regn={nr1} />
      <div className="flex flex-col items-center gap-3 py-1 text-center" data-testid={nr1 ? 'milepael-nr1' : 'milepael-top10'}>
        <div className="relative flex items-center justify-center">
          <div className="shell-svaev flex items-center gap-3">
            <Ikon navn={nr1 ? 'krone' : 'hitliste'} farve="var(--color-gold)" indre="var(--color-line)" str={40} />
            <span className="flex items-end gap-1.5">
              <span className="pb-1 font-pixel text-xl font-black text-gold uppercase">Nr.</span>
              <PixelTekst tekst={String(placering)} dybde={1} className="h-16 w-auto" titel={`Nummer ${placering}`} />
            </span>
            <Ikon navn={nr1 ? 'krone' : 'stjerne'} farve="var(--color-gold)" indre="var(--color-line)" str={40} />
          </div>
        </div>
        <div>
          <p className="font-pixel text-lg font-black text-gold" data-testid="milepael-produkt">
            {produkt?.navn ?? 'Jeres produkt'}
          </p>
          {produkt && produkt.version > 1 && <p className="text-xs text-muted">Version {produkt.version}.0</p>}
        </div>
        <p className="max-w-sm text-sm text-muted">{tekst}</p>
        {flere && (
          <ul className="grid w-full max-w-sm grid-cols-2 gap-1 sm:grid-cols-3" data-testid="milepael-markeder" aria-label="Placeringer denne uge">
            {alle.map((p) => (
              <li
                key={p.marked}
                className={`flex min-w-0 items-center gap-1.5 rounded border-2 px-1.5 py-1 text-left ${p.nr1 ? 'border-gold bg-panel2' : 'border-line bg-bg2'}`}
                data-testid={`milepael-marked-${p.marked}`}
              >
                <FlagStribe farver={MARKETS[p.marked].farver} className="h-3 w-5 shrink-0" />
                <span className="font-pixel text-xs font-black text-ink">{MARKETS[p.marked].kort}</span>
                <span className="ml-auto flex shrink-0 items-center gap-0.5 font-pixel text-xs font-black" style={{ color: p.nr1 ? 'var(--color-gold)' : 'var(--color-ink)' }}>
                  <Ikon navn={p.nr1 ? 'krone' : 'hitliste'} farve={p.nr1 ? 'var(--color-gold)' : 'var(--color-muted)'} indre="var(--color-line)" str={11} />
                  {p.nr1 ? 'Nr. 1' : `Nr. ${p.placering}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {produkt && (
          <div className="flex flex-wrap justify-center gap-1.5 text-xs">
            <span className="rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-gold">{produkt.total40}/40</span>
            {produkt.guldkupon && <span className="rounded border-2 border-line bg-gold px-2 py-0.5 font-pixel font-bold text-line">Guldkupon</span>}
            {produkt.hallOfFame && <span className="rounded border-2 border-line bg-violet px-2 py-0.5 font-pixel font-bold text-line">Hall of Fame</span>}
          </div>
        )}
      </div>
    </Modal>
  );
}
