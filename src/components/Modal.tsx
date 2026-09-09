import type { ReactNode } from 'react';
import './Modal.css';

export default function Modal({
  title,
  onClose,
  children,
  width,
  blocking = true,
  corner = 'top-right',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** Set false for a floating, non-blocking window (mirrors the original
   *  VB6 app's vbModeless dialogs - Automation and Symbolic Representation -
   *  which stay open while you keep using the rest of the app). Defaults to
   *  a blocking modal, matching the VB6 vbModal dialogs (Settings, Zoom, etc). */
  blocking?: boolean;
  /** Where a non-blocking window docks - only relevant when blocking is false.
   *  Two corners so Automation and Symbolic Representation, both modeless,
   *  can be open at the same time without overlapping each other. */
  corner?: 'top-right' | 'bottom-right';
}) {
  const modelessClass = corner === 'bottom-right' ? 'modal__overlay--modeless-bottom' : 'modal__overlay--modeless-top';
  return (
    <div
      className={blocking ? 'modal__overlay' : `modal__overlay modal__overlay--modeless ${modelessClass}`}
      onMouseDown={(e) => blocking && e.target === e.currentTarget && onClose()}
    >
      <div className="modal__box" style={width ? { width } : undefined}>
        <div className="modal__header">
          <span>{title}</span>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
