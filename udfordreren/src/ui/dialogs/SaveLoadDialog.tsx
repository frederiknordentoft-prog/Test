// Gem og indlæs: 3 pladser + autosave, eksport/import som JSON. Virker både i spillet og fra titelskærmen.
// Hærdet til iOS/iPad og private vinduer: uden lokal lagring kan man stadig eksportere og importere, og en korrupt
// eller fremmed fil giver en venlig forklaring i stedet for et nedbrud.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiDialog } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { eksporterJson, gem, hent, importerMedGrund, lagringVirker, listSaves, slet, type SaveRow, type SlotId } from '../../store/persistence';
import type { GameState } from '../../sim/types';
import { datoTekst } from '../../sim/time';
import { Btn, Ikon, Modal, Tip } from '../components/kit';
import { mio } from '../format';
import { gemtTekst, slug } from '../lib/shellHjaelp';
import { gemFil, laesFil } from '../lib/eksport';
import { spil } from '../../audio/sfx';

type Info = Omit<SaveRow, 'state'>;
const PLADSER: { slot: SlotId; navn: string }[] = [
  { slot: 'auto', navn: 'Autosave' },
  { slot: 'slot1', navn: 'Plads 1' },
  { slot: 'slot2', navn: 'Plads 2' },
  { slot: 'slot3', navn: 'Plads 3' },
];

type Bekraeft = { slot: SlotId; hvad: 'gem' | 'indlaes' | 'slet' } | null;

function filnavn(s: GameState): string {
  return `udfordreren-${slug(s.firmaNavn)}-${datoTekst(s.uge).replace(/[^a-z0-9]+/gi, '-')}.json`;
}

export default function SaveLoadDialog({ onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const harSpil = useGame((s) => s.game !== null);
  const [info, setInfo] = useState<Info[] | null>(null);
  const [bekraeft, setBekraeft] = useState<Bekraeft>(null);
  const [fejl, setFejl] = useState<string | null>(null);
  const [besked, setBesked] = useState<string | null>(null);
  const [travl, setTravl] = useState(false);
  /** null = ikke tjekket endnu; false = browseren gemmer ikke (fx et privat vindue) */
  const [lagringOk, setLagringOk] = useState<boolean | null>(null);
  const filRef = useRef<HTMLInputElement>(null);

  const opdater = useCallback(async () => {
    setInfo(await listSaves());
  }, []);

  useEffect(() => {
    let aktiv = true;
    void listSaves().then((l) => aktiv && setInfo(l));
    void lagringVirker().then((ok) => aktiv && setLagringOk(ok));
    return () => {
      aktiv = false;
    };
  }, []);

  const indlaesState = (s: GameState, kilde: string) => {
    const st = useGame.getState();
    st.indlaes(s);
    spil('niveauOp');
    onLuk();
    useGame.getState().toast(`${kilde}: ${s.firmaNavn}, ${datoTekst(s.uge)}`, 'godt');
  };

  const udfoer = async (slot: SlotId, hvad: 'gem' | 'indlaes' | 'slet' | 'eksporter') => {
    setFejl(null);
    setBesked(null);
    setBekraeft(null);
    setTravl(true);
    try {
      if (hvad === 'gem') {
        const g = useGame.getState().game;
        if (!g) return;
        const ok = await gem(slot, g);
        if (ok) {
          spil('kasse');
          setBesked(`Gemt i ${PLADSER.find((p) => p.slot === slot)?.navn.toLowerCase()}.`);
        } else setFejl('Spillet kunne ikke gemmes. Browseren tillader måske ikke lokal lagring (privat vindue?).');
      } else if (hvad === 'indlaes') {
        const s = await hent(slot);
        if (s) indlaesState(s, 'Indlæst');
        else setFejl('Den gemte fil kunne ikke læses. Den er måske fra en ældre version.');
      } else if (hvad === 'slet') {
        await slet(slot);
        setBesked('Pladsen er tømt.');
      } else if (hvad === 'eksporter') {
        const s = await hent(slot);
        if (s) await eksporter(s);
        else setFejl('Den gemte fil kunne ikke læses.');
      }
    } finally {
      setTravl(false);
      await opdater();
    }
  };

  const eksporter = async (s: GameState) => {
    try {
      const r = await gemFil(filnavn(s), eksporterJson(s));
      if (r === 'hentet') setBesked('Filen er hentet. Gem den et sikkert sted.');
      else if (r === 'delt') setBesked('Filen er delt. Vælg "Gem i Filer" for at have den ved hånden.');
    } catch {
      setFejl('Filen kunne ikke laves. Prøv igen, eller brug en anden browser.');
    }
  };

  const eksporterNu = () => {
    setFejl(null);
    setBesked(null);
    const g = useGame.getState().game;
    if (g) void eksporter(g);
  };

  const importer = async (fil: File | undefined) => {
    setFejl(null);
    setBesked(null);
    if (!fil) return;
    if (filRef.current) filRef.current.value = '';
    const afvis = (grund: string) => {
      spil('fejl');
      setFejl(`"${fil.name}" kunne ikke indlæses. ${grund}`);
    };
    if (fil.size > 20_000_000) return afvis('Filen er for stor til at være en gemt fil fra Udfordreren.');
    const tekst = await laesFil(fil);
    if (tekst === null) return afvis('Browseren kunne ikke læse filen.');
    const r = importerMedGrund(tekst);
    if (!r.ok) return afvis(r.fejl);
    indlaesState(r.state, 'Importeret');
  };

  const kraeverBekraeft = (slot: SlotId, hvad: 'gem' | 'indlaes' | 'slet', optaget: boolean) => {
    const skal = hvad === 'slet' || (hvad === 'gem' && optaget) || (hvad === 'indlaes' && harSpil);
    if (skal && !(bekraeft?.slot === slot && bekraeft.hvad === hvad)) {
      setBekraeft({ slot, hvad });
      return;
    }
    void udfoer(slot, hvad);
  };

  return (
    <Modal
      titel={harSpil ? 'Gem og indlæs' : 'Indlæs spil'}
      onLuk={onLuk}
      testId="dialog-gemIndlaes"
      bredde={640}
      fod={
        <>
          <label
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-md border-2 border-line bg-panel2 px-3.5 font-bold text-ink pixel-skygge hover:bg-hi focus-within:outline-2 focus-within:outline-gold"
            data-testid="importer-knap"
          >
            <Ikon navn="upload" /> Importér JSON
            <input
              ref={filRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              data-testid="importer-fil"
              onChange={(e) => void importer(e.target.files?.[0])}
            />
          </label>
          {harSpil && (
            <Btn onClick={eksporterNu} testId="eksporter-nu">
              <Ikon navn="download" /> Eksportér spillet
            </Btn>
          )}
          <Btn variant="primaer" onClick={onLuk} testId="gem-luk">
            Luk
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {fejl && (
          <p className="flex items-start gap-2 rounded-md border-2 border-line bg-bad px-3 py-2 text-sm font-bold text-line" role="alert" data-testid="import-fejl">
            <Ikon navn="advarsel" farve="var(--color-line)" indre="var(--color-bad)" className="mt-0.5 shrink-0" /> {fejl}
          </p>
        )}
        {lagringOk === false && (
          <p className="flex items-start gap-2 rounded-md border-2 border-line bg-warn px-3 py-2 text-sm font-bold text-line" role="status" data-testid="lagring-advarsel">
            <Ikon navn="advarsel" farve="var(--color-line)" indre="var(--color-warn)" className="mt-0.5 shrink-0" />
            <span>Browseren vil ikke gemme her (måske et privat vindue), så pladserne er tomme. Eksportér spillet til en fil i stedet — den kan importeres igen senere.</span>
          </p>
        )}
        {besked && !fejl && (
          <p className="flex items-center gap-2 rounded-md border-2 border-line bg-good px-3 py-2 text-sm font-bold text-line" role="status" data-testid="gem-besked">
            <Ikon navn="flueben" farve="var(--color-line)" /> {besked}
          </p>
        )}
        {info === null ? (
          <p className="py-6 text-center text-sm text-muted">Henter gemte spil …</p>
        ) : (
          PLADSER.map(({ slot, navn }) => {
            const r = info.find((x) => x.slot === slot);
            const auto = slot === 'auto';
            const venter = bekraeft?.slot === slot ? bekraeft.hvad : null;
            return (
              <div
                key={slot}
                data-testid={`slot-${slot}`}
                className={`rounded-lg border-2 border-line p-2.5 ${auto ? 'bg-bg2' : 'bg-panel2'} ${venter ? 'outline-2 outline-gold' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex min-w-0 flex-1 basis-[200px] items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-line" style={{ background: r ? 'var(--color-gold)' : 'var(--color-bg)' }}>
                      <Ikon navn={auto ? 'ur' : 'gem'} farve={r ? 'var(--color-line)' : 'var(--color-dim)'} indre={r ? 'var(--color-gold)' : 'var(--color-bg)'} str={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-pixel text-xs font-bold uppercase tracking-wider text-muted">{navn}</div>
                      {r ? (
                        <>
                          <div className="truncate font-bold text-ink">{r.firmaNavn}</div>
                          <div className="tal text-xs text-muted">
                            {datoTekst(r.uge)} · <span className={r.kapital < 0 ? 'text-bad' : 'text-gold'}>{mio(r.kapital)}</span> · gemt {gemtTekst(r.gemt)}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-dim">{auto ? 'Gemmes automatisk hvert kvartal' : 'Tom plads'}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {harSpil && !auto && (
                      <Btn
                        variant={venter === 'gem' ? 'fare' : 'god'}
                        onClick={() => kraeverBekraeft(slot, 'gem', !!r)}
                        disabled={travl || lagringOk === false}
                        title={lagringOk === false ? 'Browseren gemmer ikke her — brug Eksportér spillet' : undefined}
                        testId={`gem-${slot}`}
                      >
                        {venter === 'gem' ? 'Overskriv?' : 'Gem'}
                      </Btn>
                    )}
                    {r && (
                      <Btn variant={venter === 'indlaes' ? 'fare' : 'primaer'} onClick={() => kraeverBekraeft(slot, 'indlaes', true)} disabled={travl} testId={`indlaes-${slot}`}>
                        {venter === 'indlaes' ? 'Sikker?' : 'Indlæs'}
                      </Btn>
                    )}
                    {r && (
                      <Btn onClick={() => void udfoer(slot, 'eksporter')} disabled={travl} testId={`eksporter-${slot}`} ariaLabel={`Eksportér ${navn} som JSON`} title="Eksportér som JSON" className="w-[44px] px-0">
                        <Ikon navn="download" />
                      </Btn>
                    )}
                    {r && (
                      <Btn
                        variant={venter === 'slet' ? 'fare' : 'ghost'}
                        onClick={() => kraeverBekraeft(slot, 'slet', true)}
                        disabled={travl}
                        testId={`slet-${slot}`}
                        ariaLabel={`Slet ${navn}`}
                        title="Slet"
                        className={venter === 'slet' ? '' : 'w-[44px] px-0'}
                      >
                        {venter === 'slet' ? 'Slet?' : <Ikon navn="papirkurv" />}
                      </Btn>
                    )}
                  </div>
                </div>
                {venter && (
                  <p className="mt-2 text-xs text-warn" data-testid={`bekraeft-${slot}`}>
                    {venter === 'gem' && 'Pladsen er optaget. Tryk igen for at overskrive.'}
                    {venter === 'indlaes' && 'Ikke-gemte fremskridt i det nuværende spil går tabt. Tryk igen for at indlæse.'}
                    {venter === 'slet' && 'Det gemte spil slettes for altid. Tryk igen for at slette.'}
                  </p>
                )}
              </div>
            );
          })
        )}
        <Tip>Gemte spil ligger kun i denne browser. Eksportér til en JSON-fil for at flytte et spil til en anden enhed.</Tip>
      </div>
    </Modal>
  );
}
