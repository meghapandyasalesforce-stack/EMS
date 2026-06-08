/**
 * In-memory cache for per-organization timezone + active attendance rule.
 * Reduces repeated DB hits on login and every punch in/out.
 */
import Organization from '../models/organization.model.js';
import AttendanceRule from '../models/attendanceRule.model.js';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';
import { normalizeTimezone } from './timezoneHelper.js';
import { resolveEffectiveTimezone } from './organizationTimezoneService.js';

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const timezoneCache = new Map();
const ruleCache = new Map();

const getCached = (map, key) => {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = (map, key, value) => {
  map.set(key, { value, expiresAt: Date.now() + TTL_MS });
};

export function invalidateOrgContextCache(organizationId) {
  if (!organizationId) return;
  const key = String(organizationId);
  timezoneCache.delete(key);
  ruleCache.delete(key);
}

export async function getCachedTimezoneContext(organizationId) {
  if (!organizationId) {
    return {
      timezone: DEFAULT_TIMEZONE,
      organizationTimezone: DEFAULT_TIMEZONE,
      attendanceRuleTimezone: null,
    };
  }

  const key = String(organizationId);
  const hit = getCached(timezoneCache, key);
  if (hit) return hit;

  const [org, rule] = await Promise.all([
    Organization.findById(organizationId).select('timezone').lean(),
    AttendanceRule.findOne({ organizationId, isActive: true })
      .sort({ priority: -1, updatedAt: -1 })
      .select('timezone')
      .lean(),
  ]);

  const organizationTimezone = normalizeTimezone(org?.timezone);
  const attendanceRuleTimezone = rule?.timezone
    ? normalizeTimezone(rule.timezone)
    : null;
  const timezone = resolveEffectiveTimezone(
    organizationTimezone,
    attendanceRuleTimezone
  );

  const data = {
    timezone,
    organizationTimezone,
    attendanceRuleTimezone,
  };
  setCached(timezoneCache, key, data);
  return data;
}

export async function getCachedEffectiveTimezone(organizationId) {
  const ctx = await getCachedTimezoneContext(organizationId);
  return ctx.timezone;
}

/** Active attendance rule document (lean), cached per org. */
export async function getCachedActiveAttendanceRule(organizationId) {
  if (!organizationId) return null;

  const key = String(organizationId);
  const hit = getCached(ruleCache, key);
  if (hit !== null && hit !== undefined) return hit;

  const rule = await AttendanceRule.findOne({
    isActive: true,
    organizationId,
  })
    .sort({ priority: -1, updatedAt: -1 })
    .lean();

  setCached(ruleCache, key, rule ?? null);
  return rule;
}
