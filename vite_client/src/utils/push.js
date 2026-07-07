/**
 * Web Push Notification Utility
 * Handles service worker registration and push notification subscription
 */

/**
 * Convert base64 string to Uint8Array for VAPID key
 * @param {string} base64String - Base64 encoded string
 * @returns {Uint8Array} - Converted Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

/**
 * Subscribe user to push notifications
 * @param {string} userId - Current logged-in user ID
 * @returns {Promise<void>}
 */
export async function subscribeUser(userId) {
  if (!userId) {
    console.error('User ID is required for push notification subscription');
    return;
  }

  // Check if browser supports service worker and push manager
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.error('Push notifications are not supported in this browser');
    return;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }

    // Get VAPID public key from environment variable
    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey || vapidPublicKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
      console.error('VAPID public key is not configured in .env file');
      return;
    }

    // Convert VAPID key to Uint8Array
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });

    // Send subscription to backend
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        userId: userId,
        subscription: subscription
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to server');
    }

    const data = await response.json();
    console.log('Push notification subscription successful:', data);
    
    return data;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error;
  }
}

/**
 * Check if user is already subscribed to push notifications
 * @returns {Promise<boolean>}
 */
export async function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Get current notification permission status
 * @returns {NotificationPermission}
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
