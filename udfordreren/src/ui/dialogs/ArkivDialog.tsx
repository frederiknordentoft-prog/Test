// Et opslag i Arkivet (spec 6.18), åbnet direkte fra en nyhed, et eftertankekort eller panelet.
// Titel og tekst vises ordret fra src/data/archive.ts — det eneste sted med rigtige navne.
import type { UiDialog } from '../../store/uiStore';
import { useUi } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Modal } from '../components/kit';
import { arkivHint, arkivNr, arkivOpslag } from '../lib/arkivHjaelp';
import { ARKIV } from '../../data/archive';

/** Selve opslaget i en dialog. `visAltid`: vis teksten, selv om opslaget ikke er låst op (fx fra eftertanken). */
export function ArkivOpslagModal({ id, onLuk, visAltid = false, visPanelLink = false, forspil = null }: {
  id: string; onLuk: () => void; visAltid?: boolean; visPanelLink?: boolean;
  /** Eftertankekortets "I virkeligheden …" (fra archive.ts) — vises over opslaget */
  forspil?: string | null;
}) {
  const ulaast = useGame((s) => s.game?.arkiv ?? []);
  const opslag = arkivOpslag(id);
  const laast = !!opslag && !visAltid && !ulaast.includes(opslag.id);
  const tilPanel = () => {
    onLuk();
    useUi.getState().setPanel('arkiv');
  };
  return (
    <Modal
      titel="Arkivet"
      onLuk={onLuk}
      testId="dialog-arkiv"
      bredde={520}
      fod={
        <>
          {visPanelLink && (
            <Btn onClick={tilPanel} testId="arkiv-til-panel">
              <Ikon navn="arkiv" /> Hele Arkivet
            </Btn>
          )}
          <Btn variant="primaer" onClick={onLuk} testId="arkiv-luk">
            Luk
          </Btn>
        </>
      }
    >
      {!opslag ? (
        <p className="text-sm text-muted">Det opslag findes ikke i Arkivet.</p>
      ) : (
        <article className="flex flex-col gap-3" data-testid={`arkiv-opslag-${opslag.id}`}>
          <header className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-line bg-panel2">
              <Ikon navn={laast ? 'laas' : 'arkiv'} farve={laast ? 'var(--color-dim)' : 'var(--color-gold)'} indre="var(--color-line)" str={24} />
            </span>
            <div className="min-w-0">
              <div className="font-pixel text-[0.65rem] font-bold uppercase tracking-widest text-dim">
                Opslag {arkivNr(opslag.id)} af {ARKIV.length}
              </div>
              <h3 className="font-pixel text-lg font-black text-ink">{laast ? '???' : opslag.titel}</h3>
            </div>
          </header>
          {laast ? (
            <p className="flex items-start gap-2 rounded-md border-2 border-dashed border-hi p-3 text-sm text-muted">
              <Ikon navn="laas" farve="var(--color-dim)" className="mt-0.5 shrink-0" /> {arkivHint(opslag.id)}
            </p>
          ) : (
            <>
              {forspil && (
                <p className="flex items-start gap-2 rounded-md border-2 border-line bg-panel2 p-3 text-sm leading-relaxed text-ink" data-testid="arkiv-forspil">
                  <Ikon navn="spoergsmaal" farve="var(--color-cyan)" indre="var(--color-line)" className="mt-0.5 shrink-0" /> {forspil}
                </p>
              )}
              <p className="rounded-md border-2 border-line bg-bg2 p-3 text-sm leading-relaxed text-ink" data-testid="arkiv-tekst">
                {opslag.tekst}
              </p>
            </>
          )}
          <p className="text-xs text-dim">Arkivet bygger på virkelige tal. Resten af spillet er fri fantasi med parodinavne.</p>
        </article>
      )}
    </Modal>
  );
}

export default function ArkivDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const id = dialog.kind === 'arkiv' ? dialog.id : '';
  const arkivTil = useGame((s) => s.settings.arkiv);
  if (!arkivTil) {
    return (
      <Modal titel="Arkivet" onLuk={onLuk} testId="dialog-arkiv" bredde={440} fod={<Btn variant="primaer" onClick={onLuk}>Luk</Btn>}>
        <p className="text-sm text-muted">Arkivet er slået fra under Indstillinger.</p>
      </Modal>
    );
  }
  return <ArkivOpslagModal id={id} onLuk={onLuk} visPanelLink />;
}
