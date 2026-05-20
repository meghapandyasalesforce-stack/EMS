import React from 'react';
import { TIMEZONE_OPTIONS } from '../utils/timezoneOptions';

/**
 * Shared timezone dropdown for organization settings and attendance rules.
 */
const TimezoneSelect = ({
  value,
  onChange,
  label = 'Timezone',
  hint,
  id = 'timezone',
  className = '',
  disabled = false,
}) => (
  <div className={className}>
    {label ? (
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
    ) : null}
    <select
      id={id}
      value={value || 'UTC'}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] disabled:bg-gray-100"
    >
      {TIMEZONE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </div>
);

export default TimezoneSelect;
