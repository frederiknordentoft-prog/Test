import { useGame } from '../store/gameStore';
import { useConfig, activePaytable } from '../store/configStore';
import { payoutMultiplier } from '../economy/paytable';

function fmt(n: number): string {
  return n.toLocaleString('da-DK', { maximumFractionDigits: 0 });
}

export function WinOverlay() {
  const result = useGame((s) => s.lastResult);
  const status = useGame((s) => s.status);
  const clearResult = useGame((s) => s.clearResult);
  const newGame = useGame((s) => s.newGame);
  const cfg = useConfig();

  if (!result || status === 'idle' || status === 'playing') return null;

  const solved = result.solved;
  const mult = solved
    ? payoutMultiplier(activePaytable(cfg), true, result.rounds)
    : result.payout / cfg.stake; // progress multiplier
  const foundationPct = Math.round(result.foundationFraction * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="pop w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-brand-green-dark p-7 text-center shadow-card-lift">
        <h2 className="font-display text-3xl font-bold text-brand-gold">
          {solved ? 'Løst! 🎉' : 'Ikke løst'}
        </h2>

        {solved ? (
          <p className="mt-2 text-white/80">
            Du løste på <b>{result.rounds}</b> {result.rounds === 1 ? 'runde' : 'runder'}.
            {result.minRounds != null && (
              <>
                {' '}
                Optimalt var <b>{result.minRounds}</b>
                {result.minRoundsProven === false && <span className="text-white/50"> (ikke bevist)</span>}.
              </>
            )}
          </p>
        ) : (
          <p className="mt-2 text-white/70">
            {result.payout > 0 ? (
              <>
                Du nåede <b>{foundationPct}%</b> til fundamentet og fik en delvis udbetaling.
              </>
            ) : (
              <>
                Du nåede <b>{foundationPct}%</b> til fundamentet — under tærsklen, så ingen udbetaling.
              </>
            )}
          </p>
        )}

        <div className="my-5 rounded-xl bg-black/30 p-4">
          <div className="text-xs uppercase tracking-wide text-white/50">
            {solved ? 'Gevinst' : 'Progress-udbetaling'}
          </div>
          <div className="font-display text-4xl font-bold text-white">
            {fmt(result.payout)}{' '}
            <span className="text-lg text-white/50">× {mult.toFixed(2)}</span>
          </div>
        </div>

        {result.jackpotHit && (
          <div className="pop mb-5 rounded-xl border-2 border-brand-gold bg-brand-gold/15 p-4">
            <div className="text-xs uppercase tracking-wide text-brand-gold">⭐ JACKPOT! ⭐</div>
            <div className="font-display text-3xl font-bold text-brand-gold">
              + {fmt(Math.round(result.jackpotWon))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="flex-1 rounded-lg bg-white/10 px-4 py-2 font-semibold hover:bg-white/20"
            onClick={clearResult}
          >
            Luk
          </button>
          <button
            className="flex-1 rounded-lg bg-brand-gold px-4 py-2 font-semibold text-brand-green-dark hover:brightness-110"
            onClick={() => {
              clearResult();
              void newGame();
            }}
          >
            Nyt spil
          </button>
        </div>
      </div>
    </div>
  );
}
