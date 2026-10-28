import React from 'react';

export function EmptyState({ icon, title, children, action = null, className = '', ...props }) {
  return (
    <div className={`ui-empty ${className}`.trim()} {...props}>
      {icon ? <div className="ui-empty__icon">{icon}</div> : null}
      {title ? <h3 className="ui-empty__title">{title}</h3> : null}
      {children ? <div className="ui-empty__desc">{children}</div> : null}
      {action}
    </div>
  );
}

export default EmptyState;
