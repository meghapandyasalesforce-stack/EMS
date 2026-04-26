import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { isHR, isManager } from '../utils/managerHelper';

const BenefitsRouteWrapper = () => {
    const LegacyBenefitsComponent = React.lazy(() => import('../HR/Benefits/BenefitsPage'));
    const EmployeeHubComponent = React.lazy(() => import('../Employee/Learning/BenefitsLearningHub'));

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
        return <LoadingSpinner message="Loading benefits..." />;
    }

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    const userObj = user || employee;
    const userRole = userObj?.role || 'employee';
    const isAdmin = userRole === 'admin';
    const userIsManager = isManager(userObj);
    const userIsHR = isHR(userObj);
    const isEmployeeView = !isAdmin && !userIsManager && !userIsHR;

    if (isEmployeeView) {
        return (
            <Suspense fallback={<LoadingSpinner message="Loading benefits and learning..." />}>
                <EmployeeHubComponent />
            </Suspense>
        );
    }

    return (
        <Suspense fallback={<LoadingSpinner message="Loading benefits..." />}>
            <LegacyBenefitsComponent />
        </Suspense>
    );
};

export default BenefitsRouteWrapper;
