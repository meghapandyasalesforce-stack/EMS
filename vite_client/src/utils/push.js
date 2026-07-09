/**
 * Web Push Notification Utility
 * Handles service worker registration and push notification subscription
 */

import axios from './axios';
import { BOTH_PUSH_SUBSCRIPTION_ENDPOINT } from './constant';

/**
 * Convert base64 string to Uint8Array for VAPID key
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

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const { data: keyData } = await axios.get(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/vapid-public-key`);
  if (!keyData.success || !keyData.publicKey) {
    throw new Error('Push notifications not configured on server');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
  }

  await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-subscribe`, {
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      },
    },
  });

  return subscription;
}

export async function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
