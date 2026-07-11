import React, { useState, useEffect } from 'react';
import { usePermissions } from '../Hooks/usePermissions';
import PermissionRequestDialog from './PermissionRequestDialog';
import { subscribeUser, isPushNotificationSupported, getNotificationPermission } from '../utils/push';
import { toast } from 'react-toastify';

const FirstLoginPermissionRequest = ({ user, onComplete }) => {
  const { isPermissionGranted, isPermissionDenied, checkAllPermissions } = usePermissions();
  const [showDialog, setShowDialog] = useState(false);
  const [hasShownBefore, setHasShownBefore] = useState(false);
  const [showPushNotification, setShowPushNotification] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    // Check if user just logged in and hasn't seen permission dialog before
    if (!user) return;

    // Check localStorage to see if we've shown this before
    const shownKey = `permissions_shown_${user._id || user.email}`;
    const hasShown = localStorage.getItem(shownKey) === 'true';
    
    setHasShownBefore(hasShown);

    // Check if push notifications are supported and not already granted
    const pushSupported = isPushNotificationSupported();
    const notificationPermission = getNotificationPermission();
    const needsPushPermission = pushSupported && notificationPermission === 'default';

    // Wait a bit for permissions to be checked, then show dialog if needed
    const timer = setTimeout(() => {
      checkAllPermissions().then(() => {
        // Show dialog if:
        // 1. User hasn't seen it before
        // 2. Location permission is not granted and not denied (prompt state)
        // 3. User is an employee (they need location for attendance)
        const needsLocation = user.role === 'employee' || user.role === 'admin';
        const locationNotGranted = !isPermissionGranted('location');
        const locationNotDenied = !isPermissionDenied('location');

        if (!hasShown && needsLocation && locationNotGranted && locationNotDenied) {
          setShowDialog(true);
        }

        // Show push notification option if needed
        if (needsPushPermission && !hasShown) {
          setShowPushNotification(true);
        }
      });
    }, 1500); // Wait 1.5 seconds after login

    return () => clearTimeout(timer);
  }, [user, isPermissionGranted, isPermissionDenied, checkAllPermissions]);

  const handlePermissionsGranted = () => {
    // Mark as shown for this user
    if (user) {
      const shownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(shownKey, 'true');
    }
    setShowDialog(false);
    if (onComplete) {
      onComplete();
    }
  };

  const handleClose = () => {
    // Mark as shown even if user closes without granting
    if (user) {
      const shownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(shownKey, 'true');
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
      
      // Mark as shown for this user
      const shownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(shownKey, 'true');
    } catch (error) {
      console.error('Failed to enable notifications:', error);
      toast.error('Failed to enable notifications. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismissPushNotification = () => {
    setShowPushNotification(false);
    // Mark as shown even if user dismisses
    if (user) {
      const shownKey = `permissions_shown_${user._id || user.email}`;
      localStorage.setItem(shownKey, 'true');
    }
  };

  if (!showDialog && !showPushNotification) return null;

  return (
    <>
      {/* Existing permission dialog for location/camera */}
      {showDialog && (
        <PermissionRequestDialog
          isOpen={showDialog}
          onClose={handleClose}
          requestedPermissions={['location', 'camera']} // Request both location and camera
          onPermissionsGranted={handlePermissionsGranted}
          canClose={true} // Allow closing, but mark as shown
        />
      )}

      {/* Push notification enable prompt */}
      {showPushNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Enable Notifications</h2>
            <p className="mb-4 text-gray-600">
              Stay updated with important alerts, leave approvals, and attendance reminders by enabling push notifications.
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

