import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import axios from '../utils/axios';
import { UNIFIED_AUTH_ENDPOINT } from '../utils/constant';

const emptyForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/**
 * In-session change password (keeps you logged in; refreshes auth cookies).
 */
const ChangePasswordForm = ({ className = '' }) => {
  const [form, setForm] = useState(emptyForm);
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);

  const onChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        `${UNIFIED_AUTH_ENDPOINT}/change-password`,
        {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword,
        },
        { withCredentials: true }
      );

      if (res.data?.csrfToken && typeof window !== 'undefined') {
        localStorage.setItem('csrfToken', res.data.csrfToken);
      }

      toast.success(res.data?.message || 'Password updated successfully');
      setForm(emptyForm);
    } catch (error) {
      toast.error(
        error.response?.data?.message || 'Failed to update password'
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (id, label, value, onChangeFn, visible, toggleKey) => (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={id === 'currentPassword' ? 'current-password' : 'new-password'}
          value={value}
          onChange={onChangeFn}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm outline-none focus:border-theme-primary focus:ring-2 focus:ring-theme-primary/20"
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => ({ ...s, [toggleKey]: !s[toggleKey] }))}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-gray-800"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <FiEyeOff /> : <FiEye />}
        </button>
      </div>
    </div>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-theme-primary/10 p-2 text-theme-primary">
          <FiLock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">Change password</h3>
          <p className="mt-0.5 text-sm text-gray-600">
            Update your password while staying signed in. Use a strong password with
            upper &amp; lowercase letters, a number, and a special character.
          </p>
        </div>
      </div>

      {field(
        'currentPassword',
        'Current password',
        form.currentPassword,
        onChange('currentPassword'),
        show.current,
        'current'
      )}
      {field(
        'newPassword',
        'New password',
        form.newPassword,
        onChange('newPassword'),
        show.next,
        'next'
      )}
      {field(
        'confirmPassword',
        'Confirm new password',
        form.confirmPassword,
        onChange('confirmPassword'),
        show.confirm,
        'confirm'
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center justify-center rounded-lg bg-theme-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
