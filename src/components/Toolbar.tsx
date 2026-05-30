import { useGame } from '../store/gameStore';
import { useConfig } from '../store/configStore';
import { foundationCount } from '../engine/klondike';

function fmt(n: number): string {
  return n.toLocaleString('da-DK', { maximumFractionDigits: 0 });
}

export function Toolbar() {
  const status = useGame((s) => s.status);
  const state = useGame((s) => s.state);
  const balance = useGame((s) => s.balance);
  const generating = useGame((s) => s.generating);
  const poolSize = useGame((s) => s.poolSize);
  const undoStack = useGame((s) => s.undoStack);
  const jackpotPool = useGame((s) => s.jackpot.pool);

  const newGame = useGame((s) => s.newGame);
  const undo = useGame((s) => s.undo);
  const giveUp = useGame((s) => s.giveUp);
  const requestHint = useGame((s) => s.requestHint);

  const stake = useConfig((s) => s.stake);
  const maxRounds = useConfig((s) => s.maxRounds);

  const playing = status === 'playing';
  const rounds = state?.rounds ?? 0;
  const found = state ? foundationCount(state) : 0;

  const btn =
    'rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className={`${btn} bg-brand-gold text-brand-green-dark hover:brightness-110`}
        onClick={() => newGame()}
        disabled={generating || balance < stake}
        title={balance < stake ? 'Ikke nok saldo' : `Koster ${stake}`}
      >
        {generating ? 'Giver kort…' : `Nyt spil (−${stake})`}
      </button>
      <button className={`${btn} bg-white/10 hover:bg-white/20`} onClick={undo} disabled={!playing || undoStack.length === 0}>
        Fortryd
      </button>
      <button className={`${btn} bg-white/10 hover:bg-white/20`} onClick={() => requestHint()} disabled={!playing}>
        Hint
      </button>
      <button className={`${btn} bg-red-500/20 text-red-200 hover:bg-red-500/30`} onClick={giveUp} disabled={!playing}>
        Giv op
      </button>

      <div className="ml-auto flex items-center gap-4 text-sm">
        <Stat label="Runde" value={maxRounds > 0 ? `${rounds} af ${maxRounds}` : String(rounds)} highlight />
        <Stat label="På fundament" value={`${found} / 52`} />
        <Stat label="Saldo" value={fmt(balance)} />
        <Stat label="Jackpot" value={fmt(Math.round(jackpotPool))} gold />
        <Stat label="Pulje" value={String(poolSize)} dim />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  gold,
  dim,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  gold?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={`text-right ${dim ? 'opacity-50' : ''}`}>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
      <div className={`font-semibold ${gold ? 'text-brand-gold' : highlight ? 'text-brand-gold' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}
