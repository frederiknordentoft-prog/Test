// Titelskærm (spec 6.1): firmanavn, vælg 2 af 4 stiftere, vælg vertikal, tutorial. Fortsæt/indlæs.
import { useEffect, useState } from 'react';
import { useGame } from '../../store/gameStore';
import { hent, listSaves } from '../../store/persistence';
import { FOUNDERS } from '../../data/founders';
import { VERTICALS } from '../../data/verticals';
import { ROLES } from '../../data/roles';
import type { Vertical } from '../../sim/types';
import { Btn, Panel, Ikon } from '../components/kit';

export default function TitleScreen() {
  const nytSpil = useGame((s) => s.nytSpil);
  const indlaes = useGame((s) => s.indlaes);
  const [navn, setNavn] = useState('Garagespil ApS');
  const [valgte, setValgte] = useState<string[]>(['oddssaetteren', 'udvikleren']);
  const [vertikal, setVertikal] = useState<Vertical>('betting');
  const [tutorial, setTutorial] = useState(true);
  const [harAuto, setHarAuto] = useState(false);

  useEffect(() => {
    void listSaves().then((l) => setHarAuto(l.some((x) => x.slot === 'auto')));
  }, []);

  const toggle = (id: string) => {
    setValgte((v) => (v.includes(id) ? v.filter((x) => x !== id) : v.length >= 2 ? [v[1], id] : [...v, id]));
  };

  const start = () => {
    if (valgte.length !== 2) return;
    const seed = Math.floor(Math.random() * 2 ** 31);
    nytSpil({ seed, firmaNavn: navn, stiftere: [valgte[0], valgte[1]], startVertikal: vertikal, tutorial });
  };

  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-4 p-4 sm:p-8" data-testid="titelskaerm">
      <header className="text-center">
        <p className="font-pixel text-xs uppercase tracking-[0.3em] text-muted">Spilhuset præsenterer</p>
        <h1 className="font-pixel text-4xl font-black uppercase tracking-wider text-gold sm:text-5xl" style={{ textShadow: '3px 3px 0 var(--color-line)' }}>
          Udfordreren
        </h1>
        <p className="mt-2 text-muted">København, januar 2012. Markedet er lige blevet liberaliseret. I har en garage og en drøm.</p>
      </header>

      <Panel titel="Firmaets navn" ikon="firma">
        <input
          data-testid="firmanavn"
          value={navn}
          maxLength={32}
          onChange={(e) => setNavn(e.target.value)}
          className="min-h-11 w-full rounded-md border-2 border-line bg-bg px-3 font-pixel text-lg text-ink outline-none focus:border-gold"
        />
      </Panel>

      <Panel titel={`Vælg 2 stiftere (${valgte.length}/2)`} ikon="folk">
        <div className="grid gap-2 sm:grid-cols-2">
          {FOUNDERS.map((f) => {
            const on = valgte.includes(f.id);
            return (
              <button
                key={f.id}
                data-testid={`stifter-${f.id}`}
                onClick={() => toggle(f.id)}
                aria-pressed={on}
                className={`min-h-11 rounded-md border-2 p-3 text-left ${on ? 'border-gold bg-panel2' : 'border-line bg-bg2 hover:bg-panel2'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-pixel font-bold">{f.titel}</span>
                  <span className="text-xs" style={{ color: ROLES[f.rolle].farve }}>{ROLES[f.rolle].navn}</span>
                </div>
                <div className="text-sm text-muted">{f.navn} — {f.beskrivelse}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel titel="Vælg vertikal" ikon="produkt">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(VERTICALS) as Vertical[]).map((v) => (
            <button
              key={v}
              data-testid={`vertikal-${v}`}
              onClick={() => setVertikal(v)}
              aria-pressed={vertikal === v}
              className={`min-h-11 rounded-md border-2 p-3 text-left ${vertikal === v ? 'border-gold bg-panel2' : 'border-line bg-bg2 hover:bg-panel2'}`}
            >
              <div className="font-pixel font-bold" style={{ color: VERTICALS[v].farve }}>{VERTICALS[v].navn}</div>
              <div className="text-sm text-muted">{VERTICALS[v].beskrivelse}</div>
            </button>
          ))}
        </div>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} data-testid="tutorial" className="h-5 w-5 accent-[var(--color-gold)]" />
          Mentoren guider mig igennem de første skridt
        </label>
      </Panel>

      <div className="flex flex-wrap justify-center gap-3">
        <Btn variant="primaer" onClick={start} disabled={valgte.length !== 2} testId="start-spil">
          <Ikon navn="play" /> Start firmaet
        </Btn>
        {harAuto && (
          <Btn
            onClick={() => void hent('auto').then((g) => g && indlaes(g))}
            testId="fortsaet-auto"
          >
            <Ikon navn="gem" /> Fortsæt (autosave)
          </Btn>
        )}
      </div>
    </main>
  );
}
