// Titelskærm (spec 6.1): stor pixeltitel, en lille garage-scene, vælg 2 af 4 stiftere, vælg vertikal,
// firmanavn og mentor. "Fortsæt" (autosave) og "Indlæs" (pladser + JSON-import), når der findes gemte spil.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../../store/gameStore';
import { hent, listSaves, type SaveRow } from '../../store/persistence';
import { FOUNDERS, type FounderDef } from '../../data/founders';
import { VERTICALS } from '../../data/verticals';
import { ROLES } from '../../data/roles';
import type { StatKey, Vertical } from '../../sim/types';
import { datoTekst } from '../../sim/time';
import { Btn, Ikon, type IkonNavn } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { Garage } from '../components/ShellGarage';
import { Portraet, portraetFor } from '../components/ShellPortraet';
import { Kontakt } from '../components/ShellKontakt';
import { useReduceretBevaegelse } from '../hooks/useMedia';
import { spil } from '../../audio/sfx';
import { mio } from '../format';
import { gemtTekst } from '../lib/shellHjaelp';
import SaveLoadDialog from '../dialogs/SaveLoadDialog';
import { hentNgPlus, type NgPlusGemt } from '../../store/persistence';
import { MODE_INFO, arvOpsummering, type StartMode } from '../lib/slutHjaelp';

const START_MODES: StartMode[] = ['normal', 'usa2018', 'aiNative2026'];

/** New Game+ (spec 6.17): startpunkt og arv. Vises først, når et spil er afsluttet. */
function StartpunktSektion({ ngplus, mode, onMode, medArv, onMedArv }: { ngplus: NgPlusGemt; mode: StartMode; onMode: (m: StartMode) => void; medArv: boolean; onMedArv: (v: boolean) => void }) {
  const arvTal = arvOpsummering(ngplus.arv);
  return (
    <Sektion
      nr={4}
      titel="Startpunkt"
      hoejre={
        <span className="inline-flex items-center gap-1 font-pixel text-xs font-bold text-gold">
          <Ikon navn="stjerne" str={12} /> New Game+
        </span>
      }
    >
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Startpunkt">
        {START_MODES.map((m) => {
          const mi = MODE_INFO[m];
          const ulaast = m === 'normal' || ngplus.modes.includes(m);
          const on = mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!ulaast}
              data-testid={`startmode-${m}`}
              onClick={() => {
                spil('klik');
                onMode(m);
              }}
              className={`flex min-h-[44px] flex-col gap-1.5 rounded-lg border-2 p-2.5 text-left transition-transform active:translate-y-[2px] disabled:opacity-50 ${
                on ? 'border-gold bg-panel2 shadow-[0_3px_0_var(--color-line),0_0_0_2px_var(--color-gold)_inset]' : 'border-line bg-bg2 pixel-skygge hover:bg-panel'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-line" style={{ background: mi.farve }}>
                  <Ikon navn={ulaast ? mi.ikon : 'laas'} farve="var(--color-line)" indre={mi.farve} str={18} />
                </span>
                <span className="font-pixel text-sm font-black" style={{ color: mi.farve }}>
                  {mi.kort}
                </span>
                {on && <Ikon navn="flueben" farve="var(--color-gold)" className="ml-auto shrink-0" />}
              </span>
              <span className="text-xs leading-snug text-muted">{ulaast ? mi.start : 'Låses op, når I har afsluttet et spil.'}</span>
            </button>
          );
        })}
      </div>
      {ngplus.arv && (
        <div className="mt-2 rounded-lg border-2 border-line bg-bg2 px-3">
          <Kontakt
            til={medArv}
            onSkift={onMedArv}
            testId="ngplus-arv"
            label="Tag arven med"
            forklaring={`Kombinationsbogen (${arvTal.kombinationer} kombinationer) og ${arvTal.niveauer} niveauer${ngplus.senesteSlut ? ` fra ${ngplus.senesteSlut.firmaNavn}` : ''}.`}
          />
        </div>
      )}
      {mode === 'usa2018' && <p className="mt-2 text-xs text-dim">USA-starten er altid betting: det var sportsbetting, højesteret åbnede for.</p>}
    </Sektion>
  );
}

const STAT_NAVN: Record<StatKey, string> = {
  kreativitet: 'Kreativitet',
  teknik: 'Teknik',
  matematik: 'Matematik',
  salg: 'Salg',
  ansvar: 'Ansvar',
  udholdenhed: 'Udholdenhed',
};

const VERTIKAL_INFO: Record<Vertical, { ikon: IkonNavn; plus: string[]; minus: string[] }> = {
  betting: { ikon: 'lyn', plus: ['Hurtigere produkter', 'Sportskalenderen giver fart'], minus: ['Svingende indtjening'] },
  kasino: { ikon: 'stjerne', plus: ['Stabil indtjening', 'Slots kan fornyes ofte'], minus: ['Dyrere kunder', 'Højere risiko'] },
};

function styrke(f: FounderDef): string | null {
  const v = ROLES[f.rolle].vertikal;
  if (v.betting > 1.05) return 'Stærk i betting';
  if (v.kasino > 1.05) return 'Stærk i kasino';
  return null;
}

function StifterKort({ f, valgtNr, onVaelg }: { f: FounderDef; valgtNr: number; onVaelg: () => void }) {
  const rolle = ROLES[f.rolle];
  const u = useMemo(() => portraetFor(f), [f]);
  const top = (Object.keys(f.stats) as StatKey[]).sort((a, b) => f.stats[b] - f.stats[a]).slice(0, 3);
  const valgt = valgtNr > 0;
  const s = styrke(f);
  return (
    <button
      type="button"
      data-testid={`stifter-${f.id}`}
      onClick={onVaelg}
      aria-pressed={valgt}
      className={`relative flex min-h-[44px] flex-col gap-2 rounded-lg border-2 p-2.5 text-left transition-[transform,background-color] duration-100 active:translate-y-[2px] ${
        valgt ? 'border-gold bg-panel2 shadow-[0_3px_0_var(--color-line),0_0_0_2px_var(--color-gold)_inset]' : 'border-line bg-bg2 pixel-skygge hover:bg-panel'
      }`}
    >
      {valgt && (
        <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-md border-2 border-line bg-gold font-pixel text-sm font-black text-line pixel-skygge" aria-hidden>
          {valgtNr}
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <Portraet udseende={u} str={52} baggrund={valgt ? 'var(--color-hi)' : 'var(--color-panel)'} className="shrink-0 rounded border-2 border-line" />
        <div className="min-w-0">
          <div className="font-pixel text-sm font-black text-ink">{f.titel}</div>
          <div className="truncate text-xs text-muted">{f.navn}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="rounded border-2 border-line px-1 font-pixel text-[0.6rem] font-bold uppercase leading-4 text-line" style={{ background: rolle.farve }}>
              {rolle.navn}
            </span>
            {s && <span className="rounded border-2 border-line bg-bg px-1 font-pixel text-[0.6rem] font-bold uppercase leading-4 text-muted">{s}</span>}
          </div>
        </div>
      </div>
      <p className="text-xs leading-snug text-muted">{f.beskrivelse}</p>
      <div className="grid gap-1">
        {top.map((k) => (
          <div key={k} className="flex items-center gap-2 text-[0.68rem]">
            <span className="w-[74px] shrink-0 text-dim">{STAT_NAVN[k]}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-sm border border-line bg-bg">
              <span className="block h-full" style={{ width: `${Math.min(100, (f.stats[k] / 36) * 100)}%`, background: rolle.farve }} />
            </span>
            <span className="tal w-5 text-right font-pixel font-bold text-ink">{f.stats[k]}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function Sektion({ nr, titel, hoejre, children }: { nr: number; titel: string; hoejre?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border-2 border-line bg-panel pixel-skygge">
      <header className="flex items-center justify-between gap-2 border-b-2 border-line bg-panel2 px-3 py-2 rounded-t-[10px]">
        <h2 className="flex items-center gap-2 font-pixel text-sm font-black uppercase tracking-wider">
          <span className="flex h-6 w-6 items-center justify-center rounded border-2 border-line bg-gold text-xs text-line">{nr}</span>
          {titel}
        </h2>
        {hoejre}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

type SaveInfo = Omit<SaveRow, 'state'>;

export default function TitleScreen() {
  const nytSpil = useGame((s) => s.nytSpil);
  const indlaes = useGame((s) => s.indlaes);
  const reduceret = useReduceretBevaegelse();
  const [navn, setNavn] = useState('Garagespil ApS');
  const [valgte, setValgte] = useState<string[]>([]);
  const [vertikal, setVertikal] = useState<Vertical>('betting');
  const [tutorial, setTutorial] = useState(true);
  const [saves, setSaves] = useState<SaveInfo[]>([]);
  const [visIndlaes, setVisIndlaes] = useState(false);
  const [henter, setHenter] = useState(false);
  const [ngplus, setNgplus] = useState<NgPlusGemt | null>(null);
  const [mode, setMode] = useState<StartMode>('normal');
  const [medArv, setMedArv] = useState(true);
  const [spoler, setSpoler] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void hentNgPlus().then((n) => aktiv && setNgplus(n));
    return () => {
      aktiv = false;
    };
  }, []);

  useEffect(() => {
    let aktiv = true;
    void listSaves().then((l) => aktiv && setSaves(l));
    return () => {
      aktiv = false;
    };
  }, [visIndlaes]);

  const auto = saves.find((x) => x.slot === 'auto');

  const figurer = useMemo(() => {
    const valgteF = valgte.map((id) => FOUNDERS.find((f) => f.id === id)).filter((f): f is FounderDef => !!f);
    const liste = valgteF.length === 2 ? valgteF : [...valgteF, ...FOUNDERS.filter((f) => !valgte.includes(f.id))].slice(0, 2);
    return liste.map((f) => portraetFor(f));
  }, [valgte]);

  const toggle = (id: string) => {
    spil('klik');
    setValgte((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length >= 2 ? [v[1], id] : [...v, id]));
  };

  const kanStarte = valgte.length === 2;
  const start = () => {
    if (!kanStarte || spoler) return;
    const p = new URLSearchParams(window.location.search).get('seed');
    const seed = p && /^\d+$/.test(p) ? Number(p) : Math.floor(Math.random() * 2 ** 31);
    spil('niveauOp');
    // New Game+: startmode og arv (kun når et spil er afsluttet før)
    const m: StartMode = ngplus ? mode : 'normal';
    const arv = ngplus?.arv && medArv ? ngplus.arv : undefined;
    const opts = { seed, firmaNavn: navn.trim() || 'Garagespil ApS', stiftere: [valgte[0], valgte[1]] as [string, string], startVertikal: m === 'usa2018' ? ('betting' as const) : vertikal, tutorial, mode: m, arv };
    if (m === 'normal') {
      nytSpil(opts);
      return;
    }
    // En mode-start spoler verden frem til startåret: vis en besked, før simuleringen kører
    setSpoler(true);
    setTimeout(() => nytSpil(opts), 40);
  };

  const fortsaet = async () => {
    setHenter(true);
    const g = await hent('auto');
    setHenter(false);
    if (g) indlaes(g);
  };

  return (
    <main
      className="min-h-full bg-[radial-gradient(circle_at_50%_0%,#2c2452_0%,transparent_60%),repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(0,0,0,0.08)_3px,rgba(0,0,0,0.08)_4px)] px-4 pt-[max(20px,env(safe-area-inset-top))] pb-[max(24px,env(safe-area-inset-bottom))] sm:px-8"
      data-testid="titelskaerm"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-8">
        {/* Venstre: titel, scene og fortsæt */}
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <header className="flex flex-col items-center gap-2 pt-2 text-center">
            <PixelTekst tekst="Spilhuset" dybde={1} farver={['#b9fff8', 'var(--color-cyan)', '#2fb5aa']} side="#1c5f66" className="h-auto w-[46%] max-w-[210px]" />
            <h1 className="w-full">
              <PixelTekst tekst="Udfordreren" dybde={1} className="h-auto w-full max-w-[560px]" titel="Udfordreren" />
            </h1>
            <p className="max-w-md text-sm text-muted">
              København, januar 2012. Markedet er lige blevet liberaliseret. I har en garage, to bærbare og en drøm.
            </p>
          </header>

          <div className="relative overflow-hidden rounded-xl border-2 border-line bg-line pixel-kant">
            <Garage figurer={figurer} stille={reduceret} className="block h-auto w-full" />
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(0,0,0,0.12)_2px,rgba(0,0,0,0.12)_3px)]" aria-hidden />
          </div>

          {(auto || saves.length > 0) && (
            <div className="grid grid-cols-1 gap-2">
              {auto && (
                <button
                  type="button"
                  data-testid="fortsaet-auto"
                  onClick={() => void fortsaet()}
                  disabled={henter}
                  className="flex min-h-14 min-w-0 items-center gap-3 rounded-lg border-2 border-line bg-good px-3 py-2 text-left text-line pixel-skygge transition-transform active:translate-y-[2px] disabled:opacity-60"
                >
                  <Ikon navn="play" str={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-pixel text-sm font-black uppercase">Fortsæt</span>
                    <span className="block truncate text-xs font-bold">
                      {auto.firmaNavn} · {datoTekst(auto.uge)} · {mio(auto.kapital)} · gemt {gemtTekst(auto.gemt)}
                    </span>
                  </span>
                </button>
              )}
              <Btn onClick={() => setVisIndlaes(true)} testId="indlaes-knap">
                <Ikon navn="gem" /> Indlæs et gemt spil
              </Btn>
            </div>
          )}
        </div>

        {/* Højre: nyt firma */}
        <div className="flex min-w-0 flex-col gap-4">
          <Sektion nr={1} titel="Firmaets navn">
            <label className="sr-only" htmlFor="firmanavn">
              Firmaets navn
            </label>
            <input
              id="firmanavn"
              data-testid="firmanavn"
              value={navn}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setNavn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && start()}
              className="min-h-12 w-full rounded-md border-2 border-line bg-bg px-3 font-pixel text-lg font-bold text-gold outline-none placeholder:text-dim focus:border-gold"
              placeholder="Garagespil ApS"
            />
          </Sektion>

          <Sektion
            nr={2}
            titel="Vælg 2 stiftere"
            hoejre={
              <span className={`font-pixel text-xs font-bold ${kanStarte ? 'text-good' : 'text-muted'}`} data-testid="stifter-antal">
                {valgte.length}/2
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {FOUNDERS.map((f) => (
                <StifterKort key={f.id} f={f} valgtNr={valgte.indexOf(f.id) + 1} onVaelg={() => toggle(f.id)} />
              ))}
            </div>
          </Sektion>

          <Sektion nr={3} titel="Vælg vertikal">
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(VERTICALS) as Vertical[]).map((v) => {
                const d = VERTICALS[v];
                const info = VERTIKAL_INFO[v];
                const on = vertikal === v;
                return (
                  <button
                    key={v}
                    type="button"
                    data-testid={`vertikal-${v}`}
                    onClick={() => {
                      spil('klik');
                      setVertikal(v);
                    }}
                    aria-pressed={on}
                    className={`flex min-h-[44px] flex-col gap-2 rounded-lg border-2 p-3 text-left transition-transform active:translate-y-[2px] ${
                      on ? 'border-gold bg-panel2 shadow-[0_3px_0_var(--color-line),0_0_0_2px_var(--color-gold)_inset]' : 'border-line bg-bg2 pixel-skygge hover:bg-panel'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-line" style={{ background: d.farve }}>
                        <Ikon navn={info.ikon} farve="var(--color-line)" indre={d.farve} str={20} />
                      </span>
                      <span className="font-pixel text-base font-black" style={{ color: d.farve }}>
                        {d.navn}
                      </span>
                      {on && <Ikon navn="flueben" farve="var(--color-gold)" className="ml-auto" />}
                    </span>
                    <span className="text-xs leading-snug text-muted">{d.beskrivelse}</span>
                    <span className="flex flex-wrap gap-1">
                      {info.plus.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded border-2 border-line bg-bg px-1.5 py-0.5 text-[0.68rem] font-bold text-good">
                          <Ikon navn="op" str={10} /> {t}
                        </span>
                      ))}
                      {info.minus.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded border-2 border-line bg-bg px-1.5 py-0.5 text-[0.68rem] font-bold text-warn">
                          <Ikon navn="ned" str={10} /> {t}
                        </span>
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-dim">Den anden vertikal kan I tilføje senere med en ekstra licens.</p>
          </Sektion>

          {ngplus && <StartpunktSektion ngplus={ngplus} mode={mode} onMode={setMode} medArv={medArv} onMedArv={setMedArv} />}

          <div className="rounded-xl border-2 border-line bg-panel p-3 pixel-skygge">
            <Kontakt
              til={tutorial}
              onSkift={setTutorial}
              testId="tutorial"
              label="Mentor"
              forklaring="Knud, en garvet brancheveteran, guider jer igennem de første skridt. Kan springes over."
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 border-t-2 border-line bg-bg/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-8 sm:px-8 lg:mx-0 lg:rounded-t-xl lg:border-x-2 lg:px-3">
            <Btn variant="primaer" onClick={start} disabled={!kanStarte} testId="start-spil" className="min-h-14 w-full font-pixel text-base uppercase tracking-wider">
              <Ikon navn="play" str={18} /> Start firmaet
            </Btn>
            {!kanStarte && (
              <p className="mt-1.5 text-center text-xs text-muted" data-testid="start-hint">
                Vælg {valgte.length === 0 ? 'to stiftere' : 'én stifter mere'} for at starte.
              </p>
            )}
          </div>
          <p className="text-center font-pixel text-[0.65rem] uppercase tracking-widest text-dim">Fase 1-2 · testversion</p>
        </div>
      </div>
      {visIndlaes && <SaveLoadDialog dialog={{ kind: 'gemIndlaes' }} onLuk={() => setVisIndlaes(false)} />}
      {spoler && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-line/70 p-4" role="status" data-testid="spoler-frem">
          <p className="flex items-center gap-2 rounded-lg border-2 border-line bg-panel px-4 py-3 font-pixel text-sm font-bold text-ink pixel-kant">
            <Ikon navn="ur" farve="var(--color-gold)" indre="var(--color-line)" /> Spoler verden frem til {MODE_INFO[mode].aar} …
          </p>
        </div>
      )}
    </main>
  );
}
