import { getEffectiveFunctionalRoles } from '../middlewares/createAuthMiddleware.js';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

/**
 * Job title used for org-wide project ownership (SaaS: per-organization).
 */
export const PROJECT_MANAGER_JOB_TITLE = 'project manager';

export const isProjectManagerJobTitle = (jobTitle) =>
    normalizeText(jobTitle) === PROJECT_MANAGER_JOB_TITLE;

/**
 * True when employee is a Project Manager (explicit role or job title).
 */
export const isProjectManager = (employee) => {
    if (!employee) return false;
    const roles = getEffectiveFunctionalRoles(employee);
    if (roles.includes('project_manager')) return true;
    return isProjectManagerJobTitle(employee.jobTitle);
};

/**
 * Line manager: team-scoped HR/attendance, not org-wide project admin.
 */
export const isLineManager = (employee) => {
    if (!employee) return false;
    const roles = getEffectiveFunctionalRoles(employee);
    return roles.includes('manager') && !isProjectManager(employee);
};

/**
 * Apply team-scoped manager filters (projects, employee lists, etc.).
 */
export const shouldApplyLineManagerScope = (req) => {
    if (req.user) return false;
    if (req.employee?.isHR) return false;
    if (req.employee?.isProjectManager || isProjectManager(req.employee)) return false;
    return !!(req.employee?.isManager);
};

export default {
    PROJECT_MANAGER_JOB_TITLE,
    isProjectManagerJobTitle,
    isProjectManager,
    isLineManager,
    shouldApplyLineManagerScope
};
