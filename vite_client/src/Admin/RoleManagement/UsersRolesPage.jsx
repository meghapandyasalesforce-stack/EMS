import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import SystemRolePicker from '../../components/SystemRolePicker';
import ElevatedRoleConfirmModal from '../../components/ElevatedRoleConfirmModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DEFAULT_SYSTEM_ROLE } from '../../utils/systemRoles';
import { getSystemRoleHome } from '../../utils/systemRoleHome';
import { getRoleLabel, isElevatedSystemRole } from '../../utils/systemRoleHelpers';

const ROLE_BADGE_COLORS = {
  hr_manager: 'bg-violet-100 text-violet-800',
  hr_executive: 'bg-sky-100 text-sky-800',
  payroll_admin: 'bg-amber-100 text-amber-800',
  line_manager: 'bg-indigo-100 text-indigo-800',
  project_manager: 'bg-teal-100 text-teal-800',
  executive: 'bg-rose-100 text-rose-800',
  employee: 'bg-slate-100 text-slate-700',
};

const SCOPE_LABELS = {
  default: 'Default for role',
  organization: 'Whole organization',
  department: 'Own department',
  departments: 'Selected departments',
  team: 'Direct reports only',
  self: 'Self only',
};

const UsersRolesPage = () => {
  const { hasAnyPermission, isOrgOwner } = useAuthPermissions();
  const canManage =
    isOrgOwner ||
    hasAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE]);

  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [draftRole, setDraftRole] = useState(DEFAULT_SYSTEM_ROLE);
  const [draftScope, setDraftScope] = useState('default');
  const [draftDeptIds, setDraftDeptIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showElevatedModal, setShowElevatedModal] = useState(false);

  const loadRoster = async () => {
    try {
      setLoading(true);
      const [rosterRes, catalogRes] = await Promise.all([
        axios.get('/v1/admin/platform-roles/roster'),
        axios.get('/v1/admin/org-structure/catalog', { withCredentials: true }).catch(() => null),
      ]);
      const data = rosterRes.data?.data || rosterRes.data;
      setRoster(data.roster || []);
      setCatalog(data.catalog || []);
      const cat = catalogRes?.data?.data || catalogRes?.data || {};
      setDepartments(Array.isArray(cat.departments) ? cat.departments : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users & roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) loadRoster();
  }, [canManage]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.jobTitle?.toLowerCase().includes(q) ||
        r.systemRoleLabel?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
    );
  }, [roster, search]);

  const openEdit = (row) => {
    setEditRow(row);
    setDraftRole(row.systemRoleId || DEFAULT_SYSTEM_ROLE);
    setDraftScope(row.accessDataScope || 'default');
    setDraftDeptIds((row.accessDepartmentIds || []).map((id) => String(id)));
  };

  const closeEdit = () => {
    setEditRow(null);
    setDraftRole(DEFAULT_SYSTEM_ROLE);
    setDraftScope('default');
    setDraftDeptIds([]);
    setShowElevatedModal(false);
  };

  const performSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await axios.patch(
        `/v1/admin/platform-roles/employees/${editRow.employeeId}/system-role`,
        {
          systemRole: draftRole,
          accessDataScope: draftScope,
          accessDepartmentIds: draftScope === 'departments' ? draftDeptIds : [],
          syncJobProfile: false,
        }
      );
      toast.success(`Access & home updated for ${editRow.name}. Ask them to re-login.`);
      closeEdit();
      await loadRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update access');
    } finally {
      setSaving(false);
      setShowElevatedModal(false);
    }
  };

  const handleSave = () => {
    if (!editRow) return;
    if (draftScope === 'departments' && draftDeptIds.length === 0) {
      toast.error('Select at least one department for “Selected departments” scope.');
      return;
    }
    const elevating =
      isElevatedSystemRole(draftRole) && draftRole !== editRow.systemRoleId;
    if (elevating) {
      setShowElevatedModal(true);
      return;
    }
    performSave();
  };

  const toggleDept = (id) => {
    const sid = String(id);
    setDraftDeptIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center text-slate-600">
        You do not have permission to manage users and roles.
      </div>
    );
  }

  if (loading && !roster.length) {
    return <LoadingSpinner message="Loading team access..." />;
  }

  const draftLabel = getRoleLabel(draftRole, catalog);
  const dirty =
    editRow &&
    (draftRole !== editRow.systemRoleId ||
      draftScope !== (editRow.accessDataScope || 'default') ||
      (draftScope === 'departments' &&
        JSON.stringify([...draftDeptIds].sort()) !==
          JSON.stringify([...(editRow.accessDepartmentIds || []).map(String)].sort())));

  return (
    <div className="page-shell">
      <div className="page-shell-inner hrms-stack">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users &amp; roles</h1>
          <p className="mt-1 text-sm text-slate-500 max-w-3xl">
            Change <strong>Access &amp; home</strong> for people already in your org (dashboard + modules).
            Optionally limit <strong>which employee data</strong> they can see. Job department is separate —
            it does not pick their home screen.
          </p>
        </div>

        <div className="mb-4">
          <input
            type="search"
            placeholder="Search by name, email, department, or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-slate-600 md:table-cell">
                  Email
                </th>
                <th className="hidden px-4 py-3 text-left font-semibold text-slate-600 lg:table-cell">
                  Job title
                </th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Access &amp; home</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-slate-600 xl:table-cell">
                  Data scope
                </th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const home = getSystemRoleHome(row.systemRoleId);
                return (
                  <tr key={row.employeeId} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <Link
                        to={`/employees/${row.employeeId}`}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{row.email}</td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                      {row.jobTitle || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          ROLE_BADGE_COLORS[row.systemRoleId] || ROLE_BADGE_COLORS.employee
                        }`}
                      >
                        {row.systemRoleLabel}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">{home.label}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-600 xl:table-cell">
                      {SCOPE_LABELS[row.accessDataScope || 'default'] || 'Default for role'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Edit access
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No people match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              role="dialog"
              aria-labelledby="edit-access-title"
            >
              <h2 id="edit-access-title" className="text-lg font-semibold text-slate-900">
                Edit Access &amp; home
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {editRow.name} · {editRow.email}
              </p>

              <div className="mt-4">
                <SystemRolePicker
                  catalog={catalog}
                  value={draftRole}
                  onChange={setDraftRole}
                  disabled={saving}
                />
              </div>

              <div className="mt-5 space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Data they can see
                </label>
                <p className="text-xs text-slate-500">
                  Optional. Default follows the role (e.g. managers → direct reports, HR → whole org).
                </p>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  value={draftScope}
                  onChange={(e) => setDraftScope(e.target.value)}
                  disabled={saving}
                >
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                {draftScope === 'departments' ? (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {departments.length === 0 ? (
                      <p className="text-xs text-slate-500 p-2">No departments yet. Add some under Org Structure.</p>
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
                          />
                          {d.name}
                        </label>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !dirty}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        <ElevatedRoleConfirmModal
          open={showElevatedModal}
          roleId={draftRole}
          roleLabel={draftLabel}
          onConfirm={performSave}
          onCancel={() => setShowElevatedModal(false)}
        />
      </div>
    </div>
  );
};

export default UsersRolesPage;
