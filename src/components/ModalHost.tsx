// Samler alle globale modaler ét sted.
import CheckInModal from './CheckInModal';
import AlignModal from './AlignModal';
import ObjectiveEditor from './ObjectiveEditor';
import KrEditor from './KrEditor';
import InitiativeEditor from './InitiativeEditor';
import CommandPalette from './CommandPalette';
import CycleModal from './CycleModal';

export default function ModalHost() {
  return (
    <>
      <CommandPalette />
      <CheckInModal />
      <AlignModal />
      <ObjectiveEditor />
      <KrEditor />
      <InitiativeEditor />
      <CycleModal />
    </>
  );
}
