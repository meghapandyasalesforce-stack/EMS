import React, { useState, useEffect } from 'react';
import { usePermissions } from '../Hooks/usePermissions';
import PermissionRequestDialog from './PermissionRequestDialog';
import {
  subscribeUser,
  isPushNotificationSupported,
  getNotificationPermission,
  syncPushSubscriptionIfGranted,
} from '../utils/push';
import { toast } from 'react-toastify';

const FirstLoginPermissionRequest = ({ user, onComplete }) => {
  const { isPermissionGranted, isPermissionDenied, checkAllPermissions } = usePermissions();
  const [showDialog, setShowDialog] = useState(false);
  const [showPushNotification, setShowPushNotification] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const locationShownKey = `permissions_shown_${user._id || user.email}`;
    const pushShownKey = `push_prompt_shown_${user._id || user.email}`;
    const hasShownLocation = localStorage.getItem(locationShownKey) === 'true';
    const hasShownPush = localStorage.getItem(pushShownKey) === 'true';

    const pushSupported = isPushNotificationSupported();
    const notificationPermission = getNotificationPermission();
    const needsPushPermission = pushSupported && notificationPermission === 'default';

    const timer = setTimeout(() => {
      checkAllPermissions().then(() => {
        const needsLocation = user.role === 'employee' || user.role === 'admin';
        const locationNotGranted = !isPermissionGranted('location');
        const locationNotDenied = !isPermissionDenied('location');

        if (!hasShownLocation && needsLocation && locationNotGranted && locationNotDenied) {
          setShowDialog(true);
        }

        // Device-specific: show push prompt when permission not decided yet
        if (needsPushPermission && !hasShownPush) {
          setShowPushNotification(true);
        }

        // Already granted on this device — ensure subscription is saved for this user
        if (pushSupported && notificationPermission === 'granted') {
          syncPushSubscriptionIfGranted().catch(() => {});
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [user, isPermissionGranted, isPermissionDenied, checkAllPermissions]);

  const handlePermissionsGranted = () => {
    if (user) {
      const locationShownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(locationShownKey, 'true');
    }
    setShowDialog(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleClose = () => {
    if (user) {
      const locationShownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(locationShownKey, 'true');
    }
    setShowDialog(false);
  };

  const handleEnableNotifications = async () => {
    if (!user || !user._id) {
      toast.error('User information not available');
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeUser();
      toast.success('Notifications enabled successfully!');
      setShowPushNotification(false);

      const pushShownKey = `push_prompt_shown_${user._id || user.email}`;
      localStorage.setItem(pushShownKey, 'true');
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      toast.error(error.message || 'Failed to enable notifications. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismissPushNotification = () => {
    setShowPushNotification(false);
    if (user) {
      const pushShownKey = `push_prompt_shown_${user._id || user.email}`;
      localStorage.setItem(pushShownKey, 'true');
    }
  };

  if (!showDialog && !showPushNotification) return null;

  return (
    <>
      {showDialog && (
        <PermissionRequestDialog
          isOpen={showDialog}
          onClose={handleClose}
          requestedPermissions={['location', 'camera']}
          onPermissionsGranted={handlePermissionsGranted}
          canClose={true}
        />
      )}

      {showPushNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Enable Notifications</h2>
            <p className="mb-4 text-gray-600">
              Stay updated with important alerts, leave approvals, and attendance reminders by enabling push notifications on this device.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleEnableNotifications}
                disabled={isSubscribing}
                className="flex-1 py-2 text-white rounded-md transition-colors bg-theme-primary hover:opacity-90 disabled:opacity-70 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isSubscribing ? 'Enabling...' : 'Enable Notifications'}
              </button>
              <button
                onClick={handleDismissPushNotification}
                className="flex-1 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FirstLoginPermissionRequest;
