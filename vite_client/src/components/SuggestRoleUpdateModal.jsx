import React from 'react';
import { getElevatedRoleConfirmMessage } from '../utils/systemRoleHelpers';

const SuggestRoleUpdateModal = ({
  open,
  employeeName,
  currentRoleLabel,
  suggestedRoleLabel,
  suggestedRoleId,
  reason,
  saving = false,
  onApply,
  onDismiss,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-role-update-title"
      >
        <h2 id="suggest-role-update-title" className="text-lg font-semibold text-slate-900">
          Update system access?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {employeeName ? `${employeeName}'s` : 'This employee\'s'} job details were updated. Based on the new
          profile, we suggest changing system access from{' '}
          <span className="font-medium text-slate-900">{currentRoleLabel}</span> to{' '}
          <span className="font-medium text-emerald-700">{suggestedRoleLabel}</span>
          {reason ? ` (${reason})` : ''}.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {getElevatedRoleConfirmMessage(suggestedRoleId, suggestedRoleLabel)}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Keep current access
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Updating…' : 'Update access'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuggestRoleUpdateModal;
