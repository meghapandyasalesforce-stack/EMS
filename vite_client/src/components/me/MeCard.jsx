import React from 'react';

/** Presentational card surface for Me portal screens. */
const MeCard = ({ as: Tag = 'div', className = '', children, ...props }) =>
  React.createElement(Tag, { className: `me-card ${className}`.trim(), ...props }, children);

export default MeCard;
