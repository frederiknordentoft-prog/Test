// Branchegallaen (signal 'galla'): kategorierne afsløres én ad gangen (straks ved reduceret bevægelse).
import { useEffect, useRef, useState } from 'react';
import type { GameState, Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Badge, Btn, Ikon, Modal, Monogram } from '../components/kit';
import { Chip } from '../components/FirmaDele';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { GALA_BELOENNING, GALA_CATEGORIES } from '../../data/galaCategories';
import { ejerInfo } from '../../sim/competitors';
import { konfetti } from '../../render/particles';
import { spil } from '../../audio/sfx';

function vinderInfo(g: GameState, navn: string, spiller: boolean) {
  if (spiller) return ejerInfo(g, 'spiller');
  const c = g.konkurrenter.find((x) => x.navn === navn);
  return c ? ejerInfo(g, c.id) : { navn, farve: '#6d7299', monogram: navn.slice(0, 2).toUpperCase() };
}

export default function GalaDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const aar = signal.k === 'galla' ? signal.aar : 0;
  const vundet = signal.k === 'galla' ? signal.vundet : [];
  const g = useGame((s) => s.game);
  const reduceret = useReduceretBevaegelse();
  const res = g?.galla.find((r) => r.aar === aar);
  const kategorier = res?.kategorier ?? GALA_CATEGORIES.map((c) => ({ id: c.id, vinder: '?', spillerNomineret: false }));
  const n = kategorier.length;
  const [vist, setVist] = useState(reduceret ? n : 0);
  const forrigeVist = useRef(vist);
  const alle = vist >= n;

  useEffect(() => {
    if (vist >= n) return;
    const t = setTimeout(() => setVist((v) => v + 1), vist === 0 ? 800 : 1400);
    return () => clearTimeout(t);
  }, [vist, n]);

  // Lyd og konfetti, når en kuvert åbnes
  useEffect(() => {
    const fra = forrigeVist.current;
    forrigeVist.current = vist;
    if (vist === 0 || reduceret || vist <= fra) return;
    // Hold den næste kuvert i syne (vigtigt på mobil)
    const maal = vist < n ? `[data-testid="galla-${kategorier[vist]?.id}"]` : '[data-testid="galla-opsummering"]';
    document.querySelector(maal)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    if (kategorier.slice(fra, vist).some((k) => vundet.includes(k.id))) {
      spil('fanfareSlut');
      konfetti({ antal: 130 });
    } else spil('fanfareTick', vist * 2);
    // kun ved ny afsløring
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vist]);

  useEffect(() => {
    if (reduceret && vundet.length > 0) spil('fanfareSlut');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!g) return null;
  const antal = vundet.length;

  return (
    <Modal
      titel={`Branchegallaen ${aar}`}
      onLuk={onLuk}
      lukbar={alle}
      bredde={600}
      testId="dialog-galla"
      fod={
        alle ? (
          <Btn variant="primaer" onClick={onLuk} testId="galla-ok">
            {antal > 0 ? 'Skål!' : 'Næste år!'}
          </Btn>
        ) : (
          <Btn onClick={() => setVist(n)} testId="galla-vis-alle">
            Åbn alle kuverter
          </Btn>
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-center gap-3 rounded-md border-2 border-line bg-bg2 px-3 py-2 text-center">
          <Ikon navn="trofae" farve="var(--color-gold)" indre="var(--color-line)" str={28} />
          <div>
            <p className="font-pixel text-sm font-black uppercase tracking-widest text-gold">Branchens store aften</p>
            <p className="text-xs text-muted">Smoking, champagne og fem kuverter. Vinderne afgøres af årets resultater.</p>
          </div>
          <Ikon navn="trofae" farve="var(--color-gold)" indre="var(--color-line)" str={28} />
        </div>

        <ol className="flex flex-col gap-1.5" data-testid="galla-kategorier">
          {kategorier.map((k, i) => {
            const def = GALA_CATEGORIES.find((c) => c.id === k.id);
            const afsloeret = i < vist;
            const naeste = i === vist;
            const spillerVandt = vundet.includes(k.id);
            const v = afsloeret ? vinderInfo(g, k.vinder, spillerVandt) : null;
            return (
              <li
                key={k.id}
                data-testid={`galla-${k.id}`}
                data-vundet={afsloeret && spillerVandt ? '1' : undefined}
                className={`flex flex-col gap-1.5 rounded-md border-2 p-2 @container ${
                  afsloeret && spillerVandt ? 'anim-pop border-gold bg-[color-mix(in_srgb,var(--color-gold)_16%,var(--color-bg2))] pixel-skygge' : 'border-line bg-bg2'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <span className="min-w-0">
                    <span className="block font-pixel text-sm font-black text-ink">{def?.navn ?? k.id}</span>
                    <span className="block text-xs text-dim">{def?.beskrivelse}</span>
                  </span>
                  {k.spillerNomineret ? (
                    <Chip ikon="stjerne" farve="var(--color-gold)">
                      Nomineret
                    </Chip>
                  ) : (
                    <Chip farve="var(--color-dim)">Ikke nomineret</Chip>
                  )}
                </div>
                <div className="flex min-h-9 items-center gap-2 rounded border-2 border-line bg-panel px-2 py-1">
                  {v ? (
                    <>
                      <Monogram tekst={v.monogram} farve={v.farve} str={26} />
                      <span className={`min-w-0 flex-1 truncate font-bold ${spillerVandt ? 'text-gold' : 'text-ink'}`}>{v.navn}</span>
                      {spillerVandt && (
                        <Badge farve="var(--color-gold)" tekstFarve="var(--color-line)">
                          <Ikon navn="trofae" farve="var(--color-line)" indre="var(--color-gold)" str={10} /> I vandt!
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className={`font-pixel text-sm ${naeste ? 'anim-blink text-gold' : 'text-dim'}`}>{naeste ? 'Og vinderen er …' : '? ? ?'}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {alle && (
          <div className="anim-glid rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="galla-opsummering">
            {antal > 0 ? (
              <>
                <p className="mb-1.5 font-pixel text-sm font-black text-gold">
                  {antal === 1 ? 'Et trofæ til hylden!' : `${antal} trofæer til hylden!`}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Chip ikon="hype" farve="var(--color-pink)">+{GALA_BELOENNING.hype * antal} hype</Chip>
                  <Chip ikon="indsigt" farve="var(--color-cyan)">+{GALA_BELOENNING.indsigt * antal} indsigt</Chip>
                  <Chip ikon="stjerne" farve="var(--color-good)">+{GALA_BELOENNING.omdoemme * antal} omdømme</Chip>
                  <Chip ikon="diamant" farve="var(--color-gold)">Investorinteresse +{Math.round(GALA_BELOENNING.vaerdiLoeft * antal * 100)} % værdi</Chip>
                </div>
                <p className="mt-1.5 text-xs text-muted">Trofæet står nu på hylden i kontoret.</p>
              </>
            ) : (
              <>
                <p className="mb-1 font-pixel text-sm font-black text-ink">Ingen priser i år</p>
                <p className="text-sm text-muted">
                  Men I var i rummet, og det er en start. Nomineringer kræver fx en lancering i årets løb, nye kombinationer og en høj tilsynstillid. Næste december er jeres.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
