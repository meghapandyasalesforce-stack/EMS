const STORAGE_KEY = 'ems.initialDashboardSession';
let memorySession = null;

function newSession() {
  return { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, users: {} };
}

function writeSession(session) {
  memorySession = session;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage restrictions must not cause repeated redirects in this page lifecycle.
  }
}

function readSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (session?.id && session.users && typeof session.users === 'object' && !Array.isArray(session.users)) {
      memorySession = session;
      return session;
    }
    // A cleared browser session must not inherit the previous in-memory flag.
    memorySession = null;
  } catch {
    // Keep a memory fallback when browser storage is unavailable.
  }
  return memorySession;
}

export function dashboardSessionUserKey(user) {
  const id = user?._id ?? user?.id;
  if (!id) return null;
  const organization = user.organizationId?._id ?? user.organizationId ?? '';
  return JSON.stringify([String(organization), String(id)]);
}

/** Call only after a successful login, never during session restoration or profile updates. */
export function beginDashboardSession() {
  writeSession(newSession());
}

export function endDashboardSession() {
  memorySession = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Logout still proceeds when storage is unavailable.
  }
}

export function hasInitialDashboardRedirect(user) {
  const key = dashboardSessionUserKey(user);
  return Boolean(key && readSession()?.users[key]);
}

export function markInitialDashboardRedirect(user) {
  const key = dashboardSessionUserKey(user);
  if (!key) return;
  const session = readSession() || newSession();
  session.users[key] = true;
  writeSession(session);
}
