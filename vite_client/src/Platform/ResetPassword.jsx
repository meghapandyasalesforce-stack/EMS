import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiEye, FiEyeOff, FiLock, FiShield } from 'react-icons/fi';
import {
  platformResetPassword,
  clearPlatformPasswordReset,
} from '../context/platformSlice';

const shellStyle = {
  backgroundColor: '#0F2D26',
  fontFamily: "'Manrope', 'Inter', system-ui, sans-serif",
};

const PlatformResetPassword = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useParams();
  const { loading, success, error, message } = useSelector(
    (state) => state.platform.passwordReset
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    dispatch(clearPlatformPasswordReset());
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      toast.success(message || 'Password reset successful!');
      try {
        localStorage.removeItem('csrfToken');
        localStorage.removeItem('role');
      } catch {
        // ignore
      }
      const timer = setTimeout(() => {
        dispatch(clearPlatformPasswordReset());
        navigate('/platform/login', { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (error) {
      toast.error(error);
    }
    return undefined;
  }, [success, error, message, dispatch, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setPasswordError('');
    dispatch(platformResetPassword({ token, password }));
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
      <div
        className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-8 sm:px-6"
        style={shellStyle}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'radial-gradient(#65fcc9 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: '#1CCA9B' }}
          aria-hidden
        />

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

        <div
          className="relative z-10 flex w-full max-w-lg flex-col rounded-3xl p-6 shadow-xl sm:p-8"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm"
              style={{ backgroundColor: '#ECF0EE' }}
            >
              <FiLock className="h-7 w-7" style={{ color: '#2A6B52' }} aria-hidden />
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
              Reset Password
            </h1>
            <p className="mt-1 text-sm sm:text-[15px]" style={{ color: '#5A7A70' }}>
              Choose a new password for your operator account.
            </p>
          </div>

          {success && (
            <div
              className="mt-6 rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: 'rgba(42, 107, 82, 0.1)', color: '#0F2D26' }}
              role="status"
            >
              <strong className="font-bold">Success! </strong>
              <span>{message || 'Password reset successful. Redirecting to login…'}</span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-sm font-medium" style={{ color: '#C62828' }} role="alert">
              {error}
            </p>
          )}

          {!success ? (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4 sm:mt-8">
              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-semibold"
                  style={{ color: '#0F2D26' }}
                  htmlFor="platform-new-password"
                >
                  New password
                </label>
                <div className="relative flex items-center">
                  <FiLock
                    className="pointer-events-none absolute left-3 h-[18px] w-[18px]"
                    style={{ color: '#788882' }}
                    aria-hidden
                  />
                  <input
                    id="platform-new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[#788882] focus:ring-2 focus:ring-[#1CCA9B]/40"
                    style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 p-1"
                    style={{ color: '#788882' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className="text-sm font-semibold"
                  style={{ color: '#0F2D26' }}
                  htmlFor="platform-confirm-password"
                >
                  Confirm password
                </label>
                <div className="relative flex items-center">
                  <FiLock
                    className="pointer-events-none absolute left-3 h-[18px] w-[18px]"
                    style={{ color: '#788882' }}
                    aria-hidden
                  />
                  <input
                    id="platform-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-lg pl-10 pr-10 text-sm outline-none transition-colors placeholder:text-[#788882] focus:ring-2 focus:ring-[#1CCA9B]/40"
                    style={{ backgroundColor: '#ECF0EE', color: '#0F2D26' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 p-1"
                    style={{ color: '#788882' }}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordError && (
                  <p className="text-sm" style={{ color: '#C62828' }}>
                    {passwordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#1CCA9B] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: '#2A6B52' }}
              >
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  dispatch(clearPlatformPasswordReset());
                  navigate('/platform/login');
                }}
                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: '#2A6B52' }}
              >
                <FiArrowLeft className="h-4 w-4" aria-hidden />
                Back to Operator Login
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                dispatch(clearPlatformPasswordReset());
                navigate('/platform/login', { replace: true });
              }}
              className="mt-6 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#2A6B52' }}
            >
              Back to Operator Login
            </button>
          )}

          <div
            className="-mx-6 -mb-6 mt-6 flex items-center justify-center gap-2 rounded-b-3xl px-4 py-3 text-center sm:-mx-8 sm:-mb-8"
            style={{ backgroundColor: '#ECF0EE' }}
          >
            <FiLock className="h-3.5 w-3.5 shrink-0" style={{ color: '#788882' }} aria-hidden />
            <p className="text-xs leading-snug sm:text-[13px]" style={{ color: '#5A7A70' }}>
              After reset you will be signed out of any active platform session.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default PlatformResetPassword;
