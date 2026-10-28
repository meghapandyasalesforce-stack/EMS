import React from 'react';

/** paarsiv wordmark — p/s green, rest navy. Presentational only. */
const MeWordmark = ({ className = 'text-xl', as: Tag = 'h3' }) =>
  React.createElement(
    Tag,
    { className: `font-extrabold tracking-tight ${className}`.trim(), 'aria-label': 'paarsiv' },
    React.createElement('span', { className: 'me-wordmark-p' }, 'p'),
    React.createElement('span', { className: 'me-wordmark-rest' }, 'a'),
    React.createElement('span', { className: 'me-wordmark-rest' }, 'a'),
    React.createElement('span', { className: 'me-wordmark-rest' }, 'r'),
    React.createElement('span', { className: 'me-wordmark-s' }, 's'),
    React.createElement('span', { className: 'me-wordmark-rest' }, 'i'),
    React.createElement('span', { className: 'me-wordmark-rest' }, 'v')
  );

export default MeWordmark;
