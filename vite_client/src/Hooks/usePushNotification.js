import { useEffect, useState, useCallback } from 'react';
import axios from '../utils/axios';
import { BOTH_NOTIFICATION_ENDPOINT } from '../utils/constant';

/**
 * Hook to manage push notifications
 * Handles subscription, unsubscription, and service worker registration
 */
export const usePushNotification = () => {
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper: Convert base64 URL to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
  };

  // Helper: Convert ArrayBuffer to base64
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary);
  };

  // Initialize push notifications
  const initializePush = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);

      // Register service worker
      let registration;
      try {
        registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
      } catch (swError) {
        console.error('Service Worker registration failed:', swError);
        setError('Failed to register service worker');
        setIsLoading(false);
        return;
      }

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      let vapidPublicKey;
      try {
        const { data } = await axios.get(`${BOTH_NOTIFICATION_ENDPOINT}/vapid-public-key`);
        if (!data.success || !data.publicKey) {
          throw new Error('VAPID public key not available');
        }
        vapidPublicKey = data.publicKey;
      } catch (keyError) {
        console.error('Failed to get VAPID public key:', keyError);
        setError('Push notifications not configured on server');
        setIsLoading(false);
        return;
      }

      // Check existing subscription
      let sub = await registration.pushManager.getSubscription();
      
      if (!sub) {
        // Create new subscription
        try {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });
        } catch (subscribeError) {
          console.error('Failed to subscribe to push:', subscribeError);
          setError('Failed to subscribe to push notifications');
          setIsLoading(false);
          return;
        }
      }

      // Send subscription to server
      try {
        await axios.post(`${BOTH_NOTIFICATION_ENDPOINT}/push-subscribe`, {
          subscription: {
            endpoint: sub.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
              auth: arrayBufferToBase64(sub.getKey('auth'))
            }
          }
        });

        setSubscription(sub);
        setIsSubscribed(true);
      } catch (serverError) {
        console.error('Failed to save subscription to server:', serverError);
        setError('Failed to save subscription');
        // Don't set isSubscribed to false here, as the subscription exists locally
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      setError(error.message || 'Failed to initialize push notifications');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe();
        
        // Remove from server
        try {
          await axios.post(`${BOTH_NOTIFICATION_ENDPOINT}/push-unsubscribe`, {
            endpoint: subscription.endpoint
          });
        } catch (serverError) {
          console.error('Failed to remove subscription from server:', serverError);
        }

        setSubscription(null);
        setIsSubscribed(false);
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setError(error.message || 'Failed to unsubscribe');
    }
  }, [subscription]);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      setError('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      setError('Notification permission denied. Please enable it in browser settings.');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // Don't auto-initialize on mount - wait for user to enable in settings
  // This prevents automatic permission requests on page load
  useEffect(() => {
    setIsLoading(false);
  }, []);

  return {
    subscription,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe: initializePush,
    unsubscribe,
    requestPermission
  };
};

