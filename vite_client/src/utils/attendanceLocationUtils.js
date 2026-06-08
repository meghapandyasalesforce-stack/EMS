/**
 * Mirrors server GET /both/attendance/rule flags for punch-in UI (no rule changes).
 */

export const hasValidRuleCoordinates = (rule) => {
  const lat = rule?.coordinates?.latitude;
  const lng = rule?.coordinates?.longitude;
  if (lat == null || lng == null) return false;
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isNaN(la) || Number.isNaN(lo)) return false;
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
};

/** When true, clock-in must include latitude/longitude (same as rule.locationRequired). */
export const isLocationRequiredForPunch = (rule) => {
  if (!rule || rule.isExempt) return false;
  if (typeof rule.locationRequired === 'boolean') {
    return rule.locationRequired;
  }
  return hasValidRuleCoordinates(rule);
};
