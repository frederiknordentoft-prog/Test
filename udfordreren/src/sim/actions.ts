// Handlinger fra UI'et. Alle går gennem applyActionMut, så step() og UI giver samme resultat.
import type { Action, GameState, LiveProduct } from './types';
import type { Rng } from './rng';
import { CHANNELS } from '../data/acquisition';
import { PRODUCT_TYPES } from '../data/productTypes';
import { afvis, betal, clamp, nyhed } from './util';
import { hire, fire, postJobAd, train, changeRole } from './staff';
import { startProject, assignPhase, boost, extendTest, launch, cancelProject } from './projects';
import { takeContract } from './contracts';
import { applyLicense } from './markets';
import { bookExpoStand } from './expos';
import { raiseRound } from './investors';
import { startResearch } from './insight';
import { upgradeOffice } from './office';
import { eventChoice } from './events';
import { setOffshoreBrand } from './offshore';
import { choosePlatform, sellPlatformB2B } from './platforms';
import { acquire } from './competitors';
import { acceptOffer } from './investors';
import { afvisTilbud, bydSponsorat } from './reactions';
import { kanalTilgaengelig, kampagneKunder } from './customers';

export const MAX_MARKETING_PR_KANAL = 50; // mio. kr./uge

function spillerProdukt(s: GameState, id: string): LiveProduct | undefined {
  return s.produkter.find((p) => p.id === id && p.ejer === 'spiller');
}

export function applyActionMut(s: GameState, rng: Rng, a: Action): boolean {
  if (s.slut) return afvis(s, 'Spillet er slut.');
  switch (a.t) {
    case 'hire': return hire(s, a.kandidatId);
    case 'fire': return fire(s, a.staffId);
    case 'postJobAd': return postJobAd(s, rng, a.niveau);
    case 'train': return train(s, rng, a.staffId, a.stat);
    case 'changeRole': return changeRole(s, a.staffId, a.nyRolle);
    case 'startProject': return startProject(s, a.project);
    case 'assignPhase': return assignPhase(s, a.projectId, a.fase, a.ids);
    case 'boost': return boost(s, a.projectId, a.param);
    case 'extendTest': return extendTest(s, a.projectId, a.uger);
    case 'launch': return launch(s, rng, a.projectId);
    case 'cancelProject': return cancelProject(s, a.projectId);
    case 'adjustProduct': {
      const p = spillerProdukt(s, a.productId);
      if (!p || !p.aktiv) return afvis(s, 'Produktet findes ikke.');
      const t = PRODUCT_TYPES[p.typeId];
      if (a.margin !== undefined) {
        if (a.margin < t.marginMin - 1e-9 || a.margin > t.marginMax + 1e-9) return afvis(s, 'Marginen ligger uden for markedets interval.');
        p.margin = a.margin;
      }
      if (a.intensitet !== undefined) {
        if (![1, 2, 3, 4, 5].includes(a.intensitet)) return afvis(s, 'Intensitet skal være 1-5.');
        p.intensitet = a.intensitet;
      }
      return true;
    }
    case 'retireProduct': {
      const p = spillerProdukt(s, a.productId);
      if (!p || !p.aktiv) return afvis(s, 'Produktet findes ikke.');
      p.aktiv = false;
      p.pensioneretUge = s.uge;
      p.bsiPrUge = {};
      nyhed(s, `${s.firmaNavn} lukker ${p.navn}.`, 'firma');
      return true;
    }
    case 'takeContract': return takeContract(s, a.contractId, a.staff);
    case 'setMarketing': {
      const def = CHANNELS[a.channel];
      if (!def) return afvis(s, 'Ukendt kanal.');
      if (a.prUge > 0 && !kanalTilgaengelig(s, a.channel)) return afvis(s, `${def.navn} er ikke tilgængelig endnu.`);
      s.marketingMix[a.channel] = clamp(Math.round(a.prUge * 1000) / 1000, 0, MAX_MARKETING_PR_KANAL);
      return true;
    }
    case 'launchCampaign': {
      const budget = Math.round(a.budget * 1000) / 1000;
      if (!(budget > 0)) return afvis(s, 'Kampagnen skal have et budget.');
      const produkt = spillerProdukt(s, a.productId);
      const projekt = s.projekter.find((p) => p.id === a.productId);
      if (!produkt && !projekt) return afvis(s, 'Vælg et produkt eller et projekt.');
      if (produkt && !produkt.aktiv) return afvis(s, 'Produktet er lukket.');
      if (!betal(s, budget, 'kampagnen')) return false;
      s.hype = clamp(s.hype + 25 * (1 - Math.exp(-budget / 0.4)) * (1 - s.hype / 120), 0, 100);
      if (produkt) kampagneKunder(s, produkt, budget);
      nyhed(s, `${s.firmaNavn} kører kampagne for ${produkt?.navn ?? projekt?.navn}.`, 'firma');
      return true;
    }
    case 'setVip': s.vipProgram = a.niveau; return true;
    case 'setBonus': s.bonusNiveau = a.niveau; return true;
    case 'applyLicense': return applyLicense(s, a.market, a.vertical);
    case 'bookExpoStand': return bookExpoStand(s, a.expoId, a.stoerrelse);
    case 'raiseRound': return raiseRound(s);
    case 'startResearch': return startResearch(s, a.nodeId);
    case 'upgradeOffice': return upgradeOffice(s);
    case 'eventChoice': return eventChoice(s, a.eventId, a.valg);
    case 'setMentor': s.mentor = a.status; return true;
    case 'setOffshoreBrand': return setOffshoreBrand(s, a.aktiv);
    case 'choosePlatform': return choosePlatform(s, rng, a.kind, a.model);
    case 'sellPlatformB2B': return sellPlatformB2B(s, rng, a.kind);
    case 'acquire': return acquire(s, a.competitorId);
    case 'acceptOffer': return acceptOffer(s, a.competitorId);
    case 'afvisTilbud': return afvisTilbud(s);
    case 'bydSponsorat': return bydSponsorat(s, a.bud);
    case 'deployAgent':
    case 'retireAgent':
      return afvis(s, 'AI-laboratoriet åbner i 2026.');
  }
}
