// Hitlisten: "Ugens Top 10" pr. åbent marked med pile, "NY!", monogrammer og spillerens produkter fremhævet.
// Faner for alle markeder: åbne markeder viser deres liste, uåbnede viser åbningsdatoen, og Norge er monopol.
import { useRef, useState, type KeyboardEvent } from 'react';
import type { ChartEntry, GameState, LiveProduct, MarketId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { vaelgMarked } from '../lib/markedHjaelp';
import { Badge, Btn, Ikon, Monogram, Panel, Tom } from '../components/kit';
import { FlagStribe } from '../components/FirmaDele';
import { ejerInfo } from '../../sim/competitors';
import { hjemmebane } from '../../sim/charts';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { THEMES } from '../../data/themes';
import { VERTICALS } from '../../data/verticals';
import { ugeIAar, aarFor, datoTekst } from '../../sim/time';
import { heltal, mioKort } from '../format';
import { procent } from '../lib/firmaHjaelp';
import { LICENS_STIL, faktorTekst, hitlisteVaerdi, licensTekst, markedAarsBsi, markedBeskrivelse, rangliste, stoerrelseTekst, ugerKort, vertikalLicens } from '../lib/tvaersHjaelp';

function Bevaegelse({ e }: { e: ChartEntry }) {
  if (e.ny) {
    return (
      <Badge farve="var(--color-pink)" tekstFarve="var(--color-line)" className="anim-blink">
        NY!
      </Badge>
    );
  }
  if (e.forrige === null) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-[0.68rem] font-black text-sky" title="Tilbage på listen">
        <Ikon navn="op" farve="var(--color-sky)" str={12} /> IGEN
      </span>
    );
  }
  const d = e.forrige - e.placering;
  if (d > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-xs font-black text-good" title={`Op fra nr. ${e.forrige}`}>
        <Ikon navn="op" farve="var(--color-good)" str={12} titel={`Op ${d}`} />
        {d}
      </span>
    );
  }
  if (d < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-pixel text-xs font-black text-bad" title={`Ned fra nr. ${e.forrige}`}>
        <Ikon navn="ned" farve="var(--color-bad)" str={12} titel={`Ned ${-d}`} />
        {-d}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-dim" title="Samme plads">
      <Ikon navn="streg" farve="var(--color-dim)" str={12} titel="Uændret" />
    </span>
  );
}

function Raekke({ e, p, g, m }: { e: ChartEntry; p: LiveProduct | undefined; g: GameState; m: MarketId }) {
  if (!p) return null;
  const ejer = ejerInfo(g, p.ejer);
  const egen = p.ejer === 'spiller';
  const top3 = e.placering <= 3;
  const hb = hjemmebane(g, p.ejer, m);
  return (
    <li
      data-testid={`top10-raekke-${e.placering}`}
      data-spiller={egen ? '1' : undefined}
      className={`grid min-h-12 grid-cols-[1.7rem_2.3rem_auto_1fr_auto] items-center gap-x-1.5 @md:grid-cols-[2.1rem_2.6rem_auto_1fr_auto] @md:gap-x-2 rounded-md border-2 px-1.5 py-1 ${
        egen ? 'border-gold bg-[color-mix(in_srgb,var(--color-gold)_14%,var(--color-bg2))] pixel-skygge' : 'border-line bg-bg2'
      }`}
    >
      <span className={`text-center font-pixel font-black tal ${top3 ? 'text-lg text-gold' : 'text-base text-ink'}`}>{e.placering}</span>
      <span className="flex justify-center">
        <Bevaegelse e={e} />
      </span>
      <span title={ejer.navn}>
        <Monogram tekst={ejer.monogram} farve={ejer.farve} str={28} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1">
          {egen && <Ikon navn="krone" farve="var(--color-gold)" indre="var(--color-line)" str={13} titel="Jeres produkt" className="shrink-0" />}
          <span className={`line-clamp-2 leading-tight font-bold break-words @md:truncate ${egen ? 'text-gold' : 'text-ink'}`}>{p.navn}</span>
          {p.version > 1 && <span className="shrink-0 font-pixel text-[0.65rem] font-black text-muted">{p.version}.0</span>}
          {hb > 1 && (
            <span
              className="tal shrink-0 rounded border border-line bg-panel2 px-1 font-pixel text-[0.66rem] font-black uppercase text-sky"
              title={`Hjemmebane: statsselskabets nye spillere tæller ×${String(Math.round(hb * 10) / 10).replace('.', ',')} på hitlisten (fuldt til 2016, aftager til 2018)`}
              data-testid="hjemmebane"
            >
              Hjemme ×{String(Math.round(hb * 10) / 10).replace('.', ',')}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted">
          {PRODUCT_TYPES[p.typeId].navn} × {THEMES[p.themeId].navn}
          <span className="hidden @md:inline"> · {ejer.navn}</span>
        </span>
      </span>
      <span className="text-right">
        <span className="tal block font-pixel text-sm font-bold text-sky" title="Nye spillere denne uge">{heltal(p.nyeSpillerePrUge?.[m] ?? 0)}</span>
        <span className="block text-[0.62rem] uppercase text-dim">nye/uge</span>
        <span className="tal hidden text-[0.62rem] text-gold @md:block" title="BSI denne uge">{mioKort(p.bsiPrUge[m] ?? 0)} BSI</span>
      </span>
    </li>
  );
}

/** Er spilleren på listen i markedet? (til fane-mærket) */
function spillerPlads(g: GameState, m: MarketId): number | null {
  const e = g.markeder[m].top10.find((x) => g.produkter.find((p) => p.id === x.productId)?.ejer === 'spiller');
  return e ? e.placering : null;
}

function MarkedFane({ g, m, valgt, onVaelg, onTast }: { g: GameState; m: MarketId; valgt: boolean; onVaelg: () => void; onTast: (e: KeyboardEvent<HTMLButtonElement>) => void }) {
  const def = MARKETS[m];
  const aaben = g.markeder[m].aaben;
  const plads = aaben ? spillerPlads(g, m) : null;
  const lic = g.markeder[m].licens;
  const ramt = aaben && (lic === 'suspenderet' || lic === 'inddraget');
  const under =
    def.aabnerUge === null
      ? 'monopol'
      : !aaben
        ? String(aarFor(def.aabnerUge))
        : lic === 'suspenderet'
          ? 'susp.'
          : lic === 'inddraget'
            ? 'mistet'
            : plads !== null
              ? `nr. ${plads}`
              : lic === 'aktiv'
                ? 'aktiv'
                : 'åben';
  return (
    <button
      type="button"
      role="tab"
      id={`hitliste-fane-${m}`}
      aria-selected={valgt}
      aria-controls="hitliste-indhold"
      tabIndex={valgt ? 0 : -1}
      onKeyDown={onTast}
      aria-label={aaben ? `${def.navn}${plads !== null ? `, I er nr. ${plads}` : ''}` : def.aabnerUge === null ? `${def.navn}: monopol` : `${def.navn}: åbner ${datoTekst(def.aabnerUge)}`}
      data-testid={`hitliste-marked-${m}`}
      data-laast={aaben ? undefined : '1'}
      onClick={onVaelg}
      title={aaben ? def.navn : def.aabnerUge === null ? `${def.navn} har statsmonopol` : `${def.navn} åbner ${datoTekst(def.aabnerUge)}`}
      className={`flex min-h-[44px] min-w-[3.6rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border-2 border-line px-2 py-1 font-pixel @lg:min-w-0 @lg:px-0.5 ${
        valgt ? 'bg-gold text-line pixel-skygge' : aaben ? 'bg-panel2 text-ink hover:bg-hi' : 'bg-bg2 text-dim hover:text-muted'
      }`}
    >
      <span className="flex items-center gap-1 text-xs font-black uppercase leading-none">
        <FlagStribe farver={def.farver} className={`h-2.5 w-4 ${aaben ? '' : 'opacity-50 grayscale'}`} />
        {def.kort}
        {!aaben && <Ikon navn="laas" farve="currentColor" str={9} />}
        {plads !== null && <Ikon navn="krone" farve={valgt ? 'var(--color-line)' : 'var(--color-gold)'} indre={valgt ? 'var(--color-gold)' : 'var(--color-line)'} str={10} />}
      </span>
      <span className={`tal text-[0.66rem] font-bold uppercase leading-none ${valgt ? 'text-line/80' : ramt ? 'text-bad' : plads !== null ? 'text-gold' : 'text-dim'}`}>{under}</span>
    </button>
  );
}

/** Uåbnet marked eller Norge: hvornår og hvad der venter */
function LaastMarked({ g, m }: { g: GameState; m: MarketId }) {
  const def = MARKETS[m];
  const ms = g.markeder[m];
  if (def.aabnerUge === null) {
    return (
      <div className="flex flex-col gap-2 rounded-md border-2 border-dashed border-hi p-3" data-testid="hitliste-laast">
        <p className="flex items-center gap-2 font-pixel text-sm font-black uppercase text-ink">
          <Ikon navn="laas" farve="var(--color-muted)" /> Statsmonopol
        </p>
        <p className="text-sm text-muted">
          {def.navn} giver ikke licenser — {def.tilsyn} holder markedet for statens eget selskab. Her findes ingen hitliste for licenserede produkter.
        </p>
        <p className="text-xs text-dim">
          Spillere, der vil andet, finder udenlandske sider. Dem kan man kun nå gråt med et offshore-brand — og det har en pris hos tilsynene i alle andre markeder.
          {g.offshoreBrand && ms.offshoreBrandBsiPrUge > 0 && (
            <>
              {' '}
              Jeres offshore-brand henter <b className="tal text-gold">{mioKort(ms.offshoreBrandBsiPrUge)}</b> BSI/uge her.
            </>
          )}
        </p>
      </div>
    );
  }
  const uger = Math.max(0, def.aabnerUge - g.uge);
  return (
    <div className="flex flex-col gap-2 rounded-md border-2 border-dashed border-hi p-3" data-testid="hitliste-laast">
      <p className="flex flex-wrap items-center gap-2 font-pixel text-sm font-black uppercase text-ink">
        <Ikon navn="kalender" farve="var(--color-sky)" indre="var(--color-line)" /> Åbner {datoTekst(def.aabnerUge)}
        <span className="tal font-sans text-xs font-bold normal-case text-muted">om {ugerKort(uger)}</span>
      </p>
      <p className="text-sm text-muted">{markedBeskrivelse(m, g.uge)} Hitlisten starter, når markedet åbner for licenser.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Tilsyn <b className="text-ink">{def.tilsyn}</b>
        </span>
        <span>
          Licens <b className="tal text-gold">{String(def.licensGebyr).replace('.', ',')} mio. kr.</b> · {ugerKort(def.licensUger)}
        </span>
        <span>
          CAC <b className="tal text-ink">{faktorTekst(def.cacFaktor)}</b> af DK
        </span>
      </div>
    </div>
  );
}

/** Spillerens licensstatus i det valgte marked (når de ikke er på listen) */
function LicensLinje({ g, m }: { g: GameState; m: MarketId }) {
  const ms = g.markeder[m];
  const def = MARKETS[m];
  const lic = vertikalLicens(g, m, g.startVertikal);
  if (ms.licens === 'aktiv') return null;
  const st = LICENS_STIL[lic.tilstand];
  const tekst =
    lic.tilstand === 'ingen'
      ? `I har ingen licens i ${def.navn} endnu. Markedet er ${stoerrelseTekst(markedAarsBsi(m, g.startVertikal, g.uge))} i ${VERTICALS[g.startVertikal].kort.toLowerCase()}.`
      : lic.tilstand === 'ansoegt'
        ? `Jeres licens i ${def.navn} er på vej: ${licensTekst(lic).toLowerCase()}.`
        : lic.tilstand === 'suspenderet'
          ? `Licensen i ${def.navn} er suspenderet til ${datoTekst(lic.tilUge ?? g.uge)}. Jeres produkter er ude af listen imens.`
          : lic.tilstand === 'inddraget'
            ? `Licensen i ${def.navn} er inddraget. Listen kører videre uden jer.`
            : null;
  if (!tekst) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-bg2 p-2 text-sm" data-testid="hitliste-licens">
      <Ikon navn={st.ikon} farve={st.farve} indre="var(--color-line)" className="shrink-0" />
      <span className="min-w-0 flex-1 text-muted">{tekst}</span>
      {lic.tilstand === 'ingen' && (
        <Btn
          lille
          onClick={() => {
            vaelgMarked(m, 'konsol');
            useUi.getState().setPanel('marked');
          }}
          testId="hitliste-til-marked" className="min-h-[44px] shrink-0">
          Søg licens <Ikon navn="pil" farve="currentColor" str={12} />
        </Btn>
      )}
    </div>
  );
}

/** Seneste valgte marked (huskes, når man skifter fane og kommer tilbage) */
let sidsteMarked: MarketId = 'dk';

export default function ChartPanel() {
  const g = useGame((s) => s.game);
  const [valgt, setValgtState] = useState<MarketId>(() => sidsteMarked);
  const setValgt = (m: MarketId) => {
    sidsteMarked = m;
    setValgtState(m);
  };
  const faner = useRef<HTMLDivElement>(null);
  // Tastatur (WAI-ARIA-faner): pil venstre/højre, Home og End flytter valget og fokus
  const tast = (e: KeyboardEvent<HTMLButtonElement>, m: MarketId) => {
    const i = MARKET_IDS.indexOf(m);
    const n = MARKET_IDS.length;
    let ny = -1;
    if (e.key === 'ArrowRight') ny = (i + 1) % n;
    else if (e.key === 'ArrowLeft') ny = (i - 1 + n) % n;
    else if (e.key === 'Home') ny = 0;
    else if (e.key === 'End') ny = n - 1;
    if (ny < 0) return;
    e.preventDefault();
    const id = MARKET_IDS[ny];
    setValgt(id);
    const el = faner.current?.querySelector<HTMLButtonElement>(`[data-testid="hitliste-marked-${id}"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
  if (!g) return null;
  const marked = valgt;
  const ms = g.markeder[marked];
  const def = MARKETS[marked];
  const aaben = ms.aaben;
  const liste = ms.top10;
  const liste10 = rangliste(g, marked);
  const spillerIListe = liste.some((e) => g.produkter.find((p) => p.id === e.productId)?.ejer === 'spiller');
  const bedsteUdenfor = liste10.findIndex((p, i) => i >= 10 && p.ejer === 'spiller');
  const udenfor = bedsteUdenfor >= 0 ? liste10[bedsteUdenfor] : undefined;
  const nr10 = liste10[9];
  const harProdukter = g.produkter.some((p) => p.ejer === 'spiller' && p.aktiv && p.markeder.includes(marked));
  // Rangtal inkl. hjemmebane, så "mangler til nr. 10" passer med den rækkefølge, sim-kernen bruger
  const nye = (p: LiveProduct | undefined) => (p ? hitlisteVaerdi(g, p, marked) : 0);
  const medHjemmebane = liste.some((e) => {
    const p = g.produkter.find((x) => x.id === e.productId);
    return p ? hjemmebane(g, p.ejer, marked) > 1 : false;
  });

  return (
    <Panel titel="Top 10" ikon="hitliste" testId="panel-hitliste" hoejre={<span className="font-pixel text-xs text-muted">Uge {ugeIAar(g.uge) + 1}, {aarFor(g.uge)}</span>}>
      <div className="@container flex flex-col gap-3">
        {/* Markedsvælger: åbne markeder har en liste; uåbnede viser åbningsdatoen; Norge er monopol */}
        {/* Bred container: alle 9 faner i et gitter (intet skjult bag kanten); smal: vandret rulning */}
        <div
          ref={faner}
          className="shell-uden-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 @lg:mx-0 @lg:grid @lg:grid-cols-9 @lg:overflow-visible @lg:px-0"
          role="tablist"
          aria-label="Marked"
          data-testid="hitliste-markeder"
        >
          {MARKET_IDS.map((id) => (
            <MarkedFane key={id} g={g} m={id} valgt={id === marked} onVaelg={() => setValgt(id)} onTast={(e) => tast(e, id)} />
          ))}
        </div>

        <div id="hitliste-indhold" role="tabpanel" aria-labelledby={`hitliste-fane-${marked}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5">
            <h3 className="flex items-center gap-2 font-pixel text-base font-black uppercase tracking-wide text-ink">
              <FlagStribe farver={def.farver} className="h-3.5 w-6 shrink-0" />
              <span>
                {aaben ? 'Ugens Top 10' : 'Top 10'} <span className="text-gold">— {def.navn}</span>
              </span>
            </h3>
            {aaben && (
              <span className="text-xs text-dim">
                {ms.kanalisering > 0 && <span title="Andel af spillet hos licenserede udbydere">{procent(ms.kanalisering, 0)} licenseret</span>}
                <span className="hidden @md:inline">
                  {ms.kanalisering > 0 ? ' · ' : ''}Sorteret efter ugens nye spillere{medHjemmebane ? ' · statsselskabet har hjemmebane' : ''}
                </span>
              </span>
            )}
          </div>

          {!aaben ? (
            <LaastMarked g={g} m={marked} />
          ) : (
            <>
              <LicensLinje g={g} m={marked} />
              {liste.length === 0 ? (
                <Tom>Hitlisten er tom. Den første uge er ikke talt op endnu.</Tom>
              ) : (
                <ol className="flex flex-col gap-1" data-testid="top10" data-marked={marked}>
                  {liste.map((e) => (
                    <Raekke key={e.productId} e={e} p={g.produkter.find((p) => p.id === e.productId)} g={g} m={marked} />
                  ))}
                </ol>
              )}

              {udenfor ? (
                <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-gold/60 bg-bg2 p-2 text-sm" data-testid="top10-udenfor">
                  <Ikon navn="krone" farve="var(--color-gold)" indre="var(--color-line)" className="shrink-0" />
                  <span className="min-w-0">
                    Jeres bedste uden for listen: <b className="text-gold">{udenfor.navn}</b> som nr. <b className="tal">{bedsteUdenfor + 1}</b>.
                    {nr10 && <span className="text-muted"> Mangler {heltal(Math.max(0, nye(nr10) - nye(udenfor)))} nye spillere/uge til nr. 10.</span>}
                  </span>
                </div>
              ) : (
                !spillerIListe &&
                ms.licens === 'aktiv' && (
                  <p className="flex items-center gap-1.5 text-sm text-muted" data-testid="top10-udenfor">
                    <Ikon navn="spoergsmaal" farve="var(--color-dim)" str={14} className="shrink-0" />
                    {harProdukter
                      ? 'Jeres produkter har ikke nok aktivitet til at blive talt med endnu.'
                      : marked === 'dk'
                        ? 'Lancér jeres første produkt for at komme på listen.'
                        : `Vælg ${def.kort} under Markeder, når I starter et nyt produkt, for at komme på listen her.`}
                  </p>
                )
              )}
            </>
          )}
        </div>
        <p className="text-xs text-dim">
          Listen tæller ugens nye spillere pr. produkt i hvert marked. En lancering med god anmeldelse og hype kan storme listen; bagefter glider den ned, medmindre marketing og kunderne
          holder den oppe.
        </p>
      </div>
    </Panel>
  );
}
