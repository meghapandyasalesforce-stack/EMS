import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';
import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  getDateKeyInTimezone,
  normalizeTimezone,
} from './timezoneHelper.js';
import {
  getCachedTimezoneContext,
  getCachedEffectiveTimezone,
} from './orgContextCache.js';

export { invalidateOrgContextCache } from './orgContextCache.js';

/**
 * Effective timezone: attendance rule override, then organization, then UTC.
 */
export function resolveEffectiveTimezone(organizationTimezone, ruleTimezone) {
  if (ruleTimezone && String(ruleTimezone).trim()) {
    return normalizeTimezone(ruleTimezone);
  }
  return normalizeTimezone(organizationTimezone);
}

export async function getTimezoneContext(organizationId) {
  return getCachedTimezoneContext(organizationId);
}

export async function getEffectiveTimezone(organizationId) {
  return getCachedEffectiveTimezone(organizationId);
}

export async function getStartOfDayForOrganization(organizationId, refDate = new Date()) {
  const tz = await getEffectiveTimezone(organizationId);
  return getStartOfDayInTimezone(refDate, tz);
}

export async function getEndOfDayForOrganization(organizationId, refDate = new Date()) {
  const tz = await getEffectiveTimezone(organizationId);
  return getEndOfDayInTimezone(refDate, tz);
}

export async function getDateKeyForOrganization(organizationId, refDate = new Date()) {
  const tz = await getEffectiveTimezone(organizationId);
  return getDateKeyInTimezone(refDate, tz);
}
