import React from 'react';

const VARIANT_CLASS = {
  primary: 'ui-btn--primary',
  secondary: 'ui-btn--secondary',
  inverted: 'ui-btn--inverted',
  dark: 'ui-btn--dark', /* alias of inverted (deep navy) */
  outlined: 'ui-btn--outlined',
  danger: 'ui-btn--danger',
  icon: 'ui-btn--icon',
};

const SIZE_CLASS = {
  sm: 'ui-btn--sm',
  lg: 'ui-btn--lg',
};

/**
 * Presentational button. Pass through all native button props/handlers unchanged.
 */
export function Button({
  variant = 'primary',
  size,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;
  const sizeClass = SIZE_CLASS[size] || '';
  const iconClass = variant === 'icon' ? 'ui-btn--icon' : '';
  return (
    <button
      type={type}
      className={`ui-btn ${variantClass} ${sizeClass} ${iconClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
