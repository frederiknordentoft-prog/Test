// Pladsholder — erstattes af den rigtige implementering.
import type { UiDialog } from '../../store/uiStore';
import { Btn, Modal } from '../components/kit';

export default function SaveLoadDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  return (
    <Modal titel="SaveLoadDialog" onLuk={onLuk} testId="dialog-gemIndlaes" fod={<Btn onClick={onLuk}>Luk</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(dialog, null, 2)}</pre>
    </Modal>
  );
}
