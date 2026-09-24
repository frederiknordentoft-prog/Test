// Fejring (signal 'top10' / 'nr1'): "Ind på Top 10!" / "Nr. 1 i Danmark!" med konfetti og fanfare.
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { MARKETS } from '../../data/markets';
import { Btn, Ikon, Modal } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { Konfetti } from '../components/ShellKonfetti';
import { spil } from '../../audio/sfx';

export default function MilestoneDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const firma = useGame((s) => s.game?.firmaNavn ?? 'jer');
  const produkt = useGame((s) =>
    signal.k === 'top10' || signal.k === 'nr1' ? s.game?.produkter.find((p) => p.id === signal.productId) : undefined,
  );
  const nr1 = signal.k === 'nr1';
  const marked = signal.k === 'top10' || signal.k === 'nr1' ? signal.marked : 'dk';
  const placering = signal.k === 'top10' ? signal.placering : 1;
  const markedNavn = MARKETS[marked]?.navn ?? 'Danmark';
  const i = marked === 'dk' ? 'i Danmark' : `i ${markedNavn}`;

  useEffect(() => {
    spil('fanfareSlut');
  }, []);

  const seListen = () => {
    useUi.getState().setPanel('hitliste');
    onLuk();
  };

  const titel = nr1 ? `Nr. 1 ${i}!` : 'Ind på Top 10!';
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
        <p className="max-w-sm text-sm text-muted">
          {nr1
            ? `${produkt?.navn ?? 'Produktet'} topper den ugentlige hitliste ${i}. Hele branchen taler om ${firma}.`
            : `${produkt?.navn ?? 'Produktet'} går ind som nr. ${placering} på den ugentlige Top 10 ${i}. Hitlisten opdateres hver uge — hold produktet friskt, så det bliver der.`}
        </p>
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
