import { useEffect, useState, useCallback } from 'react';
import axios from '../utils/axios';
import { BOTH_PUSH_SUBSCRIPTION_ENDPOINT } from '../utils/constant';
import logger from '../utils/logger.js';

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

  // Helper: Convert ArrayBuffer to base64url (Web Push standard)
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(byte => binary += String.fromCharCode(byte));
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
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

      // Get service worker registration (VitePWA registers it automatically)
      let registration;
      try {
        // Wait for any existing service worker to be ready
        if (navigator.serviceWorker.controller) {
          registration = await navigator.serviceWorker.ready;
        } else {
          // Wait a bit for VitePWA to register, then get registration
          await new Promise(resolve => setTimeout(resolve, 100));
          registration = await navigator.serviceWorker.ready;
        }
      } catch (swError) {
        logger.error('Service Worker registration failed', swError);
        setError('Failed to register service worker');
        setIsLoading(false);
        return;
      }

      if (!registration) {
        setError('Service worker not available');
        setIsLoading(false);
        return;
      }

      // Get VAPID public key from server
      let vapidPublicKey;
      try {
        const { data } = await axios.get(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/vapid-public-key`);
        if (!data.success || !data.publicKey) {
          throw new Error('VAPID public key not available');
        }
        vapidPublicKey = data.publicKey;
      } catch (keyError) {
        logger.error('Failed to get VAPID public key', keyError);
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
          logger.error('Failed to subscribe to push', subscribeError);
          setError('Failed to subscribe to push notifications');
          setIsLoading(false);
          return;
        }
      }

      // Send subscription to server
      try {
        await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-subscribe`, {
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
        logger.error('Failed to save subscription to server', serverError);
        setError('Failed to save subscription to server. Please try again.');
        setSubscription(sub);
        setIsSubscribed(false);
      }
    } catch (error) {
      logger.error('Error initializing push notifications', error);
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
          await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-unsubscribe`, {
            endpoint: subscription.endpoint
          });
        } catch (serverError) {
          logger.error('Failed to remove subscription from server', serverError);
        }

        setSubscription(null);
        setIsSubscribed(false);
      }
    } catch (error) {
      logger.error('Error unsubscribing', error);
      setError(error.message || 'Failed to unsubscribe');
    }
  }, [subscription]);

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

  const sendTestNotification = useCallback(async () => {
    try {
      const { data } = await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/test-push`);
      return data;
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Failed to send test push';
      throw new Error(message);
    }
  }, []);

  // Detect browser support on mount without requesting permission
   // Detect browser support and restore existing subscription on mount
   useEffect(() => {
    const init = async () => {
      const supported =
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window;

      setIsSupported(supported);

      if (!supported) {
        setError('Push notifications are not supported in this browser or context.');
        setIsLoading(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();

        if (existingSub && Notification.permission === 'granted') {
          setSubscription(existingSub);
          setIsSubscribed(true);

          // Re-sync subscription with backend after page reload
          try {
            await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-subscribe`, {
              subscription: {
                endpoint: existingSub.endpoint,
                keys: {
                  p256dh: arrayBufferToBase64(existingSub.getKey('p256dh')),
                  auth: arrayBufferToBase64(existingSub.getKey('auth'))
                }
              }
            });
          } catch (syncError) {
            logger.error('Failed to re-sync push subscription with server', syncError);
          }
        }
      } catch (err) {
        logger.error('Failed to restore push subscription', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  return {
    subscription,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe: initializePush,
    unsubscribe,
    requestPermission,
    sendTestNotification,
  };
};

