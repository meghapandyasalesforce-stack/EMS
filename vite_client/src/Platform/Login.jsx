import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiEye,
  FiEyeOff,
  FiLock,
  FiShield,
  FiArrowRight,
  FiCheckCircle,
  FiUser,
} from 'react-icons/fi';
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
    <main className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
        style={{ backgroundColor: '#0F2D26', fontFamily: "'Manrope', 'Inter', system-ui, sans-serif" }}
      >
        {/* Mint dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(#65fcc9 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        {/* Soft ambient orbs */}
        <div
          className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: '#1CCA9B' }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: '#FF7F50' }}
          aria-hidden
        />

        {/* Status strip */}
        <div className="z-10 mb-4 flex w-full max-w-lg items-center justify-between gap-3 px-1 sm:mb-6">
          <div className="flex items-center gap-2" style={{ color: '#A8D5C5' }}>
            <span
              className="h-2 w-2 shrink-0 animate-pulse rounded-full"
              style={{ backgroundColor: '#1CCA9B' }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider sm:text-xs">
              Secure gateway · Active
            </span>
          </div>
          <div className="flex items-center gap-1.5" style={{ color: '#A8D5C5' }}>
            <FiShield className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden text-[11px] font-medium sm:inline sm:text-xs">
              Encrypted session
            </span>
          </div>
        </div>

        {/* Login card */}
        <div
          className="relative z-10 flex w-full max-w-lg flex-col rounded-3xl p-6 shadow-xl sm:p-8"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: '#ECF0EE' }}
            >
              <FiShield className="h-7 w-7" style={{ color: '#2A6B52' }} aria-hidden />
            </div>
            <span
              className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: '#5A7A70' }}
            >
              Infrastructure Control Plane
            </span>
            <h1
              className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]"
              style={{ color: '#0F2D26' }}
            >
              Operator Portal Login
            </h1>
            <p className="mt-1 text-sm sm:text-[15px]" style={{ color: '#5A7A70' }}>
              Secure multi-tenant administrative gateway
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 sm:mt-8">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  className="text-sm font-semibold"
                  style={{ color: '#0F2D26' }}
                  htmlFor="platform-email"
                >
                  Operator Identity
                </label>
                <span className="text-[11px] font-medium" style={{ color: '#5A7A70' }}>
                  Platform operator
                </span>
              </div>
              <div className="relative flex items-center">
                <FiUser
                  className="pointer-events-none absolute left-3 h-[18px] w-[18px]"
                  style={{ color: '#788882' }}
                  aria-hidden
                />
                <input
                  id="platform-email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="operator@company.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="h-11 w-full rounded-lg pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#788882] focus:ring-2 focus:ring-[#1CCA9B]/40"
                  style={{
                    backgroundColor: '#ECF0EE',
                    color: '#0F2D26',
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  className="text-sm font-semibold"
                  style={{ color: '#0F2D26' }}
                  htmlFor="platform-password"
                >
                  Password
                </label>
                <Link
                  to="/platform/forgot-password"
                  className="text-[11px] font-semibold underline transition-opacity hover:opacity-80 sm:text-xs"
                  style={{ color: '#2A6B52' }}
                >
                  Forgot credentials?
                </Link>
              </div>
              <div className="relative flex items-center">
                <FiLock
                  className="pointer-events-none absolute left-3 h-[18px] w-[18px]"
                  style={{ color: '#788882' }}
                  aria-hidden
                />
                <input
                  id="platform-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Enter security passphrase"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className="h-11 w-full rounded-lg pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[#788882] focus:ring-2 focus:ring-[#1CCA9B]/40"
                  style={{
                    backgroundColor: '#ECF0EE',
                    color: '#0F2D26',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 flex items-center justify-center p-1 transition-colors hover:opacity-80"
                  style={{ color: '#788882' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm font-medium" style={{ color: '#C62828' }} role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#1CCA9B] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: '#2A6B52' }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#1F523E';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2A6B52';
              }}
            >
              <span>{loading ? 'Signing in…' : 'Sign In to Super Admin'}</span>
              {!loading && (
                <FiArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              )}
            </button>
          </form>

          <div
            className="-mx-6 -mb-6 mt-6 flex items-center justify-center gap-2 rounded-b-3xl px-4 py-3 text-center sm:-mx-8 sm:-mb-8"
            style={{ backgroundColor: '#ECF0EE' }}
          >
            <FiLock className="h-3.5 w-3.5 shrink-0" style={{ color: '#788882' }} aria-hidden />
            <p className="text-xs leading-snug sm:text-[13px]" style={{ color: '#5A7A70' }}>
              Session activity is audited. Connection secured with TLS encryption.
            </p>
          </div>
        </div>

        {/* Footer links (decorative / informational) */}
        <div
          className="z-10 mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center"
          style={{ color: '#A8D5C5' }}
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-medium sm:text-xs">
            <FiShield className="h-3 w-3" aria-hidden />
            Paarsiv EMS
          </span>
          <span className="opacity-40" aria-hidden>
            •
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium sm:text-xs">
            <FiCheckCircle className="h-3 w-3" aria-hidden />
            Platform Control Panel
          </span>
        </div>
      </div>
    </main>
  );
};

export default PlatformLogin;
