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
import { getSystemRoleHome } from '../../../../utils/systemRoleHome';
import LoadingSpinner from '../../../../components/LoadingSpinner';

const SCOPE_OPTIONS = [
  { value: 'default', label: 'Default for role', hint: 'HR/Payroll → org; Manager → team; Employee → self' },
  { value: 'organization', label: 'Whole organization', hint: 'See all employees in this company' },
  { value: 'department', label: 'Own department only', hint: 'Only people in their department' },
  { value: 'departments', label: 'Selected departments', hint: 'Pick one or more departments' },
  { value: 'team', label: 'Direct reports only', hint: 'People who report to them' },
  { value: 'self', label: 'Self only', hint: 'Only their own record' },
];

const AccessTab = ({ employeeId, employee = null, canEdit = true, onAccessUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState(null);
  const [draftRole, setDraftRole] = useState(DEFAULT_SYSTEM_ROLE);
  const [draftScope, setDraftScope] = useState('default');
  const [draftDeptIds, setDraftDeptIds] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showElevatedModal, setShowElevatedModal] = useState(false);

  const loadAccess = async () => {
    try {
      setLoading(true);
      const [accessRes, catalogRes] = await Promise.all([
        axios.get(`/v1/admin/platform-roles/employees/${employeeId}/access`),
        axios.get('/v1/admin/org-structure/catalog', { withCredentials: true }).catch(() => null),
      ]);
      const data = accessRes.data?.data || accessRes.data;
      setAccess(data);
      setDraftRole(data.systemRoleId || DEFAULT_SYSTEM_ROLE);
      setDraftScope(data.accessDataScope || 'default');
      setDraftDeptIds((data.accessDepartmentIds || []).map((id) => String(id)));
      const cat = catalogRes?.data?.data || catalogRes?.data || {};
      setDepartments(Array.isArray(cat.departments) ? cat.departments : []);
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
      const home = getSystemRoleHome(draftRole);
      await axios.patch(`/v1/admin/platform-roles/employees/${employeeId}/system-role`, {
        systemRole: draftRole,
        accessDataScope: draftScope,
        accessDepartmentIds: draftScope === 'departments' ? draftDeptIds : [],
        syncJobProfile: false,
      });
      toast.success(
        `Access & home updated to ${roleLabel} (${home.label}). Ask them to log out and back in.`
      );
      await loadAccess();
      if (typeof onAccessUpdated === 'function') {
        await onAccessUpdated();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update access');
    } finally {
      setSaving(false);
      setShowElevatedModal(false);
    }
  };

  const handleSave = () => {
    if (!canEdit) return;
    if (draftScope === 'departments' && draftDeptIds.length === 0) {
      toast.error('Select at least one department for “Selected departments” scope.');
      return;
    }

    const unchanged =
      draftRole === access?.systemRoleId &&
      draftScope === (access?.accessDataScope || 'default') &&
      (draftScope !== 'departments' ||
        JSON.stringify([...draftDeptIds].sort()) ===
          JSON.stringify([...(access?.accessDepartmentIds || []).map(String)].sort()));

    if (unchanged) return;

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

  const toggleDept = (id) => {
    const sid = String(id);
    setDraftDeptIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
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
  const dirty =
    draftRole !== access.systemRoleId ||
    draftScope !== (access.accessDataScope || 'default') ||
    (draftScope === 'departments' &&
      JSON.stringify([...draftDeptIds].sort()) !==
        JSON.stringify([...(access.accessDepartmentIds || []).map(String)].sort()));
  const suggestedLabel = getRoleLabel(draftMismatch.suggestedRoleId, catalog);
  const currentLabel = getRoleLabel(access.systemRoleId, catalog);
  const draftLabel = getRoleLabel(draftRole, catalog);
  const currentHome = getSystemRoleHome(access.systemRoleId);

  return (
    <div className="space-y-6">
      {roleMismatch.mismatch && employee ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Job profile and Access &amp; home may differ</p>
          <p className="mt-1">
            Based on job details, we suggest{' '}
            <span className="font-semibold">{suggestedLabel}</span>
            {draftMismatch.suggestedReason ? ` (${draftMismatch.suggestedReason})` : ''}. Current access
            is <span className="font-semibold">{currentLabel}</span> → {currentHome.label}.
          </p>
          {canEdit && draftMismatch.suggestedRoleId !== draftRole ? (
            <button
              type="button"
              onClick={handleApplySuggestedRole}
              className="mt-3 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
            >
              Apply suggested access
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Access &amp; home screen</h3>
        <p className="mb-4 text-sm text-slate-500">
          Controls which dashboard and modules they get after login. Department and job title are labels only.
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
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Data they can see</h3>
        <p className="mb-4 text-sm text-slate-500">
          Optional SaaS scope — who appears in employee lists for this person. Independent of Access &amp; home.
        </p>

        <div className="space-y-2">
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 ${
                draftScope === opt.value
                  ? 'border-emerald-300 bg-emerald-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="accessDataScope"
                className="mt-1"
                checked={draftScope === opt.value}
                onChange={() => setDraftScope(opt.value)}
                disabled={!canEdit || saving}
              />
              <span>
                <span className="block text-sm font-medium text-slate-900">{opt.label}</span>
                <span className="block text-xs text-slate-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {draftScope === 'departments' ? (
          <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {departments.length === 0 ? (
              <p className="p-2 text-xs text-slate-500">
                No departments yet. Add them under Organization → Org Structure.
              </p>
            ) : (
              departments.map((d) => (
                <label
                  key={d._id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={draftDeptIds.includes(String(d._id))}
                    onChange={() => toggleDept(d._id)}
                    disabled={!canEdit || saving}
                  />
                  {d.name}
                </label>
              ))
            )}
          </div>
        ) : null}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save access'}
          </button>
          {dirty && (
            <span className="text-xs text-amber-600">
              Unsaved changes — user must re-login after save.
            </span>
          )}
        </div>
      )}

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
          <p>
            <span className="font-medium text-slate-700">Home:</span> {currentHome.label}
          </p>
          <p>
            <span className="font-medium text-slate-700">Data scope:</span>{' '}
            {SCOPE_OPTIONS.find((o) => o.value === (access.accessDataScope || 'default'))?.label ||
              'Default for role'}
          </p>
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
