import React from 'react';

export function Drawer({
  open = false,
  onClose,
  title,
  children,
  footer = null,
  side = 'right',
  className = '',
  ...props
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="ui-drawer-backdrop"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className={`ui-drawer ${side === 'left' ? 'ui-drawer--left' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Drawer'}
        {...props}
      >
        {(title != null || onClose) && (
          <div className="ui-drawer__header">
            {title != null ? <h2 className="ui-drawer__title">{title}</h2> : <span />}
            {onClose ? (
              <button type="button" className="ui-btn ui-btn--icon ui-btn--outlined" onClick={onClose} aria-label="Close">
                ×
              </button>
            ) : null}
          </div>
        )}
        <div className="ui-drawer__body">{children}</div>
        {footer ? <div className="ui-drawer__footer">{footer}</div> : null}
      </aside>
    </>
  );
}

export default Drawer;
