import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setLoading, setUser } from '../context/Auth/authSlice';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import PasswordResetPopup from '../Employee/PasswordResetPopup';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { ORGANIZATION_AUTH_ENDPOINT } from '../utils/constant';
import logger from '../utils/logger';

function Login() {
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState({ email: '', password: '' });
    const [showReset, setShowReset] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loginType, setLoginType] = useState(null); // 'organization', 'employee_admin', 'unknown'
    const [showLoginTypeSelector, setShowLoginTypeSelector] = useState(false);
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, user } = useSelector(state => state.auth);

    // Pre-fill email from URL params (when redirected from organization login)
    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setForm(prev => ({ ...prev, email: emailParam }));
        }
    }, [searchParams]);

    useEffect(() => {
        if (user) {
            // Navigate to /dashboard which will automatically determine the correct dashboard
            // based on Position and Department via RoleBasedDashboard component
            navigate('/dashboard');
        }
    }, [user, navigate]);

    // Debounced email domain check for smart login routing
    useEffect(() => {
        if (!form.email || !form.email.includes('@')) {
            setLoginType(null);
            setShowLoginTypeSelector(false);
            return;
        }

        const checkEmailDomain = async () => {
            try {
                setIsCheckingEmail(true);
                const response = await axios.get(`${ORGANIZATION_AUTH_ENDPOINT}/check-email`, {
                    params: { email: form.email }
                });

                if (response.data.success) {
                    const { loginType: detectedType } = response.data;
                    setLoginType(detectedType);

                    // Auto-show selector for unknown type
                    if (detectedType === 'unknown') {
                        // Don't auto-show, let user submit first
                        // setShowLoginTypeSelector(true);
                    }
                }
            } catch (error) {
                // If API fails, default to unknown (manual selection)
                setLoginType('unknown');
                // Don't auto-show selector on error
            } finally {
                setIsCheckingEmail(false);
            }
        };

        // Debounce: wait 500ms after user stops typing
        const timeoutId = setTimeout(checkEmailDomain, 500);
        return () => clearTimeout(timeoutId);
    }, [form.email]);

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async e => {
        e.preventDefault();

        if (!form.email || !form.email.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }

        // If login type is unknown, show manual selection
        if (loginType === 'unknown') {
            setShowLoginTypeSelector(true);
            return;
        }

        try {
            dispatch(setLoading(true));

            // Unified login: Try all login types in order based on detection
            // 1. Organization login (if detected as organization or null - before detection)
            // 2. Employee login (if detected as employee_admin or if org login failed)
            // 3. Admin login (if employee login failed)
            let response;
            let userData = null;
            let userRole = null;
            let isOrganizationLogin = false;
            
            // Try organization login first if:
            // - Detected as organization
            // - Type is null (before detection - try all types)
            // Skip if detected as employee_admin (more efficient - go straight to employee/admin)
            if (loginType === 'organization' || loginType === null) {
                try {
                    response = await axios.post(`${ORGANIZATION_AUTH_ENDPOINT}/login`, form, {
                        withCredentials: true
                    });
                    
                    if (response.status === 200 && response.data.success) {
                        userData = response.data.user;
                        userRole = response.data.user?.role || 'admin';
                        isOrganizationLogin = true;
                        
                        // Store organization info
                        if (response.data.organization?.id) {
                            localStorage.setItem('organizationId', response.data.organization.id);
                        }
                        localStorage.setItem('isOrganizationLogin', 'true');
                    }
                } catch (orgError) {
                    // Organization login failed, continue to try employee/admin
                    // Only log if it's not a 401 (which is expected if user is not org admin)
                    if (orgError.response?.status !== 401) {
                        logger.debug('Organization login failed, trying employee/admin', {
                            error: orgError.response?.data?.message
                        });
                    }
                }
            }
            
            // If organization login didn't succeed (or not organization type), try employee login
            if (!userData) {
                try {
                    response = await axios.post('/v1/employee/auth/login', form, {
                        withCredentials: true
                    });
                    
                    if (response.status === 200 && response.data.success) {
                        userData = response.data.employee;
                        userRole = 'employee';
                        localStorage.removeItem('isOrganizationLogin');
                    }
                } catch (employeeError) {
                    // If employee login fails with 401, try admin login
                    if (employeeError.response?.status === 401) {
                        try {
                            response = await axios.post('/v1/admin/auth/login', form, {
                                withCredentials: true
                            });
                            
                            if (response.status === 200 && response.data.success) {
                                userData = response.data.user;
                                userRole = 'admin';
                                localStorage.removeItem('isOrganizationLogin');
                            }
                        } catch (adminError) {
                            // All three logins failed
                            const errorMessage = adminError.response?.data?.message || 
                                               employeeError.response?.data?.message || 
                                               'Invalid credentials. Please check your email and password.';
                            
                            if (adminError.response?.status === 403 || employeeError.response?.status === 403) {
                                const lockoutMessage = adminError.response?.data?.message || employeeError.response?.data?.message;
                                toast.error(lockoutMessage || 'Account is locked or inactive. Please try again later.');
                            } else {
                                toast.error(errorMessage);
                            }
                            return;
                        }
                    } else {
                        // Network or server error
                        throw employeeError;
                    }
                }
            }

            // Handle successful login
            if (response && response.status === 200 && response.data.success && userData) {
                const data = response.data;
                
                // Store user data in Redux
                if (isOrganizationLogin) {
                    // Organization login - store organization context
                    dispatch(setUser({
                        id: userData.id || userData._id,
                        name: userData.name,
                        email: userData.email,
                        role: userRole,
                        organizationId: data.organization?.id
                    }));
                } else {
                    // Employee/Admin login
                    dispatch(setUser(userData));
                }
                
                // SECURITY FIX: Tokens are stored in httpOnly cookies only (not localStorage)
                // Cookies are set by the server automatically via generateToken()
                // Only store UI-related data in localStorage (non-sensitive)
                localStorage.setItem('role', userRole);
                localStorage.setItem('email', form.email);
                if (isOrganizationLogin && data.organization?.id) {
                    localStorage.setItem('organizationId', data.organization.id);
                }

                // If employee must reset password, show popup and pause navigation
                if (userRole === 'employee' && userData?.mustResetPassword) {
                    toast.info('Please reset your password to continue.');
                    setShowReset(true);
                    return;
                }

                toast.success('Login successful!');
                
                // Use dashboardRoute from login response (automatic redirection)
                const dashboardRoute = data.dashboardRoute || (isOrganizationLogin ? '/organization/dashboard' : '/dashboard');
                
                // Redirect to the dashboard route provided by backend
                setTimeout(() => {
                    navigate(dashboardRoute, { replace: true });
                }, 500);
            } else {
                toast.error(response?.data?.message || 'Login failed. Please try again.');
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

    const handleLoginTypeSelection = (selectedType) => {
        setShowLoginTypeSelector(false);
        // Set login type and retry login
        setLoginType(selectedType);
        // Continue with login - create a synthetic event
        const syntheticEvent = { preventDefault: () => {} };
        handleSubmit(syntheticEvent);
    };

    return (
        <>
        <div className="flex justify-center items-center min-h-screen bg-cover bg-center bg-fixed"
             style={{ backgroundImage: "url('../media/Untitled-2 (2).png')" }}>
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm text-center">
                <h1 className="text-2xl font-bold text-green-500 mb-2">Login</h1>
                <p className="text-green-500 mb-5">Login to your account.</p>

                {/* Show login type indicator */}
                {loginType === 'organization' && (
                    <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                        <p>Organization email detected. Will try Organization Login first.</p>
                    </div>
                )}
                {loginType === 'employee_admin' && (
                    <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                        <p>Organization domain detected. Will try Employee/Admin Login.</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            name="email"
                            placeholder="E-mail Address"
                            type="email"
                            onChange={handleChange}
                            value={form.email}
                            required
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        {isCheckingEmail && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                            </div>
                        )}
                    </div>
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
                        disabled={loading || isCheckingEmail}
                        className={`w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors ${loading || isCheckingEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Signing In...' : isCheckingEmail ? 'Checking...' : 'Sign In'}
                    </button>
                </form>

                <div className="flex flex-col space-y-2 mt-5">
                    <div className="flex justify-between items-center">
                        <Link to="/forgot-password" className='text-sm text-blue-500 hover:text-blue-700 hover:underline'>
                            Forgot Password?
                        </Link>
                    </div>
                    <div className="text-center">
                        <Link to="/organization/register" className='text-sm text-blue-500 hover:text-blue-700 hover:underline'>
                            Register Your Organization
                        </Link>
                    </div>
                </div>
            </div>
        </div>

        {/* Login Type Selector Modal */}
        {showLoginTypeSelector && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                    <h2 className="text-xl font-bold mb-4">Select Login Type</h2>
                    <p className="mb-4 text-gray-600">
                        We couldn't automatically determine your login type. Please select:
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => handleLoginTypeSelection('organization')}
                            className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                            Organization Login
                        </button>
                        <button
                            onClick={() => handleLoginTypeSelection('employee_admin')}
                            className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                        >
                            Employee/Admin Login
                        </button>
                        <button
                            onClick={() => setShowLoginTypeSelector(false)}
                            className="w-full py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

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
