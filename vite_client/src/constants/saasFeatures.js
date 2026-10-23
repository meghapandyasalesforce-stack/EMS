/**
 * SaaS feature keys + nav path map (mirrors server/constants/saasFeatures.js).
 */

export const SAAS_FEATURES = {
  EMPLOYEES: 'employees',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
  RECRUITMENT: 'recruitment',
  PAYROLL: 'payroll',
  PERFORMANCE: 'performance',
  WORKFORCE_PLANNING: 'workforcePlanning',
  LIFECYCLE: 'lifecycle',
  ENGAGEMENT: 'engagement',
  DOCUMENTS: 'documents',
  ANALYTICS: 'analytics',
  PROJECTS: 'projects',
};

export const NAV_PATH_FEATURE_MAP = {
  '/employees': SAAS_FEATURES.EMPLOYEES,
  '/organization/chart': SAAS_FEATURES.EMPLOYEES,
  '/leave-management': SAAS_FEATURES.LEAVE,
  '/my-leave': SAAS_FEATURES.LEAVE,
  '/employee/leave-attendance': SAAS_FEATURES.LEAVE,
  '/calendar-management': SAAS_FEATURES.LEAVE,
  '/employee/calendar': SAAS_FEATURES.LEAVE,
  '/all-attendance-history': SAAS_FEATURES.ATTENDANCE,
  '/my-attendance-regularization': SAAS_FEATURES.ATTENDANCE,
  '/manager/attendance-regularization': SAAS_FEATURES.ATTENDANCE,
  '/attendance-regularization': SAAS_FEATURES.ATTENDANCE,
  '/recruitment': SAAS_FEATURES.RECRUITMENT,
  '/employee/internal-jobs': SAAS_FEATURES.RECRUITMENT,
  '/admin-payroll': SAAS_FEATURES.PAYROLL,
  '/employee-payroll': SAAS_FEATURES.PAYROLL,
  '/salary-structure': SAAS_FEATURES.PAYROLL,
  '/onboarding': SAAS_FEATURES.LIFECYCLE,
  '/one-on-one': SAAS_FEATURES.PERFORMANCE,
  '/benefits': SAAS_FEATURES.PERFORMANCE,
  '/learning': SAAS_FEATURES.PERFORMANCE,
  '/team-learning': SAAS_FEATURES.PERFORMANCE,
  '/employee/benefits-learning': SAAS_FEATURES.PERFORMANCE,
  '/engagement': SAAS_FEATURES.ENGAGEMENT,
  '/employee/engagement': SAAS_FEATURES.ENGAGEMENT,
  '/documents': SAAS_FEATURES.DOCUMENTS,
  '/admin/document-management': SAAS_FEATURES.DOCUMENTS,
  '/employee/documents-id': SAAS_FEATURES.DOCUMENTS,
  '/employee/my-documents': SAAS_FEATURES.DOCUMENTS,
  '/employee/document-requests': SAAS_FEATURES.DOCUMENTS,
  '/id-card-generator': SAAS_FEATURES.DOCUMENTS,
  '/workforce': SAAS_FEATURES.WORKFORCE_PLANNING,
  '/projects': SAAS_FEATURES.PROJECTS,
  '/employee/projects': SAAS_FEATURES.PROJECTS,
  '/admin/reports': SAAS_FEATURES.ANALYTICS,
  '/hr/analytics': SAAS_FEATURES.ANALYTICS,
};

/**
 * Resolve SaaS feature key for a frontend path (longest prefix match).
 */
export const featureKeyForPath = (pathname = '') => {
  const path = String(pathname).split('?')[0];
  if (NAV_PATH_FEATURE_MAP[path]) return NAV_PATH_FEATURE_MAP[path];
  let best = null;
  let bestLen = -1;
  Object.entries(NAV_PATH_FEATURE_MAP).forEach(([prefix, key]) => {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (prefix.length > bestLen) {
        best = key;
        bestLen = prefix.length;
      }
    }
  });
  return best;
};

/**
 * True when feature is enabled or not gated (missing map / empty features = allow).
 */
export const isSaasFeatureEnabled = (saasFeatures, featureKey) => {
  if (!featureKey) return true;
  if (!saasFeatures || typeof saasFeatures !== 'object') return true;
  if (!Object.keys(saasFeatures).length) return true;
  return saasFeatures[featureKey] !== false;
};

export const filterNavBySaasFeatures = (items = [], saasFeatures = {}) => {
  if (!Array.isArray(items)) return [];
  if (!saasFeatures || !Object.keys(saasFeatures).length) return items;
  return items.filter((item) => {
    const key = featureKeyForPath(item.path);
    return isSaasFeatureEnabled(saasFeatures, key);
  });
};
