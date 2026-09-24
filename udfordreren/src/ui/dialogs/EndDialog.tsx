// Slutskærm (signal 'slut'): konkurs eller tiden er gået. Kort opsummering og "Nyt spil".
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Modal, type IkonNavn } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { heltal, mio } from '../format';
import { datoTekst } from '../../sim/time';
import { opsummering, varighedTekst } from '../lib/shellHjaelp';
import { spil } from '../../audio/sfx';

const SLUT: Record<string, { titel: string; pixel: string; tekst: string; farver: [string, string, string]; side: string }> = {
  konkurs: {
    titel: 'Konkurs',
    pixel: 'Konkurs',
    tekst: 'Kassen har været tom i otte uger, og banken har lukket for kreditten. Garagen står stille — men erfaringen tager I med jer.',
    farver: ['#ffb3b3', 'var(--color-bad)', '#b83a3a'],
    side: '#5e1a1a',
  },
  tiden: {
    titel: 'Tiden er gået',
    pixel: '2035',
    tekst: 'Det er december 2035, og AI-æraen har fundet sit leje. Her er, hvad I nåede fra garagen til i dag.',
    farver: ['#fff1a8', 'var(--color-gold)', '#f59f1a'],
    side: '#8c4a12',
  },
};

function Fakta({ ikon, farve, label, vaerdi, testId }: { ikon: IkonNavn; farve: string; label: string; vaerdi: string; testId?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border-2 border-line bg-bg2 px-2.5 py-2" data-testid={testId}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={20} className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="text-[0.65rem] uppercase tracking-wide text-muted">{label}</div>
        <div className="tal truncate font-pixel text-sm font-bold" style={{ color: farve }}>
          {vaerdi}
        </div>
      </div>
    </div>
  );
}

export default function EndDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const id = signal.k === 'slut' ? signal.id : 'tiden';
  const def = SLUT[id] ?? { titel: 'Spillet er slut', pixel: 'Slut', tekst: 'Et kapitel er slut. Her er jeres regnskab.', farver: SLUT.tiden.farver, side: SLUT.tiden.side };
  useEffect(() => {
    spil(id === 'konkurs' ? 'fejl' : 'fanfareSlut');
  }, [id]);
  if (!g) return null;
  const o = opsummering(g);

  const nytSpil = () => {
    useUi.getState().luk();
    useGame.getState().lukSpil();
  };

  return (
    <Modal
      titel={def.titel}
      testId="dialog-slut"
      lukbar={false}
      bredde={560}
      fod={
        <>
          <Btn onClick={onLuk} testId="se-firmaet">
            Se firmaet en sidste gang
          </Btn>
          <Btn variant="primaer" onClick={nytSpil} testId="nyt-spil">
            <Ikon navn="play" /> Nyt spil
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <PixelTekst tekst={def.pixel} dybde={1} farver={def.farver} side={def.side} className="h-auto w-[70%] max-w-[300px]" />
          <p className="font-pixel text-sm font-bold text-ink">
            {g.firmaNavn} · {datoTekst(g.uge)}
          </p>
          <p className="max-w-md text-sm text-muted">{def.tekst}</p>
        </div>
        <div className="grid grid-cols-2 gap-2" data-testid="slut-opsummering">
          <Fakta ikon="ur" farve="var(--color-sky)" label="I branchen" vaerdi={varighedTekst(o.aar, o.uger)} />
          <Fakta ikon="produkt" farve="var(--color-ink)" label="Lanceringer" vaerdi={heltal(o.lanceringer)} testId="slut-lanceringer" />
          <Fakta ikon="stjerne" farve="var(--color-gold)" label="Bedste anmeldelse" vaerdi={o.bedste40 > 0 ? `${o.bedste40}/40` : '–'} />
          <Fakta ikon="penge" farve="var(--color-gold)" label="Guldkuponer" vaerdi={`${o.guldkuponer}${o.hallOfFame ? ` (+${o.hallOfFame} HoF)` : ''}`} />
          <Fakta ikon="trofae" farve="var(--color-violet)" label="Gallapriser" vaerdi={heltal(o.gallapriser)} />
          <Fakta ikon="folk" farve="var(--color-sky)" label="Flest kunder" vaerdi={heltal(o.topKunder)} />
          <Fakta ikon="hitliste" farve="var(--color-pink)" label="Bedste placering DK" vaerdi={o.bedstePlaceringDk ? `nr. ${o.bedstePlaceringDk}` : '–'} />
          <Fakta
            ikon="firma"
            farve={id === 'konkurs' ? 'var(--color-bad)' : 'var(--color-good)'}
            label={id === 'konkurs' ? 'Slutkapital' : 'Selskabsværdi'}
            vaerdi={id === 'konkurs' ? mio(o.kapital) : mio(o.vaerdi)}
          />
        </div>
        {o.bedsteProdukt && (
          <p className="rounded-md border-2 border-line bg-panel2 px-3 py-2 text-sm text-muted">
            Jeres stolteste øjeblik: <span className="font-bold text-ink">{o.bedsteProdukt.navn}</span> fik {o.bedsteProdukt.total40}/40
            {o.bedsteProdukt.hallOfFame ? ' og kom i Hall of Fame.' : o.bedsteProdukt.guldkupon ? ' og en Guldkupon.' : '.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
