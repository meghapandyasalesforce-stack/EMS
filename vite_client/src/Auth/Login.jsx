import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setLoading, setUser, setAuthPermissions, checkAuthSession, initializePortals } from '../context/Auth/authSlice';
import { setEmployeeProfile, clearEmployeeDetails } from '../context/employeeDetailsSlice';
import { setTimezoneContext } from '../context/timezoneSlice';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import PasswordResetPopup from '../Employee/PasswordResetPopup';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { ORGANIZATION_AUTH_ENDPOINT, UNIFIED_AUTH_ENDPOINT } from '../utils/constant';
import { syncPortalsForSession, canSwitchPortals } from '../utils/portalConfig';
import { resolveLoginSessionRole } from '../utils/authSessionUtils';
import { saveOrgAdminCredentials } from '../utils/orgAdminCredentials';
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
    const { loading, user, authChecked } = useSelector(state => state.auth);

    // Pre-fill email from URL params (when redirected from organization login)
    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            setForm(prev => ({ ...prev, email: emailParam }));
        }
    }, [searchParams]);

    useEffect(() => {
        if (authChecked && user) {
            // Navigate to /dashboard which will automatically determine the correct dashboard
            // based on Position and Department via RoleBasedDashboard component
            navigate('/dashboard');
        }
    }, [authChecked, user, navigate]);

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

        try {
            dispatch(setLoading(true));

            const response = await axios.post(`${UNIFIED_AUTH_ENDPOINT}/login`, form, {
                withCredentials: true,
            });

            const data = response?.data;
            if (!response || response.status !== 200 || !data?.success) {
                toast.error(data?.message || 'Login failed. Please try again.');
                return;
            }

            const sessionRole = data.sessionRole || data.user?.role || 'employee';
            const permissionFlags = data.permissionFlags || {};
            const userRole = resolveLoginSessionRole(
                sessionRole,
                permissionFlags,
                !!data.employee
            );
            const isOrganizationLogin = !!data.isOrganizationLogin;

            const orgId =
                data.organization?.id ||
                data.employee?.organizationId ||
                data.user?.organizationId;
            if (orgId) {
                localStorage.setItem('organizationId', String(orgId));
            }
            if (isOrganizationLogin) {
                localStorage.setItem('isOrganizationLogin', 'true');
            } else {
                localStorage.removeItem('isOrganizationLogin');
            }

            if (data.employee && userRole === 'employee') {
                const e = data.employee;
                dispatch(setUser({
                    ...e,
                    _id: e._id ?? e.id,
                    role: 'employee',
                    organizationId: e.organizationId ?? orgId,
                    name: e.name,
                    lastName: e.lastName,
                    jobTitle: e.jobTitle,
                    department: e.department,
                    position: e.position,
                }));
            } else if (data.user) {
                const u = data.user;
                const emp = data.employee;
                dispatch(setUser({
                    ...u,
                    _id: u._id ?? u.id,
                    role: userRole,
                    name: emp?.name || u.name,
                    lastName: emp?.lastName || u.lastName,
                    jobTitle: emp?.jobTitle || u.jobTitle,
                    department: emp?.department || u.department,
                    position: emp?.position || u.position,
                    organizationId: u.organizationId ?? emp?.organizationId ?? orgId,
                    employeeProfileId: u.employeeProfileId ?? emp?._id ?? emp?.id,
                    platformRoles: data.platformRoles || u.roles || [],
                }));
            }

            if (data.employee) {
                dispatch(setEmployeeProfile(data.employee));
                if (data.employee.id || data.employee._id) {
                    localStorage.setItem(
                        'employeeProfileId',
                        String(data.employee.id || data.employee._id)
                    );
                }
            } else {
                dispatch(clearEmployeeDetails());
                localStorage.removeItem('employeeProfileId');
            }

            if (data.timezoneContext) {
                dispatch(setTimezoneContext(data.timezoneContext));
            } else if (data.timezone) {
                dispatch(setTimezoneContext({ timezone: data.timezone }));
            }

            if (data.permissions) {
                dispatch(setAuthPermissions({
                    permissions: data.permissions,
                    roleBuckets: data.roleBuckets,
                    permissionFlags,
                    dataScope: data.dataScope,
                }));
            }

            if (data.csrfToken) {
                localStorage.setItem('csrfToken', data.csrfToken);
            }
            if (data.employeeDashboardRoute) {
                localStorage.setItem('employeeDashboardRoute', data.employeeDashboardRoute);
            }

            const loginUser = data.user
                ? {
                    ...data.user,
                    _id: data.user._id ?? data.user.id,
                    role: userRole,
                    position: data.employee?.position || data.user.position,
                }
                : data.employee
                    ? { ...data.employee, role: 'employee' }
                    : null;

            const dashboardRoute =
                data.dashboardRoute ||
                (isOrganizationLogin ? '/organization/dashboard' : '/dashboard');

            const { portals, activePortal } = syncPortalsForSession({
                user: loginUser,
                employee: data.employee || null,
                roleBuckets: data.roleBuckets || [],
                permissionFlags,
                routeHint: dashboardRoute,
            });
            dispatch(initializePortals({ portals, activePortal }));
            localStorage.setItem('availablePortals', JSON.stringify(portals.map((p) => p.id)));

            localStorage.setItem('role', userRole);
            localStorage.setItem('email', form.email);

            if (!canSwitchPortals(loginUser, permissionFlags, data.roleBuckets || [])) {
                localStorage.removeItem('activePortal');
            }

            if (userRole === 'admin' || isOrganizationLogin) {
                saveOrgAdminCredentials(form.email, form.password);
            }

            const mustReset =
                data.employee?.mustResetPassword &&
                userRole === 'employee' &&
                !data.user;
            if (mustReset) {
                toast.info('Please reset your password to continue.');
                setShowReset(true);
                return;
            }

            toast.success('Login successful!');
            const homeRoute =
                portals.find((p) => p.id === activePortal)?.home || dashboardRoute;

            // Hydrate full profile (name, jobTitle, etc.) before dashboard renders
            try {
                const session = await dispatch(checkAuthSession()).unwrap();
                if (session?.timezoneContext) {
                    dispatch(setTimezoneContext(session.timezoneContext));
                } else if (session?.timezone) {
                    dispatch(setTimezoneContext({ timezone: session.timezone }));
                }
            } catch {
                // Login cookies are set; proceed with partial profile from login response
            }

            navigate(homeRoute, { replace: true });
        } catch (err) {
            
            // Handle different types of errors
            if (err.code === 'ERR_NETWORK') {
                toast.error('Network error: Please check if the server is running');
            } else if (err.response?.status === 401) {
                toast.error('Invalid credentials. Please check your email and password.');
            } else if (err.response?.status === 403) {
                const serverMessage = err.response?.data?.message;
                toast.error(
                    serverMessage ||
                        'Access denied. If your account should be active, try clearing site cookies and signing in again.'
                );
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
                <h1 className="text-2xl font-bold mb-2 text-theme-primary" style={{ color: 'var(--color-primary)' }}>Login</h1>
                <p className="mb-5 text-theme-primary opacity-90" style={{ color: 'var(--color-primary)' }}>Login to your account.</p>

                {/* Show login type indicator */}
                {loginType === 'organization' && (
                    <div className="mb-4 p-2 rounded text-sm border border-theme-secondary bg-theme-secondary/10 text-theme-secondary" style={{ borderColor: 'var(--color-secondary)', backgroundColor: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', color: 'var(--color-secondary)' }}>
                        <p>Organization email detected. Will try Organization Login first.</p>
                    </div>
                )}
                {loginType === 'employee_admin' && (
                    <div className="mb-4 p-2 rounded text-sm border border-theme-primary bg-theme-primary/10 text-theme-primary" style={{ borderColor: 'var(--color-primary)', backgroundColor: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', color: 'var(--color-primary)' }}>
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
                            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                        {isCheckingEmail && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-theme-primary" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
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
                        className={`w-full py-2 text-white rounded-md transition-colors bg-theme-primary hover:opacity-90 ${loading || isCheckingEmail ? 'opacity-70 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                        {loading ? 'Signing In...' : isCheckingEmail ? 'Checking...' : 'Sign In'}
                    </button>
                </form>

                <div className="flex flex-col space-y-2 mt-5">
                    <div className="flex justify-between items-center">
                        <Link to="/forgot-password" className="text-sm hover:underline text-theme-secondary" style={{ color: 'var(--color-secondary)' }}>
                            Forgot Password?
                        </Link>
                    </div>
                    <div className="text-center">
                        <Link to="/organization/register" className="text-sm hover:underline text-theme-secondary" style={{ color: 'var(--color-secondary)' }}>
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
                            className="w-full py-2 text-white rounded-md transition-colors bg-theme-secondary hover:opacity-90"
                            style={{ backgroundColor: 'var(--color-secondary)' }}
                        >
                            Organization Login
                        </button>
                        <button
                            onClick={() => handleLoginTypeSelection('employee_admin')}
                            className="w-full py-2 text-white rounded-md transition-colors bg-theme-primary hover:opacity-90"
                            style={{ backgroundColor: 'var(--color-primary)' }}
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
