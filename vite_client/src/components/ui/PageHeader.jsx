import React from 'react';

export function PageHeader({ title, subtitle, actions = null, className = '', ...props }) {
  return (
    <header className={`ui-page-header ${className}`.trim()} {...props}>
      <div className="min-w-0">
        {title != null ? <h1 className="ui-page-header__title">{title}</h1> : null}
        {subtitle != null ? <p className="ui-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
