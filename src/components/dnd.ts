// Tiny module-level drag source holder (simpler than serialising into
// dataTransfer for this single-window prototype).
import { Source } from '../store/gameStore';

let dragSource: Source | null = null;

export function setDragSource(s: Source | null) {
  dragSource = s;
}
export function getDragSource(): Source | null {
  return dragSource;
}
