// Pladsholder — erstattes af den rigtige implementering.
import type { UiDialog } from '../../store/uiStore';
import { Btn, Modal } from '../components/kit';

export default function SettingsDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  return (
    <Modal titel="SettingsDialog" onLuk={onLuk} testId="dialog-indstillinger" fod={<Btn onClick={onLuk}>Luk</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(dialog, null, 2)}</pre>
    </Modal>
  );
}
