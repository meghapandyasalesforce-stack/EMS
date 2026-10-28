import React from 'react';

/** Loading skeleton block — presentational only. */
const MeSkeleton = ({ className = '', width, height = '1rem', style, ...props }) => (
  <span
    className={`me-skeleton ${className}`.trim()}
    style={{ width: width || '100%', height, display: 'block', ...style }}
    aria-hidden
    {...props}
  />
);

export default MeSkeleton;
