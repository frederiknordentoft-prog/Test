// "Balanceret" bot (spec 8) — fase 1-2-udgave: vokser, varierer kombinationer, ansætter, træner og holder tilliden.
import type { Action, GameState, MarketId, ProductTypeId, Role, ThemeId, Vertical } from '../../src/sim/types';
import { licensStatus, licensPris } from '../../src/sim/markets';
import { MARKETS } from '../../src/data/markets';
import type { Bot } from './types';
import { PRODUCT_TYPE_IDS, PRODUCT_TYPES } from '../../src/data/productTypes';
import { THEME_IDS } from '../../src/data/themes';
import { fitFor, komboNoegle } from '../../src/data/compatibility';
import { RESEARCH } from '../../src/data/research';
import { EXPOS } from '../../src/data/expos';
import { ANDEN_VERTIKAL } from '../../src/data/verticals';
import { typeStatus, temaStatus, minBudget, ledigeTilProjekt, maxProjekter, boostPris } from '../../src/sim/projects';
import { forskningStatus } from '../../src/sim/insight';
import { kontorKrav, naesteKontor } from '../../src/sim/office';
import { naesteRunde } from '../../src/sim/investors';
import { bookingAabent } from '../../src/sim/expos';
import { pladser } from '../../src/sim/staff';
import { aarFor } from '../../src/sim/time';
import { OFFICE_BY_ID } from '../../src/data/costs';

const ONSKEDE_ROLLER: Record<Vertical, Role[]> = {
  betting: ['oddssaetter', 'udvikler', 'analytiker', 'compliance', 'udvikler', 'marketing', 'kasinodesigner'],
  kasino: ['kasinodesigner', 'udvikler', 'compliance', 'analytiker', 'udvikler', 'marketing', 'oddssaetter'],
};

function vaelgKombi(s: GameState): { typeId: ProductTypeId; themeId: ThemeId } | null {
  let best: { typeId: ProductTypeId; themeId: ThemeId; score: number } | null = null;
  for (const t of PRODUCT_TYPE_IDS) {
    if (!typeStatus(s, t).ok) continue;
    const v = PRODUCT_TYPES[t].vertikal;
    if (s.markeder.dk.vertikaler[v].status === 'ingen') continue;
    for (const th of THEME_IDS) {
      if (!temaStatus(s, th).ok) continue;
      const fit = fitFor(t, th);
      if (fit < 3) continue;
      const ny = !s.kombinationsbog[komboNoegle(t, th)]?.set;
      // Variation: nye kombinationer og friske typer (kort halveringstid kræver fornyelse)
      const aktiveSamme = s.produkter.filter((p) => p.aktiv && p.ejer === 'spiller' && p.typeId === t).length;
      const score = fit * 2 + (ny ? 2.5 : 0) + s.niveauer.type[t] * 0.3 - aktiveSamme * 1.5 + (s.projekter.some((p) => p.typeId === t) ? -5 : 0);
      if (!best || score > best.score) best = { typeId: t, themeId: th, score };
    }
  }
  return best ? { typeId: best.typeId, themeId: best.themeId } : null;
}

export const balanceretBot: Bot = {
  navn: 'Balanceret',
  beslut(s) {
    const a: Action[] = [];
    const aar = aarFor(s.uge);
    for (const e of s.ventendeEvents) a.push({ t: 'eventChoice', eventId: e.eventId, valg: 0 });

    // Lancér og test
    for (const p of s.projekter) {
      if (p.klar) {
        if (p.fejl > 4 && p.faseLaengde.test < 6) a.push({ t: 'extendTest', projectId: p.id, uger: 2 });
        else a.push({ t: 'launch', projectId: p.id });
      } else if (p.fase === 'design' || p.fase === 'teknik') {
        const pris = boostPris(p);
        if (pris !== null && s.indsigt >= pris + 12) {
          const svagest = (Object.keys(p.params) as (keyof typeof p.params)[]).sort((x, y) => p.params[x] - p.params[y])[0];
          a.push({ t: 'boost', projectId: p.id, param: svagest });
        }
      }
    }

    // Energistyring: alle, der ikke er på kontrakt, arbejder på den aktive fase; trætte hviler (hysterese 20/60)
    {
      const iKontraktNu = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
      const brugt = new Set<string>();
      for (const p of s.projekter) {
        if (p.klar) continue;
        const hold = p.faseTildeling[p.fase];
        const nyt = s.staff
          .filter((m) => !iKontraktNu.has(m.id) && !brugt.has(m.id))
          .filter((m) => (hold.includes(m.id) ? m.energi >= 20 : m.energi >= 60))
          .map((m) => m.id);
        const endeligt = nyt.length ? nyt : hold.filter((id) => !brugt.has(id)).slice(0, 1);
        for (const id of endeligt) brugt.add(id);
        if ([...endeligt].sort().join() !== [...hold].sort().join()) a.push({ t: 'assignPhase', projectId: p.id, fase: p.fase, ids: endeligt });
      }
    }

    // Luk udtjente produkter, når der findes et friskere i samme vertikal
    for (const p of s.produkter) {
      if (p.ejer !== 'spiller' || !p.aktiv) continue;
      const hl = PRODUCT_TYPES[p.typeId].halveringstidUger;
      if (s.uge - p.lanceretUge < 3 * hl) continue;
      const v = PRODUCT_TYPES[p.typeId].vertikal;
      const nyere = s.produkter.some((x) => x.ejer === 'spiller' && x.aktiv && x.id !== p.id && PRODUCT_TYPES[x.typeId].vertikal === v && x.lanceretUge > p.lanceretUge);
      if (nyere) a.push({ t: 'retireProduct', productId: p.id });
    }

    // Nyt projekt
    const ledige = ledigeTilProjekt(s);
    if (s.projekter.length < maxProjekter(s) && ledige.length >= Math.min(2, s.staff.length) && s.uge >= 3) {
      const k = vaelgKombi(s);
      if (k) {
        const t = PRODUCT_TYPES[k.typeId];
        const min = minBudget(s, k.typeId);
        const budget = Math.max(min, Math.min(min * 6, s.kapital * 0.06));
        if (s.kapital > budget + 0.4) {
          a.push({
            t: 'startProject',
            project: {
              navn: `${t.navn} ${s.uge}`, typeId: k.typeId, themeId: k.themeId,
              markeder: (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].vertikaler[t.vertikal].status !== 'ingen' && s.markeder[m].licens !== 'inddraget'),
              margin: t.marginStd, intensitet: 3, budget: Math.round(budget * 100) / 100,
            },
          });
        }
      }
    }
    // Kontraktopgaver til ledige, når der ikke kan startes projekter
    const iProjekt = new Set(s.projekter.filter((p) => !p.klar).flatMap((p) => p.faseTildeling[p.fase]));
    const iKontrakt = new Set(s.kontraktopgaver.flatMap((c) => c.staff));
    const heltLedige = s.staff.filter((m) => !iProjekt.has(m.id) && !iKontrakt.has(m.id) && m.energi > 40);
    const kanStarte = s.uge >= 3;
    if ((s.projekter.length === 0 && !kanStarte) || (s.kapital < 0.6 && heltLedige.length > 0)) {
      if (heltLedige.length > 0 && s.kontraktTilbud.length > 0) {
      const t = s.kontraktTilbud[0];
      a.push({ t: 'takeContract', contractId: t.id, staff: heltLedige.slice(0, t.maxStaff).map((m) => m.id) });
      }
    }

    // Ansættelser
    const loen = s.staff.reduce((x, m) => x + m.loenPrUge, 0);
    const buffer = 1 + loen * 30;
    if (s.staff.length < pladser(s) && s.kapital > buffer + 0.5) {
      if (s.kandidater.length === 0) {
        a.push({ t: 'postJobAd', niveau: s.kapital > 60 ? 3 : s.kapital > 8 ? 2 : 1 });
      } else {
        const onsket = ONSKEDE_ROLLER[s.startVertikal];
        const cyklus = [...onsket, ...onsket, ...onsket, ...onsket, ...onsket];
        const mangler = cyklus.find((r, i) => s.staff.filter((m) => m.rolle === r).length < cyklus.slice(0, i + 1).filter((x) => x === r).length);
        const k = [...s.kandidater].sort((x, y) => {
          const px = (x.rolle === mangler ? 30 : 0) + Object.values(x.stats).reduce((q, w) => q + w, 0) / 6;
          const py = (y.rolle === mangler ? 30 : 0) + Object.values(y.stats).reduce((q, w) => q + w, 0) / 6;
          return py - px;
        })[0];
        a.push({ t: 'hire', kandidatId: k.id });
      }
    }
    // Kontor
    const nk = naesteKontor(s);
    if (nk && kontorKrav(s).ok && s.kapital > nk.pris * 2 + buffer && s.staff.length >= OFFICE_BY_ID[s.kontor].pladser) a.push({ t: 'upgradeOffice' });

    // Træning
    if (s.indsigt > 35 && s.kapital > buffer + 1) {
      const m = [...s.staff].filter((x) => x.energi > 60).sort((x, y) => x.niveau - y.niveau)[0];
      if (m) {
        const prim = ({ oddssaetter: 'matematik', udvikler: 'teknik', kasinodesigner: 'kreativitet', marketing: 'salg', compliance: 'ansvar', analytiker: 'matematik', kundeservice: 'ansvar', aiIngenioer: 'teknik' } as const)[m.rolle];
        a.push({ t: 'train', staffId: m.id, stat: prim });
      }
    }
    // Rolleskift: marketing → CRM når muligt
    for (const m of s.staff) if (m.rolle === 'marketing' && !m.specialisering && m.niveau >= 5 && s.indsigt > 10) a.push({ t: 'changeRole', staffId: m.id, nyRolle: 'marketing' });

    // Forskning
    if (!s.forskning.igang) {
      const n = RESEARCH.filter((r) => forskningStatus(s, r).ok).sort((x, y) => x.indsigt - y.indsigt)[0];
      if (n && s.indsigt >= n.indsigt + 8) a.push({ t: 'startResearch', nodeId: n.id });
    }

    // Marketing: ca. 25 % af BSI
    if (s.produkter.some((p) => p.ejer === 'spiller' && p.aktiv) && s.uge % 4 === 0) {
      const bsi = s.regnskab.bsi;
      const budget = Math.max(0.01, bsi * 0.25);
      a.push({ t: 'setMarketing', channel: 'soeg', prUge: Math.round(budget * 0.3 * 1000) / 1000 });
      a.push({ t: 'setMarketing', channel: 'affiliate', prUge: Math.round(budget * 0.3 * 1000) / 1000 });
      a.push({ t: 'setMarketing', channel: 'sociale', prUge: Math.round(budget * 0.25 * 1000) / 1000 });
      a.push({ t: 'setMarketing', channel: 'crm', prUge: Math.round(budget * 0.15 * 1000) / 1000 });
    }

    // Messer
    for (const e of EXPOS) {
      if (bookingAabent(s, e.id) && !s.messeBookinger.some((b) => b.expoId === e.id && b.aar === aar)) {
        const st = s.kapital > 60 ? 3 : s.kapital > 15 ? 2 : s.kapital > 3 ? 1 : 0;
        if (st > 0) a.push({ t: 'bookExpoStand', expoId: e.id, stoerrelse: st as 1 | 2 | 3 });
      }
    }
    // Anden vertikal fra 2014
    const anden = ANDEN_VERTIKAL[s.startVertikal];
    if (aar >= 2014 && s.markeder.dk.vertikaler[anden].status === 'ingen' && s.kapital > 4) a.push({ t: 'applyLicense', market: 'dk', vertical: anden });
    // Udvid til nye markeder efter afgift og kanalisering (spec 8: Balanceret)
    if (s.kontor !== 'garage' && s.kapital > 25) {
      const kandidater = (['uk', 'se', 'on', 'nl', 'de', 'us', 'fi'] as MarketId[])
        .filter((m) => licensStatus(s, m).ok && s.markeder[m].vertikaler[s.startVertikal].status === 'ingen')
        .sort((a, b) => s.markeder[b].kanalisering - s.markeder[a].kanalisering - (s.markeder[b].afgift - s.markeder[a].afgift));
      const m = kandidater[0];
      if (m && s.kapital > licensPris(s, m).gebyr * 6 + 20 && MARKETS[m].cacFaktor <= 2) a.push({ t: 'applyLicense', market: m, vertical: s.startVertikal });
    }
    // Runder
    const r = naesteRunde(s);
    if (r.ok) a.push({ t: 'raiseRound' });
    return a;
  },
};
