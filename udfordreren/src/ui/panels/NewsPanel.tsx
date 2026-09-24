// Pladsholder — erstattes af den rigtige implementering.
import { Panel, Tom } from '../components/kit';

export default function NewsPanel() {
  return (
    <Panel titel="Nyheder" testId="panel-nyheder">
      <Tom>Nyheder kommer snart.</Tom>
    </Panel>
  );
}
