/**
 * Global toast severity: only real backend/system failures stay red.
 * All other toast.error calls render as a soft warning (amber/orange).
 * Functionality and call sites stay the same — only appearance changes.
 */
import { toast } from 'react-toastify';

const BACKEND_FAILURE_RE =
  /\b(failed to|failure to|network error|server error|internal server|something went wrong|unexpected error|request failed|err_network|econnrefused|etimedout|timeout|session expired|logout failed|could not (be )?(submitted|saved|loaded|fetched|opened|deleted|updated|uploaded|exported)|unable to (load|fetch|save|connect|reach|open))\b/i;

/** Soft / policy / validation cues — never treat as backend red. */
const NON_BACKEND_RE =
  /\b(insufficient|not enough|please |is required|are required|invalid |not allowed|not eligible|already exists|outside the|exceeds|must be|must have|select a|choose a|provide a|fill in|missing )\b/i;

function toastText(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'number' || typeof content === 'boolean') return String(content);
  if (typeof content?.message === 'string') return content.message;
  try {
    return String(content);
  } catch {
    return '';
  }
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/**
 * @param {unknown} content
 * @param {import('react-toastify').ToastOptions & { backend?: boolean, isBackendError?: boolean }} [options]
 */
export function isBackendFailureToast(content, options = {}) {
  if (options.backend === true || options.isBackendError === true) return true;
  if (options.backend === false || options.isBackendError === false) return false;

  const text = toastText(content);
  if (!text) return false;
  if (NON_BACKEND_RE.test(text)) return false;
  return BACKEND_FAILURE_RE.test(text);
}

/** Explicit red toast for confirmed backend/system failures. */
export function toastBackendError(content, options = {}) {
  return toast.error(content, { ...options, backend: true });
}

/**
 * Map an axios/fetch-style error to the right toast colour.
 * 5xx / network → red; 4xx business messages → amber warning.
 */
export function toastApiError(error, fallback = 'Something went wrong', options = {}) {
  const status = error?.response?.status;
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    (typeof error?.message === 'string' ? error.message : null) ||
    fallback;

  const noResponse = !error?.response;
  const isServerFault = noResponse || (typeof status === 'number' && status >= 500);

  if (isServerFault) {
    return toastBackendError(message, options);
  }
  return toast.error(message, { ...options, backend: false });
}

export function setupToastSeverity() {
  // Idempotent for Vite HMR — never wrap an already-wrapped toast.error
  if (toast.__emsSeverityPatched) return;
  toast.__emsSeverityPatched = true;

  const originalError = toast.error.bind(toast);
  const originalWarning = toast.warning.bind(toast);
  toast.__emsOriginalError = originalError;
  toast.__emsOriginalWarning = originalWarning;

  toast.error = (content, options) => {
    const opts = options && typeof options === 'object' ? options : {};
    if (isBackendFailureToast(content, opts)) {
      return originalError(content, {
        ...opts,
        className: cx('ems-toast', 'ems-toast--danger', opts.className),
      });
    }
    return originalWarning(content, {
      ...opts,
      className: cx('ems-toast', 'ems-toast--warning', opts.className),
    });
  };

  toast.warning = (content, options) => {
    const opts = options && typeof options === 'object' ? options : {};
    return originalWarning(content, {
      ...opts,
      className: cx('ems-toast', 'ems-toast--warning', opts.className),
    });
  };

  toast.backendError = toastBackendError;
}
