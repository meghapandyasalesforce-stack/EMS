import React from 'react';

export function ErrorBanner({ message, children, onDismiss, className = '', ...props }) {
  return (
    <div className={`ui-error-banner ${className}`.trim()} role="alert" {...props}>
      <p className="ui-error-banner__message">{children ?? message}</p>
      {onDismiss ? (
        <button type="button" className="ui-error-banner__dismiss" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      ) : null}
    </div>
  );
}

export default ErrorBanner;
