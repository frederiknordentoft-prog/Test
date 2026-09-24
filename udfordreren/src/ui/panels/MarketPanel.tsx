// Marked: Danmark som "konsolkort" (størrelse, afgift, strenghed, kanalisering), markedsandele, licenser,
// marketingmix, bonus/VIP, tilsynstillid og de øvrige (låste) markeder.
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { AcqChannel, GameState, Vertical } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Monogram, Panel, Tip, type IkonNavn } from '../components/kit';
import { Afsnit, Chip, Donut, FlagStribe, Maaler, Maengde, Pips, Segment, type DonutDel } from '../components/FirmaDele';
import { MARKETS, MARKET_IDS } from '../../data/markets';
import { VERTICALS } from '../../data/verticals';
import { CHANNELS, CHANNEL_IDS, type ChannelDef } from '../../data/acquisition';
import { BONUS_CHURN, BONUS_PCT, BONUS_TILGANG, VIP_ARPU, VIP_PCT } from '../../data/costs';
import { TRUST } from '../../data/trust';
import { BALANCE } from '../../data/balance';
import { OFFSHORE_AKTOER } from '../../data/competitors';
import { effektivCac, kanalTilgaengelig, markedsBsiBasis } from '../../sim/customers';
import { MAX_MARKETING_PR_KANAL } from '../../sim/actions';
import { ejerInfo } from '../../sim/competitors';
import { licensPris } from '../../sim/markets';
import { tillidsPoster } from '../../sim/trust';
import { mio, heltal } from '../format';
import { kanalKunderPrUge, naesteKvartalsmoede, procent, rensNote, tillidFarve, uger } from '../lib/firmaHjaelp';

const VERTIKALER: Vertical[] = ['betting', 'kasino'];
const OEVRIGE = { navn: 'Øvrige licenserede', farve: '#4a5282', monogram: '+' };

const RISIKO: Record<ChannelDef['risiko'], { farve: string; ikon: IkonNavn; navn: string }> = {
  lav: { farve: 'var(--color-good)', ikon: 'skjold', navn: 'Lav risiko' },
  middel: { farve: 'var(--color-sky)', ikon: 'streg', navn: 'Middel risiko' },
  'middel-høj': { farve: 'var(--color-warn)', ikon: 'advarsel', navn: 'Middel-høj risiko' },
  høj: { farve: 'var(--color-bad)', ikon: 'advarsel', navn: 'Høj risiko' },
};

const tkr = (v: number) => `${heltal(v * 1000)} t. kr.`;
const fmtTal = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

// ---------- Konsolkortet ----------

function Nogletal({ label, children, titel }: { label: string; children: ReactNode; titel?: string }) {
  return (
    <div className="min-w-0 rounded border-2 border-line bg-panel px-2 py-1.5" title={titel}>
      <div className="truncate text-[0.66rem] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 min-w-0">{children}</div>
    </div>
  );
}

function Konsolkort({ g }: { g: GameState }) {
  const def = MARKETS.dk;
  const ms = g.markeder.dk;
  const afgiftEns = ms.afgiftPrVertikal.betting === ms.afgiftPrVertikal.kasino;
  return (
    <section className="overflow-hidden rounded-lg border-2 border-line bg-bg2 pixel-skygge" data-testid="konsol-dk">
      <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
      <div className="flex flex-col gap-2.5 p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded border-2 border-line bg-panel2 px-1.5 py-0.5 font-pixel text-sm font-black text-ink">{def.kort}</span>
            <div className="min-w-0">
              <h3 className="font-pixel text-base font-black uppercase leading-none tracking-wide">{def.navn}</h3>
              <p className="flex items-center gap-1 text-xs text-muted">
                <Ikon navn="skjold" farve="var(--color-muted)" indre="var(--color-line)" str={11} /> {def.tilsyn}
              </p>
            </div>
          </div>
          <Chip ikon={ms.licens === 'aktiv' ? 'flueben' : 'ur'} farve={ms.licens === 'aktiv' ? 'var(--color-good)' : 'var(--color-warn)'}>
            {ms.licens === 'aktiv' ? 'Licens aktiv' : ms.licens === 'ansoegt' ? 'Licens behandles' : 'Ingen licens'}
          </Chip>
        </div>
        <p className="text-xs text-dim">{def.beskrivelse}</p>
        <div className="grid grid-cols-2 gap-1.5 @xl:grid-cols-4">
          {VERTIKALER.map((v) => (
            <Nogletal key={v} label={`Marked · ${VERTICALS[v].kort}`} titel="Hele markedets licenserede online-BSI pr. år">
              <span className="tal font-pixel text-sm font-bold text-gold">{mio(markedsBsiBasis('dk', v, g.uge) * 52)}</span>
              <span className="text-[0.66rem] text-dim">/år</span>
            </Nogletal>
          ))}
          <Nogletal label="Afgift af BSI">
            <span className="tal font-pixel text-sm font-bold text-ink">
              {afgiftEns ? procent(ms.afgiftPrVertikal.betting) : `${procent(ms.afgiftPrVertikal.betting)} / ${procent(ms.afgiftPrVertikal.kasino)}`}
            </span>
          </Nogletal>
          <Nogletal label="Kanalisering" titel="Andel af spillet, der foregår hos licenserede udbydere">
            <span className="tal font-pixel text-sm font-bold text-ink">{procent(ms.kanalisering, 1)}</span>
          </Nogletal>
          <Nogletal label={`Strenghed ${fmtTal(ms.strenghed)}/5`} titel="Regler for bonus, grænser, reklame og KYC">
            <Pips vaerdi={ms.strenghed} label="Strenghed" />
          </Nogletal>
          {VERTIKALER.map((v) => (
            <Nogletal key={v} label={`Jeres kunder · ${VERTICALS[v].kort}`}>
              <Maengde ikon="folk" farve="var(--color-sky)" className="text-sm">
                {heltal(ms.spillerKunder[v])}
              </Maengde>
            </Nogletal>
          ))}
          <Nogletal label="Jeres BSI/uge">
            <Maengde ikon="penge" farve="var(--color-gold)" className="text-sm">
              {mio(ms.spillerBsiPrUge.betting + ms.spillerBsiPrUge.kasino)}
            </Maengde>
          </Nogletal>
        </div>
      </div>
    </section>
  );
}

// ---------- Markedsandele ----------

function Andele({ g }: { g: GameState }) {
  const andele = g.markeder.dk.andele;
  const noegler = Object.keys(andele);
  if (noegler.length === 0) {
    return <p className="text-sm text-muted">Andelene tælles op efter den første uge.</p>;
  }
  const konk = noegler.filter((k) => k !== 'spiller' && k !== 'offshore' && k !== 'oevrige').sort((a, b) => (andele[b] ?? 0) - (andele[a] ?? 0));
  const raekke = ['spiller', ...konk, 'oevrige', 'offshore'].filter((k) => andele[k] !== undefined);
  const info = (k: string) => (k === 'offshore' ? OFFSHORE_AKTOER : k === 'oevrige' ? OEVRIGE : ejerInfo(g, k));
  const dele: DonutDel[] = raekke.map((k) => ({ id: k, navn: k === 'offshore' ? `${info(k).navn} (offshore)` : info(k).navn, andel: andele[k] ?? 0, farve: info(k).farve }));
  const spiller = andele.spiller ?? 0;
  return (
    <div className="flex flex-col items-center gap-3 @md:flex-row @md:items-start">
      <Donut
        dele={dele}
        str={148}
        midte={
          <>
            <span className="tal font-pixel text-lg font-black text-gold">{procent(spiller, 1)}</span>
            <span className="text-[0.62rem] uppercase text-muted">jeres andel</span>
          </>
        }
      />
      <ul className="grid w-full min-w-0 flex-1 grid-cols-1 gap-1 @lg:grid-cols-2" data-testid="andele-forklaring">
        {raekke.map((k) => {
          const i = info(k);
          return (
            <li key={k} className={`flex min-h-9 items-center gap-2 rounded border-2 px-1.5 py-1 ${k === 'spiller' ? 'border-gold bg-panel' : 'border-line bg-panel'}`}>
              <Monogram tekst={i.monogram} farve={i.farve} str={24} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {i.navn}
                {k === 'offshore' && <span className="text-dim"> · offshore</span>}
              </span>
              <span className="tal shrink-0 font-pixel text-xs font-bold">{procent(andele[k] ?? 0, 1)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Licenser ----------

function Licenser({ g }: { g: GameState }) {
  const ms = g.markeder.dk;
  const pris = licensPris(g, 'dk');
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
        {VERTIKALER.map((v) => {
          const vl = ms.vertikaler[v];
          const tilbage = vl.status === 'ansoegt' && vl.klarUge !== null ? Math.max(0, vl.klarUge - g.uge) : 0;
          const raad = g.kapital >= pris.gebyr;
          return (
            <div key={v} className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid={`licens-${v}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-pixel text-sm font-black">
                  <span className="h-3 w-3 rounded-sm border-2 border-line" style={{ background: VERTICALS[v].farve }} aria-hidden />
                  {VERTICALS[v].navn}
                </span>
                {vl.status === 'aktiv' && (
                  <Chip ikon="flueben" farve="var(--color-good)" fyld>
                    Aktiv
                  </Chip>
                )}
                {vl.status === 'ansoegt' && (
                  <Chip ikon="ur" farve="var(--color-warn)">
                    {uger(tilbage)} tilbage
                  </Chip>
                )}
                {vl.status === 'ingen' && (
                  <Chip ikon="laas" farve="var(--color-muted)">
                    Ingen licens
                  </Chip>
                )}
              </div>
              {vl.status === 'ingen' && (
                <>
                  <p className="text-xs text-muted">{VERTICALS[v].beskrivelse}</p>
                  <Btn
                    variant="primaer"
                    disabled={!raad}
                    title={raad ? undefined : `Ikke råd (${mio(pris.gebyr)})`}
                    testId={`soeg-licens-${v}`}
                    onClick={() => {
                      if (useGame.getState().dispatch({ t: 'applyLicense', market: 'dk', vertical: v })) useGame.getState().toast(`Ansøgning sendt til ${MARKETS.dk.tilsyn}!`, 'godt');
                    }}
                  >
                    <Ikon navn="noegle" farve="currentColor" indre="var(--color-gold)" str={14} /> Søg licens · {mio(pris.gebyr)} · {uger(pris.uger)}
                  </Btn>
                </>
              )}
              {vl.status === 'ansoegt' && (
                <span className="h-2.5 overflow-hidden rounded-sm border border-line bg-bg" aria-hidden>
                  <span className="block h-full bg-warn" style={{ width: `${Math.max(4, 100 - (tilbage / Math.max(1, pris.uger)) * 100)}%` }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {VERTIKALER.some((v) => ms.vertikaler[v].status !== 'aktiv') && (
        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Ikon navn="folk" farve="var(--color-sky)" indre="var(--color-line)" str={12} className="mt-0.5 shrink-0" />
          Kryds-salg: den første lancering i en ny vertikal tager {Math.round(BALANCE.krydsSalgStart * 100)} % af jeres eksisterende kunder med over.
        </p>
      )}
    </div>
  );
}

// ---------- Marketingmix ----------

function KanalRaekke({ g, k }: { g: GameState; k: AcqChannel }) {
  const def = CHANNELS[k];
  const [kladde, setKladde] = useState<string | null>(null);
  const nu = g.marketingMix[k] ?? 0;
  const aaben = kanalTilgaengelig(g, k);
  const cac = effektivCac(g, k, 'dk');
  const nye = kanalKunderPrUge(g, k, nu);
  const r = RISIKO[def.risiko];
  const note = rensNote(def.note);
  const saet = (v: number) => {
    const ny = Math.max(0, Math.min(MAX_MARKETING_PR_KANAL, Math.round(v * 1000) / 1000));
    if (Math.abs(ny - nu) < 1e-9) return;
    useGame.getState().dispatch({ t: 'setMarketing', channel: k, prUge: ny });
  };
  const gem = () => {
    if (kladde === null) return;
    const v = Number(kladde.replace(',', '.'));
    if (Number.isFinite(v)) saet(v / 1000);
    setKladde(null);
  };
  const tast = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') setKladde(null);
  };

  return (
    <li className={`@container flex flex-col gap-1.5 rounded-md border-2 border-line p-2 ${nu > 0 ? 'bg-panel' : 'bg-bg2'}`} data-testid={`kanal-${k}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-pixel text-sm font-black">{def.navn}</span>
        <Chip ikon={r.ikon} farve={r.farve}>
          {r.navn}
        </Chip>
        {def.aggressiv && (
          <Chip ikon="skjold" farve="var(--color-warn)" titel="Aggressive kanaler koster tilsynstillid, når de er i brug">
            {fmtTal(TRUST.aggressivKanal)} tillid/kvartal
          </Chip>
        )}
        <span className="ml-auto flex items-center gap-2 text-xs">
          {cac === null ? (
            <span className="text-muted">Fastholdelse</span>
          ) : (
            <span className="text-muted" title="Pris pr. ny indbetalende kunde i Danmark lige nu">
              CAC <b className="tal font-pixel text-ink">{heltal(cac)} kr.</b>
            </span>
          )}
        </span>
      </div>
      {!aaben ? (
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <Ikon navn="laas" farve="var(--color-dim)" str={14} className="shrink-0" /> Åbner fra {def.fraAar}.{note && note !== '–' ? ` ${note.replace(/^Fra \d{4},\s*/, '').replace(/^./, (c) => c.toUpperCase())}` : ''}
        </p>
      ) : (
        <>
          {note && note !== '–' && <p className="text-xs text-dim">{note}</p>}
          <div className="grid grid-cols-4 items-center gap-1 @md:grid-cols-[auto_auto_auto_minmax(5rem,1fr)_auto_auto]">
            <Btn lille className="order-first min-h-[44px] min-w-[44px] px-1.5 @md:order-none" onClick={() => saet(0)} disabled={nu <= 0} testId={`kanal-${k}-nul`} ariaLabel={`${def.navn}: sæt til 0`}>
              0
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu - 0.1)} disabled={nu <= 0} testId={`kanal-${k}-minus100`} ariaLabel={`${def.navn}: −100 t. kr.`}>
              −100
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu - 0.01)} disabled={nu <= 0} testId={`kanal-${k}-minus10`} ariaLabel={`${def.navn}: −10 t. kr.`}>
              −10
            </Btn>
            <label className="relative order-first col-span-3 flex min-w-0 items-center @md:order-none @md:col-span-1">
              <span className="sr-only">{def.navn}: ugentligt forbrug i tusind kroner</span>
              <input
                type="text"
                inputMode="numeric"
                data-testid={`kanal-${k}-felt`}
                value={kladde ?? String(Math.round(nu * 1000))}
                onChange={(e) => setKladde(e.target.value.replace(/[^\d,.]/g, ''))}
                onBlur={gem}
                onKeyDown={tast}
                className="tal h-[44px] w-full min-w-0 rounded-md border-2 border-line bg-bg pr-7 pl-2 text-right font-pixel text-sm font-bold text-gold outline-none focus:border-gold"
              />
              <span className="pointer-events-none absolute right-1.5 text-[0.62rem] font-bold text-dim">t.kr</span>
            </label>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu + 0.01)} testId={`kanal-${k}-plus10`} ariaLabel={`${def.navn}: +10 t. kr.`}>
              +10
            </Btn>
            <Btn lille className="min-h-[44px] min-w-[44px] px-1" onClick={() => saet(nu + 0.1)} testId={`kanal-${k}-plus100`} ariaLabel={`${def.navn}: +100 t. kr.`}>
              +100
            </Btn>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
            {k === 'crm' ? (
              <span>Sænker churn hos eksisterende kunder (op til −35 %).</span>
            ) : (
              <span>
                {nu > 0 ? (
                  <>
                    ≈ <b className="tal text-sky">{heltal(nye)}</b> nye kunder/uge
                  </>
                ) : (
                  'Slukket'
                )}
              </span>
            )}
            {def.hype > 0 && nu * def.hype >= 0.05 && <span className="text-pink">+{fmtTal(Math.min(4, nu * def.hype))} hype/uge</span>}
            <span className="text-dim">Halv effekt ved ca. {tkr(def.maetning)}/uge</span>
          </div>
        </>
      )}
    </li>
  );
}

function Marketing({ g }: { g: GameState }) {
  const total = CHANNEL_IDS.reduce((a, k) => a + (kanalTilgaengelig(g, k) ? (g.marketingMix[k] ?? 0) : 0), 0);
  const nye = CHANNEL_IDS.reduce((a, k) => a + kanalKunderPrUge(g, k, g.marketingMix[k] ?? 0), 0);
  const licens = g.markeder.dk.licens === 'aktiv';
  const harProdukter = g.produkter.some((p) => p.ejer === 'spiller' && p.aktiv);
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border-2 border-line bg-bg2 px-3 py-2 text-sm" data-testid="marketing-forklaring">
        <p className="flex items-center gap-1.5 font-pixel text-xs font-bold uppercase tracking-wide text-sky">
          <Ikon navn="folk" farve="var(--color-sky)" str={14} /> Sådan får I kunder
        </p>
        <p className="mt-1 text-muted">
          Et lanceret produkt trækker nogle kunder af sig selv (hype, anmeldelser, Top 10). Marketing køber flere: hver kanal har en pris pr. ny kunde
          (CAC), og effekten flader ud, jo mere I bruger. Kunderne giver BSI hver uge, men nogle smutter igen — så start småt, og se, om{' '}
          <b className="text-ink">≈ kunder/uge</b> kan betale sig.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-2 border-line bg-panel px-2 py-1.5 text-sm">
        <span className="text-muted">I alt</span>
        <Maengde ikon="penge" farve="var(--color-gold)">{mio(total)}/uge</Maengde>
        <Maengde ikon="folk" farve="var(--color-sky)">≈ {heltal(nye)} kunder/uge</Maengde>
      </div>
      {total > 0 && (!licens || !harProdukter) && (
        <p className="flex items-start gap-1.5 rounded-md border-2 border-line bg-panel p-2 text-sm text-warn" data-testid="marketing-advarsel">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
          {!licens ? 'Licensen er ikke aktiv endnu. Marketing koster, men giver ingen kunder, før den er godkendt.' : 'Uden et lanceret produkt giver marketing ingen nye kunder.'}
        </p>
      )}
      <ul className="flex flex-col gap-1.5">
        {CHANNEL_IDS.map((k) => (
          <KanalRaekke key={k} g={g} k={k} />
        ))}
      </ul>
    </div>
  );
}

// ---------- Bonus og VIP ----------

function BonusVip({ g }: { g: GameState }) {
  const bsi = g.regnskab.bsi;
  const b = g.bonusNiveau;
  const v = g.vipProgram;
  const niveauer = [0, 1, 2, 3] as const;
  return (
    <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs font-black uppercase">Velkomstbonus</span>
          <span className="text-xs text-muted">Niveau {b}</span>
        </div>
        <Segment
          label="Bonusniveau"
          valg={niveauer.map((n) => ({ id: n, navn: n === 0 ? 'Fra' : n, titel: `Niveau ${n}: ${procent(BONUS_PCT[n])} af BSI` }))}
          vaerdi={b}
          onSkift={(n) => useGame.getState().dispatch({ t: 'setBonus', niveau: n })}
          testIdPrefix="bonus"
        />
        <div className="flex flex-wrap gap-1" data-testid="bonus-effekt">
          {b === 0 ? (
            <span className="text-xs text-muted">Ingen bonus. Kunderne kommer for produkterne.</span>
          ) : (
            <>
              <Chip ikon="folk" farve="var(--color-good)">+{Math.round(BONUS_TILGANG[b] * 100)} % tilgang</Chip>
              <Chip ikon="folk" farve="var(--color-good)">{Math.round(BONUS_CHURN[b] * 100)} % churn</Chip>
              <Chip ikon="penge" farve="var(--color-bad)">
                {procent(BONUS_PCT[b])} af BSI{bsi > 0 ? ` ≈ ${mio(bsi * BONUS_PCT[b])}/uge` : ''}
              </Chip>
              <Chip ikon="skjold" farve="var(--color-bad)">{fmtTal(TRUST.bonusNiveau * b)} tillid/kvartal</Chip>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-xs font-black uppercase">VIP-program</span>
          <span className="text-xs text-muted">Niveau {v}</span>
        </div>
        <Segment
          label="VIP-niveau"
          valg={niveauer.map((n) => ({ id: n, navn: n === 0 ? 'Fra' : n, titel: `Niveau ${n}: ${procent(VIP_PCT[n])} af BSI` }))}
          vaerdi={v}
          onSkift={(n) => useGame.getState().dispatch({ t: 'setVip', niveau: n })}
          testIdPrefix="vip"
        />
        <div className="flex flex-wrap gap-1" data-testid="vip-effekt">
          {v === 0 ? (
            <span className="text-xs text-muted">Intet VIP-program. Alle kunder behandles ens.</span>
          ) : (
            <>
              <Chip ikon="diamant" farve="var(--color-good)">+{Math.round(VIP_ARPU[v] * 100)} % BSI pr. kunde</Chip>
              <Chip ikon="penge" farve="var(--color-bad)">
                {procent(VIP_PCT[v])} af BSI{bsi > 0 ? ` ≈ ${mio(bsi * VIP_PCT[v])}/uge` : ''}
              </Chip>
              <Chip ikon="skjold" farve="var(--color-bad)">{fmtTal(TRUST.vipProgram * v)} tillid/kvartal</Chip>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Tilsynstillid ----------

function Tillid({ g }: { g: GameState }) {
  const ms = g.markeder.dk;
  const t = ms.tilsynstillid;
  const farve = tillidFarve(t);
  const poster = tillidsPoster(g, 'dk');
  const sum = poster.reduce((a, p) => a + p.vaerdi, 0);
  const kv = naesteKvartalsmoede(g.uge);
  return (
    <div className="flex flex-col items-center gap-3 @md:flex-row @md:items-start">
      <Maaler vaerdi={t} farve={farve} str={150}>
        <span className="flex items-center gap-1">
          <Ikon navn={t >= 60 ? 'skjold' : 'advarsel'} farve={farve} indre="var(--color-line)" str={14} />
          <span className="tal font-pixel text-2xl font-black" style={{ color: farve }} data-testid="tillid-vaerdi">
            {Math.round(t)}
          </span>
        </span>
        <span className="text-[0.62rem] uppercase text-muted">{t >= 60 ? 'God tillid' : t >= 40 ? 'Tilsynet holder øje' : 'Lav tillid'}</span>
      </Maaler>
      <div className="w-full min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
          <span>Ved næste kvartalsmøde (om {uger(kv.uger)})</span>
          <span className="tal font-pixel text-sm font-black" style={{ color: sum > 0 ? 'var(--color-good)' : sum < 0 ? 'var(--color-bad)' : 'var(--color-muted)' }}>
            {sum > 0 ? '+' : sum < 0 ? '−' : '±'}
            {fmtTal(Math.abs(sum))}
          </span>
        </div>
        {poster.length === 0 ? (
          <p className="text-sm text-muted">Intet trækker i tilliden lige nu.</p>
        ) : (
          <ul className="flex flex-col gap-1" data-testid="tillid-poster">
            {poster.map((p) => (
              <li key={p.tekst} className="flex items-center gap-2 rounded border-2 border-line bg-panel px-2 py-1 text-sm">
                <Ikon navn={p.vaerdi >= 0 ? 'op' : 'ned'} farve={p.vaerdi >= 0 ? 'var(--color-good)' : 'var(--color-bad)'} str={12} className="shrink-0" />
                <span className="min-w-0 flex-1">{p.tekst}</span>
                <span className="tal font-pixel text-xs font-bold" style={{ color: p.vaerdi >= 0 ? 'var(--color-good)' : 'var(--color-bad)' }}>
                  {p.vaerdi > 0 ? '+' : '−'}
                  {fmtTal(Math.abs(p.vaerdi))}
                </span>
              </li>
            ))}
          </ul>
        )}
        {ms.licens !== 'aktiv' && <p className="mt-1 text-xs text-dim">Tilliden regnes først, når licensen er aktiv.</p>}
      </div>
    </div>
  );
}

// ---------- Andre markeder ----------

function AndreMarkeder() {
  return (
    <ul className="grid grid-cols-2 gap-1.5 @lg:grid-cols-4" data-testid="andre-markeder">
      {MARKET_IDS.filter((id) => id !== 'dk').map((id) => {
        const def = MARKETS[id];
        return (
          <li key={id} className="flex flex-col gap-1 overflow-hidden rounded-md border-2 border-line bg-panel opacity-80" data-testid={`marked-laast-${id}`} title={def.beskrivelse}>
            <FlagStribe farver={def.farver} className="h-2 rounded-none border-0 border-b-2" />
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              <span className="flex items-center justify-between gap-1">
                <span className="truncate font-pixel text-xs font-black uppercase">{def.navn}</span>
                <Ikon navn="laas" farve="var(--color-dim)" str={12} titel="Låst" />
              </span>
              <span className="truncate text-[0.66rem] text-dim">{def.tilsyn}</span>
              <span className="text-[0.7rem] font-bold text-muted">Åbner senere i spillet</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function MarketPanel() {
  const g = useGame((s) => s.game)!;
  return (
    <Panel titel="Marked" ikon="kort" testId="panel-marked">
      <div className="@container flex flex-col gap-3">
        <Konsolkort g={g} />
        <Afsnit titel="Marketingmix" ikon="hoejttaler" farve="var(--color-sky)" testId="marketingmix">
          <Marketing g={g} />
        </Afsnit>
        <Afsnit titel="Markedsandele i Danmark" ikon="hitliste" farve="var(--color-pink)" testId="andele">
          <Andele g={g} />
        </Afsnit>
        <Afsnit titel="Licenser" ikon="noegle" testId="licenser">
          <Licenser g={g} />
        </Afsnit>
        <Afsnit titel="Bonus og VIP" ikon="diamant" farve="var(--color-pink)" testId="bonus-vip">
          <Tip>Fristende: flere kunder og mere spil. Prisen står ved siden af — i kroner og i tilsynets tillid.</Tip>
          <div className="mt-2">
            <BonusVip g={g} />
          </div>
        </Afsnit>
        <Afsnit titel="Tilsynstillid" ikon="skjold" farve="var(--color-good)" testId="tilsynstillid">
          <Tillid g={g} />
        </Afsnit>
        <Afsnit titel="Andre markeder" ikon="globus" farve="var(--color-violet)" testId="andre-markeder-afsnit">
          <AndreMarkeder />
        </Afsnit>
      </div>
    </Panel>
  );
}
