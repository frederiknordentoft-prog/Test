import { useStore } from './state/store';
import { da } from './i18n/da';
import { TunnelCanvas } from './ui/TunnelCanvas';
import { DrawLayer } from './ui/DrawLayer';
import { ControlsBar } from './ui/ControlsBar';
import { ShapeToolbar } from './ui/ShapeToolbar';
import { OverlayPicker } from './ui/OverlayPicker';
import { ForceGauges } from './ui/ForceGauges';
import { ProbeReadout } from './ui/ProbeReadout';
import { Legend } from './ui/Legend';
import { AdvancedPanel } from './ui/AdvancedPanel';
import { LabelsOverlay } from './ui/LabelsOverlay';
import { LessonBubbles } from './ui/LessonBubbles';
import { ChallengePanel } from './ui/ChallengePanel';
import { CompareView } from './ui/CompareView';
import { useChallengeWatcher } from './learn/useChallengeWatcher';

export default function App() {
  const toast = useStore((s) => s.toast);
  const compareMode = useStore((s) => s.compareMode);
  useChallengeWatcher();

  return (
    <div className="app">
      <header className="topbar">
        <h1>{da.appTitle}</h1>
        <OverlayPicker />
      </header>

      {compareMode ? (
        <CompareView />
      ) : (
        <>
          <div className="tunnel-wrap">
            <TunnelCanvas />
            <DrawLayer />
            <LabelsOverlay />
            <ProbeReadout />
            <Legend />
          </div>
          <ForceGauges />
        </>
      )}

      <ShapeToolbar />
      <ControlsBar />
      <AdvancedPanel />
      <ChallengePanel />
      <LessonBubbles />

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
