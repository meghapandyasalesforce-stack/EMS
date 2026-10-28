import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export function ConfirmDialog({
  open = false,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  className = '',
  ...props
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button type="button" className="ui-modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="ui-modal" role="presentation">
        <div
          className={`ui-modal__panel ${className}`.trim()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="ui-confirm-title"
          {...props}
        >
          <h2 id="ui-confirm-title" className="ui-modal__title">
            {title}
          </h2>
          <div className="ui-modal__body">{children ?? message}</div>
          <div className="ui-modal__actions">
            <Button variant="outlined" type="button" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} type="button" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default ConfirmDialog;
