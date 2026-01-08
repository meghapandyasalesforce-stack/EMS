import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { isHR } from '../utils/managerHelper';

const OnboardingRouteWrapper = () => {
    const ManagerComponent = React.lazy(() => import('../HR/Onboarding/OnboardingPage'));
    const EmployeeComponent = React.lazy(() => import('../Employee/Onboarding/MyOnboardingPage'));
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
    const userIsHR = isHR(userObj);

    // HR and Admin see HR view
    if (isAdmin || userIsHR) {
        return (
            <Suspense fallback={<LoadingSpinner message="Loading onboarding..." />}>
                <ManagerComponent />
            </Suspense>
        );
    }

    // Employees see employee view
    return (
        <Suspense fallback={<LoadingSpinner message="Loading your onboarding..." />}>
            <EmployeeComponent />
        </Suspense>
    );
};

export default OnboardingRouteWrapper;

