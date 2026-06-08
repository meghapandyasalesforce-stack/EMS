import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../../../utils/axios';
import SystemRolePicker from '../../../../components/SystemRolePicker';
import { DEFAULT_SYSTEM_ROLE, formatPermissionLabel } from '../../../../utils/systemRoles';
import LoadingSpinner from '../../../../components/LoadingSpinner';

const AccessTab = ({ employeeId, canEdit = true }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState(null);
  const [draftRole, setDraftRole] = useState(DEFAULT_SYSTEM_ROLE);

  const loadAccess = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/v1/admin/platform-roles/employees/${employeeId}/access`);
      const data = res.data?.data || res.data;
      setAccess(data);
      setDraftRole(data.systemRoleId || DEFAULT_SYSTEM_ROLE);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load access settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) loadAccess();
  }, [employeeId]);

  const handleSave = async () => {
    if (!canEdit || draftRole === access?.systemRoleId) return;
    setSaving(true);
    try {
      await axios.patch(`/v1/admin/platform-roles/employees/${employeeId}/system-role`, {
        systemRole: draftRole,
      });
      toast.success('System access updated. Ask them to log out and back in.');
      await loadAccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update system access');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading access settings..." />;
  }

  if (!access) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
        Unable to load access settings.
      </div>
    );
  }

  const catalog = access.catalog || [];
  const preview = access.permissionPreview || [];
  const dirty = draftRole !== access.systemRoleId;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">System access</h3>
        <p className="mb-4 text-sm text-slate-500">
          Controls what this person can do in the app. Job title and department are separate from
          system access.
        </p>

        <SystemRolePicker
          catalog={catalog}
          value={draftRole}
          onChange={setDraftRole}
          disabled={!canEdit || saving}
          showPreview
        />

        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save access'}
            </button>
            {dirty && (
              <span className="text-xs text-amber-600">Unsaved changes — user must re-login after save.</span>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">Current permissions</h4>
        {preview.length === 0 ? (
          <p className="text-sm text-slate-500">Standard employee self-service only.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {preview.map((perm) => (
              <li
                key={perm}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              >
                {formatPermissionLabel(perm)}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
          <p>
            <span className="font-medium text-slate-700">Login account:</span>{' '}
            {access.hasLinkedUser ? 'Linked' : 'Employee record only'}
          </p>
          {access.functionalRoles?.length > 0 && (
            <p>
              <span className="font-medium text-slate-700">Workforce roles:</span>{' '}
              {access.functionalRoles.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AccessTab;
