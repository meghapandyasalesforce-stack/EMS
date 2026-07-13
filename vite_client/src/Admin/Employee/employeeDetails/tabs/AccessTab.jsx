import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../../../utils/axios';
import SystemRolePicker from '../../../../components/SystemRolePicker';
import ElevatedRoleConfirmModal from '../../../../components/ElevatedRoleConfirmModal';
import useSuggestedSystemRole from '../../../../Hooks/useSuggestedSystemRole';
import { DEFAULT_SYSTEM_ROLE, formatPermissionLabel } from '../../../../utils/systemRoles';
import {
  getRoleLabel,
  getRoleMismatch,
  isElevatedSystemRole,
} from '../../../../utils/systemRoleHelpers';
import LoadingSpinner from '../../../../components/LoadingSpinner';

const AccessTab = ({ employeeId, employee = null, canEdit = true, onAccessUpdated }) => {

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState(null);
  const [draftRole, setDraftRole] = useState(DEFAULT_SYSTEM_ROLE);
  const [showElevatedModal, setShowElevatedModal] = useState(false);

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
  }, [
    employeeId,
    employee?.functionalRoles?.join(','),
    employee?.jobTitle,
    employee?.department,
    employee?.position,
  ]);

  const catalog = access?.catalog || [];

  const { suggestion: serverSuggestion, loading: suggestionLoading } = useSuggestedSystemRole(
    {
      department: employee?.department,
      jobTitle: employee?.jobTitle,
      position: employee?.position,
    },
    { enabled: Boolean(employee) }
  );

  const roleMismatch = useMemo(() => {
    if (!access || suggestionLoading) return { mismatch: false };
    return getRoleMismatch({
      department: employee?.department,
      jobTitle: employee?.jobTitle,
      position: employee?.position,
      systemRoleId: access.systemRoleId,
      suggestedRoleId: serverSuggestion.systemRoleId,
    });
  }, [access, employee, serverSuggestion.systemRoleId, suggestionLoading]);

  const draftMismatch = useMemo(() => {
    if (!access || suggestionLoading) return { mismatch: false };
    return getRoleMismatch({
      department: employee?.department,
      jobTitle: employee?.jobTitle,
      position: employee?.position,
      systemRoleId: draftRole,
      suggestedRoleId: serverSuggestion.systemRoleId,
    });
  }, [access, draftRole, employee, serverSuggestion.systemRoleId, suggestionLoading]);

  const performSave = async () => {
    setSaving(true);
    try {
      const roleLabel = getRoleLabel(draftRole, catalog);
      await axios.patch(`/v1/admin/platform-roles/employees/${employeeId}/system-role`, {
        systemRole: draftRole,
      });
      toast.success(`System access updated to ${roleLabel}. Ask them to log out and back in.`);
      await loadAccess();
      if (typeof onAccessUpdated === 'function') {
        await onAccessUpdated(); // parent refreshes employee + navbar session
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update system access');
    } finally {
      setSaving(false);
      setShowElevatedModal(false);
    }
  };

  const handleSave = () => {
    if (!canEdit || draftRole === access?.systemRoleId) return;

    const isNewElevation =
      isElevatedSystemRole(draftRole) && draftRole !== access?.systemRoleId;

    if (isNewElevation) {
      setShowElevatedModal(true);
      return;
    }

    performSave();
  };

  const handleApplySuggestedRole = () => {
    if (!draftMismatch.suggestedRoleId) return;
    setDraftRole(draftMismatch.suggestedRoleId);
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

  const preview = access.permissionPreview || [];
  const dirty = draftRole !== access.systemRoleId;
  const suggestedLabel = getRoleLabel(draftMismatch.suggestedRoleId, catalog);
  const currentLabel = getRoleLabel(access.systemRoleId, catalog);
  const draftLabel = getRoleLabel(draftRole, catalog);

  return (
    <div className="space-y-6">
      {roleMismatch.mismatch && employee ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Job profile and system access may be out of sync</p>
          <p className="mt-1">
            Based on {employee.department || 'department'}, {employee.jobTitle || 'job title'}, and{' '}
            {employee.position || 'position'}, we suggest{' '}
            <span className="font-semibold">{suggestedLabel}</span>
            {draftMismatch.suggestedReason ? ` (${draftMismatch.suggestedReason})` : ''}. Current access
            is <span className="font-semibold">{currentLabel}</span>.
          </p>
          {canEdit && draftMismatch.suggestedRoleId !== draftRole ? (
            <button
              type="button"
              onClick={handleApplySuggestedRole}
              className="mt-3 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
            >
              Apply suggested role
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">System access</h3>
        <p className="mb-4 text-sm text-slate-500">
          Controls what this person can do in the app. Job title and department are separate from
          system access.
        </p>

        {dirty && draftMismatch.mismatch ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Your selection ({draftLabel}) differs from the suggested role ({suggestedLabel}).
          </div>
        ) : null}

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

      <ElevatedRoleConfirmModal
        open={showElevatedModal}
        roleId={draftRole}
        roleLabel={draftLabel}
        onConfirm={performSave}
        onCancel={() => setShowElevatedModal(false)}
      />
    </div>
  );
};

export default AccessTab;
