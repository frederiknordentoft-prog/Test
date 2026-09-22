// Tiny typed event bus between game, presentation, audio and UI.
export interface BusEvents {
  'state': { from: string; to: string };
  'balance': { balanceOre: number };
  'stake': { stakeOre: number };
  'kp': { kp: number; charge: number; K: number };
  'win:final': { totalOre: number; stakeOre: number; profile: 'win' | 'return' | 'push' | 'none' };
  'storm:count': { index: number; total: number; winOre: number; stakeOre: number } | null;
  'perk': { pending: number; lockedStakeOre: number };
  'toast': { text: string; tone?: 'info' | 'warn' | 'storm' };
  'settings': Record<string, unknown>;
}
type Handler<T> = (p: T) => void;
const handlers = new Map<keyof BusEvents, Set<Handler<any>>>();
export const bus = {
  on<K extends keyof BusEvents>(k: K, h: Handler<BusEvents[K]>): () => void {
    let s = handlers.get(k);
    if (!s) handlers.set(k, (s = new Set()));
    s.add(h);
    return () => s!.delete(h);
  },
  emit<K extends keyof BusEvents>(k: K, p: BusEvents[K]): void {
    handlers.get(k)?.forEach((h) => h(p));
  },
};
