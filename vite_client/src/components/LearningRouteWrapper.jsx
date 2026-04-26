import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { isHR, isManager } from '../utils/managerHelper';

const LearningRouteWrapper = () => {
    const LegacyLearningComponent = React.lazy(() => import('../HR/Learning/LearningPage'));
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
        return <LoadingSpinner message="Loading learning..." />;
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
        <Suspense fallback={<LoadingSpinner message="Loading learning..." />}>
            <LegacyLearningComponent />
        </Suspense>
    );
};

export default LearningRouteWrapper;
