// Personale: pladser, medarbejderkort (kompakt liste på mobil), jobannoncer i tre niveauer og kandidater.
import { useState } from 'react';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { useSmal } from '../hooks/useMedia';
import { Btn, Ikon, Panel, Tom } from '../components/kit';
import { Afsnit, Chip, Maengde, Segment } from '../components/FirmaDele';
import { KandidatKort, MedarbejderKort, MedarbejderRaekke, statusFor } from '../components/FirmaMedarbejder';
import { JOB_ADS, OFFICE_BY_ID } from '../../data/costs';
import { opgaverFor, pladser } from '../../sim/staff';
import { naesteKontor } from '../../sim/office';
import { mio } from '../format';

const ANNONCE_STJERNER = { 1: 1, 2: 2, 3: 3 } as const;
const ANNONCE_TEKST = {
  1: 'Mange ansøgere, få perler. Godt til en første ansættelse.',
  2: 'Folk fra branchen med lidt erfaring i bagagen.',
  3: 'Erfarne profiler, der kan trække et hold fra dag ét.',
} as const;

/** Valgt visning huskes, mens spillet kører (også når man skifter fane) */
let huskVisning: 'kort' | 'liste' = 'kort';

export default function StaffPanel() {
  const g = useGame((s) => s.game)!;
  const smal = useSmal();
  const [visning, saetVisning] = useState<'kort' | 'liste'>(() => huskVisning);
  const setVisning = (v: 'kort' | 'liste') => {
    huskVisning = v;
    saetVisning(v);
  };
  const listeVisning = visning === 'liste';
  const setPanel = useUi((s) => s.setPanel);
  const total = pladser(g);
  const brugt = g.staff.length;
  const fuldt = brugt >= total;
  const opgaver = opgaverFor(g);
  const loen = g.staff.reduce((a, m) => a + m.loenPrUge, 0);
  const naeste = naesteKontor(g);
  const kontor = OFFICE_BY_ID[g.kontor];
  const fuldtGrund = `Kontoret er fuldt (${brugt}/${total} pladser).${naeste ? ` Flyt i ${naeste.navn.toLowerCase()} for flere pladser.` : ''}`;

  return (
    <Panel
      titel="Personale"
      ikon="folk"
      testId="panel-personale"
      hoejre={
        <span className="flex items-center gap-1 font-pixel text-xs font-bold" style={{ color: fuldt ? 'var(--color-warn)' : 'var(--color-muted)' }} data-testid="pladser">
          <Ikon navn="folk" farve="currentColor" str={14} />
          {brugt}/{total} pladser
        </span>
      }
    >
      <div className="@container flex flex-col gap-3">
        {/* Overblik */}
        <div className="grid grid-cols-2 gap-2 rounded-md border-2 border-line bg-bg2 p-2.5 @lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 min-w-0 @lg:col-span-1">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>
                {kontor.navn}: {brugt} af {total} pladser
              </span>
            </div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: total }, (_, i) => (
                <span key={i} className="h-3 flex-1 rounded-sm border-2 border-line" style={{ background: i < brugt ? 'var(--color-sky)' : 'var(--color-bg)' }} />
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[0.68rem] uppercase tracking-wide text-muted">Løn pr. uge</div>
            <Maengde ikon="penge" farve="var(--color-gold)" className="text-sm">
              {mio(loen)}
            </Maengde>
          </div>
          <div className="min-w-0">
            <div className="text-[0.68rem] uppercase tracking-wide text-muted">Ledige lige nu</div>
            <Maengde ikon="ur" farve="var(--color-sky)" className="text-sm">
              {g.staff.filter((m) => opgaver[m.id]?.type === 'ledig').length}
            </Maengde>
          </div>
        </div>

        {/* Medarbejdere */}
        {!smal && (
          <div className="flex items-center justify-between gap-2">
            <span className="font-pixel text-xs font-black uppercase tracking-wide text-muted">Holdet ({g.staff.length})</span>
            <div className="w-44">
              <Segment
                label="Visning"
                valg={[
                  { id: 'kort', navn: 'Kort', titel: 'Alle detaljer og handlinger' },
                  { id: 'liste', navn: 'Liste', titel: 'Kompakt liste — tryk for detaljer' },
                ]}
                vaerdi={listeVisning ? 'liste' : 'kort'}
                onSkift={(v) => setVisning(v)}
                testIdPrefix="personale-visning"
              />
            </div>
          </div>
        )}
        {smal || listeVisning ? (
          <ul className="grid grid-cols-1 gap-1.5 @2xl:grid-cols-2" data-testid="medarbejderliste">
            {g.staff.map((m) => (
              <li key={m.id}>
                <MedarbejderRaekke m={m} status={statusFor(g, m.id, opgaver)} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="grid grid-cols-1 gap-2 @2xl:grid-cols-2" data-testid="medarbejderliste">
            {g.staff.map((m) => (
              <MedarbejderKort key={m.id} m={m} status={statusFor(g, m.id, opgaver)} />
            ))}
          </div>
        )}

        {/* Jobannoncer */}
        <Afsnit titel="Jobannoncer" ikon="taske" farve="var(--color-sky)" testId="jobannoncer">
          {fuldt && (
            <div className="mb-2 flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-2 text-sm @md:flex-row @md:items-center" data-testid="kontor-fuldt">
              <span className="flex min-w-0 flex-1 items-start gap-1.5">
                <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" className="mt-0.5 shrink-0" />
                <span>
                  <b>Der er ikke flere pladser.</b> {naeste ? `Flyt i ${naeste.navn.toLowerCase()} (${naeste.pladser} pladser) under Firma for at ansætte flere.` : 'I har det største kontor.'}
                </span>
              </span>
              {naeste && (
                <Btn onClick={() => setPanel('firma')} testId="til-kontor">
                  <Ikon navn="hus" farve="currentColor" str={14} /> Se kontoret
                </Btn>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 @lg:grid-cols-3">
            {JOB_ADS.map((a) => {
              const raad = g.kapital >= a.pris;
              return (
                <div key={a.niveau} className="flex flex-col gap-1.5 rounded-md border-2 border-line bg-panel p-2">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-pixel text-xs font-black uppercase">{a.navn}</span>
                    <span className="flex" aria-label={`${ANNONCE_STJERNER[a.niveau]} af 3 stjerner`}>
                      {[1, 2, 3].map((i) => (
                        <Ikon key={i} navn="stjerne" farve={i <= ANNONCE_STJERNER[a.niveau] ? 'var(--color-gold)' : 'var(--color-hi)'} str={12} />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs leading-snug text-muted">{ANNONCE_TEKST[a.niveau]}</p>
                  <div className="flex flex-wrap gap-1">
                    <Chip ikon="folk" farve="var(--color-sky)">
                      {a.antal} kandidater
                    </Chip>
                    <Chip ikon="stjerne" farve="var(--color-gold)">
                      Niv. {a.niveauMin === a.niveauMax ? a.niveauMin : `${a.niveauMin}-${a.niveauMax}`}
                    </Chip>
                    <Chip farve="var(--color-muted)" titel="Stats før rollebonus og niveau">
                      Stats {a.statMin}-{a.statMax}
                    </Chip>
                  </div>
                  {/* Fuldt kontor: en annonce ville koste penge uden at kunne føre til en ansættelse */}
                  <Btn
                    variant="primaer"
                    className="mt-auto"
                    disabled={!raad || fuldt}
                    title={fuldt ? fuldtGrund : !raad ? `Ikke råd (${mio(a.pris)})` : g.kandidater.length ? 'Erstatter de nuværende kandidater' : undefined}
                    testId={`jobannonce-${a.niveau}`}
                    onClick={() => {
                      if (useGame.getState().dispatch({ t: 'postJobAd', niveau: a.niveau })) useGame.getState().toast(`Annoncen er ude — ${a.antal} har søgt!`, 'godt');
                    }}
                  >
                    {fuldt ? 'Ingen ledige pladser' : `Slå op · ${mio(a.pris)}`}
                  </Btn>
                  {!fuldt && !raad && <span className="text-center text-[0.7rem] text-warn">Ikke råd lige nu</span>}
                </div>
              );
            })}
          </div>
          {g.kandidater.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-warn" data-testid="annonce-erstatter">
              <Ikon navn="advarsel" farve="var(--color-warn)" indre="var(--color-line)" str={12} className="shrink-0" />
              En ny annonce erstatter de {g.kandidater.length} nuværende kandidater.
            </p>
          )}
        </Afsnit>

        {/* Kandidater */}
        <Afsnit
          titel="Kandidater"
          ikon="folk"
          farve="var(--color-good)"
          testId="kandidater"
          hoejre={<span className="font-pixel text-xs text-muted">{g.kandidater.length}</span>}
        >
          {g.kandidater.length === 0 ? (
            <Tom>Ingen kandidater endnu. Slå en jobannonce op — eller mød folk på en messe.</Tom>
          ) : (
            <>
              {fuldt && (
                <p className="mb-2 flex items-center gap-1.5 text-sm text-warn">
                  <Ikon navn="laas" farve="var(--color-warn)" str={14} className="shrink-0" /> {fuldtGrund}
                </p>
              )}
              <div className="grid grid-cols-1 gap-2 @lg:grid-cols-2">
                {g.kandidater.map((k) => (
                  <KandidatKort key={k.id} k={k} fuldt={fuldt} grund={fuldtGrund} />
                ))}
              </div>
            </>
          )}
        </Afsnit>
      </div>
    </Panel>
  );
}
