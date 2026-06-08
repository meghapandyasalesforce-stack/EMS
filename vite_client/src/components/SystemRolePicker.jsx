import React from 'react';
import { formatPermissionLabel } from '../utils/systemRoles';

/**
 * SaaS-style system role selector with description + optional permission preview.
 */
const SystemRolePicker = ({
  catalog = [],
  value,
  onChange,
  disabled = false,
  showPreview = true,
  label = 'System access',
  className = '',
}) => {
  const selected = catalog.find((r) => r.id === value) || catalog[0];

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled || !catalog.length}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-slate-50"
        >
          {catalog.map((role) => (
            <option key={role.id} value={role.id}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {selected?.description && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          {selected.description}
        </p>
      )}

      {showPreview && selected?.permissionPreview?.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Access includes
            {selected.permissionCount > selected.permissionPreview.length
              ? ` (${selected.permissionCount} permissions)`
              : ''}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {selected.permissionPreview.map((perm) => (
              <li
                key={perm}
                className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800"
              >
                {formatPermissionLabel(perm)}
              </li>
            ))}
            {selected.permissionCount > selected.permissionPreview.length && (
              <li className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                +{selected.permissionCount - selected.permissionPreview.length} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SystemRolePicker;
