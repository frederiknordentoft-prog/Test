// Pladsholder — erstattes af den rigtige implementering.
import type { Signal } from '../../sim/types';
import { Btn, Modal } from '../components/kit';

export default function EventDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  return (
    <Modal titel="EventDialog" onLuk={onLuk} testId="dialog-event" fod={<Btn variant="primaer" onClick={onLuk}>OK</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(signal, null, 2)}</pre>
    </Modal>
  );
}
