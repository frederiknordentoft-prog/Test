// Pladsholder — erstattes af den rigtige implementering.
import type { UiDialog } from '../../store/uiStore';
import { Btn, Modal } from '../components/kit';

export default function StaffDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  return (
    <Modal titel="StaffDialog" onLuk={onLuk} testId="dialog-medarbejder" fod={<Btn onClick={onLuk}>Luk</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(dialog, null, 2)}</pre>
    </Modal>
  );
}
