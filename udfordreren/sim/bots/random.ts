// Tilfældig bot (spec 8): vælger tilfældige, men gyldige handlinger. Egen RNG (seedet), så kørslen er deterministisk.
import type { AcqChannel, Action, GameState, MarketId, PlatformKind, PlatformModel, Vertical } from '../../src/sim/types';
import type { Bot } from './types';
import { makeRng, seedState, type Rng } from '../../src/sim/rng';
import { PRODUCT_TYPE_IDS, PRODUCT_TYPES } from '../../src/data/productTypes';
import { THEME_IDS } from '../../src/data/themes';
import { CHANNEL_IDS } from '../../src/data/acquisition';
import { AGENT_IDS } from '../../src/data/ai';
import { RESEARCH } from '../../src/data/research';
import { typeStatus, temaStatus, minBudget, ledigeTilProjekt, maxProjekter } from '../../src/sim/projects';
import { forskningStatus } from '../../src/sim/insight';
import { AI_AKT_UGE } from '../../src/sim/time';

export function lavTilfaeldigBot(seed: number): Bot {
  const rng: Rng = makeRng(seedState(seed * 7919 + 13));
  return {
    navn: 'Tilfældig',
    beslut(s: GameState) {
      const a: Action[] = [];
      for (const e of s.ventendeEvents) {
        const n = 3;
        a.push({ t: 'eventChoice', eventId: e.eventId, valg: rng.int(0, n - 1) });
      }
      for (const p of s.projekter) if (p.klar) a.push({ t: 'launch', projectId: p.id });
      // Bemand den aktive fase med alle ledige
      for (const p of s.projekter) {
        if (p.klar || p.faseTildeling[p.fase].length) continue;
        a.push({ t: 'assignPhase', projectId: p.id, fase: p.fase, ids: ledigeTilProjekt(s, p.id).map((m) => m.id) });
      }
      if (s.projekter.length < maxProjekter(s) && rng.chance(0.3)) {
        const typer = PRODUCT_TYPE_IDS.filter((t) => typeStatus(s, t).ok && (Object.keys(s.markeder) as MarketId[]).some((m) => s.markeder[m].vertikaler[PRODUCT_TYPES[t].vertikal].status !== 'ingen'));
        const temaer = THEME_IDS.filter((t) => temaStatus(s, t).ok);
        if (typer.length && temaer.length) {
          const t = rng.pick(typer);
          const v = PRODUCT_TYPES[t].vertikal;
          const budget = minBudget(s, t) * rng.range(1, 3);
          if (s.kapital > budget + 0.2) {
            a.push({
              t: 'startProject',
              project: {
                navn: `Tilfældig ${s.uge}`, typeId: t, themeId: rng.pick(temaer),
                markeder: (Object.keys(s.markeder) as MarketId[]).filter((m) => s.markeder[m].vertikaler[v].status !== 'ingen'),
                margin: PRODUCT_TYPES[t].marginStd * rng.range(0.8, 1.2), intensitet: rng.int(1, 5) as 1 | 2 | 3 | 4 | 5, budget: Math.round(budget * 100) / 100,
              },
            });
          }
        }
      }
      if (rng.chance(0.05) && s.kontraktTilbud.length) {
        const ledige = ledigeTilProjekt(s).filter((m) => !s.projekter.some((p) => p.faseTildeling[p.fase].includes(m.id)));
        if (ledige.length) a.push({ t: 'takeContract', contractId: s.kontraktTilbud[0].id, staff: ledige.slice(0, 2).map((m) => m.id) });
      }
      if (rng.chance(0.04)) {
        if (s.kandidater.length) a.push({ t: 'hire', kandidatId: rng.pick(s.kandidater).id });
        else a.push({ t: 'postJobAd', niveau: rng.int(1, 3) as 1 | 2 | 3 });
      }
      if (rng.chance(0.08)) a.push({ t: 'setMarketing', channel: rng.pick(CHANNEL_IDS) as AcqChannel, prUge: Math.round(Math.max(0, s.regnskab.bsi) * rng.range(0, 0.3) * 1000) / 1000 });
      if (rng.chance(0.02)) a.push({ t: 'setBonus', niveau: rng.int(0, 3) as 0 | 1 | 2 | 3 });
      if (rng.chance(0.02)) a.push({ t: 'setVip', niveau: rng.int(0, 3) as 0 | 1 | 2 | 3 });
      if (rng.chance(0.01)) a.push({ t: 'applyLicense', market: rng.pick(Object.keys(s.markeder) as MarketId[]), vertical: rng.pick(['betting', 'kasino'] as Vertical[]) });
      if (rng.chance(0.004)) a.push({ t: 'choosePlatform', kind: rng.pick(['kontoplatform', 'sportsbook', 'kasinoplatform'] as PlatformKind[]), model: rng.pick(['whiteLabel', 'turnkey', 'hybrid', 'egen'] as PlatformModel[]) });
      if (rng.chance(0.004)) a.push({ t: 'setOffshoreBrand', aktiv: !s.offshoreBrand });
      if (rng.chance(0.01)) a.push({ t: 'raiseRound' });
      if (rng.chance(0.01)) a.push({ t: 'upgradeOffice' });
      if (!s.forskning.igang && rng.chance(0.05)) {
        const mulige = RESEARCH.filter((r) => forskningStatus(s, r).ok);
        if (mulige.length) a.push({ t: 'startResearch', nodeId: rng.pick(mulige).id });
      }
      if (s.opkoebstilbud) a.push(rng.chance(0.15) ? { t: 'acceptOffer', competitorId: s.opkoebstilbud.competitorId } : { t: 'afvisTilbud' });
      if (s.uge >= AI_AKT_UGE && rng.chance(0.02)) a.push({ t: 'deployAgent', funktion: rng.pick(AGENT_IDS), overvaagning: Math.round(rng.next() * 10) / 10 });
      if (s.uge >= AI_AKT_UGE && rng.chance(0.005)) a.push({ t: 'setHyperpersonalisering', aktiv: !s.hyperpersonalisering.aktiv });
      return a;
    },
  };
}
