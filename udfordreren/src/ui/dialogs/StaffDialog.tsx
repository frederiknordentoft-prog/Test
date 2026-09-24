// Medarbejderdialog (klik på en figur i kontoret): samme info og handlinger som på Personale-panelet.
import type { UiDialog } from '../../store/uiStore';
import { useUi } from '../../store/uiStore';
import { useGame } from '../../store/gameStore';
import { Btn, Ikon, Modal, Tom } from '../components/kit';
import { MedarbejderKort, statusFor } from '../components/FirmaMedarbejder';

export default function StaffDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  const staffId = dialog.kind === 'medarbejder' ? dialog.staffId : '';
  const g = useGame((s) => s.game);
  const m = g?.staff.find((x) => x.id === staffId);

  const tilPersonale = () => {
    useUi.getState().setPanel('personale');
    onLuk();
  };

  return (
    <Modal
      titel={m ? m.navn : 'Medarbejder'}
      onLuk={onLuk}
      bredde={540}
      testId="dialog-medarbejder"
      fod={
        <>
          <Btn onClick={tilPersonale} testId="medarbejder-til-personale">
            <Ikon navn="folk" farve="currentColor" str={14} /> Alle medarbejdere
          </Btn>
          <Btn variant="primaer" onClick={onLuk} testId="medarbejder-luk">
            Luk
          </Btn>
        </>
      }
    >
      {g && m ? (
        <MedarbejderKort m={m} status={statusFor(g, m.id)} onFyret={onLuk} udenRamme />
      ) : (
        <Tom>Medarbejderen er ikke længere i firmaet.</Tom>
      )}
    </Modal>
  );
}
