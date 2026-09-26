// Messer (signal 'messeVarsel' og 'messe'): book en stand i tre størrelser, og se udbyttet bagefter.
import { useEffect } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Modal, Tom } from '../components/kit';
import { Chip, Maengde } from '../components/FirmaDele';
import { EXPO_BY_ID, STAND_NAVN } from '../../data/expos';
import { bookingAabent } from '../../sim/expos';
import { aarFor, ugeIAar } from '../../sim/time';
import { konfetti } from '../../render/particles';
import { spil } from '../../audio/sfx';
import { mio } from '../format';
import { procent, uger } from '../lib/firmaHjaelp';
import { pladser } from '../../sim/staff';

const KORT_NAVN = ['', 'lille', 'mellem', 'stor'] as const;

function Varsel({ expoId, onLuk }: { expoId: string; onLuk: () => void }) {
  const e = EXPO_BY_ID[expoId];
  const g = useGame((s) => s.game);
  if (!e || !g) return <Tom>Messen findes ikke.</Tom>;
  const aar = aarFor(g.uge);
  const booking = g.messeBookinger.find((b) => b.expoId === expoId && b.aar === aar);
  const aaben = bookingAabent(g, expoId);
  const til = Math.max(0, e.ugeIAar - ugeIAar(g.uge));
  const fuldt = g.staff.length >= pladser(g);

  const book = (st: 1 | 2 | 3) => {
    const store = useGame.getState();
    if (store.dispatch({ t: 'bookExpoStand', expoId, stoerrelse: st })) {
      store.toast(`${STAND_NAVN[st]} booket på ${e.navn}!`, 'godt');
      spil('kasse');
      onLuk();
    }
  };

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border-2 border-line bg-sky">
          <Ikon navn="kalender" farve="var(--color-line)" indre="var(--color-sky)" str={28} />
        </span>
        <div className="min-w-0">
          <p className="font-pixel text-base font-black text-ink">
            {e.navn} i {e.by}
          </p>
          <p className="text-sm text-muted">{til > 0 ? `Døren åbner om ${uger(til)}.` : 'Messen åbner i denne uge.'} En stand giver hype, indsigt, nye ansigter og måske en B2B-kunde.</p>
        </div>
      </div>
      {booking ? (
        <p className="flex items-center gap-2 rounded-md border-2 border-line bg-bg2 p-2 text-sm" data-testid="messe-booket">
          <Ikon navn="flueben" farve="var(--color-good)" str={16} /> I har booket en {STAND_NAVN[booking.stoerrelse].toLowerCase()}. Vi ses på gulvet!
        </p>
      ) : !aaben ? (
        <p className="rounded-md border-2 border-line bg-bg2 p-2 text-sm text-muted">Stande kan bookes fra {e.varselUger} uger før messen.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 @md:grid-cols-3" data-testid="messe-stande">
          {([1, 2, 3] as const).map((st, _i, alle) => {
            // Guld til den største stand, I har råd til — aldrig til en deaktiveret knap
            const stoersteMulige = Math.max(0, ...alle.filter((x) => g.kapital >= e.standPris[x - 1]));
            const i = st - 1;
            const pris = e.standPris[i];
            const raad = g.kapital >= pris;
            return (
              <div key={st} className={`flex flex-col gap-1.5 rounded-md border-2 border-line p-2 ${st === 3 ? 'bg-panel2' : 'bg-bg2'}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-pixel text-sm font-black uppercase">{STAND_NAVN[st]}</span>
                  <span className="flex" aria-hidden>
                    {Array.from({ length: st }, (_, k) => (
                      <Ikon key={k} navn="stjerne" farve="var(--color-gold)" str={11} />
                    ))}
                  </span>
                </div>
                <Maengde ikon="penge" farve="var(--color-gold)" className="text-base">{mio(pris)}</Maengde>
                <div className="flex flex-wrap gap-1">
                  <Chip ikon="hype" farve="var(--color-pink)">+{e.hype[i]} hype</Chip>
                  <Chip ikon="indsigt" farve="var(--color-cyan)">+{e.indsigt[i]} indsigt</Chip>
                  <Chip ikon="folk" farve="var(--color-sky)" titel={fuldt ? 'Kontoret er fuldt — kandidaterne kræver en ledig plads' : undefined}>
                    {e.kandidater[i]} kandidat{e.kandidater[i] === 1 ? '' : 'er'}
                  </Chip>
                  {fuldt && (
                    <Chip ikon="advarsel" farve="var(--color-warn)" titel="Kandidaterne kræver en ledig plads på kontoret">
                      Kontoret er fuldt
                    </Chip>
                  )}
                  <Chip ikon="kontrakt" farve="var(--color-good)" titel="Chance for en B2B-opgave">
                    {procent(e.b2bChance[i], 0)} B2B
                  </Chip>
                  <Chip ikon="stjerne" farve="var(--color-muted)">+{e.omdoemme[i]} omdømme</Chip>
                </div>
                <Btn variant={st === stoersteMulige ? 'primaer' : 'sekundaer'} className="mt-auto" disabled={!raad} title={raad ? undefined : `Ikke råd (${mio(pris)})`} testId={`book-stand-${st}`} onClick={() => book(st)}>
                  Book {KORT_NAVN[st]}
                </Btn>
                {!raad && (
                  <p className="flex items-start gap-1 text-xs font-bold text-warn" data-testid={`book-stand-${st}-grund`}>
                    <Ikon navn="laas" farve="var(--color-warn)" str={11} className="mt-0.5 shrink-0" /> Ikke råd: kassen har {mio(g.kapital)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Resultat({ signal, onLuk }: { signal: Extract<Signal, { k: 'messe' }>; onLuk: () => void }) {
  const e = EXPO_BY_ID[signal.expoId];
  const fuldt = useGame((s) => (s.game ? s.game.staff.length >= pladser(s.game) : false));
  useEffect(() => {
    spil('fanfareSlut');
    if (signal.b2b || signal.stoerrelse === 3) konfetti({ antal: 90 });
  }, [signal.b2b, signal.stoerrelse]);
  const gaaTil = (panel: 'personale' | 'kontrakter') => {
    useUi.getState().setPanel(panel);
    onLuk();
  };
  return (
    <div className="flex flex-col gap-3" data-testid="messe-resultat">
      <p className="text-sm text-muted">
        {e?.navn ?? 'Messen'} er slut. Jeres {STAND_NAVN[signal.stoerrelse].toLowerCase()} fik folk til at stoppe op.
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md border-2 border-line bg-bg2 p-2">
          <Ikon navn="hype" farve="var(--color-pink)" indre="var(--color-line)" str={22} className="mx-auto" />
          <div className="tal font-pixel text-lg font-black text-pink">+{signal.hype}</div>
          <div className="text-[0.66rem] uppercase text-muted">Hype</div>
        </div>
        <div className="rounded-md border-2 border-line bg-bg2 p-2">
          <Ikon navn="indsigt" farve="var(--color-cyan)" indre="var(--color-line)" str={22} className="mx-auto" />
          <div className="tal font-pixel text-lg font-black text-cyan">+{signal.indsigt}</div>
          <div className="text-[0.66rem] uppercase text-muted">Indsigt</div>
        </div>
        <div className="rounded-md border-2 border-line bg-bg2 p-2">
          <Ikon navn="folk" farve="var(--color-sky)" str={22} className="mx-auto" />
          <div className="tal font-pixel text-lg font-black text-sky">{signal.kandidater}</div>
          <div className="text-[0.66rem] uppercase text-muted">Kandidater</div>
        </div>
      </div>
      {signal.kandidater > 0 && (
        <div className="flex flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2 text-sm @container">
          <p className="flex items-start gap-2">
            <Ikon navn="folk" farve="var(--color-sky)" className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {signal.kandidater} {signal.kandidater === 1 ? 'person' : 'personer'} vil gerne arbejde for jer.{' '}
              {fuldt ? (
                <b className="text-warn" data-testid="messe-fuldt">Men kontoret er fuldt — flyt, eller gør plads, før I kan ansætte.</b>
              ) : (
                'De venter under Personale.'
              )}
            </span>
          </p>
          <Btn onClick={() => gaaTil('personale')} testId="messe-se-kandidater">
            Se kandidaterne
          </Btn>
        </div>
      )}
      {signal.b2b ? (
        <div className="flex flex-col gap-2 rounded-md border-2 border-gold bg-bg2 p-2 text-sm" data-testid="messe-b2b">
          <p className="flex items-start gap-2">
            <Ikon navn="kontrakt" farve="var(--color-gold)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
            <span>
              <b className="text-gold">En B2B-kunde bed på!</b> Der ligger en velbetalt opgave og venter under Opgaver.
            </span>
          </p>
          <Btn variant="primaer" onClick={() => gaaTil('kontrakter')} testId="messe-se-opgave">
            Se opgaven
          </Btn>
        </div>
      ) : (
        <p className="text-xs text-dim">Ingen B2B-kunder denne gang. En større stand giver bedre chancer.</p>
      )}
    </div>
  );
}

export default function ExpoDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const expoId = signal.k === 'messeVarsel' || signal.k === 'messe' ? signal.expoId : '';
  const e = EXPO_BY_ID[expoId];
  const resultat = signal.k === 'messe' ? signal : null;
  const navn = e?.navn ?? 'Messen';
  return (
    <Modal
      titel={resultat ? `${navn}: udbyttet` : navn}
      onLuk={onLuk}
      bredde={resultat ? 480 : 720}
      testId="dialog-messe"
      fod={
        resultat ? (
          <Btn variant="primaer" onClick={onLuk} testId="messe-ok">
            Fedt!
          </Btn>
        ) : (
          <Btn onClick={onLuk} testId="messe-spring-over">
            Spring over
          </Btn>
        )
      }
    >
      {resultat ? <Resultat signal={resultat} onLuk={onLuk} /> : <Varsel expoId={expoId} onLuk={onLuk} />}
    </Modal>
  );
}
