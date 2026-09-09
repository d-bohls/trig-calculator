import { useState } from 'react';
import './App.css';
import FunctionGraph from './components/FunctionGraph';
import FunctionPanel from './components/FunctionPanel';
import CirclePanel from './components/CirclePanel';
import PanelSection from './components/PanelSection';
import FunctionSettingsDialog from './components/dialogs/FunctionSettingsDialog';
import { useCalculatorState } from './state/useCalculatorState';

export default function App() {
  const api = useCalculatorState();
  // Function Settings (decimal places, arc toggle) is the only app-level
  // dialog left; window size/tangent, automation, and symbolic representation
  // all live behind their own icon buttons on the graph panel.
  const [functionSettingsOpen, setFunctionSettingsOpen] = useState(false);

  return (
    <div className="app">
      <main className="app__main">
        <PanelSection name="function" title="Functions">
          <FunctionPanel api={api} onOpenSettings={() => setFunctionSettingsOpen(true)} />
        </PanelSection>
        <PanelSection name="circle" title="Circle">
          <CirclePanel api={api} />
        </PanelSection>
        <PanelSection name="graph" title="Graph">
          <FunctionGraph api={api} />
        </PanelSection>
      </main>

      {functionSettingsOpen && (
        <FunctionSettingsDialog api={api} onClose={() => setFunctionSettingsOpen(false)} />
      )}
    </div>
  );
}
