import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { resetPassword, resetForgotPasswordState } from '../context/forgotPasswordSlice.js';
import { setUser } from '../context/Auth/authSlice.js';
import { persistor } from '../context/store.js';
import { toast } from 'react-toastify';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useParams();
  const { loading, success, error, message } = useSelector((state) => state.forgotPassword);

  useEffect(() => {
    // Reset state when component mounts
    dispatch(resetForgotPasswordState());
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      toast.success(message || 'Password reset successful!');
      
      // Clear Redux state first
      dispatch(setUser(null));
      
      // Clear local storage
      // SECURITY FIX: Tokens are in httpOnly cookies, cleared by server on logout
      // No need to remove from localStorage (tokens aren't stored there)
      localStorage.removeItem('csrfToken');
      localStorage.removeItem('role');
      localStorage.removeItem('email');
      
      // Purge Redux Persist store
        persistor.purge().catch(() => {
          // Silently handle purge error
        });
      
      // Clear cookies by calling logout (if logged in)
      const logoutUser = async () => {
        try {
          const { default: axiosInstance } = await import('../utils/axios');
          // Try both admin and employee logout endpoints
          try {
            await axiosInstance.post('/v1/admin/auth/logout', {}, { withCredentials: true });
          } catch {
            await axiosInstance.post('/v1/employee/auth/logout', {}, { withCredentials: true });
          }
        } catch (err) {
          // Ignore errors - cookies will be cleared by backend anyway
        }
      };
      logoutUser();
      
      // Reset forgot password state
      dispatch(resetForgotPasswordState());
      
      // Redirect to login after a delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
    if (error) {
      toast.error(error);
    }
  }, [success, error, message, dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    
    // Validate password strength (add more rules as needed)
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    
    setPasswordError('');
    dispatch(resetPassword({ token, password }));
  };

  const handleBackToLogin = () => {
    dispatch(resetForgotPasswordState());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Please enter your new password below
          </p>
        </div>

        {success && (
          <div className="bg-theme-primary/10 border border-theme-primary text-theme-primary px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Success! </strong>
            <span className="block sm:inline">{message || 'Password reset successful!'}</span>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {!success ? (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-600">{passwordError}</p>
              )}
            </div>
            
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8">
            <button
              onClick={handleBackToLogin}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
