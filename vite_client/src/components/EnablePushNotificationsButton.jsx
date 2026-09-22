import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { usePushNotification } from '../Hooks/usePushNotification';
import { isLikelyMobileDevice, isIOSDevice } from '../utils/push';

/**
 * Shared enable/disable push control for all roles (employee, HR, admin).
 * Send Test appears only once right after enabling, then hides after use.
 */
const EnablePushNotificationsButton = () => {
  const {
    isSupported,
    isSubscribed,
    isLoading,
    error,
    mobileGuidance,
    subscribe,
    unsubscribe,
    requestPermission,
    sendTestNotification,
  } = usePushNotification();

  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  /** Show Send Test only after a fresh enable in this session; hide after test is used. */
  const [showTestOnce, setShowTestOnce] = useState(false);
  const onMobile = isLikelyMobileDevice();

  const handleEnable = async () => {
    setBusy(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        toast.error('Notification permission denied. Enable it in browser settings for this site.');
        return;
      }
      await subscribe();
      setShowTestOnce(true);
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
      setShowTestOnce(false);
      toast.success('Notifications disabled on this device');
    } catch (err) {
      toast.error(err.message || 'Failed to disable notifications');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await sendTestNotification();
      const devices = result?.devices || [];
      const mobile = devices.filter((d) => d.device === 'mobile');
      const mobileOk = mobile.filter((d) => d.status === 'sent').length;
      if (result?.sent > 0) {
        const mobileHint =
          mobile.length > 0
            ? ` (mobile ${mobileOk}/${mobile.length})`
            : onMobile
              ? ' — if you do not see it, check phone notification settings for Chrome/Safari'
              : '';
        toast.success(`Test notification sent${mobileHint}`);
      } else {
        toast.error(result?.message || 'Test push did not reach any device');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send test notification');
    } finally {
      setTesting(false);
      // Hide after check (success or failure) so it does not stay on the UI
      setShowTestOnce(false);
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
          {(error || mobileGuidance) && (
            <p className="text-xs text-red-600 mt-1">{error || mobileGuidance}</p>
          )}
          {onMobile && !error && !mobileGuidance && (
            <p className="text-xs text-gray-500 mt-1">
              {isIOSDevice()
                ? 'iPhone: open from the Home Screen app after Add to Home Screen.'
                : 'Android: use Chrome, allow notifications, and set battery usage to Unrestricted for Chrome.'}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          {!isSubscribed ? (
            <button
              type="button"
              onClick={handleEnable}
              disabled={busy || Boolean(error)}
              className="px-4 py-2 text-sm font-medium text-white rounded-md bg-theme-primary hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {busy ? 'Enabling…' : 'Enable Notifications'}
            </button>
          ) : (
            <>
              {showTestOnce && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || busy}
                  className="px-4 py-2 text-sm font-medium text-white rounded-md bg-theme-primary hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {testing ? 'Sending…' : 'Send Test'}
                </button>
              )}
              <button
                type="button"
                onClick={handleDisable}
                disabled={busy}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              >
                {busy ? 'Disabling…' : 'Disable Notifications'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnablePushNotificationsButton;
