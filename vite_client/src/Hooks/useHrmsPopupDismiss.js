import { useEffect } from 'react';
import { HRMS_DISMISS_POPUPS_EVENT } from '../utils/hrmsPopupDismiss';

/**
 * Close a popup/menu when the user clicks anywhere outside (global HRMS dismiss).
 * @param {() => void} onDismiss
 * @param {boolean} isOpen
 */
export default function useHrmsPopupDismiss(onDismiss, isOpen) {
  useEffect(() => {
    if (!isOpen || typeof onDismiss !== 'function') return undefined;

    const handleDismiss = () => onDismiss();

    window.addEventListener(HRMS_DISMISS_POPUPS_EVENT, handleDismiss);
    return () => window.removeEventListener(HRMS_DISMISS_POPUPS_EVENT, handleDismiss);
  }, [isOpen, onDismiss]);
}
