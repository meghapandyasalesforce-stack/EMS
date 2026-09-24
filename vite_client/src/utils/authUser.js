/**
 * MongoDB document id for the logged-in employee.
 * Employee login stores `id`; profile/session payloads often use `_id`.
 * Org-admin User records must use `employeeProfileId` (User._id is not an Employee).
 */
export function getAuthEmployeeId(userOrEmployee) {
  if (!userOrEmployee) return undefined;
  const isAdminUser =
    userOrEmployee.role === 'admin' ||
    (Array.isArray(userOrEmployee.roles) &&
      userOrEmployee.roles.some((r) => String(r).toLowerCase() === 'admin'));

  // Never treat Admin User._id as an Employee id — that breaks invitee/organizer checks.
  let raw = isAdminUser
    ? userOrEmployee.employeeProfileId ?? userOrEmployee.employeeId
    : userOrEmployee.employeeProfileId ??
      userOrEmployee._id ??
      userOrEmployee.id;

  // Login stores linked workforce id for admin sessions
  if (raw == null && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('employeeProfileId');
      if (stored) raw = stored;
    } catch {
      /* ignore */
    }
  }

  if (raw == null) return undefined;
  return typeof raw === 'string' ? raw : String(raw);
}

/**
 * All ids that may represent the signed-in person for participant matching.
 * Ignores employeeDetails profiles that belong to someone else (admin viewing a record).
 */
export function getAuthActorIds(user, employeeDetails) {
  const ids = new Set();
  const add = (v) => {
    if (v == null || v === '') return;
    ids.add(String(v._id || v.id || v));
  };

  const sessionId = getAuthEmployeeId(user);
  add(sessionId);
  add(user?.employeeProfileId);
  add(user?.employeeId);

  if (user?.role !== 'admin') {
    add(user?._id);
    add(user?.id);
  }

  const detailId = employeeDetails?._id || employeeDetails?.id;
  // Only trust Redux employeeDetails when it matches the auth session employee id.
  // Never fall back to a browsed employee profile when session id is missing (admin).
  if (sessionId && detailId != null && String(detailId) === String(sessionId)) {
    add(detailId);
  } else if (!sessionId && user?.role !== 'admin' && detailId != null) {
    add(detailId);
  }

  return ids;
}
