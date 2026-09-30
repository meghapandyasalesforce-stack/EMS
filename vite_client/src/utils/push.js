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
 * @param {ServiceWorkerRegistration} registration
 * @param {string} vapidPublicKey
 * @param {{ forceNew?: boolean }} [options] - forceNew recreates the endpoint (useful on mobile)
 */
export async function ensurePushSubscription(registration, vapidPublicKey, options = {}) {
  const { forceNew = false } = options;
  let subscription = await registration.pushManager.getSubscription();
  const keyBytes = urlBase64ToUint8Array(vapidPublicKey);

  if (subscription && (forceNew || !applicationServerKeysMatch(subscription, vapidPublicKey))) {
    try {
      await subscription.unsubscribe();
    } catch {
      // ignore — create a fresh subscription below
    }
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

export function isLikelyMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  return false;
}

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Mobile / iOS guidance for web push. iOS only delivers push from a Home Screen PWA.
 */
export function getMobilePushGuidance() {
  if (typeof window === 'undefined') {
    return { ok: true, message: null };
  }
  if (!window.isSecureContext) {
    return {
      ok: false,
      message: 'Push needs HTTPS. Open the app via a secure link (not plain http).',
    };
  }
  if (isIOSDevice() && !isStandalonePwa()) {
    return {
      ok: false,
      message:
        'On iPhone/iPad: tap Share → Add to Home Screen, open Paarsiv from the home icon, then enable notifications.',
    };
  }
  return { ok: true, message: null };
}

/**
 * Safely obtain a ServiceWorkerRegistration without hanging indefinitely
 */
export async function getServiceWorkerRegistration(timeoutMs = 3000) {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  // Mobile / ngrok is slower — give the SW more time to activate
  const waitMs = isLikelyMobileDevice() ? Math.max(timeoutMs, 10000) : timeoutMs;

  try {
    // Prefer an already-controlling / ready SW (Vite PWA / production sw.js)
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve(null), waitMs)
    );
    let reg = await Promise.race([readyPromise, timeoutPromise]);

    if (!reg) {
      reg = await navigator.serviceWorker.getRegistration();
    }

    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (err) {
        // Ignored if service worker cannot be registered (e.g. missing sw.js)
      }
    }

    if (reg?.active) {
      return reg;
    }

    if (reg?.installing || reg?.waiting) {
      const activated = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), waitMs)),
      ]);
      return activated || reg;
    }

    return reg || null;
  } catch (err) {
    return null;
  }
}

/**
 * Subscribe user to push notifications
 */
export async function subscribeUser() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const guidance = getMobilePushGuidance();
  if (!guidance.ok) {
    throw new Error(guidance.message);
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied');
  }

  const { data: keyData } = await axios.get(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/vapid-public-key`);
  if (!keyData?.success || !keyData?.publicKey) {
    throw new Error('Push notifications not configured on server');
  }

  const registration = await getServiceWorkerRegistration(4000);
  if (!registration) {
    throw new Error('Service worker is not active or available in this browser');
  }

  // Always create a fresh endpoint on explicit Enable so a stale browser
  // subscription cannot leave the UI "on" while the server cannot deliver.
  const subscription = await ensurePushSubscription(registration, keyData.publicKey, {
    forceNew: true,
  });
  await saveSubscriptionToServer(subscription);
  markPushSubscriptionRefreshed();

  return subscription;
}

const PUSH_REFRESH_STORAGE_KEY = 'ems_push_subscription_refreshed_at';
/** Overnight gap: an open tab heals on return once this age is reached. */
const PUSH_REFRESH_INTERVAL_MS = 8 * 60 * 60 * 1000;
/** One fresh endpoint per page load — same result as Disable then Enable. */
let healedThisPageLoad = false;

function shouldForceDailyPushRefresh() {
  try {
    const last = Number(localStorage.getItem(PUSH_REFRESH_STORAGE_KEY) || '0');
    if (!Number.isFinite(last) || last <= 0) return true;
    return Date.now() - last >= PUSH_REFRESH_INTERVAL_MS;
  } catch {
    return false;
  }
}

function markPushSubscriptionRefreshed() {
  healedThisPageLoad = true;
  try {
    localStorage.setItem(PUSH_REFRESH_STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore quota / private mode
  }
}

/** Call after an explicit Enable that created a fresh endpoint. */
export function notePushSubscriptionRefreshed() {
  markPushSubscriptionRefreshed();
}

let syncPushInFlight = null;

/**
 * If permission is already granted, re-sync this device's subscription with the server.
 * First sync on each page load recreates the endpoint (the working Disable → Enable path).
 * Later calls in the same load keep that endpoint unless it is missing on the server
 * or older than the refresh window.
 */
export async function syncPushSubscriptionIfGranted() {
  if (syncPushInFlight) {
    return syncPushInFlight;
  }

  syncPushInFlight = (async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null;
    }

    try {
      const registration = await getServiceWorkerRegistration(2500);
      if (!registration || !registration.pushManager) {
        return null;
      }

      const { data: keyData } = await axios.get(`${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/vapid-public-key`);
      if (!keyData?.success || !keyData?.publicKey) {
        return null;
      }

      const existing = await registration.pushManager.getSubscription();

      let endpointOnServer = false;
      if (existing) {
        try {
          const { data: status } = await axios.get(
            `${BOTH_PUSH_SUBSCRIPTION_ENDPOINT}/push-subscription-status`
          );
          const endpoints = (status?.subscriptions || []).map((s) => s.endpoint).filter(Boolean);
          endpointOnServer = endpoints.includes(existing.endpoint);
        } catch {
          // If status check fails, don't drop a working endpoint on later calls.
          endpointOnServer = true;
        }
      }

      const forceNew =
        !existing ||
        !healedThisPageLoad ||
        !endpointOnServer ||
        shouldForceDailyPushRefresh();

      const subscription = await ensurePushSubscription(registration, keyData.publicKey, {
        forceNew,
      });

      if (!subscription) {
        return null;
      }
      // Must succeed on the server — otherwise UI would show "enabled" while pushes cannot be delivered
      await saveSubscriptionToServer(subscription);
      if (forceNew) {
        markPushSubscriptionRefreshed();
        healedThisPageLoad = true;
      }
      return subscription;
    } catch {
      return null;
    }
  })().finally(() => {
    syncPushInFlight = null;
  });

  return syncPushInFlight;
}

/**
 * Keep a granted subscription fresh while the app stays open (no reload).
 * Runs once after login, again when the tab is shown after the refresh window,
 * and once when that window ends.
 */
export function installPushSubscriptionKeepAlive() {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  let timer = null;
  let boot = null;
  let stopped = false;

  const runIfDue = () => {
    if (stopped) return;
    if (document.visibilityState === 'hidden') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (healedThisPageLoad && !shouldForceDailyPushRefresh()) return;
    syncPushSubscriptionIfGranted().catch(() => {});
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    if (stopped) return;
    let delay = PUSH_REFRESH_INTERVAL_MS;
    try {
      const last = Number(localStorage.getItem(PUSH_REFRESH_STORAGE_KEY) || '0');
      if (Number.isFinite(last) && last > 0) {
        delay = Math.max(1000, PUSH_REFRESH_INTERVAL_MS - (Date.now() - last));
      } else {
        delay = PUSH_REFRESH_INTERVAL_MS;
      }
    } catch {
      delay = PUSH_REFRESH_INTERVAL_MS;
    }
    timer = setTimeout(async () => {
      if (!stopped && document.visibilityState !== 'hidden' && shouldForceDailyPushRefresh()) {
        await syncPushSubscriptionIfGranted().catch(() => {});
      }
      schedule();
    }, delay);
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') runIfDue();
  };

  document.addEventListener('visibilitychange', onVisible);
  schedule();
  // Heal on open even when this page is not the dashboard and the user does not reload later.
  boot = setTimeout(() => {
    runIfDue();
  }, 1500);

  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    if (timer) clearTimeout(timer);
    if (boot) clearTimeout(boot);
  };
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

