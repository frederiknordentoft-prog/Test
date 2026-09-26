// Firma-sporet: medarbejderkort (info + handlinger), kompakt række og kandidatkort.
// Bruges af Personale-panelet og medarbejderdialogen (klik på en figur i kontoret).
import { useState } from 'react';
import { FASE_NAVN } from '../lib/devHjaelp';
import type { Action, GameState, Staff, StatKey } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { Btn, Ikon, Badge } from './kit';
import { FirmaAvatar, StatBar, Chip, Maengde, KravRaekke } from './FirmaDele';
import { ROLES, xpTilNaeste, MAX_NIVEAU } from '../../data/roles';
import { FRATRAEDELSE_UGER, TRAINING } from '../../data/costs';
import { opgaverFor, rolleskiftFor, ROLLESKIFT_PRIS, traeningPris, STAT_KEYS } from '../../sim/staff';
import { staffXpAndel } from '../../sim/selectors';
import { aarFor } from '../../sim/time';
import { mio } from '../format';
import { STAT_FARVE, STAT_KORT, STAT_NAVN, energiFarve, uger } from '../lib/firmaHjaelp';


type Status = { tekst: string; ikon: 'produkt' | 'kontrakt' | 'ur'; farve: string; kort: string };

export function statusFor(g: GameState, id: string, opgaver = opgaverFor(g)): Status {
  const o = opgaver[id] ?? { type: 'ledig' };
  if (o.type === 'projekt') {
    const p = g.projekter.find((x) => x.id === o.projectId);
    return { tekst: p ? `${p.navn} · ${FASE_NAVN[p.fase]}` : 'Projekt', kort: 'Projekt', ikon: 'produkt', farve: 'var(--color-violet)' };
  }
  if (o.type === 'kontrakt') {
    const c = g.kontraktopgaver.find((x) => x.id === o.contractId);
    return { tekst: c ? `${c.tilbud.navn} · ${uger(c.resterendeUger)} tilbage` : 'Kontraktopgave', kort: 'Opgave', ikon: 'kontrakt', farve: 'var(--color-sky)' };
  }
  return { tekst: 'Ledig — klar til en opgave', kort: 'Ledig', ikon: 'ur', farve: 'var(--color-muted)' };
}

function RolleLinje({ m }: { m: Staff }) {
  const r = ROLES[m.rolle];
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: r.farve }}>
        <span className="inline-block h-2.5 w-2.5 rounded-sm border border-line" style={{ background: r.farve }} aria-hidden />
        {r.navn}
      </span>
      {m.specialisering === 'crm' && (
        <Badge farve="var(--color-pink)" tekstFarve="var(--color-line)">
          CRM-specialist
        </Badge>
      )}
      {m.stifter && (
        <Badge farve="var(--color-gold)" tekstFarve="var(--color-line)">
          <Ikon navn="krone" farve="var(--color-line)" indre="var(--color-gold)" str={10} /> Stifter
        </Badge>
      )}
    </div>
  );
}

function NiveauFelt({ m }: { m: Staff }) {
  const max = m.niveau >= MAX_NIVEAU;
  const andel = max ? 1 : staffXpAndel(m.erfaring, m.niveau);
  return (
    <div className="flex min-w-0 items-center gap-2" title={max ? 'Maks niveau' : `${Math.round(m.erfaring)} af ${xpTilNaeste(m.niveau)} xp til niveau ${m.niveau + 1}`}>
      <span className="shrink-0 rounded border-2 border-line bg-panel2 px-1.5 py-0.5 font-pixel text-xs font-black text-gold">Niv. {m.niveau}</span>
      <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-bg" aria-hidden>
        <span className="block h-full bg-gold" style={{ width: `${andel * 100}%` }} />
      </span>
      <span className="tal shrink-0 font-pixel text-[0.68rem] text-muted">{max ? 'MAKS' : `${Math.round(m.erfaring)}/${xpTilNaeste(m.niveau)} xp`}</span>
    </div>
  );
}

/** De seks stats som mini-barer */
export function StatRaster({ stats, fremhaev }: { stats: Staff['stats']; fremhaev?: StatKey }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 @md:grid-cols-3">
      {STAT_KEYS.map((k) => (
        <div key={k} className={fremhaev === k ? 'rounded-sm outline-2 outline-offset-1 outline-gold' : ''}>
          <StatBar label={STAT_KORT[k]} vaerdi={stats[k]} farve={STAT_FARVE[k]} titel={`${STAT_NAVN[k]}: ${stats[k]}`} />
        </div>
      ))}
    </div>
  );
}

/** Øverste del af et medarbejderkort: avatar, navn, rolle, niveau, status */
export function MedarbejderHoved({ m, status, avatar = 48 }: { m: Staff; status: Status; avatar?: number }) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <FirmaAvatar m={m} str={avatar} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-pixel text-sm font-black text-ink" title={m.navn}>
          {m.navn}
        </div>
        <RolleLinje m={m} />
        <div className="mt-1">
          <Chip ikon={status.ikon} farve={status.farve} titel={status.tekst}>
            {status.tekst}
          </Chip>
        </div>
      </div>
    </div>
  );
}

type Aaben = 'traen' | 'rolle' | 'fyr' | null;

/** Handlinger: træn (vælg stat), rolleskift og fyr (med bekræftelse) */
export function MedarbejderHandlinger({ m, onFyret }: { m: Staff; onFyret?: () => void }) {
  const [aaben, setAaben] = useState<Aaben>(null);
  const g = useGame((s) => s.game)!;
  const { kapital, indsigt } = g;
  const pris = traeningPris(m);
  const skift = rolleskiftFor(g, m);
  const dispatch = (a: Action) => useGame.getState().dispatch(a);

  const traenGrund =
    m.energi < 20 ? `${m.navn.split(' ')[0]} er for træt (energi under 20)` : indsigt < pris.indsigt ? `Kræver ${pris.indsigt} indsigt` : kapital < pris.penge ? `Kræver ${mio(pris.penge)}` : null;
  const skiftPrisOk = kapital >= ROLLESKIFT_PRIS.penge && indsigt >= ROLLESKIFT_PRIS.indsigt;
  const fratraedelse = m.loenPrUge * FRATRAEDELSE_UGER;
  const toggle = (a: Exclude<Aaben, null>) => setAaben((x) => (x === a ? null : a));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <Btn
          variant={aaben === 'traen' ? 'primaer' : 'sekundaer'}
          onClick={() => toggle('traen')}
          testId={`traen-${m.id}`}
          title={traenGrund ?? `Træning: ${mio(pris.penge)} + ${pris.indsigt} indsigt`}
          className="flex-1 @sm:flex-none"
        >
          <Ikon navn="lyn" farve="currentColor" str={14} /> Træn
        </Btn>
        <Btn
          variant={aaben === 'rolle' ? 'primaer' : 'sekundaer'}
          onClick={() => toggle('rolle')}
          testId={`rolleskift-${m.id}`}
          disabled={skift.length === 0}
          title={skift.length === 0 ? `${ROLES[m.rolle].navn} har ingen rolleskift` : 'Skift rolle'}
          className="flex-1 @sm:flex-none"
        >
          <Ikon navn="pil" farve="currentColor" str={14} /> Rolleskift
        </Btn>
        {!m.stifter && (
          <Btn variant={aaben === 'fyr' ? 'fare' : 'ghost'} onClick={() => toggle('fyr')} testId={`fyr-${m.id}`} className="flex-1 @sm:flex-none">
            <Ikon navn="doer" farve="currentColor" str={14} /> Fyr
          </Btn>
        )}
      </div>
      {skift.length === 0 && (
        // Synlig grund (tooltips findes ikke på touch)
        <p className="-mt-1 flex items-center gap-1 text-[0.7rem] text-muted" data-testid={`rolleskift-grund-${m.id}`}>
          <Ikon navn="laas" farve="var(--color-dim)" str={10} className="shrink-0" /> {ROLES[m.rolle].navn} har ingen rolleskift.
        </p>
      )}

      {aaben === 'traen' && (
        <div className="anim-glid rounded-md border-2 border-line bg-panel p-2" data-testid={`traening-${m.id}`}>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
            <span>Vælg en stat. +{TRAINING.minGevinst}-{TRAINING.maxGevinst} point (halvt over 70), −{TRAINING.energi} energi.</span>
            <span className="flex items-center gap-2">
              <Maengde ikon="penge" farve="var(--color-gold)">{mio(pris.penge)}</Maengde>
              <Maengde ikon="indsigt" farve="var(--color-cyan)">{pris.indsigt}</Maengde>
            </span>
          </div>
          {traenGrund && (
            <p className="mb-1.5 flex items-center gap-1 text-xs font-bold text-warn">
              <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} /> {traenGrund}
            </p>
          )}
          <div className="grid grid-cols-2 gap-1 @md:grid-cols-3">
            {STAT_KEYS.map((k) => {
              const top = m.stats[k] >= TRAINING.statLoft;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!traenGrund || top}
                  data-testid={`traen-${m.id}-${k}`}
                  title={top ? 'Allerede på toppen' : `Træn ${STAT_NAVN[k].toLowerCase()}`}
                  onClick={() => {
                    if (dispatch({ t: 'train', staffId: m.id, stat: k })) useGame.getState().toast(`${m.navn.split(' ')[0]} har trænet ${STAT_NAVN[k].toLowerCase()}!`, 'godt');
                  }}
                  className="flex min-h-[44px] items-center justify-between gap-1 rounded-md border-2 border-line bg-panel2 px-2 text-left text-sm font-bold hover:bg-hi disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-line" style={{ background: STAT_FARVE[k] }} aria-hidden />
                    <span className="truncate">{STAT_NAVN[k]}</span>
                  </span>
                  <span className="tal font-pixel text-xs text-muted">{m.stats[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {aaben === 'rolle' && (
        <div className="anim-glid flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2" data-testid={`rolleskift-valg-${m.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted">
            <span>Omskoling koster</span>
            <span className="flex items-center gap-2">
              <Maengde ikon="penge" farve="var(--color-gold)">{mio(ROLLESKIFT_PRIS.penge)}</Maengde>
              <Maengde ikon="indsigt" farve="var(--color-cyan)">{ROLLESKIFT_PRIS.indsigt}</Maengde>
            </span>
          </div>
          {skift.map((c) => {
            const aarOk = aarFor(g.uge) >= c.fraAar;
            const niveauOk = m.niveau >= c.niveau;
            const kan = c.mulig && skiftPrisOk;
            const noegle = `${c.til}${c.specialisering ? '-crm' : ''}`;
            return (
              <div key={noegle} className="flex flex-col gap-1.5 rounded border-2 border-line bg-bg2 p-2 @md:flex-row @md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold" style={{ color: ROLES[c.til].farve }}>
                    {ROLES[m.rolle].navn} → {c.navn}
                  </div>
                  <p className="text-xs text-muted">{c.tekst}</p>
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <KravRaekke ok={niveauOk}>Niveau {c.niveau}</KravRaekke>
                    {c.fraAar > 2012 && <KravRaekke ok={aarOk}>Fra {c.fraAar}</KravRaekke>}
                  </ul>
                </div>
                <Btn
                  variant="primaer"
                  disabled={!kan}
                  testId={`rolleskift-${m.id}-${noegle}`}
                  title={!c.mulig ? 'Kravene er ikke opfyldt endnu' : !skiftPrisOk ? 'Ikke nok penge eller indsigt' : undefined}
                  onClick={() => {
                    if (dispatch({ t: 'changeRole', staffId: m.id, nyRolle: c.til })) {
                      useGame.getState().toast(`${m.navn.split(' ')[0]} er nu ${c.navn}!`, 'godt');
                      setAaben(null);
                    }
                  }}
                >
                  Skift
                </Btn>
              </div>
            );
          })}
        </div>
      )}

      {aaben === 'fyr' && !m.stifter && (
        <div className="anim-glid flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2 @md:flex-row @md:items-center" data-testid={`fyr-bekraeft-boks-${m.id}`}>
          <p className="min-w-0 flex-1 text-sm">
            Sig farvel til {m.navn}? Fratrædelse: {FRATRAEDELSE_UGER} ugers løn ={' '}
            <Maengde ikon="penge" farve="var(--color-gold)">{mio(fratraedelse)}</Maengde>
          </p>
          <div className="flex gap-1.5">
            <Btn onClick={() => setAaben(null)}>Fortryd</Btn>
            <Btn
              variant="fare"
              testId={`fyr-bekraeft-${m.id}`}
              onClick={() => {
                if (dispatch({ t: 'fire', staffId: m.id })) {
                  useGame.getState().toast(`${m.navn} har forladt firmaet.`, 'info');
                  onFyret?.();
                }
              }}
            >
              Ja, fyr
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fuldt medarbejderkort: info, niveau, stats, energi, løn og handlinger */
export function MedarbejderKort({ m, status, visHandlinger = true, onFyret, udenRamme }: { m: Staff; status: Status; visHandlinger?: boolean; onFyret?: () => void; udenRamme?: boolean }) {
  return (
    <article
      className={`@container flex min-w-0 flex-col gap-2 ${udenRamme ? '' : 'rounded-md border-2 border-line bg-bg2 p-2.5'}`}
      data-testid={`medarbejder-${m.id}`}
    >
      <MedarbejderHoved m={m} status={status} />
      <NiveauFelt m={m} />
      <StatRaster stats={m.stats} />
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-1.5" title={`Energi ${Math.round(m.energi)} af 100. Genoprettes, når ${m.navn.split(' ')[0]} holder pause.`}>
          <Ikon navn="lyn" farve={energiFarve(m.energi)} indre="var(--color-line)" str={14} className="shrink-0" />
          <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
            <span className="block h-full" style={{ width: `${m.energi}%`, background: energiFarve(m.energi) }} />
          </span>
          <span className="tal w-7 shrink-0 text-right font-pixel text-xs font-bold">{Math.round(m.energi)}</span>
        </div>
        <Maengde ikon="penge" farve="var(--color-gold)" titel="Løn pr. uge" className="text-xs">
          {mio(m.loenPrUge)}/uge
        </Maengde>
      </div>
      <p className="text-xs leading-snug text-dim">{ROLES[m.rolle].passiv}</p>
      {visHandlinger && <MedarbejderHandlinger m={m} onFyret={onFyret} />}
    </article>
  );
}

/** Kompakt række (mobil): tryk åbner medarbejderdialogen */
export function MedarbejderRaekke({ m, status }: { m: Staff; status: Status }) {
  return (
    <button
      type="button"
      onClick={() => useUi.getState().aabn({ kind: 'medarbejder', staffId: m.id })}
      data-testid={`medarbejder-${m.id}`}
      className="flex min-h-14 w-full items-center gap-2.5 rounded-md border-2 border-line bg-bg2 p-1.5 text-left hover:bg-panel2"
    >
      <FirmaAvatar m={m} str={40} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-pixel text-sm font-black">{m.navn}</span>
          {m.stifter && <Ikon navn="krone" farve="var(--color-gold)" indre="var(--color-line)" str={12} titel="Stifter" className="shrink-0" />}
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="font-bold" style={{ color: ROLES[m.rolle].farve }}>
            {m.specialisering === 'crm' ? 'CRM-specialist' : ROLES[m.rolle].navn}
          </span>
          <span className="text-dim">·</span>
          <span className="inline-flex min-w-0 items-center gap-1 truncate" style={{ color: status.farve }}>
            <Ikon navn={status.ikon} farve={status.farve} indre="var(--color-line)" str={11} className="shrink-0" />
            <span className="truncate">{status.kort}</span>
          </span>
        </span>
      </span>
      <span className="flex w-16 shrink-0 flex-col items-end gap-1">
        <span className="font-pixel text-xs font-black text-gold">Niv. {m.niveau}</span>
        <span className="h-2 w-full overflow-hidden rounded-sm border border-line bg-bg" title={`Energi ${Math.round(m.energi)}`}>
          <span className="block h-full" style={{ width: `${m.energi}%`, background: energiFarve(m.energi) }} />
        </span>
      </span>
      <Ikon navn="pil" farve="var(--color-dim)" str={12} className="shrink-0" />
    </button>
  );
}

/** Kandidat fra en jobannonce eller messe */
export function KandidatKort({ k, fuldt, grund }: { k: Staff; fuldt: boolean; grund: string }) {
  const r = ROLES[k.rolle];
  return (
    <article className="@container flex min-w-0 flex-col gap-2 rounded-md border-2 border-line bg-bg2 p-2.5" data-testid={`kandidat-${k.id}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        <FirmaAvatar m={k} str={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-pixel text-sm font-black">{k.navn}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-bold" style={{ color: r.farve }}>
              {r.navn}
            </span>
            <span className="font-pixel text-xs font-black text-gold">Niv. {k.niveau}</span>
          </div>
          <Maengde ikon="penge" farve="var(--color-gold)" titel="Løn pr. uge" className="text-xs">
            {mio(k.loenPrUge)}/uge
          </Maengde>
        </div>
      </div>
      <StatRaster stats={k.stats} fremhaev={r.primaer} />
      <Btn
        variant="god"
        disabled={fuldt}
        title={fuldt ? grund : `Ansæt ${k.navn}`}
        testId={`ansaet-${k.id}`}
        onClick={() => {
          if (useGame.getState().dispatch({ t: 'hire', kandidatId: k.id })) useGame.getState().toast(`Velkommen til ${k.navn}!`, 'godt');
        }}
      >
        <Ikon navn="plus" farve="currentColor" str={14} /> Ansæt
      </Btn>
    </article>
  );
}

export type { Status as MedarbejderStatus };
