import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import { isManager, isHR } from '../utils/managerHelper';
import { isExecutive } from '../utils/navigationConfig';
import { getDefaultDashboardRoute } from '../utils/dashboardRedirect';

/**
 * ProtectedRoute Component
 * Protects routes based on user roles
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Component to render if authorized
 * @param {Array<string>} props.allowedRoles - Array of allowed roles: ['admin', 'manager', 'hr', 'employee', 'executive']
 * @param {string} props.redirectTo - Path to redirect if unauthorized (default: use role-based dashboard)
 */
const ProtectedRoute = ({ children, allowedRoles = [], redirectTo }) => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        // Wait a bit for Redux state to load
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return <LoadingSpinner message="Checking permissions..." />;
    }

    // If no user, redirect to login
    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    // Get user role
    const userRole = user?.role || employee?.role || 'employee';
    
    // Check if user is admin
    const isAdmin = userRole === 'admin';
    
    // Check if user is manager
    const userObj = user || employee;
    const userIsManager = isManager(userObj);
    
    // Check if user is HR
    const userIsHR = isHR(userObj);
    
    // Check if user is Executive (CEO, CTO, CFO, VP)
    const position = (userObj?.position || '').toLowerCase().trim();
    const userIsExecutive = isExecutive(position);

    const department = (userObj?.department || '').toLowerCase().trim();
    const isFinanceDept = department === 'finance' || department.includes('finance') || department === 'accounting';
    const isTechDept = department === 'technology' || department === 'tech' || department.includes('technology') ||
      department === 'it' || (department.includes('it') && !department.includes('support'));

    const effectiveRoles = [];
    if (isAdmin) effectiveRoles.push('admin');
    if (userIsManager) effectiveRoles.push('manager');
    if (userIsHR) effectiveRoles.push('hr');
    if (userIsExecutive) effectiveRoles.push('executive');
    if (isFinanceDept) effectiveRoles.push('finance');
    if (isTechDept) effectiveRoles.push('tech');
    effectiveRoles.push('employee');

    // Check if user has any of the allowed roles
    const hasAccess = allowedRoles.length === 0 || 
                      allowedRoles.some(role => effectiveRoles.includes(role));

    if (!hasAccess) {
        const targetRedirect = redirectTo != null && redirectTo !== '' && redirectTo !== '/dashboard'
            ? redirectTo
            : getDefaultDashboardRoute(user, employee);
        return <Navigate to={targetRedirect} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

