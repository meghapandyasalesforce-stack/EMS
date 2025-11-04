import React, { useState, useEffect } from 'react';
import { FaBell, FaEnvelope, FaTasks, FaUsers, FaProjectDiagram, FaSave, FaUndo } from 'react-icons/fa';
import axios from 'axios';
import { toast } from 'react-toastify';

const NotificationSettings = () => {
    const [settings, setSettings] = useState({
        emailNotifications: true,
        taskNotifications: {
            enabled: true,
            taskCreated: true,
            taskUpdated: true,
            taskCompleted: true,
            notifyAdmins: true,
            notifyManagers: true,
            notifyProjectManagers: true
        },
        generalNotifications: {
            enabled: true,
            systemUpdates: true,
            announcements: true
        },
        pushNotifications: true,
        frequency: 'immediate'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchNotificationSettings();
    }, []);

    const fetchNotificationSettings = async () => {
        try {
            const response = await axios.get('/api/v1/admin/notification-settings/settings', {
                withCredentials: true
            });

            if (response.data.success) {
                setSettings(response.data.settings);
            }
        } catch (error) {
            console.error('Error fetching notification settings:', error);
            toast.error('Failed to load notification settings');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = (path, value) => {
        setSettings(prev => {
            const newSettings = { ...prev };
            const keys = path.split('.');
            let current = newSettings;
            
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]];
            }
            
            current[keys[keys.length - 1]] = value;
            return newSettings;
        });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const response = await axios.patch('/api/v1/admin/notification-settings/settings', settings, {
                withCredentials: true
            });

            if (response.data.success) {
                toast.success('Notification settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            toast.error('Failed to save notification settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        try {
            const response = await axios.post('/api/v1/admin/notification-settings/settings/reset', {}, {
                withCredentials: true
            });

            if (response.data.success) {
                setSettings(response.data.settings);
                toast.success('Notification settings reset to default');
            }
        } catch (error) {
            console.error('Error resetting notification settings:', error);
            toast.error('Failed to reset notification settings');
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                    <FaBell className="mr-3 text-blue-600" />
                    Notification Settings
                </h2>
                <div className="flex space-x-3">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center"
                    >
                        <FaUndo className="mr-2" />
                        Reset to Default
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center disabled:opacity-50"
                    >
                        <FaSave className="mr-2" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            <div className="space-y-8">
                {/* Email Notifications */}
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaEnvelope className="mr-2 text-blue-600" />
                        Email Notifications
                    </h3>
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
                        <div>
                            <h4 className="font-medium text-gray-900">Enable Email Notifications</h4>
                            <p className="text-sm text-gray-600">Receive notifications via email for important events</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.emailNotifications}
                                onChange={(e) => handleToggle('emailNotifications', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                {/* Task Notifications */}
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaTasks className="mr-2 text-green-600" />
                        Task Notifications
                    </h3>
                    
                    {/* Enable Task Notifications */}
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm mb-4">
                        <div>
                            <h4 className="font-medium text-gray-900">Enable Task Notifications</h4>
                            <p className="text-sm text-gray-600">Receive notifications when employees update their tasks</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.taskNotifications.enabled}
                                onChange={(e) => handleToggle('taskNotifications.enabled', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {settings.taskNotifications.enabled && (
                        <div className="space-y-4">
                            {/* Task Event Types */}
                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <h5 className="font-medium text-gray-900 mb-3">Task Event Types</h5>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Task Created</h6>
                                            <p className="text-xs text-gray-600">Notify when a new task is created</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.taskCreated}
                                                onChange={(e) => handleToggle('taskNotifications.taskCreated', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Task Updated</h6>
                                            <p className="text-xs text-gray-600">Notify when a task is modified</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.taskUpdated}
                                                onChange={(e) => handleToggle('taskNotifications.taskUpdated', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Task Completed</h6>
                                            <p className="text-xs text-gray-600">Notify when a task is marked as completed</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.taskCompleted}
                                                onChange={(e) => handleToggle('taskNotifications.taskCompleted', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Notification Recipients */}
                            <div className="bg-white rounded-lg shadow-sm p-4">
                                <h5 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <FaUsers className="mr-2 text-purple-600" />
                                    Notification Recipients
                                </h5>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Notify Admins</h6>
                                            <p className="text-xs text-gray-600">Send notifications to all system administrators</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.notifyAdmins}
                                                onChange={(e) => handleToggle('taskNotifications.notifyAdmins', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Notify Managers</h6>
                                            <p className="text-xs text-gray-600">Send notifications to employee managers</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.notifyManagers}
                                                onChange={(e) => handleToggle('taskNotifications.notifyManagers', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h6 className="text-sm font-medium text-gray-800">Notify Project Managers</h6>
                                            <p className="text-xs text-gray-600">Send notifications to project leaders and managers</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.taskNotifications.notifyProjectManagers}
                                                onChange={(e) => handleToggle('taskNotifications.notifyProjectManagers', e.target.checked)}
                                            />
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* General Notifications */}
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                        <FaBell className="mr-2 text-orange-600" />
                        General Notifications
                    </h3>
                    
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm mb-4">
                        <div>
                            <h4 className="font-medium text-gray-900">Enable General Notifications</h4>
                            <p className="text-sm text-gray-600">Receive general system notifications</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.generalNotifications.enabled}
                                onChange={(e) => handleToggle('generalNotifications.enabled', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {settings.generalNotifications.enabled && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-800">System Updates</h5>
                                    <p className="text-xs text-gray-600">Notifications about system maintenance and updates</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.generalNotifications.systemUpdates}
                                        onChange={(e) => handleToggle('generalNotifications.systemUpdates', e.target.checked)}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-800">Announcements</h5>
                                    <p className="text-xs text-gray-600">Important announcements and news</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.generalNotifications.announcements}
                                        onChange={(e) => handleToggle('generalNotifications.announcements', e.target.checked)}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Push Notifications */}
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Push Notifications</h3>
                    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
                        <div>
                            <h4 className="font-medium text-gray-900">Enable Push Notifications</h4>
                            <p className="text-sm text-gray-600">Receive real-time push notifications in the browser</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.pushNotifications}
                                onChange={(e) => handleToggle('pushNotifications', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>

                {/* Notification Frequency */}
                <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Notification Frequency</h3>
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            How often would you like to receive notifications?
                        </label>
                        <select
                            value={settings.frequency}
                            onChange={(e) => handleToggle('frequency', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="immediate">Immediate</option>
                            <option value="hourly">Hourly Digest</option>
                            <option value="daily">Daily Digest</option>
                            <option value="weekly">Weekly Digest</option>
                        </select>
                        <p className="text-xs text-gray-600 mt-2">
                            Choose how frequently you want to receive notification summaries
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotificationSettings;
