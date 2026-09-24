// Pladsholder — erstattes af den rigtige implementering.
import type { Signal } from '../../sim/types';
import { Btn, Modal } from '../components/kit';

export default function QuarterDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  return (
    <Modal titel="QuarterDialog" onLuk={onLuk} testId="dialog-kvartal" fod={<Btn variant="primaer" onClick={onLuk}>OK</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(signal, null, 2)}</pre>
    </Modal>
  );
}
