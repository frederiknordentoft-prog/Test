import { useGame } from '../store/gameStore';
import { useConfig } from '../store/configStore';
import {
  rtp,
  hitFrequency,
  avgActualRounds,
  avgOptimalRounds,
} from '../economy/stats';

function fmt(n: number, d = 0): string {
  return n.toLocaleString('da-DK', { maximumFractionDigits: d, minimumFractionDigits: d });
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-black/25 p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/45">{label}</div>
      <div className={`font-display text-lg font-semibold ${accent ? 'text-brand-gold' : 'text-white'}`}>
        {value}
      </div>
    </div>
  );
}

const BUCKETS = ['1', '2', '3', '4', '5', '6plus'];
const BUCKET_LABEL: Record<string, string> = { '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6plus': '6+' };

export function Dashboard() {
  const stats = useGame((s) => s.stats);
  const jp = useGame((s) => s.jackpot);
  const resetSession = useGame((s) => s.resetSession);
  const resetJackpotPool = useGame((s) => s.resetJackpotPool);
  const addFunds = useGame((s) => s.addFunds);
  const cfg = useConfig();

  const sessionRtp = rtp(stats);
  const hitFreq = hitFrequency(stats);
  const aActual = avgActualRounds(stats);
  const aOptimal = avgOptimalRounds(stats);

  const maxDist = Math.max(1, ...BUCKETS.map((b) => stats.roundDist[b] ?? 0));

  // Jackpot RTP breakdown, as % of total staked across the session.
  const staked = stats.totalStaked || 1;
  const contribPct = (jp.contributionsIn / staked) * 100;
  const seedPct = (jp.seedIn / staked) * 100;
  const paidPct = (jp.paidOut / staked) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Session-RTP" value={`${fmt(sessionRtp, 1)}%`} accent />
        <Metric label="Hit frequency" value={`${fmt(hitFreq, 1)}%`} />
        <Metric label="Spil" value={`${stats.games}`} />
        <Metric label="Vundne" value={`${stats.wins}`} />
        <Metric label="Største gevinst" value={fmt(stats.biggestWin)} />
        <Metric label="Indsat i alt" value={fmt(stats.totalStaked)} />
      </div>

      {/* Round distribution */}
      <div className="border-t border-white/10 pt-3">
        <h3 className="mb-2 font-display text-sm font-semibold text-brand-gold">Runde-fordeling (løste spil)</h3>
        <div className="flex h-24 items-end gap-1.5">
          {BUCKETS.map((b) => {
            const c = stats.roundDist[b] ?? 0;
            return (
              <div key={b} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-white/50">{c}</span>
                <div
                  className="w-full rounded-t bg-brand-gold/80"
                  style={{ height: `${(c / maxDist) * 70}px`, minHeight: c > 0 ? 3 : 0 }}
                />
                <span className="text-[10px] text-white/40">{BUCKET_LABEL[b]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skill gap */}
      <div className="border-t border-white/10 pt-3">
        <h3 className="mb-2 font-display text-sm font-semibold text-brand-gold">Skill-gab</h3>
        {stats.benchmarkedGames > 0 ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Din ø. runder" value={fmt(aActual, 2)} />
            <Metric label="Optimal ø." value={fmt(aOptimal, 2)} accent />
            <Metric label="Gab" value={`+${fmt(aActual - aOptimal, 2)}`} />
          </div>
        ) : (
          <p className="text-xs text-white/40">Spil et par løsbare deals for at se gabet mod solverens optimum.</p>
        )}
      </div>

      {/* Jackpot accounting */}
      <div className="border-t border-white/10 pt-3">
        <h3 className="mb-2 font-display text-sm font-semibold text-brand-gold">Jackpot-regnskab</h3>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Pulje nu" value={fmt(Math.round(jp.pool))} accent />
          <Metric label="Hits" value={`${jp.hits}`} />
          <Metric label="Spil siden hit" value={`${jp.gamesSinceHit}`} />
          <Metric label="Udbetalt i alt" value={fmt(Math.round(jp.paidOut))} />
        </div>
        <div className="mt-2 space-y-1 rounded-lg bg-black/25 p-2.5 text-xs">
          <div className="mb-1 text-white/45">Andel af samlet indsats (jackpot-RTP ≈ bidrag + seed):</div>
          <Row label="Bidrag ind" value={`${fmt(contribPct, 2)}%`} />
          <Row label="Seed ind (operatør)" value={`${fmt(seedPct, 2)}%`} />
          <Row label="Jackpot udbetalt" value={`${fmt(paidPct, 2)}%`} />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3">
        <button className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20" onClick={() => addFunds(1000)}>
          + 1000 spillepenge
        </button>
        <button className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20" onClick={resetSession}>
          Nulstil session
        </button>
        <button
          className="col-span-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30"
          onClick={() => {
            if (confirm(`Nulstil jackpot til seed (${cfg.jackpot.seed})?`)) resetJackpotPool();
          }}
        >
          Nulstil jackpot
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/60">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}
