import React from 'react';
import { getElevatedRoleConfirmMessage } from '../utils/systemRoleHelpers';

const ElevatedRoleConfirmModal = ({
  open,
  roleId,
  roleLabel,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="elevated-role-title"
      >
        <h2 id="elevated-role-title" className="text-lg font-semibold text-slate-900">
          Confirm system access
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          {getElevatedRoleConfirmMessage(roleId, roleLabel)}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Confirm access
          </button>
        </div>
      </div>
    </div>
  );
};

export default ElevatedRoleConfirmModal;
