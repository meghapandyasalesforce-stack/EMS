import React from 'react';

/** Illustrated empty state — presentational only. */
const MeEmptyState = ({ icon, title, children, className = '' }) => (
  <div className={`me-empty ${className}`.trim()} role="status">
    {icon ? <div className="me-empty__icon" aria-hidden>{icon}</div> : null}
    {title ? <p className="me-empty__title">{title}</p> : null}
    {children ? <div className="me-empty__body">{children}</div> : null}
  </div>
);

export default MeEmptyState;
