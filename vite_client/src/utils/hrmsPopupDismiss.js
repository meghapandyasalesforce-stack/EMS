export const HRMS_DISMISS_POPUPS_EVENT = 'hrms:dismiss-popups';

const POPUP_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[data-hrms-popup]',
  '[data-hrms-popup-panel]',
  '.hrms-popup',
].join(', ');

const MODAL_SELECTOR = [
  '[role="dialog"]',
  '[aria-modal="true"]',
  '.cm-modal-overlay',
  '[data-headlessui-state="open"]',
].join(', ');

const TRIGGER_SELECTOR = [
  '[data-hrms-popup-trigger]',
  '[aria-haspopup="menu"]',
  'button[aria-expanded="true"]',
].join(', ');

/** True when the click/touch target is inside an open popup, modal, or its trigger. */
export function isHrmsPopupInteractionTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest(POPUP_SELECTOR)) return true;
  if (target.closest(MODAL_SELECTOR)) return true;
  if (target.closest(TRIGGER_SELECTOR)) return true;
  return false;
}

export function dispatchHrmsDismissPopups() {
  window.dispatchEvent(new CustomEvent(HRMS_DISMISS_POPUPS_EVENT));
}
