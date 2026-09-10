import { useEffect } from 'react';
import { dispatchHrmsDismissPopups, isHrmsPopupInteractionTarget } from '../utils/hrmsPopupDismiss';

/**
 * Global listener: clicking outside any HRMS popup/menu closes registered popups.
 * Uses click (bubble) so nav links can navigate on pointerdown first.
 * Sidebar clicks are ignored so dismiss never races with navigation.
 */
export default function HrmsPopupDismissListener() {
  useEffect(() => {
    const onClick = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-hrms-sidebar], [data-hrms-sidebar-nav]')) return;
      if (isHrmsPopupInteractionTarget(target)) return;
      dispatchHrmsDismissPopups();
    };

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
    };
  }, []);

  return null;
}
