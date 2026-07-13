/**
 * Shared Socket.IO URL helper for realtime features.
 */
export function getSocketIOUrl() {
  if (typeof window === 'undefined') return null;
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (isDev) return window.location.origin;
  const backend =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '');
  return backend || window.location.origin;
}
