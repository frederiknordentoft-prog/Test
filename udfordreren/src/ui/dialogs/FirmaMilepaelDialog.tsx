// Fejring af firmaets store skridt (signal 'runde' og 'kontor'): en investeringsrunde eller en flytning.
// Game Dev Story-øjeblikket: konfetti, fanfare og — ved flytning — det nye kontor i fuld størrelse.
import { useEffect, useRef } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { OFFICE_BY_ID } from '../../data/costs';
import { ROUNDS } from '../../data/funding';
import { KontorRenderer } from '../../render/office';
import { Btn, Ikon, Modal } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { Konfetti } from '../components/ShellKonfetti';
import { spil } from '../../audio/sfx';
import { mio } from '../format';
import { procent } from '../lib/firmaHjaelp';

/** Et ekstra, ikke-interaktivt vindue ind i kontoret (samme renderer som hovedskærmen) */
function KontorScene() {
  const boks = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!boks.current || !cv.current) return;
    const r = new KontorRenderer(cv.current, boks.current);
    r.start();
    return () => r.stop();
  }, []);
  return (
    <div ref={boks} className="pointer-events-none relative aspect-video w-full overflow-hidden rounded-md border-2 border-line bg-[#0d0f1c]" data-testid="milepael-kontor-scene">
      <canvas ref={cv} className="pixel absolute left-0 top-0" style={{ imageRendering: 'pixelated' }} aria-hidden />
    </div>
  );
}

export default function FirmaMilepaelDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const firma = useGame((s) => s.game?.firmaNavn ?? 'I');
  const ejerandel = useGame((s) => s.game?.investorer.ejerandelStiftere ?? 1);
  const kapital = useGame((s) => s.game?.kapital ?? 0);
  useEffect(() => {
    try {
      spil('fanfareSlut');
    } catch {
      /* lyd må aldrig vælte spillet */
    }
  }, []);

  if (signal.k === 'kontor') {
    const o = OFFICE_BY_ID[signal.tier];
    return (
      <Modal
        titel="Nyt kontor!"
        onLuk={onLuk}
        testId="dialog-milepael-kontor"
        bredde={620}
        fod={
          <Btn variant="primaer" onClick={onLuk} testId="milepael-ok" className="min-w-32">
            Flyt ind!
          </Btn>
        }
      >
        <Konfetti antal={150} />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <Ikon navn="hus" farve="var(--color-gold)" indre="var(--color-line)" str={36} />
            <PixelTekst tekst={o?.navn ?? 'Kontor'} dybde={1} className="h-12 w-auto max-w-[70vw]" titel={o?.navn ?? 'Kontor'} />
          </div>
          <KontorScene />
          <p className="max-w-md text-sm text-muted">
            {firma} rykker ind i {o?.navn.toLowerCase() ?? 'nye lokaler'}. Farvel til det gamle — goddag til nye skriveborde, mere kaffe og plads til flere.
          </p>
          <div className="flex flex-wrap justify-center gap-1.5 text-xs">
            <span className="flex items-center gap-1 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-sky">
              <Ikon navn="folk" farve="var(--color-sky)" str={12} /> {o?.pladser ?? '?'} pladser
            </span>
            <span className="flex items-center gap-1 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-gold">
              <Ikon navn="produkt" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> {o?.projekter ?? 1} projekt{(o?.projekter ?? 1) === 1 ? '' : 'er'} ad gangen
            </span>
            <span className="flex items-center gap-1 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-muted">
              <Ikon navn="penge" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Husleje {mio(o?.husleje ?? 0)}/uge
            </span>
          </div>
        </div>
      </Modal>
    );
  }

  const runde = signal.k === 'runde' ? ROUNDS.find((r) => r.id === signal.runde) : undefined;
  const beloeb = signal.k === 'runde' ? signal.kapital : 0;
  return (
    <Modal
      titel="Runden er lukket!"
      onLuk={onLuk}
      testId="dialog-milepael-runde"
      bredde={520}
      fod={
        <Btn variant="primaer" onClick={onLuk} testId="milepael-ok" className="min-w-32">
          Skål!
        </Btn>
      }
    >
      <Konfetti antal={170} regn />
      <div className="flex flex-col items-center gap-3 py-1 text-center">
        <p className="font-pixel text-sm font-black uppercase tracking-widest text-muted">{runde?.navn ?? 'Investering'}-runde</p>
        <div className="shell-svaev flex items-end gap-2">
          <span className="pb-1 font-pixel text-2xl font-black text-gold">+</span>
          <PixelTekst tekst={String(beloeb).replace('.', ',')} dybde={1} className="h-16 w-auto" titel={`${beloeb} mio. kr.`} />
          <span className="pb-2 font-pixel text-lg font-black text-gold">mio.</span>
        </div>
        <p className="max-w-sm text-sm text-muted">
          Investorerne tror på {firma}. Pengene står på kontoen — brug dem på folk, et større kontor og flere produkter.
        </p>
        <div className="flex flex-wrap justify-center gap-1.5 text-xs">
          <span className="flex items-center gap-1 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-gold">
            <Ikon navn="penge" farve="var(--color-gold)" indre="var(--color-line)" str={12} /> Kassen: {mio(kapital)}
          </span>
          <span className="flex items-center gap-1 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel font-bold text-muted">
            <Ikon navn="folk" farve="var(--color-sky)" str={12} /> I ejer nu {procent(ejerandel, 0)}
          </span>
        </div>
        <p className="text-xs text-dim">Investorerne forventer vækst: kvartalsmålene bliver lidt skarpere fra nu af.</p>
      </div>
    </Modal>
  );
}
