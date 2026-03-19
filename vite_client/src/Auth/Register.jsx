import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '', // Only for client-side validation
        agreeToTerms: false,
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Client-side validation
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (!formData.agreeToTerms) {
            setError('You must agree to the terms and privacy policy');
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long');
            setLoading(false);
            return;
        }

        if (!formData.email.includes('@')) {
            setError('Please enter a valid email address');
            setLoading(false);
            return;
        }

        try {
            // Use configured axios instance instead of fetch with hardcoded URL
            const { default: axiosInstance } = await import('../utils/axios');
            const response = await axiosInstance.post('/v1/admin/auth/register', {
                name: formData.name,
                email: formData.email,
                password: formData.password
            });

            const data = response.data;
            
            if (!data || !data.message) {
                throw new Error(data?.message || 'Registration failed');
            }
            
            toast.success(data.message || "Registration successful!");
            setFormData({ name: '', email: '', password: '', confirmPassword: '' });
            setTimeout(() => {
                navigate('/login');
            }, 2000);

            // Registration successful
        } catch (error) {
            // Removed console.error for production
            setError(error.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="flex justify-center items-center min-h-screen bg-cover bg-center bg-fixed"
            style={{ backgroundImage: "url('../media/Untitled-2 (2).png')" }}
        >
            <form 
                className="w-full max-w-md p-8 bg-white rounded-lg shadow-md text-center"
                onSubmit={handleSubmit}
            >
                <h1 className="text-2xl font-bold mb-6 text-theme-primary" style={{ color: 'var(--color-primary)' }}>Welcome to Paarsiv</h1>
                {error && <p className="text-red-600 mb-4 p-2 bg-red-100 rounded">{error}</p>}

                <div className="mb-4">
                    <input
                        name="name"
                        placeholder="Full Name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:border-[var(--color-primary)] focus:outline-none"
                    />
                </div>

                <div className="mb-4">
                    <input
                        name="email"
                        placeholder="E-Mail Address"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:border-[var(--color-primary)] focus:outline-none"
                    />
                </div>

                <div className="mb-4">
                    <input
                        name="password"
                        placeholder="Password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:border-[var(--color-primary)] focus:outline-none"
                    />
                </div>

                <div className="mb-4">
                    <input
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        className="w-full p-3 border border-gray-300 rounded-md focus:border-[var(--color-primary)] focus:outline-none"
                    />
                </div>

                <div className="mb-6 text-left">
                    <label className="flex items-center">
                        <input
                            name="agreeToTerms"
                            type="checkbox"
                            checked={formData.agreeToTerms}
                            onChange={handleChange}
                            className="mr-2"
                            required
                        />
                        <span>I agree to all the Terms and Privacy Policy</span>
                    </label>
                </div>

                <button
                    className={`w-full p-3 rounded-md text-white font-medium transition-colors ${
                        loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-theme-primary hover:opacity-90'
                    }`}
                    style={!loading ? { backgroundColor: 'var(--color-primary)' } : undefined}
                    type="submit"
                    disabled={loading}
                >
                    {loading ? 'Registering...' : 'Create Account'}
                </button>

                <p className="mt-4 text-gray-600">
                    Already have an account?{' '}
                    <Link to="/login" className="font-medium hover:underline text-theme-primary" style={{ color: 'var(--color-primary)' }}>
                        Log In
                    </Link>
                </p>
            </form>
        </div>
    );
};

export default Register;