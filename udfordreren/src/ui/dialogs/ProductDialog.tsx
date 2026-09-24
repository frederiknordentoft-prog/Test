// Pladsholder — erstattes af den rigtige implementering.
import type { UiDialog } from '../../store/uiStore';
import { Btn, Modal } from '../components/kit';

export default function ProductDialog({ dialog, onLuk }: { dialog: UiDialog; onLuk: () => void }) {
  return (
    <Modal titel="ProductDialog" onLuk={onLuk} testId="dialog-produkt" fod={<Btn onClick={onLuk}>Luk</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(dialog, null, 2)}</pre>
    </Modal>
  );
}
