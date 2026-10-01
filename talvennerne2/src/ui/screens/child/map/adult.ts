// The grown-ups' button on the map. The gate itself (2-digit · 1-digit, SPEC §8) is built elsewhere
// (src/ui/overlays/AdultGate.tsx); until it lands the button goes straight to the dashboard.
import { useNav } from '../../../../app/nav'

// TODO(AdultGate): open the gate here and go to the dashboard only when it is passed.
export function openAdult(): void {
  useNav.getState().go({ id: 'parent' })
}
