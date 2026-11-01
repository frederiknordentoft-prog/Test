/** Temporary stub until the handball engine is merged (replaced in F5). */
export interface HallenView { h: number; a: number; minute: string; asks: [number, number, number] }
export class HallenStore {
  private view: HallenView = { h: 0, a: 0, minute: '0′', asks: [55, 9, 40] };
  subscribe = (_l: () => void) => () => {};
  getView = () => this.view;
  onFrame(_l: () => void): () => void {
    return () => {};
  }
  trace(_n: number): number[] {
    return [];
  }
  start(): void {}
  stop(): void {}
}
