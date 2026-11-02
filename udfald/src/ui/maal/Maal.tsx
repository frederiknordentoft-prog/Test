import { useMemo, useState, useSyncExternalStore } from 'react';
import type { MatchStore, MatchView } from '../../state/match';
import { cellLabel, cellPossible, CS_MIN_P, csCells, csId, fmtKr, largestRemainder, OUTCOME_ID } from '../../state/match';
import { Book } from '../../engine/book/portfolio';
import { CS_N, fmtLine, TOT_LINES } from '../../engine/football/display';
import { go } from '../router';

type Target =
  | { kind: 'cs'; cells: [number, number][] }
  | { kind: 'x12'; o: 1 | 2 } // shortcuts: the same payoff as the bar, never a second price
  | { kind: 'tot'; line: number; side: 'O' | 'U' };

const N = CS_N;
const ALL: [number, number][] = [];
for (let h = 0; h < N; h++) for (let a = 0; a < N; a++) ALL.push([h, a]);

/** Payout (kr) at a final score of the positions that are decided by the final score alone. */
function payoutAt(v: MatchView, store: MatchStore, h: number, a: number): { pay: number; cost: number; n: number } {
  let pay = 0;
  let cost = 0;
  let n = 0;
  const res = h > a ? 0 : h === a ? 1 : 2;
  for (const p of v.positions) {
    if (p.settled || p.shares === 0) continue;
    let hit: boolean | null = null;
    const oi = OUTCOME_ID.indexOf(p.id as (typeof OUTCOME_ID)[number]);
    if (oi >= 0) hit = oi === res;
    else if (p.id === 'dc:1X') hit = res !== 2;
    else if (p.id === 'dc:X2') hit = res !== 0;
    else if (p.id.startsWith('tot:')) {
      const m = /^tot:([\d.]+):([OU])$/.exec(p.id);
      if (m) hit = (h + a > Number(m[1])) === (m[2] === 'O');
    } else if (p.id.startsWith('cs:')) hit = (csCells(p.id) ?? []).some(([x, y]) => x === h && y === a);
    else if (p.id.startsWith('byg:')) {
      const q = store.buildQuotes.get(p.id);
      if (q && q.legs.every((l) => l.kind !== 'vindue')) {
        hit = q.legs.every((l) => (l.kind === 'udfald' ? l.o === res : l.kind === 'maal' ? h + a >= l.n : l.kind === 'btts' ? h > 0 && a > 0 : false));
      }
    }
    if (hit === null) continue;
    n++;
    cost += p.stake;
    if (hit) pay += p.shares;
  }
  return { pay, cost, n };
}

/**
 * Mål og slutresultat: the score map (6 × 6 final scores, 5 means 5+) priced off the same score
 * grid as 1X2, regions, and Over/Under per line. Shortcuts that equal a 1X2 result open 1X2.
 */
export function Maal({ store }: { store: MatchStore }) {
  const v = useSyncExternalStore(store.subscribeView, store.getView);
  const [target, setTarget] = useState<Target>({ kind: 'cs', cells: [] });
  const [stake, setStake] = useState(50);
  const cells = v.d.cells;
  const tally = useMemo(() => largestRemainder(cells, 100), [cells]);
  const maxP = Math.max(...cells, 1e-6);
  const done = v.phase === 'FT' || v.phase === 'closed';

  const selected = (h: number, a: number): boolean => {
    if (target.kind === 'cs') return target.cells.some(([x, y]) => x === h && y === a);
    if (target.kind === 'x12') return target.o === 1 ? h === a : a > h;
    return target.side === 'O' ? h + a > target.line : h + a < target.line;
  };
  const toggleCell = (h: number, a: number) => {
    const cur = target.kind === 'cs' ? target.cells : [];
    const has = cur.some(([x, y]) => x === h && y === a);
    setTarget({ kind: 'cs', cells: has ? cur.filter(([x, y]) => !(x === h && y === a)) : [...cur, [h, a]] });
  };
  const region = (pred: (h: number, a: number) => boolean) => setTarget({ kind: 'cs', cells: ALL.filter(([h, a]) => pred(h, a) && cellPossible(h, a, v.h, v.a)) });

  const contract = target.kind === 'cs' ? (target.cells.length ? csId(target.cells) : null) : target.kind === 'x12' ? OUTCOME_ID[target.o] : `tot:${target.line}:${target.side}`;
  const q = contract ? store.quote(contract) : null;
  const why = contract ? store.closedReason(contract) : null;
  const futures = target.kind === 'cs' ? target.cells.reduce((s, [h, a]) => s + tally[h * N + a], 0) : ALL.reduce((s, [h, a]) => s + (selected(h, a) ? tally[h * N + a] : 0), 0);
  const ask = q?.ask ?? 0;
  const { shares } = ask ? Book.sharesFor(stake, ask) : { shares: 0 };
  const pending = v.pending && contract && v.pending.contract === contract ? v.pending : null;
  const tone = v.positions.some((p) => !p.settled && p.shares > 0);

  return (
    <div className="screen maal">
      <div className="bar">
        <button className="back" aria-label="Tilbage til kampen" onClick={() => go(v.demo ? 'demo' : 'kamp')}>‹</button>
        <h1>Mål og slutresultat</h1>
        <span className="num bar-meta">{v.h}–{v.a} · {v.minute}</span>
      </div>
      <div className="scroll">
        <div className="maal-body">
          <p className="lead">Hver celle er et slutresultat. Lysstyrken er sandsynligheden, regnet fra samme model som 1X2. Vælg én celle eller en hel region.</p>
          <div className="sm" role="group" aria-label="Slutresultater: FCK nedad, BIF henad">
            <span className="sm-corner" aria-hidden="true"><small>FCK ↓</small><small>BIF →</small></span>
            {Array.from({ length: N }, (_, a) => <span key={`c${a}`} className="sm-head num bif" aria-hidden="true">{a === 5 ? '5+' : a}</span>)}
            {Array.from({ length: N }, (_, h) => (
              <div key={`r${h}`} className="sm-row">
                <span className="sm-head num fck" aria-hidden="true">{h === 5 ? '5+' : h}</span>
                {Array.from({ length: N }, (_, a) => {
                  const p = cells[h * N + a];
                  const possible = cellPossible(h, a, v.h, v.a);
                  const now = Math.min(5, v.h) === h && Math.min(5, v.a) === a;
                  const sel = selected(h, a);
                  const pl = tone && possible ? payoutAt(v, store, h, a) : null;
                  const toneCls = pl && pl.n ? (pl.pay - pl.cost >= 0.5 ? 'up' : pl.pay - pl.cost <= -0.5 ? 'down' : '') : '';
                  return (
                    <button
                      key={a}
                      className={`sm-cell ${possible ? '' : 'burnt'} ${now ? 'now' : ''} ${sel ? 'sel' : ''} ${p < CS_MIN_P ? 'thin' : ''} ${toneCls}`}
                      style={{ ['--a' as string]: possible ? (0.08 + 0.85 * (p / maxP)).toFixed(3) : '0' }}
                      disabled={!possible || done}
                      aria-pressed={sel}
                      aria-label={`${cellLabel(h, a)}: ${possible ? `${(p * 100).toFixed(1).replace('.', ',')} procent` : 'ikke længere muligt'}${pl && pl.n ? `. Din udbetaling ${fmtKr(pl.pay)}` : ''}`}
                      onClick={() => toggleCell(h, a)}
                    >
                      <span className="sm-s num">{cellLabel(h, a)}</span>
                      <span className="sm-p num">{possible ? (p >= 0.095 ? Math.round(p * 100) : (p * 100).toFixed(1).replace('.', ',')) : '–'}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {tone && <p className="sm-legend"><i className="up" /> plus · <i className="down" /> minus: din udbetaling ved hvert slutresultat, kun kontrakter der afgøres af slutresultatet alene</p>}
          <div className="chips sm-regions" role="group" aria-label="Regioner">
            <button onClick={() => region((h, a) => h - a >= 2)}>FCK med 2+</button>
            <button onClick={() => region((h, a) => h >= 1 && a >= 1)}>Begge scorer</button>
            <button onClick={() => region((h, a) => (h === 0 && a === 0) || (h === 1 && a === 1))}>0–0 eller 1–1</button>
            <button className={target.kind === 'x12' && target.o === 1 ? 'on' : ''} onClick={() => setTarget({ kind: 'x12', o: 1 })}>Uafgjort</button>
            <button className={target.kind === 'x12' && target.o === 2 ? 'on' : ''} onClick={() => setTarget({ kind: 'x12', o: 2 })}>BIF vinder</button>
            <button onClick={() => setTarget({ kind: 'cs', cells: [] })}>Ryd</button>
          </div>

          <h2 className="maal-h">Mål i alt</h2>
          <div className="ou" role="group" aria-label="Over eller under antal mål">
            {TOT_LINES.map((L) => {
              const o = v.d.totals.find((x) => x.id === `tot:${L}:O`);
              const u = v.d.totals.find((x) => x.id === `tot:${L}:U`);
              const crossed = v.d.goalsNow > L;
              return (
                <div key={L} className={`ou-line ${crossed ? 'crossed' : ''}`}>
                  <span className="ou-l num">{fmtLine(L)}</span>
                  {crossed ? <span className="ou-done">Over ✓ passeret</span> : (
                    <>
                      <button className={`num ${target.kind === 'tot' && target.line === L && target.side === 'O' ? 'on' : ''}`} onClick={() => setTarget({ kind: 'tot', line: L, side: 'O' })} aria-label={`Over ${fmtLine(L)} mål, kurs ${o?.ask}`}>Over {o?.ask}</button>
                      <button className={`num ${target.kind === 'tot' && target.line === L && target.side === 'U' ? 'on' : ''}`} onClick={() => setTarget({ kind: 'tot', line: L, side: 'U' })} aria-label={`Under ${fmtLine(L)} mål, kurs ${u?.ask}`}>Under {u?.ask}</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="maal-quote" aria-live="polite">
            {!contract ? (
              <p className="tray-note">Tryk på et slutresultat, en region eller en linje.</p>
            ) : (
              <>
                <p className="maal-fut num">≈ <b>{futures}</b> af 100 fremtider</p>
                <p className="byg-ticker num">
                  <b>{q?.label ?? ''}</b>
                  {q && <> · <b>kurs {q.ask}</b> · {q.p >= 0.095 ? Math.round(q.p * 100) : (q.p * 100).toFixed(1).replace('.', ',')} % chance{why ? '' : ` · odds ${(100 / q.ask).toFixed(2).replace('.', ',')}`}</>}
                </p>
                {target.kind === 'x12' && <p className="tray-note">Samme udbetaling som {target.o === 1 ? 'Uafgjort' : 'BIF'} i baren, til samme kurs.</p>}
                {target.kind === 'tot' && target.line === 2.5 && <p className="tray-note">Over 2,5 er kampens anden kurs: den samme som i viften og baren.</p>}
                <div className="chips" role="group" aria-label="Indsats">
                  {[25, 50, 100, 250].map((c) => <button key={c} className={c === stake ? 'on' : ''} aria-pressed={c === stake} onClick={() => setStake(c)}><span className="num">{c}</span> kr</button>)}
                </div>
                {!why && <div className="tray-pay"><span>Udbetaling ved sejr</span><b className="num">{fmtKr(shares)}</b></div>}
                {pending ? (
                  pending.state === 'lock' ? <div className="lock" role="status"><span className="lock-ring" aria-hidden="true" /> Låser kurs {pending.lockedAsk} …</div>
                  : <div className="requote"><span>Kursen flyttede sig – acceptér {pending.newAsk}?</span><button className="tray-cancel" onClick={() => store.cancelPending()}>Annullér</button><button className="tray-buy" onClick={() => store.acceptRequote()}>Acceptér</button></div>
                ) : (
                  <button className="tray-buy wide" disabled={!!why || shares < 1} onClick={() => store.requestBuy(contract, stake)}>{why ?? `Køb ${stake} kr · ved sejr ${fmtKr(shares)}`}</button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
