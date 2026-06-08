/**
 * Navigation Configuration
 * Defines menu items for different user roles, departments, and positions
 */

import {
    FaHome, FaUsers, FaProjectDiagram, FaCalendarAlt, FaMoneyBill,
    FaCog, FaShieldAlt, FaCreditCard, FaDollarSign, FaFileAlt,
    FaChartLine, FaBuilding, FaTasks, FaUserCheck, FaBell,
    FaGraduationCap, FaHandshake, FaFolderOpen, FaGift, FaUserTie,
    FaChartBar, FaIdCard, FaClock, FaEnvelope
} from 'react-icons/fa';
import { FaCrown } from 'react-icons/fa6';
import { IoBookmarks } from 'react-icons/io5';
import { CgProfile } from 'react-icons/cg';
import { VscProject } from 'react-icons/vsc';
import { mergeSessionProfile } from './profileUtils';
import { isProjectManager } from './projectManagerHelper';
import { PERMISSIONS, filterNavByPermissions } from './permissions';

/**
 * Get navigation items based on user role, department, and position
 * @param {Object} user - User object from Redux
 * @param {Object} employee - Employee object from Redux
 * @returns {Array} Array of navigation items
 */
const resolveNavFromRbac = (permissionFlags, role, position) => {
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
        return getHRNavigation();
    }
    if (permissionFlags.isPayrollAdmin) {
        return getFinanceNavigation();
    }
    if (permissionFlags.isLineManager) {
        return getManagerNavigation();
    }
    return null;
};

export const getNavigationItems = (
    user,
    employee,
    permissions = [],
    permissionFlags = {}
) => {
    const profile = mergeSessionProfile(user, employee);
    const role = profile?.role || 'employee';
    const department = (profile?.department || '').toLowerCase().trim();
    const position = (profile?.position || '').toLowerCase().trim();
    const jobTitle = (profile?.jobTitle || '').toLowerCase().trim();

    let items =
        resolveNavFromRbac(permissionFlags, role, position) ||
        (role === 'admin' ? getAdminNavigation() : null);

    if (!items) {
        if (isExecutive(position)) {
            items = getExecutiveNavigation(position);
        } else {
            const isHRRole = isHR(department, jobTitle, position);
            const isManagerRole = isManager(position, jobTitle) || isProjectManager(profile);
            if (isHRRole) {
                items = getHRNavigation();
            } else if (isManagerRole) {
                items = getManagerNavigation();
            } else if (isFinance(department)) {
                items = getFinanceNavigation();
            } else if (isTech(department)) {
                items = getTechNavigation();
            } else {
                items = getEmployeeNavigation();
            }
        }
    }

    return filterNavByPermissions(items, permissions);
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
    { path: "/organization/dashboard", name: "Organization", icon: <FaBuilding />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EXECUTIVE_DASHBOARD] },
    { path: "/employees", name: "Employees", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/role-hierarchy", name: "Role Hierarchy", icon: <FaShieldAlt />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/admin/platform-roles", name: "Users & Roles", icon: <FaUserTie />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE] },
    { path: "/admin/approval-workflows", name: "Approval Workflows", icon: <FaTasks />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/admin/pending-approvals", name: "Pending Approvals", icon: <FaClock />, permissions: [PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM] },
    { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/id-card-generator", name: "ID Cards", icon: <FaCreditCard />, permissions: [PERMISSIONS.ID_CARD_MANAGE] },
    { path: "/salary-structure", name: "Salary Structure", icon: <FaDollarSign />, permissions: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_CREATE] },
    { path: "/admin-settings", name: "Settings", icon: <FaCog />, permissions: [PERMISSIONS.ORG_SETTINGS_MANAGE] },
];

/**
 * Executive Navigation Items (CEO, CTO, CFO, VP)
 */
const getExecutiveNavigation = (position) => {
    const baseItems = [
        { path: "/dashboard-administration", name: "Dashboard", icon: <FaCrown /> },
        { path: "/organization/dashboard", name: "Organization", icon: <FaBuilding /> },
        { path: "/employees", name: "Employees", icon: <FaUsers /> },
        { path: "/projects", name: "Projects", icon: <FaProjectDiagram /> },
        { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
        { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
        { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
        { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt /> },
        { path: "/admin/reports", name: "Reports & Analytics", icon: <FaChartBar /> },
        { path: "/admin-settings", name: "Settings", icon: <FaCog /> }
    ];

    // Add CFO-specific items
    if (position === 'cfo' || position.includes('financial')) {
        baseItems.splice(1, 0, 
            { path: "/dashboard-finance", name: "Finance Dashboard", icon: <FaDollarSign /> }
        );
    }

    // Add CTO-specific items
    if (position === 'cto' || position.includes('technology')) {
        baseItems.splice(1, 0,
            { path: "/dashboard/tech", name: "Tech Dashboard", icon: <FaProjectDiagram /> }
        );
    }

    return baseItems;
};

/**
 * Manager Navigation Items
 * Comprehensive list of all manager functions and features
 */
const getManagerNavigation = () => [
    { path: "/dashboard-manager", name: "Dashboard", icon: <FaUserTie /> },
    { path: "/employees", name: "My Team", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_TEAM, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/projects", name: "All Projects", icon: <FaProjectDiagram />, permissions: [PERMISSIONS.PROJECT_ADMIN_VIEW] },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_TEAM, PERMISSIONS.LEAVE_VIEW_ALL] },
    { path: "/employee/leave-attendance", name: "Leave & Attendance", icon: <FaChartLine /> },
    { path: "/all-attendance-history", name: "Team Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_TEAM, PERMISSIONS.ATTENDANCE_VIEW_ALL] },
    { path: "/manager/attendance-regularization", name: "Attendance Regularization", icon: <FaClock /> },
    { path: "/team-learning", name: "Team Learning", icon: <FaGraduationCap /> },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "My Payroll", icon: <FaMoneyBill /> },
    { path: "/employee/id-card", name: "ID Card", icon: <FaCreditCard /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * HR Navigation Items
 */
const getHRNavigation = () => [
    { path: "/dashboard-hr", name: "Dashboard", icon: <FaUsers /> },
    { path: "/employees", name: "Employees", icon: <FaUsers />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM] },
    { path: "/recruitment", name: "Recruitment", icon: <FaHandshake />, permissions: [PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/onboarding", name: "Onboarding", icon: <FaUserCheck />, permissions: [PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EMPLOYEE_VIEW_ALL] },
    { path: "/learning", name: "Learning & Development", icon: <FaGraduationCap /> },
    { path: "/engagement", name: "Employee Engagement", icon: <FaBell />, permissions: [PERMISSIONS.ENGAGEMENT_MANAGE] },
    { path: "/documents", name: "Documents", icon: <FaFolderOpen /> },
    { path: "/benefits", name: "Benefits", icon: <FaGift /> },
    { path: "/succession", name: "Succession Planning", icon: <FaUserTie /> },
    { path: "/workforce", name: "Workforce Planning", icon: <FaChartBar /> },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM] },
    { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt />, permissions: [PERMISSIONS.LEAVE_POLICY_MANAGE, PERMISSIONS.ORG_SETTINGS_MANAGE] },
    { path: "/all-attendance-history", name: "Attendance", icon: <IoBookmarks />, permissions: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM] },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/id-card-generator", name: "ID Cards", icon: <FaCreditCard />, permissions: [PERMISSIONS.ID_CARD_MANAGE] },
    { path: "/admin/reports", name: "HR Reports", icon: <FaFileAlt /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];


/**
 * Finance Navigation Items
 */
const getFinanceNavigation = () => [
    { path: "/dashboard-finance", name: "Dashboard", icon: <FaDollarSign /> },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill />, permissions: [PERMISSIONS.PAYROLL_VIEW_ALL] },
    { path: "/salary-structure", name: "Salary Structure", icon: <FaDollarSign />, permissions: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_CREATE] },
    { path: "/admin/reports", name: "Financial Reports", icon: <FaChartBar /> },
    { path: "/employees", name: "Employees", icon: <FaUsers /> },
    { path: "/my-leave", name: "My Leave", icon: <FaCalendarAlt /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "My Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * Tech Navigation Items
 */
const getTechNavigation = () => [
    { path: "/dashboard/tech", name: "Dashboard", icon: <FaProjectDiagram /> },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram /> },
    { path: "/employee/projects", name: "My Projects", icon: <VscProject /> },
    { path: "/employee/leave-attendance", name: "Leave & Attendance", icon: <IoBookmarks /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * Employee Navigation Items (Default)
 */
const getEmployeeNavigation = () => [
    { path: "/dashboard-employee", name: "Dashboard", icon: <FaHome /> },
    { path: "/employee/leave-attendance", name: "Leave & Attendance", icon: <IoBookmarks /> },
    { path: "/my-attendance-regularization", name: "Attendance Regularization", icon: <FaClock /> },
    { path: "/employee/projects", name: "Projects", icon: <VscProject /> },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/employee/benefits-learning", name: "Benefits & Learning", icon: <FaGift /> },
    { path: "/employee/documents-id", name: "Documents & ID", icon: <FaFolderOpen /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

