import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ORGANIZATION_ENDPOINT, ORGANIZATION_DASHBOARD_ENDPOINT, ORGANIZATION_AUTH_ENDPOINT } from '../../utils/constant';
import logger from '../../utils/logger';
import { 
    FiCheckCircle, FiUpload, FiMail, FiSettings, FiUsers, 
    FiArrowRight, FiX, FiImage, FiGlobe, FiClock, FiDollarSign
} from 'react-icons/fi';
import { FaBuilding, FaCheck } from 'react-icons/fa';

const OrganizationOnboarding = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user } = useSelector((state) => state.auth || {});
    const [currentStep, setCurrentStep] = useState(0);
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    const [formData, setFormData] = useState({
        logo: null,
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
        language: 'en',
        workingDays: [1, 2, 3, 4, 5],
        workingHours: {
            start: '09:00',
            end: '17:00'
        }
    });

    const steps = [
        {
            id: 'welcome',
            title: 'Welcome!',
            description: 'Let\'s get your organization set up',
            icon: <FaBuilding className="w-8 h-8" />
        },
        {
            id: 'email',
            title: 'Verify Email',
            description: 'Verify your email address',
            icon: <FiMail className="w-8 h-8" />
        },
        {
            id: 'profile',
            title: 'Complete Profile',
            description: 'Add your organization details',
            icon: <FiSettings className="w-8 h-8" />
        },
        {
            id: 'logo',
            title: 'Upload Logo',
            description: 'Add your organization logo',
            icon: <FiImage className="w-8 h-8" />
        },
        {
            id: 'settings',
            title: 'Configure Settings',
            description: 'Set up timezone, currency, and preferences',
            icon: <FiGlobe className="w-8 h-8" />
        },
        {
            id: 'complete',
            title: 'Complete!',
            description: 'You\'re all set!',
            icon: <FiCheckCircle className="w-8 h-8" />
        }
    ];

    useEffect(() => {
        fetchOrganization();
    }, []);

    const fetchOrganization = async () => {
        try {
            const response = await axios.get(`${ORGANIZATION_ENDPOINT}/details`);
            if (response.data.success) {
                setOrganization(response.data.organization);
                if (response.data.organization.logo?.url) {
                    setFormData(prev => ({ ...prev, logo: response.data.organization.logo.url }));
                }
            }
        } catch (error) {
            logger.error('Failed to fetch organization', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size must be less than 5MB');
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('logo', file);
            formData.append('type', 'organization-logo');

            const response = await axios.post(`${ORGANIZATION_ENDPOINT}/logo`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.success) {
                setFormData(prev => ({ ...prev, logo: response.data.logo.url }));
                toast.success('Logo uploaded successfully');
            }
        } catch (error) {
            toast.error('Failed to upload logo');
            logger.error('Logo upload error', { error: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleSaveSettings = async () => {
        try {
            setLoading(true);
            const response = await axios.put(`${ORGANIZATION_ENDPOINT}/settings`, formData);
            if (response.data.success) {
                toast.success('Settings saved successfully');
                setCurrentStep(currentStep + 1);
            }
        } catch (error) {
            toast.error('Failed to save settings');
            logger.error('Settings save error', { error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        try {
            const response = await axios.post(`${ORGANIZATION_AUTH_ENDPOINT}/resend-verification`);
            if (response.data.success) {
                toast.success('Verification email sent! Please check your inbox.');
            }
        } catch (error) {
            toast.error('Failed to send verification email');
        }
    };

    const handleSkip = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            navigate('/dashboard-admin');
        }
    };

    const handleComplete = () => {
        navigate('/dashboard-admin');
    };

    if (loading && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const renderStepContent = () => {
        switch (steps[currentStep].id) {
            case 'welcome':
                return (
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
                            <FaBuilding className="w-12 h-12 text-blue-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">
                            Welcome to {organization?.name || 'Your Organization'}!
                        </h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            We're excited to have you on board. Let's complete a few quick steps to get your organization fully set up.
                        </p>
                        <div className="space-y-4 mt-8">
                            <div className="flex items-center justify-center space-x-2 text-gray-600">
                                <FiCheckCircle className="w-5 h-5 text-green-500" />
                                <span>Organization created</span>
                            </div>
                            <div className="flex items-center justify-center space-x-2 text-gray-600">
                                <FiCheckCircle className="w-5 h-5 text-green-500" />
                                <span>Admin account ready</span>
                            </div>
                        </div>
                    </div>
                );

            case 'email':
                return (
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center">
                            <FiMail className="w-12 h-12 text-yellow-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Verify Your Email</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            We've sent a verification email to <strong>{organization?.email}</strong>. 
                            Please check your inbox and click the verification link.
                        </p>
                        {organization?.emailVerified ? (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-center space-x-2 text-green-700">
                                    <FiCheckCircle className="w-5 h-5" />
                                    <span>Email verified successfully!</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <button
                                    onClick={handleResendVerification}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Resend Verification Email
                                </button>
                                <p className="text-sm text-gray-500">
                                    Didn't receive the email? Check your spam folder or click resend.
                                </p>
                            </div>
                        )}
                    </div>
                );

            case 'profile':
                return (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <h3 className="text-2xl font-bold text-gray-900 text-center">Complete Your Profile</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Organization Description
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    rows="4"
                                    placeholder="Tell us about your organization..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Website
                                    </label>
                                    <input
                                        type="url"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Industry
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder={organization?.industry || 'IT'}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'logo':
                return (
                    <div className="text-center space-y-6">
                        <h3 className="text-2xl font-bold text-gray-900">Upload Your Logo</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            Add your organization logo to personalize your account. This will appear in emails and reports.
                        </p>
                        <div className="flex flex-col items-center space-y-4">
                            {formData.logo ? (
                                <div className="relative">
                                    <img 
                                        src={formData.logo} 
                                        alt="Organization Logo" 
                                        className="w-48 h-48 object-contain border-2 border-gray-200 rounded-lg"
                                    />
                                    <button
                                        onClick={() => setFormData(prev => ({ ...prev, logo: null }))}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                    >
                                        <FiX className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-48 h-48 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                                    <div className="text-center">
                                        <FiUpload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">No logo uploaded</p>
                                    </div>
                                </div>
                            )}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                                <span className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-block">
                                    {uploading ? 'Uploading...' : formData.logo ? 'Change Logo' : 'Upload Logo'}
                                </span>
                            </label>
                            <p className="text-xs text-gray-500">Recommended: 200x200px, PNG or JPG, max 5MB</p>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6 max-w-2xl mx-auto">
                        <h3 className="text-2xl font-bold text-gray-900 text-center">Configure Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                    <FiGlobe className="mr-2" />
                                    Timezone
                                </label>
                                <select
                                    value={formData.timezone}
                                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="UTC">UTC</option>
                                    <option value="America/New_York">Eastern Time (ET)</option>
                                    <option value="America/Chicago">Central Time (CT)</option>
                                    <option value="America/Denver">Mountain Time (MT)</option>
                                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                    <option value="Europe/London">London (GMT)</option>
                                    <option value="Europe/Paris">Paris (CET)</option>
                                    <option value="Asia/Dubai">Dubai (GST)</option>
                                    <option value="Asia/Kolkata">Mumbai (IST)</option>
                                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                    <FiDollarSign className="mr-2" />
                                    Currency
                                </label>
                                <select
                                    value={formData.currency}
                                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="USD">USD ($)</option>
                                    <option value="EUR">EUR (€)</option>
                                    <option value="GBP">GBP (£)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="JPY">JPY (¥)</option>
                                    <option value="AED">AED (د.إ)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Date Format
                                </label>
                                <select
                                    value={formData.dateFormat}
                                    onChange={(e) => setFormData(prev => ({ ...prev, dateFormat: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                                    <FiClock className="mr-2" />
                                    Working Hours
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="time"
                                        value={formData.workingHours.start}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            workingHours: { ...prev.workingHours, start: e.target.value }
                                        }))}
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <input
                                        type="time"
                                        value={formData.workingHours.end}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            workingHours: { ...prev.workingHours, end: e.target.value }
                                        }))}
                                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleSaveSettings}
                            disabled={loading}
                            className="w-full px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                );

            case 'complete':
                return (
                    <div className="text-center space-y-6">
                        <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                            <FiCheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">You're All Set!</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                            Your organization is now fully configured. You can start managing your employees and projects.
                        </p>
                        <div className="space-y-4 mt-8">
                            <button
                                onClick={handleComplete}
                                className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                            >
                                Go to Dashboard
                            </button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            {steps.map((step, index) => (
                                <div key={step.id} className="flex items-center flex-1">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                                        index <= currentStep
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'border-gray-300 text-gray-400'
                                    }`}>
                                        {index < currentStep ? (
                                            <FaCheck className="w-5 h-5" />
                                        ) : (
                                            <span>{index + 1}</span>
                                        )}
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className={`flex-1 h-1 mx-2 ${
                                            index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                                        }`} />
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="text-center mt-4">
                            <h2 className="text-lg font-semibold text-gray-900">{steps[currentStep].title}</h2>
                            <p className="text-sm text-gray-600">{steps[currentStep].description}</p>
                        </div>
                    </div>

                    {/* Step Content */}
                    <div className="min-h-[400px] flex items-center justify-center">
                        {renderStepContent()}
                    </div>

                    {/* Navigation */}
                    <div className="flex justify-between mt-8 pt-6 border-t">
                        <button
                            onClick={handleSkip}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                        >
                            Skip for now
                        </button>
                        <div className="space-x-4">
                            {currentStep > 0 && (
                                <button
                                    onClick={() => setCurrentStep(currentStep - 1)}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                                >
                                    Previous
                                </button>
                            )}
                            {currentStep < steps.length - 1 && (
                                <button
                                    onClick={() => setCurrentStep(currentStep + 1)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    Next
                                    <FiArrowRight className="inline ml-2" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationOnboarding;

