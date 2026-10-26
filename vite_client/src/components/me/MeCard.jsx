import React from 'react';

/** Presentational card surface for Me portal screens. */
const MeCard = ({ as: Comp = 'div', className = '', children, ...props }) => (
  <Comp className={`me-card ${className}`.trim()} {...props}>
    {children}
  </Comp>
);

export default MeCard;
