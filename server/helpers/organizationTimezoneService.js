import Organization from '../models/organization.model.js';
import AttendanceRule from '../models/attendanceRule.model.js';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';
import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  getDateKeyInTimezone,
  normalizeTimezone,
} from './timezoneHelper.js';

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
  if (!organizationId) {
    return {
      timezone: DEFAULT_TIMEZONE,
      organizationTimezone: DEFAULT_TIMEZONE,
      attendanceRuleTimezone: null,
    };
  }

  const [org, rule] = await Promise.all([
    Organization.findById(organizationId).select('timezone').lean(),
    AttendanceRule.findOne({ organizationId, isActive: true })
      .sort({ priority: -1, updatedAt: -1 })
      .select('timezone')
      .lean(),
  ]);

  const organizationTimezone = normalizeTimezone(org?.timezone);
  const attendanceRuleTimezone = rule?.timezone ? normalizeTimezone(rule.timezone) : null;
  const timezone = resolveEffectiveTimezone(organizationTimezone, attendanceRuleTimezone);

  return {
    timezone,
    organizationTimezone,
    attendanceRuleTimezone,
  };
}

export async function getEffectiveTimezone(organizationId) {
  const ctx = await getTimezoneContext(organizationId);
  return ctx.timezone;
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
