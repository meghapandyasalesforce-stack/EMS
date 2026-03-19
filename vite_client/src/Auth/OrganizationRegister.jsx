import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUser, setLoading } from '../context/Auth/authSlice';
import { toast } from 'react-toastify';
import axios from '../utils/axios';
import { FiEye, FiEyeOff, FiMail, FiLock, FiPhone, FiMapPin, FiCheck, FiX, FiUser, FiBriefcase, FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import { FaBuilding, FaCheckCircle } from 'react-icons/fa';
import { ORGANIZATION_AUTH_ENDPOINT, ORGANIZATION_SUBSCRIPTION_ENDPOINT } from '../utils/constant';
import logger from '../utils/logger';

const OrganizationRegister = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const totalSteps = 4;
    
    const [formData, setFormData] = useState({
        // Step 1: Basic Info
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        
        // Step 2: Business Details
        phone: '',
        industry: '',
        companySize: '',
        address: {
            street: '',
            city: '',
            state: '',
            country: '',
            zipCode: ''
        },
        domain: '',
        referredBy: '',
        
        // Step 3: Admin Details
        adminName: '',
        adminEmail: '',
        adminPhone: '',
        adminTitle: '',
        adminPosition: '',
        
        // Step 4: Subscription
        subscriptionPlan: 'free'
    });
    
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [subscriptionPlans, setSubscriptionPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });
    const [termsAccepted, setTermsAccepted] = useState(false);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Industries
    const industries = [
        'IT', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 
        'Education', 'Real Estate', 'Hospitality', 'Construction', 
        'Transportation', 'Other'
    ];

    // Company Sizes
    const companySizes = [
        { value: 'startup', label: 'Startup (1-10 employees)' },
        { value: 'small', label: 'Small (11-50 employees)' },
        { value: 'medium', label: 'Medium (51-200 employees)' },
        { value: 'large', label: 'Large (201-1000 employees)' },
        { value: 'enterprise', label: 'Enterprise (1000+ employees)' }
    ];

    // Fetch subscription plans
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                setLoadingPlans(true);
                const response = await axios.get(`${ORGANIZATION_SUBSCRIPTION_ENDPOINT}/plans`);
                if (response.data.success && response.data.plans) {
                    setSubscriptionPlans(response.data.plans);
                }
            } catch (error) {
                logger.error('Failed to fetch subscription plans', { error: error.message });
            } finally {
                setLoadingPlans(false);
            }
        };
        fetchPlans();
    }, []);

    // Validate domain format
    const validateDomain = (domain) => {
        if (!domain || !domain.trim()) return true;
        const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
        return domainRegex.test(domain.trim());
    };

    // Get password strength label and color
    const getPasswordStrengthLabel = () => {
        const strengthCount = Object.values(passwordStrength).filter(Boolean).length;
        if (strengthCount === 0) {
            return { label: 'Weak', color: 'text-red-600' };
        } else if (strengthCount <= 2) {
            return { label: 'Fair', color: 'text-yellow-600' };
        } else if (strengthCount <= 4) {
            return { label: 'Good', color: 'text-theme-secondary' };
        } else {
            return { label: 'Strong', color: 'text-theme-primary' };
        }
    };

    // Update password strength as user types
    useEffect(() => {
        if (!formData.password) {
            setPasswordStrength({
                length: false,
                uppercase: false,
                lowercase: false,
                number: false,
                special: false
            });
            return;
        }

        setPasswordStrength({
            length: formData.password.length >= 8,
            uppercase: /[A-Z]/.test(formData.password),
            lowercase: /[a-z]/.test(formData.password),
            number: /[0-9]/.test(formData.password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
        });
    }, [formData.password]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name.startsWith('address.')) {
            const addressField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                address: {
                    ...prev.address,
                    [addressField]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (!formData.name.trim()) {
                    toast.error('Organization name is required');
                    return false;
                }
                if (formData.name.trim().length < 2) {
                    toast.error('Organization name must be at least 2 characters long');
                    return false;
                }
                if (!formData.email || !formData.email.includes('@')) {
                    toast.error('Please enter a valid email address');
                    return false;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.email)) {
                    toast.error('Please enter a valid email address');
                    return false;
                }
                if (!formData.password) {
                    toast.error('Password is required');
                    return false;
                }
                if (formData.password.length < 8) {
                    toast.error('Password must be at least 8 characters long');
                    return false;
                }
                if (!passwordStrength.uppercase) {
                    toast.error('Password must contain at least one uppercase letter');
                    return false;
                }
                if (!passwordStrength.lowercase) {
                    toast.error('Password must contain at least one lowercase letter');
                    return false;
                }
                if (!passwordStrength.number) {
                    toast.error('Password must contain at least one number');
                    return false;
                }
                if (!passwordStrength.special) {
                    toast.error('Password must contain at least one special character');
                    return false;
                }
                if (formData.password !== formData.confirmPassword) {
                    toast.error('Passwords do not match');
                    return false;
                }
                return true;
            
            case 2:
                // Step 2 is optional, so always valid
                if (formData.domain && !validateDomain(formData.domain)) {
                    toast.error('Please enter a valid domain (e.g., example.com)');
                    return false;
                }
                return true;
            
            case 3:
                // Step 3 is optional, so always valid
                return true;
            
            case 4:
                if (!termsAccepted) {
                    toast.error('Please accept the terms and conditions');
                    return false;
                }
                return true;
            
            default:
                return true;
        }
    };

    const handleNext = () => {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                setCurrentStep(currentStep + 1);
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateStep(currentStep)) {
            return;
        }

        try {
            setIsSubmitting(true);
            dispatch(setLoading(true));

            const payload = {
                name: formData.name.trim(),
                email: formData.email.toLowerCase().trim(),
                password: formData.password,
                phone: formData.phone.trim() || undefined,
                address: formData.address,
                domain: formData.domain.trim() || undefined,
                industry: formData.industry || undefined,
                companySize: formData.companySize || undefined,
                subscriptionPlan: formData.subscriptionPlan || 'free',
                adminName: formData.adminName.trim() || undefined,
                adminEmail: formData.adminEmail.toLowerCase().trim() || undefined,
                adminPhone: formData.adminPhone.trim() || undefined,
                adminTitle: formData.adminTitle.trim() || undefined,
                adminPosition: formData.adminPosition.trim() || undefined,
                referredBy: formData.referredBy.trim() || undefined,
                termsAccepted: true,
                privacyPolicyAccepted: true,
                gdprConsent: true,
                dataProcessingAgreement: true
            };

            const response = await axios.post(`${ORGANIZATION_AUTH_ENDPOINT}/register`, payload, {
                withCredentials: true
            });

            if (response.data.success) {
                if (response.data.organization?.id) {
                    localStorage.setItem('organizationId', response.data.organization.id);
                }
                
                localStorage.setItem('role', response.data.user?.role || 'admin');
                localStorage.setItem('userId', response.data.user?.id);
                
                dispatch(setUser({
                    id: response.data.user?.id,
                    name: response.data.user?.name,
                    email: response.data.user?.email,
                    role: response.data.user?.role || 'admin',
                    organizationId: response.data.organization?.id
                }));

                toast.success('Organization registered successfully!');
                
                // Redirect to onboarding or dashboard
                setTimeout(() => {
                    navigate('/organization/onboarding');
                }, 1000);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Registration failed';
            toast.error(errorMessage);
            logger.error('Registration error', { 
                error: error.message, 
                response: error.response?.data 
            });
        } finally {
            setIsSubmitting(false);
            dispatch(setLoading(false));
        }
    };

    const renderStepIndicator = () => {
        return (
            <div className="flex items-center justify-center mb-8">
                {[1, 2, 3, 4].map((step) => (
                    <React.Fragment key={step}>
                        <div className="flex items-center">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                                currentStep >= step 
                                    ? 'bg-theme-primary border-theme-secondary text-white' 
                                    : 'border-gray-300 text-gray-400'
                            }`}>
                                {currentStep > step ? (
                                    <FaCheckCircle className="w-6 h-6" />
                                ) : (
                                    <span className="font-semibold">{step}</span>
                                )}
                            </div>
                            {step < totalSteps && (
                                <div className={`w-16 h-1 mx-2 ${
                                    currentStep > step ? 'bg-theme-primary' : 'bg-gray-300'
                                }`} />
                            )}
                        </div>
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            case 4:
                return renderStep4();
            default:
                return null;
        }
    };

    const renderStep1 = () => (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h3>
            
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Organization Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaBuilding className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="Enter organization name"
                    />
                </div>
            </div>

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
                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="your-email@example.com"
                    />
                </div>
            </div>

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
                        autoComplete="new-password"
                        required
                        value={formData.password}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="Minimum 8 characters"
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
                {formData.password && (
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Password Strength:</span>
                            <span className={getPasswordStrengthLabel().color + " font-medium"}>
                                {getPasswordStrengthLabel().label}
                            </span>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className={`flex items-center ${passwordStrength.length ? 'text-theme-primary' : 'text-gray-400'}`}>
                                {passwordStrength.length ? <FiCheck className="mr-1" /> : <FiX className="mr-1" />}
                                At least 8 characters
                            </div>
                            <div className={`flex items-center ${passwordStrength.uppercase ? 'text-theme-primary' : 'text-gray-400'}`}>
                                {passwordStrength.uppercase ? <FiCheck className="mr-1" /> : <FiX className="mr-1" />}
                                One uppercase letter
                            </div>
                            <div className={`flex items-center ${passwordStrength.lowercase ? 'text-theme-primary' : 'text-gray-400'}`}>
                                {passwordStrength.lowercase ? <FiCheck className="mr-1" /> : <FiX className="mr-1" />}
                                One lowercase letter
                            </div>
                            <div className={`flex items-center ${passwordStrength.number ? 'text-theme-primary' : 'text-gray-400'}`}>
                                {passwordStrength.number ? <FiCheck className="mr-1" /> : <FiX className="mr-1" />}
                                One number
                            </div>
                            <div className={`flex items-center ${passwordStrength.special ? 'text-theme-primary' : 'text-gray-400'}`}>
                                {passwordStrength.special ? <FiCheck className="mr-1" /> : <FiX className="mr-1" />}
                                One special character
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="Confirm your password"
                    />
                    <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                        {showConfirmPassword ? (
                            <FiEyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                            <FiEye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Business Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                        Industry
                    </label>
                    <select
                        id="industry"
                        name="industry"
                        value={formData.industry}
                        onChange={handleChange}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                    >
                        <option value="">Select Industry</option>
                        {industries.map(industry => (
                            <option key={industry} value={industry}>{industry}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="companySize" className="block text-sm font-medium text-gray-700 mb-1">
                        Company Size
                    </label>
                    <select
                        id="companySize"
                        name="companySize"
                        value={formData.companySize}
                        onChange={handleChange}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                    >
                        <option value="">Select Company Size</option>
                        {companySizes.map(size => (
                            <option key={size.value} value={size.value}>{size.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiPhone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="+1 (555) 123-4567"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                    Domain (Optional)
                </label>
                <input
                    id="domain"
                    name="domain"
                    type="text"
                    value={formData.domain}
                    onChange={handleChange}
                    className={`appearance-none block w-full px-3 py-2 border rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm ${
                        formData.domain && !validateDomain(formData.domain) 
                            ? 'border-red-300' 
                            : 'border-gray-300'
                    }`}
                    placeholder="example.com"
                />
                {formData.domain && !validateDomain(formData.domain) && (
                    <p className="mt-1 text-xs text-red-500">Please enter a valid domain format</p>
                )}
            </div>

            <div className="border-t pt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <FiMapPin className="mr-2" />
                    Address (Optional)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <input
                            name="address.street"
                            type="text"
                            value={formData.address.street}
                            onChange={handleChange}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="Street Address"
                        />
                    </div>
                    <div>
                        <input
                            name="address.city"
                            type="text"
                            value={formData.address.city}
                            onChange={handleChange}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="City"
                        />
                    </div>
                    <div>
                        <input
                            name="address.state"
                            type="text"
                            value={formData.address.state}
                            onChange={handleChange}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="State/Province"
                        />
                    </div>
                    <div>
                        <input
                            name="address.country"
                            type="text"
                            value={formData.address.country}
                            onChange={handleChange}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="Country"
                        />
                    </div>
                    <div>
                        <input
                            name="address.zipCode"
                            type="text"
                            value={formData.address.zipCode}
                            onChange={handleChange}
                            className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="ZIP/Postal Code"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="referredBy" className="block text-sm font-medium text-gray-700 mb-1">
                    Referral Code (Optional)
                </label>
                <input
                    id="referredBy"
                    name="referredBy"
                    type="text"
                    value={formData.referredBy}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                    placeholder="Enter referral code if you have one"
                />
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Admin Account Details</h3>
            <p className="text-sm text-gray-600 mb-4">
                These details will be used to create your admin account. If left blank, defaults will be used.
            </p>
            
            <div>
                <label htmlFor="adminName" className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Name
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="adminName"
                        name="adminName"
                        type="text"
                        value={formData.adminName}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="Leave blank to use organization name + Admin"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Email
                </label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiMail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        id="adminEmail"
                        name="adminEmail"
                        type="email"
                        value={formData.adminEmail}
                        onChange={handleChange}
                        className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                        placeholder="Leave blank to use organization email"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="adminPhone" className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Phone
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiPhone className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            id="adminPhone"
                            name="adminPhone"
                            type="tel"
                            value={formData.adminPhone}
                            onChange={handleChange}
                            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="+1 (555) 123-4567"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="adminTitle" className="block text-sm font-medium text-gray-700 mb-1">
                        Admin Title
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <FiBriefcase className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            id="adminTitle"
                            name="adminTitle"
                            type="text"
                            value={formData.adminTitle}
                            onChange={handleChange}
                            className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                            placeholder="e.g., CEO, Manager"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label htmlFor="adminPosition" className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Position
                </label>
                <input
                    id="adminPosition"
                    name="adminPosition"
                    type="text"
                    value={formData.adminPosition}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-theme-secondary sm:text-sm"
                    placeholder="e.g., Director, VP"
                />
            </div>
        </div>
    );

    const renderStep4 = () => (
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Choose Your Plan</h3>
            <p className="text-sm text-gray-600 mb-6">
                Select a subscription plan that fits your organization. You can upgrade or downgrade at any time.
            </p>

            {loadingPlans ? (
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading plans...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {subscriptionPlans.map((plan) => (
                        <div
                            key={plan.id}
                            onClick={() => setFormData(prev => ({ ...prev, subscriptionPlan: plan.id }))}
                            className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
                                formData.subscriptionPlan === plan.id
                                    ? 'border-theme-secondary bg-theme-secondary/10 shadow-lg'
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            {formData.subscriptionPlan === plan.id && (
                                <div className="absolute top-4 right-4">
                                    <FaCheckCircle className="w-6 h-6 text-theme-secondary" />
                                </div>
                            )}
                            <div className="text-center">
                                <h4 className="text-lg font-semibold text-gray-900 mb-2">{plan.name}</h4>
                                <div className="mb-4">
                                    <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                                    <span className="text-gray-600">/month</span>
                                </div>
                                <p className="text-sm text-gray-600 mb-4">
                                    Up to {plan.maxEmployees} employees
                                </p>
                                <ul className="text-left space-y-2 text-sm text-gray-600">
                                    {plan.features.slice(0, 4).map((feature, idx) => (
                                        <li key={idx} className="flex items-start">
                                            <FiCheck className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                    {plan.features.length > 4 && (
                                        <li className="text-theme-secondary font-medium">
                                            +{plan.features.length - 4} more features
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="border-t pt-6 mt-6">
                <div className="flex items-start">
                    <div className="flex items-center h-5">
                        <input
                            id="terms"
                            name="terms"
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="h-4 w-4 text-theme-secondary focus:ring-2 focus:ring-[var(--color-primary)] border-gray-300 rounded"
                        />
                    </div>
                    <div className="ml-3 text-sm">
                        <label htmlFor="terms" className="text-gray-700">
                            I agree to the{' '}
                            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-theme-secondary hover:text-theme-secondary underline">
                                Terms and Conditions
                            </a>
                            {' '}and{' '}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-theme-secondary hover:text-theme-secondary underline">
                                Privacy Policy
                            </a>
                            <span className="text-red-500">*</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-white to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <FaBuilding className="h-12 w-12 text-theme-secondary" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        Register Your Organization
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Step {currentStep} of {totalSteps}
                    </p>
                </div>

                {renderStepIndicator()}

                <form onSubmit={handleSubmit} className="mt-8">
                    {renderStepContent()}

                    <div className="flex justify-between mt-8 pt-6 border-t">
                        <button
                            type="button"
                            onClick={handleBack}
                            disabled={currentStep === 1}
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FiArrowLeft className="mr-2" />
                            Back
                        </button>
                        
                        {currentStep < totalSteps ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                Next
                                <FiArrowRight className="ml-2" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isSubmitting || !termsAccepted}
                                className="flex items-center px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-theme-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Registering...
                                    </>
                                ) : (
                                    'Complete Registration'
                                )}
                            </button>
                        )}
                    </div>
                </form>

                <div className="text-center space-y-2 mt-6">
                    <p className="text-sm text-gray-600">
                        Already have an organization account?{' '}
                        <Link to="/organization/login" className="font-medium text-theme-secondary hover:text-theme-secondary">
                            Sign in here
                        </Link>
                    </p>
                    <p className="text-sm text-gray-600">
                        Regular user?{' '}
                        <Link to="/login" className="font-medium text-theme-secondary hover:text-theme-secondary">
                            Employee/Admin Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OrganizationRegister;
