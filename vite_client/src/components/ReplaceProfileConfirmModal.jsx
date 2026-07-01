import React from 'react';

const ReplaceProfileConfirmModal = ({ open, existingProfile, onConfirm, onCancel }) => {
  if (!open) return null;

  const displayName = existingProfile
    ? `${existingProfile.name || ''} ${existingProfile.lastName || ''}`.trim() ||
      existingProfile.email
    : 'this employee';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="replace-profile-title"
      >
        <h2 id="replace-profile-title" className="text-lg font-semibold text-slate-900">
          Replace Existing Profile?
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          A profile already exists for {displayName}. Do you want to replace the existing profile
          with the new one?
        </p>
        {existingProfile?.employeeId ? (
          <p className="mt-2 text-xs text-slate-500">Employee ID: {existingProfile.employeeId}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReplaceProfileConfirmModal;
