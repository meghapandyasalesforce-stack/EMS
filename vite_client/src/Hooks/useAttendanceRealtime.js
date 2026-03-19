/**
 * Real-time updates for "Employees on Break" on the admin dashboard.
 * Listens for socket event when an employee starts/ends a break and invalidates
 * the React Query cache so the list refetches immediately.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getTokenFromCookie } from '../utils/authHelper';

/**
 * Get Socket.IO server URL. Same origin in dev (Vite proxies /socket.io). In prod, use backend URL if set.
 */
function getSocketIOUrl() {
  if (typeof window === 'undefined') return null;
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (isDev) return window.location.origin; // Vite proxy forwards /socket.io to backend
  const backend = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '');
  return backend || window.location.origin;
}

/**
 * Subscribe to real-time "employees on break" changes. Call from admin dashboard only.
 * When any employee in the org starts or ends a break, the server emits and we invalidate
 * the employees-on-break query so the UI refetches and updates.
 */
export function useAttendanceRealtime() {
  const queryClient = useQueryClient();
  const socketRef = useRef(null);

  useEffect(() => {
    const url = getSocketIOUrl();
    if (!url) return;

    const token = getTokenFromCookie();
    const socket = io(url, {
      path: '/socket.io',
      withCredentials: true,
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    const onBreakChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['employees-on-break'] });
    };

    socket.on('attendance:employees_on_break_changed', onBreakChanged);

    // Make realtime optional and resilient: if socket fails, the rest of the app keeps working.
    socket.on('connect_error', () => {
      // In development we could log, but avoid noisy console in production.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('Realtime connection unavailable (socket.io connect_error).');
      }
    });

    socket.on('disconnect', () => {
      // No-op; queries will still update via normal refetches.
    });

    return () => {
      socket.off('attendance:employees_on_break_changed', onBreakChanged);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);
}
