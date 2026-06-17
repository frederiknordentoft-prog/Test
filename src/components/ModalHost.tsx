// Samler alle globale modaler ét sted.
import CheckInModal from './CheckInModal';
import AlignModal from './AlignModal';
import ObjectiveEditor from './ObjectiveEditor';
import KrEditor from './KrEditor';
import InitiativeEditor from './InitiativeEditor';

export default function ModalHost() {
  return (
    <>
      <CheckInModal />
      <AlignModal />
      <ObjectiveEditor />
      <KrEditor />
      <InitiativeEditor />
    </>
  );
}
