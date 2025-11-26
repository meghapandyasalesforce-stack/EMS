import { useEffect } from 'react';
import dashboardWebSocket from '../utils/websocket';

/**
 * Hook for using WebSocket in React components
 * @param {string} url - WebSocket server URL
 * @param {Object} options - Options
 * @returns {Object} WebSocket connection and methods
 */
export const useDashboardWebSocket = (url, options = {}) => {
  const { autoConnect = true, onMessage, onConnected, onDisconnected, onError } = options;

  useEffect(() => {
    if (!url || !autoConnect) return;

    // Connect
    dashboardWebSocket.connect(url);

    // Set up event listeners
    const unsubscribeMessage = onMessage 
      ? dashboardWebSocket.on('message', onMessage)
      : null;
    
    const unsubscribeConnected = onConnected
      ? dashboardWebSocket.on('connected', onConnected)
      : null;
    
    const unsubscribeDisconnected = onDisconnected
      ? dashboardWebSocket.on('disconnected', onDisconnected)
      : null;
    
    const unsubscribeError = onError
      ? dashboardWebSocket.on('error', onError)
      : null;

    // Cleanup
    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
      if (unsubscribeConnected) unsubscribeConnected();
      if (unsubscribeDisconnected) unsubscribeDisconnected();
      if (unsubscribeError) unsubscribeError();
    };
  }, [url, autoConnect, onMessage, onConnected, onDisconnected, onError]);

  return {
    send: (data) => dashboardWebSocket.send(data),
    isConnected: () => dashboardWebSocket.isConnected(),
    disconnect: () => dashboardWebSocket.disconnect(),
  };
};

export default useDashboardWebSocket;

