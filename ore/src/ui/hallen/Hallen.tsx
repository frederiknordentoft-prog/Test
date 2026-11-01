import type { HallenStore } from '../../state/hallen';
import { go } from '../router';
export function HallenScreen({ store, demo }: { store: HallenStore; demo: boolean }) {
  void store;
  void demo;
  return (
    <div className="screen">
      <div className="bar"><button className="back" aria-label="Tilbage" onClick={() => go('lobby')}>‹</button><h1>Hallen</h1></div>
    </div>
  );
}
