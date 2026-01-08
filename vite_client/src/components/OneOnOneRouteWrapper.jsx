import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { isManager } from '../utils/managerHelper';

const OneOnOneRouteWrapper = () => {
    const ManagerComponent = React.lazy(() => import('../Manager/OneOnOne/OneOnOnePage'));
    const EmployeeComponent = React.lazy(() => import('../Employee/OneOnOne/EmployeeOneOnOnePage'));
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

    const userRole = user?.role || employee?.role || 'employee';
    const userObj = user || employee;
    const isAdmin = userRole === 'admin';
    const userIsManager = isManager(userObj);

    // Managers and Admin see manager view
    if (isAdmin || userIsManager) {
        return (
            <Suspense fallback={<LoadingSpinner message="Loading one-on-one meetings..." />}>
                <ManagerComponent />
            </Suspense>
        );
    }

    // Employees see employee view
    return (
        <Suspense fallback={<LoadingSpinner message="Loading your one-on-one meetings..." />}>
            <EmployeeComponent />
        </Suspense>
    );
};

export default OneOnOneRouteWrapper;

