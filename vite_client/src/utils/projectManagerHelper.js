/**
 * Project Manager helpers (org-wide projects & employee assignment).
 */

const normalizeText = (value) => String(value || '').toLowerCase().trim();

export const PROJECT_MANAGER_JOB_TITLE = 'project manager';

export const hasProjectManagerFunctionalRole = (user) => {
    const roles = Array.isArray(user?.functionalRoles) ? user.functionalRoles : [];
    return roles.some((role) => normalizeText(role) === 'project_manager');
};

export const isProjectManager = (user) => {
    if (!user) return false;
    if (hasProjectManagerFunctionalRole(user)) return true;
    return normalizeText(user.jobTitle) === PROJECT_MANAGER_JOB_TITLE;
};

/** Can access admin project routes (create, list all, assign members). */
export const canManageOrganizationProjects = (user) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return isProjectManager(user);
};
