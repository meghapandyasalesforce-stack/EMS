import React from 'react';

export function Card({ tonal = false, flush = false, className = '', children, ...props }) {
  const mods = [
    tonal ? 'ui-card--tonal' : '',
    flush ? 'ui-card--flush' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={`ui-card ${mods} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export default Card;
