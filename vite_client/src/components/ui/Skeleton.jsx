import React from 'react';

const VARIANT_CLASS = {
  text: 'ui-skeleton--text',
  title: 'ui-skeleton--title',
  avatar: 'ui-skeleton--avatar',
  card: 'ui-skeleton--card',
};

export function Skeleton({ variant = 'text', className = '', style, ...props }) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.text;
  return (
    <span
      className={`ui-skeleton ${variantClass} ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

export default Skeleton;
