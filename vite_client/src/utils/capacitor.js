import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import logger from './logger';

/**
 * Initialize Capacitor plugins for mobile app
 */
export const initCapacitor = async () => {
  // Only initialize on native platforms
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Initialize Status Bar
    if (Capacitor.isPluginAvailable('StatusBar')) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#2563eb' });
    }

    // Hide Splash Screen
    if (Capacitor.isPluginAvailable('SplashScreen')) {
      await SplashScreen.hide();
    }

    // Configure Keyboard
    if (Capacitor.isPluginAvailable('Keyboard')) {
      Keyboard.setAccessoryBarVisible({ isVisible: true });
    }

    // Handle app state changes
    if (Capacitor.isPluginAvailable('App')) {
      App.addListener('appStateChange', ({ isActive }) => {
        logger.debug('App state changed', { isActive });
      });

      App.addListener('appUrlOpen', (data) => {
        logger.debug('App opened with URL', { url: data.url });
      });

      // Handle back button on Android
      App.addListener('backButton', ({ canGoBack }) => {
        if (!canGoBack) {
          App.exitApp();
        } else {
          window.history.back();
        }
      });
    }
  } catch (error) {
    logger.error('Error initializing Capacitor', { error: error.message, stack: error.stack });
  }
};

/**
 * Check if running on native platform
 */
export const isNative = () => Capacitor.isNativePlatform();

/**
 * Get platform name
 */
export const getPlatform = () => Capacitor.getPlatform();

/**
 * Check if running on iOS
 */
export const isIOS = () => Capacitor.getPlatform() === 'ios';

/**
 * Check if running on Android
 */
export const isAndroid = () => Capacitor.getPlatform() === 'android';

