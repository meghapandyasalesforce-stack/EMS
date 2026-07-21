import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

const OnboardingHub = React.lazy(() => import('../HR/Onboarding/OnboardingHub'));

const OnboardingRouteWrapper = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    return (
        <Suspense fallback={<LoadingSpinner message="Loading onboarding..." />}>
            <OnboardingHub />
        </Suspense>
    );
};

export default OnboardingRouteWrapper;
