import { useState } from 'react';
import './App.css';
import FunctionGraph from './components/FunctionGraph';
import FunctionPanel from './components/FunctionPanel';
import CirclePanel from './components/CirclePanel';
import PanelSection from './components/PanelSection';
import FunctionSettingsDialog from './components/dialogs/FunctionSettingsDialog';
import GraphSettingsDialog from './components/dialogs/GraphSettingsDialog';
import GearIcon from './components/GearIcon';
import { useCalculatorState } from './state/useCalculatorState';

export default function App() {
  const api = useCalculatorState();
  // A panel's settings belong to the panel as a whole, so its gear sits on the
  // panel's own header row beside the title rather than among the controls it
  // governs. That puts the button here, and the dialog it opens with it.
  const [functionSettingsOpen, setFunctionSettingsOpen] = useState(false);
  const [graphSettingsOpen, setGraphSettingsOpen] = useState(false);

  const settingsButton = (label: string, onClick: () => void) => (
    <button type="button" className="icon-button" onClick={onClick} aria-label={label} title={label}>
      <GearIcon />
    </button>
  );

  return (
    <div className="app">
      <main className="app__main">
        <PanelSection
          name="function"
          title="Functions"
          actions={settingsButton('Function settings', () => setFunctionSettingsOpen(true))}
        >
          <FunctionPanel api={api} />
        </PanelSection>
        <PanelSection name="circle" title="Circle">
          <CirclePanel api={api} />
        </PanelSection>
        <PanelSection
          name="graph"
          title="Graph"
          actions={settingsButton('Graph settings', () => setGraphSettingsOpen(true))}
        >
          <FunctionGraph api={api} />
        </PanelSection>
      </main>

      {functionSettingsOpen && (
        <FunctionSettingsDialog api={api} onClose={() => setFunctionSettingsOpen(false)} />
      )}
      {graphSettingsOpen && <GraphSettingsDialog api={api} onClose={() => setGraphSettingsOpen(false)} />}
    </div>
  );
}
