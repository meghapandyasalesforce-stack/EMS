import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { PERMISSIONS } from '../utils/permissions';

/** Keep personal participation separate from the permission-protected HR workspace. */
export default function useEngagementWorkspace() {
    const auth = useSelector(state => state.auth);
    const { pathname } = useLocation();
    const flags = auth.permissionFlags || {};
    const permissions = Array.isArray(auth.permissions) ? auth.permissions : [];
    const role = String(auth.user?.role || '').toLowerCase();
    const elevated = flags.isOrgOwner || role === 'admin' || role === 'executive';
    const legacyHr = !permissions.length && (flags.isHrManager || flags.isHrExecutive || role === 'hr');
    const has = (...keys) => permissions.includes('*') || keys.some(key => permissions.includes(key));
    const surveyManagement = elevated || legacyHr || has(PERMISSIONS.ENGAGEMENT_MANAGE, PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE);
    const analytics = surveyManagement || has(PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG, PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM);
    const personal = auth.activePortal === 'employee' || pathname.startsWith('/employee/engagement');
    const canAccessWorkspace = !personal && Boolean(analytics);
    return {
        canAccessWorkspace,
        canManageSurveys: !personal && Boolean(surveyManagement),
        canViewAnalytics: !personal && Boolean(analytics),
        engagementHome: canAccessWorkspace ? '/engagement' : '/employee/engagement',
    };
}
