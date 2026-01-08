import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoadingSpinner from './LoadingSpinner';
import { isManager, isHR } from '../utils/managerHelper';
import { isExecutive } from '../utils/navigationConfig';

/**
 * ProtectedRoute Component
 * Protects routes based on user roles
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Component to render if authorized
 * @param {Array<string>} props.allowedRoles - Array of allowed roles: ['admin', 'manager', 'hr', 'employee']
 * @param {string} props.redirectTo - Path to redirect if unauthorized (default: '/dashboard')
 */
const ProtectedRoute = ({ children, allowedRoles = [], redirectTo = '/dashboard' }) => {
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

    // Build effective roles array
    const effectiveRoles = [];
    if (isAdmin) effectiveRoles.push('admin');
    if (userIsManager) effectiveRoles.push('manager');
    if (userIsHR) effectiveRoles.push('hr');
    if (userIsExecutive) effectiveRoles.push('executive');
    effectiveRoles.push('employee'); // Everyone is an employee

    // Check if user has any of the allowed roles
    const hasAccess = allowedRoles.length === 0 || 
                      allowedRoles.some(role => effectiveRoles.includes(role));

    if (!hasAccess) {
        // Redirect to dashboard or specified redirect path
        return <Navigate to={redirectTo} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

