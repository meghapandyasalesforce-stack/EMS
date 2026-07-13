/**
 * Web Push Notification Utility
 * Handles service worker registration and push notification subscription
 */

import axios from './axios';
import { BOTH_PUSH_SUBSCRIPTION_ENDPOINT } from './constant';

/**
 * Convert base64 string to Uint8Array for VAPID key
 */
export function urlBase64ToUint8Array(base64String) {
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

export function arrayBufferToBase64(buffer) {
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

function applicationServerKeysMatch(subscription, vapidPublicKey) {
  try {
    const existingKey = subscription?.options?.applicationServerKey;
    if (!existingKey) return true; // Can't compare — keep existing subscription
    const expected = urlBase64ToUint8Array(vapidPublicKey);
    const actual = existingKey instanceof ArrayBuffer
      ? new Uint8Array(existingKey)
      : new Uint8Array(existingKey);
    if (actual.byteLength !== expected.byteLength) return false;
    return actual.every((byte, i) => byte === expected[i]);
  } catch {
    return true;
  }
}

/**
 * Ensure a PushManager subscription matches the current server VAPID key
 */
export async function ensurePushSubscription(registration, vapidPublicKey) {
  let subscription = await registration.pushManager.getSubscription();
  const keyBytes = urlBase64ToUint8Array(vapidPublicKey);

  if (subscription && !applicationServerKeysMatch(subscription, vapidPublicKey)) {
    await subscription.unsubscribe();
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes,
    });
  }

  return subscription;
}

export async function saveSubscriptionToServer(subscription) {
  await axios.post(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-subscribe`, {
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      },
    },
  });
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
  const subscription = await ensurePushSubscription(registration, keyData.publicKey);
  await saveSubscriptionToServer(subscription);

  return subscription;
}

/**
 * If permission is already granted, re-sync this device's subscription with the server.
 * Safe to call on every login / page load.
 */
export async function syncPushSubscriptionIfGranted() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const { data: keyData } = await axios.get(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/vapid-public-key`);
    if (!keyData.success || !keyData.publicKey) {
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await ensurePushSubscription(registration, keyData.publicKey);
    await saveSubscriptionToServer(subscription);
    return subscription;
  } catch {
    return null;
  }
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
