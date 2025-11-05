// utils/sseNotification.js
// Note: This utility may be deprecated. Use NotificationFeed.jsx component instead.
// This file is kept for backward compatibility but should use getBackendBaseURL() for proper URL construction.

import { getBackendBaseURL } from './axios';

export const startNotificationStream = (dispatch) => {
  // Use full backend URL for SSE (EventSource requires full URL for cross-origin)
  const backendUrl = getBackendBaseURL();
  const sseUrl = `${backendUrl}/api/v1/both/notification/get-all-notification`;
  
  const eventSource = new EventSource(sseUrl, {
    withCredentials: true,
  });

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      // Note: This assumes the notification slice action is available
      // For better compatibility, use NotificationFeed component instead
      if (dispatch && typeof dispatch === 'function') {
        // Import would need to be dynamic or handled by caller
        // dispatch(addNotification(data));
      }
    } catch (err) {
      console.error('Error parsing SSE data:', err);
    }
  };

  eventSource.onerror = (err) => {
    console.error('SSE error:', err);
    // EventSource has built-in retry, don't close immediately
  };

  return eventSource;
};
