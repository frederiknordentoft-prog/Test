// Firma: kontor, økonomi (ugens regnskab + kvartalshistorik), finansiering, kvartalsmål, forskning, kalender og trofæer.
import { useState, type ReactNode } from 'react';
import type { GameState, MarketId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Panel, Tom } from '../components/kit';
import { Afsnit, Chip, KravRaekke, Maengde, Pips, SoejleGraf, type Soejle } from '../components/FirmaDele';
import ExpoDialog from '../dialogs/ExpoDialog';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { OFFICES, OFFICE_BY_ID } from '../../data/costs';
import { ROUNDS, RUNDE_NAVN, PRES_EVENT_TAERSKEL, STJERNE_VAERDI } from '../../data/funding';
import { RESEARCH, RESEARCH_BY_ID, type ResearchNode } from '../../data/research';
import { EXPOS, STAND_NAVN } from '../../data/expos';
import { GALA_CATEGORIES, GALA_UGE_I_AAR } from '../../data/galaCategories';
import { VERTICALS } from '../../data/verticals';
import { naesteKontor, kontorKrav } from '../../sim/office';
import { minBudget, typeStatus } from '../../sim/projects';
import { PRODUCT_TYPE_IDS } from '../../data/productTypes';
import { HALL_OF_FAME_KRAV } from '../lib/devHjaelp';
import { naesteRunde, vaerdiansaettelse, antalLanceringer, evaluerMaal } from '../../sim/investors';
import { aarligBsi } from '../../sim/economy';
import { forskningStatus } from '../../sim/insight';
import { bookingAabent } from '../../sim/expos';
import { aarFor, datoTekst, kvartalFor, ugeIAar } from '../../sim/time';
import type { FundingRound } from '../../sim/types';
import { mio, mioKort, heltal } from '../format';
import { MAAL_IKON, forskningsDybde, forskningsEffektTekst, gallaNomineringer, naesteKvartalsmoede, procent, uger, maalVisning } from '../lib/firmaHjaelp';

const SEKTIONER = [
  { id: 'kontor', navn: 'Kontor', ikon: 'hus' },
  { id: 'oekonomi', navn: 'Økonomi', ikon: 'penge' },
  { id: 'finansiering', navn: 'Finansiering', ikon: 'diamant' },
  { id: 'maal', navn: 'Mål', ikon: 'stjerne' },
  { id: 'forskning', navn: 'Forskning', ikon: 'kolbe' },
  { id: 'kalender', navn: 'Kalender', ikon: 'kalender' },
  { id: 'trofaeer', navn: 'Trofæer', ikon: 'trofae' },
] as const;

function Hop() {
  const reduceret = useReduceretBevaegelse();
  return (
    <nav className="flex flex-wrap gap-1" aria-label="Hop til afsnit">
      {SEKTIONER.map((s) => (
        <button
          key={s.id}
          type="button"
          data-testid={`firma-hop-${s.id}`}
          onClick={() => document.getElementById(`firma-${s.id}`)?.scrollIntoView({ block: 'start', behavior: reduceret ? 'auto' : 'smooth' })}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line bg-panel2 px-3 text-sm font-bold text-muted hover:bg-hi hover:text-ink"
        >
          <Ikon navn={s.ikon} farve="var(--color-gold)" indre="var(--color-line)" str={13} />
          {s.navn}
        </button>
      ))}
    </nav>
  );
}

// ---------- Kontor ----------

function Kontor({ g }: { g: GameState }) {
  const nu = OFFICE_BY_ID[g.kontor];
  const naeste = naesteKontor(g);
  const krav = kontorKrav(g);
  const idx = OFFICES.findIndex((o) => o.id === g.kontor);
  const udland = (Object.keys(g.markeder) as MarketId[]).some((m) => m !== 'dk' && g.markeder[m].licens === 'aktiv');
  // Hvad koster flytningen bagefter? Kassen efter flytningen, den nye husleje og det billigste nye produkt
  const efter = naeste ? g.kapital - naeste.pris : g.kapital;
  const typer = PRODUCT_TYPE_IDS.filter((t) => typeStatus(g, t).ok);
  const billigst = typer.length ? Math.min(...typer.map((t) => minBudget(g, t))) : 0;
  const ingenRaadTilProdukt = !!naeste && efter >= 0 && billigst > 0 && efter < billigst;
  return (
    <div className="flex flex-col gap-2.5">
      <ol className="grid grid-cols-5 gap-1" aria-label="Kontortrin">
        {OFFICES.map((o, i) => (
          <li
            key={o.id}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded border-2 border-line px-0.5 py-1 text-center ${i === idx ? 'bg-gold text-line pixel-skygge' : i < idx ? 'bg-panel2 text-muted' : 'bg-bg text-dim'}`}
            aria-current={i === idx ? 'step' : undefined}
          >
            <Ikon navn={i < idx ? 'flueben' : i === idx ? 'hus' : 'laas'} farve="currentColor" indre={i === idx ? 'var(--color-gold)' : 'var(--color-bg)'} str={13} />
            <span className="w-full truncate font-pixel text-[0.66rem] font-black uppercase" title={o.navn}>{o.navn}</span>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded border-2 border-line bg-panel px-1 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Pladser</div>
          <div className="tal font-pixel text-sm font-black">
            {g.staff.length}/{nu.pladser}
          </div>
        </div>
        <div className="rounded border-2 border-line bg-panel px-1 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Projekter</div>
          <div className="tal font-pixel text-sm font-black">{nu.projekter} ad gangen</div>
        </div>
        <div className="rounded border-2 border-line bg-panel px-1 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Husleje</div>
          <div className="tal font-pixel text-sm font-black text-gold">{mioKort(nu.husleje)}/u</div>
        </div>
      </div>
      {naeste ? (
        <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-pixel text-sm font-black">Næste: {naeste.navn}</span>
            <span className="text-xs text-muted">
              {naeste.pladser} pladser · {naeste.projekter} projekter · {mioKort(naeste.husleje)}/uge i husleje
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            <KravRaekke ok={g.kapital >= naeste.pris}>
              {mio(naeste.pris)} i kassen <span className="text-dim">(I har {mio(g.kapital)})</span>
            </KravRaekke>
            {naeste.id === 'kontor' && <KravRaekke ok={g.milepaele.foersteGuldkupon !== undefined}>En Guldkupon (32+ hos anmelderne)</KravRaekke>}
            {naeste.id === 'etage' && <KravRaekke ok={udland}>En aktiv licens uden for Danmark</KravRaekke>}
          </ul>
          {g.kapital >= naeste.pris && (
            <div className="grid grid-cols-2 gap-1.5 text-center" data-testid="flytning-efter">
              <div className="rounded border-2 border-line bg-bg2 px-1 py-1">
                <div className="text-[0.62rem] uppercase text-muted">Kassen bagefter</div>
                <div className={`tal font-pixel text-sm font-black ${ingenRaadTilProdukt ? 'text-warn' : 'text-gold'}`}>{mioKort(efter)}</div>
              </div>
              <div className="rounded border-2 border-line bg-bg2 px-1 py-1">
                <div className="text-[0.62rem] uppercase text-muted">Husleje pr. uge</div>
                <div className="tal font-pixel text-sm font-black text-ink">
                  {mioKort(nu.husleje)} <span className="text-dim">→</span> <span className="text-warn">{mioKort(naeste.husleje)}</span>
                </div>
              </div>
            </div>
          )}
          {ingenRaadTilProdukt && (
            <p className="flex items-start gap-1.5 rounded border-2 border-warn bg-warn/10 px-2 py-1 text-xs text-ink" data-testid="flytning-advarsel">
              <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={14} className="mt-px shrink-0" />
              <span>
                Efter flytningen er der ikke råd til et nyt produkt (mindst {mio(billigst)}). Tag kontraktopgaver, eller vent, til kassen er større.
              </span>
            </p>
          )}
          <Btn
            variant="primaer"
            disabled={!krav.ok}
            title={krav.ok ? undefined : krav.grunde[0]}
            testId="opgrader-kontor"
            onClick={() => useGame.getState().dispatch({ t: 'upgradeOffice' })}
          >
            <Ikon navn="hus" farve="currentColor" indre="var(--color-gold)" str={14} /> Flyt i {naeste.navn.toLowerCase()} · {mio(naeste.pris)}
          </Btn>
        </div>
      ) : (
        <p className="text-sm text-muted">I har hovedkontoret. Der er ikke højere til loftet.</p>
      )}
    </div>
  );
}

// ---------- Økonomi ----------

function PostRaekke({ navn, v, type, fed }: { navn: string; v: number; type: 'ind' | 'ud' | 'sum'; fed?: boolean }) {
  const nul = Math.abs(v) < 0.0005;
  const farve = type === 'ind' ? 'var(--color-good)' : type === 'ud' ? 'var(--color-ink)' : v >= 0 ? 'var(--color-good)' : 'var(--color-bad)';
  const tegn = type === 'ind' ? '+' : type === 'ud' ? '−' : v >= 0 ? '+' : '−';
  return (
    <tr className={`border-t border-line/60 ${fed ? 'border-t-2 border-line font-black' : ''}`}>
      <th scope="row" className={`py-1 pr-2 text-left font-normal ${fed ? 'font-pixel text-sm font-black uppercase' : 'text-sm text-muted'}`}>
        {navn}
      </th>
      <td className={`tal py-1 text-right font-pixel ${fed ? 'text-base' : 'text-sm'} ${nul ? 'text-dim' : ''}`} style={nul ? undefined : { color: farve }}>
        {nul ? '–' : `${tegn}${mio(Math.abs(v))}`}
      </td>
    </tr>
  );
}

function Oekonomi({ g }: { g: GameState }) {
  const r = g.regnskab;
  const hist = g.historik.slice(-12);
  const kvLabel = (a: number, k: number) => `Q${k} '${String(a).slice(2)}`;
  const bsiSoejler: Soejle[] = hist.map((h) => ({ label: kvLabel(h.aar, h.kvartal), v: h.bsi, titel: `${kvLabel(h.aar, h.kvartal)}: BSI ${mio(h.bsi)}` }));
  const resSoejler: Soejle[] = hist.map((h) => ({ label: kvLabel(h.aar, h.kvartal), v: h.resultat, titel: `${kvLabel(h.aar, h.kvartal)}: resultat ${h.resultat < 0 ? '−' : '+'}${mio(Math.abs(h.resultat))}` }));
  const sidste = hist[hist.length - 1];
  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
      <div className="min-w-0">
        <div className="mb-1.5 grid grid-cols-3 gap-1.5">
          <div className="rounded border-2 border-line bg-panel px-1.5 py-1">
            <div className="text-[0.62rem] uppercase text-muted">Kapital</div>
            <Maengde ikon="penge" farve={g.kapital < 0 ? 'var(--color-bad)' : 'var(--color-gold)'} className="text-sm">
              {mioKort(g.kapital)}
            </Maengde>
          </div>
          <div className="rounded border-2 border-line bg-panel px-1.5 py-1" title="Annualiseret ud fra de seneste 13 uger">
            <div className="text-[0.62rem] uppercase text-muted">BSI pr. år</div>
            <Maengde ikon="penge" farve="var(--color-gold)" className="text-sm">
              {mioKort(aarligBsi(g))}
            </Maengde>
          </div>
          <div className="rounded border-2 border-line bg-panel px-1.5 py-1">
            <div className="text-[0.62rem] uppercase text-muted">Kvartal til nu</div>
            <span className="tal font-pixel text-sm font-bold" style={{ color: g.kvartalAkk.resultat >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
              {g.kvartalAkk.resultat >= 0 ? '+' : '−'}
              {mioKort(Math.abs(g.kvartalAkk.resultat))}
            </span>
          </div>
        </div>
        <table className="w-full" data-testid="regnskab">
          <caption className="mb-1 text-left font-pixel text-xs font-black uppercase text-muted">Sidste uges regnskab</caption>
          <tbody>
            <PostRaekke navn="BSI (spillernes tab)" v={r.bsi} type="ind" />
            <PostRaekke navn="Kontraktopgaver" v={r.kontrakter} type="ind" />
            <PostRaekke navn="Spilafgift" v={r.afgift} type="ud" />
            <PostRaekke navn="Platform (revenue share)" v={r.revenueShare} type="ud" />
            <PostRaekke navn="Betalingsgebyrer" v={r.betalinger} type="ud" />
            <PostRaekke navn="Bonus og VIP" v={r.bonus} type="ud" />
            <PostRaekke navn="Kasinoindhold (aggregator)" v={r.indhold} type="ud" />
            <PostRaekke navn="Marketing" v={r.marketing} type="ud" />
            <PostRaekke navn="Løn" v={r.loen} type="ud" />
            <PostRaekke navn="Licensgebyrer" v={r.licenser} type="ud" />
            <PostRaekke navn="Husleje, drift og engangsudgifter" v={r.oevrigt} type="ud" />
            <PostRaekke navn="Resultat" v={r.resultat} type="sum" fed />
          </tbody>
        </table>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {hist.length === 0 ? (
          <Tom>Grafen får sin første søjle ved det første kvartalsmøde.</Tom>
        ) : (
          <>
            <div className="rounded-md border-2 border-line bg-panel p-2">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-pixel text-xs font-black uppercase">BSI pr. kvartal</span>
                {sidste && <span className="tal font-pixel text-xs font-bold text-gold">{mio(sidste.bsi)}</span>}
              </div>
              <SoejleGraf soejler={bsiSoejler} farve="var(--color-gold)" testId="graf-bsi" />
            </div>
            <div className="rounded-md border-2 border-line bg-panel p-2">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="font-pixel text-xs font-black uppercase">Resultat pr. kvartal</span>
                {sidste && (
                  <span className="tal flex items-center gap-1 font-pixel text-xs font-bold" style={{ color: sidste.resultat >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                    <Ikon navn={sidste.resultat >= 0 ? 'op' : 'ned'} farve="currentColor" str={10} />
                    {sidste.resultat >= 0 ? '+' : '−'}
                    {mio(Math.abs(sidste.resultat))}
                  </span>
                )}
              </div>
              <SoejleGraf soejler={resSoejler} farve="var(--color-good)" testId="graf-resultat" />
            </div>
            <details className="rounded-md border-2 border-line bg-panel px-2 py-1 text-sm">
              <summary className="flex min-h-[44px] cursor-pointer items-center font-bold text-muted">Vis som tabel</summary>
              <table className="mt-1 w-full text-xs">
                <thead>
                  <tr className="text-muted">
                    <th className="text-left font-normal">Kvartal</th>
                    <th className="text-right font-normal">BSI</th>
                    <th className="text-right font-normal">Resultat</th>
                    <th className="text-right font-normal">Kunder</th>
                  </tr>
                </thead>
                <tbody>
                  {[...hist].reverse().map((h) => (
                    <tr key={`${h.aar}-${h.kvartal}`} className="border-t border-line/60">
                      <td className="py-0.5">{kvLabel(h.aar, h.kvartal)}</td>
                      <td className="tal text-right">{mioKort(h.bsi)}</td>
                      <td className="tal text-right" style={{ color: h.resultat >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                        {h.resultat >= 0 ? '+' : '−'}
                        {mioKort(Math.abs(h.resultat))}
                      </td>
                      <td className="tal text-right">{heltal(h.kunder)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Finansiering ----------

function Finansiering({ g }: { g: GameState }) {
  const inv = g.investorer;
  const n = naesteRunde(g);
  const bsi = aarligBsi(g);
  const lanc = antalLanceringer(g);
  const harInvestorer = inv.runde !== 'ingen';
  const presFarve = inv.pres >= PRES_EVENT_TAERSKEL ? 'var(--color-bad)' : inv.pres >= 2 ? 'var(--color-warn)' : 'var(--color-good)';
  const siden = inv.rundeUge === null ? null : g.uge - inv.rundeUge;
  const nuIdx = ROUNDS.findIndex((r) => r.id === inv.runde);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded border-2 border-line bg-panel px-2 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Runde</div>
          <div className="font-pixel text-sm font-black text-ink">{RUNDE_NAVN[inv.runde as FundingRound] ?? inv.runde}</div>
        </div>
        <div className="rounded border-2 border-line bg-panel px-2 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Stifterne ejer</div>
          <div className="tal font-pixel text-sm font-black text-ink">{procent(inv.ejerandelStiftere, 1)}</div>
        </div>
        <div className="rounded border-2 border-line bg-panel px-2 py-1">
          <div className="text-[0.62rem] uppercase text-muted">Værdiansættelse</div>
          <Maengde ikon="diamant" farve="var(--color-gold)" className="text-sm">
            {mioKort(vaerdiansaettelse(g))}
          </Maengde>
        </div>
        <div className="rounded border-2 border-line bg-panel px-2 py-1" title={`Hver stjerne giver +${Math.round(STJERNE_VAERDI * 100)} % i værdi (maks 30 %)`}>
          <div className="text-[0.62rem] uppercase text-muted">Stjerner</div>
          <Maengde ikon="stjerne" farve="var(--color-gold)" className="text-sm">
            {inv.stjerner}
          </Maengde>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded border-2 border-line bg-panel px-2 py-1.5" data-testid="investorpres">
        <span className="text-sm text-muted">Investorpres</span>
        {harInvestorer ? (
          <span className="flex items-center gap-2">
            <Pips vaerdi={inv.pres} max={5} farve={presFarve} label="Investorpres" />
            <span className="tal font-pixel text-xs font-bold" style={{ color: presFarve }}>
              {String(Math.round(inv.pres * 10) / 10).replace('.', ',')}/5
            </span>
          </span>
        ) : (
          <span className="text-xs text-dim">Ingen investorer at stå til regnskab over</span>
        )}
      </div>
      {harInvestorer && <p className="-mt-1 text-xs text-dim">Hvert mål, I misser, giver +1. Ved {PRES_EVENT_TAERSKEL} bliver bestyrelsen utålmodig.</p>}

      {n.def ? (
        <div className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid="naeste-runde">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="font-pixel text-sm font-black">
              Næste: {n.def.navn}-runde
            </span>
            <Maengde ikon="penge" farve="var(--color-gold)">+{mio(n.def.kapital)}</Maengde>
          </div>
          <p className="text-xs text-muted">
            Stifterne går fra {procent(inv.ejerandelStiftere, 1)} til {procent(inv.ejerandelStiftere * (1 - n.def.udvanding), 1)}. Kvartalsmålene bliver ca. {Math.round(n.def.vaekstkrav * 100)} % sværere.
          </p>
          <ul className="flex flex-col gap-0.5">
            <KravRaekke ok={bsi >= n.def.kravBsiAar}>
              BSI på {mio(n.def.kravBsiAar)} om året <span className="text-dim">(nu {mio(bsi)})</span>
            </KravRaekke>
            <KravRaekke ok={lanc >= n.def.kravLanceringer}>
              {n.def.kravLanceringer} lancerede produkter <span className="text-dim">(nu {lanc})</span>
            </KravRaekke>
            {n.def.minUgerSiden > 0 && siden !== null && (
              <KravRaekke ok={siden >= n.def.minUgerSiden}>
                {uger(n.def.minUgerSiden)} siden sidste runde <span className="text-dim">(nu {uger(siden)})</span>
              </KravRaekke>
            )}
          </ul>
          <Btn
            variant="primaer"
            disabled={!n.ok}
            title={n.ok ? undefined : n.grunde[0]}
            testId="rejs-runde"
            onClick={() => useGame.getState().dispatch({ t: 'raiseRound' })}
          >
            <Ikon navn="diamant" farve="currentColor" indre="var(--color-gold)" str={14} /> Rejs runden
          </Btn>
          <p className="text-[0.68rem] text-dim">
            Runde {nuIdx + 2} af {ROUNDS.length}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted">Alle runder er rejst. Nu handler det om at levere.</p>
      )}
    </div>
  );
}

// ---------- Kvartalsmål ----------

function Kvartalsmaal({ g }: { g: GameState }) {
  const kv = naesteKvartalsmoede(g.uge);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-pixel text-xs font-black uppercase text-muted">
          Q{kvartalFor(g.uge) + 1} {aarFor(g.uge)}
        </span>
        <Chip ikon="ur" farve="var(--color-sky)">
          Kvartalsmøde om {uger(kv.uger)}
        </Chip>
      </div>
      {g.kvartalsmaal.length === 0 ? (
        <p className="text-sm text-muted">Ingen mål i dette kvartal.</p>
      ) : (
        <ul className="flex flex-col gap-1" data-testid="kvartalsmaal">
          {g.kvartalsmaal.map((m) => {
            const v = maalVisning(g, m, evaluerMaal(g, m));
            const ok = v.status === 'ok';
            return (
              <li key={m.id} className="flex min-h-[44px] items-center gap-2 rounded border-2 border-line bg-panel px-2 py-1" data-testid={`maal-${m.kind}`}>
                <Ikon navn={MAAL_IKON[m.kind]} farve="var(--color-gold)" indre="var(--color-line)" str={16} className="shrink-0" />
                <span className="min-w-0 flex-1 text-sm">
                  {m.tekst}
                  {v.note && (
                    <span className="block text-xs" style={{ color: v.noteGod ? 'var(--color-good)' : 'var(--color-bad)' }}>
                      {v.note}
                    </span>
                  )}
                </span>
                <span
                  className="flex shrink-0 items-center gap-1 rounded border-2 border-line px-1.5 py-0.5 font-pixel text-[0.66rem] font-black uppercase"
                  style={{ background: ok ? 'var(--color-good)' : 'var(--color-bg)', color: ok ? 'var(--color-line)' : 'var(--color-muted)' }}
                >
                  <Ikon navn={ok ? 'flueben' : 'ur'} farve="currentColor" indre="var(--color-bg)" str={11} />
                  {ok ? 'Nået' : v.status === 'undervejs' ? 'Afgøres ved mødet' : 'Endnu ikke'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-dim">Hvert nået mål giver en stjerne ved kvartalsmødet. Stjerner løfter værdiansættelsen.</p>
    </div>
  );
}

// ---------- Forskning ----------

const TRIN_NAVN = ['Grundforskning', 'Næste skridt', 'Avanceret', 'Spydspids'];

/** Knaptekst, der siger, hvad der mangler: "Mangler 3 indsigt", "Fra 2026", "Kræver X" eller "Optaget" */
function forskKnapTekst(g: GameState, n: ResearchNode, st: { ok: boolean; grund?: string }): string {
  if (st.ok) return 'Start';
  if (st.grund === 'Der forskes allerede i noget andet') return 'Optaget';
  if (st.grund?.startsWith('Fra')) return st.grund;
  if (st.grund?.endsWith('indsigt')) return `Mangler ${Math.max(1, Math.ceil(n.indsigt - g.indsigt))} indsigt`;
  return 'Kræver forskning først';
}

function ForskningsKort({ g, n }: { g: GameState; n: ResearchNode }) {
  const ulaast = g.forskning.ulaast.includes(n.id);
  const igang = g.forskning.igang?.nodeId === n.id ? g.forskning.igang : null;
  const st = forskningStatus(g, n);
  const effekter = forskningsEffektTekst(n);
  if (ulaast) {
    return (
      <li className="flex min-h-9 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-md border-2 border-line bg-panel2/60 px-2 py-1" data-testid={`forskning-${n.id}`} title={n.beskrivelse}>
        <Ikon navn="flueben" farve="var(--color-good)" str={13} titel="Færdig" />
        <span className="font-pixel text-xs font-black text-muted">{n.navn}</span>
        {effekter.map((e) => (
          <span key={e} className="text-[0.68rem] font-bold text-good">
            {e}
          </span>
        ))}
      </li>
    );
  }
  return (
    <li
      className={`flex flex-col gap-1.5 rounded-md border-2 p-2 ${ulaast ? 'border-line bg-panel2' : igang ? 'border-cyan bg-panel' : 'border-line bg-panel'}`}
      data-testid={`forskning-${n.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-pixel text-sm font-black">
            {ulaast && <Ikon navn="flueben" farve="var(--color-good)" str={13} titel="Færdig" />}
            {n.navn}
          </span>
          <span className="block text-xs text-muted">{n.beskrivelse}</span>
        </span>
        {n.vertikal && (
          <Chip farve={VERTICALS[n.vertikal].farve} className="shrink-0">
            {VERTICALS[n.vertikal].kort}
          </Chip>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {effekter.map((e) => (
          <Chip key={e} farve="var(--color-good)">
            {e}
          </Chip>
        ))}
      </div>
      {n.kraever.length > 0 && !ulaast && (
        <p className="text-[0.7rem] text-dim">
          Kræver:{' '}
          {n.kraever.map((k, i) => (
            <span key={k} className={g.forskning.ulaast.includes(k) ? 'text-good' : 'text-muted'}>
              {i > 0 ? ', ' : ''}
              {RESEARCH_BY_ID[k]?.navn ?? k}
            </span>
          ))}
        </p>
      )}
      {igang ? (
        <div className="flex items-center gap-2">
          <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-sm border-2 border-line bg-bg">
            <span className="block h-full bg-cyan" style={{ width: `${((n.uger - igang.resterendeUger) / n.uger) * 100}%` }} />
          </span>
          <span className="tal shrink-0 font-pixel text-xs font-bold text-cyan">{uger(igang.resterendeUger)} tilbage</span>
        </div>
      ) : ulaast ? null : (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs">
            <Maengde ikon="indsigt" farve="var(--color-cyan)">{n.indsigt}</Maengde>
            <Maengde ikon="ur" farve="var(--color-muted)">{uger(n.uger)}</Maengde>
          </span>
          <Btn
            variant="primaer"
            lille
            className="min-h-[44px]"
            disabled={!st.ok}
            title={st.ok ? `Start forskning i ${n.navn}` : st.grund}
            testId={`forsk-${n.id}`}
            onClick={() => useGame.getState().dispatch({ t: 'startResearch', nodeId: n.id })}
          >
            {forskKnapTekst(g, n, st)}
          </Btn>
        </div>
      )}
    </li>
  );
}

function Forskning({ g }: { g: GameState }) {
  const trin = new Map<number, ResearchNode[]>();
  for (const n of RESEARCH) {
    const d = forskningsDybde(n);
    trin.set(d, [...(trin.get(d) ?? []), n]);
  }
  const igang = g.forskning.igang ? RESEARCH_BY_ID[g.forskning.igang.nodeId] : null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Maengde ikon="indsigt" farve="var(--color-cyan)">{heltal(g.indsigt)} indsigt</Maengde>
        <span className="text-muted">
          {g.forskning.ulaast.length} af {RESEARCH.length} færdige{igang ? ` · forsker i ${igang.navn}` : ' · intet i gang'}
        </span>
      </div>
      {[...trin.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([d, noder]) => (
          <div key={d}>
            <div className="mb-1 flex items-center gap-2 font-pixel text-[0.68rem] font-black uppercase tracking-wide text-dim">
              <span>
                Trin {d + 1} · {TRIN_NAVN[d] ?? ''}
              </span>
              <span className="h-0.5 flex-1 bg-line" />
            </div>
            {noder.some((n) => g.forskning.ulaast.includes(n.id)) && (
              <ul className="mb-1.5 flex flex-wrap gap-1.5">
                {noder
                  .filter((n) => g.forskning.ulaast.includes(n.id))
                  .map((n) => (
                    <ForskningsKort key={n.id} g={g} n={n} />
                  ))}
              </ul>
            )}
            {noder.some((n) => !g.forskning.ulaast.includes(n.id)) && (
              <ul className="grid grid-cols-1 gap-1.5 @lg:grid-cols-2 @3xl:grid-cols-3">
                {noder
                  .filter((n) => !g.forskning.ulaast.includes(n.id))
                  .map((n) => (
                    <ForskningsKort key={n.id} g={g} n={n} />
                  ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
}

// ---------- Kalender ----------

function Kalender({ g, onBook }: { g: GameState; onBook: (expoId: string) => void }) {
  const u = ugeIAar(g.uge);
  const aarNu = aarFor(g.uge);
  const punkter: { noegle: string; uge: number; node: ReactNode }[] = [];
  for (const e of EXPOS) {
    const aar = u < e.ugeIAar ? aarNu : aarNu + 1;
    const ugeAbs = (aar - 2012) * 52 + e.ugeIAar;
    const booking = g.messeBookinger.find((b) => b.expoId === e.id && b.aar === aar);
    const aaben = bookingAabent(g, e.id) && aar === aarNu;
    const tilAabning = e.ugeIAar - e.varselUger - u;
    punkter.push({
      noegle: e.id,
      uge: ugeAbs,
      node: (
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-bold">
            {e.navn} <span className="font-normal text-muted">i {e.by}</span>
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {booking ? (
              <Chip ikon="flueben" farve="var(--color-good)" fyld>
                {STAND_NAVN[booking.stoerrelse]} booket
              </Chip>
            ) : aaben ? (
              <Btn variant="primaer" lille className="min-h-[44px]" onClick={() => onBook(e.id)} testId={`kalender-book-${e.id}`}>
                Book stand
              </Btn>
            ) : (
              <Chip ikon="ur" farve="var(--color-muted)">
                Booking åbner {tilAabning > 0 ? `om ${uger(tilAabning)}` : `${e.varselUger} uger før`}
              </Chip>
            )}
          </span>
        </div>
      ),
    });
  }
  const gallaAar = u < GALA_UGE_I_AAR ? aarNu : aarNu + 1;
  const nom = gallaNomineringer(g);
  punkter.push({
    noegle: 'galla',
    uge: (gallaAar - 2012) * 52 + GALA_UGE_I_AAR,
    node: (
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-bold">Branchegallaen {gallaAar}</span>
        <ul className="flex flex-wrap gap-1" aria-label="Nomineringer lige nu">
          {GALA_CATEGORIES.map((c) => {
            const x = nom.find((y) => y.id === c.id);
            const ok = !!x?.nomineret;
            return (
              <li key={c.id}>
                <Chip ikon={ok ? 'flueben' : 'kryds'} farve={ok ? 'var(--color-good)' : 'var(--color-dim)'} titel={ok ? 'Nomineret lige nu' : x?.hint}>
                  {c.navn.replace('Årets ', '')}
                </Chip>
              </li>
            );
          })}
        </ul>
        {gallaAar !== aarNu && <span className="text-xs text-dim">Nomineringerne nulstilles ved årsskiftet.</span>}
      </div>
    ),
  });
  const kv = naesteKvartalsmoede(g.uge);
  punkter.push({
    noegle: 'kvartal',
    uge: g.uge + kv.uger,
    node: (
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold">Kvartalsmøde Q{kv.kvartal}</span>
        <span className="text-xs text-muted">{g.kvartalsmaal.length} mål bliver gjort op</span>
      </div>
    ),
  });
  punkter.sort((a, b) => a.uge - b.uge);
  return (
    <ol className="flex flex-col gap-1.5" data-testid="kalender">
      {punkter.map((p) => (
        <li key={p.noegle} className="flex items-start gap-2 rounded-md border-2 border-line bg-panel p-2 text-sm">
          <span className="flex w-14 shrink-0 flex-col items-center rounded border-2 border-line bg-bg px-1 py-0.5 text-center">
            <span className="tal font-pixel text-sm font-black text-gold">{p.uge - g.uge}</span>
            <span className="text-[0.66rem] uppercase text-muted">uger</span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[0.66rem] uppercase tracking-wide text-dim">{datoTekst(p.uge)}</span>
            {p.node}
          </span>
        </li>
      ))}
    </ol>
  );
}

// ---------- Trofæer ----------

function Trofaeer({ g }: { g: GameState }) {
  const sejre = g.galla.filter((r) => r.vundet.length > 0);
  const egne = g.produkter.filter((p) => p.ejer === 'spiller');
  const kuponer = egne.filter((p) => p.guldkupon);
  const hof = egne.filter((p) => p.hallOfFame);
  if (sejre.length === 0 && kuponer.length === 0) {
    return <Tom>Hylden er tom — endnu. Guldkuponer, Hall of Fame og gallapriser ender her.</Tom>;
  }
  return (
    <div className="grid grid-cols-1 gap-2 @xl:grid-cols-3">
      <div className="rounded-md border-2 border-line bg-panel p-2">
        <div className="mb-1 flex items-center gap-1.5 font-pixel text-xs font-black uppercase">
          <Ikon navn="trofae" farve="var(--color-gold)" indre="var(--color-line)" str={14} /> Gallapriser
        </div>
        {sejre.length === 0 ? (
          <p className="text-xs text-muted">Ingen endnu.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="gallapriser">
            {sejre.map((r) => (
              <li key={r.aar} className="text-sm">
                <span className="font-pixel font-black text-gold">{r.aar}</span>{' '}
                <span className="text-ink">{r.vundet.map((id) => GALA_CATEGORIES.find((c) => c.id === id)?.navn ?? id).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-md border-2 border-line bg-panel p-2">
        <div className="mb-1 flex items-center justify-between gap-1.5 font-pixel text-xs font-black uppercase">
          <span className="flex items-center gap-1.5">
            <Ikon navn="stjerne" farve="var(--color-gold)" str={14} /> Guldkuponer
          </span>
          <span className="tal text-gold">{kuponer.length}</span>
        </div>
        {kuponer.length === 0 ? (
          <p className="text-xs text-muted">32 point eller mere hos anmelderne.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {kuponer.slice(-6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.navn}</span>
                <span className="tal shrink-0 font-pixel text-xs font-bold text-gold">{p.total40}/40</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-md border-2 border-line bg-panel p-2">
        <div className="mb-1 flex items-center justify-between gap-1.5 font-pixel text-xs font-black uppercase">
          <span className="flex items-center gap-1.5">
            <Ikon navn="krone" farve="var(--color-violet)" indre="var(--color-line)" str={14} /> Hall of Fame
          </span>
          <span className="tal text-violet">{hof.length}</span>
        </div>
        {hof.length === 0 ? (
          <p className="text-xs text-muted">{HALL_OF_FAME_KRAV}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {hof.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{p.navn}</span>
                <span className="tal shrink-0 font-pixel text-xs font-bold text-violet">{p.total40}/40</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CompanyPanel() {
  const g = useGame((s) => s.game)!;
  const [messe, setMesse] = useState<string | null>(null);
  return (
    <Panel titel={g.firmaNavn} ikon="firma" testId="panel-firma">
      <div className="@container flex flex-col gap-3">
        <Hop />
        <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
          <Afsnit id="firma-kontor" titel={`Kontor · ${OFFICE_BY_ID[g.kontor].navn}`} ikon="hus" testId="firma-kontor">
            <Kontor g={g} />
          </Afsnit>
          <Afsnit id="firma-finansiering" titel="Finansiering" ikon="diamant" testId="firma-finansiering">
            <Finansiering g={g} />
          </Afsnit>
          <Afsnit id="firma-oekonomi" titel="Økonomi" ikon="penge" className="@2xl:col-span-2" testId="firma-oekonomi">
            <Oekonomi g={g} />
          </Afsnit>
          <Afsnit id="firma-maal" titel="Kvartalsmål" ikon="stjerne" testId="firma-maal">
            <Kvartalsmaal g={g} />
          </Afsnit>
          <Afsnit id="firma-kalender" titel="Kalender" ikon="kalender" farve="var(--color-sky)" testId="firma-kalender">
            <Kalender g={g} onBook={setMesse} />
          </Afsnit>
          <Afsnit id="firma-forskning" titel="Forskning" ikon="kolbe" farve="var(--color-cyan)" className="@2xl:col-span-2" testId="firma-forskning">
            <Forskning g={g} />
          </Afsnit>
          <Afsnit id="firma-trofaeer" titel="Trofæer" ikon="trofae" className="@2xl:col-span-2" testId="firma-trofaeer">
            <Trofaeer g={g} />
          </Afsnit>
        </div>
      </div>
      {messe && <ExpoDialog signal={{ k: 'messeVarsel', expoId: messe }} onLuk={() => setMesse(null)} />}
    </Panel>
  );
}
