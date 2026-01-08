import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { isManager, isHR } from '../utils/managerHelper';

/**
 * RoleBasedRoute Component
 * Routes users to appropriate component based on their role
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.managerComponent - Component for managers
 * @param {React.ReactNode} props.employeeComponent - Component for employees
 * @param {React.ReactNode} props.hrComponent - Component for HR (optional, defaults to managerComponent)
 * @param {string} props.employeeRoute - Route to redirect employees to (optional)
 */
const RoleBasedRoute = ({ 
    managerComponent: ManagerComponent, 
    employeeComponent: EmployeeComponent,
    hrComponent: HRComponent,
    employeeRoute 
}) => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return <LoadingSpinner message="Loading..." />;
    }

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    // Get user role
    const userRole = user?.role || employee?.role || 'employee';
    const userObj = user || employee;
    
    // Check if user is admin
    const isAdmin = userRole === 'admin';
    
    // Check if user is manager
    const userIsManager = isManager(userObj);
    
    // Check if user is HR
    const userIsHR = isHR(userObj);

    // If employee route is specified and user is not manager/HR, redirect
    if (employeeRoute && !isAdmin && !userIsManager && !userIsHR) {
        return <Navigate to={employeeRoute} replace />;
    }

    // Render appropriate component
    if (isAdmin || userIsManager) {
        return <ManagerComponent />;
    }
    
    if (userIsHR && HRComponent) {
        return <HRComponent />;
    }
    
    if (userIsHR) {
        return <ManagerComponent />;
    }

    // Default to employee component
    if (EmployeeComponent) {
        return <EmployeeComponent />;
    }

    // Fallback: redirect to dashboard
    return <Navigate to="/dashboard" replace />;
};

export default RoleBasedRoute;

