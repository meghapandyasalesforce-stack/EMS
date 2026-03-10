import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaCog, FaRuler, FaLock, FaUserShield, FaBell, FaEnvelope, FaChartLine, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt } from 'react-icons/fa';
import { FiToggleLeft, FiToggleRight, FiX } from 'react-icons/fi';
import AttendanceRules from '../Attendance/AttendanceRules';
import NotificationSettings from './NotificationSettings';
import EmailSettings from './EmailSettings';
import LeavePolicyManagement from '../../HR/Leave/LeavePolicyManagement';
import { toast } from 'react-toastify';
import {
    fetchOrganizationProfile,
    updateOrganizationSettings
} from '../../context/organizationSlice';
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
            id: 'general',
            name: 'General Settings',
            icon: <FaCog />,
            component: <GeneralSettings />
        }
    ];

    const activeComponent = settingsTabs.find(tab => tab.id === activeTab)?.component;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto space-y-6 lg:space-y-8 p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <FaCog className="mr-3 text-blue-600" />
                        Admin Settings
                    </h1>
                    <p className="text-gray-600 mt-2">Manage system settings and configurations</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4">Settings</h2>
                            <nav className="space-y-2">
                                {settingsTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                                            activeTab === tab.id
                                                ? 'bg-blue-600 text-white'
                                                : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <span className="text-xl">{tab.icon}</span>
                                        <span className="font-medium">{tab.name}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-lg shadow-md">
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
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Security Settings</h2>
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Password Policy</h3>
                <p className="text-sm text-gray-600">Configure password requirements for all users</p>
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Configure
                </button>
            </div>
        </div>
    </div>
);

const PermissionsSettings = () => (
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Permission Settings</h2>
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Role-based Access Control</h3>
                <p className="text-sm text-gray-600">Manage access permissions for different user roles</p>
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Manage Roles
                </button>
            </div>
        </div>
    </div>
);

const ReportsSettings = () => (
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Reports & Analytics</h2>
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Report Generation</h3>
                <p className="text-sm text-gray-600">Configure report settings and schedules</p>
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
        employeeIdPrefix: '',
        employeeIdStartNumber: 1,
        employeeIdMinDigits: 3
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
                employeeIdPrefix: profile.settings.employeeIdPrefix || '',
                employeeIdStartNumber: profile.settings.employeeIdNextNumber || 1,
                employeeIdMinDigits: profile.settings.employeeIdMinDigits || 3
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
            
            // Re-fetch profile to ensure we have the latest data
            const updatedProfile = await dispatch(fetchOrganizationProfile()).unwrap();
            
            // Update local state from the freshly fetched profile
            if (updatedProfile?.settings) {
                setSettings({
                    allowEmployeeRegistration: updatedProfile.settings.allowEmployeeRegistration ?? true,
                    requireEmailVerification: updatedProfile.settings.requireEmailVerification ?? false,
                    allowSelfService: updatedProfile.settings.allowSelfService ?? true,
                    employeeIdPrefix: updatedProfile.settings.employeeIdPrefix || '',
                    employeeIdStartNumber: updatedProfile.settings.employeeIdNextNumber || 1,
                    employeeIdMinDigits: updatedProfile.settings.employeeIdMinDigits || 3
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
            </div>
        );
    }

    return (
    <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">General Settings</h2>
                <button
                    onClick={handleSaveSettings}
                    disabled={isSaving}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                            <FaUserShield className="mr-2" />
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
                            <FiToggleRight className="w-12 h-6 text-green-600" />
                        ) : (
                            <FiToggleLeft className="w-12 h-6 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                            <FaLock className="mr-2" />
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
                            <FiToggleRight className="w-12 h-6 text-green-600" />
                        ) : (
                            <FiToggleLeft className="w-12 h-6 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                            <FaCog className="mr-2" />
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
                            <FiToggleRight className="w-12 h-6 text-green-600" />
                        ) : (
                            <FiToggleLeft className="w-12 h-6 text-gray-400" />
                        )}
                    </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-800 flex items-center">
                            <FaRuler className="mr-2" />
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

            {/* Migration Status Banner */}
            {showMigrationStatus && (
                <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
                    <FaCheckCircle className="text-green-600 mr-3 text-xl" />
                    <div className="flex-1">
                        <p className="text-green-800 font-semibold">Employee ID Migration Completed</p>
                        <p className="text-green-700 text-sm">All employee IDs have been successfully updated to the new format.</p>
                    </div>
                    <button
                        onClick={() => setShowMigrationStatus(false)}
                        className="text-green-600 hover:text-green-800"
                    >
                        <FiX className="text-xl" />
                    </button>
                </div>
            )}

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <FaExclamationTriangle className="text-yellow-500 text-3xl mr-3" />
                                <h3 className="text-xl font-bold text-gray-800">Confirm Employee ID Format Change</h3>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-gray-700 mb-3">
                                    You are about to change the Employee ID format. This will:
                                </p>
                                <ul className="list-disc list-inside text-gray-600 space-y-2 mb-4">
                                    <li>Update <strong>all existing employees</strong> with new Employee IDs</li>
                                    <li>Replace current IDs (e.g., "EMP-RAD-2025-7780") with the new format</li>
                                    <li>Assign sequential IDs starting from your configured start number</li>
                                </ul>
                                <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p className="text-sm text-gray-700">
                                        <strong>New Format Preview:</strong> {pendingSettings?.employeeIdPrefix || 'EMP'}
                                        {String(pendingSettings?.employeeIdStartNumber || 1).padStart(pendingSettings?.employeeIdMinDigits || 3, '0')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={handleCancelMigration}
                                    disabled={isSaving}
                                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmMigration}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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

