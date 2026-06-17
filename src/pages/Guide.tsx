import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  GitMerge,
  Lightbulb,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import { cx } from '../lib/ui';

export default function Guide() {
  const navigate = useNavigate();
  const openObjectiveEditor = useUi((s) => s.openObjectiveEditor);
  const loadDemo = useStore((s) => s.loadDemo);
  const isEmpty = useStore((s) => s.objectives.length === 0);

  const startBlank = () => openObjectiveEditor({ level: 'company' });
  const tryDemo = async () => {
    await loadDemo();
    navigate('/');
  };

  return (
    <div className="space-y-8 pb-4">
      {/* Hero */}
      <section className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-card">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            <Sparkles size={14} /> Kom godt i gang
          </div>
          <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Sæt mål der betyder noget — og se fremdriften samle sig selv
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            OKR holder retning (Objectives) adskilt fra resultater (Key Results) og fra arbejdet
            (initiativer). Ét ugentligt check-in pr. resultat — så ruller status automatisk op gennem
            hele organisationen.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={startBlank} className="btn bg-white text-brand-700 hover:bg-white/90">
              <Plus size={16} /> Opret dit første mål
            </button>
            <button onClick={tryDemo} className="btn-accent">
              <Activity size={16} /> Indlæs eksempel-data
            </button>
          </div>
          {!isEmpty && (
            <p className="mt-3 text-xs text-white/70">
              Du har allerede data — eksempel-data erstatter det nuværende.
            </p>
          )}
        </div>
      </section>

      {/* 3-trins hurtigstart */}
      <section>
        <SectionTitle icon={<ListChecks size={18} />} title="Sådan kommer du i gang på 3 trin" />
        <div className="grid gap-4 md:grid-cols-3">
          <StepCard
            n={1}
            title="Opret et Objective"
            body="Et kvalitativt, inspirerende mål. Start på virksomhedsniveau og byg ned til tribe og team."
            example="“Spillere bliver hængende fra dag 1”"
          />
          <StepCard
            n={2}
            title="Tilføj Key Results"
            body="2–4 målbare udfald pr. Objective. Et KR er et resultat, ikke en opgave."
            example="“D1-retention fra 42% til 55%”"
          />
          <StepCard
            n={3}
            title="Lav ugentlige check-ins"
            body="Opdatér værdi + confidence på 30 sekunder. Sparklines og dashboard opdateres med det samme."
            example="Værdi 47% · confidence 0,7"
          />
        </div>
      </section>

      {/* De tre byggesten */}
      <section>
        <SectionTitle icon={<Compass size={18} />} title="De tre byggesten — hold dem adskilt" />
        <div className="grid gap-4 md:grid-cols-3">
          <ConceptCard
            tone="brand"
            icon={<Target size={20} />}
            kicker="Retning"
            title="Objective"
            q="Hvor vil vi hen?"
            body="Kvalitativt og inspirerende. Tidsbundet til en cyklus. Ikke et tal."
          />
          <ConceptCard
            tone="accent"
            icon={<TrendingUp size={20} />}
            kicker="Resultat"
            title="Key Result"
            q="Hvordan ved vi, vi er der?"
            body="Et målbart udfald med baseline → mål. Aldrig en opgave eller et initiativ."
          />
          <ConceptCard
            tone="slate"
            icon={<ListChecks size={20} />}
            kicker="Arbejde"
            title="Initiativ"
            q="Hvad gør vi?"
            body="De konkrete handlinger der driver et KR. Lever under det KR, de påvirker."
          />
        </div>
      </section>

      {/* Rytme + confidence */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <SectionTitle icon={<CalendarClock size={18} />} title="Rytmen" compact />
          <ul className="space-y-3 text-sm text-ink-soft">
            <Bullet>
              <strong>Kvartalscyklus</strong> sætter rammen. Skift cyklus i topbaren.
            </Bullet>
            <Bullet>
              <strong>Ugentligt check-in</strong> pr. Key Result holder status frisk. Et KR uden
              check-in i 7 dage markeres tydeligt.
            </Bullet>
            <Bullet>
              Check-in opdaterer KR'ets aktuelle værdi <em>og</em> en confidence-score (0–1).
            </Bullet>
          </ul>
        </div>

        <div className="card p-6">
          <SectionTitle icon={<Activity size={18} />} title="Confidence & sundhed" compact />
          <p className="mb-3 text-sm text-ink-soft">
            Hvert check-in giver en farve, så ledelsen på 5 sekunder ser, hvor det brænder:
          </p>
          <div className="space-y-2">
            <HealthRow color="green" label="På sporet" desc="Høj sikkerhed for at nå målet" />
            <HealthRow color="yellow" label="Risiko" desc="Usikkert — kræver opmærksomhed" />
            <HealthRow color="red" label="Kritisk" desc="Lav sikkerhed — handling nødvendig" />
          </div>
          <p className="mt-3 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-800">
            <Lightbulb size={13} className="mr-1 inline" />
            Strækmål (aspirational) måles mildere: 0,7 er allerede et rigtig godt resultat.
          </p>
        </div>
      </section>

      {/* Alignment */}
      <section className="card overflow-hidden">
        <div className="grid items-center gap-6 p-6 sm:grid-cols-[auto,1fr] sm:p-8">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <GitMerge size={30} />
          </div>
          <div>
            <h3 className="text-lg font-bold">Alignment & auto-rollup</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Et team-KR kan <strong>bidrage til</strong> et eller flere overordnede KR'er (mange-til-mange,
              ikke stiv cascade). Fremdriften ruller automatisk op som et vægtet gennemsnit — så en
              ændring på team-niveau forplanter sig hele vejen op til virksomhedsmålet uden manuel
              rapportering. Auto-rullede KR'er vises med en stribet fremdriftsbjælke.
            </p>
          </div>
        </div>
      </section>

      {/* Best practice */}
      <section>
        <SectionTitle icon={<CheckCircle2 size={18} />} title="Indbygget best practice" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TipRow text="Maks 3–5 Objectives pr. niveau, 2–4 KR pr. Objective — appen advarer blødt, men blokerer aldrig." />
          <TipRow text="Formulér KR'er som udfald. Skriver du “Byg…” eller “Lancér…”, nudger appen mod et resultat." />
          <TipRow text="Hold strategi (OKR) adskilt fra eksekvering (initiativer) — aldrig blandet i samme liste." />
          <TipRow text="Ingen lønkobling. OKR handler om retning og læring, ikke bonus." />
        </div>
      </section>

      {/* Afslutning CTA */}
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-surface px-6 py-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-500 text-white">
          <Target size={24} />
        </div>
        <div>
          <p className="text-lg font-bold">Klar til at sætte dine egne mål?</p>
          <p className="text-sm text-ink-muted">Start med et tomt board, eller udforsk med eksempel-data.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={startBlank} className="btn-primary">
            <Plus size={16} /> Opret Objective
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Gå til board <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex items-center gap-2', compact ? 'mb-3' : 'mb-4')}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
    </div>
  );
}

function StepCard({ n, title, body, example }: { n: number; title: string; body: string; example: string }) {
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-ink-soft">{body}</p>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-ink-muted">{example}</p>
    </div>
  );
}

function ConceptCard({
  tone,
  icon,
  kicker,
  title,
  q,
  body,
}: {
  tone: 'brand' | 'accent' | 'slate';
  icon: React.ReactNode;
  kicker: string;
  title: string;
  q: string;
  body: string;
}) {
  const tones = {
    brand: { bar: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700', icon: 'bg-brand-50 text-brand-600' },
    accent: { bar: 'bg-accent-400', chip: 'bg-accent-50 text-accent-800', icon: 'bg-accent-50 text-accent-700' },
    slate: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-ink-soft', icon: 'bg-slate-100 text-ink-soft' },
  }[tone];
  return (
    <div className="card relative overflow-hidden p-5">
      <span className={cx('absolute inset-x-0 top-0 h-1', tones.bar)} />
      <div className={cx('mb-3 grid h-10 w-10 place-items-center rounded-xl', tones.icon)}>{icon}</div>
      <span className={cx('chip', tones.chip)}>{kicker}</span>
      <h3 className="mt-2 text-lg font-bold">{title}</h3>
      <p className="text-sm font-semibold text-ink-muted">{q}</p>
      <p className="mt-2 text-sm text-ink-soft">{body}</p>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />
      <span>{children}</span>
    </li>
  );
}

function HealthRow({ color, label, desc }: { color: 'green' | 'yellow' | 'red'; label: string; desc: string }) {
  const bg = { green: 'bg-health-green', yellow: 'bg-health-yellow', red: 'bg-health-red' }[color];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
      <span className={cx('h-3 w-3 shrink-0 rounded-full', bg)} />
      <span className="text-sm font-semibold">{label}</span>
      <span className="ml-auto text-xs text-ink-muted">{desc}</span>
    </div>
  );
}

function TipRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-surface px-4 py-3">
      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-brand-500" />
      <span className="text-sm text-ink-soft">{text}</span>
    </div>
  );
}
