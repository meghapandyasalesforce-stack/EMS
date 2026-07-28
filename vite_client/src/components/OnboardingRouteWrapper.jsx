import React, { Suspense } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import { canAccessLifecycleEnterprise, canAccessLifecycleEnterpriseHub } from '../utils/managerHelper';

const EmployeeLifecycle = React.lazy(() => import('../HR/Onboarding/EmployeeLifecycle'));

/**
 * /onboarding route gate.
 * Configure / Reports: HR + Admin. Enterprise hub: Admin only.
 * Employees keep full access to their own join/leave workflow UI.
 */
const OnboardingRouteWrapper = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const permissions = useSelector((state) => state.auth.permissions) || [];
    const [searchParams] = useSearchParams();

    if (!user && !employee) {
        return <Navigate to="/login" replace />;
    }

    const userObj = user || employee;
    const canAccessConfig = canAccessLifecycleEnterprise(userObj, permissionFlags, permissions);
    const canAccessEnterpriseHub = canAccessLifecycleEnterpriseHub(userObj, permissionFlags, employee);
    const enterpriseRequested = searchParams.get('enterprise') === '1';
    const configRequested =
        searchParams.get('configure') === '1'
        || searchParams.get('reports') === '1';

    if (
        (enterpriseRequested && !canAccessEnterpriseHub)
        || (configRequested && !canAccessConfig)
    ) {
        return <Navigate to="/onboarding" replace />;
    }

    return (
        <Suspense fallback={<LoadingSpinner message="Loading employee lifecycle..." />}>
            <EmployeeLifecycle />
        </Suspense>
    );
};

export default OnboardingRouteWrapper;
