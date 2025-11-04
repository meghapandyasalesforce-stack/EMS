import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setLoading, setUser } from '../context/Auth/authSlice';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import PasswordResetPopup from '../Employee/PasswordResetPopup';

function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showReset, setShowReset] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { loading, user } = useSelector(state => state.auth);

    useEffect(() => {
        console.log('useEffect triggered - user:', user);
        if (user) {
            const role = localStorage.getItem('role');
            console.log('User exists, role:', role);
            const redirectPath = role === 'admin' ? '/dashboard-admin' : '/dashboard-employee';
            console.log('useEffect navigating to:', redirectPath);
            navigate(redirectPath);
        }
    }, [user, navigate]);

    const handleChange = e => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async e => {
        e.preventDefault();

        const emailDomain = form.email.split('@')[1];

        if (!form.email.includes('@') || !emailDomain) {
            toast.error('Please enter a valid email address');
            return;
        }

        let apiEndpoint = '';
        let userRole = '';

        if (emailDomain === 'gmail.com') {
            apiEndpoint = '/v1/admin/auth/login';
            userRole = 'admin';
        } else if (emailDomain === 'paarsiv.com') {
            apiEndpoint = '/v1/employee/auth/login';
            userRole = 'employee';
        } else {
            toast.error('Only @gmail.com and @paarsiv.com domains are allowed.');
            return;
        }

        try {
            dispatch(setLoading(true));

            const response = await axios.post(apiEndpoint, form, {
                withCredentials: true
            });

            const data = response.data;
            console.log('Login response:', { status: response.status, data, userRole });

            if (response.status === 401) {
                toast.error(data.message || 'Invalid credentials.');
                return;
            }

            // Check for successful login - either success property or status 200 with user data
            if (response.status === 200 && (data.success === true || data.employee || data.admin || data.user)) {
                const userData = data.employee || data.admin || data.user;
                console.log('User data:', userData);
                
                dispatch(setUser(userData));
                // Token is stored in httpOnly cookie, no need for localStorage (XSS risk)
                // Only storing UI-related data
                localStorage.setItem('role', userRole);
                localStorage.setItem('email', form.email);

                // If employee must reset password, show popup and pause navigation
                if (userRole === 'employee' && userData?.mustResetPassword) {
                    toast.info('Please reset your password to continue.');
                    setShowReset(true);
                    return;
                }

                toast.success('Login successful!');
                const redirectPath = userRole === 'admin' ? '/dashboard-admin' : '/dashboard-employee';
                setTimeout(() => { window.location.href = redirectPath; }, 500);
            } else {
                console.log('Login failed:', { status: response.status, success: data.success, message: data.message });
                toast.error(data.message || 'Login failed');
            }
        } catch (err) {
            console.error('Login failed:', err);
            
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
                    <input
                        name="password"
                        placeholder="Password"
                        type="password"
                        onChange={handleChange}
                        value={form.password}
                        required
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                    />

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
                onClose={() => setShowReset(false)} 
                onSuccess={async (newPassword) => {
                    // Attempt to logout the existing session; ignore failures
                    try {
                        await axios.get('/v1/employee/auth/logout', { withCredentials: true });
                    } catch {
                        // Ignore logout errors
                    }

                    // Attempt to login with the new password; if it fails, inform and close popup
                    try {
                        await axios.post(
                            '/v1/employee/auth/login',
                            { email: form.email, password: newPassword },
                            { withCredentials: true }
                        );
                        toast.success('Password updated and logged in.');
                        window.location.href = '/dashboard-employee';
                    } catch {
                        toast.info('Password updated. Please login with your new password.');
                        setShowReset(false);
                    }
                }}
            />
        )}
        </>
    );
}

export default Login;
