import React, { useState } from 'react';
import { FaCog, FaRuler, FaLock, FaUserShield, FaBell, FaEnvelope, FaChartLine } from 'react-icons/fa';
import AttendanceRules from '../Attendance/AttendanceRules';
import NotificationSettings from './NotificationSettings';

const AdminSettings = () => {
    const [activeTab, setActiveTab] = useState('attendance-rules');

    const settingsTabs = [
        {
            id: 'attendance-rules',
            name: 'Attendance Rules',
            icon: <FaRuler />,
            component: <AttendanceRules />
        },
        {
            id: 'notifications',
            name: 'Notification Settings',
            icon: <FaBell />,
            component: <NotificationSettings />
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
        <div className="min-h-screen bg-gray-50 ml-0 lg:ml-64">
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
    <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">General Settings</h2>
        <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">System Configuration</h3>
                <p className="text-sm text-gray-600">Manage general system settings</p>
                <button className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Configure
                </button>
            </div>
        </div>
    </div>
);

export default AdminSettings;

