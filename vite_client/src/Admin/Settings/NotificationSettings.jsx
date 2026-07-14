import React, { useState, useEffect } from 'react';
import { FaBell, FaEnvelope, FaTasks, FaUsers, FaProjectDiagram, FaSave, FaUndo } from 'react-icons/fa';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { usePushNotification } from '../../Hooks/usePushNotification';

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
    const { 
        isSupported, 
        isSubscribed, 
        isLoading: pushLoading, 
        error: pushError,
        subscribe,
        unsubscribe,
        requestPermission,
        sendTestNotification,
    } = usePushNotification();

    const [testingPush, setTestingPush] = useState(false);

    const handleTestPush = async () => {
        setTestingPush(true);
        try {
            const result = await sendTestNotification();
            const devices = result.devices || [];
            const mobile = devices.filter((d) => d.device === 'mobile');
            const mobileOk = mobile.filter((d) => d.status === 'sent').length;
            const summary = devices.length
                ? ` Sent ${result.sent}/${devices.length} devices` +
                  (mobile.length ? ` (mobile: ${mobileOk}/${mobile.length})` : '')
                : '';
            toast.success((result.message || 'Test push sent!') + summary);
        } catch (err) {
            toast.error(err.message || 'Failed to send test push');
        } finally {
            setTestingPush(false);
        }
    };

    useEffect(() => {
        fetchNotificationSettings();
    }, []);

    const fetchNotificationSettings = async () => {
        try {
            const response = await axios.get('/v1/admin/notification-settings/settings', {
                withCredentials: true
            });

            if (response.data.success) {
                setSettings(response.data.settings);
            }
        } catch (error) {
            // Removed console.error for production
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
            const response = await axios.patch('/v1/admin/notification-settings/settings', settings, {
                withCredentials: true
            });

            if (response.data.success) {
                toast.success('Notification settings saved successfully!');
            }
        } catch (error) {
            // Removed console.error for production
            toast.error('Failed to save notification settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        try {
            const response = await axios.post('/v1/admin/notification-settings/settings/reset', {}, {
                withCredentials: true
            });

            if (response.data.success) {
                setSettings(response.data.settings);
                toast.success('Notification settings reset to default');
            }
        } catch (error) {
            // Removed console.error for production
            toast.error('Failed to reset notification settings');
        }
    };

    if (loading) {
        return (
            <div className="p-4 sm:p-5 md:p-6">
                <div className="flex h-64 items-center justify-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-theme-secondary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 md:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center text-xl font-bold text-gray-800 sm:text-2xl">
                    <FaBell className="mr-2 flex-shrink-0 text-theme-secondary sm:mr-3" />
                    Notification Settings
                </h2>
                <div className="flex flex-col gap-2 sm:flex-row sm:space-x-3 sm:gap-0">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex w-full items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition hover:bg-gray-300 sm:w-auto"
                    >
                        <FaUndo className="mr-2" />
                        Reset to Default
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex w-full items-center justify-center rounded-lg bg-theme-primary px-4 py-2 text-white transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
                    >
                        <FaSave className="mr-2" />
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>

            <div className="space-y-5 sm:space-y-6 md:space-y-8">
                {/* Email Notifications */}
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4 md:p-6">
                    <h3 className="mb-4 flex items-center text-base font-semibold text-gray-800 sm:text-lg">
                        <FaEnvelope className="mr-2 flex-shrink-0 text-theme-secondary" />
                        Email Notifications
                    </h3>
                    <div className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center sm:p-4">
                        <div className="min-w-0 flex-1">
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
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                        </label>
                    </div>
                </div>

                {/* Task Notifications */}
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4 md:p-6">
                    <h3 className="mb-4 flex items-center text-base font-semibold text-gray-800 sm:text-lg">
                        <FaTasks className="mr-2 flex-shrink-0 text-theme-primary" />
                        Task Notifications
                    </h3>
                    
                    {/* Enable Task Notifications */}
                    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center sm:p-4">
                        <div className="min-w-0 flex-1">
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
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                        </label>
                    </div>

                    {settings.taskNotifications.enabled && (
                        <div className="space-y-4">
                            {/* Task Event Types */}
                            <div className="rounded-lg bg-white p-3 shadow-sm sm:p-4">
                                <h5 className="mb-3 font-medium text-gray-900">Task Event Types</h5>
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Notification Recipients */}
                            <div className="rounded-lg bg-white p-3 shadow-sm sm:p-4">
                                <h5 className="mb-3 flex items-center font-medium text-gray-900">
                                    <FaUsers className="mr-2 flex-shrink-0 text-purple-600" />
                                    Notification Recipients
                                </h5>
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                    <div className="flex items-start justify-between gap-3 sm:items-center">
                                        <div className="min-w-0 flex-1">
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
                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* General Notifications */}
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4 md:p-6">
                    <h3 className="mb-4 flex items-center text-base font-semibold text-gray-800 sm:text-lg">
                        <FaBell className="mr-2 flex-shrink-0 text-orange-600" />
                        General Notifications
                    </h3>
                    
                    <div className="mb-4 flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center sm:p-4">
                        <div className="min-w-0 flex-1">
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
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary"></div>
                        </label>
                    </div>

                    {settings.generalNotifications.enabled && (
                        <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center">
                                <div className="min-w-0 flex-1">
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
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                </label>
                            </div>
                            <div className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center">
                                <div className="min-w-0 flex-1">
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
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-theme-primary"></div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                {/* Push Notifications */}
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4 md:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Push Notifications</h3>
                    
                    {!isSupported && (
                        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 sm:p-4">
                            <p className="text-sm text-yellow-800">
                                Your browser does not support push notifications. Please use a modern browser like Chrome, Firefox, or Edge.
                            </p>
                        </div>
                    )}

                    {pushError && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 sm:p-4">
                            <p className="text-sm text-red-800">{pushError}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3 rounded-lg bg-white p-3 shadow-sm sm:items-center sm:p-4">
                            <div className="min-w-0 flex-1">
                                <h4 className="font-medium text-gray-900">Enable Push Notifications</h4>
                                <p className="text-sm text-gray-600">Receive real-time push notifications in the browser</p>
                                {isSubscribed && (
                                    <p className="mt-1 text-xs text-theme-primary">✓ Push notifications are active</p>
                                )}
                                {!isSubscribed && isSupported && !pushLoading && (
                                    <p className="mt-1 text-xs text-gray-500">Click to enable browser push notifications</p>
                                )}
                            </div>
                            <div className="flex flex-shrink-0 items-center space-x-3">
                                {pushLoading && (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-theme-secondary"></div>
                                )}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.pushNotifications && isSubscribed}
                                        disabled={!isSupported || pushLoading}
                                        onChange={async (e) => {
                                            handleToggle('pushNotifications', e.target.checked);
                                            if (e.target.checked) {
                                                // Request permission first, then subscribe
                                                const granted = await requestPermission();
                                                if (granted) {
                                                    await subscribe();
                                                } else {
                                                    // Revert toggle if permission denied
                                                    handleToggle('pushNotifications', false);
                                                }
                                            } else {
                                                await unsubscribe();
                                            }
                                        }}
                                    />
                                    <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-primary ${!isSupported || pushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                                </label>
                            </div>
                        </div>

                        {isSubscribed && (
                            <div className="flex flex-col gap-3 rounded-lg bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-gray-900">Test Push Notification</h4>
                                    <p className="text-sm text-gray-600">
                                        Send a test popup to this browser (minimize the window if you do not see it)
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleTestPush}
                                    disabled={testingPush || pushLoading}
                                    className="w-full flex-shrink-0 rounded-md bg-theme-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                                >
                                    {testingPush ? 'Sending...' : 'Send Test'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Notification Frequency */}
                <div className="rounded-lg bg-gray-50 p-3 sm:p-4 md:p-6">
                    <h3 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">Notification Frequency</h3>
                    <div className="rounded-lg bg-white p-3 shadow-sm sm:p-4">
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            How often would you like to receive notifications?
                        </label>
                        <select
                            value={settings.frequency}
                            onChange={(e) => handleToggle('frequency', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--color-primary)]"
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
