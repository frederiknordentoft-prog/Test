// Samler alle globale modaler ét sted.
import CheckInModal from './CheckInModal';
import AlignModal from './AlignModal';

export default function ModalHost() {
  return (
    <>
      <CheckInModal />
      <AlignModal />
    </>
  );
}
