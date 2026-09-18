import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  createPlatformOperator,
  fetchPlatformOperators,
  updatePlatformOperator,
} from '../context/platformSlice';

const OperatorsPage = () => {
  const dispatch = useDispatch();
  const { operators, assignableRoles } = useSelector((state) => state.platform);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    roles: ['platform_support'],
  });
  const [saving, setSaving] = useState(false);

  const load = () =>
    dispatch(fetchPlatformOperators())
      .unwrap()
      .catch((err) => {
        const message = typeof err === 'string' ? err : 'Failed to load operators';
        if (!/session expired|log in again/i.test(message)) toast.error(message);
      });

  useEffect(() => {
    load();
  }, [dispatch]);

  const roleOptions =
    assignableRoles?.length > 0
      ? assignableRoles
      : [
          { id: 'platform_super_admin', label: 'Super admin' },
          { id: 'platform_saas_admin', label: 'SaaS admin' },
          { id: 'platform_support', label: 'Support' },
          { id: 'platform_readonly', label: 'Read-only' },
        ];

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dispatch(createPlatformOperator(form)).unwrap();
      toast.success('Operator created');
      setForm({ name: '', email: '', password: '', roles: ['platform_support'] });
      await load();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to create operator');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (op) => {
    try {
      await dispatch(
        updatePlatformOperator({
          userId: op.id,
          payload: { isActive: !op.isActive },
        })
      ).unwrap();
      toast.success(op.isActive ? 'Operator deactivated' : 'Operator activated');
      await load();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Update failed');
    }
  };

  const changeRole = async (op, roleId) => {
    try {
      await dispatch(
        updatePlatformOperator({ userId: op.id, payload: { roles: [roleId] } })
      ).unwrap();
      toast.success('Role updated');
      await load();
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Role update failed');
    }
  };

  const resetPassword = async (op) => {
    const password = window.prompt(`New password for ${op.email} (min 8 chars)`);
    if (!password) return;
    try {
      await dispatch(
        updatePlatformOperator({ userId: op.id, payload: { password } })
      ).unwrap();
      toast.success('Password updated');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Password reset failed');
    }
  };

  const roleLabel = (roles = []) => {
    const id = roles[0];
    return roleOptions.find((r) => r.id === id)?.label || roles.join(', ') || '—';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Operators</h1>
        <p className="mt-1 text-sm text-slate-600">
          Control-panel accounts with coarse RBAC (super admin / SaaS admin / support / read-only).
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-5"
      >
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          required
          type="password"
          minLength={8}
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={form.roles[0]}
          onChange={(e) => setForm((f) => ({ ...f, roles: [e.target.value] }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Add operator'}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Operator</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {operators.map((op) => (
              <tr key={op.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">
                    {op.name} {op.isSelf ? '(you)' : ''}
                  </div>
                  <div className="text-xs text-slate-500">{op.email}</div>
                </td>
                <td className="px-4 py-3">
                  {op.isSelf ? (
                    <span>{roleLabel(op.roles)}</span>
                  ) : (
                    <select
                      value={op.roles?.[0] || ''}
                      onChange={(e) => changeRole(op, e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                      {op.roles?.[0] &&
                        !roleOptions.some((r) => r.id === op.roles[0]) && (
                          <option value={op.roles[0]}>{op.roles[0]}</option>
                        )}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3">
                  {op.isActive ? (
                    <span className="text-emerald-700">Active</span>
                  ) : (
                    <span className="text-rose-700">Inactive</span>
                  )}
                </td>
                <td className="space-x-3 px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => resetPassword(op)}
                    className="text-sm font-medium underline"
                  >
                    Reset password
                  </button>
                  {!op.isSelf && (
                    <button
                      type="button"
                      onClick={() => toggleActive(op)}
                      className="text-sm font-medium underline"
                    >
                      {op.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!operators.length && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                  No operators found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OperatorsPage;
