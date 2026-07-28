import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import useAuthPermissions from '../../Hooks/useAuthPermissions';
import { PERMISSIONS } from '../../utils/permissions';
import SystemRolePicker from '../../components/SystemRolePicker';
import LoadingSpinner from '../../components/LoadingSpinner';
import { DEFAULT_SYSTEM_ROLE } from '../../utils/systemRoles';

const ROLE_BADGE_COLORS = {
  hr_manager: 'bg-violet-100 text-violet-800',
  hr_executive: 'bg-sky-100 text-sky-800',
  payroll_admin: 'bg-amber-100 text-amber-800',
  line_manager: 'bg-indigo-100 text-indigo-800',
  project_manager: 'bg-teal-100 text-teal-800',
  executive: 'bg-rose-100 text-rose-800',
  employee: 'bg-slate-100 text-slate-700',
};

const UsersRolesPage = () => {
  const { hasAnyPermission, isOrgOwner } = useAuthPermissions();
  const canManage =
    isOrgOwner ||
    hasAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE]);

  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const [draftRole, setDraftRole] = useState(DEFAULT_SYSTEM_ROLE);
  const [saving, setSaving] = useState(false);

  const loadRoster = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/v1/admin/platform-roles/roster');
      const data = res.data?.data || res.data;
      setRoster(data.roster || []);
      setCatalog(data.catalog || []);
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
        r.systemRoleLabel?.toLowerCase().includes(q)
    );
  }, [roster, search]);

  const openEdit = (row) => {
    setEditRow(row);
    setDraftRole(row.systemRoleId || DEFAULT_SYSTEM_ROLE);
  };

  const closeEdit = () => {
    setEditRow(null);
    setDraftRole(DEFAULT_SYSTEM_ROLE);
  };

  const handleSave = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await axios.patch(
        `/v1/admin/platform-roles/employees/${editRow.employeeId}/system-role`,
        { systemRole: draftRole }
      );
      toast.success(`Updated access for ${editRow.name}`);
      closeEdit();
      await loadRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="page-shell">
      <div className="page-shell-inner hrms-stack">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Users &amp; roles</h1>
        <p className="mt-1 text-sm text-slate-500">
          Assign system access for your team. Changes take effect after the user logs out and back in.
        </p>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search by name, email, or role…"
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
              <th className="px-4 py-3 text-left font-semibold text-slate-600">System role</th>
              <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) => (
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
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
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
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="edit-access-title"
          >
            <h2 id="edit-access-title" className="text-lg font-semibold text-slate-900">
              Edit system access
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
                disabled={saving || draftRole === editRow.systemRoleId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default UsersRolesPage;
