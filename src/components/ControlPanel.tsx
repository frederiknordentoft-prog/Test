import { useConfig } from '../store/configStore';
import { useGame } from '../store/gameStore';
import { Paytable } from '../economy/paytable';

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-white/70">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          className="w-24 rounded-md bg-black/30 px-2 py-1 text-right text-white outline-none ring-1 ring-white/10 focus:ring-brand-gold"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="text-xs text-white/40">{suffix}</span>}
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span className="text-white/70">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-brand-gold' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-3">
      <h3 className="font-display text-sm font-semibold text-brand-gold">{title}</h3>
      {children}
    </div>
  );
}

export function ControlPanel() {
  const cfg = useConfig();
  const resetPool = useGame((s) => s.resetPool);
  const buckets: (keyof Paytable)[] = [1, 2, 3, 4, 5, '6plus', 'fail'];

  return (
    <div className="space-y-4">
      <Section title="Indsats & spil">
        <NumberField label="Indsats (stake)" value={cfg.stake} min={1} onChange={(v) => cfg.set('stake', v)} />
        <NumberField
          label="Max runder (0 = ubegrænset)"
          value={cfg.maxRounds}
          min={0}
          onChange={(v) => cfg.set('maxRounds', v)}
        />
        <Toggle
          label="Kun løsbare deals"
          checked={cfg.solvableOnly}
          onChange={(v) => {
            cfg.set('solvableOnly', v);
            resetPool();
          }}
        />
        <Toggle label="Fortryd koster en runde" checked={cfg.undoPenalty} onChange={(v) => cfg.set('undoPenalty', v)} />
      </Section>

      <Section title="Gevinsttabel (× indsats)">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {buckets.map((b) => (
            <NumberField
              key={String(b)}
              label={b === 'fail' ? 'Tab' : b === '6plus' ? '6+ runder' : `${b} runde${b === 1 ? '' : 'r'}`}
              value={cfg.paytable[b]}
              step={0.1}
              min={0}
              onChange={(v) => cfg.setPaytable(b, v)}
            />
          ))}
        </div>
      </Section>

      <Section title="Progressiv jackpot">
        <div className="flex gap-2 text-sm">
          {(['A', 'B'] as const).map((m) => (
            <button
              key={m}
              onClick={() => cfg.setJackpotModel(m)}
              className={`flex-1 rounded-md px-2 py-1 font-semibold transition ${
                cfg.jackpot.model === m ? 'bg-brand-gold text-brand-green-dark' : 'bg-white/10 text-white/70'
              }`}
            >
              Model {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40">
          {cfg.jackpot.model === 'A'
            ? 'A: ren tilfældig udløsning på ethvert betalt spil (skill-uafhængig).'
            : 'B: kræver løst spil + tilfældighedsfaktor.'}
        </p>
        <NumberField
          label="Bidragssats"
          value={cfg.jackpot.contributionRate}
          step={0.005}
          min={0}
          suffix={`${(cfg.jackpot.contributionRate * 100).toFixed(1)}%`}
          onChange={(v) => cfg.setJackpot('contributionRate', v)}
        />
        <NumberField label="Seed (nulstil-værdi)" value={cfg.jackpot.seed} min={0} onChange={(v) => cfg.setJackpot('seed', v)} />
        {cfg.jackpot.model === 'A' ? (
          <NumberField label="Odds A (1 ud af)" value={cfg.jackpot.oddsA} min={1} onChange={(v) => cfg.setJackpot('oddsA', v)} />
        ) : (
          <NumberField label="Odds B (1 ud af, blandt løste)" value={cfg.jackpot.oddsB} min={1} onChange={(v) => cfg.setJackpot('oddsB', v)} />
        )}
      </Section>

      <Section title="Solver (avanceret)">
        <NumberField label="Node-budget (deals)" value={cfg.genNodeBudget} step={10000} min={10000} onChange={(v) => cfg.set('genNodeBudget', v)} />
        <NumberField label="Node-budget (hint)" value={cfg.hintNodeBudget} step={10000} min={10000} onChange={(v) => cfg.set('hintNodeBudget', v)} />
        <NumberField label="Pulje-mål (antal deals)" value={cfg.poolTarget} min={1} onChange={(v) => cfg.set('poolTarget', v)} />
      </Section>

      <button
        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20"
        onClick={() => {
          cfg.resetToDefaults();
          resetPool();
        }}
      >
        Nulstil indstillinger
      </button>
    </div>
  );
}
