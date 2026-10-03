import { useState } from 'react';
import './App.css';
import FunctionGraph from './components/FunctionGraph';
import FunctionPanel from './components/FunctionPanel';
import CirclePanel from './components/CirclePanel';
import PanelSection from './components/PanelSection';
import SettingsDialog, { type SettingsTab } from './components/dialogs/SettingsDialog';
import GearIcon from './components/GearIcon';
import { useCalculatorState } from './state/useCalculatorState';

export default function App() {
  const api = useCalculatorState();
  // A panel's settings belong to the panel as a whole, so its gear sits on the
  // panel's own header row beside the title rather than among the controls it
  // governs. Every gear opens the same dialog, at its own panel's tab, and the
  // app's appearance is a tab there too.
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

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
          actions={settingsButton('Function settings', () => setSettingsTab('function'))}
        >
          <FunctionPanel api={api} />
        </PanelSection>
        <PanelSection name="circle" title="Circle">
          <CirclePanel api={api} />
        </PanelSection>
        <PanelSection
          name="graph"
          title="Graph"
          actions={settingsButton('Graph settings', () => setSettingsTab('graph'))}
        >
          <FunctionGraph api={api} />
        </PanelSection>
      </main>

      {settingsTab && <SettingsDialog api={api} initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
    </div>
  );
}
