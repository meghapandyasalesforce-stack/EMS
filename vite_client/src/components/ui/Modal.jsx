import React from 'react';

export function Modal({ open = false, onClose, title, children, actions = null, className = '', ...props }) {
  if (!open) return null;

  return (
    <>
      <button type="button" className="ui-modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="ui-modal" role="presentation">
        <div
          className={`ui-modal__panel ${className}`.trim()}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : 'Dialog'}
          {...props}
        >
          {title != null ? <h2 className="ui-modal__title">{title}</h2> : null}
          <div className="ui-modal__body">{children}</div>
          {actions ? <div className="ui-modal__actions">{actions}</div> : null}
        </div>
      </div>
    </>
  );
}

export default Modal;
