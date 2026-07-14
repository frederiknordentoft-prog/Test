import { useMemo, useState, type ReactNode } from 'react';
import {
  RECIPES,
  SIZE_LABELS,
  TEMP_LABELS,
  type ColdProof,
  type PlanInput,
  type Size,
  type Temp,
} from '../../lib/schedule';
import {
  defaultFinish,
  formatDayTime,
  fromDatetimeLocal,
  grams,
  toDatetimeLocal,
} from '../../lib/format';

interface Draft {
  finishAt: number;
  size: Size;
  temp: Temp;
  coldProofHours: ColdProof;
  hasActiveStarter: boolean;
}

const STEP_TITLES = ['Færdig', 'Størrelse', 'Temperatur', 'Koldhævning', 'Surdej'];

function OptionCard({
  selected,
  onClick,
  title,
  sub,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="option"
      aria-pressed={selected}
      data-selected={selected}
      onClick={onClick}
    >
      <span className="option-check" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
      <span className="option-body">
        <span className="option-title">{title}</span>
        {sub && <span className="option-sub">{sub}</span>}
        {children}
      </span>
    </button>
  );
}

export function Wizard({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: PlanInput;
  onSubmit: (input: PlanInput) => void;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({
    finishAt: initial?.finishAt ?? defaultFinish(),
    size: initial?.size ?? 'large',
    temp: initial?.temp ?? 'normal',
    coldProofHours: initial?.coldProofHours ?? 12,
    hasActiveStarter: initial?.hasActiveStarter ?? false,
  }));

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const nowFloor = useMemo(() => toDatetimeLocal(Date.now()), []);
  const last = STEP_TITLES.length - 1;

  const submit = () =>
    onSubmit({
      finishAt: draft.finishAt,
      size: draft.size,
      temp: draft.temp,
      coldProofHours: draft.coldProofHours,
      hasActiveStarter: draft.hasActiveStarter,
      delays: {},
    });

  const small = RECIPES.small;
  const large = RECIPES.large;

  return (
    <div className="wizard">
      <header className="wizard-top">
        {step > 0 ? (
          <button type="button" className="ghost-btn" onClick={() => setStep((s) => s - 1)}>
            ‹ Tilbage
          </button>
        ) : onCancel ? (
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Annullér
          </button>
        ) : (
          <span />
        )}
        <div className="dots" aria-hidden="true">
          {STEP_TITLES.map((t, i) => (
            <span key={t} className="dot" data-on={i <= step} />
          ))}
        </div>
        <span className="wizard-count" aria-hidden="true">
          {step + 1}/{STEP_TITLES.length}
        </span>
      </header>

      <div className="wizard-stage" key={step}>
        {step === 0 && (
          <section className="step">
            <p className="eyebrow">Trin 1</p>
            <h1 className="step-title">Hvornår skal brødet være færdigt?</h1>
            <p className="step-lead">Vælg dato og klokkeslæt. Vi regner resten baglæns.</p>
            <input
              className="time-input"
              type="datetime-local"
              value={toDatetimeLocal(draft.finishAt)}
              min={nowFloor}
              onChange={(e) => {
                const t = fromDatetimeLocal(e.target.value);
                if (Number.isFinite(t)) patch({ finishAt: t });
              }}
            />
            <p className="step-preview">🍞 Færdigt {formatDayTime(draft.finishAt)}</p>
          </section>
        )}

        {step === 1 && (
          <section className="step">
            <p className="eyebrow">Trin 2</p>
            <h1 className="step-title">Vælg størrelse</h1>
            <div className="options">
              <OptionCard
                selected={draft.size === 'small'}
                onClick={() => patch({ size: 'small' })}
                title={SIZE_LABELS.small}
              >
                <span className="option-sub">
                  {grams(small.starter)} surdej · {grams(small.water)} vand · {grams(small.flour)} mel ·{' '}
                  {grams(small.salt)} salt
                </span>
              </OptionCard>
              <OptionCard
                selected={draft.size === 'large'}
                onClick={() => patch({ size: 'large' })}
                title={SIZE_LABELS.large}
              >
                <span className="option-sub">
                  {grams(large.starter)} surdej · {grams(large.water)} vand · {grams(large.flour)} mel ·{' '}
                  {grams(large.salt)} salt
                </span>
              </OptionCard>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="step">
            <p className="eyebrow">Trin 3</p>
            <h1 className="step-title">Temperatur i køkkenet</h1>
            <p className="step-lead">Varmen styrer, hvor hurtigt dejen og surdejen hæver.</p>
            <div className="options">
              {(['cool', 'normal', 'warm'] as Temp[]).map((t) => (
                <OptionCard
                  key={t}
                  selected={draft.temp === t}
                  onClick={() => patch({ temp: t })}
                  title={TEMP_LABELS[t]}
                />
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="step">
            <p className="eyebrow">Trin 4</p>
            <h1 className="step-title">Koldhævning</h1>
            <p className="step-lead">Hvor længe skal dejen hvile koldt i køleskabet?</p>
            <div className="options">
              {([8, 12, 16] as ColdProof[]).map((h) => (
                <OptionCard
                  key={h}
                  selected={draft.coldProofHours === h}
                  onClick={() => patch({ coldProofHours: h })}
                  title={`${h} timer`}
                  sub={h === 8 ? 'Kortere · mildere smag' : h === 16 ? 'Længere · mere syrlig' : 'Et godt udgangspunkt'}
                />
              ))}
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="step">
            <p className="eyebrow">Trin 5</p>
            <h1 className="step-title">Har du allerede en aktiv surdej?</h1>
            <p className="step-lead">
              Er din surdej boblende og klar nu, springer vi fodring og aktivering over.
            </p>
            <div className="options">
              <OptionCard
                selected={!draft.hasActiveStarter}
                onClick={() => patch({ hasActiveStarter: false })}
                title="Nej – jeg fodrer den nu"
                sub="Planen starter med at fodre surdejen"
              />
              <OptionCard
                selected={draft.hasActiveStarter}
                onClick={() => patch({ hasActiveStarter: true })}
                title="Ja – den er boblende og klar"
                sub="Vi springer aktiveringen over"
              />
            </div>
          </section>
        )}
      </div>

      <footer className="wizard-bottom">
        {step < last ? (
          <button type="button" className="primary-btn" onClick={() => setStep((s) => s + 1)}>
            Næste
          </button>
        ) : (
          <button type="button" className="primary-btn" onClick={submit}>
            Beregn min bageplan
          </button>
        )}
      </footer>
    </div>
  );
}
