/**
 * MongoDB document id for the logged-in employee.
 * Employee login stores `id`; profile/session payloads often use `_id`.
 * Org-admin User records must use `employeeProfileId` (User._id is not an Employee).
 */
export function getAuthEmployeeId(userOrEmployee) {
  if (!userOrEmployee) return undefined;
  const raw =
    userOrEmployee.employeeProfileId ??
    userOrEmployee._id ??
    userOrEmployee.id;
  if (raw == null) return undefined;
  return typeof raw === 'string' ? raw : String(raw);
}
