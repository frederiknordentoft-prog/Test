// Konkurrenter (fase 4, spec 6.8): hvem kæmper I mod, hvad gjorde de sidst, og hvordan reagerer de på jer?
// Øverst: opkøbstilbud, reaktioner der rammer jer, featurefordel og sponsorater. Derunder et kort pr. konkurrent
// med monogram, arketype, fem parametre, markeder, bedste produkt, "hvad de gjorde sidst", reaktioner og opkøb.
import { useState } from 'react';
import type { Competitor, GameState, MarketId } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Monogram, Panel, Tom } from '../components/kit';
import { Afsnit, Chip } from '../components/FirmaDele';
import TilbudDialog from '../dialogs/TilbudDialog';
import SponsorDialog from '../dialogs/SponsorDialog';
import { MARKETS } from '../../data/markets';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { REAKTIONS_REGLER } from '../../data/reactionRules';
import { SPONSORATER } from '../../data/competitorEvents';
import { aggressivitet, datoTekst, ejerInfo, featureFordel, konkurrentAarligBsi, opkoebStatus, spillerCacTillaeg } from '../../sim/selectors';
import { mio, mioKort, pct } from '../format';
import { featureNavn } from '../lib/devHjaelp';
import {
  ARKETYPE, EVNER, aktiveReaktioner, andelI, antalAktiveProdukter, bedsteProdukt, bonuskrige, konkurrentStatus, rammerSpilleren,
  reaktionEffekter, sidsteTekst, spillerensMarkeder, tilSalg, udloebTekst, ugerTilbage, SPONSOR_RABAT, REGEL_FORKLARING, opkoebGrund, type EffektLinje,
} from '../lib/konkurrentHjaelp';
import { TONE_FARVE } from '../lib/tvaersHjaelp';
import { rulleKant } from '../hooks/rulleKant';

type Filter = 'jeres' | 'alle' | MarketId;


function EffektChip({ e }: { e: EffektLinje }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border-2 border-line bg-panel px-1.5 py-0.5 text-[0.72rem] font-bold leading-tight" style={{ color: TONE_FARVE[e.tone] }}>
      <Ikon navn={e.ikon} farve={TONE_FARVE[e.tone]} indre="var(--color-line)" str={11} className="shrink-0" />
      <span className="min-w-0">{e.tekst}</span>
    </span>
  );
}

// ---------- Reaktioner ----------

function ReaktionRaekke({ g, r, visKonkurrent }: { g: GameState; r: GameState['reaktioner'][number]; visKonkurrent?: boolean }) {
  const def = REAKTIONS_REGLER[r.regel];
  // Spillervenlig forklaring (datafilens hvis/så er spec-sprog med interne id'er)
  const forkl = REGEL_FORKLARING[r.regel];
  const info = r.competitorId ? ejerInfo(g, r.competitorId) : null;
  const effekter = reaktionEffekter(r);
  return (
    <li className="flex flex-col gap-1 rounded-md border-2 border-line bg-panel px-2 py-1.5" data-testid={`reaktion-${r.id}`}>
      <div className="flex items-start gap-2">
        {visKonkurrent && info && <Monogram tekst={info.monogram} farve={info.farve} str={26} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <span className="flex items-center gap-1.5 font-pixel text-xs font-black uppercase tracking-wide text-ink">
              <span className="rounded border-2 border-line bg-warn px-1 text-[0.62rem] text-line">{r.regel}</span>
              {def.navn}
              {r.marked && <span className="text-muted">· {MARKETS[r.marked].kort}</span>}
            </span>
            <span className="tal flex items-center gap-1 text-[0.7rem] text-muted">
              <Ikon navn="ur" farve="var(--color-muted)" indre="var(--color-line)" str={11} /> {udloebTekst(g, r.slutUge)}
            </span>
          </div>
          <p className="text-sm text-ink">{r.tekst}</p>
        </div>
      </div>
      {effekter.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {effekter.map((e) => (
            <EffektChip key={e.tekst} e={e} />
          ))}
        </div>
      )}
      <p className="flex items-start gap-1 text-xs text-muted">
        <Ikon navn="spoergsmaal" farve="var(--color-cyan)" str={11} className="mt-0.5 shrink-0" />
        <span>
          <b className="text-ink">Hvis</b> {forkl.hvis} — <b className="text-ink">så</b> {forkl.saa}.
        </span>
      </p>
    </li>
  );
}

// ---------- Overblik: jer mod dem ----------

function Overblik({ g, aabnTilbud, aabnSponsor }: { g: GameState; aabnTilbud: () => void; aabnSponsor: () => void }) {
  const t = g.opkoebstilbud;
  const rammer = aktiveReaktioner(g).filter((r) => rammerSpilleren(g, r));
  const krige = bonuskrige(g);
  const fordel = featureFordel(g);
  const features = Object.entries(g.featureFordele).sort((a, b) => b[1].lanceretUge - a[1].lanceretUge);
  const auktion = g.sponsorAuktion;
  const sponsorater = g.sponsorater.filter((sp) => sp.slutUge > g.uge);
  const naesteSponsorat = SPONSORATER.find((sp) => sp.uge - 6 > g.uge);
  const maxCac = Math.max(0, ...krige.map((k) => spillerCacTillaeg(g, k.marked)));

  return (
    <div className="flex flex-col gap-3">
      {t && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-gold/15 p-2.5" data-testid="tilbud-banner">
          <Monogram tekst={ejerInfo(g, t.competitorId).monogram} farve={ejerInfo(g, t.competitorId).farve} str={36} />
          <div className="min-w-0 flex-1">
            <p className="font-pixel text-sm font-black text-ink">
              {ejerInfo(g, t.competitorId).navn} byder <span className="text-gold">{mio(t.pris)}</span> for {g.firmaNavn}
            </p>
            <p className="text-xs text-muted">
              Gælder til {datoTekst(t.udloeberUge)} ({ugerTilbage(g, t.udloeberUge)} uger). Intet svar er et nej.
            </p>
          </div>
          <Btn variant="primaer" onClick={aabnTilbud} testId="se-tilbud">
            <Ikon navn="penge" farve="currentColor" indre="var(--color-gold)" str={14} /> Se tilbuddet
          </Btn>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 @md:gap-2" data-testid="konkurrence-tal">
        <div className="min-w-0 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 @md:px-2.5 @md:py-2" title="Tillæg på jeres kundepris (CAC) fra bonuskrige (R1)">
          <div className="flex items-center gap-1 text-[0.62rem] uppercase leading-tight tracking-wide text-muted @md:text-[0.68rem]">
            <Ikon navn="svaerd" farve={krige.length ? 'var(--color-bad)' : 'var(--color-muted)'} str={12} /> Bonuskrig
          </div>
          <div className="tal font-pixel text-sm font-black @md:text-base" style={{ color: krige.length ? 'var(--color-bad)' : 'var(--color-good)' }} data-testid="bonuskrig-cac">
            {krige.length ? `CAC +${Math.round(maxCac * 100)} %` : 'Fred og ro'}
          </div>
          <div className="text-[0.68rem] leading-tight text-muted @md:text-xs">{krige.length ? krige.map((k) => MARKETS[k.marked].kort).join(', ') : 'Ingen gigant har erklæret krig'}</div>
        </div>
        <div className="min-w-0 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 @md:px-2.5 @md:py-2" title="Unikke features giver flere nye kunder og lidt højere ARPU, indtil de bliver kopieret (R3)">
          <div className="flex items-center gap-1 text-[0.62rem] uppercase leading-tight tracking-wide text-muted @md:text-[0.68rem]">
            <Ikon navn="kolbe" farve="var(--color-cyan)" indre="var(--color-line)" str={12} /> Featurefordel
          </div>
          <div className="tal font-pixel text-sm font-black text-cyan @md:text-base" data-testid="featurefordel">
            +{pct(fordel, 1)}
          </div>
          <div className="text-[0.68rem] leading-tight text-muted @md:text-xs">nye kunder · +{pct(fordel / 2, 1)} ARPU</div>
        </div>
        <div className="min-w-0 rounded-md border-2 border-line bg-bg2 px-2 py-1.5 @md:px-2.5 @md:py-2" title="Sponsorater giver billigere kunder i markedet (R7)">
          <div className="flex items-center gap-1 text-[0.62rem] uppercase leading-tight tracking-wide text-muted @md:text-[0.68rem]">
            <Ikon navn="bold" farve="var(--color-good)" indre="var(--color-line)" str={12} /> Jeres sponsorater
          </div>
          <div className="tal font-pixel text-sm font-black text-ink @md:text-base" data-testid="jeres-sponsorater">
            {sponsorater.filter((sp) => sp.ejer === 'spiller').length}
            <span className="font-sans text-[0.68rem] font-normal text-muted"> af {sponsorater.length} aktive</span>
          </div>
          <div className="text-[0.68rem] leading-tight text-muted @md:text-xs">{auktion ? `Auktion: ${auktion.navn}` : 'Ingen auktion lige nu'}</div>
        </div>
      </div>

      <Afsnit titel="Reaktioner, der påvirker jer" ikon="lyn" farve="var(--color-warn)" testId="reaktioner-jer" hoejre={<span className="tal font-pixel text-xs text-muted">{rammer.length}</span>}>
        {rammer.length === 0 ? (
          <p className="text-sm text-muted">Ingen lige nu. Konkurrenterne holder øje — vokser I hurtigt, skruer de op.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rammer.map((r) => (
              <ReaktionRaekke key={r.id} g={g} r={r} visKonkurrent />
            ))}
          </ul>
        )}
      </Afsnit>

      <Afsnit titel="Featurefordel" ikon="kolbe" farve="var(--color-cyan)" testId="featurefordel-afsnit">
        {features.length === 0 ? (
          <p className="text-sm text-muted">Lancér en feature, ingen andre har (fx fra forskningen), og I får et forspring på op til 15 %. Konkurrenterne kopierer den senere, og hver kopi halverer fordelen.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {features.map(([f, v]) => {
              const kopister = g.planlagteKopier.filter((k) => k.feature === f).length;
              return (
                <li key={f} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <Ikon navn={v.kopier === 0 ? 'stjerne' : 'stjerneTom'} farve="var(--color-cyan)" indre="var(--color-line)" str={13} />
                  <span className="font-bold text-ink">{featureNavn(f)}</span>
                  <span className="text-xs text-muted">
                    {v.kopier === 0 ? 'Kun jer' : `Kopieret ${v.kopier} gang${v.kopier === 1 ? '' : 'e'}`}
                    {kopister > 0 && ` · ${kopister} konkurrent${kopister === 1 ? '' : 'er'} arbejder på en kopi`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Afsnit>

      <Afsnit
        titel="Sponsorater"
        ikon="bold"
        farve="var(--color-good)"
        testId="sponsorater"
        hoejre={
          auktion ? (
            <Btn variant="primaer" lille onClick={aabnSponsor} testId="byd-sponsorat" className="min-h-[44px]">
              <Ikon navn="hammer" farve="currentColor" str={13} /> {auktion.spillerBud !== null ? 'Hæv buddet' : 'Byd'}
            </Btn>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          {auktion && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-line bg-panel px-2 py-1.5" data-testid="sponsor-auktion">
              <Ikon navn="hammer" farve="var(--color-gold)" str={16} />
              <div className="min-w-0 flex-1 text-sm">
                <b className="text-ink">{auktion.navn}</b> <span className="text-muted">({MARKETS[auktion.marked].navn})</span> afgøres {datoTekst(auktion.afgoeresUge)}. Mindstebud{' '}
                <span className="tal text-gold">{mio(auktion.mindstebud)}/år</span>
                {auktion.spillerBud !== null && (
                  <>
                    {' '}
                    · jeres bud <span className="tal font-bold text-gold">{mio(auktion.spillerBud)}/år</span>
                  </>
                )}
                .
              </div>
            </div>
          )}
          {sponsorater.length === 0 && !auktion ? (
            <p className="text-sm text-muted">
              Ingen store sponsorater lige nu.{naesteSponsorat ? ` Næste auktion (${naesteSponsorat.navn}) kommer i ${datoTekst(naesteSponsorat.uge - 6)}.` : ''} Vinder I et, bliver kunderne {Math.round(SPONSOR_RABAT * 100)} % billigere via sponsorat og tv i markedet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sponsorater.map((sp) => {
                const info = ejerInfo(g, sp.ejer);
                const jeres = sp.ejer === 'spiller';
                return (
                  <li key={sp.id + sp.slutUge} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`sponsorat-${sp.id}`}>
                    <Monogram tekst={info.monogram} farve={info.farve} str={24} />
                    <span className="min-w-0 flex-1">
                      <b className="text-ink">{sp.navn}</b> <span className="text-muted">({MARKETS[sp.marked].kort})</span> · {jeres ? <b className="text-gold">jeres</b> : info.navn}
                    </span>
                    <span className="tal text-xs text-muted">
                      {mioKort(sp.bud)}/år · til {datoTekst(sp.slutUge)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Afsnit>
    </div>
  );
}

// ---------- Konkurrentkort ----------

function Evne({ navn, kort, ikon, farve, v, boost }: { navn: string; kort: string; ikon: string; farve: string; v: number; boost?: number }) {
  const vis = String(Math.round(v * 10) / 10).replace('.', ',');
  return (
    <div className="flex min-w-0 items-center gap-1.5" title={`${navn}: ${vis} af 5${boost ? ` (+${boost} efter afvist tilbud)` : ''}`}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={12} className="shrink-0" />
      <span className="w-12 shrink-0 font-pixel text-[0.64rem] font-bold uppercase text-muted">{kort}</span>
      <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
        <span className="block h-full" style={{ width: `${Math.min(1, v / 5) * 100}%`, background: farve }} />
      </span>
      <span className="tal w-7 shrink-0 text-right font-pixel text-xs font-bold text-ink">
        {vis}
        {boost ? <span className="text-bad">↑</span> : null}
      </span>
    </div>
  );
}

function KonkurrentKort({ g, c }: { g: GameState; c: Competitor }) {
  const [bekraeft, setBekraeft] = useState(false);
  const info = ejerInfo(g, c.id);
  const ark = ARKETYPE[c.arketype];
  const status = konkurrentStatus(g, c);
  const bedst = bedsteProdukt(g, c.id);
  const reaktioner = aktiveReaktioner(g, c.id);
  const st = opkoebStatus(g, c);
  const grund = opkoebGrund(g, st);
  const aggr = aggressivitet(g, c);
  const antal = antalAktiveProdukter(g, c.id);
  const bsi = konkurrentAarligBsi(g, c);
  const salg = tilSalg(c);

  const koeb = () => {
    if (!bekraeft) {
      setBekraeft(true);
      return;
    }
    setBekraeft(false);
    useGame.getState().dispatch({ t: 'acquire', competitorId: c.id });
  };

  return (
    <article className="@container flex min-w-0 flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid={`konkurrent-${c.id}`}>
      <header className="flex items-start gap-2.5">
        <Monogram tekst={info.monogram} farve={info.farve} str={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-pixel text-sm font-black text-ink">{c.navn}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1">
            <Chip ikon={ark.ikon} titel={ark.tekst}>
              {ark.navn}
            </Chip>
            {status.kind !== 'aktiv' && (
              <Chip ikon={status.ikon} farve={status.farve}>
                {status.tekst}
              </Chip>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[0.62rem] uppercase text-muted">BSI/år</div>
          <div className="tal font-pixel text-sm font-black text-gold">{mioKort(bsi)}</div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-x-3 gap-y-0.5 @[19rem]:grid-cols-2">
        {EVNER.map((e) => (
          <Evne
            key={e.id}
            navn={e.navn}
            kort={e.kort}
            ikon={e.ikon}
            farve={e.farve}
            v={e.id === 'aggressivitet' ? aggr : c[e.id]}
            boost={e.id === 'aggressivitet' && aggr > c.aggressivitet ? aggr - c.aggressivitet : undefined}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1" aria-label="Markeder">
        <Ikon navn="globus" farve="var(--color-sky)" indre="var(--color-line)" str={12} />
        {c.markeder.map((m) => {
          const ms = g.markeder[m];
          const andel = ms.andele[c.id] ?? 0;
          return (
            <span
              key={m}
              title={ms.aaben ? `${MARKETS[m].navn}: ${pct(andel, 1)} af markedet` : `${MARKETS[m].navn} er ikke åbnet endnu`}
              className={`tal inline-flex items-center gap-1 rounded border-2 border-line px-1 py-0.5 font-pixel text-[0.66rem] font-bold ${ms.aaben ? 'bg-panel text-ink' : 'bg-bg text-dim'}`}
            >
              {!ms.aaben && <Ikon navn="laas" farve="var(--color-dim)" str={9} />}
              {MARKETS[m].kort}
              {ms.aaben && andel > 0.0005 && <span className="text-sky">{pct(andel, andel < 0.1 ? 1 : 0)}</span>}
            </span>
          );
        })}
      </div>

      <div className="flex min-w-0 items-start gap-1.5 text-sm" data-testid={`konkurrent-bedste-${c.id}`}>
        <Ikon navn="stjerne" farve="var(--color-gold)" indre="var(--color-line)" str={13} className="mt-0.5 shrink-0" />
        {bedst ? (
          <span className="min-w-0">
            <b className="text-ink">{bedst.navn}</b>{' '}
            <span className="text-muted">
              ({PRODUCT_TYPES[bedst.typeId].navn}, {bedst.markeder.map((m) => MARKETS[m].kort).join('/')})
            </span>{' '}
            <span className="tal font-pixel font-black" style={{ color: bedst.total40 >= 32 ? 'var(--color-gold)' : bedst.total40 >= 24 ? 'var(--color-good)' : 'var(--color-ink)' }}>
              {bedst.total40}/40
            </span>
            {antal > 1 && <span className="text-xs text-muted"> · {antal} produkter i alt</span>}
          </span>
        ) : (
          <span className="text-muted">Ingen aktive produkter.</span>
        )}
      </div>

      <p className="flex min-w-0 items-start gap-1.5 rounded border-2 border-line bg-panel px-2 py-1 text-sm" data-testid={`konkurrent-sidst-${c.id}`}>
        <Ikon navn="nyhed" farve="var(--color-warn)" indre="var(--color-line)" str={13} className="mt-0.5 shrink-0" />
        <span className="min-w-0">
          <span className="font-pixel text-[0.64rem] font-black uppercase text-muted">Sidst: </span>
          <span className="text-ink">{sidsteTekst(g, c)}</span>
        </span>
      </p>

      {reaktioner.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Aktive reaktioner">
          {reaktioner.map((r) => (
            <ReaktionRaekke key={r.id} g={g} r={r} />
          ))}
        </ul>
      )}

      {status.kind === 'aktiv' || status.kind === 'ejet' ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Btn variant={bekraeft ? 'god' : 'sekundaer'} disabled={!st.ok} onClick={koeb} testId={`koeb-${c.id}`} title={grund}>
            <Ikon navn={salg ? 'penge' : 'laas'} farve={st.ok ? 'var(--color-gold)' : 'currentColor'} indre="var(--color-line)" str={14} />
            {bekraeft ? `Ja, køb for ${mio(st.pris)}` : salg ? `Køb · ${mio(st.pris)}` : 'Ikke til salg'}
          </Btn>
          {bekraeft && (
            <Btn variant="ghost" onClick={() => setBekraeft(false)} testId={`koeb-fortryd-${c.id}`}>
              Fortryd
            </Btn>
          )}
          <span className="flex min-w-0 flex-1 basis-40 items-start gap-1 text-xs text-muted" data-testid={`koeb-grund-${c.id}`}>
            <Ikon navn={st.ok ? 'flueben' : 'laas'} farve={st.ok ? 'var(--color-good)' : 'var(--color-muted)'} str={11} className="mt-0.5 shrink-0" />
            {st.ok ? 'Produkter, licenser og 80 % af kunderne følger med.' : grund}
          </span>
        </div>
      ) : null}
    </article>
  );
}

// ---------- Panelet ----------

export default function CompetitorPanel() {
  const g = useGame((s) => s.game);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [tilbudAaben, setTilbudAaben] = useState(false);
  const [sponsorAaben, setSponsorAaben] = useState(false);
  if (!g) return null;

  const jeres = spillerensMarkeder(g);
  const valgt: Filter = filter ?? (jeres.length ? 'jeres' : 'alle');
  const aabne = (Object.keys(g.markeder) as MarketId[]).filter((m) => g.markeder[m].aaben && g.konkurrenter.some((c) => c.tilstede && c.markeder.includes(m)));
  const synlige = g.konkurrenter.filter((c) => konkurrentStatus(g, c).kind !== 'kommer');
  const i = (m: MarketId) => (c: Competitor) => c.markeder.includes(m);
  const iFilter = (c: Competitor) => (valgt === 'alle' ? true : valgt === 'jeres' ? jeres.some((m) => c.markeder.includes(m)) : i(valgt)(c));
  const aktive = synlige.filter((c) => c.tilstede);
  const maalMarkeder = valgt === 'alle' ? aabne : valgt === 'jeres' ? jeres : [valgt];
  const liste = aktive.filter(iFilter).sort((a, b) => andelI(g, b, maalMarkeder) - andelI(g, a, maalMarkeder) || b.styrke - a.styrke);
  const ude = synlige.filter((c) => !c.tilstede);

  const filtre: { id: Filter; navn: string; antal: number }[] = [
    ...(jeres.length ? [{ id: 'jeres' as Filter, navn: 'Jeres markeder', antal: aktive.filter((c) => jeres.some((m) => c.markeder.includes(m))).length }] : []),
    { id: 'alle', navn: 'Alle', antal: aktive.length },
    ...aabne.map((m) => ({ id: m as Filter, navn: MARKETS[m].kort, antal: aktive.filter(i(m)).length })),
  ];

  return (
    <Panel titel="Konkurrenter" ikon="svaerd" testId="panel-konkurrenter" hoejre={<span className="font-pixel text-xs text-muted">{aktive.length} aktive</span>}>
      <div className="@container flex flex-col gap-3">
        <Overblik g={g} aabnTilbud={() => setTilbudAaben(true)} aabnSponsor={() => setSponsorAaben(true)} />

        <div ref={rulleKant} className="shell-uden-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="Filtrér konkurrenter efter marked">
          {filtre.map((f) => {
            const aktiv = valgt === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={aktiv}
                data-testid={`konkurrentfilter-${f.id}`}
                onClick={() => setFilter(f.id)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-2 border-line px-3 text-sm font-bold ${
                  aktiv ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:text-ink'
                }`}
              >
                {f.id === 'jeres' && <Ikon navn="flueben" farve={aktiv ? 'var(--color-line)' : 'var(--color-good)'} str={12} />}
                {f.navn}
                <span className={`tal font-pixel text-[0.65rem] ${aktiv ? 'text-line/70' : 'text-dim'}`}>{f.antal}</span>
              </button>
            );
          })}
        </div>

        {liste.length === 0 ? (
          <Tom>Ingen konkurrenter her. Nyd stilheden — den varer sjældent længe.</Tom>
        ) : (
          // Spalter i stedet for et rækkejusteret grid: kortene er forskellige i højden, så rækker giver store huller
          <div className="columns-1 gap-2 @2xl:columns-2" data-testid="konkurrentliste">
            {liste.map((c) => (
              <div key={c.id} className="mb-2 break-inside-avoid">
                <KonkurrentKort g={g} c={c} />
              </div>
            ))}
          </div>
        )}

        {ude.length > 0 && (
          <details className="rounded-md border-2 border-line bg-bg2" data-testid="konkurrenter-ude">
            <summary className="flex min-h-[44px] cursor-pointer items-center gap-1.5 px-2.5 font-pixel text-xs font-black uppercase tracking-wider text-muted hover:text-ink">
              <Ikon navn="doer" farve="var(--color-muted)" indre="var(--color-line)" str={13} /> Ude af spillet ({ude.length})
            </summary>
            <ul className="flex flex-col gap-1 px-2.5 pb-2.5">
              {ude.map((c) => {
                const inf = ejerInfo(g, c.id);
                const st = konkurrentStatus(g, c);
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`konkurrent-ude-${c.id}`}>
                    <Monogram tekst={inf.monogram} farve={inf.farve} str={24} />
                    <b className="text-ink">{c.navn}</b>
                    <Chip ikon={st.ikon} farve={st.farve}>
                      {st.tekst}
                    </Chip>
                    <span className="basis-full text-xs text-muted">{c.sidsteHandling}</span>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>

      {tilbudAaben && g.opkoebstilbud && (
        <TilbudDialog signal={{ k: 'tilbud', competitorId: g.opkoebstilbud.competitorId, pris: g.opkoebstilbud.pris }} onLuk={() => setTilbudAaben(false)} />
      )}
      {sponsorAaben && g.sponsorAuktion && (
        <SponsorDialog signal={{ k: 'sponsorAuktion', navn: g.sponsorAuktion.navn, marked: g.sponsorAuktion.marked }} onLuk={() => setSponsorAaben(false)} />
      )}
    </Panel>
  );
}
