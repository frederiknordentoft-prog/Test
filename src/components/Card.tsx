import { CardId, isRed, rankLabel, suitName, SUIT_SYMBOL } from '../engine/types';

interface CardProps {
  card: CardId;
  faceUp: boolean;
  selected?: boolean;
  hint?: boolean;
  draggable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  style?: React.CSSProperties;
}

export const CARD_W = 72;
export const CARD_H = 100;

export function Card({
  card,
  faceUp,
  selected,
  hint,
  draggable,
  onClick,
  onDoubleClick,
  onDragStart,
  onDragEnd,
  style,
}: CardProps) {
  if (!faceUp) {
    return (
      <div
        className="card-anim absolute rounded-lg shadow-card"
        style={{
          width: CARD_W,
          height: CARD_H,
          background: 'repeating-linear-gradient(45deg,#0E4E3A,#0E4E3A 6px,#0a3a2a 6px,#0a3a2a 12px)',
          border: '2px solid #F5B800',
          ...style,
        }}
      />
    );
  }

  const red = isRed(card);
  const sym = SUIT_SYMBOL[suitName(card)];
  const label = rankLabel(card);

  return (
    <div
      className={`card-anim absolute select-none rounded-lg bg-white shadow-card ${
        selected ? 'ring-4 ring-brand-gold' : ''
      } ${hint ? 'ring-4 ring-sky-400 animate-pulse' : ''}`}
      style={{
        width: CARD_W,
        height: CARD_H,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      draggable={draggable}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div
        className="flex flex-col items-start px-1.5 py-1 font-semibold leading-none"
        style={{ color: red ? '#c81e3a' : '#15201b' }}
      >
        <span className="text-lg font-bold">{label}</span>
        <span className="text-base">{sym}</span>
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center text-3xl"
        style={{ color: red ? '#c81e3a' : '#15201b' }}
      >
        {sym}
      </div>
    </div>
  );
}
