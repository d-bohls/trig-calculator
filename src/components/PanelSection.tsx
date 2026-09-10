// One of the three top-level panels: a header row, then its content.
//
// The header carries the panel's title and whatever buttons belong to the
// panel as a whole rather than to one control inside it - its settings gear.
// The title doubles as the collapse control, but only in the stacked layout,
// where an unused section is something to scroll past. Side by side there is
// nothing to scroll past, so CSS hides the title and ignores the collapsed
// flag rather than the state being torn down: widen the window and everything
// is open again, at whatever state it was. The buttons stay either way, which
// is why the row itself is always here.

import { useState, type ReactNode } from 'react';

export default function PanelSection({
  name,
  title,
  actions,
  children,
}: {
  /** modifier suffix for the panel's class, e.g. "graph" */
  name: string;
  title: string;
  /** buttons for the panel as a whole, shown at the end of the header row */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = `panel-${name}-body`;

  return (
    <section className={`app__panel app__panel--${name}`} data-collapsed={collapsed}>
      <div className="app__panel-head">
        <button
          type="button"
          className="app__panel-toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed((c) => !c)}
        >
          <span className="app__panel-chevron" aria-hidden="true">
            ▾
          </span>
          {title}
        </button>
        {actions && <div className="app__panel-actions">{actions}</div>}
      </div>
      {/* display: contents, so wrapping the panel's content to make it
          collapsible doesn't introduce a box that changes the layout */}
      <div className="app__panel-body" id={bodyId}>
        {children}
      </div>
    </section>
  );
}
