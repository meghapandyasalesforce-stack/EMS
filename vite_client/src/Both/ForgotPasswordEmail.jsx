import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { requestPasswordReset, resetForgotPasswordState } from '../context/forgotPasswordSlice.js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const ForgotPasswordEmail = () => {
  const [email, setEmail] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, success, error, message, emailSent } = useSelector((state) => state.forgotPassword);

  useEffect(() => {
    dispatch(resetForgotPasswordState());
  }, [dispatch]);

  useEffect(() => {
    if (success) {
      if (emailSent) {
        toast.success(message || 'Password reset link sent. Check your inbox.');
      } else {
        toast.info(message || 'Request received. Check your inbox if an account exists for this email.');
      }
    }
    if (error) {
      toast.error(error);
    }
  }, [success, error, message, emailSent]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(requestPasswordReset(email.trim()));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Forgot Password?
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {success && (
          <div
            className={
              emailSent
                ? 'bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded relative'
                : 'bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded relative'
            }
            role="alert"
          >
            <strong className="font-bold">{emailSent ? 'Email sent — ' : 'Request received — '}</strong>
            <span className="block sm:inline">{message}</span>
            {!emailSent && (
              <p className="mt-2 text-sm opacity-90">
                Use the same email you use to log in. If you do not receive a message within a few minutes, contact your administrator.
              </p>
            )}
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary focus:z-10 sm:text-sm"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm text-theme-secondary hover:text-theme-secondary"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordEmail;
