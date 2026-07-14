import { useState } from 'react';
import { usePlan } from './hooks/usePlan';
import { Wizard } from './components/wizard/Wizard';
import { ResultView } from './components/timeline/ResultView';
import { Toast, useToast } from './components/ui/Toast';

export default function App() {
  const { state, dispatch } = usePlan();
  const { message, show } = useToast();
  const [editingSetup, setEditingSetup] = useState(false);

  return (
    <div className="app">
      <header className="app-bar">
        <span className="app-brand">
          <span aria-hidden="true">🍞</span> Surdej
        </span>
      </header>

      <main className="app-main">
        {state.input === null || editingSetup ? (
          <Wizard
            initial={state.input ?? undefined}
            onSubmit={(input) => {
              dispatch({ type: 'create', input });
              setEditingSetup(false);
            }}
            onCancel={state.input ? () => setEditingSetup(false) : undefined}
          />
        ) : (
          <ResultView
            input={state.input}
            doneIds={state.doneIds}
            createdAt={state.createdAt}
            onSetFinish={(finishAt) => dispatch({ type: 'setFinish', finishAt })}
            onDelay={(id, minutes) => dispatch({ type: 'delay', id, minutes })}
            onToggleDone={(id) => dispatch({ type: 'toggleDone', id })}
            onReset={() => {
              if (window.confirm('Slette den nuværende plan og starte forfra?')) {
                dispatch({ type: 'reset' });
              }
            }}
            onEdit={() => setEditingSetup(true)}
            showToast={show}
          />
        )}
      </main>

      <Toast message={message} />
    </div>
  );
}
