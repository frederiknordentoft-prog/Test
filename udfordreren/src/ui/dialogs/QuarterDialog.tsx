// Kvartalsmøde (signal 'kvartal'): forrige kvartals mål med ✓/✗, nøgletal, stjerner, investorpres og nye mål.
import { useEffect } from 'react';
import type { FundingRound, Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Modal } from '../components/kit';
import { Chip, Pips } from '../components/FirmaDele';
import { RUNDE_NAVN, PRES_EVENT_TAERSKEL } from '../../data/funding';
import { spil } from '../../audio/sfx';
import { mio, heltal } from '../format';
import { MAAL_IKON, evaluerForrigeMaal, forrigeKvartal } from '../lib/firmaHjaelp';

function Delta({ nu, foer, format, god = true }: { nu: number; foer: number | undefined; format: (v: number) => string; god?: boolean }) {
  if (foer === undefined || Math.abs(nu - foer) < 1e-9) return null;
  const op = nu > foer;
  const godt = op === god;
  return (
    <span className="inline-flex items-center gap-0.5 font-pixel text-[0.66rem] font-bold" style={{ color: godt ? 'var(--color-good)' : 'var(--color-bad)' }}>
      <Ikon navn={op ? 'op' : 'ned'} farve="currentColor" str={9} />
      {format(Math.abs(nu - foer))}
    </span>
  );
}

export default function QuarterDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const kv = signal.k === 'kvartal' ? signal : null;
  const opfyldt = kv?.opfyldt ?? 0;
  const ialt = kv?.ialt ?? 0;
  const alle = ialt > 0 && opfyldt === ialt;

  useEffect(() => {
    spil(alle ? 'fanfareSlut' : 'fanfareTick', 4);
  }, [alle]);

  if (!g || !kv) return null;
  const minde = forrigeKvartal(g);
  const h = g.historik[g.historik.length - 1];
  const hFoer = g.historik[g.historik.length - 2];
  const harInvestorer = g.investorer.runde !== 'ingen';
  const presFoer = minde?.pres;
  const presNu = g.investorer.pres;
  const presFarve = presNu >= PRES_EVENT_TAERSKEL ? 'var(--color-bad)' : presNu >= 2 ? 'var(--color-warn)' : 'var(--color-good)';
  const fmtPres = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

  const tilFirma = () => {
    useUi.getState().setPanel('firma');
    onLuk();
  };

  return (
    <Modal
      titel={`Kvartalsmøde Q${kv.kvartal} ${kv.aar}`}
      onLuk={onLuk}
      bredde={560}
      testId="dialog-kvartal"
      fod={
        <>
          <Btn onClick={tilFirma} testId="kvartal-firma">
            <Ikon navn="firma" farve="currentColor" str={14} /> Se Firma
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="kvartal-ok">
            Til arbejdet!
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Resultatet */}
        <div className="flex items-center gap-3 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid="kvartal-resultat">
          <div className="flex shrink-0 flex-col items-center">
            <span className="tal font-pixel text-3xl leading-none font-black" style={{ color: alle ? 'var(--color-gold)' : opfyldt > 0 ? 'var(--color-ink)' : 'var(--color-muted)' }}>
              {opfyldt}/{ialt}
            </span>
            <span className="text-[0.62rem] uppercase text-muted">mål nået</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-0.5" aria-label={`${opfyldt} stjerner optjent`}>
              {Array.from({ length: Math.max(ialt, 1) }, (_, i) => (
                <Ikon key={i} navn={i < opfyldt ? 'stjerne' : 'stjerneTom'} farve={i < opfyldt ? 'var(--color-gold)' : 'var(--color-dim)'} str={20} className={i < opfyldt ? 'anim-pop' : ''} />
              ))}
            </div>
            <p className="text-sm text-muted">
              {alle
                ? 'Bestyrelsen smiler. Alle mål i hus!'
                : opfyldt > 0
                  ? `+${opfyldt} stjerne${opfyldt === 1 ? '' : 'r'} til samlingen. Der er plads til forbedring.`
                  : 'Et stille kvartal. Næste gang sidder de.'}{' '}
              <span className="text-gold">I alt {g.investorer.stjerner} stjerner.</span>
            </p>
          </div>
        </div>

        {/* Forrige kvartals mål */}
        {minde && minde.maal.length > 0 && (
          <section>
            <h3 className="mb-1 font-pixel text-xs font-black uppercase text-muted">Kvartalets mål</h3>
            <ul className="flex flex-col gap-1" data-testid="kvartal-gamle-maal">
              {minde.maal.map((m) => {
                const ok = evaluerForrigeMaal(g, m, h);
                return (
                  <li key={m.id} className="flex min-h-10 items-center gap-2 rounded border-2 border-line bg-bg2 px-2 py-1">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line"
                      style={{ background: ok ? 'var(--color-good)' : ok === false ? 'var(--color-bad)' : 'var(--color-panel2)' }}
                    >
                      <Ikon navn={ok ? 'flueben' : ok === false ? 'kryds' : 'spoergsmaal'} farve="var(--color-line)" str={14} titel={ok ? 'Nået' : ok === false ? 'Ikke nået' : 'Ukendt'} />
                    </span>
                    <span className={`min-w-0 flex-1 text-sm ${ok ? 'text-ink' : 'text-muted'}`}>{m.tekst}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Nøgletal */}
        {h && (
          <section className="grid grid-cols-2 gap-1.5 @container sm:grid-cols-4" data-testid="kvartal-noegletal">
            <div className="rounded border-2 border-line bg-bg2 px-2 py-1">
              <div className="text-[0.62rem] uppercase text-muted">BSI</div>
              <div className="tal font-pixel text-sm font-black text-gold">{mio(h.bsi)}</div>
              <Delta nu={h.bsi} foer={hFoer?.bsi} format={mio} />
            </div>
            <div className="rounded border-2 border-line bg-bg2 px-2 py-1">
              <div className="text-[0.62rem] uppercase text-muted">Resultat</div>
              <div className="tal font-pixel text-sm font-black" style={{ color: h.resultat >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                {h.resultat >= 0 ? '+' : '−'}
                {mio(Math.abs(h.resultat))}
              </div>
              <Delta nu={h.resultat} foer={hFoer?.resultat} format={mio} />
            </div>
            <div className="rounded border-2 border-line bg-bg2 px-2 py-1">
              <div className="text-[0.62rem] uppercase text-muted">Kunder</div>
              <div className="tal font-pixel text-sm font-black text-sky">{heltal(h.kunder)}</div>
              <Delta nu={h.kunder} foer={hFoer?.kunder} format={heltal} />
            </div>
            <div className="rounded border-2 border-line bg-bg2 px-2 py-1">
              <div className="text-[0.62rem] uppercase text-muted">Lanceringer</div>
              <div className="tal font-pixel text-sm font-black text-ink">{h.lanceringer}</div>
              {h.bedsteTotal40 > 0 && <span className="text-[0.66rem] text-muted">bedste {h.bedsteTotal40}/40</span>}
            </div>
          </section>
        )}

        {/* Investorer */}
        {harInvestorer ? (
          <section className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-line bg-bg2 px-2.5 py-2" data-testid="kvartal-pres">
            <span className="text-sm">
              <span className="text-muted">Investorpres ({RUNDE_NAVN[g.investorer.runde as FundingRound] ?? g.investorer.runde})</span>
              {presFoer !== undefined && Math.abs(presFoer - presNu) > 1e-9 && (
                <span className="ml-1.5 font-pixel text-xs font-bold" style={{ color: presNu > presFoer ? 'var(--color-bad)' : 'var(--color-good)' }}>
                  {presNu > presFoer ? '+' : '−'}
                  {fmtPres(Math.abs(presNu - presFoer))}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <Pips vaerdi={presNu} farve={presFarve} label="Investorpres" />
              <span className="tal font-pixel text-xs font-bold" style={{ color: presFarve }}>
                {fmtPres(presNu)}/5
              </span>
            </span>
            {presNu >= PRES_EVENT_TAERSKEL && <p className="w-full text-xs text-bad">Bestyrelsen vil have en plan. Hold øje med næste møde.</p>}
          </section>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-dim">
            <Ikon navn="diamant" farve="var(--color-dim)" str={12} /> Ingen investorer endnu — stjernerne løfter værdien, når I henter en runde.
          </p>
        )}

        {/* Nye mål */}
        <section>
          <h3 className="mb-1 font-pixel text-xs font-black uppercase text-gold">Nye mål for kvartalet</h3>
          <ul className="flex flex-col gap-1" data-testid="kvartal-nye-maal">
            {g.kvartalsmaal.map((m) => (
              <li key={m.id} className="flex min-h-10 items-center gap-2 rounded border-2 border-line bg-panel2 px-2 py-1">
                <Ikon navn={MAAL_IKON[m.kind]} farve="var(--color-gold)" indre="var(--color-line)" str={16} className="shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-bold">{m.tekst}</span>
                <Chip ikon="stjerne" farve="var(--color-gold)">
                  +1
                </Chip>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
