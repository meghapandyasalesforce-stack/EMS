import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { usePushNotification } from '../Hooks/usePushNotification';

/**
 * Shared enable/disable push control for all roles (employee, HR, admin).
 */
const EnablePushNotificationsButton = () => {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    requestPermission,
  } = usePushNotification();

  const [busy, setBusy] = useState(false);

  const handleEnable = async () => {
    setBusy(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        toast.error('Notification permission denied. Enable it in browser settings for this site.');
        return;
      }
      await subscribe();
      toast.success('Notifications enabled on this device');
    } catch (err) {
      toast.error(err.message || 'Failed to enable notifications');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await unsubscribe();
      toast.success('Notifications disabled on this device');
    } catch (err) {
      toast.error(err.message || 'Failed to disable notifications');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        Checking notification status…
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        Push notifications are not supported in this browser. Use Chrome (Android) or add the app to Home Screen (iOS).
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {isSubscribed ? 'Push notifications are on' : 'Enable push notifications'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {isSubscribed
              ? 'This device will receive alerts for leave, attendance, and announcements.'
              : 'Turn on notifications for this device. Works for all existing users.'}
          </p>
          {error && !isSubscribed && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {!isSubscribed ? (
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-theme-primary hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {busy ? 'Enabling…' : 'Enable Notifications'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDisable}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
            >
              {busy ? 'Disabling…' : 'Disable Notifications'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnablePushNotificationsButton;
