/**
 * MongoDB document id for the logged-in employee.
 * Employee login stores `id`; profile/session payloads often use `_id`.
 */
export function getAuthEmployeeId(userOrEmployee) {
  if (!userOrEmployee) return undefined;
  const raw = userOrEmployee._id ?? userOrEmployee.id;
  if (raw == null) return undefined;
  return typeof raw === 'string' ? raw : String(raw);
}
