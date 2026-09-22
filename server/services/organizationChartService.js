import Employee from '../models/employee.model.js';
import OrgDepartment from '../models/orgMasters/department.model.js';
import { applyEmployeeListDataScope } from '../helpers/employeeListScopeHelper.js';

const CHART_SELECT =
  'name lastName employeeId jobTitle position department departmentId managerId manager status active profilePhoto city isOrgOwnerRoot userId';

function sanitizeProfilePhoto(profilePhoto) {
  if (!profilePhoto || typeof profilePhoto !== 'object') return null;
  return {
    url: profilePhoto.url || null,
    thumbnailUrl: profilePhoto.thumbnailUrl || null,
    filename: profilePhoto.filename || null,
  };
}

function resolveManagerLinkState(emp, visibleIds, employeeById) {
  const mgrId = emp.managerId ? String(emp.managerId) : null;

  if (!mgrId) {
    const label = String(emp.manager || '').trim().toUpperCase();
    const legacyTop = !label || label === 'CEO' || label === 'ADMIN';
    if (legacyTop) {
      return { reportsTo: null, managerState: 'top_level' };
    }
    return { reportsTo: null, managerState: 'unresolved' };
  }

  if (!visibleIds.has(mgrId)) {
    return { reportsTo: null, managerState: 'manager_not_visible' };
  }

  const managerRecord = employeeById.get(mgrId);
  if (!managerRecord) {
    return { reportsTo: null, managerState: 'manager_missing' };
  }

  if (managerRecord.status !== 'active') {
    return { reportsTo: mgrId, managerState: 'manager_inactive' };
  }

  return { reportsTo: mgrId, managerState: 'linked' };
}

function detectCycleStart(empId, employeeById) {
  const seen = new Set();
  let current = employeeById.get(String(empId));
  while (current) {
    const id = String(current.id || current._id);
    if (seen.has(id)) return true;
    seen.add(id);
    const reportsTo = current.reportsTo;
    if (!reportsTo) break;
    current = employeeById.get(String(reportsTo));
  }
  return false;
}

/**
 * Build organization-chart payload scoped to the requester's employee visibility.
 */
export async function getOrganizationChartPayload(organizationId, req) {
  const query = {
    organizationId,
    status: { $ne: 'terminated' },
  };

  const { scope } = applyEmployeeListDataScope(req, query);

  const rows = await Employee.find(query).select(CHART_SELECT).sort('name lastName').lean();

  const visibleIds = new Set(rows.map((r) => String(r._id)));
  const employeeById = new Map();

  const nodes = rows.map((row) => {
    const id = String(row._id);
    return {
      id,
      employeeId: row.employeeId,
      name: row.name,
      lastName: row.lastName || '',
      jobTitle: row.jobTitle || '',
      position: row.position || '',
      department: row.department || '',
      departmentId: row.departmentId ? String(row.departmentId) : null,
      managerId: row.managerId ? String(row.managerId) : null,
      managerName: row.manager || null,
      status: row.status,
      active: row.active !== false,
      city: row.city || null,
      profilePhoto: sanitizeProfilePhoto(row.profilePhoto),
      isOrgOwnerRoot: row.isOrgOwnerRoot === true,
      reportsTo: null,
      managerState: 'top_level',
      directReportsCount: 0,
      hasCycle: false,
    };
  });

  for (const node of nodes) {
    employeeById.set(node.id, node);
  }

  for (const node of nodes) {
    const row = rows.find((r) => String(r._id) === node.id);
    const { reportsTo, managerState } = resolveManagerLinkState(row, visibleIds, employeeById);
    // Never allow self-reporting links in the chart tree
    if (reportsTo && String(reportsTo) === String(node.id)) {
      node.reportsTo = null;
      node.managerState = 'unresolved';
    } else {
      node.reportsTo = reportsTo;
      node.managerState = managerState;
    }
  }

  // Break circular manager chains so the client layout cannot recurse forever
  for (const node of nodes) {
    if (!node.reportsTo) continue;
    if (detectCycleStart(node.id, employeeById)) {
      node.hasCycle = true;
      node.reportsTo = null;
      if (node.managerState === 'linked' || node.managerState === 'manager_inactive') {
        node.managerState = 'unresolved';
      }
    }
  }

  const childrenCount = new Map();
  for (const node of nodes) {
    if (!node.reportsTo) continue;
    const parentKey = String(node.reportsTo);
    childrenCount.set(parentKey, (childrenCount.get(parentKey) || 0) + 1);
  }

  for (const node of nodes) {
    node.directReportsCount = childrenCount.get(node.id) || 0;
    if (!node.hasCycle) {
      node.hasCycle = detectCycleStart(node.id, employeeById);
    }
  }

  const catalogRows = await OrgDepartment.find({
    organizationId,
    status: 'active',
  })
    .select('name _id status')
    .sort('name')
    .lean();

  const normalizeDeptName = (name) => String(name || '').trim().toLowerCase();

  // One chip per department name (case-insensitive). Catalog id preferred when present.
  const departmentByName = new Map();
  for (const row of catalogRows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const norm = normalizeDeptName(name);
    if (!departmentByName.has(norm)) {
      departmentByName.set(norm, {
        id: String(row._id),
        name,
        employeeCount: 0,
      });
    }
  }

  for (const node of nodes) {
    const label = String(node.department || '').trim();
    if (!label) continue;
    const norm = normalizeDeptName(label);

    // Prefer catalog match by departmentId, then by name
    let entry = null;
    if (node.departmentId) {
      entry = [...departmentByName.values()].find((d) => d.id === String(node.departmentId));
    }
    if (!entry) {
      entry = departmentByName.get(norm);
    }
    if (!entry) {
      entry = {
        id: node.departmentId || label,
        name: label,
        employeeCount: 0,
      };
      departmentByName.set(norm, entry);
    }
    entry.employeeCount += 1;
  }

  const departments = [...departmentByName.values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const positionLevels = [...new Set(nodes.map((n) => n.position).filter(Boolean))].sort();

  return {
    employees: nodes,
    departments,
    positionLevels,
    meta: {
      total: nodes.length,
      scope,
      organizationId: String(organizationId),
    },
  };
}
