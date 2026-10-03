// The one settings dialog, with a tab for the app's appearance and one for
// each panel that has settings. Each panel's gear opens it at that panel's tab.
//
// Every field applies live as it changes. Cancel puts back everything changed
// since the dialog opened, on every tab; Reset sits inside the tab's own
// border because it only resets that tab. The border says so to the eye but
// not to a screen reader, so each Reset is named for its tab ("Reset Graph"),
// starting with the word on the button so voice control still finds it.

import { useRef, useState, type KeyboardEvent } from 'react';
import type { CalculatorApi } from '../../state/useCalculatorState';
import Modal from '../Modal';
import AppearanceSettingsTab from './AppearanceSettingsTab';
import FunctionSettingsTab from './FunctionSettingsTab';
import GraphSettingsTab from './GraphSettingsTab';
import {
  restoreFunctionSettings,
  restoreGraphSettings,
  snapshotFunctionSettings,
  snapshotGraphSettings,
} from './settingsSnapshots';
import './SettingsDialog.css';

export type SettingsTab = 'appearance' | 'function' | 'graph';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'function', label: 'Functions' },
  { id: 'graph', label: 'Graph' },
];

export default function SettingsDialog({
  api,
  initialTab,
  onClose,
}: {
  api: CalculatorApi;
  initialTab: SettingsTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const tabRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement | null>>>({});
  const initial = useRef({
    theme: api.theme,
    function: snapshotFunctionSettings(api),
    graph: snapshotGraphSettings(api),
  });

  function cancel() {
    api.setTheme(initial.current.theme);
    // the function settings go back first: they include the angle mode and
    // the graph kind, which decide whose window the graph's goes back into
    restoreFunctionSettings(api, initial.current.function);
    restoreGraphSettings(api, initial.current.graph);
    onClose();
  }

  // the arrow keys move along the tabs, as in any tab strip, and only the
  // selected one is a stop for the Tab key
  function onTabKeyDown(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + step + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const panel = (id: SettingsTab) => {
    switch (id) {
      case 'appearance':
        return <AppearanceSettingsTab api={api} />;
      case 'function':
        return <FunctionSettingsTab api={api} />;
      case 'graph':
        // A Functions reset can change the angle unit or the kind of graph,
        // and with it the window these fields show, so they start over when
        // either changes rather than going on showing the old window.
        return <GraphSettingsTab key={`${api.graphKind}-${api.angleMode}`} api={api} />;
    }
  };

  return (
    <Modal title="Settings" onClose={cancel}>
      <div className="settings-dialog">
        <div className="settings-tabs" role="tablist" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${t.id}`}
              className="settings-tabs__tab"
              aria-selected={tab === t.id}
              aria-controls={`settings-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Every tab is drawn, stacked in the one place, and only the selected
            one shown. That sizes the box to the tallest of them, so switching
            tabs doesn't resize the dialog under the pointer, and a half-typed
            field survives a look at another tab. */}
        <div className="settings-sheet">
          {TABS.map((t) => (
            <div
              key={t.id}
              role="tabpanel"
              id={`settings-panel-${t.id}`}
              aria-labelledby={`settings-tab-${t.id}`}
              className="settings-sheet__panel"
              hidden={tab !== t.id}
            >
              {panel(t.id)}
            </div>
          ))}
        </div>
        <div className="settings-dialog__actions">
          <button type="button" onClick={onClose}>
            OK
          </button>
          <button type="button" onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
