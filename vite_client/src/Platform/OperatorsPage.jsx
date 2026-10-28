import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FiPlus, FiRefreshCw, FiSearch, FiShield, FiUsers, FiX } from 'react-icons/fi';
import {
  createPlatformOperator,
  fetchPlatformOperators,
  updatePlatformOperator,
} from '../context/platformSlice';
import '../styles/platformOperators.css';

const ROLE_PERM_PREVIEW = {
  platform_super_admin: ['orgs_read', 'orgs_write', 'plans_write', 'operators_write', 'audit_read', 'billing_write'],
  platform_saas_admin: ['orgs_read', 'orgs_write', 'plans_write', 'audit_read', 'billing_write'],
  platform_support: ['orgs_read', 'orgs_write', 'audit_read'],
  platform_readonly: ['orgs_read', 'audit_read'],
};

const formatPerm = (p) => String(p || '').replace(/_/g, ':');

const initials = (name = '', email = '') => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return String(email || '?').slice(0, 2).toUpperCase();
};

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
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

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

  useEffect(() => {
    if (!modalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const roleOptions =
    assignableRoles?.length > 0
      ? assignableRoles
      : [
          { id: 'platform_super_admin', label: 'Super admin' },
          { id: 'platform_saas_admin', label: 'SaaS admin' },
          { id: 'platform_support', label: 'Support' },
          { id: 'platform_readonly', label: 'Read-only' },
        ];

  const stats = useMemo(() => {
    const list = operators || [];
    const total = list.length;
    const active = list.filter((o) => o.isActive).length;
    const superAdmins = list.filter((o) => (o.roles || []).includes('platform_super_admin')).length;
    return { total, active, inactive: total - active, superAdmins };
  }, [operators]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (operators || []).filter((op) => {
      if (statusFilter === 'active' && !op.isActive) return false;
      if (statusFilter === 'inactive' && op.isActive) return false;
      if (roleFilter !== 'all' && !(op.roles || []).includes(roleFilter)) return false;
      if (!q) return true;
      const hay = `${op.name || ''} ${op.email || ''} ${(op.roles || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [operators, search, roleFilter, statusFilter]);

  const previewPerms = ROLE_PERM_PREVIEW[form.roles[0]] || [];

  const resetForm = () =>
    setForm({ name: '', email: '', password: '', roles: ['platform_support'] });

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await dispatch(createPlatformOperator(form)).unwrap();
      toast.success('Operator created');
      resetForm();
      setModalOpen(false);
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

  const permChips = (op) => {
    const perms = op.permissions?.length
      ? op.permissions
      : ROLE_PERM_PREVIEW[op.roles?.[0]] || [];
    if (!perms.length) return <span className="op-perm">—</span>;
    return (
      <div className="op-perms">
        {perms.map((p) => (
          <span key={p} className="op-perm">
            {formatPerm(p)}
          </span>
        ))}
      </div>
    );
  };

  const roleSelect = (op) =>
    op.isSelf ? (
      <span className="op-role-badge">{roleLabel(op.roles)}</span>
    ) : (
      <select
        value={op.roles?.[0] || ''}
        onChange={(e) => changeRole(op, e.target.value)}
        className="op-role-select"
        aria-label={`Role for ${op.email}`}
      >
        {roleOptions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
        {op.roles?.[0] && !roleOptions.some((r) => r.id === op.roles[0]) && (
          <option value={op.roles[0]}>{op.roles[0]}</option>
        )}
      </select>
    );

  const actions = (op) => (
    <div className="op-actions">
      <button type="button" className="op-link" onClick={() => resetPassword(op)}>
        Reset password
      </button>
      {!op.isSelf && (
        <button
          type="button"
          className={`op-link ${op.isActive ? 'is-danger' : ''}`}
          onClick={() => toggleActive(op)}
        >
          {op.isActive ? 'Deactivate' : 'Activate'}
        </button>
      )}
    </div>
  );

  return (
    <div className="platform-operators">
      <header className="op-header">
        <div>
          <h1 className="op-title">Platform Operators</h1>
          <p className="op-sub">
            Manage control-panel accounts and privilege tiers (super admin, SaaS admin, support,
            read-only).
          </p>
        </div>
        <div className="op-header-actions">
          <button type="button" className="op-btn op-btn-secondary" onClick={load}>
            <FiRefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            className="op-btn op-btn-primary"
            onClick={() => setModalOpen(true)}
          >
            <FiPlus className="h-4 w-4" aria-hidden />
            Add operator
          </button>
        </div>
      </header>

      <div className="op-kpi-row">
        <div className="op-kpi">
          <div className="op-kpi-label">Total operators</div>
          <div className="op-kpi-value">{stats.total}</div>
        </div>
        <div className="op-kpi">
          <div className="op-kpi-label">Active</div>
          <div className="op-kpi-value">{stats.active}</div>
        </div>
        <div className="op-kpi">
          <div className="op-kpi-label">Super admins</div>
          <div className="op-kpi-value">{stats.superAdmins}</div>
        </div>
      </div>

      <div className="op-filters">
        <div className="op-search-wrap">
          <FiSearch className="op-search-icon h-4 w-4" aria-hidden />
          <input
            type="search"
            className="op-search"
            placeholder="Filter by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search operators"
          />
        </div>
        <select
          className="op-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {roleOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          className="op-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <section className="op-panel">
        <div className="op-panel-head">
          <div className="op-panel-head-main">
            <div className="op-panel-icon">
              <FiUsers className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="op-panel-title">
                Operators ({filtered.length}
                {filtered.length !== stats.total ? ` of ${stats.total}` : ''})
              </h2>
              <p className="op-panel-sub">Change roles, reset passwords, or activate / deactivate</p>
            </div>
          </div>
        </div>

        <div className="op-table-wrap">
          <table className="op-table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Role</th>
                <th>Permissions</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((op) => (
                <tr key={op.id}>
                  <td>
                    <div className="op-person">
                      <div className="op-av">{initials(op.name, op.email)}</div>
                      <div>
                        <div className="op-name">
                          {op.name || '—'}
                          {op.isSelf ? <span className="op-you">You</span> : null}
                        </div>
                        <div className="op-email">{op.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{roleSelect(op)}</td>
                  <td>{permChips(op)}</td>
                  <td>
                    <span className={`op-status ${op.isActive ? 'op-status-on' : 'op-status-off'}`}>
                      {op.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{actions(op)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={5} className="op-empty">
                    No operators match these filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="op-cards">
          {filtered.map((op) => (
            <div key={op.id} className="op-card">
              <div className="op-card-row">
                <div className="op-person">
                  <div className="op-av">{initials(op.name, op.email)}</div>
                  <div>
                    <div className="op-name">
                      {op.name || '—'}
                      {op.isSelf ? <span className="op-you">You</span> : null}
                    </div>
                    <div className="op-email">{op.email}</div>
                  </div>
                </div>
                <span className={`op-status ${op.isActive ? 'op-status-on' : 'op-status-off'}`}>
                  {op.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="op-card-fields">
                <div>
                  <label className="op-label">Role</label>
                  {roleSelect(op)}
                </div>
                <div>
                  <label className="op-label">Permissions</label>
                  {permChips(op)}
                </div>
                {actions(op)}
              </div>
            </div>
          ))}
          {!filtered.length && <div className="op-empty">No operators match these filters</div>}
        </div>
      </section>

      {modalOpen && (
        <div
          className="op-modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="op-modal" role="dialog" aria-modal="true" aria-labelledby="op-modal-title">
            <div className="op-modal-head">
              <div>
                <h2 id="op-modal-title" className="op-modal-title">
                  Add operator
                </h2>
                <p className="op-modal-sub">Create a new platform control-panel account</p>
              </div>
              <button
                type="button"
                className="op-modal-close"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
            <form className="op-modal-body" onSubmit={handleCreate}>
              <div className="op-form-grid">
                <div>
                  <label className="op-label" htmlFor="op-name">
                    Name
                  </label>
                  <input
                    id="op-name"
                    required
                    placeholder="Jane Operator"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="op-input"
                  />
                </div>
                <div>
                  <label className="op-label" htmlFor="op-email">
                    Email
                  </label>
                  <input
                    id="op-email"
                    required
                    type="email"
                    placeholder="ops@company.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="op-input"
                  />
                </div>
                <div>
                  <label className="op-label" htmlFor="op-password">
                    Password
                  </label>
                  <input
                    id="op-password"
                    required
                    type="password"
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="op-input"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="op-label" htmlFor="op-role">
                    Role
                  </label>
                  <select
                    id="op-role"
                    value={form.roles[0]}
                    onChange={(e) => setForm((f) => ({ ...f, roles: [e.target.value] }))}
                    className="op-select"
                  >
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="op-role-preview">
                <div className="op-role-preview-label">Permission preview</div>
                <div className="op-perms">
                  {previewPerms.map((p) => (
                    <span key={p} className="op-perm">
                      {formatPerm(p)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="op-modal-foot">
                <button
                  type="button"
                  className="op-btn op-btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="op-btn op-btn-primary">
                  <FiShield className="h-4 w-4" aria-hidden />
                  {saving ? 'Creating…' : 'Create operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorsPage;
