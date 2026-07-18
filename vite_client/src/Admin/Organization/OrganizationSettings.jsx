import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    fetchOrganizationProfile,
    updateOrganizationSettings,
    updateSubscriptionPlan
} from '../../context/organizationSlice';
import {
    FiSettings,
    FiSave,
    FiCreditCard,
    FiUsers,
    FiToggleLeft,
    FiToggleRight,
    FiCheckCircle,
    FiGlobe
} from 'react-icons/fi';
import TimezoneSelect from '../../components/TimezoneSelect';
import { setTimezoneContext, fetchOrganizationTimezone } from '../../context/timezoneSlice';
import { DEFAULT_TIMEZONE } from '../../utils/timezoneOptions';

const OrganizationSettings = () => {
    const dispatch = useDispatch();
    const { profile, loading } = useSelector((state) => state.organization);
    const [settings, setSettings] = useState({
        allowEmployeeRegistration: true,
        requireEmailVerification: false,
        allowSelfService: true,
        employeeIdPrefix: '',
        employeeIdStartNumber: 1,
        employeeIdMinDigits: 3,
        timezone: DEFAULT_TIMEZONE,
        tdsCalculationMode: 'cumulative',
    });
    const [subscription, setSubscription] = useState({
        subscriptionPlan: 'free',
        maxEmployees: 10
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        dispatch(fetchOrganizationProfile());
    }, [dispatch]);

    useEffect(() => {
        // Update local state whenever profile data changes
        if (profile?.settings) {
            setSettings({
                allowEmployeeRegistration: profile.settings.allowEmployeeRegistration ?? true,
                requireEmailVerification: profile.settings.requireEmailVerification ?? false,
                allowSelfService: profile.settings.allowSelfService ?? true,
                employeeIdPrefix: profile.settings.employeeIdPrefix || '',
                employeeIdStartNumber: profile.settings.employeeIdNextNumber || 1,
                employeeIdMinDigits: profile.settings.employeeIdMinDigits || 3,
                timezone: profile.timezone || DEFAULT_TIMEZONE,
                tdsCalculationMode: profile.settings.tdsCalculationMode === 'independent' ? 'independent' : 'cumulative',
            });
        }
        if (profile) {
            setSubscription({
                subscriptionPlan: profile.subscriptionPlan || 'free',
                maxEmployees: profile.maxEmployees || 10
            });
        }
    }, [profile]);

    const handleSettingChange = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const handleSubscriptionChange = (e) => {
        const { name, value } = e.target;
        setSubscription(prev => ({
            ...prev,
            [name]: value
        }));

        // Auto-set employee limits based on plan
        if (name === 'subscriptionPlan') {
            const planLimits = {
                free: 10,
                basic: 50,
                premium: 200,
                enterprise: 1000
            };
            setSubscription(prev => ({
                ...prev,
                maxEmployees: planLimits[value] || prev.maxEmployees
            }));
        }
    };

    const handleSaveSettings = async () => {
        try {
            setIsSaving(true);
            const result = await dispatch(updateOrganizationSettings(settings)).unwrap();
            if (result?.timezone || settings.timezone) {
                dispatch(setTimezoneContext({
                    timezone: result?.timezone || settings.timezone,
                    organizationTimezone: result?.timezone || settings.timezone,
                    attendanceRuleTimezone: null,
                }));
                dispatch(fetchOrganizationTimezone());
            }
            const updatedProfile = await dispatch(fetchOrganizationProfile()).unwrap();
            // Update local state from the freshly fetched profile
            if (updatedProfile?.settings) {
                setSettings({
                    allowEmployeeRegistration: updatedProfile.settings.allowEmployeeRegistration ?? true,
                    requireEmailVerification: updatedProfile.settings.requireEmailVerification ?? false,
                    allowSelfService: updatedProfile.settings.allowSelfService ?? true,
                    employeeIdPrefix: updatedProfile.settings.employeeIdPrefix || '',
                    employeeIdStartNumber: updatedProfile.settings.employeeIdNextNumber || 1,
                    employeeIdMinDigits: updatedProfile.settings.employeeIdMinDigits || 3,
                    timezone: updatedProfile.timezone || DEFAULT_TIMEZONE,
                    tdsCalculationMode: updatedProfile.settings.tdsCalculationMode === 'independent' ? 'independent' : 'cumulative',
                });
            }
            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error(error || 'Failed to update settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSubscription = async () => {
        try {
            setIsSaving(true);
            await dispatch(updateSubscriptionPlan(subscription)).unwrap();
            toast.success('Subscription plan updated successfully');
        } catch (error) {
            toast.error(error || 'Failed to update subscription');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading && !profile) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-secondary"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Organization Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <FiSettings className="mr-2" />
                        Organization Settings
                    </h2>
                    <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        className="flex items-center px-4 py-2 bg-theme-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        <FiSave className="mr-2" />
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Allow Employee Registration */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-800 flex items-center">
                                <FiUsers className="mr-2" />
                                Allow Employee Registration
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Allow employees to register themselves in the system
                            </p>
                        </div>
                        <button
                            onClick={() => handleSettingChange('allowEmployeeRegistration')}
                            className="ml-4"
                        >
                            {settings.allowEmployeeRegistration ? (
                                <FiToggleRight className="w-12 h-6 text-theme-primary" />
                            ) : (
                                <FiToggleLeft className="w-12 h-6 text-gray-400" />
                            )}
                        </button>
                    </div>

                    {/* Require Email Verification */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-800 flex items-center">
                                <FiCheckCircle className="mr-2" />
                                Require Email Verification
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Require email verification for new employee registrations
                            </p>
                        </div>
                        <button
                            onClick={() => handleSettingChange('requireEmailVerification')}
                            className="ml-4"
                        >
                            {settings.requireEmailVerification ? (
                                <FiToggleRight className="w-12 h-6 text-theme-primary" />
                            ) : (
                                <FiToggleLeft className="w-12 h-6 text-gray-400" />
                            )}
                        </button>
                    </div>

                    {/* Allow Self Service */}
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-800 flex items-center">
                                <FiSettings className="mr-2" />
                                Allow Self Service
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Allow employees to update their own profile information
                            </p>
                        </div>
                        <button
                            onClick={() => handleSettingChange('allowSelfService')}
                            className="ml-4"
                        >
                            {settings.allowSelfService ? (
                                <FiToggleRight className="w-12 h-6 text-theme-primary" />
                            ) : (
                                <FiToggleLeft className="w-12 h-6 text-gray-400" />
                            )}
                        </button>
                    </div>

                    {/* Payroll TDS calculation mode */}
                    <div className="p-4 border border-gray-200 rounded-lg">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center mb-1">
                            <FiCreditCard className="mr-2" />
                            Payroll TDS calculation
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Applies on the next payroll generate / regenerate. Existing payslips are not changed automatically.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setSettings((prev) => ({ ...prev, tdsCalculationMode: 'cumulative' }))}
                                className={`text-left rounded-lg border p-4 transition ${
                                    settings.tdsCalculationMode === 'cumulative'
                                        ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-semibold text-gray-900">Past TDS adjustment</div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Cumulative: tax due through employment months in the FY minus TDS already deducted (mid-year join uses join→March span, not always ÷12).
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSettings((prev) => ({ ...prev, tdsCalculationMode: 'independent' }))}
                                className={`text-left rounded-lg border p-4 transition ${
                                    settings.tdsCalculationMode === 'independent'
                                        ? 'border-theme-primary bg-theme-primary/5 ring-1 ring-theme-primary'
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="font-semibold text-gray-900">No past TDS adjustment</div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Independent: remaining annual tax ÷ months left (this month → March). Past slips are not reopened; already-cut TDS is subtracted first.
                                </p>
                            </button>
                        </div>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg mb-6">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center mb-3">
                            <FiGlobe className="mr-2" />
                            Organization timezone
                        </h3>
                        <TimezoneSelect
                            id="org-timezone"
                            value={settings.timezone}
                            onChange={(tz) => setSettings((prev) => ({ ...prev, timezone: tz }))}
                            label=""
                            hint="Default timezone for attendance, leave, payroll, and displayed times across the app."
                        />
                    </div>

                    {/* Employee ID Format */}
                    <div className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-800 flex items-center">
                                <FiUsers className="mr-2" />
                                Employee ID Format
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                                Example: prefix PRS + start 10 → PRS010
                            </p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Prefix</label>
                                <input
                                    type="text"
                                    value={settings.employeeIdPrefix}
                                    onChange={(e) => setSettings(prev => ({ ...prev, employeeIdPrefix: e.target.value }))}
                                    className="mt-1 w-full border rounded-md p-2"
                                    placeholder="PRS"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Start Number</label>
                                <input
                                    type="number"
                                    value={settings.employeeIdStartNumber}
                                    onChange={(e) => setSettings(prev => ({ ...prev, employeeIdStartNumber: Number(e.target.value) }))}
                                    className="mt-1 w-full border rounded-md p-2"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Min Digits</label>
                                <input
                                    type="number"
                                    value={settings.employeeIdMinDigits}
                                    onChange={(e) => setSettings(prev => ({ ...prev, employeeIdMinDigits: Number(e.target.value) }))}
                                    className="mt-1 w-full border rounded-md p-2"
                                    min="2"
                                    max="10"
                                />
                            </div>
                        </div>

                        <div className="mt-3 text-sm text-gray-600">
                            Preview: <strong>{settings.employeeIdPrefix || 'EMP'}{String(settings.employeeIdStartNumber).padStart(settings.employeeIdMinDigits, '0')}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subscription Management */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <FiCreditCard className="mr-2" />
                        Subscription Management
                    </h2>
                    <button
                        onClick={handleSaveSubscription}
                        disabled={isSaving}
                        className="flex items-center px-4 py-2 bg-theme-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
                    >
                        <FiSave className="mr-2" />
                        {isSaving ? 'Saving...' : 'Update Plan'}
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Subscription Plan */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subscription Plan
                        </label>
                        <select
                            name="subscriptionPlan"
                            value={subscription.subscriptionPlan}
                            onChange={handleSubscriptionChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                            <option value="free">Free (10 employees)</option>
                            <option value="basic">Basic (50 employees)</option>
                            <option value="premium">Premium (200 employees)</option>
                            <option value="enterprise">Enterprise (1000 employees)</option>
                        </select>
                        <p className="text-sm text-gray-500 mt-1">
                            Select your organization's subscription plan
                        </p>
                    </div>

                    {/* Max Employees */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Maximum Employees
                        </label>
                        <input
                            type="number"
                            name="maxEmployees"
                            value={subscription.maxEmployees}
                            onChange={handleSubscriptionChange}
                            min="1"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            Maximum number of employees allowed in your organization
                        </p>
                    </div>

                    {/* Plan Features */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-medium text-gray-800 mb-2">Current Plan Features:</h3>
                        <ul className="space-y-1 text-sm text-gray-600">
                            <li>• {subscription.subscriptionPlan === 'free' && 'Basic features'}
                                {subscription.subscriptionPlan === 'basic' && 'Standard features + Email support'}
                                {subscription.subscriptionPlan === 'premium' && 'Advanced features + Priority support'}
                                {subscription.subscriptionPlan === 'enterprise' && 'All features + Dedicated support'}
                            </li>
                            <li>• Up to {subscription.maxEmployees} employees</li>
                            <li>• Full access to all modules</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrganizationSettings;

