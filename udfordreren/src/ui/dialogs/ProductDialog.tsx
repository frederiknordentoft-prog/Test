// Produktdetaljer: anmeldelser, total og mærker, alder og friskhed, BSI, hitliste og features.
// Egne produkter kan justeres (margin/intensitet), få en kampagne, en 2.0-version eller lukkes. Konkurrenters er skrivebeskyttede.
import { useState } from 'react';
import type { GameState, LiveProduct, Project } from '../../sim/types';
import type { UiDialog } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { datoTekst, ejerInfo, friskhed, komboInfo, maxProjekter } from '../../sim/selectors';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { MARKETS } from '../../data/markets';
import { REVIEWERS } from '../../data/reviewers';
import { fitFor } from '../../data/compatibility';
import { BALANCE } from '../../data/balance';
import { Btn, Ikon, Modal, Monogram, Tom } from '../components/kit';
import { Afsnit, BekraeftKnap, DevStil, FitMaerke, MarkeretSkyder, Segment } from '../components/DevDele';
import { INTENSITET_NAVN, efterfoelgerInfo, featureNavn, kampagneHype, levetidTekst, pctKort, scoreFarve, ugerTekst, visCitat, visVersion } from '../lib/devHjaelp';
import { heltal, mio, mioKort } from '../format';
import { FlagStribe } from '../components/FirmaDele';
import { LICENS_STIL, bedstePlaceringer, licensTekst, produktMarkeder } from '../lib/tvaersHjaelp';

type Intensitet = Project['intensitet'];
const KAMPAGNER = [0.1, 0.3, 1] as const;

function Noegletal({ label, vaerdi, farve, ikon, under }: { label: string; vaerdi: string; farve: string; ikon: string; under?: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-md border-2 border-line bg-bg2 p-2">
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[0.66rem] uppercase tracking-wide text-muted">{label}</div>
        <div className="tal truncate font-pixel text-sm font-bold" style={{ color: farve }}>
          {vaerdi}
        </div>
        {under && <div className="truncate text-[0.66rem] text-dim">{under}</div>}
      </div>
    </div>
  );
}

function Anmeldelser({ p }: { p: LiveProduct }) {
  const g = useGame((s) => s.game);
  return (
    <div className="flex flex-col gap-1.5" data-testid="produkt-anmeldelser">
      {REVIEWERS.map((r) => {
        const a = p.anmeldelser.find((x) => x.anmelder === r.id);
        if (!a) return null;
        return (
          <div key={r.id} className="flex items-center gap-2 rounded-md border-2 border-line bg-bg2 p-1.5">
            <span
              className="tal flex h-9 w-9 shrink-0 items-center justify-center rounded border-2 border-line bg-panel font-pixel text-base font-black"
              style={{ color: scoreFarve(a.score) }}
            >
              {a.score}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[0.66rem] font-black uppercase tracking-wider" style={{ color: r.farve }}>
                {r.navn}
              </div>
              <div className="text-xs italic leading-snug text-ink">»{g && p.ejer === 'spiller' ? visCitat(g, p, a) : a.citat}«</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hoved({ g, p }: { g: GameState; p: LiveProduct }) {
  const ejer = ejerInfo(g, p.ejer);
  const fit = p.ejer === 'spiller' ? komboInfo(g, p.typeId, p.themeId).fit : fitFor(p.typeId, p.themeId);
  const alder = Math.max(0, g.uge - p.lanceretUge);
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Monogram tekst={ejer.monogram} farve={ejer.farve} str={44} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{p.ejer === 'spiller' ? 'Jeres produkt' : ejer.navn}</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <b className="text-ink">{PRODUCT_TYPES[p.typeId].navn}</b>
          <span aria-hidden>×</span>
          <b className="text-ink">{THEMES[p.themeId].navn}</b>
          {p.ejer === 'spiller' && <FitMaerke fit={fit} lille />}
        </p>
        <p className="tal text-xs text-dim">
          Lanceret {p.lanceretUge >= 0 ? datoTekst(p.lanceretUge) : 'før 2012'} · {ugerTekst(alder)} siden · {p.markeder.map((m) => MARKETS[m].kort).join(', ')}
          {!p.aktiv && p.pensioneretUge !== undefined && <> · lukket {datoTekst(p.pensioneretUge)}</>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="tal font-pixel text-2xl font-black text-gold" data-testid="produkt-total">
          {p.total40}
          <span className="text-sm text-muted">/40</span>
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          {p.hallOfFame && (
            <span className="inline-flex items-center gap-1 rounded border-2 border-line bg-violet px-1.5 font-pixel text-[0.62rem] font-bold uppercase text-line">
              <Ikon navn="krone" farve="var(--color-line)" str={10} /> Hall of Fame
            </span>
          )}
          {p.guldkupon && (
            <span className="inline-flex items-center gap-1 rounded border-2 border-line bg-gold px-1.5 font-pixel text-[0.62rem] font-bold uppercase text-line">
              <Ikon navn="trofae" farve="var(--color-line)" str={10} /> Guldkupon
            </span>
          )}
          {!p.aktiv && (
            <span className="inline-flex items-center gap-1 rounded border-2 border-line bg-bg2 px-1.5 font-pixel text-[0.62rem] font-bold uppercase text-muted">Lukket</span>
          )}
        </span>
      </div>
    </div>
  );
}

function Justering({ p }: { p: LiveProduct }) {
  const type = PRODUCT_TYPES[p.typeId];
  const [margin, setMargin] = useState(p.margin);
  const [intensitet, setIntensitet] = useState<Intensitet>(p.intensitet);
  const aendret = Math.abs(margin - p.margin) > 1e-9 || intensitet !== p.intensitet;
  const gem = () => {
    const a: { t: 'adjustProduct'; productId: string; margin?: number; intensitet?: Intensitet } = { t: 'adjustProduct', productId: p.id };
    if (Math.abs(margin - p.margin) > 1e-9) a.margin = margin;
    if (intensitet !== p.intensitet) a.intensitet = intensitet;
    if (useGame.getState().dispatch(a)) useGame.getState().toast(`${p.navn} er justeret`, 'godt');
  };
  return (
    <div className="flex flex-col gap-3">
      <MarkeretSkyder
        label="Margin"
        min={type.marginMin}
        max={type.marginMax}
        trin={0.001}
        vaerdi={margin}
        onSkift={(x) => setMargin(Math.round(x * 1000) / 1000)}
        vis={pctKort(margin)}
        markoer={type.marginStd}
        markoerTekst={`Std. ${pctKort(type.marginStd)}`}
        minTekst={pctKort(type.marginMin)}
        maxTekst={pctKort(type.marginMax)}
        testId="produkt-margin"
      />
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">Intensitet</span>
          <span className="font-pixel font-bold text-ink">{INTENSITET_NAVN[intensitet]}</span>
        </div>
        <Segment<Intensitet>
          label="Intensitet"
          valg={([1, 2, 3, 4, 5] as const).map((i) => ({ id: i, navn: i, titel: INTENSITET_NAVN[i] }))}
          vaerdi={intensitet}
          onSkift={setIntensitet}
          testIdPrefix="produkt-intensitet"
        />
      </div>
      <p className="text-[0.7rem] text-dim">Højere margin og intensitet giver mere BSI pr. kunde, men flere kunder smutter, og Tilsynet holder øje.</p>
      <div className="flex justify-end">
        <Btn variant="primaer" disabled={!aendret} onClick={gem} testId="produkt-gem">
          <Ikon navn="flueben" /> Gem ændringer
        </Btn>
      </div>
    </div>
  );
}

function Kampagne({ g, p }: { g: GameState; p: LiveProduct }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {KAMPAGNER.map((b) => {
          const hype = kampagneHype(g.hype, b);
          const raad = g.kapital >= b;
          return (
            <Btn
              key={b}
              disabled={!raad}
              title={raad ? `Kampagne for ${mio(b)}` : `Ikke råd — kassen har ${mio(g.kapital)}`}
              onClick={() => {
                if (useGame.getState().dispatch({ t: 'launchCampaign', productId: p.id, budget: b })) {
                  useGame.getState().toast(`Kampagnen for ${p.navn} kører: +${Math.round(hype)} hype`, 'godt');
                }
              }}
              testId={`kampagne-${b}`}
              className="min-h-14 flex-col gap-0 px-1"
            >
              <span className="tal whitespace-nowrap font-pixel text-sm text-gold">{b < 1 ? `${Math.round(b * 1000)} t. kr.` : `${b} mio. kr.`}</span>
              <span className="tal flex items-center gap-1 text-[0.68rem] font-bold text-pink">
                <Ikon navn="hype" farve="var(--color-pink)" indre="var(--color-line)" str={10} />+{Math.round(hype)} hype
              </span>
            </Btn>
          );
        })}
      </div>
      <p className="mt-1.5 text-[0.7rem] text-dim">
        Hype giver flere nye kunder, og produktet får et skub med det samme. Hype nu: <b className="tal text-pink">{heltal(g.hype)}</b>
      </p>
    </div>
  );
}

function Livscyklus({ g, p, onLuk }: { g: GameState; p: LiveProduct; onLuk: () => void }) {
  const info = efterfoelgerInfo(g, p);
  const igang = g.projekter.some((x) => x.efterfoelgerAf === p.id);
  const fyldt = g.projekter.length >= maxProjekter(g);
  const grund = igang ? 'En ny version er allerede i gang.' : fyldt ? 'Kontoret har ikke plads til flere projekter lige nu.' : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Btn
          variant="sekundaer"
          disabled={!!grund}
          title={grund}
          onClick={() => {
            onLuk();
            useUi.getState().aabn({ kind: 'nytProdukt', efterfoelgerAf: p.id });
          }}
          testId="lav-2-0"
          className="flex-1 sm:flex-none"
        >
          <Ikon navn="op" /> Lav {p.version + 1}.0-version
        </Btn>
        <span className="min-w-0 flex-1 text-xs text-muted">
          {grund ?? (
            <>
              +20 % forspring.{' '}
              {info.tidlig ? (
                <span className="text-warn">Lanceres den før {datoTekst(p.lanceretUge + 52)}, trækker anmelderne 30 % fra.</span>
              ) : (
                <span className="text-good">Ingen straf for tidlig relancering.</span>
              )}
            </>
          )}
        </span>
      </div>
      {p.aktiv && (
        <BekraeftKnap
          tekst="Luk produktet"
          spoergsmaal={`Luk ${p.navn}? Kunderne flytter til jeres andre produkter — eller til konkurrenterne.`}
          ja="Luk det"
          onJa={() => useGame.getState().dispatch({ t: 'retireProduct', productId: p.id })}
          testId="luk-produkt"
          className="self-start"
        />
      )}
    </div>
  );
}

/** Pr. marked: BSI, nye spillere, placering nu og bedst — og licensflag (suspenderet/inddraget) */
function Markeder({ g, p }: { g: GameState; p: LiveProduct }) {
  const rows = produktMarkeder(g, p);
  if (rows.length === 0) return <p className="text-xs text-muted">Produktet er ikke i nogen markeder lige nu.</p>;
  return (
    <div className="overflow-hidden rounded-md border-2 border-line" data-testid="produkt-markeder">
      <div className="grid grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] gap-x-2 border-b-2 border-line bg-panel2 px-2 py-1 font-pixel text-[0.6rem] font-bold uppercase tracking-wide text-muted">
        <span>Marked</span>
        <span className="text-right">BSI/uge</span>
        <span className="text-right">Nye/uge</span>
        <span className="text-right">Top 10</span>
      </div>
      <ul>
        {rows.map((x) => {
          const ramt = x.lic.tilstand === 'suspenderet' || x.lic.tilstand === 'inddraget';
          return (
            <li
              key={x.m}
              className={`grid min-h-10 grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr] items-center gap-x-2 border-t border-line px-2 py-1 text-xs first:border-t-0 ${ramt ? 'bg-bad/10' : 'bg-bg2'}`}
              data-testid={`produkt-marked-${x.m}`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="flex min-w-0 items-center gap-1.5 font-bold text-ink">
                  <FlagStribe farver={MARKETS[x.m].farver} className="h-3 w-5 shrink-0" />
                  <span className="truncate">{MARKETS[x.m].navn}</span>
                </span>
                {ramt && (
                  <span className="flex items-center gap-1 text-[0.66rem] font-bold text-bad">
                    <Ikon navn={LICENS_STIL[x.lic.tilstand].ikon} farve="var(--color-bad)" str={9} /> {licensTekst(x.lic)}
                  </span>
                )}
              </span>
              <span className="tal text-right font-pixel font-bold text-gold">{p.aktiv ? mioKort(x.bsi) : '–'}</span>
              <span className="tal text-right text-sky">{p.aktiv ? heltal(x.nye) : '–'}</span>
              <span className="tal text-right">
                {x.placering !== null ? <b className="font-pixel text-pink">Nr. {x.placering}</b> : <span className="text-dim">–</span>}
                {x.bedst !== undefined && <span className="block text-[0.6rem] text-dim">bedst {x.bedst}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ProductDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const productId = dialog.kind === 'produkt' ? dialog.productId : '';
  const g = useGame((s) => s.game);
  const p = g?.produkter.find((x) => x.id === productId);
  if (!g || !p) {
    return (
      <Modal titel="Produkt" onLuk={onLuk} testId="dialog-produkt" bredde={480} fod={<Btn onClick={onLuk}>Luk</Btn>}>
        <Tom>Produktet findes ikke.</Tom>
      </Modal>
    );
  }
  const egen = p.ejer === 'spiller';
  const fr = friskhed(p, g.uge, egen ? 1 : BALANCE.konkurrentHalveringGange);
  const bsi = Object.values(p.bsiPrUge).reduce((a: number, b) => a + (b ?? 0), 0);
  const { nu, bedst } = bedstePlaceringer(g, p);
  const flere = p.markeder.length > 1;
  const mk = (m: keyof typeof MARKETS) => (flere || m !== 'dk' ? ` (${MARKETS[m].kort})` : '');
  const type = PRODUCT_TYPES[p.typeId];

  return (
    <Modal
      titel={
        <span className="flex items-center gap-2">
          <span className="truncate">{p.navn}</span>
          {visVersion(p.navn, p.version) && <span className="shrink-0 rounded border-2 border-line bg-violet px-1 text-xs text-line">{p.version}.0</span>}
        </span>
      }
      onLuk={onLuk}
      testId="dialog-produkt"
      bredde={760}
      fod={
        <Btn variant="primaer" onClick={onLuk} testId="produkt-luk">
          OK
        </Btn>
      }
    >
      <DevStil />
      <Hoved g={g} p={p} />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="produkt-noegletal">
        <Noegletal
          label={flere ? `BSI/uge · ${p.markeder.length} markeder` : `BSI/uge i ${MARKETS[p.markeder[0] ?? 'dk'].kort}`}
          vaerdi={p.aktiv ? mio(bsi) : '–'}
          farve="var(--color-gold)"
          ikon="penge"
          under={egen ? `I alt ${mio(p.samletBsi)}` : undefined}
        />
        <Noegletal
          label="Top 10"
          vaerdi={nu ? `Nr. ${nu.placering}${mk(nu.m)}` : bedst ? `Bedst nr. ${bedst.placering}${mk(bedst.m)}` : 'Ikke endnu'}
          farve="var(--color-sky)"
          ikon="hitliste"
          under={p.ugerITop10 > 0 ? `${ugerTekst(p.ugerITop10)} på listen${nu && bedst ? ` · bedst nr. ${bedst.placering}` : ''}` : undefined}
        />
        <div className="flex min-w-0 items-start gap-2 rounded-md border-2 border-line bg-bg2 p-2" title={`Halveringstid ${levetidTekst(type.halveringstidUger)}`}>
          <Ikon navn="ur" farve="var(--color-good)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[0.66rem] uppercase tracking-wide text-muted">Friskhed</div>
            <div className="tal font-pixel text-sm font-bold text-good">{pctKort(fr, 0)}</div>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-sm border border-line bg-bg">
              <span className="block h-full" style={{ width: `${fr * 100}%`, background: fr > 0.5 ? 'var(--color-good)' : fr > 0.25 ? 'var(--color-warn)' : 'var(--color-bad)' }} />
            </span>
          </div>
        </div>
        {egen ? (
          <Noegletal
            label="Fejl ved lancering"
            vaerdi={String(p.fejl)}
            farve={p.fejl > 0 ? 'var(--color-bad)' : 'var(--color-good)'}
            ikon="bille"
            under={`Margin ${pctKort(p.margin)} · int. ${p.intensitet}`}
          />
        ) : (
          <Noegletal label="Margin" vaerdi={pctKort(p.margin)} farve="var(--color-ink)" ikon="penge" under={`Intensitet ${p.intensitet}`} />
        )}
      </div>

      <Afsnit titel="Markeder" className="mt-4">
        <Markeder g={g} p={p} />
      </Afsnit>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Afsnit titel="Anmeldelser">
          <Anmeldelser p={p} />
        </Afsnit>
        <div className="flex flex-col gap-4">
          <Afsnit titel="Features">
            {p.features.length ? (
              <div className="flex flex-wrap gap-1">
                {p.features.map((f) => (
                  <span key={f} className="rounded border-2 border-line bg-panel2 px-1.5 py-0.5 text-xs font-bold text-ink">
                    {featureNavn(f)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">{egen ? 'Ingen særlige features. Forskning giver features til nye produkter.' : 'Ingen kendte features.'}</p>
            )}
          </Afsnit>
          {egen && p.aktiv && (
            <Afsnit titel="Justér">
              <Justering p={p} />
            </Afsnit>
          )}
          {!egen && (
            <p className="rounded-md border-2 border-line bg-bg2 p-2 text-xs text-muted">
              Konkurrentens produkt. I kan ikke ændre det — men I kan lave noget, der er bedre.
            </p>
          )}
        </div>
      </div>

      {egen && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {p.aktiv && (
            <Afsnit titel="Kampagne">
              <Kampagne g={g} p={p} />
            </Afsnit>
          )}
          <Afsnit titel="Næste skridt">
            <Livscyklus g={g} p={p} onLuk={onLuk} />
          </Afsnit>
        </div>
      )}
    </Modal>
  );
}
