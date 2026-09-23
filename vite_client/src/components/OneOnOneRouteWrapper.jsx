import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

const OneOnOneMeetingHub = React.lazy(() => import('./OneOnOne/OneOnOneMeetingHub'));

/**
 * Unified one-on-one experience for Employee, Manager, HR, and Admin.
 * Scheduling controls are gated inside the hub based on role.
 */
const OneOnOneRouteWrapper = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [searchParams] = useSearchParams();

    React.useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 50);
        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return <LoadingSpinner message="Loading..." />;
    }

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    return (
        <Suspense fallback={<LoadingSpinner message="Loading one-on-one meetings..." />}>
            <OneOnOneMeetingHub />
        </Suspense>
    );
};

export default OneOnOneRouteWrapper;
