import React, { Suspense, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSignInAlt, FaSignOutAlt, FaChartBar } from 'react-icons/fa';
import OnboardingHub from './OnboardingHub';
import OffboardingHub from '../Offboarding/OffboardingHub';
import LoadingSpinner from '../../components/LoadingSpinner';
import { canAccessLifecycleEnterprise } from '../../utils/managerHelper';

// Reports kept (lazy); Configure + Enterprise entry points hidden for now
const LifecycleReportsHub = React.lazy(() => import('./LifecycleReportsHub'));

/**
 * Employee Lifecycle shell.
 * - Onboarding / Offboarding workflows (all necessary sections shown).
 * - Configure + Enterprise UI hidden for now.
 * - Reports available for HR/Admin when permitted.
 */
const EmployeeLifecycle = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const permissions = useSelector((state) => state.auth.permissions) || [];

    const userObj = user || employee;
    const canAccessEnterprise = canAccessLifecycleEnterprise(userObj, permissionFlags, permissions);

    const lifecycle = searchParams.get('lifecycle') === 'offboarding' ? 'offboarding' : 'onboarding';
    const showReports = searchParams.get('reports') === '1';
    // Legacy Configure / Enterprise URLs — send back to workflows
    const legacyConfigureOrEnterprise = searchParams.get('configure') === '1'
        || searchParams.get('enterprise') === '1';

    useEffect(() => {
        if (!legacyConfigureOrEnterprise) return;
        const next = new URLSearchParams(searchParams);
        next.delete('configure');
        next.delete('enterprise');
        setSearchParams(next, { replace: true });
    }, [legacyConfigureOrEnterprise, searchParams, setSearchParams]);

    if (showReports && !canAccessEnterprise) {
        return <Navigate to="/onboarding" replace />;
    }

    const switchLifecycle = (nextLifecycle) => {
        const next = new URLSearchParams(searchParams);
        next.delete('configure');
        next.delete('reports');
        next.delete('enterprise');
        if (nextLifecycle === 'offboarding') next.set('lifecycle', 'offboarding');
        else next.delete('lifecycle');
        next.delete('id');
        next.delete('view');
        setSearchParams(next, { replace: false });
    };

    const openReports = () => {
        if (!canAccessEnterprise) return;
        const next = new URLSearchParams(searchParams);
        next.set('reports', '1');
        next.delete('configure');
        next.delete('enterprise');
        next.delete('id');
        next.delete('view');
        setSearchParams(next, { replace: false });
    };

    const backToWorkflows = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('enterprise');
        next.delete('configure');
        next.delete('reports');
        setSearchParams(next, { replace: false });
    };

    if (showReports && canAccessEnterprise) {
        return (
            <Suspense fallback={<LoadingSpinner message="Loading reports..." />}>
                <LifecycleReportsHub onBack={backToWorkflows} />
            </Suspense>
        );
    }

    const body = lifecycle === 'offboarding' ? <OffboardingHub /> : <OnboardingHub />;

    return (
        <>
            <div className="page-shell hrms-lifecycle bg-gray-50 pt-4">
                <div className="page-shell-inner">
                    <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-theme-secondary">
                                    Employee Lifecycle
                                </p>
                                <h1 className="text-lg font-bold text-gray-800 sm:text-xl">
                                    Joiner and Leaver Workflows
                                </h1>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <div
                                    className="grid w-full grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:inline-flex sm:w-auto sm:rounded-lg"
                                    role="tablist"
                                    aria-label="Employee lifecycle"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={lifecycle === 'onboarding'}
                                        onClick={() => switchLifecycle('onboarding')}
                                        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:rounded-md sm:px-4 sm:py-2 sm:font-medium ${
                                            lifecycle === 'onboarding'
                                                ? 'bg-white text-theme-primary shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <FaSignInAlt className="shrink-0" /> Onboarding
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={lifecycle === 'offboarding'}
                                        onClick={() => switchLifecycle('offboarding')}
                                        className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:rounded-md sm:px-4 sm:py-2 sm:font-medium ${
                                            lifecycle === 'offboarding'
                                                ? 'bg-white text-theme-primary shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <FaSignOutAlt className="shrink-0" /> Offboarding
                                    </button>
                                </div>

                                {canAccessEnterprise && (
                                    <button
                                        type="button"
                                        onClick={openReports}
                                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:px-4 sm:py-2 sm:font-medium"
                                    >
                                        <FaChartBar className="shrink-0" />
                                        Reports
                                    </button>
                                )}
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {body}
        </>
    );
};

export default EmployeeLifecycle;
