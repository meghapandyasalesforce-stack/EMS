/**
 * Apply SaaS list data-scope to an Employee Mongo query.
 * Scope comes from employee.accessDataScope (override) or role defaults via getDataScope.
 */

import mongoose from 'mongoose';
import { getDataScope, shouldScopeDataToManagedTeam } from './permissionService.js';
import { buildManagerMatchQuery } from './managerHelper.js';
import logger from './logger.js';

const ACCESS_SCOPES = new Set([
  'default',
  'organization',
  'department',
  'departments',
  'team',
  'self',
]);

export function normalizeAccessDataScope(value) {
  const v = String(value || 'default').toLowerCase().trim();
  return ACCESS_SCOPES.has(v) ? v : 'default';
}

/**
 * Resolve effective list scope string for the requester.
 */
export function resolveEffectiveListScope(req) {
  const emp = {
    ...(req.authContext?.employee || {}),
    ...(req.employee || {}),
  };
  const override = normalizeAccessDataScope(emp?.accessDataScope);

  if (override !== 'default') {
    return override;
  }

  if (req.authContext) {
    return getDataScope({
      ...req.authContext,
      employee: emp,
    });
  }

  if (shouldScopeDataToManagedTeam(req)) return 'team';
  return 'organization';
}

/**
 * Mutates `query` (already org-filtered) to enforce the requester's data scope.
 * @returns {{ scope: string }}
 */
export function applyEmployeeListDataScope(req, query = {}) {
  const scope = resolveEffectiveListScope(req);
  const emp = {
    ...(req.authContext?.employee || {}),
    ...(req.employee || {}),
  };

  if (scope === 'organization') {
    return { scope };
  }

  if (scope === 'self') {
    if (emp?._id) {
      query._id = emp._id;
    } else {
      query._id = null;
    }
    return { scope };
  }

  if (scope === 'team') {
    const managerQuery = buildManagerMatchQuery(emp);
    if (managerQuery?.$or) {
      if (query.$or) {
        const existingOr = query.$or;
        delete query.$or;
        query.$and = [
          ...(Array.isArray(query.$and) ? query.$and : []),
          { $or: existingOr },
          managerQuery,
        ];
      } else {
        Object.assign(query, managerQuery);
      }
    } else if (emp?._id) {
      query._id = emp._id;
    }
    query.status = query.status || 'active';
    return { scope };
  }

  if (scope === 'department') {
    const deptId = emp?.departmentId;
    if (deptId) {
      query.departmentId = deptId;
    } else if (emp?.department) {
      query.department = emp.department;
    } else if (emp?._id) {
      query._id = emp._id;
    }
    return { scope };
  }

  if (scope === 'departments') {
    const ids = Array.isArray(emp?.accessDepartmentIds)
      ? emp.accessDepartmentIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    if (ids.length > 0) {
      query.departmentId = { $in: ids };
    } else if (emp?.departmentId) {
      query.departmentId = emp.departmentId;
    } else if (emp?._id) {
      query._id = emp._id;
    }
    return { scope };
  }

  logger.debug('Unknown list data scope; leaving org filter only', { scope });
  return { scope: 'organization' };
}
