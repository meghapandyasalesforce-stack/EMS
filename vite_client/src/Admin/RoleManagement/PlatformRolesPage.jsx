import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { fetchEmployees } from '../../context/employeeSlice';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import PermissionGate from '../../components/PermissionGate';
import LoadingSpinner from '../../components/LoadingSpinner';

const PLATFORM_ROLE_OPTIONS = [
  { value: 'org_owner', label: 'Organization owner' },
  { value: 'hr_admin', label: 'HR Manager (hr_admin)' },
  { value: 'hr_executive', label: 'HR Executive' },
  { value: 'payroll_admin', label: 'Payroll Admin' },
  { value: 'manager', label: 'Manager (platform)' },
  { value: 'employee', label: 'Employee (platform)' },
];

const FUNCTIONAL_ROLE_OPTIONS = [
  'hr',
  'manager',
  'project_manager',
  'finance',
  'executive',
  'ceo',
  'cto',
  'cfo',
  'vp',
];

const PlatformRolesPage = () => {
  const dispatch = useDispatch();
  const { employees, status } = useSelector((state) => state.employees);
  const { hasAnyPermission, isOrgOwner } = useAuthPermissions();
  const canManage =
    isOrgOwner ||
    hasAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE]);

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (canManage) {
      dispatch(fetchEmployees({ page: 1, limit: 100 }));
    }
  }, [dispatch, canManage]);

  useEffect(() => {
    const next = {};
    (employees || []).forEach((emp) => {
      const id = emp._id || emp.id;
      next[id] = {
        platformRoles: emp.platformRoles || [],
        functionalRoles: emp.functionalRoles || [],
        userId: emp.userId,
      };
    });
    setDrafts(next);
  }, [employees]);

  const toggleFunctional = (employeeId, role) => {
    setDrafts((prev) => {
      const current = prev[employeeId]?.functionalRoles || [];
      const set = new Set(current);
      if (set.has(role)) set.delete(role);
      else set.add(role);
      return {
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          functionalRoles: [...set],
        },
      };
    });
  };

  const togglePlatform = (employeeId, role) => {
    setDrafts((prev) => {
      const current = prev[employeeId]?.platformRoles || [];
      const set = new Set(current);
      if (set.has(role)) set.delete(role);
      else set.add(role);
      return {
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          platformRoles: [...set],
        },
      };
    });
  };

  const saveEmployee = async (emp) => {
    const id = emp._id || emp.id;
    const draft = drafts[id];
    if (!draft) return;

    setSavingId(id);
    try {
      await axios.patch(
        `/v1/admin/platform-roles/employees/${id}/functional-roles`,
        { functionalRoles: draft.functionalRoles || [] }
      );

      if (draft.userId && (draft.platformRoles || []).length) {
        await axios.patch(
          `/v1/admin/platform-roles/users/${draft.userId}/platform-roles`,
          { roles: draft.platformRoles }
        );
      }

      toast.success(`Roles updated for ${emp.name}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update roles');
    } finally {
      setSavingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center text-slate-600">
        You do not have permission to manage platform roles.
      </div>
    );
  }

  if (status === 'loading' && !employees?.length) {
    return <LoadingSpinner message="Loading team..." />;
  }

  return (
    <div className="page-shell">
      <div className="page-shell-inner hrms-stack">
      <div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Platform & functional roles</h1>
        <p className="mb-0 text-sm text-slate-500">
          Assign RBAC roles for login accounts (platform) and workforce hats (functional).
          Users must log out and back in after changes.
        </p>
      </div>

      <div className="hrms-stack">
        {(employees || []).map((emp) => {
          const id = emp._id || emp.id;
          const draft = drafts[id] || { functionalRoles: [], platformRoles: [] };
          const hasLinkedUser = !!draft.userId;

          return (
            <div
              key={id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {emp.name} {emp.lastName || ''}
                  </p>
                  <p className="text-xs text-slate-500">{emp.email}</p>
                  {!hasLinkedUser && (
                    <p className="mt-1 text-xs text-amber-600">
                      No linked login user — platform roles apply after account link.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={savingId === id}
                  onClick={() => saveEmployee(emp)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingId === id ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Functional roles (workforce)
                </p>
                <div className="flex flex-wrap gap-2">
                  {FUNCTIONAL_ROLE_OPTIONS.map((role) => (
                    <label
                      key={role}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={(draft.functionalRoles || []).includes(role)}
                        onChange={() => toggleFunctional(id, role)}
                      />
                      {role}
                    </label>
                  ))}
                </div>
              </div>

              <PermissionGate permissions={[PERMISSIONS.ORG_SETTINGS_MANAGE]}>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                    Platform roles (login account)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORM_ROLE_OPTIONS.map(({ value, label }) => (
                      <label
                        key={value}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${
                          hasLinkedUser
                            ? 'cursor-pointer border-slate-200'
                            : 'cursor-not-allowed border-slate-100 opacity-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!hasLinkedUser}
                          checked={(draft.platformRoles || []).includes(value)}
                          onChange={() => togglePlatform(id, value)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </PermissionGate>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
};

export default PlatformRolesPage;
