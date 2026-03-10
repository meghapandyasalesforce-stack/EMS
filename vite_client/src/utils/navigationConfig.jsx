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

/**
 * Get navigation items based on user role, department, and position
 * @param {Object} user - User object from Redux
 * @param {Object} employee - Employee object from Redux
 * @returns {Array} Array of navigation items
 */
export const getNavigationItems = (user, employee) => {
    // Get user attributes
    const role = user?.role || employee?.role || 'employee';
    const department = (user?.department || employee?.department || '').toLowerCase().trim();
    const position = (user?.position || employee?.position || '').toLowerCase().trim();
    const jobTitle = (user?.jobTitle || employee?.jobTitle || '').toLowerCase().trim();

    // Admin Navigation (for admin users)
    if (role === 'admin') {
        return getAdminNavigation();
    }

    // Executive Navigation (CEO, CTO, CFO, VP)
    if (isExecutive(position)) {
        return getExecutiveNavigation(position);
    }

    // Check if user is HR (priority - HR takes precedence over Manager)
    const isHRRole = isHR(department, jobTitle, position);
    const isManagerRole = isManager(position, jobTitle);
    
    // HR Navigation (HR takes priority - even HR Managers get HR navigation only)
    if (isHRRole) {
        return getHRNavigation();
    }
    
    // Manager/Director Navigation (for non-HR managers only)
    if (isManagerRole) {
        return getManagerNavigation();
    }

    // Finance Navigation
    if (isFinance(department)) {
        return getFinanceNavigation();
    }

    // Tech Navigation
    if (isTech(department)) {
        return getTechNavigation();
    }

    // Default Employee Navigation
    return getEmployeeNavigation();
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
    { path: "/organization/dashboard", name: "Organization", icon: <FaBuilding /> },
    { path: "/employees", name: "Employees", icon: <FaUsers /> },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt /> },
    { path: "/projects", name: "Projects", icon: <FaProjectDiagram /> },
    { path: "/today-attendance", name: "Attendance", icon: <IoBookmarks /> },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/role-hierarchy", name: "Role Management", icon: <FaShieldAlt /> },
    { path: "/admin/approval-workflows", name: "Approval Workflows", icon: <FaTasks /> },
    { path: "/admin/pending-approvals", name: "Pending Approvals", icon: <FaClock /> },
    { path: "/calendar-management", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/id-card-generator", name: "ID Cards", icon: <FaCreditCard /> },
    { path: "/salary-structure", name: "Salary Structure", icon: <FaDollarSign /> },
    { path: "/admin-settings", name: "Settings", icon: <FaCog /> }
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
        { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill /> },
        { path: "/today-attendance", name: "Attendance", icon: <IoBookmarks /> },
        { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt /> },
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
    { path: "/employees", name: "My Team", icon: <FaUsers /> },
    { path: "/projects", name: "All Projects", icon: <FaProjectDiagram /> },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt /> },
    { path: "/my-leave", name: "My Leave", icon: <FaCalendarAlt /> },
    { path: "/today-attendance", name: "Team Attendance", icon: <IoBookmarks /> },
    { path: "/attendance-stats", name: "Attendance Stats", icon: <FaChartLine /> },
    { path: "/attendance-regularization", name: "Attendance Regularization", icon: <FaClock /> },
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
    { path: "/employees", name: "Employees", icon: <FaUsers /> },
    { path: "/recruitment", name: "Recruitment", icon: <FaHandshake /> },
    { path: "/onboarding", name: "Onboarding", icon: <FaUserCheck /> },
    { path: "/learning", name: "Learning & Development", icon: <FaGraduationCap /> },
    { path: "/engagement", name: "Employee Engagement", icon: <FaBell /> },
    { path: "/documents", name: "Documents", icon: <FaFolderOpen /> },
    { path: "/benefits", name: "Benefits", icon: <FaGift /> },
    { path: "/succession", name: "Succession Planning", icon: <FaUserTie /> },
    { path: "/workforce", name: "Workforce Planning", icon: <FaChartBar /> },
    { path: "/leave-management", name: "Leave Management", icon: <FaCalendarAlt /> },
    { path: "/today-attendance", name: "Attendance", icon: <IoBookmarks /> },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/admin/reports", name: "HR Reports", icon: <FaFileAlt /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];


/**
 * Finance Navigation Items
 */
const getFinanceNavigation = () => [
    { path: "/dashboard-finance", name: "Dashboard", icon: <FaDollarSign /> },
    { path: "/admin-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/salary-structure", name: "Salary Structure", icon: <FaDollarSign /> },
    { path: "/admin/reports", name: "Financial Reports", icon: <FaChartBar /> },
    { path: "/employees", name: "Employees", icon: <FaUsers /> },
    { path: "/my-leave", name: "My Leave", icon: <FaCalendarAlt /> },
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
    { path: "/attendance-stats", name: "Attendance Stats", icon: <IoBookmarks /> },
    { path: "/my-leave", name: "My Leave", icon: <FaCalendarAlt /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

/**
 * Employee Navigation Items (Default)
 */
const getEmployeeNavigation = () => [
    { path: "/dashboard-employee", name: "Dashboard", icon: <FaHome /> },
    { path: "/attendance-stats", name: "Attendance Stats", icon: <IoBookmarks /> },
    { path: "/employee/projects", name: "Projects", icon: <VscProject /> },
    { path: "/my-leave", name: "Leave", icon: <FaCalendarAlt /> },
    { path: "/one-on-one", name: "One-on-One", icon: <FaUserCheck /> },
    { path: "/team-learning", name: "Team Learning", icon: <FaGraduationCap /> },
    { path: "/benefits", name: "Benefits", icon: <FaGift /> },
    { path: "/documents", name: "Documents", icon: <FaFolderOpen /> },
    { path: "/learning", name: "Learning", icon: <FaGraduationCap /> },
    { path: "/employee/calendar", name: "Calendar", icon: <FaCalendarAlt /> },
    { path: "/employee/id-card", name: "ID Card", icon: <FaCreditCard /> },
    { path: "/employee-payroll", name: "Payroll", icon: <FaMoneyBill /> },
    { path: "/profile-details", name: "Profile", icon: <CgProfile /> }
];

