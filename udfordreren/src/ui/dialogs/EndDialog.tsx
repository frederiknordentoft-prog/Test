// Pladsholder — erstattes af den rigtige implementering.
import type { Signal } from '../../sim/types';
import { Btn, Modal } from '../components/kit';

export default function EndDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  return (
    <Modal titel="EndDialog" onLuk={onLuk} testId="dialog-slut" fod={<Btn variant="primaer" onClick={onLuk}>OK</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(signal, null, 2)}</pre>
    </Modal>
  );
}
