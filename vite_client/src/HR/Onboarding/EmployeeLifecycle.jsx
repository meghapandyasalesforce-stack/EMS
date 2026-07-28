import React, { Suspense, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSignInAlt, FaSignOutAlt, FaCog, FaChartBar, FaBuilding } from 'react-icons/fa';
import axios from '../../utils/axios';
import OnboardingHub from './OnboardingHub';
import OffboardingHub from '../Offboarding/OffboardingHub';
import LoadingSpinner from '../../components/LoadingSpinner';
import { canAccessLifecycleEnterprise } from '../../utils/managerHelper';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';

// Heavy panels lazy-loaded so a crash in Configure/Enterprise/Reports cannot blank the whole Lifecycle route
const LifecycleConfigurationPanel = React.lazy(() => import('./LifecycleConfigurationPanel'));
const LifecycleReportsHub = React.lazy(() => import('./LifecycleReportsHub'));
const LifecycleEnterpriseHub = React.lazy(() => import('./LifecycleEnterpriseHub'));

/**
 * Employee Lifecycle shell.
 * - Employees: onboarding/offboarding workflows only (never Enterprise).
 * - HR / Admin: workflows + Enterprise / Configure / Reports options.
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
    const showConfiguration = searchParams.get('configure') === '1';
    const showReports = searchParams.get('reports') === '1';
    const enterpriseRequested = searchParams.get('enterprise') === '1';
    const restrictedView = enterpriseRequested || showConfiguration || showReports;
    const denyRestricted = restrictedView && !canAccessEnterprise;
    const showEnterprise = canAccessEnterprise && enterpriseRequested && !showConfiguration && !showReports;

    // Hooks must run unconditionally (before any early return)
    useEffect(() => {
        if (!showEnterprise) return undefined;
        axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/enterprise/bootstrap`, {}, { withCredentials: true })
            .catch(() => {});
        return undefined;
    }, [showEnterprise]);

    if (denyRestricted) {
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

    const openConfiguration = () => {
        if (!canAccessEnterprise) return;
        const next = new URLSearchParams(searchParams);
        next.set('configure', '1');
        next.delete('reports');
        next.delete('enterprise');
        next.delete('id');
        next.delete('view');
        setSearchParams(next, { replace: false });
    };

    const openEnterprise = () => {
        if (!canAccessEnterprise) return;
        const next = new URLSearchParams(searchParams);
        next.set('enterprise', '1');
        next.delete('configure');
        next.delete('reports');
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

    let body = null;
    if (showConfiguration && canAccessEnterprise) {
        body = (
            <Suspense fallback={<LoadingSpinner message="Loading configuration..." />}>
                <LifecycleConfigurationPanel />
            </Suspense>
        );
    } else if (showEnterprise && canAccessEnterprise) {
        body = (
            <Suspense fallback={<LoadingSpinner message="Loading enterprise command center..." />}>
                <LifecycleEnterpriseHub />
            </Suspense>
        );
    } else if (lifecycle === 'offboarding') {
        body = <OffboardingHub />;
    } else {
        body = <OnboardingHub />;
    }

    // Corporate-Modern chrome only for Admin/HR; employees keep the original shell.
    const cmScoped = canAccessEnterprise;

    return (
        <>
            <div className={`page-shell bg-gray-50 pt-4 ${cmScoped ? 'cm-hrms' : ''}`}>
                <div className="page-shell-inner">
                    <section className={cmScoped
                        ? 'cm-card'
                        : 'rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm sm:p-4'}
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                                <p className={cmScoped
                                    ? 'cm-label'
                                    : 'text-xs font-semibold uppercase tracking-wider text-theme-secondary'}
                                >
                                    Employee Lifecycle
                                </p>
                                <h1 className={cmScoped
                                    ? 'cm-title-sm mt-0.5'
                                    : 'text-lg font-bold text-gray-800 sm:text-xl'}
                                >
                                    {showConfiguration
                                        ? 'Workflow Configuration'
                                        : showReports
                                            ? 'Reports & Analytics'
                                            : showEnterprise
                                                ? 'Enterprise Command Center'
                                                : 'Joiner and Leaver Workflows'}
                                </h1>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                {!showConfiguration && !showReports && !showEnterprise && (
                                    <div
                                        className={cmScoped
                                            ? 'grid w-full grid-cols-2 gap-1 rounded-xl bg-[var(--cm-surface-container)] p-1 sm:inline-flex sm:w-auto sm:rounded-full'
                                            : 'grid w-full grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:inline-flex sm:w-auto sm:rounded-lg'}
                                        role="tablist"
                                        aria-label="Employee lifecycle"
                                    >
                                        <button
                                            type="button"
                                            role="tab"
                                            aria-selected={lifecycle === 'onboarding'}
                                            onClick={() => switchLifecycle('onboarding')}
                                            className={cmScoped
                                                ? `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
                                                    lifecycle === 'onboarding'
                                                        ? 'bg-[var(--cm-white)] text-[var(--cm-primary-deep)] shadow-sm'
                                                        : 'text-[var(--cm-muted)] hover:text-[var(--cm-on-surface)]'
                                                }`
                                                : `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:rounded-md sm:px-4 sm:py-2 sm:font-medium ${
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
                                            className={cmScoped
                                                ? `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 ${
                                                    lifecycle === 'offboarding'
                                                        ? 'bg-[var(--cm-white)] text-[var(--cm-primary-deep)] shadow-sm'
                                                        : 'text-[var(--cm-muted)] hover:text-[var(--cm-on-surface)]'
                                                }`
                                                : `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:rounded-md sm:px-4 sm:py-2 sm:font-medium ${
                                                    lifecycle === 'offboarding'
                                                        ? 'bg-white text-theme-primary shadow-sm'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            <FaSignOutAlt className="shrink-0" /> Offboarding
                                        </button>
                                    </div>
                                )}

                                {canAccessEnterprise && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => (showEnterprise ? backToWorkflows() : openEnterprise())}
                                            className={cmScoped
                                                ? (showEnterprise ? 'cm-btn cm-btn--primary cm-btn--sm' : 'cm-btn cm-btn--outline cm-btn--sm')
                                                : `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:font-medium ${
                                                    showEnterprise
                                                        ? 'bg-theme-primary text-white shadow-sm'
                                                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                            title={showEnterprise ? 'Back to workflows' : 'Organization enterprise settings'}
                                        >
                                            <FaBuilding className="shrink-0" />
                                            {showEnterprise ? 'Back to Workflows' : 'Enterprise'}
                                        </button>
                                        {!showConfiguration && (
                                            <button
                                                type="button"
                                                onClick={() => (showReports ? backToWorkflows() : openReports())}
                                                className={cmScoped
                                                    ? (showReports ? 'cm-btn cm-btn--primary cm-btn--sm' : 'cm-btn cm-btn--outline cm-btn--sm')
                                                    : `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:font-medium ${
                                                        showReports
                                                            ? 'bg-theme-primary text-white shadow-sm'
                                                            : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <FaChartBar className="shrink-0" />
                                                {showReports ? 'Back to Workflows' : 'Reports'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => (showConfiguration ? backToWorkflows() : openConfiguration())}
                                            className={cmScoped
                                                ? (showConfiguration ? 'cm-btn cm-btn--primary cm-btn--sm' : 'cm-btn cm-btn--outline cm-btn--sm')
                                                : `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-2 sm:font-medium ${
                                                    showConfiguration
                                                        ? 'bg-theme-primary text-white shadow-sm'
                                                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <FaCog className="shrink-0" />
                                            {showConfiguration ? 'Back to Workflows' : 'Configure'}
                                        </button>
                                    </>
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
