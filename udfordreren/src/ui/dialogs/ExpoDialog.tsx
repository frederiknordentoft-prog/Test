// Pladsholder — erstattes af den rigtige implementering.
import type { Signal } from '../../sim/types';
import { Btn, Modal } from '../components/kit';

export default function ExpoDialog({ signal, onLuk }: { signal: Signal; onLuk: () => void }) {
  return (
    <Modal titel="ExpoDialog" onLuk={onLuk} testId="dialog-messe" fod={<Btn variant="primaer" onClick={onLuk}>OK</Btn>}>
      <pre className="whitespace-pre-wrap text-xs text-muted">{JSON.stringify(signal, null, 2)}</pre>
    </Modal>
  );
}
