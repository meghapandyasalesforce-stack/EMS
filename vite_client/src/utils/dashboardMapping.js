/**
 * Maps dashboardType from backend to frontend routes
 * @param {string} dashboardType - Dashboard type from backend (e.g., "HR_DASHBOARD")
 * @returns {string} Frontend route path
 */
export const getDashboardRoute = (dashboardType) => {
    const routeMap = {
        'HR_DASHBOARD': '/dashboard-hr',  // Changed from '/dashboard/hr' to match backend
        'FINANCE_DASHBOARD': '/dashboard-finance',  // Changed from '/dashboard/finance' to match backend
        'TECH_DASHBOARD': '/dashboard/tech',
        'CEO_DASHBOARD': '/dashboard/ceo',  // Executive dashboard
        'CTO_DASHBOARD': '/dashboard/cto',  // Executive dashboard
        'CFO_DASHBOARD': '/dashboard/cfo',  // Executive dashboard
        'VP_DASHBOARD': '/dashboard/vp',  // Executive dashboard
        'EXECUTIVE_DASHBOARD': '/dashboard-administration',  // Fallback for executive positions
        'MANAGER_DASHBOARD': '/dashboard-manager',  // Changed from '/dashboard/manager' to match backend
        'EMPLOYEE_DASHBOARD': '/dashboard-employee', // Default fallback
        'ADMIN_DASHBOARD': '/dashboard-admin',
        'ORGANIZATION_DASHBOARD': '/organization/dashboard'
    };
    
    return routeMap[dashboardType] || '/dashboard-employee';
};

