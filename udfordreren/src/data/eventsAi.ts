// AI-uheld og AI-transformationen (fase 5). Udløses af sim-kernen ('system'). AI er hverken frelse eller trussel:
// valgene viser begge sider. Tekster moraliserer aldrig; prisen er synlig.
import type { EventDef } from './events';

const uheld = (id: string, titel: string, tekst: string, valg: EventDef['valg']): EventDef => ({
  id: `aiUheld_${id}`, titel, tekst, trigger: 'system', fraAar: 2026, tilAar: 2035, chancePrUge: 0, engang: false, valg,
});

export const AI_EVENTS: EventDef[] = [
  uheld('trading', 'Trading-agenten gik amok',
    '{navn} prissatte tusindvis af micro-markeder forkert i løbet af en nat. Et par hundrede kunder fandt fejlen før jer.',
    [
      { tekst: 'Udbetal og skru op for overvågningen', forklaring: 'Dyrt, men I lærer af det. Alle agenter får +0,2 overvågning.', effekt: { kapital: -0.6, agentOvervaagning: 0.2, tillidAlle: -2 } },
      { tekst: 'Annullér spillene', forklaring: 'Vilkårene tillader det, men tilsynene og kunderne kigger med.', effekt: { omdoemme: -5, tillidAlle: -6, kunderPct: -0.03 } },
    ]),
  uheld('indhold', 'Indholdsagenten kopierede for meget',
    '{navn} lavede et nyt slot, der ligner en kendt spilstudies bestseller lidt for meget. Advokaterne ringer.',
    [
      { tekst: 'Træk spillet og betal forlig', forklaring: 'Sagen lukkes stille.', effekt: { kapital: -0.4, omdoemme: -1 } },
      { tekst: 'Kæmp i retten', forklaring: 'Billigere nu, men sagen trækker ud i medierne.', effekt: { kapital: -0.1, omdoemme: -5, hype: 4 } },
    ]),
  uheld('kundeservice', 'Chatbotten lovede for meget',
    '{navn} har lovet kunder bonusser, som ikke findes. Skærmbillederne deles flittigt.',
    [
      { tekst: 'Indfri løfterne', forklaring: 'Kunderne er glade; tilsynet noterer, at bonusserne ikke var godkendt.', effekt: { kapital: -0.3, tillidAlle: -3, omdoemme: 1 } },
      { tekst: 'Undskyld og ret fejlen', forklaring: 'Billigt, men nogle kunder føler sig snydt.', effekt: { kunderPct: -0.03, omdoemme: -3, tillidAlle: -2 } },
    ]),
  uheld('crm', 'CRM-agenten skrev til de forkerte',
    '{navn} har sendt bonustilbud til kunder, der har bedt om en pause. Tilsynet har fået klager.',
    [
      { tekst: 'Meld jer selv og skærp kontrollen', forklaring: 'Tilliden får et hak, men I viser, at I tager det alvorligt.', effekt: { tillidAlle: -3, agentOvervaagning: 0.2, byRisiko: -0.1 } },
      { tekst: 'Kald det en teknisk fejl', forklaring: 'Tilsynet er ikke imponeret.', effekt: { tillidAlle: -8, omdoemme: -4 } },
    ]),
  uheld('risiko', 'Risikoagenten lukkede de forkerte',
    '{navn} har spærret hundredvis af helt almindelige kunder som "risiko". Spillerforum koger.',
    [
      { tekst: 'Åbn manuelt og undskyld', forklaring: 'Kundeservice arbejder over. Holdet mærker det.', effekt: { energiAlle: -15, omdoemme: -1 } },
      { tekst: 'Slæk på tærsklerne', forklaring: 'Kunderne er glade, men flere glider under radaren.', effekt: { kunderPct: 0.01, byRisiko: 0.08, tillidAlle: -2 } },
    ]),
  uheld('compliance', 'Compliance-agenten overså noget',
    '{navn} godkendte en stribe konti uden ordentlig ID-kontrol. En revision fandt dem.',
    [
      { tekst: 'Gennemgå alle konti manuelt', forklaring: 'Dyrt og langsomt, men revisionen lukkes.', effekt: { kapital: -0.35, tillidAlle: -2, energiAlle: -10 } },
      { tekst: 'Sluk agenten', forklaring: 'Agenten slukkes, og tilsynet noterer sagen.', effekt: { agentFra: true, tillidAlle: -4 } },
    ]),
  uheld('udvikling', 'Udviklingsagenten skubbede en fejl i drift',
    '{navn} rullede en opdatering ud fredag eftermiddag. Udbetalingerne stod stille hele weekenden.',
    [
      { tekst: 'Alle mand på dæk', forklaring: 'Holdet redder weekenden.', effekt: { energiAlle: -20, kunderPct: -0.01 } },
      { tekst: 'Kræv menneskelig godkendelse fremover', forklaring: 'Langsommere, men sikrere: +0,3 overvågning på alle agenter.', effekt: { agentOvervaagning: 0.3, kunderPct: -0.02 } },
    ]),
  {
    id: 'aiTransformationDebat', titel: 'Transformationen rammer avisen', trigger: 'system', fraAar: 2026, tilAar: 2035, chancePrUge: 0, engang: false,
    tekst: '{antal} stillinger er erstattet af agenter. De tidligere kolleger fortæller deres historie i avisen, og resten af holdet er urolige.',
    valg: [
      { tekst: 'Generøs fratrædelse og omskoling', forklaring: 'Koster penge, men historien bliver en anden.', effekt: { kapital: -0.8, omdoemme: -1, energiAlle: 5 } },
      { tekst: 'Sådan er udviklingen', forklaring: 'Billigt, men omdømmet og stemningen får et hak.', effekt: { omdoemme: -6, energiAlle: -15 } },
      { tekst: 'Lov at der ikke kommer flere', forklaring: 'Holdet ånder lettet op. Investorerne gør ikke.', effekt: { energiAlle: 15, pres: 1, flag: 'transformationStop' } },
    ],
  },
];
