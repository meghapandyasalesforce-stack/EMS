import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * OrganizationLogin - Redirects to unified login page
 * This component is kept for backward compatibility
 * All login types are now handled in the main Login component
 */
const OrganizationLogin = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Redirect to main login page with email pre-filled if provided
    useEffect(() => {
        const emailParam = searchParams.get('email');
        if (emailParam) {
            navigate(`/login?email=${encodeURIComponent(emailParam)}`, { replace: true });
        } else {
            navigate('/login', { replace: true });
        }
    }, [searchParams, navigate]);

    // Show loading while redirecting
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Redirecting to login...</p>
            </div>
        </div>
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.email || !formData.email.includes('@')) {
            toast.error('Please enter a valid email address');
            return;
        }
        if (!formData.password) {
            toast.error('Password is required');
            return;
        }

        try {
            setIsSubmitting(true);
            dispatch(setLoading(true));

            const response = await axios.post(`${ORGANIZATION_AUTH_ENDPOINT}/login`, {
                email: formData.email.toLowerCase().trim(),
                password: formData.password
            }, {
                withCredentials: true
            });

            if (response.data.success) {
                // SECURITY FIX: Tokens are stored in httpOnly cookies only (not localStorage)
                // Cookies are set by the server automatically via generateToken()
                // Only store non-sensitive UI-related data in localStorage
                if (response.data.organization?.id) {
                    localStorage.setItem('organizationId', response.data.organization.id);
                }
                
                // Store user info (non-sensitive)
                localStorage.setItem('role', response.data.user?.role || 'admin');
                localStorage.setItem('userId', response.data.user?.id);
                
                // Update Redux store
                dispatch(setUser({
                    id: response.data.user?.id,
                    name: response.data.user?.name,
                    email: response.data.user?.email,
                    role: response.data.user?.role || 'admin',
                    organizationId: response.data.organization?.id
                }));

                toast.success('Login successful!');
                
                // Store flag to indicate this is an organization login
                localStorage.setItem('isOrganizationLogin', 'true');
                
                // Use dashboardRoute from login response (automatic redirection)
                const dashboardRoute = response.data.dashboardRoute || '/organization/dashboard';
                
                // Redirect to the dashboard route provided by backend
                setTimeout(() => {
                    navigate(dashboardRoute, { replace: true });
                }, 500);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Login failed';
            toast.error(errorMessage);
            logger.error('Login error', { error: error.message, response: error.response?.data });
        } finally {
            setIsSubmitting(false);
            dispatch(setLoading(false));
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <FaBuilding className="h-12 w-12 text-blue-600" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        Organization Login
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Sign in to your organization account
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiMail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="your-email@example.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <FiLock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    required
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                    ) : (
                                        <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-sm">
                            <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500">
                                Forgot password?
                            </Link>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-sm text-gray-600">
                            Don't have an organization account?{' '}
                            <Link to="/organization/register" className="font-medium text-blue-600 hover:text-blue-500">
                                Register your organization
                            </Link>
                        </p>
                        <p className="text-sm text-gray-600">
                            Regular user?{' '}
                            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                                Employee/Admin Login
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OrganizationLogin;

