import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setLoading, setUser } from '../context/Auth/authSlice';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import PasswordResetPopup from '../Employee/PasswordResetPopup';
import { FiEye, FiEyeOff } from 'react-icons/fi';

function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showReset, setShowReset] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, user } = useSelector(state => state.auth);

    useEffect(() => {
        if (user) {
            const role = localStorage.getItem('role');
            const redirectPath = role === 'admin' ? '/dashboard-admin' : '/dashboard-employee';
            navigate(redirectPath);
        }
    }, [user, navigate]);

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async e => {
        e.preventDefault();

        if (!form.email || !form.email.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        try {
            dispatch(setLoading(true));

            // Try admin login first, then employee login if admin fails
            let response;
            let apiEndpoint = '/v1/admin/auth/login';
            let userRole = 'admin';
            
            try {
                response = await axios.post(apiEndpoint, form, {
                    withCredentials: true
                });
            } catch (adminError) {
                // If admin login fails with 401, try employee login
                if (adminError.response?.status === 401) {
                    apiEndpoint = '/v1/employee/auth/login';
                    userRole = 'employee';
                    response = await axios.post(apiEndpoint, form, {
                        withCredentials: true
                    });
                } else {
                    throw adminError;
                }
            }

            const data = response.data;

            if (response.status === 401) {
                toast.error(data.message || 'Invalid credentials.');
                return;
            }

            // Check for successful login - either success property or status 200 with user data
            if (response.status === 200 && (data.success === true || data.employee || data.admin || data.user)) {
                const userData = data.employee || data.admin || data.user;
                
                // Get role from response data (most reliable) or fallback to userRole
                const actualRole = data.user?.role || data.employee?.role || data.admin?.role || userRole;
                
                dispatch(setUser(userData));
                // Store token in localStorage for Authorization header (backup to cookie)
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                // Store CSRF token in localStorage for cross-site scenarios
                if (data.csrfToken) {
                    localStorage.setItem('csrfToken', data.csrfToken);
                }
                // Store UI-related data - use actual role from response
                localStorage.setItem('role', actualRole);
                localStorage.setItem('email', form.email);

                // If employee must reset password, show popup and pause navigation
                if (actualRole === 'employee' && userData?.mustResetPassword) {
                    toast.info('Please reset your password to continue.');
                    setShowReset(true);
                    return;
                }

                toast.success('Login successful!');
                const redirectPath = actualRole === 'admin' ? '/dashboard-admin' : '/dashboard-employee';
                setTimeout(() => { window.location.href = redirectPath; }, 500);
            } else {
                toast.error(data.message || 'Login failed');
            }
        } catch (err) {
            
            // Handle different types of errors
            if (err.code === 'ERR_NETWORK') {
                toast.error('Network error: Please check if the server is running');
            } else if (err.response?.status === 401) {
                toast.error('Invalid credentials. Please check your email and password.');
            } else if (err.response?.status === 403) {
                toast.error('Account inactive. Please contact HR or Admin.');
            } else if (err.response?.status >= 500) {
                toast.error('Server error. Please try again later.');
            } else {
                toast.error(err.message || 'Login failed. Please try again.');
            }
        } finally {
            dispatch(setLoading(false));
        }
    };

    return (
        <>
        <div className="flex justify-center items-center min-h-screen bg-cover bg-center bg-fixed"
             style={{ backgroundImage: "url('../media/Untitled-2 (2).png')" }}>
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
                <h1 className="text-2xl font-bold text-green-500 mb-2">Login</h1>
                <p className="text-green-500 mb-5">Login to your account.</p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        name="email"
                        placeholder="E-mail Address"
                        type="email"
                        onChange={handleChange}
                        value={form.email}
                        required
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                    <div className="relative">
                        <input
                            name="password"
                            placeholder="Password"
                            type={showPassword ? "text" : "password"}
                            onChange={handleChange}
                            value={form.password}
                            required
                            className="w-full p-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? (
                                <FiEyeOff className="w-5 h-5" />
                            ) : (
                                <FiEye className="w-5 h-5" />
                            )}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-5 text-sm">
                    Don't have an account?{' '}
                    <a href="/register" className="text-blue-500 hover:text-blue-700 hover:underline">
                        Create New
                    </a>
                </p>
                <Link to="/forgot-password" className='text-right text-sm text-blue-500 hover:text-blue-700 hover:underline'>
  Forgot Password?
</Link>
            </div>
        </div>
        {showReset && (
            <PasswordResetPopup 
                onClose={() => {
                    // Clear form and redirect to login
                    setForm({ email: '', password: '' });
                    setShowReset(false);
                    toast.info('Password reset cancelled. Please login with your current password.');
                }} 
                onSuccess={(newPassword) => {
                    // Password reset successful - user is logged out
                    // The PasswordResetPopup component will handle the redirect
                    setShowReset(false);
                    setForm({ email: '', password: '' });
                    // Clear Redux state
                    dispatch(setUser(null));
                    // PasswordResetPopup will redirect, so we don't need to do it here
                }}
            />
        )}
        </>
    );
}

export default Login;
