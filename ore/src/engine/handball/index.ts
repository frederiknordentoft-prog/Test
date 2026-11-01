/** Hallen: men's handball match engine (possession chain) and pricing (Stern + first passage). */
export * from './params';
export { advantage, attackP, conversions, KICKOFF, planAttack, runPath, stateAt } from './chain';
export type { ChainState, Phase, PlanEv, Suspension, Via } from './chain';
export * from './sim';
export * from './pricing';
export * from './director';
