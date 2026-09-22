import { useEffect, useState, useCallback } from 'react';
import axios from '../utils/axios';
import { BOTH_PUSH_SUBSCRIPTION_ENDPOINT } from '../utils/constant';
import logger from '../utils/logger.js';
import {
  ensurePushSubscription,
  saveSubscriptionToServer,
  syncPushSubscriptionIfGranted,
  getServiceWorkerRegistration,
  getMobilePushGuidance,
  isLikelyMobileDevice,
} from '../utils/push';

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
  const [mobileGuidance, setMobileGuidance] = useState(null);

  // Initialize push notifications
  const initializePush = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      const guidance = getMobilePushGuidance();
      setMobileGuidance(guidance.message);
      if (!guidance.ok) {
        setIsSupported(true);
        setError(guidance.message);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);

      let registration;
      try {
        registration = await getServiceWorkerRegistration(4000);
      } catch (swError) {
        logger.error('Service Worker registration failed', swError);
        setError('Failed to register service worker');
        setIsLoading(false);
        return;
      }

      if (!registration) {
        setError('Service worker not available or active');
        setIsLoading(false);
        return;
      }

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

      let sub;
      try {
        sub = await ensurePushSubscription(registration, vapidPublicKey, {
          forceNew: isLikelyMobileDevice(),
        });
      } catch (subscribeError) {
        logger.error('Failed to subscribe to push', subscribeError);
        setError('Failed to subscribe to push notifications');
        setIsLoading(false);
        return;
      }

      try {
        await saveSubscriptionToServer(sub);
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

  const unsubscribe = useCallback(async () => {
    try {
      if (subscription) {
        await subscription.unsubscribe();

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

      const guidance = getMobilePushGuidance();
      setMobileGuidance(guidance.message);
      if (!guidance.ok) {
        setError(guidance.message);
        setIsLoading(false);
        return;
      }

      try {
        // Re-sync local subscription to the server when permission is already granted.
        // Only mark subscribed if the server save succeeds (avoids "enabled" with no delivery).
        const sub = await syncPushSubscriptionIfGranted();
        if (sub) {
          setSubscription(sub);
          setIsSubscribed(true);
        } else {
          setSubscription(null);
          setIsSubscribed(false);
        }
      } catch (err) {
        logger.error('Failed to restore push subscription', err);
        setSubscription(null);
        setIsSubscribed(false);
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
    mobileGuidance,
    subscribe: initializePush,
    unsubscribe,
    requestPermission,
    sendTestNotification,
  };
};
