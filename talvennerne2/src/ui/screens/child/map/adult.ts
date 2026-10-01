// The grown-ups' button on the map: the adult gate (2-digit · 1-digit, SPEC §8) first, then the
// dashboard.
import { useNav } from '../../../../app/nav'
import { openAdultGate } from '../../../overlays/AdultGate'

export function openAdult(): void {
  openAdultGate(() => useNav.getState().go({ id: 'parent' }))
}
