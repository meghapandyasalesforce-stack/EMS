import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { platformLogin, clearPlatformError } from '../context/platformSlice';

const PlatformLogin = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, sessionChecked, loading, error } = useSelector((state) => state.platform);
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  if (sessionChecked && user) {
    return <Navigate to="/platform" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    dispatch(clearPlatformError());
    try {
      await dispatch(
        platformLogin({
          email: form.email.toLowerCase().trim(),
          password: form.password,
        })
      ).unwrap();
      toast.success('Welcome to the control panel');
      navigate('/platform', { replace: true });
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="text-xs uppercase tracking-widest text-slate-400">Paarsiv EMS</div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Platform Control Panel</h1>
          <p className="mt-2 text-sm text-slate-400">
            Sign in with a platform operator account to manage tenant subscriptions.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="platform-email">
              Email
            </label>
            <input
              id="platform-email"
              type="email"
              required
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-slate-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300" htmlFor="platform-password">
              Password
            </label>
            <div className="relative">
              <input
                id="platform-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 pr-10 text-white outline-none focus:border-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PlatformLogin;
