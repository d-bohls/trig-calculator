// One of the three top-level panels, with a header that collapses it.
//
// The header only appears in the stacked layout, where the panels sit one
// above another and scrolling past a section you aren't using is a chore.
// Side by side there's nothing to scroll past, so CSS hides the control and
// ignores the collapsed flag rather than the state being torn down - widen
// the window and everything is simply open again, at whatever state it was.

import { useState, type ReactNode } from 'react';

export default function PanelSection({
  name,
  title,
  children,
}: {
  /** modifier suffix for the panel's class, e.g. "graph" */
  name: string;
  title: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyId = `panel-${name}-body`;

  return (
    <section className={`app__panel app__panel--${name}`} data-collapsed={collapsed}>
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
      {/* display: contents, so wrapping the panel's content to make it
          collapsible doesn't introduce a box that changes the layout */}
      <div className="app__panel-body" id={bodyId}>
        {children}
      </div>
    </section>
  );
}
