// Kombinationsbogen (spec 6.3): type × tema. "?" indtil kombinationen er prøvet, derefter vurderingen og bedste /40.
// Nedenunder: type- og temaniveauer 1-10 med xp og bonus (Game Dev Storys genreniveauer).
import { useState } from 'react';
import type { GameState, ProductTypeId, ThemeId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { komboInfo, temaStatus, typeStatus } from '../../sim/selectors';
import { PRODUCT_TYPES, PRODUCT_TYPE_IDS } from '../../data/productTypes';
import { THEMES, THEME_IDS } from '../../data/themes';
import { VERTICALS } from '../../data/verticals';
import { FIT_NAVN, type Fit } from '../../data/compatibility';
import { BALANCE } from '../../data/balance';
import { Ikon, Panel } from '../components/kit';
import { DevStil, FitMaerke } from '../components/DevDele';
import { FIT_STIL, niveauFremdrift } from '../lib/devHjaelp';

type Valgt = { typeId: ProductTypeId; themeId: ThemeId } | null;

function Celle({ g, typeId, themeId, valgt, onVaelg }: { g: GameState; typeId: ProductTypeId; themeId: ThemeId; valgt: boolean; onVaelg: () => void }) {
  const k = komboInfo(g, typeId, themeId);
  const laast = !typeStatus(g, typeId).ok || !temaStatus(g, themeId).ok;
  const navn = `${PRODUCT_TYPES[typeId].navn} × ${THEMES[themeId].navn}`;
  const label = k.set && k.fit ? `${navn}: ${k.fitNavn}, bedste ${k.bedste40}/40` : laast ? `${navn}: ikke tilgængelig endnu` : `${navn}: første forsøg`;
  const ring = valgt ? 'outline-2 outline-offset-[-2px] outline-ink z-[1]' : '';
  if (k.set && k.fit) {
    const st = FIT_STIL[k.fit];
    return (
      <button
        type="button"
        onClick={onVaelg}
        aria-label={label}
        title={label}
        data-testid={`kombi-${typeId}-${themeId}`}
        className={`relative flex h-[44px] w-[44px] flex-col items-center justify-center gap-px rounded-sm border-2 border-line ${ring}`}
        style={{ background: st.farve }}
      >
        <Ikon navn={st.ikon} farve="var(--color-line)" str={12} />
        <span className="tal font-pixel text-[0.62rem] font-black leading-none text-line">{k.bedste40}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onVaelg}
      aria-label={label}
      title={label}
      data-testid={`kombi-${typeId}-${themeId}`}
      className={`flex h-[44px] w-[44px] items-center justify-center rounded-sm border-2 border-line ${laast ? 'bg-bg' : 'bg-bg2 hover:bg-panel2'} ${ring}`}
    >
      {laast ? (
        <span className="h-1.5 w-1.5 rounded-full bg-dim/50" aria-hidden />
      ) : (
        <span className="font-pixel text-sm font-black text-dim" aria-hidden>
          ?
        </span>
      )}
    </button>
  );
}

function Detalje({ g, valgt }: { g: GameState; valgt: Valgt }) {
  if (!valgt) {
    return <p className="text-xs text-muted">Tryk på et felt for at se kombinationen. Vurderingen afsløres først, når I har lanceret den.</p>;
  }
  const { typeId, themeId } = valgt;
  const k = komboInfo(g, typeId, themeId);
  const ts = typeStatus(g, typeId);
  const th = temaStatus(g, themeId);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="kombi-detalje">
      <b className="font-pixel text-ink">
        {PRODUCT_TYPES[typeId].navn} × {THEMES[themeId].navn}
      </b>
      {k.set ? (
        <>
          <FitMaerke fit={k.fit} />
          <span className="tal text-xs text-muted">
            Bedste: <b className="font-pixel text-gold">{k.bedste40}/40</b>
          </span>
        </>
      ) : !ts.ok || !th.ok ? (
        <span className="flex items-center gap-1 text-xs text-muted">
          <Ikon navn="laas" farve="var(--color-dim)" str={12} /> {!ts.ok ? ts.grund : th.grund}
        </span>
      ) : (
        <>
          <FitMaerke fit={null} />
          <span className="text-xs text-muted">Hvem ved? Prøv den og se, hvad Spillerforum siger.</span>
        </>
      )}
    </div>
  );
}

function NiveauRaekke({ navn, xp, laast, farve, grund }: { navn: string; xp: number; laast: boolean; farve: string; grund?: string }) {
  const n = niveauFremdrift(xp);
  const bonus = Math.round(BALANCE.niveauBonus * (n.niveau - 1) * 100);
  return (
    <li className={`flex items-center gap-2 py-1 ${laast ? 'opacity-50' : ''}`} title={laast ? grund : undefined}>
      <span className="inline-block h-3 w-3 shrink-0 rounded-sm border-2 border-line" style={{ background: laast ? 'var(--color-dim)' : farve }} aria-hidden />
      <span className="w-[7.5rem] min-w-[3rem] shrink truncate text-xs text-ink">{navn}</span>
      <span
        className={`tal flex h-6 w-8 shrink-0 items-center justify-center rounded border-2 border-line font-pixel text-[0.68rem] font-black ${n.niveau > 1 ? 'bg-gold text-line' : 'bg-bg2 text-muted'}`}
        title={`Niveau ${n.niveau}`}
      >
        {n.niveau}
      </span>
      <span className="block h-2.5 min-w-[20px] flex-1 overflow-hidden rounded-sm border-2 border-line bg-bg" aria-hidden>
        <span className="block h-full bg-cyan" style={{ width: `${n.andel * 100}%` }} />
      </span>
      <span className="tal w-[4.5rem] min-w-0 shrink truncate text-right text-[0.68rem] text-muted">
        {laast ? <Ikon navn="laas" farve="var(--color-dim)" str={10} className="ml-auto" /> : n.tilNaeste === null ? 'Maks' : `${n.tilNaeste} til næste`}
      </span>
      <span className={`tal w-10 shrink-0 text-right text-[0.68rem] font-bold ${bonus > 0 ? 'text-good' : 'text-dim'}`} title="Pointbonus i nye projekter">
        +{bonus} %
      </span>
    </li>
  );
}

export default function ComboBookPanel() {
  const g = useGame((s) => s.game);
  const [valgt, setValgt] = useState<Valgt>(null);
  if (!g) return null;

  const proevede = Object.values(g.kombinationsbog).filter((k) => k.set);
  const bedst = Object.entries(g.kombinationsbog)
    .filter(([, k]) => k.set)
    .sort((a, b) => b[1].bedste40 - a[1].bedste40)[0];
  const bedstNavn = bedst
    ? (() => {
        const [t, th] = bedst[0].split(':') as [ProductTypeId, ThemeId];
        return `${PRODUCT_TYPES[t]?.navn ?? t} × ${THEMES[th]?.navn ?? th}`;
      })()
    : null;

  return (
    <Panel
      titel="Kombinationsbog"
      ikon="bog"
      testId="panel-kombinationer"
      hoejre={
        <span className="tal font-pixel text-xs font-bold text-muted" data-testid="kombi-antal">
          {proevede.length}/{PRODUCT_TYPE_IDS.length * THEME_IDS.length}
        </span>
      }
    >
      <DevStil />
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Prøvet: <b className="tal text-ink">{proevede.length}</b> kombinationer
        </span>
        {bedst && bedstNavn && (
          <span>
            Bedste: <b className="text-ink">{bedstNavn}</b> <b className="tal font-pixel text-gold">{bedst[1].bedste40}/40</b>
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-1" aria-label="Forklaring">
        <FitMaerke fit={null} lille />
        {([1, 2, 3, 4, 5] as Fit[]).map((f) => (
          <FitMaerke key={f} fit={f} lille />
        ))}
      </div>

      <div className="mb-2 min-h-[44px] rounded-md border-2 border-line bg-bg2 px-2 py-1.5">
        <Detalje g={g} valgt={valgt} />
      </div>

      <div className="dev-scroll relative max-w-full overflow-x-auto overscroll-x-contain rounded-md border-2 border-line bg-bg pb-1" data-testid="kombi-grid">
        <table className="border-separate border-spacing-[3px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-[2] bg-bg px-1 text-left align-bottom font-pixel text-[0.6rem] font-bold uppercase text-dim">Type \ Tema</th>
              {THEME_IDS.map((th) => {
                const ok = temaStatus(g, th).ok;
                return (
                  <th key={th} scope="col" className="w-[44px] align-bottom" title={ok ? THEMES[th].navn : `${THEMES[th].navn}: ${temaStatus(g, th).grund}`}>
                    <div className="mx-auto flex flex-col items-center gap-1 pb-0.5">
                      <span
                        className={`whitespace-nowrap text-[0.66rem] font-bold [writing-mode:vertical-rl] rotate-180 ${ok ? 'text-ink' : 'text-dim'}`}
                        style={{ maxHeight: 84 }}
                      >
                        {THEMES[th].navn}
                      </span>
                      <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line" style={{ background: ok ? THEMES[th].farve : 'var(--color-dim)' }} aria-hidden />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PRODUCT_TYPE_IDS.map((t) => {
              const ok = typeStatus(g, t).ok;
              const v = VERTICALS[PRODUCT_TYPES[t].vertikal];
              return (
                <tr key={t}>
                  <th scope="row" className="sticky left-0 z-[2] bg-bg pr-1 text-left">
                    <span className="flex w-24 items-center gap-1" title={ok ? PRODUCT_TYPES[t].navn : `${PRODUCT_TYPES[t].navn}: ${typeStatus(g, t).grund}`}>
                      <span className="h-6 w-1 shrink-0 rounded-sm" style={{ background: ok ? v.farve : 'var(--color-dim)' }} aria-hidden />
                      {!ok && <Ikon navn="laas" farve="var(--color-dim)" str={10} className="shrink-0" />}
                      <span className={`line-clamp-2 text-[0.68rem] font-bold leading-tight ${ok ? 'text-ink' : 'text-dim'}`}>{PRODUCT_TYPES[t].navn}</span>
                    </span>
                  </th>
                  {THEME_IDS.map((th) => (
                    <td key={th} className="p-0">
                      <Celle
                        g={g}
                        typeId={t}
                        themeId={th}
                        valgt={valgt?.typeId === t && valgt.themeId === th}
                        onVaelg={() => setValgt(valgt?.typeId === t && valgt.themeId === th ? null : { typeId: t, themeId: th })}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="mt-4" data-testid="niveauer">
        <h3 className="mb-1 flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider text-ink">
          <Ikon navn="op" farve="var(--color-good)" str={14} /> Niveauer
        </h3>
        <p className="mb-2 text-xs text-muted">
          +1 xp pr. lancering, +2 ved 28/40 eller mere. Hall of Fame giver et helt niveau. Hvert niveau over 1 giver +{Math.round(BALANCE.niveauBonus * 100)} % point og lidt
          bedre anmeldelser.
        </p>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
          <div className="min-w-0">
            <h4 className="mb-1 font-pixel text-[0.68rem] font-bold uppercase text-muted">Produkttyper</h4>
            <ul className="divide-y divide-line/40">
              {PRODUCT_TYPE_IDS.map((t) => {
                const st = typeStatus(g, t);
                return (
                  <NiveauRaekke
                    key={t}
                    navn={PRODUCT_TYPES[t].navn}
                    xp={g.niveauXp.type[t]}
                    laast={!st.ok && g.niveauXp.type[t] === 0}
                    grund={st.grund}
                    farve={VERTICALS[PRODUCT_TYPES[t].vertikal].farve}
                  />
                );
              })}
            </ul>
          </div>
          <div className="min-w-0">
            <h4 className="mb-1 font-pixel text-[0.68rem] font-bold uppercase text-muted">Temaer</h4>
            <ul className="divide-y divide-line/40">
              {THEME_IDS.map((th) => {
                const st = temaStatus(g, th);
                return (
                  <NiveauRaekke key={th} navn={THEMES[th].navn} xp={g.niveauXp.tema[th]} laast={!st.ok && g.niveauXp.tema[th] === 0} grund={st.grund} farve={THEMES[th].farve} />
                );
              })}
            </ul>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[0.7rem] text-dim">
          <Ikon navn="stjerne" farve="var(--color-gold)" str={10} /> Kombinationer: {FIT_NAVN[1]} → {FIT_NAVN[5]}. Et godt match løfter Spillerforum og tiltrækker flere kunder.
        </p>
      </section>
    </Panel>
  );
}
