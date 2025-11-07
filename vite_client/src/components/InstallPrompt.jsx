import React, { useEffect, useState } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';

/**
 * InstallPrompt Component
 * Shows a banner/prompt to install the PWA on mobile devices
 */
const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone ||
                       document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Listen for the beforeinstallprompt event (Android/Chrome)
    const handler = (e) => {
      // Prevent the default install prompt
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed - hide prompt if so
    if (standalone) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS, show instructions
      if (isIOS) {
        toast.info(
          'Tap the Share button (□↑) and select "Add to Home Screen"',
          { duration: 5000 }
        );
      }
      return;
    }

    try {
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App installed successfully! 🎉');
        setShowInstallButton(false);
      } else {
        toast.info('Installation cancelled');
      }
      
      // Clear the deferred prompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
      toast.error('Failed to show install prompt');
    }
  };

  const handleDismiss = () => {
    setShowInstallButton(false);
    // Store dismissal in localStorage to not show again for this session
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !showInstallButton) {
    return null;
  }

  // Check if user dismissed it
  if (localStorage.getItem('pwa-install-dismissed') === 'true') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg p-4 md:p-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-white/20 rounded-full p-2">
            <FiDownload className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm md:text-base">
              Install Paarsiv App
            </p>
            <p className="text-xs md:text-sm text-blue-100">
              {isIOS 
                ? 'Add to Home Screen for quick access'
                : 'Install for a better experience'
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-white text-blue-600 px-4 py-2 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <FiDownload className="w-4 h-4" />
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white p-2 transition-colors"
            aria-label="Dismiss"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;

