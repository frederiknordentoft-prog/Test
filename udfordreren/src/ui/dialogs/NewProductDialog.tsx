// Nyt produkt (spec 6.2): type × tema × markeder, margin, intensitet, budget og navn — trin for trin på én skærm.
// 2.0-tilstand (dialog.efterfoelgerAf): type og tema låst til originalen, +20 % forspring, −30 % ved for tidlig relancering.
import { useMemo, useState } from 'react';
import type { GameState, LiveProduct, MarketId, ProductTypeId, Project, ThemeId } from '../../sim/types';
import type { UiDialog } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { budgetFaktor, datoTekst, komboInfo, maxProjekter, minBudget, SPILBARE_MARKEDER, temaStatus, typeStatus } from '../../sim/selectors';
import { PRODUCT_TYPES, PRODUCT_TYPE_IDS } from '../../data/productTypes';
import { THEMES, THEME_IDS } from '../../data/themes';
import { VERTICALS } from '../../data/verticals';
import { MARKETS } from '../../data/markets';
import { BALANCE } from '../../data/balance';
import { Btn, Ikon, Modal } from '../components/kit';
import { Afsnit, DevStil, FitMaerke, MarkeretSkyder, Segment } from '../components/DevDele';
import {
  INTENSITET_NAVN,
  efterfoelgerInfo,
  foreslaaNavn,
  levetidTekst,
  licensInfo,
  marginInterval,
  pctKort,
  udviklingsUger,
  ugerTekst,
} from '../lib/devHjaelp';
import { fortegn, mio } from '../format';
import { alleOptaget } from '../lib/shellHjaelp';

type Intensitet = Project['intensitet'];

function standardType(g: GameState): ProductTypeId {
  const ok = PRODUCT_TYPE_IDS.filter((t) => typeStatus(g, t).ok);
  return ok.find((t) => PRODUCT_TYPES[t].vertikal === g.startVertikal) ?? ok[0] ?? 'prematch';
}

/** Et naturligt første tema: sport til betting, ellers et ikke-sportstema (ingen afsløring af kombinationsbogen) */
function standardTema(g: GameState, typeId: ProductTypeId): ThemeId {
  const ok = THEME_IDS.filter((t) => temaStatus(g, t).ok);
  const sport = PRODUCT_TYPES[typeId].vertikal === 'betting';
  return ok.find((t) => THEMES[t].sport === sport) ?? ok[0] ?? 'fodbold';
}

function efterfoelgerNavn(o: LiveProduct): string {
  const basis = o.navn.replace(/\s+\d+\.0$/, '');
  return `${basis} ${o.version + 1}.0`;
}

function afrund(v: number, trin: number): number {
  return Math.round(v / trin) * trin;
}

/** Budgettrin i fordoblinger (×1, ×2, ×4, ×8) plus loftet, hvor pointfaktoren når sit maksimum.
 *  Effekten er logaritmisk, så en lineær skyder op til hele kassen ville brænde penge af for næsten ingenting. */
function budgetTrin(minB: number, kapital: number): { budget: number; gange: number; faktor: number }[] {
  const loft = Math.pow(2, (BALANCE.budgetMax - 1) / BALANCE.budgetLog);
  const gange = [1, 2, 4, 8, loft];
  const ud = gange
    .map((x) => {
      const budget = x === 1 ? minB : afrund(minB * x, 0.005);
      return { budget, gange: x, faktor: budgetFaktor(budget, minB) };
    })
    .filter((t, i) => i === 0 || t.budget <= kapital);
  return ud;
}

function Effekt({ tekst, vaerdi, god }: { tekst: string; vaerdi: number; god: boolean }) {
  const neutral = Math.abs(vaerdi) < 0.005;
  const farve = neutral ? 'var(--color-muted)' : god ? 'var(--color-good)' : 'var(--color-bad)';
  return (
    <span className="inline-flex items-center gap-1 rounded border-2 border-line bg-bg2 px-1.5 py-0.5 text-[0.7rem]">
      {!neutral && <Ikon navn={vaerdi > 0 ? 'op' : 'ned'} farve={farve} str={10} />}
      <span className="text-muted">{tekst}</span>
      <b className="tal" style={{ color: farve }}>
        {neutral ? '±0 %' : `${fortegn(vaerdi * 100)} %`}
      </b>
    </span>
  );
}

function TypeKort({ g, t, valgt, onVaelg }: { g: GameState; t: ProductTypeId; valgt: boolean; onVaelg: () => void }) {
  const def = PRODUCT_TYPES[t];
  const st = typeStatus(g, t);
  const v = VERTICALS[def.vertikal];
  return (
    <button
      type="button"
      onClick={onVaelg}
      disabled={!st.ok}
      aria-pressed={valgt}
      data-testid={`type-${t}`}
      title={st.ok ? def.beskrivelse : st.grund}
      className={`relative flex min-w-0 flex-col items-stretch overflow-hidden rounded-md border-2 border-line text-left transition-transform ${
        valgt
          ? 'min-h-[88px] bg-hi pixel-skygge outline-2 outline-gold'
          : st.ok
            ? 'min-h-[88px] bg-panel2 hover:bg-hi active:translate-y-[1px]'
            : 'min-h-[60px] cursor-not-allowed bg-bg2 opacity-55'
      }`}
    >
      <span className="h-1.5 w-full shrink-0 border-b-2 border-line" style={{ background: st.ok ? v.farve : 'var(--color-dim)' }} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 px-2 py-1.5">
        <span className="flex items-center gap-1">
          {!st.ok && <Ikon navn="laas" farve="var(--color-dim)" str={12} className="shrink-0" />}
          {valgt && <Ikon navn="flueben" farve="var(--color-gold)" str={12} className="shrink-0" />}
          <span className="truncate font-pixel text-[0.78rem] font-bold text-ink">{def.navn}</span>
          <span className="tal ml-auto shrink-0 font-pixel text-[0.62rem] text-muted" title="Typeniveau">
            N{g.niveauer.type[t]}
          </span>
        </span>
        {st.ok ? (
          <>
            <span className="text-[0.68rem] font-bold" style={{ color: v.farve }}>
              {v.kort} <span className="tal font-normal text-muted">· margin {marginInterval(t)}</span>
            </span>
            <span className="text-[0.68rem] text-muted" title="Halveringstid: så længe holder produktet sig friskt">
              Levetid {levetidTekst(def.halveringstidUger)}
            </span>
            <span className="tal text-[0.68rem] text-muted" title="Koncept + design + teknik + test (uger)">
              Faser {BALANCE.koncetUger}+{def.designUger}+{def.teknikUger}+{BALANCE.testUger} = {udviklingsUger(t)} uger
            </span>
            <span className="tal text-[0.68rem] text-dim">Fra {mio(minBudget(g, t))}</span>
          </>
        ) : (
          <span className="line-clamp-2 text-[0.68rem] leading-snug text-muted">{st.grund}</span>
        )}
      </span>
    </button>
  );
}

function TemaKort({ g, typeId, t, valgt, onVaelg }: { g: GameState; typeId: ProductTypeId; t: ThemeId; valgt: boolean; onVaelg: () => void }) {
  const def = THEMES[t];
  const st = temaStatus(g, t);
  const k = komboInfo(g, typeId, t);
  return (
    <button
      type="button"
      onClick={onVaelg}
      disabled={!st.ok}
      aria-pressed={valgt}
      data-testid={`tema-${t}`}
      title={st.ok ? (k.set ? `${PRODUCT_TYPES[typeId].navn} × ${def.navn}: ${k.fitNavn}` : 'Kombinationen er ikke prøvet endnu') : st.grund}
      className={`flex min-h-[64px] min-w-0 flex-col gap-1 rounded-md border-2 border-line px-2 py-1.5 text-left ${
        valgt ? 'bg-hi pixel-skygge outline-2 outline-gold' : st.ok ? 'bg-panel2 hover:bg-hi' : 'cursor-not-allowed bg-bg2 opacity-55'
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-sm border-2 border-line"
          style={{ background: st.ok ? def.farve : 'var(--color-dim)' }}
          aria-hidden
        />
        {valgt && <Ikon navn="flueben" farve="var(--color-gold)" str={12} className="shrink-0" />}
        <span className="truncate font-pixel text-[0.75rem] font-bold text-ink">{def.navn}</span>
        <span className="tal ml-auto shrink-0 font-pixel text-[0.62rem] text-muted" title="Temaniveau">
          N{g.niveauer.tema[t]}
        </span>
      </span>
      {st.ok ? (
        <span className="flex flex-wrap items-center gap-1">
          <FitMaerke fit={k.fit} lille />
          {k.set && <span className="tal font-pixel text-[0.65rem] font-bold text-gold">{k.bedste40}/40</span>}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[0.68rem] text-muted">
          <Ikon navn="laas" farve="var(--color-dim)" str={10} /> {st.grund}
        </span>
      )}
    </button>
  );
}

function MarkedValg({ g, typeId, markeder, onSkift }: { g: GameState; typeId: ProductTypeId; markeder: MarketId[]; onSkift: (m: MarketId[]) => void }) {
  const v = PRODUCT_TYPES[typeId].vertikal;
  return (
    <div className="flex flex-col gap-1.5">
      {SPILBARE_MARKEDER.map((m) => {
        const lic = licensInfo(g, v, m);
        const kan = lic.status !== 'ingen';
        const valgt = kan && markeder.includes(m);
        return (
          <button
            key={m}
            type="button"
            role="checkbox"
            aria-checked={valgt}
            disabled={!kan}
            data-testid={`marked-${m}`}
            onClick={() => onSkift(valgt ? markeder.filter((x) => x !== m) : [...markeder, m])}
            className={`flex min-h-[44px] items-center gap-2 rounded-md border-2 border-line px-2 py-1.5 text-left ${valgt ? 'bg-hi' : 'bg-panel2'} disabled:cursor-not-allowed disabled:opacity-55`}
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-line ${valgt ? 'bg-gold' : 'bg-bg'}`}>
              {valgt && <Ikon navn="flueben" farve="var(--color-line)" str={14} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink">
                {MARKETS[m].navn} <span className="font-pixel text-xs text-muted">({MARKETS[m].kort})</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                {lic.status === 'aktiv' && (
                  <>
                    <Ikon navn="flueben" farve="var(--color-good)" str={10} /> <span className="text-good">Licens aktiv</span>
                  </>
                )}
                {lic.status === 'ansoegt' && (
                  <>
                    <Ikon navn="ur" farve="var(--color-warn)" indre="var(--color-line)" str={10} />
                    <span className="text-warn">Licens klar om {ugerTekst(lic.uger)} — I kan udvikle imens</span>
                  </>
                )}
                {lic.status === 'ingen' && (
                  <>
                    <Ikon navn="laas" farve="var(--color-dim)" str={10} />
                    <span className="text-muted">Ingen {VERTICALS[v].kort.toLowerCase()}-licens — søg under Marked</span>
                  </>
                )}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-[0.7rem] text-dim">Flere markeder åbner senere i spillet.</p>
    </div>
  );
}

export default function NewProductDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const efterfoelgerAf = dialog.kind === 'nytProdukt' ? dialog.efterfoelgerAf : undefined;
  const original = g && efterfoelgerAf ? g.produkter.find((p) => p.id === efterfoelgerAf && p.ejer === 'spiller') : undefined;

  const [begyndelse] = useState(() => {
    const t: ProductTypeId = original?.typeId ?? (g ? standardType(g) : 'prematch');
    const th: ThemeId = original?.themeId ?? (g ? standardTema(g, t) : 'fodbold');
    return { t, th };
  });
  const [typeId, setTypeId] = useState<ProductTypeId>(begyndelse.t);
  const [themeId, setThemeId] = useState<ThemeId>(begyndelse.th);
  const [markeder, setMarkeder] = useState<MarketId[]>(() => ['dk']);
  const [margin, setMargin] = useState<number>(() => original?.margin ?? PRODUCT_TYPES[begyndelse.t].marginStd);
  const [intensitet, setIntensitet] = useState<Intensitet>(() => original?.intensitet ?? 3);
  const [budgetValg, setBudgetValg] = useState(0);
  const [navn, setNavn] = useState<string>(() => (original ? efterfoelgerNavn(original) : foreslaaNavn(begyndelse.t, begyndelse.th)));
  const [navnRoert, setNavnRoert] = useState(false);

  const type = PRODUCT_TYPES[typeId];
  const minB = g ? minBudget(g, typeId) : 0.15;
  const trinListe = budgetTrin(minB, g?.kapital ?? minB);
  const trinIdx = Math.min(budgetValg, trinListe.length - 1);
  const budgetVist = trinListe[trinIdx].budget;
  const faktor = budgetFaktor(budgetVist, minB);

  const sorteredeTyper = useMemo(() => {
    if (!g) return PRODUCT_TYPE_IDS;
    return [...PRODUCT_TYPE_IDS].sort((a, b) => Number(typeStatus(g, b).ok) - Number(typeStatus(g, a).ok));
  }, [g]);

  if (!g) return null;

  const vaelgType = (t: ProductTypeId) => {
    if (t === typeId) return;
    setTypeId(t);
    setMargin(PRODUCT_TYPES[t].marginStd);
    setBudgetValg(0);
    if (!navnRoert) setNavn(foreslaaNavn(t, themeId));
    const v = PRODUCT_TYPES[t].vertikal;
    setMarkeder(SPILBARE_MARKEDER.filter((m) => g.markeder[m].vertikaler[v].status !== 'ingen'));
  };
  const vaelgTema = (t: ThemeId) => {
    if (t === themeId) return;
    setThemeId(t);
    if (!navnRoert) setNavn(foreslaaNavn(typeId, t));
  };

  const v = type.vertikal;
  const gyldigeMarkeder = markeder.filter((m) => g.markeder[m].vertikaler[v].status !== 'ingen');
  const ts = typeStatus(g, typeId);
  const th = temaStatus(g, themeId);
  const max = maxProjekter(g);
  const grund = (() => {
    if (g.projekter.length >= max) return `Kontoret har plads til ${max} projekt${max === 1 ? '' : 'er'} ad gangen.`;
    if (!ts.ok) return ts.grund;
    if (!th.ok) return th.grund;
    if (gyldigeMarkeder.length === 0) return 'Vælg mindst ét marked.';
    if (g.kapital < minB) return `Der er ikke råd: budgettet skal være mindst ${mio(minB)}, og kassen har ${mio(g.kapital)}.`;
    return undefined;
  })();

  const start = () => {
    if (grund) return;
    const ok = useGame.getState().dispatch({
      t: 'startProject',
      project: {
        navn: navn.trim() || foreslaaNavn(typeId, themeId),
        typeId,
        themeId,
        markeder: gyldigeMarkeder,
        margin,
        intensitet,
        budget: Math.round(budgetVist * 1000) / 1000,
        efterfoelgerAf: original?.id,
      },
    });
    if (ok) {
      useUi.getState().setPanel('projekter');
      onLuk();
    }
  };

  // Afledte effekter (spejler kunde- og anmeldelsesformlerne)
  const marginRatio = margin / type.marginStd;
  const bsiEffekt = Math.pow(marginRatio, 0.85) - 1;
  const forbrugerEffekt = Math.pow(1 / marginRatio, 0.6) - 1;
  const churnEffekt = Math.max(0.5, 1 + 1.2 * (marginRatio - 1)) - 1;
  const iDelta = intensitet - 3;
  const kombi = komboInfo(g, typeId, themeId);
  const uger = udviklingsUger(typeId);
  const efter = original ? efterfoelgerInfo(g, original) : null;
  const lanceresOmkring = g.uge + uger;
  const optaget = alleOptaget(g);
  const andelAfKassen = g.kapital > 0 ? budgetVist / g.kapital : 1;
  const tidligVedLancering = original ? lanceresOmkring - original.lanceretUge < 52 : false;

  const sammendrag = (
    <div className="min-w-0 flex-1 basis-full text-xs text-muted sm:basis-auto" data-testid="nyt-produkt-sammendrag">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <b className="font-pixel text-ink">{type.navn}</b>
        <span aria-hidden>×</span>
        <b className="font-pixel text-ink">{THEMES[themeId].navn}</b>
        <FitMaerke fit={kombi.fit} lille />
      </div>
      <div className="tal mt-0.5">
        {gyldigeMarkeder.map((m) => MARKETS[m].kort).join(', ') || 'Intet marked'} · {pctKort(margin)} · int. {intensitet} · {mio(budgetVist)} · ca. {uger} uger
      </div>
      {grund && (
        <div className="mt-0.5 flex items-center gap-1 font-bold text-warn" data-testid="start-grund">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} className="shrink-0" />
          {grund}
        </div>
      )}
      {!grund && optaget && (
        <div className="mt-0.5 flex items-center gap-1 font-bold text-warn" data-testid="start-optaget">
          <Ikon navn="ur" farve="var(--color-warn)" indre="var(--color-line)" str={12} className="shrink-0" />
          {optaget.navne} er på opgave i {ugerTekst(optaget.uger)} — projektet står stille så længe.
        </div>
      )}
    </div>
  );

  const nr = original ? { marked: '2', navn: '3', margin: '4', inten: '5', budget: '6' } : { marked: '3', margin: '4', inten: '5', budget: '6', navn: '7' };
  const efterSektion =
    original && efter ? (
      <Afsnit nr="1" titel="Efterfølger">
        <div className="rounded-md border-2 border-line bg-panel2 p-3" data-testid="efterfoelger-info">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Ikon navn="laas" farve="var(--color-muted)" str={12} />
            <b className="text-ink">{PRODUCT_TYPES[original.typeId].navn}</b> ×<b className="text-ink">{THEMES[original.themeId].navn}</b>
            <FitMaerke fit={kombi.fit} lille />
          </p>
          <p className="mt-1 text-xs text-muted">Type og tema følger originalen, som lukkes, når {original.version + 1}.0 lanceres.</p>
          <div className="mt-2 flex items-start gap-2 rounded border-2 border-line bg-good/15 p-2 text-sm">
            <Ikon navn="op" farve="var(--color-good)" className="mt-0.5 shrink-0" />
            <span>
              <b className="text-good">+20 % forspring:</b> projektet starter med en femtedel af originalens parametre.
            </span>
          </div>
          {tidligVedLancering ? (
            <div className="mt-2 flex items-start gap-2 rounded border-2 border-line bg-bad/15 p-2 text-sm" data-testid="efterfoelger-advarsel">
              <Ikon navn="advarsel" farve="var(--color-bad)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
              <span>
                <b className="text-bad">For tidligt?</b> Originalen er kun {ugerTekst(efter.uger)} gammel. Lanceres {original.version + 1}.0 før{' '}
                <b className="text-ink">{datoTekst(original.lanceretUge + 52)}</b>, trækker anmelderne <b className="text-bad">30 %</b> fra. Udviklingen tager
                ca. {uger} uger.
              </span>
            </div>
          ) : (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-good">
              <Ikon navn="flueben" farve="var(--color-good)" str={12} /> Originalen er {ugerTekst(efter.uger)} gammel — ingen straf for tidlig relancering.
            </p>
          )}
        </div>
      </Afsnit>
    ) : null;
  const typeTemaSektion = (
    <>
      <Afsnit nr="1" titel="Produkttype" hoejre={<span className="text-[0.7rem] text-dim">N = typeniveau</span>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="type-grid">
          {sorteredeTyper.map((t) => (
            <TypeKort key={t} g={g} t={t} valgt={t === typeId} onVaelg={() => vaelgType(t)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{type.beskrivelse}</p>
      </Afsnit>
      <Afsnit nr="2" titel="Tema" hoejre={<span className="text-[0.7rem] text-dim">Kombinationsbogen for {type.navn}</span>}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" data-testid="tema-grid">
          {THEME_IDS.map((t) => (
            <TemaKort key={t} g={g} typeId={typeId} t={t} valgt={t === themeId} onVaelg={() => vaelgTema(t)} />
          ))}
        </div>
      </Afsnit>
    </>
  );
  const markedSektion = (
    <Afsnit nr={nr.marked} titel="Markeder">
      <MarkedValg g={g} typeId={typeId} markeder={gyldigeMarkeder} onSkift={setMarkeder} />
    </Afsnit>
  );
  const marginSektion = (
    <Afsnit nr={nr.margin} titel="Margin">
      <MarkeretSkyder
        label={`Husets andel (${type.navn})`}
        min={type.marginMin}
        max={type.marginMax}
        trin={0.001}
        vaerdi={margin}
        onSkift={(x) => setMargin(Math.round(x * 1000) / 1000)}
        vis={pctKort(margin)}
        markoer={type.marginStd}
        markoerTekst={`Std. ${pctKort(type.marginStd)}`}
        minTekst={pctKort(type.marginMin)}
        maxTekst={pctKort(type.marginMax)}
        testId="margin"
      />
      <div className="mt-1.5 flex flex-wrap gap-1" data-testid="margin-effekter">
        <Effekt tekst="BSI/kunde" vaerdi={bsiEffekt} god={bsiEffekt > 0} />
        <Effekt tekst="Forbrugerposten" vaerdi={forbrugerEffekt} god={forbrugerEffekt > 0} />
        <Effekt tekst="Churn" vaerdi={churnEffekt} god={churnEffekt < 0} />
      </div>
      <p className="mt-1 text-[0.7rem] text-dim">Højere margin giver mere BSI pr. kunde, men Forbrugerposten giver lavere score, og flere kunder smutter.</p>
    </Afsnit>
  );
  const intensitetSektion = (
    <Afsnit nr={nr.inten} titel="Intensitet" hoejre={<span className="font-pixel text-xs font-bold text-gold">{INTENSITET_NAVN[intensitet]}</span>}>
      <Segment<Intensitet>
        label="Intensitet"
        valg={([1, 2, 3, 4, 5] as const).map((i) => ({ id: i, navn: i, titel: INTENSITET_NAVN[i] }))}
        vaerdi={intensitet}
        onSkift={setIntensitet}
        testIdPrefix="intensitet"
      />
      <div className="mt-1.5 flex flex-wrap gap-1" data-testid="intensitet-effekter">
        <Effekt tekst="BSI/kunde" vaerdi={0.07 * iDelta} god={iDelta > 0} />
        <Effekt tekst="Spillerforum" vaerdi={0.03 * iDelta} god={iDelta > 0} />
        <Effekt tekst="Tilsynet" vaerdi={-0.06 * iDelta} god={iDelta < 0} />
        <Effekt tekst="Fejl" vaerdi={0.1 * iDelta} god={iDelta < 0} />
      </div>
      <p className="mt-1 text-[0.7rem] text-dim">Mere tempo og nerve giver engagement og BSI. Tilsynet kigger til gengæld strengere på det.</p>
    </Afsnit>
  );
  const budgetSektion = (
    <Afsnit nr={nr.budget} titel="Budget">
      <MarkeretSkyder
        label="Udviklingsbudget"
        min={0}
        max={trinListe.length - 1}
        trin={1}
        vaerdi={trinIdx}
        onSkift={(x) => setBudgetValg(Math.round(x))}
        vis={mio(budgetVist)}
        testId="budget"
      />
      <div className="relative -mt-0.5 h-8 text-[0.66rem] leading-tight" aria-hidden data-testid="budget-trin">
        {trinListe.map((t, i) => {
          const pos = trinListe.length > 1 ? i / (trinListe.length - 1) : 0;
          const sidst = i === trinListe.length - 1 && i > 0;
          return (
            <span
              key={i}
              className={`tal absolute flex flex-col whitespace-nowrap ${i === 0 ? 'items-start' : sidst ? 'items-end' : 'items-center'} ${i === trinIdx ? 'font-bold text-gold' : 'text-dim'}`}
              style={i === 0 ? { left: 0 } : sidst ? { right: 0 } : { left: `calc(${pos} * (100% - 16px) + 8px)`, transform: 'translateX(-50%)' }}
            >
              <span>{t.gange === 1 ? 'Min.' : t.gange > 8 ? 'Maks' : `×${t.gange}`}</span>
              <span>+{Math.round((t.faktor - 1) * 100)} %</span>
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1 text-muted">
          <Ikon navn="lyn" farve="var(--color-gold)" str={12} />
          Pointfaktor{' '}
          <b className="tal font-pixel text-gold" data-testid="budget-faktor">
            ×{faktor.toFixed(2).replace('.', ',')}
          </b>
          <span className="text-dim">(maks ×{BALANCE.budgetMax.toFixed(1).replace('.', ',')})</span>
        </span>
        <span className={`tal ${g.kapital - budgetVist < 0.3 ? 'text-warn' : 'text-muted'}`}>Kassen bagefter: {mio(g.kapital - budgetVist)}</span>
      </div>
      {trinIdx > 0 && andelAfKassen > 0.3 && (
        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-warn" data-testid="budget-advarsel">
          <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} /> Det er {Math.round(andelAfKassen * 100)} % af kassen — for {Math.round((faktor - 1) * 100)} % flere point.
        </p>
      )}
      <p className="mt-1 text-[0.7rem] text-dim">Hver fordobling af budgettet giver ca. +12 % point i alle faser — op til +40 %.</p>
    </Afsnit>
  );
  const navnSektion = (
    <Afsnit nr={nr.navn} titel="Navn">
      <div className="flex gap-2">
        <input
          type="text"
          value={navn}
          maxLength={32}
          onChange={(e) => {
            setNavn(e.target.value);
            setNavnRoert(true);
          }}
          aria-label="Produktnavn"
          data-testid="produkt-navn"
          className="min-h-[44px] min-w-0 flex-1 rounded-md border-2 border-line bg-bg px-3 font-pixel font-bold text-ink outline-none focus:border-gold"
        />
        <Btn
          onClick={() => {
            setNavn(original ? efterfoelgerNavn(original) : foreslaaNavn(typeId, themeId));
            setNavnRoert(false);
          }}
          ariaLabel="Foreslå navn"
          title="Foreslå navn"
          testId="foreslaa-navn"
          className="w-[44px] shrink-0 px-0"
        >
          <Ikon navn="terning" farve="var(--color-line)" indre="var(--color-ink)" str={28} />
        </Btn>
      </div>
    </Afsnit>
  );

  return (
    <Modal
      titel={original ? `${original.navn}: ny version` : 'Nyt produkt'}
      onLuk={onLuk}
      testId="dialog-nytProdukt"
      bredde={original ? 900 : 1060}
      fod={
        <div className="flex w-full flex-wrap items-center gap-2">
          {sammendrag}
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Btn variant="ghost" onClick={onLuk} className="flex-1 sm:flex-none">
              Annullér
            </Btn>
            <Btn variant="primaer" onClick={start} disabled={!!grund} testId="start-udvikling" title={grund} className="flex-[2] sm:flex-none">
              <Ikon navn="play" /> Start udvikling
            </Btn>
          </div>
        </div>
      }
    >
      <DevStil />
      {efterSektion ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-5">
            {efterSektion}
            {markedSektion}
            {navnSektion}
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            {marginSektion}
            {intensitetSektion}
            {budgetSektion}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">{typeTemaSektion}</div>
          <div className="flex min-w-0 flex-col gap-5">
            {markedSektion}
            {marginSektion}
            {intensitetSektion}
            {budgetSektion}
            {navnSektion}
          </div>
        </div>
      )}
    </Modal>
  );
}
