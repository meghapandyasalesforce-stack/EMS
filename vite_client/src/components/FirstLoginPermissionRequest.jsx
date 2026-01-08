import React, { useState, useEffect } from 'react';
import { usePermissions } from '../Hooks/usePermissions';
import PermissionRequestDialog from './PermissionRequestDialog';

const FirstLoginPermissionRequest = ({ user, onComplete }) => {
  const { isPermissionGranted, isPermissionDenied, checkAllPermissions } = usePermissions();
  const [showDialog, setShowDialog] = useState(false);
  const [hasShownBefore, setHasShownBefore] = useState(false);

  useEffect(() => {
    // Check if user just logged in and hasn't seen permission dialog before
    if (!user) return;

    // Check localStorage to see if we've shown this before
    const shownKey = `permissions_shown_${user._id || user.email}`;
    const hasShown = localStorage.getItem(shownKey) === 'true';
    
    setHasShownBefore(hasShown);

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

  if (!showDialog || hasShownBefore) return null;

  return (
    <PermissionRequestDialog
      isOpen={showDialog}
      onClose={handleClose}
      requestedPermissions={['location', 'camera']} // Request both location and camera
      onPermissionsGranted={handlePermissionsGranted}
      canClose={true} // Allow closing, but mark as shown
    />
  );
};

export default FirstLoginPermissionRequest;

