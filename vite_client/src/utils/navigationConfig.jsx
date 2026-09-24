/**
 * Navigation Configuration
 * Defines menu items for different user roles, departments, and positions
 */

import {
    FaHome, FaUsers, FaProjectDiagram, FaCalendarAlt, FaMoneyBill,
    FaCog, FaShieldAlt, FaCreditCard, FaDollarSign, FaFileAlt,
    FaChartLine, FaBuilding, FaTasks, FaUserCheck, FaBell,
    FaGraduationCap, FaHandshake, FaFolderOpen, FaGift, FaUserTie,
    FaChartBar, FaClock
} from 'react-icons/fa';
import { FaCrown } from 'react-icons/fa6';
import { IoBookmarks } from 'react-icons/io5';
import { CgProfile } from 'react-icons/cg';
import { VscProject } from 'react-icons/vsc';
import { mergeSessionProfile } from './profileUtils';
import { isProjectManager } from './projectManagerHelper';
import { PERMISSIONS, filterNavByPermissions } from './permissions';
import { SYSTEM_ROLE_IDS } from './systemRoles';
import { filterNavBySaasFeatures } from '../constants/saasFeatures';

/**
 * Get navigation items based on user role, department, and position
 * @param {Object} user - User object from Redux
 * @param {Object} employee - Employee object from Redux
 * @returns {Array} Array of navigation items
 */
const resolveNavFromRbac = (permissionFlags, role, position, profile) => {
    if (!permissionFlags || !Object.keys(permissionFlags).length) {
        return null;
    }
    if (permissionFlags.isOrgOwner || (role === 'admin' && permissionFlags.isHrManager)) {
        return getAdminNavigation();
    }
    if (permissionFlags.isExecutive) {
        return getExecutiveNavigation(position);
    }
    if (permissionFlags.isHrManager || permissionFlags.isHrExecutive) {
        return getHrPortalNavigation(permissionFlags);
    }
    if (permissionFlags.isPayrollAdmin) {
        return getFinanceNavigation();
    }
    if (permissionFlags.isProjectManager && !permissionFlags.isLineManager) {
        return getProjectManagerNavigation();
    }
    if (permissionFlags.isLineManager || permissionFlags.isProjectManager) {
        return getManagerNavigation(profile);
    }
    return null;
};

/**
 * Me portal workspace role from admin-assigned employee functional roles.
 * Ignores org-owner / HR platform elevation (those use Admin / HR portal tabs).
 */
export const resolveMePortalSystemRole = (profile = {}) => {
    const functional = new Set(
        (profile?.functionalRoles || []).map((role) => String(role).toLowerCase())
    );

    if (
        functional.has('executive') ||
        functional.has('ceo') ||
        functional.has('cto') ||
        functional.has('cfo') ||
        functional.has('vp')
    ) {
        return SYSTEM_ROLE_IDS.EXECUTIVE;
    }
    if (functional.has('finance')) {
        return SYSTEM_ROLE_IDS.PAYROLL_ADMIN;
    }
    if (functional.has('hr')) {
        return SYSTEM_ROLE_IDS.HR_EXECUTIVE;
    }
    if (functional.has('project_manager')) {
        return SYSTEM_ROLE_IDS.PROJECT_MANAGER;
    }
    if (functional.has('manager')) {
        return SYSTEM_ROLE_IDS.LINE_MANAGER;
    }
    if (profile?.systemRoleId) {
        return profile.systemRoleId;
    }
    return SYSTEM_ROLE_IDS.EMPLOYEE;
};

/** Default route when opening the Me portal tab. */
export const getMePortalHomePath = (profile = {}) => {
    switch (resolveMePortalSystemRole(profile)) {
        case SYSTEM_ROLE_IDS.PROJECT_MANAGER:
            return '/dashboard-manager';
        case SYSTEM_ROLE_IDS.LINE_MANAGER:
            return '/dashboard-manager';
        case SYSTEM_ROLE_IDS.PAYROLL_ADMIN:
            return '/dashboard-finance';
        case SYSTEM_ROLE_IDS.EXECUTIVE:
            return '/dashboard-administration';
        case SYSTEM_ROLE_IDS.HR_MANAGER:
        case SYSTEM_ROLE_IDS.HR_EXECUTIVE:
            return '/dashboard-hr';
        default:
            return '/dashboard-employee';
    }
};

const getNavigationForMePortal = ({ profile, permissions, permissionFlags, position }) => {
    // Always return standard employee navigation for all employees in the Me portal
    const items = getEmployeeNavigation();
    return filterNavByPermissions(items, permissions);
};

const getNavigationForPortal = (portalId, { position, department, jobTitle, profile, permissions, permissionFlags = {} }) => {
    switch (portalId) {
        case 'admin':
            return filterNavByPermissions(getAdminNavigation(), permissions);
        case 'executive':
            return filterNavByPermissions(getExecutiveNavigation(position), permissions);
        case 'hr_manager':
            return filterNavByPermissions(getHrPortalNavigation(permissionFlags), permissions);
        case 'payroll_admin':
            return filterNavByPermissions(getFinanceNavigation(), permissions);
        case 'line_manager':
            return filterNavByPermissions(getManagerNavigation(profile), permissions);
        case 'project_manager':
            return filterNavByPermissions(getProjectManagerNavigation(), permissions);
        case 'employee':
            return getNavigationForMePortal({ profile, permissions, permissionFlags, position });
        default:
            break;
    }

    if (isExecutive(position)) {
        return filterNavByPermissions(getExecutiveNavigation(position), permissions);
    }
    const isHRRole = isHR(department, jobTitle, position);
    const isPureProjectManager =
        isProjectManager(profile) &&
        !(permissionFlags.isLineManager || (Array.isArray(profile?.functionalRoles) &&
            profile.functionalRoles.some((r) => String(r).toLowerCase() === 'manager')));
    const isManagerRole = isManager(position, jobTitle) || isProjectManager(profile);
    if (isHRRole) {
        return filterNavByPermissions(getHrPortalNavigation(permissionFlags), permissions);
    }
    if (isPureProjectManager) {
        return filterNavByPermissions(getProjectManagerNavigation(), permissions);
    }
    if (isManagerRole) {
        return filterNavByPermissions(getManagerNavigation(profile), permissions);
    }
    if (isFinance(department)) {
        return filterNavByPermissions(getFinanceNavigation(), permissions);
    }
    if (isTech(department)) {
        return filterNavByPermissions(getTechNavigation(), permissions);
    }
    return filterNavByPermissions(getEmployeeNavigation(), permissions);
};

export const getNavigationItems = (
    user,
    employee,
    permissions = [],
    permissionFlags = {},
    activePortal = null,
    saasFeatures = {}
) => {
    const profile = mergeSessionProfile(user, employee);
    const role = profile?.role || 'employee';
    const department = (profile?.department || '').toLowerCase().trim();
    const position = (profile?.position || '').toLowerCase().trim();
    const jobTitle = (profile?.jobTitle || '').toLowerCase().trim();

    if (activePortal) {
        return filterNavBySaasFeatures(
            getNavigationForPortal(activePortal, {
                position,
                department,
                jobTitle,
                profile,
                permissions,
                permissionFlags,
            }),
            saasFeatures
        );
    }

    let items =
        resolveNavFromRbac(permissionFlags, role, position, profile) ||
        (role === 'admin' ? getAdminNavigation() : null);

    if (!items) {
        // For employees, always return standard navigation regardless of department/position
        if (role === 'employee') {
            items = getEmployeeNavigation();
        } else if (isExecutive(position)) {
            items = getExecutiveNavigation(position);
        } else {
            const isHRRole = isHR(department, jobTitle, position);
            const isPurePm =
                isProjectManager(profile) &&
                !(Array.isArray(profile?.functionalRoles) &&
                    profile.functionalRoles.some((r) => String(r).toLowerCase() === 'manager'));
            const isManagerRole = isManager(position, jobTitle) || isProjectManager(profile);
            if (isHRRole) {
                items = getHrPortalNavigation(permissionFlags);
            } else if (isPurePm) {
                items = getProjectManagerNavigation();
            } else if (isManagerRole) {
                items = getManagerNavigation(profile);
            } else if (isFinance(department)) {
                items = getFinanceNavigation();
            } else if (isTech(department)) {
                items = getTechNavigation();
            } else {
                items = getEmployeeNavigation();
            }
        }
    }

    return filterNavBySaasFeatures(
        filterNavByPermissions(items, permissions),
        saasFeatures
    );
};

/**
 * Check if user is an executive
 */
export const isExecutive = (position) => {
    return position === 'ceo' || 
           position === 'cto' || 
           position === 'cfo' || 
           position === 'vp' ||
           position === 'vice president' ||
           position.includes('chief executive') ||
           position.includes('chief technology') ||
           position.includes('chief financial');
};

/**
 * Check if user is a manager
 */
const isManager = (position, jobTitle) => {
    return position === 'manager' || 
           position === 'director' ||
           position.includes('manager') ||
           position.includes('director') ||
           jobTitle.includes('manager') ||
           jobTitle.includes('director');
};

/**
 * Check if user is HR (including HR Managers)
 */
const isHR = (department, jobTitle, position) => {
    return department === 'hr' || 
           department.includes('hr') || 
           department.includes('human resource') ||
           jobTitle.includes('hr manager') ||
           jobTitle.includes('human resource') ||
           jobTitle.includes('hr') ||
           position.includes('hr manager') ||
           position.includes('hr');
};

/**
 * Check if user is Finance
 */
const isFinance = (department) => {
    return department === 'finance' || 
           department.includes('finance') ||
           department === 'accounting';
};

/**
 * Check if user is Tech
 */
const isTech = (department) => {
    return department === 'technology' ||
           department === 'tech' ||
           department.includes('technology') ||
           department === 'it' ||
           (department.includes('it') && !department.includes('support'));
};

/**
 * Admin Navigation Items
 */
const getAdminNavigation = () => [
    { path: "/dashboard-admin", name: "Dashboard", icon: <FaHome /> },
    { path: "/organization/chart", name: "Organization", icon: <FaBuilding />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EXECUTIVE_DASHBOARD, PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    // { path: "/organization/structure", name: "Org Structure", icon: <FaBuilding />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/employees", name: "Employees", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck />, permissions: [PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/leave-management", name: "Leave management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/role-hierarchy", name: "Role hierarchy", icon: <FaShieldAlt />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/admin/platform-roles", name: "Users & roles", icon: <FaUserTie />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE] },
    { path: "/admin/approval-workflows", name: "Approval workflows", icon: <FaTasks />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/admin/pending-approvals", name: "Pending approvals", icon: <FaClock />, permissions: [PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM] },
    { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/one-on-one", name: "One-on-one", icon: <FaUserCheck /> },
    { path: "/salary-structure", name: "Salary structure", icon: <FaDollarSign />, permissions: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_CREATE] },
    { path: "/admin/document-management", name: "Document management", icon: <FaFileAlt /> },
    { path: "/organization/subscription", name: "Subscription", icon: <FaCreditCard />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/admin-settings", name: "Settings", icon: <FaCog />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
];

/**
 * Executive Navigation Items (CEO, CTO, CFO, VP)
 */
const getExecutiveNavigation = (position) => {
    const baseItems = [
        { path: "/dashboard-administration", name: "Dashboard", icon: <FaCrown /> },
        { path: "/organization/chart", name: "Organization", icon: <FaBuilding /> },
        { path: "/employees", name: "Employees", icon: <FaUsers /> },
        { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck /> },
        { path: "/projects", name: "Projects", icon: <FaProjectDiagram /> },
        { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
        { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
        { path: "/leave-management", name: "Leave management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
        { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
        { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt /> },
        { path: "/admin/reports", name: "Reports & analytics", icon: <FaChartBar /> },
        { path: "/organization/subscription", name: "Subscription", icon: <FaCreditCard /> },
        { path: "/admin-settings", name: "Settings", icon: <FaCog /> }
    ];

    // Add CFO-specific items
    if (position === 'cfo' || position.includes('financial')) {
        baseItems.splice(1, 0, 
            { path: "/dashboard-finance", name: "Finance dashboard", icon: <FaDollarSign /> }
        );
    }

    // Add CTO-specific items
    if (position === 'cto' || position.includes('technology')) {
        baseItems.splice(1, 0,
            { path: "/dashboard/tech", name: "Tech dashboard", icon: <FaProjectDiagram /> }
        );
    }

    return baseItems;
};

/**
 * Project Manager Navigation — dashboard + org projects; no people-manager team HR.
 */
const getProjectManagerNavigation = () => [
    { path: "/dashboard-manager", name: "Dashboard", icon: <FaUserTie /> },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/employee/leave-attendance", name: "Leave & attendance", icon: <FaChartLine /> },
    { path: "/my-attendance-regularization", name: "Regularization", icon: <FaClock /> },
    { path: "/employee/internal-jobs", name: "Internal jobs", icon: <FaHandshake /> },
    { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "My payroll", icon: <FaMoneyBill /> },
    { path: "/employee/documents-id", name: "Documents & ID", icon: <FaFolderOpen /> },
    { path: "/employee/document-requests", name: "Document requests", icon: <FaFileAlt /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> },
];

/**
 * Manager Navigation Items
 * Comprehensive list of all manager functions and features.
 * Project Managers do not get "My Team" — they manage via Projects, not direct reports.
 */
const getManagerNavigation = (profile) => {
    const items = [
    { path: "/dashboard-manager", name: "Dashboard", icon: <FaUserTie /> },
    { path: "/employees", name: "My team", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_TEAM, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/organization/chart", name: "Organization", icon: <FaBuilding />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_TEAM, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/leave-management", name: "Leave management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_TEAM, PERMISSIONS.LEAVE_VIEW_ALL] },
    { path: "/employee/leave-attendance", name: "Leave & attendance", icon: <FaChartLine /> },
    { path: "/all-attendance-history", name: "Team attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_TEAM, PERMISSIONS.ATTENDANCE_VIEW_ALL] },
    { path: "/manager/attendance-regularization", name: "Regularization/WFH", icon: <FaClock /> },
    { path: "/employee/internal-jobs", name: "Hiring/Internal jobs", icon: <FaHandshake /> },
    { path: "/team-learning", name: "Team learning", icon: <FaGraduationCap /> },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/engagement", name: "Team analytics", icon: <FaChartBar />, permissions: [PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM] },
    { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "My payroll", icon: <FaMoneyBill /> },
    { path: "/employee/documents-id", name: "Documents & ID", icon: <FaFolderOpen /> },
    { path: "/employee/document-requests", name: "Document requests", icon: <FaFileAlt /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
    ];
    

    if (isProjectManager(profile)) {
        // Hybrid PM+line manager keeps team nav minus "My Team" directory;
        // pure PM uses getProjectManagerNavigation instead.
        return items.filter((item) => item.path !== '/employees');
    }
    return items;
};


/**
 * Full HR sidebar items (shared base).
 */
const HR_NAV_ITEMS = [
    { path: "/dashboard-hr", name: "Dashboard", icon: <FaUsers /> },
    { path: "/employees", name: "Employees", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    { path: "/organization/chart", name: "Organization", icon: <FaBuilding />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    { path: "/recruitment", name: "Recruitment", icon: <FaHandshake />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck />, permissions: [PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/learning", name: "Learning & development", icon: <FaGraduationCap /> },
    { path: "/engagement", name: "Employee engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_MANAGE, PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE, PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG, PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM] },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/documents", name: "Documents", icon: <FaFolderOpen /> },
    { path: "/admin/document-management", name: "Document management", icon: <FaFileAlt /> },
    { path: "/benefits", name: "Benefits", icon: <FaGift /> },
    { path: "/succession", name: "Succession planning", icon: <FaUserTie /> },
    { path: "/workforce", name: "Workforce planning", icon: <FaChartBar /> },
    { path: "/leave-management", name: "Leave management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
    { path: "/employee/leave-attendance", name: "Leave & attendance", icon: <FaChartLine /> },
    { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
    { path: "/attendance-regularization", name: "Regularization/WFH", icon: <FaClock /> },
    // { path: "/attendance-regularization", name: "Attendance Regularization", icon: <FaClock /> },
    { path: "/admin/pending-approvals", name: "Pending approvals", icon: <FaClock /> },
    // { path: "/attendance-regularization", name: "Regularization & WFH", icon: <FaClock /> },
    // { path: "/my-attendance-regularization", name: "Attendance Regularization", icon: <FaClock /> },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/employee-payroll", name: "My payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_SELF] },
    { path: "/id-card-generator", name: "ID cards", icon: <FaCreditCard /> },
    { path: "/admin/reports", name: "HR reports", icon: <FaFileAlt /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> },
];

/** HR Manager — all HR options except Projects */
const getHRManagerNavigation = () =>
    HR_NAV_ITEMS.filter((item) => item.path !== '/projects');

/** HR Executive — no Projects or admin Payroll; keeps My Payroll */
const getHRExecutiveNavigation = () =>
    HR_NAV_ITEMS.filter(
        (item) => item.path !== '/projects' && item.path !== '/admin-payroll'
    );

const getHrPortalNavigation = (permissionFlags = {}) => {
    if (permissionFlags.isHrExecutive && !permissionFlags.isHrManager) {
        return getHRExecutiveNavigation();
    }
    return getHRManagerNavigation();
};

/** @deprecated Use getHrPortalNavigation — kept for imports */
const getHRNavigation = () => getHRManagerNavigation();


/**
 * Finance Navigation Items
 */
const getFinanceNavigation = () => [
    { path: "/dashboard-finance", name: "Dashboard", icon: <FaDollarSign /> },
    { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck /> },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/salary-structure", name: "Salary structure", icon: <FaDollarSign />, permissions: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_CREATE] },
    { path: "/admin/reports", name: "Financial reports", icon: <FaChartBar /> },
    { path: "/employees", name: "Employees", icon: <FaUsers /> },
    { path: "/my-leave", name: "My leave", icon: <FaCalendarAlt /> },
    { path: "/my-attendance-regularization", name: "Regularization", icon: <FaClock /> },
    { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "My payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * Tech Navigation Items
 */
const getTechNavigation = () => [
    { path: "/dashboard/tech", name: "Dashboard", icon: <FaProjectDiagram /> },
    { path: "/onboarding", name: "Employee lifecycle", icon: <FaUserCheck /> },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram /> },
    { path: "/employee/projects", name: "My projects", icon: <VscProject /> },
    { path: "/employee/leave-attendance", name: "Leave & attendance", icon: <IoBookmarks /> },
    { path: "/my-attendance-regularization", name: "Regularization", icon: <FaClock /> },
    { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * Employee Navigation Items (Default)
 */
const getEmployeeNavigation = () => [
    { path: "/dashboard-employee", name: "Dashboard", icon: <FaHome /> },
    { path: "/employee/leave-attendance", name: "Leave & attendance", icon: <IoBookmarks /> },
    { path: "/my-attendance-regularization", name: "Regularization", icon: <FaClock /> },
    { path: "/employee/projects", name: "Projects", icon: <VscProject /> },
    { path: "/employee/engagement", name: "Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_SURVEY_TAKE, PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT, PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE, PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/employee/benefits-learning", name: "Benefits & learning", icon: <FaGift /> },
    { path: "/employee/internal-jobs", name: "Internal jobs", icon: <FaHandshake /> },
    { path: "/onboarding", name: "My lifecycle", icon: <FaUserCheck /> },
    { path: "/employee/documents-id", name: "Documents & ID", icon: <FaFolderOpen /> },
    { path: "/employee/document-requests", name: "Document requests", icon: <FaFileAlt /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> },
];

