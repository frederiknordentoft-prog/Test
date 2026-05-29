import { useGame, Source, Target } from '../store/gameStore';
import { Card, CARD_W, CARD_H } from './Card';
import { CardId, Move, SUIT_SYMBOL, SUITS } from '../engine/types';
import { setDragSource, getDragSource } from './dnd';

const DOWN_OFFSET = 16;
const UP_OFFSET = 28;

/** Does the hint move point at this tableau card (col,idx)? */
function hintMatchesTableau(move: Move | null, col: number, idx: number, upLen: number): boolean {
  if (!move) return false;
  if (move.type === 'tf' && move.from === col && idx === upLen - 1) return true;
  if (move.type === 'tt' && move.from === col && idx === upLen - move.count) return true;
  return false;
}

function hintMatchesWaste(move: Move | null): boolean {
  return !!move && (move.type === 'wf' || move.type === 'wt');
}
function hintMatchesStock(move: Move | null): boolean {
  return !!move && (move.type === 'draw' || move.type === 'recycle');
}

export function Board() {
  const state = useGame((s) => s.state);
  const selected = useGame((s) => s.selected);
  const hintMove = useGame((s) => s.hintMove);
  const draw = useGame((s) => s.draw);
  const clickSource = useGame((s) => s.clickSource);
  const clickTarget = useGame((s) => s.clickTarget);
  const autoFoundation = useGame((s) => s.autoFoundation);

  if (!state) {
    return (
      <div className="flex h-[460px] items-center justify-center text-white/50">
        Tryk “Nyt spil” for at give kort.
      </div>
    );
  }

  const isSelected = (src: Source): boolean =>
    !!selected && JSON.stringify(selected) === JSON.stringify(src);

  const onDrop = (tgt: Target) => (e: React.DragEvent) => {
    e.preventDefault();
    const src = getDragSource();
    if (src) {
      // Reuse the click pipeline: select source then target.
      useGame.setState({ selected: src });
      clickTarget(tgt);
    }
    setDragSource(null);
  };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="select-none">
      {/* Top row: stock + waste (left), foundations (right) */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex gap-3">
          {/* Stock */}
          <div
            className="relative cursor-pointer rounded-lg border-2 border-dashed border-white/25"
            style={{ width: CARD_W, height: CARD_H }}
            onClick={draw}
            title="Træk fra talon"
          >
            {state.stock.length > 0 ? (
              <Card
                card={state.stock[state.stock.length - 1]}
                faceUp={false}
                hint={hintMatchesStock(hintMove)}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl text-white/40">↻</div>
            )}
            <span className="absolute -bottom-5 left-0 w-full text-center text-xs text-white/60">
              {state.stock.length}
            </span>
          </div>

          {/* Waste */}
          <div className="relative" style={{ width: CARD_W, height: CARD_H }}>
            {state.waste.length > 0 ? (
              <Card
                card={state.waste[state.waste.length - 1]}
                faceUp
                selected={isSelected({ kind: 'waste' })}
                hint={hintMatchesWaste(hintMove)}
                draggable
                onClick={() => clickSource({ kind: 'waste' })}
                onDoubleClick={() => autoFoundation({ kind: 'waste' })}
                onDragStart={() => setDragSource({ kind: 'waste' })}
                onDragEnd={() => setDragSource(null)}
              />
            ) : (
              <div
                className="rounded-lg border-2 border-dashed border-white/15"
                style={{ width: CARD_W, height: CARD_H }}
              />
            )}
          </div>
        </div>

        {/* Foundations */}
        <div className="flex gap-3">
          {SUITS.map((suit, si) => {
            const top = state.foundations[si];
            const card: CardId | null = top > 0 ? si * 13 + (top - 1) : null;
            return (
              <div
                key={suit}
                className="relative flex items-center justify-center rounded-lg border-2 border-white/25 text-3xl text-white/25"
                style={{ width: CARD_W, height: CARD_H }}
                onClick={() => clickTarget({ kind: 'foundation', suit: si })}
                onDrop={onDrop({ kind: 'foundation', suit: si })}
                onDragOver={allowDrop}
              >
                {card != null ? (
                  <Card
                    card={card}
                    faceUp
                    draggable
                    onClick={(e) => {
                      e.stopPropagation();
                      clickSource({ kind: 'foundation', suit: si });
                    }}
                    onDragStart={() => setDragSource({ kind: 'foundation', suit: si })}
                    onDragEnd={() => setDragSource(null)}
                  />
                ) : (
                  SUIT_SYMBOL[suit]
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tableau columns */}
      <div className="flex justify-center gap-3">
        {state.tableau.map((pile, col) => {
          const positions: number[] = [];
          let y = 0;
          for (let i = 0; i < pile.down.length; i++) {
            positions.push(y);
            y += DOWN_OFFSET;
          }
          const upStart = y;
          for (let i = 0; i < pile.up.length; i++) {
            positions.push(upStart + i * UP_OFFSET);
          }
          const colHeight = Math.max(CARD_H, (positions[positions.length - 1] ?? 0) + CARD_H);

          return (
            <div
              key={col}
              className="relative"
              style={{ width: CARD_W, height: colHeight, minHeight: CARD_H }}
              onClick={() => clickTarget({ kind: 'tableau', col })}
              onDrop={onDrop({ kind: 'tableau', col })}
              onDragOver={allowDrop}
            >
              {/* empty slot placeholder */}
              {pile.down.length === 0 && pile.up.length === 0 && (
                <div
                  className="rounded-lg border-2 border-dashed border-white/15"
                  style={{ width: CARD_W, height: CARD_H }}
                />
              )}
              {pile.down.map((c, i) => (
                <Card key={`d${i}`} card={c} faceUp={false} style={{ top: positions[i] }} />
              ))}
              {pile.up.map((c, i) => {
                const idx = i;
                const src: Source = { kind: 'tableau', col, idx };
                return (
                  <Card
                    key={`u${i}`}
                    card={c}
                    faceUp
                    selected={isSelected(src)}
                    hint={hintMatchesTableau(hintMove, col, idx, pile.up.length)}
                    draggable
                    style={{ top: positions[pile.down.length + i] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      clickSource(src);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (idx === pile.up.length - 1) autoFoundation(src);
                    }}
                    onDragStart={() => setDragSource(src)}
                    onDragEnd={() => setDragSource(null)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
