import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../utils/axios.js';

/**
 * Hook to manage browser permissions (Location, Camera, Notifications)
 * Similar to mobile app permission handling
 */
export const usePermissions = () => {
  const [permissions, setPermissions] = useState({
    location: { status: 'prompt', supported: false },
    camera: { status: 'prompt', supported: false },
    notifications: { status: 'prompt', supported: false }
  });
  const [isChecking, setIsChecking] = useState(true);

  // Check if browser supports permissions API
  const checkSupport = useCallback(() => {
    return {
      location: 'geolocation' in navigator,
      camera: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
      notifications: 'Notification' in window,
      push: 'serviceWorker' in navigator && 'PushManager' in window
    };
  }, []);

  // Check location permission status
  const checkLocationPermission = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      return 'not-supported';
    }

    // Try Permissions API first (more reliable, Chrome/Edge support it)
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state; // 'granted', 'denied', or 'prompt'
      } catch (err) {
        // Permissions API not supported or failed, fall back to geolocation check
      }
    }

    // Fallback: Use geolocation API with longer timeout
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('prompt'); // If timeout, assume prompt state (permission not yet requested)
      }, 3000); // Increased to 3 seconds

      navigator.geolocation.getCurrentPosition(
        () => {
          clearTimeout(timeout);
          resolve('granted');
        },
        (error) => {
          clearTimeout(timeout);
          if (error.code === error.PERMISSION_DENIED || error.code === 1) {
            resolve('denied');
          } else {
            // Other errors (timeout, position unavailable) mean prompt state
            resolve('prompt');
          }
        },
        { timeout: 2000, maximumAge: 60000 } // 2 second timeout, allow cached position up to 1 minute
      );
    });
  }, []);

  // Check camera permission status
  const checkCameraPermission = useCallback(async () => {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
      return 'not-supported';
    }

    try {
      // Try to query permission (if supported)
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state; // 'granted', 'denied', or 'prompt'
      }
      
      // Fallback: try to access camera with very short timeout
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ video: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
      ]);
      
      // If successful, stop the stream immediately
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        return 'granted';
      }
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return 'denied';
      }
      return 'prompt';
    }
    
    return 'prompt';
  }, []);

  // Check notification permission status
  const checkNotificationPermission = useCallback(() => {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission; // 'granted', 'denied', or 'default' (prompt)
  }, []);

  // Check all permissions
  const checkAllPermissions = useCallback(async () => {
    setIsChecking(true);
    const support = checkSupport();

    const [locationStatus, cameraStatus] = await Promise.all([
      support.location ? checkLocationPermission() : Promise.resolve('not-supported'),
      support.camera ? checkCameraPermission() : Promise.resolve('not-supported')
    ]);

    const notificationStatus = support.notifications 
      ? checkNotificationPermission() 
      : 'not-supported';

    setPermissions({
      location: {
        status: locationStatus === 'default' ? 'prompt' : locationStatus,
        supported: support.location
      },
      camera: {
        status: cameraStatus,
        supported: support.camera
      },
      notifications: {
        status: notificationStatus === 'default' ? 'prompt' : notificationStatus,
        supported: support.notifications
      }
    });

    setIsChecking(false);
  }, [checkSupport, checkLocationPermission, checkCameraPermission, checkNotificationPermission]);

  // Request location permission
  const requestLocationPermission = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      throw new Error('Geolocation is not supported by this browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Save permission status to backend
          // SECURITY FIX: Tokens are in httpOnly cookies, sent automatically via axios
          try {
            await axiosInstance.put('/v1/both/profile-details/update-location-permission', {
              status: 'granted'
            });
          } catch (err) {
            // Silently fail - permission tracking is not critical
          }
          
          resolve({ granted: true, position });
        },
        async (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            // Save denied status
            // SECURITY FIX: Tokens are in httpOnly cookies, sent automatically via axios
            try {
              await axiosInstance.put('/v1/both/profile-details/update-location-permission', {
                status: 'denied'
              });
            } catch (err) {
              // Silently fail - permission tracking is not critical
            }
            resolve({ granted: false, error: 'Permission denied' });
          } else {
            reject(error);
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  // Request camera permission
  const requestCameraPermission = useCallback(async () => {
    if (!('mediaDevices' in navigator) || !('getUserMedia' in navigator.mediaDevices)) {
      throw new Error('Camera is not supported by this browser');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return { granted: false, error: 'Permission denied' };
      }
      throw error;
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      throw new Error('Notifications are not supported by this browser');
    }

    if (Notification.permission === 'granted') {
      return { granted: true };
    }

    if (Notification.permission === 'denied') {
      return { granted: false, error: 'Permission denied. Please enable in browser settings.' };
    }

    const permission = await Notification.requestPermission();
    return { granted: permission === 'granted' };
  }, []);

  // Get permission status helper
  const getPermissionStatus = useCallback((type) => {
    return permissions[type]?.status || 'prompt';
  }, [permissions]);

  // Check if permission is granted
  const isPermissionGranted = useCallback((type) => {
    return getPermissionStatus(type) === 'granted';
  }, [getPermissionStatus]);

  // Check if permission is denied
  const isPermissionDenied = useCallback((type) => {
    return getPermissionStatus(type) === 'denied';
  }, [getPermissionStatus]);

  // Get instructions for enabling denied permissions
  const getPermissionInstructions = useCallback((type) => {
    const instructions = {
      location: {
        title: 'Enable Location Permission',
        steps: [
          'Click the lock icon (🔒) or info icon (ℹ️) in your browser\'s address bar',
          'Find "Location" in the permissions list',
          'Change it from "Block" to "Allow"',
          'Refresh the page'
        ],
        chrome: 'Settings → Privacy and security → Site settings → Location → Allow',
        firefox: 'Options → Privacy & Security → Permissions → Location → Settings',
        edge: 'Settings → Cookies and site permissions → Location → Allow'
      },
      camera: {
        title: 'Enable Camera Permission',
        steps: [
          'Click the lock icon (🔒) or camera icon (📷) in your browser\'s address bar',
          'Find "Camera" in the permissions list',
          'Change it from "Block" to "Allow"',
          'Refresh the page'
        ],
        chrome: 'Settings → Privacy and security → Site settings → Camera → Allow',
        firefox: 'Options → Privacy & Security → Permissions → Camera → Settings',
        edge: 'Settings → Cookies and site permissions → Camera → Allow'
      },
      notifications: {
        title: 'Enable Notification Permission',
        steps: [
          'Click the lock icon (🔒) or notification icon (🔔) in your browser\'s address bar',
          'Find "Notifications" in the permissions list',
          'Change it from "Block" to "Allow"',
          'Refresh the page'
        ],
        chrome: 'Settings → Privacy and security → Site settings → Notifications → Allow',
        firefox: 'Options → Privacy & Security → Permissions → Notifications → Settings',
        edge: 'Settings → Cookies and site permissions → Notifications → Allow'
      }
    };

    return instructions[type] || null;
  }, []);

  // Initialize on mount
  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  return {
    permissions,
    isChecking,
    checkAllPermissions,
    requestLocationPermission,
    requestCameraPermission,
    requestNotificationPermission,
    getPermissionStatus,
    isPermissionGranted,
    isPermissionDenied,
    getPermissionInstructions,
    checkSupport: checkSupport()
  };
};

