/**
 * Real-time updates for "Employees on Break" on the admin dashboard.
 * Listens for socket event when an employee starts/ends a break and invalidates
 * the React Query cache so the list refetches immediately.
 */
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { getTokenFromCookie } from '../utils/authHelper';
import { getSocketIOUrl } from '../utils/socketUrl';

/**
 * Subscribe to real-time "employees on break" changes. Call from admin dashboard only.
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

    socket.on('connect_error', () => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('Realtime connection unavailable (socket.io connect_error).');
      }
    });

    return () => {
      socket.off('attendance:employees_on_break_changed', onBreakChanged);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient]);
}
