import { describe, expect, it } from 'vitest';
import { isBackendFailureToast } from './toastSeverity';

describe('isBackendFailureToast', () => {
  it('treats insufficient leave and validation as non-backend', () => {
    expect(
      isBackendFailureToast(
        'Insufficient leave balance. Available: 0 days, Requested: 1 days'
      )
    ).toBe(false);
    expect(isBackendFailureToast('Please provide a rejection reason')).toBe(false);
    expect(isBackendFailureToast('Start date is required for half-day leave')).toBe(false);
  });

  it('treats failed API / network copy as backend', () => {
    expect(isBackendFailureToast('Failed to fetch leave balance')).toBe(true);
    expect(isBackendFailureToast('Network Error')).toBe(true);
    expect(isBackendFailureToast('Something went wrong')).toBe(true);
  });

  it('respects explicit backend flags', () => {
    expect(isBackendFailureToast('Insufficient leave', { backend: true })).toBe(true);
    expect(isBackendFailureToast('Failed to save', { backend: false })).toBe(false);
  });
});
