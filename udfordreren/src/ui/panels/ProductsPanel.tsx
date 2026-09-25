// Produkter: spillerens aktive produkter med score, BSI, friskhed, margin og handlinger. Lukkede produkter nederst.
import { useState } from 'react';
import type { GameState, LiveProduct } from '../../sim/types';
import { MARKETS } from '../../data/markets';
import { datoTekst } from '../../sim/time';
import { FlagStribe } from '../components/FirmaDele';
import { LICENS_STIL, bedstePlaceringer, licensTekst, produktMarkeder, ramteMarkeder } from '../lib/tvaersHjaelp';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Badge, Btn, Ikon, Panel, Tom } from '../components/kit';
import { Afsnit, Chip, Maengde } from '../components/FirmaDele';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { friskhed } from '../../sim/customers';
import { heltal, mio, mioKort } from '../format';
import { alderTekst, bsiUge, procent } from '../lib/firmaHjaelp';

const INTENSITET = { 1: 'Rolig', 2: 'Afdæmpet', 3: 'Normal', 4: 'Intens', 5: 'Maks' } as const;
const KAMPAGNER = [0.1, 0.25, 0.5, 1] as const;

function friskFarve(f: number): string {
  return f >= 0.6 ? 'var(--color-good)' : f >= 0.3 ? 'var(--color-warn)' : 'var(--color-bad)';
}

/** Samme formel som launchCampaign i sim-kernen */
function kampagneHype(hype: number, budget: number): number {
  return 25 * (1 - Math.exp(-budget / 0.4)) * (1 - hype / 120);
}

function ProduktKort({ p, g, total }: { p: LiveProduct; g: GameState; total: number }) {
  const [aaben, setAaben] = useState<'kampagne' | 'luk' | null>(null);
  const aabn = useUi((s) => s.aabn);
  const bsi = bsiUge(p);
  const andel = total > 0 ? bsi / total : 0;
  const alder = Math.max(0, g.uge - p.lanceretUge);
  const frisk = friskhed(p, g.uge);
  const t = PRODUCT_TYPES[p.typeId];
  const tidlig2 = alder < 52;
  const toggle = (a: 'kampagne' | 'luk') => setAaben((x) => (x === a ? null : a));
  const { bedst } = bedstePlaceringer(g, p);
  const pm = produktMarkeder(g, p);

  return (
    <article className="@container flex flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid={`produkt-${p.id}`}>
      <div className="flex items-start gap-2.5">
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md border-2 border-line"
          style={{ background: p.hallOfFame ? 'var(--color-violet)' : p.guldkupon ? 'var(--color-gold)' : 'var(--color-panel2)' }}
          title="Samlet anmeldelse"
        >
          <span className={`tal font-pixel text-xl leading-none font-black ${p.guldkupon || p.hallOfFame ? 'text-line' : 'text-gold'}`}>{p.total40}</span>
          <span className={`font-pixel text-[0.6rem] font-bold ${p.guldkupon || p.hallOfFame ? 'text-line/70' : 'text-muted'}`}>/40</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-pixel text-sm font-black text-ink">{p.navn}</span>
            {p.version > 1 && (
              <Badge farve="var(--color-sky)" tekstFarve="var(--color-line)">
                {p.version}.0
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted">
            {t.navn} × {THEMES[p.themeId].navn}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {p.guldkupon && (
              <Chip ikon="trofae" farve="var(--color-gold)" fyld>
                Guldkupon
              </Chip>
            )}
            {p.hallOfFame && (
              <Chip ikon="krone" farve="var(--color-violet)" fyld>
                Hall of Fame
              </Chip>
            )}
            {bedst && (
              <Chip ikon="hitliste" farve="var(--color-pink)" titel={`${p.ugerITop10} uger i Top 10 · bedst nr. ${bedst.placering} i ${MARKETS[bedst.m].navn}`}>
                Bedst nr. {bedst.placering}
                {p.markeder.length > 1 || bedst.m !== 'dk' ? ` (${MARKETS[bedst.m].kort})` : ''}
              </Chip>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="tal font-pixel text-base font-black text-gold">{mioKort(bsi)}</div>
          <div className="text-[0.62rem] uppercase text-dim">BSI/uge</div>
          <div className="tal font-pixel text-xs text-muted" title="Andel af jeres samlede BSI">
            {procent(andel, 0)} af jer
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 @md:grid-cols-2">
        <div title={`Friskhed: produkter bliver gamle. Halveringstid for ${t.navn.toLowerCase()} er ca. ${alderTekst(t.halveringstidUger)}.`}>
          <div className="mb-0.5 flex justify-between text-xs text-muted">
            <span>Alder {alderTekst(alder)}</span>
            <span style={{ color: friskFarve(frisk) }}>Friskhed {procent(frisk, 0)}</span>
          </div>
          <span className="block h-2.5 overflow-hidden rounded-sm border border-line bg-bg">
            <span className="block h-full" style={{ width: `${frisk * 100}%`, background: friskFarve(frisk) }} />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <Chip farve="var(--color-gold)" titel={`Margin (interval ${procent(t.marginMin)}-${procent(t.marginMax)})`}>
            Margin {procent(p.margin)}
          </Chip>
          <Chip farve={p.intensitet > 3 ? 'var(--color-warn)' : 'var(--color-muted)'} ikon={p.intensitet > 3 ? 'advarsel' : undefined} titel="Intensitet over 3 koster tilsynstillid">
            {INTENSITET[p.intensitet]} ({p.intensitet})
          </Chip>
          {p.fejl > 0 && (
            <Chip ikon="bille" farve="var(--color-bad)">
              {p.fejl} fejl
            </Chip>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1 @sm:grid-cols-2 @xl:grid-cols-3" data-testid={`produkt-markeder-${p.id}`}>
        {pm.map((x) => {
          const ramt = x.lic.tilstand === 'suspenderet' || x.lic.tilstand === 'inddraget';
          return (
            <li
              key={x.m}
              className={`flex min-h-9 min-w-0 items-center gap-2 rounded border-2 px-1.5 py-1 text-xs ${ramt ? 'border-bad bg-bad/10' : 'border-line bg-panel'}`}
              data-testid={`produkt-marked-${p.id}-${x.m}`}
              title={`${MARKETS[x.m].navn}: ${mio(x.bsi)} BSI og ${heltal(x.nye)} nye spillere denne uge`}
            >
              <FlagStribe farver={MARKETS[x.m].farver} className="h-3 w-5 shrink-0" />
              <b className="w-6 shrink-0 font-pixel text-ink">{MARKETS[x.m].kort}</b>
              {ramt ? (
                <span className="flex min-w-0 items-center gap-1 font-bold leading-tight text-bad">
                  <Ikon navn={LICENS_STIL[x.lic.tilstand].ikon} farve="var(--color-bad)" str={10} className="shrink-0" />
                  <span className="min-w-0">{licensTekst(x.lic)}</span>
                </span>
              ) : (
                <>
                  <span className="tal font-pixel font-bold text-gold">{mioKort(x.bsi)}</span>
                  <span className="tal flex items-center gap-0.5 text-sky">
                    <Ikon navn="folk" farve="var(--color-sky)" str={10} />
                    {heltal(x.nye)}
                    <span className="text-[0.62rem] text-dim">nye</span>
                  </span>
                  {x.placering !== null && (
                    <span className="tal ml-auto flex items-center gap-0.5 font-pixel font-black text-pink" title={`Nr. ${x.placering} på Top 10 i ${MARKETS[x.m].navn}`}>
                      <Ikon navn="hitliste" farve="var(--color-pink)" str={10} />
                      {x.placering}
                    </span>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-1.5 @md:grid-cols-4">
        <Btn onClick={() => aabn({ kind: 'produkt', productId: p.id })} testId={`produkt-detaljer-${p.id}`}>
          <Ikon navn="spoergsmaal" farve="currentColor" str={14} /> Detaljer
        </Btn>
        <Btn
          onClick={() => aabn({ kind: 'nytProdukt', efterfoelgerAf: p.id })}
          testId={`efterfoelger-${p.id}`}
          title={tidlig2 ? `Før 52 uger giver en 2.0-version −30 % start-parametre (${52 - alder} uger endnu)` : '2.0-version: +20 % start-parametre'}
        >
          <Ikon navn="plus" farve="currentColor" str={14} /> {p.version + 1}.0
          {tidlig2 && <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} />}
        </Btn>
        <Btn variant={aaben === 'kampagne' ? 'primaer' : 'sekundaer'} onClick={() => toggle('kampagne')} testId={`kampagne-${p.id}`}>
          <Ikon navn="hoejttaler" farve="currentColor" str={14} /> Kampagne
        </Btn>
        <Btn variant={aaben === 'luk' ? 'fare' : 'ghost'} onClick={() => toggle('luk')} testId={`luk-produkt-${p.id}`}>
          <Ikon navn="papirkurv" farve="currentColor" indre="transparent" str={14} /> Luk
        </Btn>
      </div>

      {aaben === 'kampagne' && (
        <div className="anim-glid rounded-md border-2 border-line bg-panel p-2" data-testid={`kampagne-valg-${p.id}`}>
          <p className="mb-1.5 text-xs text-muted">En kampagne giver hype og nye kunder til {p.navn}. Jo mere hype I har, jo mindre flytter den.</p>
          <div className="grid grid-cols-2 gap-1.5 @md:grid-cols-4">
            {KAMPAGNER.map((b) => {
              const raad = g.kapital >= b;
              return (
                <Btn
                  key={b}
                  variant="primaer"
                  disabled={!raad}
                  title={raad ? undefined : 'Ikke råd'}
                  testId={`kampagne-${p.id}-${Math.round(b * 1000)}`}
                  className="flex-col gap-0 py-1"
                  onClick={() => {
                    if (useGame.getState().dispatch({ t: 'launchCampaign', productId: p.id, budget: b })) {
                      useGame.getState().toast(`Kampagnen for ${p.navn} kører!`, 'godt');
                      setAaben(null);
                    }
                  }}
                >
                  <span>{mio(b)}</span>
                  <span className="text-[0.68rem] font-bold">+{Math.round(kampagneHype(g.hype, b))} hype</span>
                </Btn>
              );
            })}
          </div>
        </div>
      )}

      {aaben === 'luk' && (
        <div className="anim-glid flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2 @md:flex-row @md:items-center">
          <p className="min-w-0 flex-1 text-sm">Luk {p.navn}? Kunderne flytter til jeres andre produkter — eller til konkurrenterne.</p>
          <div className="flex gap-1.5">
            <Btn onClick={() => setAaben(null)}>Fortryd</Btn>
            <Btn
              variant="fare"
              testId={`luk-produkt-bekraeft-${p.id}`}
              onClick={() => {
                if (useGame.getState().dispatch({ t: 'retireProduct', productId: p.id })) setAaben(null);
              }}
            >
              Luk produktet
            </Btn>
          </div>
        </div>
      )}
    </article>
  );
}

export default function ProductsPanel() {
  const g = useGame((s) => s.game)!;
  const aabn = useUi((s) => s.aabn);
  const [visLukkede, setVisLukkede] = useState(false);
  const egne = g.produkter.filter((p) => p.ejer === 'spiller');
  const aktive = egne.filter((p) => p.aktiv).sort((a, b) => bsiUge(b) - bsiUge(a));
  const lukkede = egne.filter((p) => !p.aktiv).sort((a, b) => (b.pensioneretUge ?? 0) - (a.pensioneretUge ?? 0));
  const total = aktive.reduce((a, p) => a + bsiUge(p), 0);
  const ramte = ramteMarkeder(g);

  return (
    <Panel
      titel="Produkter"
      ikon="stjerne"
      testId="panel-produkter"
      hoejre={
        <Maengde ikon="penge" farve="var(--color-gold)" className="text-xs" titel="Samlet BSI pr. uge">
          {mioKort(total)}/uge
        </Maengde>
      }
    >
      <div className="flex flex-col gap-2">
        {ramte.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border-2 border-bad bg-bad/10 p-2 text-sm" data-testid="produkter-licensvarsel">
            {ramte.map((r) => (
              <p key={r.m} className="flex items-start gap-1.5">
                <Ikon navn={r.tilstand === 'inddraget' ? 'kryds' : 'pause'} farve="var(--color-bad)" str={14} className="mt-0.5 shrink-0" />
                <span>
                  <b className="text-bad">{MARKETS[r.m].navn}:</b>{' '}
                  {r.tilstand === 'inddraget'
                    ? 'licensen er inddraget. Produkterne er trukket ud af markedet.'
                    : `licensen er suspenderet til ${datoTekst(r.tilUge ?? g.uge)}. Ingen BSI derfra imens, og kunderne siver.`}
                </span>
              </p>
            ))}
          </div>
        )}
        {aktive.length === 0 ? (
          <Tom>
            <p className="mb-2">Ingen produkter i luften endnu. Start et projekt, byg det i fire faser, og lancér.</p>
            <Btn variant="primaer" onClick={() => aabn({ kind: 'nytProdukt' })} testId="produkter-nyt">
              <Ikon navn="plus" farve="currentColor" str={14} /> Nyt produkt
            </Btn>
          </Tom>
        ) : (
          aktive.map((p) => <ProduktKort key={p.id} p={p} g={g} total={total} />)
        )}

        {lukkede.length > 0 && (
          <Afsnit
            titel={`Lukkede produkter (${lukkede.length})`}
            ikon="papirkurv"
            farve="var(--color-dim)"
            testId="lukkede-produkter"
            hoejre={
              <Btn variant="ghost" lille onClick={() => setVisLukkede((v) => !v)} testId="vis-lukkede" ariaLabel={visLukkede ? 'Skjul lukkede' : 'Vis lukkede'} className="min-h-[44px]">
                <Ikon navn={visLukkede ? 'op' : 'ned'} farve="currentColor" str={12} /> {visLukkede ? 'Skjul' : 'Vis'}
              </Btn>
            }
          >
            {visLukkede ? (
              <ul className="flex flex-col gap-1">
                {lukkede.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded border-2 border-line bg-panel px-2 py-1.5 text-sm">
                    <span className="tal w-9 shrink-0 font-pixel font-black text-muted">{p.total40}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {p.navn}
                        {p.version > 1 ? ` ${p.version}.0` : ''}
                      </span>
                      <span className="block truncate text-xs text-dim">
                        {PRODUCT_TYPES[p.typeId].navn} × {THEMES[p.themeId].navn} · levede {alderTekst((p.pensioneretUge ?? g.uge) - p.lanceretUge)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tal block font-pixel text-xs font-bold text-gold">{mioKort(p.samletBsi)}</span>
                      <span className="block text-[0.6rem] uppercase text-dim">BSI i alt</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Samlet BSI fra lukkede produkter: {mio(lukkede.reduce((a, p) => a + p.samletBsi, 0))}.</p>
            )}
          </Afsnit>
        )}
      </div>
    </Panel>
  );
}
