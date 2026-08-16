import { useEffect } from 'react';
import { dispatchHrmsDismissPopups, isHrmsPopupInteractionTarget } from '../utils/hrmsPopupDismiss';

/** Global listener: clicking outside any HRMS popup/menu closes registered popups. */
export default function HrmsPopupDismissListener() {
  useEffect(() => {
    const onPointerDown = (event) => {
      if (isHrmsPopupInteractionTarget(event.target)) return;
      dispatchHrmsDismissPopups();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, []);

  return null;
}
