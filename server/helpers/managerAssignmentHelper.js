import mongoose from 'mongoose';
import Employee from '../models/employee.model.js';

/** Labels stored / accepted for the single organization Admin root (managerId: null). */
export const TOP_LEVEL_MANAGER_LABELS = new Set(['CEO', 'ADMIN', 'NONE']);

/**
 * True when the manager field means "no manager" / organization Admin root.
 */
export function isTopLevelManagerLabel(value) {
  const raw = String(value || '').trim().toUpperCase();
  return !raw || TOP_LEVEL_MANAGER_LABELS.has(raw);
}

/**
 * Collect all descendant employee IDs for a given manager (direct + indirect reports).
 */
export async function getEmployeeDescendantIds(organizationId, employeeId) {
  if (!organizationId || !employeeId) return new Set();

  const rows = await Employee.find({
    organizationId,
    status: { $ne: 'terminated' },
  })
    .select('_id managerId')
    .lean();

  const childrenByManager = new Map();
  for (const row of rows) {
    if (!row.managerId) continue;
    const managerKey = String(row.managerId);
    if (!childrenByManager.has(managerKey)) childrenByManager.set(managerKey, []);
    childrenByManager.get(managerKey).push(String(row._id));
  }

  const found = new Set();
  const stack = [...(childrenByManager.get(String(employeeId)) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (found.has(id)) continue;
    found.add(id);
    for (const child of childrenByManager.get(id) || []) {
      stack.push(child);
    }
  }
  return found;
}

/**
 * Active employees whose managerId is null (organization Admin / top-level roots).
 */
export async function getOrganizationRootEmployees(organizationId) {
  if (!organizationId) return [];
  return Employee.find({
    organizationId,
    status: { $ne: 'terminated' },
    $or: [{ managerId: null }, { managerId: { $exists: false } }],
  })
    .select('_id name lastName employeeId position department')
    .lean();
}

/**
 * Validate reporting-manager assignment: same org, not self, not a descendant, no cycle.
 * Only one organization Admin root (managerId: null) is allowed; every other employee must report to someone.
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.organizationId
 * @param {mongoose.Types.ObjectId|string|null} [params.employeeId] - employee being edited
 * @param {mongoose.Types.ObjectId|string|null} params.managerId - resolved manager ObjectId, or null for Admin root
 */
export async function validateManagerAssignment({ organizationId, employeeId, managerId }) {
  if (!managerId) {
    const existingRoots = await getOrganizationRootEmployees(organizationId);
    const isExistingRoot =
      employeeId && existingRoots.some((r) => String(r._id) === String(employeeId));
    const otherRoots = existingRoots.filter(
      (r) => !employeeId || String(r._id) !== String(employeeId)
    );

    // New top-level only when no Admin root exists yet; keep null only for the existing Admin root.
    if (!isExistingRoot && otherRoots.length > 0) {
      return {
        valid: false,
        message:
          'Only the organization Admin can be top-level. Select a reporting manager for this employee.',
      };
    }

    return { valid: true, managerId: null, manager: 'Admin' };
  }

  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    return { valid: false, message: 'Invalid manager reference.' };
  }

  if (employeeId && String(employeeId) === String(managerId)) {
    return { valid: false, message: 'An employee cannot report to themselves.' };
  }

  const manager = await Employee.findOne({
    _id: managerId,
    organizationId,
    status: 'active',
  })
    .select('_id name lastName employeeId organizationId managerId')
    .lean();

  if (!manager) {
    return { valid: false, message: 'Selected manager not found in this organization.' };
  }

  if (String(manager.organizationId) !== String(organizationId)) {
    return { valid: false, message: 'Manager must belong to the same organization.' };
  }

  if (employeeId) {
    const descendants = await getEmployeeDescendantIds(organizationId, employeeId);
    if (descendants.has(String(managerId))) {
      return {
        valid: false,
        message: 'An employee cannot report to someone in their own reporting line.',
      };
    }

    const seen = new Set([String(employeeId)]);
    let current = manager;
    while (current) {
      const currentId = String(current._id);
      if (seen.has(currentId)) {
        return {
          valid: false,
          message: 'This manager assignment would create a circular reporting line.',
        };
      }
      seen.add(currentId);
      if (!current.managerId) break;
      current = await Employee.findOne({
        _id: current.managerId,
        organizationId,
      })
        .select('_id managerId')
        .lean();
    }
  }

  const managerLabel =
    `${manager.name || ''} ${manager.lastName || ''}`.trim() || manager.employeeId || 'Manager';

  return {
    valid: true,
    managerId: manager._id,
    manager: managerLabel,
  };
}
