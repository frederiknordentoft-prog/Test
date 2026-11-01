import { motion } from 'motion/react';
import { Ladder } from '../components/Ladder';
import { PriceFactLine } from '../components/PriceFactLine';
import { RuleBlock } from '../components/RuleBlock';
import type { Market, Selection } from '../data/catalog';
import { formatOdds, type OddsFormat } from '../odds/format';

interface Props {
  market: Market;
  pickedIds: Set<string>;
  onPick: (s: Selection) => void;
  format: OddsFormat;
  onFormat: (f: OddsFormat) => void;
  priceMinute: number | null;
}

const FORMATS: { id: OddsFormat; label: string }[] = [
  { id: 'decimal', label: 'Decimal' },
  { id: 'fraction', label: 'Brøk' },
  { id: 'american', label: 'Amerikansk' },
];

export function MarketDetail({ market, pickedIds, onPick, format, onFormat, priceMinute }: Props) {
  return (
    <section aria-label={market.title}>
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{market.league}</div>
      <h1 style={{ fontSize: 22, letterSpacing: '-0.02em', margin: '4px 0 12px' }}>{market.title}</h1>

      <div className="seg" role="group" aria-label="Oddsformat" style={{ marginBottom: 12 }}>
        {FORMATS.map((f) => (
          <button key={f.id} aria-pressed={format === f.id} onClick={() => onFormat(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {market.live && priceMinute !== null && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '0 0 10px' }}>
          Priser fra model kl. {priceMinute}' · opdateres højst hvert 10. sekund
        </p>
      )}

      {market.layout === 'ladder' ? (
        <Ladder market={market} onPick={onPick} pickedIds={pickedIds} />
      ) : (
        <div className="choices" role="group" aria-label="Valg">
          {market.selections.map((s) => (
            <button key={s.id} className="choice" aria-pressed={pickedIds.has(s.id)} onClick={() => onPick(s)}>
              <span className="label">{s.label}</span>
              <motion.span
                key={formatOdds(s.odds, format)}
                className="odds num"
                initial={{ opacity: 0.35 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                {formatOdds(s.odds, format)}
              </motion.span>
              <span className="label num">{Math.round(s.prob * 100)} %</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <PriceFactLine market={market} />
      </div>

      <div className="section-title">Regler</div>
      <RuleBlock rules={market.rules} />
    </section>
  );
}
