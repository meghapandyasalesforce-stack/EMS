/**
 * Authoritative recipient resolution for Onboarding / Offboarding notifications.
 * Uses platform roles (hr_admin, hr_executive, org_owner) and Admin — not title/dept heuristics.
 */

import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';

/** Platform roles that map to isHrManager / isHrExecutive / org owner in permissionService. */
export const AUTHORITATIVE_HR_PLATFORM_ROLES = Object.freeze([
  PLATFORM_ROLES.HR_ADMIN,
  PLATFORM_ROLES.HR_EXECUTIVE,
  PLATFORM_ROLES.ORG_OWNER,
]);

const toId = (value) => value?._id?.toString?.() || value?.toString?.() || null;

const uniqueIds = (values) => [...new Set((values || []).map(toId).filter(Boolean))];

/**
 * Collapse Employee ↔ User identity pairs to a single notification recipient ID.
 * Prefers the linked User._id when present so one person gets one notification.
 */
export async function normalizeLifecycleRecipientIds(recipientIds, organizationId = null) {
  const raw = uniqueIds(recipientIds);
  if (!raw.length) return [];

  const empFilter = {
    $or: [{ _id: { $in: raw } }, { userId: { $in: raw } }],
  };
  if (organizationId) empFilter.organizationId = organizationId;

  const employees = await Employee.find(empFilter).select('_id userId').lean();

  const preferred = new Set();
  const covered = new Set();

  for (const employee of employees) {
    const employeeId = employee._id.toString();
    const userId = employee.userId?.toString?.() || null;
    if (userId) {
      preferred.add(userId);
      covered.add(employeeId);
      covered.add(userId);
    } else {
      preferred.add(employeeId);
      covered.add(employeeId);
    }
  }

  for (const id of raw) {
    if (!covered.has(id)) preferred.add(id);
  }

  return [...preferred];
}

/**
 * Users with authoritative HR Manager / HR Executive / org owner platform roles.
 */
export async function getAuthoritativeHrUserIds(organizationId) {
  if (!organizationId) return [];

  const hrUsers = await User.find({
    organizationId,
    isActive: true,
    roles: { $in: [...AUTHORITATIVE_HR_PLATFORM_ROLES] },
  })
    .select('_id')
    .lean();

  return hrUsers.map((user) => user._id.toString());
}

/**
 * Active Admin users for an organization (User.role === 'admin').
 */
export async function getAdminUserIds(organizationId) {
  if (!organizationId) return [];

  const admins = await User.find({
    organizationId,
    role: 'admin',
    isActive: true,
  })
    .select('_id')
    .lean();

  return admins.map((admin) => admin._id.toString());
}

/**
 * Expand/normalize recipient IDs; optionally include all org admins.
 * Does not fan out by department/title/functionalRoles.
 */
export async function expandOnboardingRecipients(
  recipientIds,
  organizationId,
  { includeAdmins = false } = {},
) {
  const ids = uniqueIds(recipientIds);
  if (!ids.length && !includeAdmins) return [];

  const normalized = await normalizeLifecycleRecipientIds(ids, organizationId);
  const result = new Set(normalized);

  if (includeAdmins && organizationId) {
    const admins = await getAdminUserIds(organizationId);
    admins.forEach((adminId) => result.add(adminId));
  }

  return [...result];
}

/**
 * HR notification recipients: assigned HR + HR Manager/Executive/org_owner + Admins.
 */
export async function getOnboardingHrRecipients(workflow, organizationId) {
  const authoritativeHr = await getAuthoritativeHrUserIds(organizationId);
  return expandOnboardingRecipients(
    [workflow?.assignedHR, ...authoritativeHr],
    organizationId,
    { includeAdmins: true },
  );
}

/**
 * Progress-event recipients for onboarding/offboarding.
 * IT is limited to explicit IT task assignees (no org-wide title matching).
 */
export async function getOnboardingProgressRecipients(
  workflow,
  organizationId,
  {
    employee = false,
    hr = false,
    manager = false,
    buddy = false,
    it = false,
  } = {},
) {
  const ids = [];
  if (employee) ids.push(workflow?.employeeId);
  if (hr) ids.push(...await getOnboardingHrRecipients(workflow, organizationId));
  if (manager) ids.push(workflow?.assignedManager);
  if (buddy) ids.push(workflow?.assignedBuddy);
  if (it) {
    ids.push(
      ...(workflow?.tasks || [])
        .filter((task) => task.assigneeRole === 'it')
        .map((task) => task.assignedTo),
    );
  }
  // Admins already included when hr:true via getOnboardingHrRecipients
  return expandOnboardingRecipients(ids, organizationId, { includeAdmins: false });
}

/**
 * Authoritative HR list for escalation fallback and shared lifecycle HR notify paths
 * that previously used loose title/department matching.
 */
export async function getAuthoritativeHrRecipients(organizationId) {
  const hrIds = await getAuthoritativeHrUserIds(organizationId);
  return normalizeLifecycleRecipientIds(hrIds, organizationId);
}

/**
 * First authoritative HR recipient for escalation targeting (Employee id preferred for history).
 */
export async function findAuthoritativeHrEscalationRecipient(organizationId) {
  if (!organizationId) return null;

  const hrUser = await User.findOne({
    organizationId,
    isActive: true,
    roles: { $in: [...AUTHORITATIVE_HR_PLATFORM_ROLES] },
  })
    .select('_id employeeProfileId')
    .lean();

  if (!hrUser) {
    const admin = await User.findOne({
      organizationId,
      role: 'admin',
      isActive: true,
    })
      .select('_id employeeProfileId')
      .lean();
    if (!admin) return null;
    if (admin.employeeProfileId) return admin.employeeProfileId;
    const linkedAdmin = await Employee.findOne({
      organizationId,
      userId: admin._id,
    })
      .select('_id')
      .lean();
    return linkedAdmin?._id || admin._id;
  }

  if (hrUser.employeeProfileId) return hrUser.employeeProfileId;

  const linked = await Employee.findOne({
    organizationId,
    userId: hrUser._id,
  })
    .select('_id')
    .lean();

  return linked?._id || hrUser._id;
}
