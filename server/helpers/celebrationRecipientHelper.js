import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { isHrStaffEmployee } from './functionalRolesHelper.js';
import { normalizeLifecycleRecipientIds } from './lifecycleNotificationRecipients.js';

/**
 * Dedicated recipient resolution for Birthday & Work Anniversary notifications.
 * Isolated from leave, attendance, and other notification recipient rules.
 */

const ACTIVE_STATUSES = ['active'];

/**
 * Resolve eligible celebration event viewers (for reactions visibility).
 * Includes: reporting manager, HR staff, same department, and the subject employee.
 */
export async function resolveCelebrationEventViewers(subjectEmployee, organizationId) {
  if (!subjectEmployee?._id || !organizationId) return [];

  const subjectId = subjectEmployee._id.toString();
  const viewerIds = new Set([subjectId]);

  if (subjectEmployee.managerId) {
    viewerIds.add(subjectEmployee.managerId.toString());
  }

  const orgEmployees = await Employee.find({
    organizationId,
    status: { $in: ACTIVE_STATUSES },
  })
    .select('_id userId managerId department functionalRoles position jobTitle')
    .lean();

  for (const emp of orgEmployees) {
    const empId = emp._id.toString();
    if (empId === subjectId) continue;

    if (isHrStaffEmployee(emp)) {
      viewerIds.add(empId);
      continue;
    }

    if (
      subjectEmployee.department &&
      emp.department &&
      String(emp.department).trim().toLowerCase() === String(subjectEmployee.department).trim().toLowerCase()
    ) {
      viewerIds.add(empId);
    }
  }

  return Array.from(viewerIds);
}

/**
 * Resolve notification recipients for upcoming/today celebration alerts.
 * Same pool as event viewers, excluding the subject employee (they get the event, not a "your birthday" push).
 * Prefer linked User ids so push subscriptions saved under User._id are found.
 */
export async function resolveCelebrationNotificationRecipients(subjectEmployee, organizationId) {
  const viewers = await resolveCelebrationEventViewers(subjectEmployee, organizationId);
  const subjectId = subjectEmployee._id.toString();
  const filtered = viewers.filter((id) => id !== subjectId);
  return normalizeLifecycleRecipientIds(filtered, organizationId);
}

/**
 * Normalize employee IDs to User IDs where linked (for push subscription delivery).
 */
export async function normalizeCelebrationRecipientIds(recipientIds, organizationId) {
  return normalizeLifecycleRecipientIds(recipientIds, organizationId);
}

/**
 * Load active employees with fields needed for celebration matching.
 */
export async function loadCelebrationEmployees(organizationId) {
  return Employee.find({
    organizationId,
    status: { $in: ACTIVE_STATUSES },
  })
    .select('_id name lastName birthDate joiningDate anniversaryDate maritalStatus spouseName marriageDate showMarriageAnniversary department managerId userId functionalRoles position jobTitle')
    .lean();
}

/**
 * Resolve push/in-app recipient for a private wish notification — subject employee only.
 */
export async function resolveWishNotificationRecipient(subjectEmployeeId, organizationId) {
  const ids = await normalizeCelebrationRecipientIds([subjectEmployeeId], organizationId);
  return ids[0] || subjectEmployeeId;
}

/**
 * Check whether an employee can view a celebration event.
 */
export function canViewCelebrationEvent(event, employeeId) {
  if (!event || !employeeId) return false;
  const id = employeeId.toString();
  if (String(event.employeeId) === id) return true;
  return (event.eligibleViewerIds || []).some((viewerId) => String(viewerId) === id);
}

export default {
  resolveCelebrationEventViewers,
  resolveCelebrationNotificationRecipients,
  normalizeCelebrationRecipientIds,
  loadCelebrationEmployees,
  resolveWishNotificationRecipient,
  canViewCelebrationEvent,
};
