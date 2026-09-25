// Slutskærmen (signal 'slut', spec 6.17): slutningen, selskabsværdi og stifternes andel, eftermælet i seks dele,
// tidslinjen, trofæhylden, byens udvikling og tre eftertankekort med links til Arkivet. Herfra startes et nyt spil,
// New Game+ (kombinationsbogen og niveauerne arves) eller en af de to ulåste modes.
import { useEffect, useMemo, useState } from 'react';
import type { Signal } from '../../sim/types';
import { useGame } from '../../store/gameStore';
import { useUi } from '../../store/uiStore';
import { hentNgPlus, registrerSlut, type NgPlusGemt } from '../../store/persistence';
import { eftermaele, eftertanke } from '../../sim/endings';
import { arvFra } from '../../sim/newgameplus';
import { datoTekst } from '../../sim/time';
import { Btn, Ikon, Modal, type IkonNavn } from '../components/kit';
import { PixelTekst } from '../components/ShellPixelFont';
import { Konfetti } from '../components/ShellKonfetti';
import { stopKonfetti } from '../../render/particles';
import { ByDiagram, Eftermaele, SlutSektion, Tidslinje, Trofaehylde } from '../components/SlutDele';
import { ArkivOpslagModal } from './ArkivDialog';
import { mio, pct } from '../format';
import { opsummering, varighedTekst } from '../lib/shellHjaelp';
import { MODE_INFO, TONE, arvOpsummering, byUdvikling, ngPlusValg, slutInfo, trofaeer, type StartMode } from '../lib/slutHjaelp';
import { spil } from '../../audio/sfx';

function Fakta({ ikon, farve, label, vaerdi, under, testId }: { ikon: IkonNavn; farve: string; label: string; vaerdi: string; under?: string; testId?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-md border-2 border-line bg-bg2 px-2.5 py-2" data-testid={testId}>
      <Ikon navn={ikon} farve={farve} indre="var(--color-line)" str={22} className="shrink-0" />
      <div className="min-w-0 leading-tight">
        <div className="text-[0.65rem] uppercase tracking-wide text-muted">{label}</div>
        <div className="tal font-pixel text-sm font-black break-words sm:text-base" style={{ color: farve }}>
          {vaerdi}
        </div>
        {under && <div className="truncate text-[0.68rem] text-dim">{under}</div>}
      </div>
    </div>
  );
}

export default function EndDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  const g = useGame((s) => s.game);
  const arkivTil = useGame((s) => s.settings.arkiv);
  const [arkivOpslag, setArkivOpslag] = useState<string | null>(null);
  const [starter, setStarter] = useState<StartMode | null>(null);
  const [ngplus, setNgplus] = useState<NgPlusGemt | null>(null);
  const id = g?.slut?.id ?? (signal.k === 'slut' ? signal.id : 'konkurs');
  const info = slutInfo(id);
  const tone = TONE[info.tone];

  useEffect(() => {
    spil(info.tone === 'skidt' ? 'fejl' : 'fanfareSlut');
  }, [info.tone]);

  // Spillet er slut: gem arven og lås de to modes op (huskes mellem spil)
  const slutNoegle = g?.slut ? `${g.seed}:${g.slut.uge ?? g.uge}` : null;
  useEffect(() => {
    const st = useGame.getState().game;
    if (!slutNoegle || !st?.slut) {
      void hentNgPlus().then(setNgplus);
      return;
    }
    let aktiv = true;
    void registrerSlut(st).then((n) => aktiv && setNgplus(n));
    return () => {
      aktiv = false;
    };
  }, [slutNoegle]);

  const data = useMemo(() => {
    if (!g) return null;
    return { em: eftermaele(g), tanker: eftertanke(g), trofae: trofaeer(g), by: byUdvikling(g), o: opsummering(g) };
  }, [g]);

  if (!g || !data) return null;
  const { em, tanker, trofae, by, o } = data;
  const vaerdi = g.slut?.vaerdi ?? o.vaerdi;
  const stifterVaerdi = g.slut?.stifterVaerdi ?? vaerdi * g.investorer.ejerandelStiftere;
  const arv = ngplus?.arv ?? arvFra(g);
  const arvTal = arvOpsummering(arv);
  const modes: StartMode[] = ['usa2018', 'aiNative2026'];

  const nytSpil = () => {
    stopKonfetti();
    useUi.getState().luk();
    useGame.getState().lukSpil();
  };

  const start = (mode: StartMode) => {
    if (starter) return;
    setStarter(mode);
    spil('klik');
    const opts = ngPlusValg(g, mode, arv);
    // Lad "spoler frem"-beskeden nå skærmen, før verden simuleres frem til startåret
    setTimeout(() => {
      stopKonfetti();
      useUi.getState().luk();
      useUi.getState().setPanel('projekter');
      useGame.getState().nytSpil(opts);
    }, 40);
  };

  return (
    <>
      <Modal
        titel="Slutningen"
        testId="dialog-slut"
        lukbar={false}
        bredde={1100}
        fod={
          <>
            <Btn variant="ghost" onClick={onLuk} testId="se-firmaet" disabled={!!starter}>
              Se firmaet
            </Btn>
            <Btn onClick={nytSpil} testId="nyt-spil" disabled={!!starter}>
              <Ikon navn="hus" /> Nyt spil
            </Btn>
            <Btn variant="primaer" onClick={() => start('normal')} testId="ngplus-normal" disabled={!!starter} title="Kombinationsbogen og niveauerne følger med">
              <Ikon navn="play" /> New Game+
            </Btn>
          </>
        }
      >
        {info.tone === 'godt' && <Konfetti antal={110} />}
        <div className="relative flex flex-col gap-3">
          {starter && (
            <div className="absolute inset-0 z-20 flex items-start justify-center bg-panel/85 pt-16" role="status" data-testid="slut-starter">
              <p className="flex items-center gap-2 rounded-md border-2 border-line bg-bg2 px-4 py-3 font-pixel text-sm font-bold text-ink pixel-skygge">
                <Ikon navn="ur" farve="var(--color-gold)" indre="var(--color-line)" />
                {starter === 'normal' ? 'Garagen gøres klar …' : `Spoler verden frem til ${MODE_INFO[starter].aar} …`}
              </p>
            </div>
          )}

          {/* Slutningen */}
          <header className="flex flex-col items-center gap-2 text-center" data-testid={`slut-${id}`}>
            <div className="w-full" style={{ maxWidth: Math.min(820, 60 + info.titel.length * 40) }}>
              <PixelTekst tekst={info.titel} dybde={1} farver={tone.pixel} side={tone.side} className="block h-auto w-full" titel={info.titel} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded border-2 border-line bg-bg2 px-2 py-0.5 font-pixel text-[0.68rem] font-bold uppercase" style={{ color: tone.farve }}>
              <Ikon navn={tone.ikon} str={12} /> {tone.navn}
            </span>
            <p className="font-pixel text-sm font-bold text-ink">
              {g.firmaNavn} · {datoTekst(g.slut?.uge ?? g.uge)}
            </p>
            <p className="max-w-2xl text-sm text-muted" data-testid="slut-tekst">
              {info.tekst}
            </p>
          </header>

          {/* Scoren */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-testid="slut-score">
            <Fakta ikon="firma" farve="var(--color-gold)" label="Selskabsværdi" vaerdi={mio(vaerdi)} testId="slut-vaerdi" />
            <Fakta ikon="krone" farve="var(--color-gold)" label="Stifternes værdi" vaerdi={mio(stifterVaerdi)} under={`Ejer ${pct(g.investorer.ejerandelStiftere)}`} testId="slut-stiftervaerdi" />
            <Fakta ikon="trofae" farve="var(--color-violet)" label="Eftermæle" vaerdi={`${String(Math.round(em.total)).replace('.', ',')}/100`} testId="slut-eftermaele-kort" />
            <Fakta ikon="ur" farve="var(--color-sky)" label="I branchen" vaerdi={varighedTekst(o.aar, o.uger)} under={`${o.lanceringer} lanceringer · bedst ${o.bedste40 || '–'}/40`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Eftermaele dele={em.dele} total={em.total} />
            <ByDiagram data={by} />
          </div>

          <Tidslinje g={g} />
          <Trofaehylde t={trofae} />

          {/* Eftertanke */}
          <SlutSektion titel="Eftertanke" ikon="spoergsmaal" testId="slut-eftertanke">
            <p className="mb-2 text-sm text-muted">Tre steder, hvor jeres vej afveg fra den virkelige.</p>
            <div className="grid gap-2 md:grid-cols-3">
              {tanker.map((k, i) => {
                const indhold = (
                  <>
                    <span className="flex items-center gap-2 font-pixel text-sm font-black text-ink">
                      <Ikon navn="spoergsmaal" farve="var(--color-cyan)" indre="var(--color-line)" className="shrink-0" /> {k.titel}
                    </span>
                    <span className="block flex-1 text-sm leading-snug text-muted">{k.tekst}</span>
                  </>
                );
                return arkivTil ? (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setArkivOpslag(k.arkivId)}
                    data-testid={`slut-eftertanke-${i}`}
                    className="flex min-h-[44px] flex-col gap-2 rounded-md border-2 border-line bg-panel p-3 text-left pixel-skygge transition-transform hover:bg-panel2 active:translate-y-[2px]"
                  >
                    {indhold}
                    <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-md border-2 border-line bg-panel2 px-3 text-sm font-bold text-gold">
                      <Ikon navn="arkiv" farve="var(--color-gold)" indre="var(--color-line)" /> Læs i Arkivet
                    </span>
                  </button>
                ) : (
                  <article key={k.id} data-testid={`slut-eftertanke-${i}`} className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-3">
                    {indhold}
                  </article>
                );
              })}
            </div>
          </SlutSektion>

          {/* Næste kapitel */}
          <SlutSektion titel="Næste kapitel" ikon="raket" testId="slut-naeste">
            <p className="mb-2 text-sm text-muted">
              New Game+ tager kombinationsbogen og niveauerne med
              {arvTal.kombinationer || arvTal.niveauer ? ` (${arvTal.kombinationer} kombinationer, ${arvTal.niveauer} niveauer)` : ''}. To nye startpunkter er låst op:
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              {modes.map((m) => {
                const mi = MODE_INFO[m];
                return (
                  <div key={m} className="flex flex-col gap-2 rounded-md border-2 border-line bg-panel p-3 sm:flex-row sm:items-center">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border-2 border-line" style={{ background: mi.farve }}>
                      <Ikon navn={mi.ikon} farve="var(--color-line)" indre={mi.farve} str={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-pixel text-sm font-black" style={{ color: mi.farve }}>
                        {mi.titel}
                      </div>
                      <p className="text-xs leading-snug text-muted">{mi.tekst}</p>
                    </div>
                    <Btn onClick={() => start(m)} testId={`ngplus-${m}`} disabled={!!starter} className="shrink-0">
                      <Ikon navn="play" /> Start
                    </Btn>
                  </div>
                );
              })}
            </div>
          </SlutSektion>
        </div>
      </Modal>
      {arkivOpslag && <ArkivOpslagModal id={arkivOpslag} onLuk={() => setArkivOpslag(null)} visAltid />}
    </>
  );
}
