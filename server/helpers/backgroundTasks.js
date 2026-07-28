import logger from './logger.js';
import { deleteCacheByPattern } from './cache.js';

/**
 * Fire-and-forget background work (notifications, cache bust, email queue fallback).
 */
export const runInBackground = (label, fn) => {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        logger.warn(`Background task failed: ${label}`, {
          error: err?.message,
        });
      });
  });
};

const ATTENDANCE_CACHE_PATTERNS = [
  'attendance:logs*',
  'attendance:today*',
  'attendance:on-break*',
  'attendance:summary*',
  'attendance:my-today*',
  'attendance:employee*',
  'attendance:employee-list*',
];

export const invalidateAttendanceCachesAsync = () => {
  runInBackground('attendance-cache-invalidate', async () => {
    await Promise.all(
      ATTENDANCE_CACHE_PATTERNS.map((pattern) =>
        deleteCacheByPattern(pattern)
      )
    );
  });
};

export const emitAttendanceTodayChangedAsync = (organizationId) => {
  if (!organizationId) return;
  runInBackground('attendance-socket-emit', async () => {
    const { getIO } = await import('../config/websocket.js');
    getIO().to(`org:${organizationId}`).emit('attendance:today_status_changed', {});
  });
};

export const emitEmployeesOnBreakChangedAsync = (organizationId) => {
  if (!organizationId) return;
  runInBackground('attendance-break-socket-emit', async () => {
    const { getIO } = await import('../config/websocket.js');
    getIO()
      .to(`org:${organizationId}`)
      .emit('attendance:employees_on_break_changed', {});
  });
};

export const emitOnboardingChangedAsync = (organizationId, workflowId = null) => {
  if (!organizationId) return;
  runInBackground('onboarding-socket-emit', async () => {
    const { getIO } = await import('../config/websocket.js');
    getIO()
      .to(`org:${organizationId}`)
      .emit('onboarding:changed', {
        workflowId: workflowId?.toString?.() || workflowId || null,
      });
  });
};

export const emitOffboardingChangedAsync = (organizationId, workflowId = null) => {
  if (!organizationId) return;
  runInBackground('offboarding-socket-emit', async () => {
    const { getIO } = await import('../config/websocket.js');
    getIO()
      .to(`org:${organizationId}`)
      .emit('offboarding:changed', {
        workflowId: workflowId?.toString?.() || workflowId || null,
      });
  });
};
