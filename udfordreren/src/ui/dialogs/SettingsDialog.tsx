// Indstillinger: lyd, musik, bevægelse, tekststørrelse, auto-pauser, Arkivet og afslut til titelskærmen.
import { useState, type ReactNode } from 'react';
import type { UiDialog } from '../../store/uiStore';
import { useUi } from '../../store/uiStore';
import { useGame, type Settings } from '../../store/gameStore';
import { gem } from '../../store/persistence';
import { Btn, Ikon, Modal, type IkonNavn } from '../components/kit';
import { Kontakt } from '../components/ShellKontakt';
import { spil } from '../../audio/sfx';
import { useMedia } from '../hooks/useMedia';

// Kun pauser uden egen dialog kan slås fra. Dialoger (kvartalsmøde, messe, galla, Top 10 …) stopper altid tiden,
// mens de er åbne, og tiden kører videre, når den sidste lukkes (se useAutoFortsaet).
const AUTO_PAUSER: { k: string; navn: string; forklaring: string }[] = [
  { k: 'fase', navn: 'Fase uden hold', forklaring: 'Når et projekt går videre til en fase, hvor ingen er sat på.' },
  { k: 'klar', navn: 'Klar til lancering', forklaring: 'Når et produkt er færdigtestet.' },
  { k: 'ledig', navn: 'Ledige medarbejdere', forklaring: 'Når nogen står uden opgave, og der ikke er et projekt.' },
  { k: 'licens', navn: 'Licens godkendt', forklaring: 'Når en licens bliver aktiv. Som standard kun en besked.' },
  { k: 'advarsel', navn: 'Advarsler', forklaring: 'Fx når kassen er i minus.' },
];

const TEKST: { id: Settings['tekstStoerrelse']; navn: string; str: string }[] = [
  { id: 'normal', navn: 'Normal', str: '0.8rem' },
  { id: 'stor', navn: 'Stor', str: '0.95rem' },
  { id: 'ekstra', navn: 'Ekstra', str: '1.1rem' },
];

function Gruppe({ titel, ikon, children }: { titel: string; ikon: IkonNavn; children: ReactNode }) {
  return (
    <section className="rounded-lg border-2 border-line bg-bg2 p-3">
      <h3 className="mb-1 flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider text-muted">
        <Ikon navn={ikon} farve="var(--color-gold)" indre="var(--color-line)" /> {titel}
      </h3>
      <div className="divide-y-2 divide-line/60">{children}</div>
    </section>
  );
}

export default function SettingsDialog({ onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const settings = useGame((s) => s.settings);
  const opdater = useGame((s) => s.opdaterSettings);
  const [afslut, setAfslut] = useState(false);
  // Styresystemets "reducer bevægelse" vinder altid — så kan kontakten ikke slås fra her
  const systemReduceret = useMedia('(prefers-reduced-motion: reduce)');

  const autoPause = (k: string, til: boolean) => {
    const fra = new Set(settings.autoPauseFra);
    if (til) fra.delete(k);
    else fra.add(k);
    opdater({ autoPauseFra: [...fra] });
  };

  const afslutSpil = async () => {
    const g = useGame.getState().game;
    if (g && !g.slut) await gem('auto', g);
    onLuk();
    useUi.getState().luk();
    useGame.getState().lukSpil();
  };

  return (
    <Modal
      titel="Indstillinger"
      onLuk={onLuk}
      testId="dialog-indstillinger"
      bredde={600}
      fod={
        <Btn variant="primaer" onClick={onLuk} testId="indstillinger-luk">
          Færdig
        </Btn>
      }
    >
      <div className="flex flex-col gap-3">
        <Gruppe titel="Lyd" ikon="hoejttaler">
          <Kontakt
            til={settings.lyd}
            onSkift={(v) => {
              opdater({ lyd: v });
              if (v) setTimeout(() => spil('kasse'), 0);
            }}
            label="Lydeffekter"
            forklaring="Bobler, kasseapparat og fanfarer."
            testId="indstilling-lyd"
          />
          <Kontakt til={false} onSkift={() => {}} label="Musik" note="Snart" forklaring="Chiptune-musik kommer i en senere version." deaktiveret testId="indstilling-musik" />
        </Gruppe>

        <Gruppe titel="Visning" ikon="tekst">
          <Kontakt
            til={settings.reduceretBevaegelse || systemReduceret}
            onSkift={(v) => opdater({ reduceretBevaegelse: v })}
            label="Reduceret bevægelse"
            note={systemReduceret ? 'Enheden' : undefined}
            deaktiveret={systemReduceret}
            forklaring={
              systemReduceret
                ? 'Styres af enhedens indstilling (reducer bevægelse). Slå den fra i enhedens indstillinger for at få animationerne tilbage.'
                : 'Ingen konfetti, rystelser eller rullende ticker. Kortere animationer.'
            }
            testId="indstilling-bevaegelse"
          />
          <div className="py-2">
            <p className="text-sm font-bold">Tekststørrelse</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Tekststørrelse">
              {TEKST.map((t) => {
                const valgt = settings.tekstStoerrelse === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={valgt}
                    data-testid={`tekst-${t.id}`}
                    onClick={() => opdater({ tekstStoerrelse: t.id })}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border-2 border-line font-bold ${valgt ? 'bg-gold text-line pixel-skygge' : 'bg-panel2 text-muted hover:text-ink'}`}
                  >
                    <span style={{ fontSize: t.str }} className="font-pixel font-black">
                      Aa
                    </span>
                    <span className="text-sm">{t.navn}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <Kontakt
            til={settings.arkiv}
            onSkift={(v) => opdater({ arkiv: v })}
            label="Arkivet"
            forklaring="'I virkeligheden …'-opslag, der låses op undervejs."
            testId="indstilling-arkiv"
          />
        </Gruppe>

        <Gruppe titel="Auto-pause" ikon="klokke">
          <p className="pb-1 text-xs text-muted">
            Spillet holder pause ved disse begivenheder, til du trykker Fortsæt — eller løser dem (fx starter et produkt, når folk er ledige). Dialoger som kvartalsmøder, messer og gallaen stopper altid tiden, mens de er åbne — tiden kører videre, når du lukker dem.
          </p>
          {AUTO_PAUSER.map((a) => (
            <Kontakt
              key={a.k}
              til={!settings.autoPauseFra.includes(a.k)}
              onSkift={(v) => autoPause(a.k, v)}
              label={a.navn}
              forklaring={a.forklaring}
              testId={`autopause-${a.k}`}
            />
          ))}
        </Gruppe>

        <section className="rounded-lg border-2 border-line bg-bg2 p-3">
          <h3 className="mb-2 flex items-center gap-2 font-pixel text-xs font-bold uppercase tracking-wider text-muted">
            <Ikon navn="doer" farve="var(--color-gold)" indre="var(--color-line)" /> Spillet
          </h3>
          {afslut ? (
            <div className="flex flex-col gap-2" data-testid="afslut-bekraeft-boks">
              <p className="text-sm">Afslut til titelskærmen? Spillet gemmes i autosave, så du kan fortsætte senere.</p>
              <div className="flex flex-wrap gap-2">
                <Btn variant="fare" onClick={() => void afslutSpil()} testId="afslut-bekraeft">
                  Ja, afslut
                </Btn>
                <Btn onClick={() => setAfslut(false)} testId="afslut-fortryd">
                  Fortryd
                </Btn>
              </div>
            </div>
          ) : (
            <Btn onClick={() => setAfslut(true)} testId="afslut-spil">
              <Ikon navn="doer" /> Afslut til titelskærm
            </Btn>
          )}
        </section>
      </div>
    </Modal>
  );
}
