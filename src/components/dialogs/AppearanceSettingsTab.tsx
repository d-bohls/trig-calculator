// How the app looks, as a whole rather than any one of its panels.

import type { CalculatorApi } from '../../state/useCalculatorState';
import { DEFAULT_SETTINGS, THEMES, type Theme } from '../../state/persistence';

const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

export default function AppearanceSettingsTab({ api }: { api: CalculatorApi }) {
  return (
    <>
      <div className="settings-dialog__field">
        <span id="settings-theme-label">Theme</span>
        {/* radio buttons drawn as one segmented control: one choice of three,
            with the arrow keys moving between them for free */}
        <div className="segmented" role="radiogroup" aria-labelledby="settings-theme-label">
          {THEMES.map((t) => (
            <label key={t} className="segmented__option">
              <input
                type="radio"
                name="settings-theme"
                value={t}
                checked={api.theme === t}
                onChange={() => api.setTheme(t)}
              />
              <span>{THEME_LABELS[t]}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="settings-dialog__reset">
        <button type="button" aria-label="Reset Appearance" onClick={() => api.setTheme(DEFAULT_SETTINGS.theme)}>
          Reset
        </button>
      </div>
    </>
  );
}
