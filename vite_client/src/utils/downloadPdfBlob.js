/**
 * Mobile-safe PDF download helper.
 * iOS Safari ignores <a download> for blob URLs; Web Share / open-in-tab works better.
 */

function isLikelyMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

function isLikelyIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
}

function toPdfBlob(data) {
  if (data instanceof Blob) {
    if (data.type && data.type.includes('pdf')) return data;
    return new Blob([data], { type: 'application/pdf' });
  }
  return new Blob([data], { type: 'application/pdf' });
}

function triggerAnchorDownload(url, fileName) {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Save / share a PDF blob across desktop + mobile browsers.
 * @returns {Promise<'share'|'share-cancelled'|'open'|'download'>}
 */
export async function downloadPdfBlob(data, filename = 'download.pdf') {
  const blob = toPdfBlob(data);
  const fileName = String(filename || 'download.pdf').endsWith('.pdf')
    ? String(filename || 'download.pdf')
    : `${filename}.pdf`;

  const url = URL.createObjectURL(blob);

  // Prefer share sheet on mobile when file sharing is supported
  if (isLikelyMobile() && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: 'application/pdf' });
      const canShareFiles =
        typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: fileName });
        setTimeout(() => URL.revokeObjectURL(url), 2_500);
        return 'share';
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setTimeout(() => URL.revokeObjectURL(url), 2_500);
        return 'share-cancelled';
      }
      // Fall through
    }
  }

  // iOS: open PDF tab (download attr is unreliable)
  if (isLikelyIOS()) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'open';
  }

  // Android + desktop: standard download; keep URL briefly for Chrome
  triggerAnchorDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'download';
}

export default downloadPdfBlob;
