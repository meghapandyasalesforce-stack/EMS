import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaCog, FaRuler, FaLock, FaUserShield, FaBell, FaEnvelope, FaChartLine, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt, FaPalette, FaMoneyBillWave } from 'react-icons/fa';
import { FiToggleLeft, FiToggleRight, FiX } from 'react-icons/fi';
import AttendanceRules from '../Attendance/AttendanceRules';
import NotificationSettings from './NotificationSettings';
import EmailSettings from './EmailSettings';
import LeavePolicyManagement from '../../HR/Leave/LeavePolicyManagement';
import ThemeSettings from './ThemeSettings';
import PayrollSettings from './PayrollSettings';
import { toast } from 'react-toastify';
import {
    fetchOrganizationProfile,
    updateOrganizationSettings
} from '../../context/organizationSlice';
import TimezoneSelect from '../../components/TimezoneSelect';
import { fetchOrganizationTimezone } from '../../context/timezoneSlice';
import { DEFAULT_TIMEZONE } from '../../utils/timezoneOptions';
import { setUser } from '../../context/Auth/authSlice';
import { fetchEmployeeOwnInfo } from '../../context/employeeDetailsSlice';
import { fetchEmployees } from '../../context/employeeSlice';

const AdminSettings = () => {
    const [activeTab, setActiveTab] = useState('email'); // Default to email settings for troubleshooting

    const settingsTabs = [
        {
            id: 'attendance-rules',
            name: 'Attendance Rules',
            icon: <FaRuler />,
            component: <AttendanceRules />
        },
        {
            id: 'leave-policy',
            name: 'Leave Policy',
            icon: <FaCalendarAlt />,
            component: <LeavePolicyManagement />
        },
        {
            id: 'payroll-settings',
            name: 'Payroll Settings',
            icon: <FaMoneyBillWave />,
            component: <PayrollSettings />
        },
        {
            id: 'notifications',
            name: 'Notification Settings',
            icon: <FaBell />,
            component: <NotificationSettings />
        },
        {
            id: 'email',
            name: 'Email Configuration',
            icon: <FaEnvelope />,
            component: <EmailSettings />
        },
        {
            id: 'security',
            name: 'Security',
            icon: <FaLock />,
            component: <SecuritySettings />
        },
        {
            id: 'permissions',
            name: 'Permissions',
            icon: <FaUserShield />,
            component: <PermissionsSettings />
        },
        {
            id: 'reports',
            name: 'Reports & Analytics',
            icon: <FaChartLine />,
            component: <ReportsSettings />
        },
        {
            id: 'theme',
            name: 'Theme & Branding',
            icon: <FaPalette />,
            component: <ThemeSettings />
        },
        {
            id: 'general',
            name: 'General Settings',
            icon: <FaCog />,
            component: <GeneralSettings />
        }
    ];

    const activeComponent = settingsTabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="page-shell min-h-screen w-full min-w-0 bg-[var(--color-bg-soft)] text-[var(--color-text)]">
            <div className="page-shell-inner hrms-stack">
                {/* Header */}
                <div className="rounded-lg bg-white p-4 shadow-md sm:p-5 md:p-6">
                    <h1 className="flex items-center text-xl font-bold text-gray-900 sm:text-2xl md:text-3xl">
                        <FaCog className="mr-2 flex-shrink-0 text-[var(--color-primary)] sm:mr-3" />
                        <span className="leading-tight">Admin Settings</span>
                    </h1>
                    <p className="mt-1.5 text-sm text-gray-600 sm:mt-2 sm:text-base">
                        Manage system settings and configurations
                    </p>
                </div>

                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
                    {/* Sidebar Navigation */}
                    <aside className="min-w-0 lg:col-span-3">
                        <div className="rounded-lg bg-white p-3 shadow-md sm:p-4 lg:sticky lg:top-4">
                            <h2 className="mb-3 px-1 text-base font-semibold text-gray-800 sm:mb-4 sm:text-lg">
                                Settings
                            </h2>
                            {/* Mobile / tablet: horizontal scroll; desktop: stacked list */}
                            <nav className="hrms-tabs-scroll lg:flex-col lg:space-y-1.5 lg:overflow-visible lg:pb-0">
                                {settingsTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex flex-shrink-0 items-center space-x-2.5 rounded-lg px-3 py-2.5 text-left transition-colors sm:space-x-3 sm:px-4 sm:py-3 ${
                                            activeTab === tab.id
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        } lg:w-full`}
                                    >
                                        <span className="flex-shrink-0 text-lg sm:text-xl">{tab.icon}</span>
                                        <span className="whitespace-nowrap text-sm font-medium sm:text-base">
                                            {tab.name}
                                        </span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <div className="min-w-0 lg:col-span-9">
                        <div className="overflow-hidden rounded-lg bg-white shadow-md">
                            {activeComponent}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Placeholder components for other settings tabs

const SecuritySettings = () => (
    <div className="p-4 sm:p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-800 sm:mb-6 sm:text-2xl">Security Settings</h2>
        <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 font-medium">Password Policy</h3>
                <p className="text-sm text-gray-600">Configure password requirements for all users</p>
                <button type="button" className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-white hover:opacity-90">
                    Configure
                </button>
            </div>
        </div>
    </div>
);

const PermissionsSettings = () => (
    <div className="p-4 sm:p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-800 sm:mb-6 sm:text-2xl">Permission Settings</h2>
        <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 font-medium">Role-based Access Control</h3>
                <p className="text-sm text-gray-600">Manage access permissions for different user roles</p>
                <button type="button" className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-white hover:opacity-90">
                    Manage Roles
                </button>
            </div>
        </div>
    </div>
);

const ReportsSettings = () => (
    <div className="p-4 sm:p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-gray-800 sm:mb-6 sm:text-2xl">Reports & Analytics</h2>
        <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 font-medium">Report Generation</h3>
                <p className="text-sm text-gray-600">Configure report settings and schedules</p>
                <button type="button" className="mt-3 rounded-lg bg-theme-primary px-4 py-2 text-white hover:opacity-90">
                    Configure Reports
                </button>
            </div>
        </div>
    </div>
);

const GeneralSettings = () => (
    <GeneralSettingsContent />
);

const GeneralSettingsContent = () => {
    const dispatch = useDispatch();
    const { profile, loading } = useSelector((state) => state.organization);
    const currentUser = useSelector((state) => state.auth.user);
    const [settings, setSettings] = useState({
        allowEmployeeRegistration: true,
        requireEmailVerification: false,
        allowSelfService: true,
        allowWorkFromHome: true,
        employeeIdPrefix: '',
        employeeIdStartNumber: 1,
        employeeIdMinDigits: 3,
        timezone: DEFAULT_TIMEZONE,
    });
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingSettings, setPendingSettings] = useState(null);
    const [showMigrationStatus, setShowMigrationStatus] = useState(false);

    useEffect(() => {
        // Always fetch fresh data when component mounts or becomes visible
        dispatch(fetchOrganizationProfile());
    }, [dispatch]);

    useEffect(() => {
        // Update local state whenever profile data changes
        if (profile?.settings) {
            setSettings({
                allowEmployeeRegistration: profile.settings.allowEmployeeRegistration ?? true,
                requireEmailVerification: profile.settings.requireEmailVerification ?? false,
                allowSelfService: profile.settings.allowSelfService ?? true,
                allowWorkFromHome: profile.settings.allowWorkFromHome ?? true,
                employeeIdPrefix: profile.settings.employeeIdPrefix || '',
                employeeIdStartNumber: profile.settings.employeeIdNextNumber || 1,
                employeeIdMinDigits: profile.settings.employeeIdMinDigits || 3,
                timezone: profile.timezone || DEFAULT_TIMEZONE,
            });
        }
    }, [profile]);

    const handleSettingChange = (key) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Check if Employee ID format is being changed
    const checkFormatChange = (newSettings) => {
        if (!profile?.settings) return false;
        
        const oldPrefix = profile.settings.employeeIdPrefix || null;
        const oldMinDigits = profile.settings.employeeIdMinDigits || 3;
        const oldNextNumber = profile.settings.employeeIdNextNumber || null;
        
        const newPrefix = newSettings.employeeIdPrefix?.trim() 
            ? newSettings.employeeIdPrefix.trim().toUpperCase() 
            : null;
        const newMinDigits = newSettings.employeeIdMinDigits || 3;
        const newStartNumber = newSettings.employeeIdStartNumber || 1;
        
        return (
            (newPrefix !== oldPrefix) ||
            (newMinDigits !== oldMinDigits) ||
            (newStartNumber !== oldNextNumber)
        ) && newPrefix !== null; // Only show dialog if prefix is set
    };

    const handleSaveSettings = async () => {
        // Check if Employee ID format is changing
        if (checkFormatChange(settings)) {
            setPendingSettings(settings);
            setShowConfirmDialog(true);
            return;
        }
        
        await performSave(settings);
    };

    const performSave = async (settingsToSave) => {
        try {
            setIsSaving(true);
            const result = await dispatch(updateOrganizationSettings(settingsToSave)).unwrap();
            if (result?.timezone || settingsToSave.timezone) {
                dispatch(fetchOrganizationTimezone());
            }
            
            const updatedProfile = await dispatch(fetchOrganizationProfile()).unwrap();
            
            if (updatedProfile?.settings) {
                setSettings({
                    allowEmployeeRegistration: updatedProfile.settings.allowEmployeeRegistration ?? true,
                    requireEmailVerification: updatedProfile.settings.requireEmailVerification ?? false,
                    allowSelfService: updatedProfile.settings.allowSelfService ?? true,
                    allowWorkFromHome: updatedProfile.settings.allowWorkFromHome ?? true,
                    employeeIdPrefix: updatedProfile.settings.employeeIdPrefix || '',
                    employeeIdStartNumber: updatedProfile.settings.employeeIdNextNumber || 1,
                    employeeIdMinDigits: updatedProfile.settings.employeeIdMinDigits || 3,
                    timezone: updatedProfile.timezone || DEFAULT_TIMEZONE,
                });
            }
            
            // Show migration status if migration occurred
            if (result.migrationCompleted) {
                setShowMigrationStatus(true);
                toast.success('Settings updated successfully. All employee IDs have been migrated to the new format.');
                
                // Refresh employee lists to show updated IDs everywhere
                try {
                    await dispatch(fetchEmployees()).unwrap();
                } catch {
                    // Silently fail - user can refresh manually if needed
                }
                
                // Refresh current user's auth data if they're an employee/HR/Manager
                // This ensures their Employee ID is updated in the UI immediately
                if (currentUser && (currentUser.role === 'employee' || currentUser.role === 'hr' || currentUser.role === 'manager')) {
                    try {
                        const freshEmployeeData = await dispatch(fetchEmployeeOwnInfo()).unwrap();
                        if (freshEmployeeData) {
                            dispatch(setUser({
                                ...currentUser,
                                ...freshEmployeeData,
                                employeeId: freshEmployeeData.employeeId || currentUser.employeeId
                            }));
                        }
                    } catch {
                        // Silently fail - user can refresh page manually if needed
                    }
                }
                // Hide migration status after 5 seconds
                setTimeout(() => setShowMigrationStatus(false), 5000);
            } else {
                toast.success('Settings updated successfully');
            }
        } catch (error) {
            toast.error(error || 'Failed to update settings');
        } finally {
            setIsSaving(false);
            setShowConfirmDialog(false);
            setPendingSettings(null);
        }
    };

    const handleConfirmMigration = () => {
        if (pendingSettings) {
            performSave(pendingSettings);
        }
    };

    const handleCancelMigration = () => {
        setShowConfirmDialog(false);
        setPendingSettings(null);
    };

    if (loading && !profile) {
        return (
            <div className="p-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-theme-primary mx-auto" style={{ borderBottomColor: 'var(--color-primary)' }}></div>
            </div>
        );
    }

    return (
    <div className="p-4 sm:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">General Settings</h2>
                <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center rounded-md bg-theme-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 sm:items-center sm:p-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center text-base font-medium text-gray-800 sm:text-lg">
                            <FaUserShield className="mr-2 flex-shrink-0" />
                            Allow Employee Registration
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Allow employees to register themselves in the system
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSettingChange('allowEmployeeRegistration')}
                        className="ml-2 flex-shrink-0"
                    >
                        {settings.allowEmployeeRegistration ? (
                            <FiToggleRight className="h-6 w-12 text-theme-primary" />
                        ) : (
                            <FiToggleLeft className="h-6 w-12 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 sm:items-center sm:p-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center text-base font-medium text-gray-800 sm:text-lg">
                            <FaLock className="mr-2 flex-shrink-0" />
                            Require Email Verification
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Require email verification for new employee registrations
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSettingChange('requireEmailVerification')}
                        className="ml-2 flex-shrink-0"
                    >
                        {settings.requireEmailVerification ? (
                            <FiToggleRight className="h-6 w-12 text-theme-primary" />
                        ) : (
                            <FiToggleLeft className="h-6 w-12 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 sm:items-center sm:p-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center text-base font-medium text-gray-800 sm:text-lg">
                            <FaCog className="mr-2 flex-shrink-0" />
                            Allow Self Service
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Allow employees to update their own profile information
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSettingChange('allowSelfService')}
                        className="ml-2 flex-shrink-0"
                    >
                        {settings.allowSelfService ? (
                            <FiToggleRight className="h-6 w-12 text-theme-primary" />
                        ) : (
                            <FiToggleLeft className="h-6 w-12 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3 sm:items-center sm:p-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center text-base font-medium text-gray-800 sm:text-lg">
                            <FaCog className="mr-2 flex-shrink-0" />
                            Allow Work From Home
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Allow employees to punch in with the &quot;Work From Home&quot; option. WFH punches are recorded
                            from any location and are shown separately from office attendance. Office punch verification is unaffected.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSettingChange('allowWorkFromHome')}
                        className="ml-2 flex-shrink-0"
                    >
                        {settings.allowWorkFromHome ? (
                            <FiToggleRight className="h-6 w-12 text-theme-primary" />
                        ) : (
                            <FiToggleLeft className="h-6 w-12 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
                    <TimezoneSelect
                        id="admin-general-timezone"
                        value={settings.timezone}
                        onChange={(tz) => setSettings((prev) => ({ ...prev, timezone: tz }))}
                        label="Organization timezone"
                        hint="Company-wide default. Attendance rules can override this for punch and office-hour logic."
                    />
                </div>

                <div className="rounded-lg border border-gray-200 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                        <h3 className="flex items-center text-base font-medium text-gray-800 sm:text-lg">
                            <FaRuler className="mr-2 flex-shrink-0" />
                            Employee ID Format
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Example: prefix PRS + start 10 → PRS010
                        </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                        <div className="min-w-0">
                            <label className="block text-sm font-medium text-gray-700">Prefix</label>
                            <input
                                type="text"
                                value={settings.employeeIdPrefix}
                                onChange={(e) => setSettings(prev => ({ ...prev, employeeIdPrefix: e.target.value }))}
                                className="mt-1 w-full rounded-md border p-2"
                                placeholder="PRS"
                            />
                        </div>

                        <div className="min-w-0">
                            <label className="block text-sm font-medium text-gray-700">Start Number</label>
                            <input
                                type="number"
                                value={settings.employeeIdStartNumber}
                                onChange={(e) => setSettings(prev => ({ ...prev, employeeIdStartNumber: Number(e.target.value) }))}
                                className="mt-1 w-full rounded-md border p-2"
                                min="1"
                            />
                        </div>

                        <div className="min-w-0 sm:col-span-2 md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700">Min Digits</label>
                            <input
                                type="number"
                                value={settings.employeeIdMinDigits}
                                onChange={(e) => setSettings(prev => ({ ...prev, employeeIdMinDigits: Number(e.target.value) }))}
                                className="mt-1 w-full rounded-md border p-2"
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

            {/* Migration Status Banner */}
            {showMigrationStatus && (
                <div className="mt-6 flex items-start gap-3 rounded-lg border p-3 sm:items-center sm:p-4" style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)' }}>
                    <FaCheckCircle className="mt-0.5 flex-shrink-0 text-xl sm:mt-0" style={{ color: 'var(--color-primary)' }} />
                    <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--color-text)]">Employee ID Migration Completed</p>
                        <p className="text-sm opacity-80 text-[var(--color-text)]">All employee IDs have been successfully updated to the new format.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowMigrationStatus(false)}
                        className="flex-shrink-0 transition-opacity hover:opacity-80"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        <FiX className="text-xl" />
                    </button>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                        <div className="p-4 sm:p-6">
                            <div className="mb-4 flex items-start sm:items-center">
                                <FaExclamationTriangle className="mr-3 flex-shrink-0 text-2xl text-yellow-500 sm:text-3xl" />
                                <h3 className="text-lg font-bold text-gray-800 sm:text-xl">Confirm Employee ID Format Change</h3>
                            </div>
                            
                            <div className="mb-4">
                                <p className="mb-3 text-gray-700">
                                    You are about to change the Employee ID format. This will:
                                </p>
                                <ul className="mb-4 list-disc space-y-2 pl-5 text-gray-600">
                                    <li>Update <strong>all existing employees</strong> with new Employee IDs</li>
                                    <li>Replace current IDs (e.g., "EMP-RAD-2025-7780") with the new format</li>
                                    <li>Assign sequential IDs starting from your configured start number</li>
                                </ul>
                                <div className="rounded border border-theme-secondary bg-theme-secondary/10 p-3">
                                    <p className="text-sm text-gray-700">
                                        <strong>New Format Preview:</strong> {pendingSettings?.employeeIdPrefix || 'EMP'}
                                        {String(pendingSettings?.employeeIdStartNumber || 1).padStart(pendingSettings?.employeeIdMinDigits || 3, '0')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row sm:space-x-3 sm:gap-0">
                                <button
                                    type="button"
                                    onClick={handleCancelMigration}
                                    disabled={isSaving}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmMigration}
                                    disabled={isSaving}
                                    className="rounded-md bg-theme-primary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
                                >
                                    {isSaving ? 'Migrating...' : 'Confirm & Migrate'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
    </div>
);
};

export default AdminSettings;

