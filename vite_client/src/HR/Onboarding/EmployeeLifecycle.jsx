import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSignInAlt, FaSignOutAlt, FaChartBar, FaDownload, FaUserPlus } from 'react-icons/fa';
import OnboardingHub from './OnboardingHub';
import OffboardingHub from '../Offboarding/OffboardingHub';
import LoadingSpinner from '../../components/LoadingSpinner';
import { canAccessLifecycleEnterprise } from '../../utils/managerHelper';
import { CmButton } from '../../components/corporateModern';
import axios from '../../utils/axios';
import { ADMIN_ONBOARDING_ENDPOINT, ADMIN_OFFBOARDING_ENDPOINT } from '../../utils/constant';

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
    const isHrShell = user?.role === 'admin' || canAccessEnterprise;

    const lifecycle = searchParams.get('lifecycle') === 'offboarding' ? 'offboarding' : 'onboarding';
    const showReports = searchParams.get('reports') === '1';
    const viewingDossier = Boolean(searchParams.get('id'));
    // Legacy Configure / Enterprise URLs — send back to workflows
    const legacyConfigureOrEnterprise = searchParams.get('configure') === '1'
        || searchParams.get('enterprise') === '1';

    const [tabCounts, setTabCounts] = useState({ onboardingActive: null, offboardingActive: null });
    const [spotlight, setSpotlight] = useState(null);

    useEffect(() => {
        if (!legacyConfigureOrEnterprise) return;
        const next = new URLSearchParams(searchParams);
        next.delete('configure');
        next.delete('enterprise');
        setSearchParams(next, { replace: true });
    }, [legacyConfigureOrEnterprise, searchParams, setSearchParams]);

    useEffect(() => {
        if (!isHrShell || showReports) return undefined;
        let cancelled = false;
        (async () => {
            try {
                const [onbRes, offRes] = await Promise.allSettled([
                    axios.get(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding/dashboard`, { withCredentials: true }),
                    axios.get(`${ADMIN_OFFBOARDING_ENDPOINT}/offboarding/dashboard`, { withCredentials: true }),
                ]);
                if (cancelled) return;
                const onb = onbRes.status === 'fulfilled' ? onbRes.value.data?.data : null;
                const off = offRes.status === 'fulfilled' ? offRes.value.data?.data : null;
                const workflows = onb?.workflows || [];
                const active = workflows.find((w) => w.status !== 'Completed' && w.status !== 'Cancelled')
                    || workflows[0]
                    || null;
                const emp = active?.employeeId || active?.employee;
                const name = [emp?.name, emp?.lastName].filter(Boolean).join(' ').trim();
                setTabCounts({
                    onboardingActive: onb?.stats?.active
                        ?? workflows.filter((w) => w.status !== 'Completed' && w.status !== 'Cancelled').length
                        ?? null,
                    offboardingActive: off?.stats?.inProgress ?? off?.stats?.active ?? null,
                });
                setSpotlight(active?._id && name ? { id: active._id, name } : null);
            } catch {
                /* counts are decorative; ignore */
            }
        })();
        return () => { cancelled = true; };
    }, [isHrShell, showReports, lifecycle]);

    if (showReports && !canAccessEnterprise) {
        return <Navigate to="/onboarding" replace />;
    }

    const switchLifecycle = (nextLifecycle) => {
        const next = new URLSearchParams(searchParams);
        next.delete('configure');
        next.delete('reports');
        next.delete('enterprise');
        next.delete('create');
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
        next.delete('create');
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

    const openCreateOnboarding = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('lifecycle');
        next.delete('reports');
        next.set('create', '1');
        setSearchParams(next, { replace: false });
        window.dispatchEvent(new CustomEvent('ems:onboarding-create'));
    };

    const inviteFromReports = () => {
        openCreateOnboarding();
    };

    const exportCsv = () => {
        window.dispatchEvent(new CustomEvent('ems:onboarding-export-csv'));
    };

    const openSpotlightDossier = () => {
        if (!spotlight?.id) return;
        const next = new URLSearchParams(searchParams);
        next.delete('lifecycle');
        next.delete('reports');
        next.delete('create');
        next.set('id', spotlight.id);
        setSearchParams(next, { replace: false });
    };

    const cohortLabel = useMemo(() => {
        const year = new Date().getFullYear();
        const month = new Date().getMonth();
        const season = month < 3 ? 'Winter' : month < 6 ? 'Spring' : month < 9 ? 'Summer' : 'Fall';
        return `${season} ${year} Cohort`;
    }, []);

    if (showReports && canAccessEnterprise) {
        return (
            <Suspense fallback={<LoadingSpinner message="Loading reports..." />}>
                <LifecycleReportsHub onBack={backToWorkflows} onInvite={inviteFromReports} />
            </Suspense>
        );
    }

    const body = lifecycle === 'offboarding' ? <OffboardingHub /> : <OnboardingHub />;
    const onboardingCount = tabCounts.onboardingActive;
    const offboardingCount = tabCounts.offboardingActive;

    return (
        <>
            {!viewingDossier && (
                <div className="page-shell hrms-lifecycle cm-hrms bg-transparent pt-3">
                    <div className="page-shell-inner space-y-3">
                        <section className="cm-lifecycle-hero">
                            {/* Row 1 — title + actions (ZIP hub header) */}
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0 space-y-1.5">
                                    <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--cm-muted)]">
                                        <span>Dashboard</span>
                                        <span aria-hidden>›</span>
                                        <span>Hire &amp; Lifecycle</span>
                                        <span aria-hidden>›</span>
                                        <span className="font-semibold text-[var(--cm-on-surface)]">
                                            {lifecycle === 'offboarding' ? 'Offboarding Hub' : 'Onboarding Hub'}
                                        </span>
                                    </nav>
                                    <h1 className="text-2xl font-bold tracking-tight text-[var(--cm-inverted)] sm:text-[1.75rem]">
                                        {lifecycle === 'offboarding'
                                            ? 'Employee Offboarding & Separation'
                                            : 'Employee Onboarding & New Hire Induction'}
                                    </h1>
                                    <p className="max-w-3xl text-sm leading-relaxed text-[var(--cm-muted)]">
                                        {lifecycle === 'offboarding'
                                            ? 'Track resignations, clearances, asset returns, and exit compliance across the separation pipeline.'
                                            : 'Monitor pre-boarding readiness, IT provisioning, BGV verification, and Day-1 induction compliance across distributed branches.'}
                                    </p>
                                </div>

                                {isHrShell && lifecycle === 'onboarding' && (
                                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 md:justify-end">
                                        {spotlight && (
                                            <button
                                                type="button"
                                                className="cm-lifecycle-dossier-link"
                                                onClick={openSpotlightDossier}
                                            >
                                                Open {spotlight.name}&rsquo;s onboarding dossier
                                            </button>
                                        )}
                                        <span className="cm-lifecycle-cohort">{cohortLabel}</span>
                                        <CmButton type="button" variant="outline" onClick={exportCsv}>
                                            <FaDownload className="shrink-0" />
                                            Export CSV
                                        </CmButton>
                                        <CmButton type="button" variant="inverted" onClick={openCreateOnboarding}>
                                            <FaUserPlus className="shrink-0 text-base" />
                                            + Create Onboarding
                                        </CmButton>
                                    </div>
                                )}
                            </div>

                            {/* Row 2 — compact lifecycle switch + live status */}
                            <div className="cm-lifecycle-hero__rail">
                                <div
                                    className="cm-lifecycle-tabs cm-lifecycle-tabs--compact"
                                    role="tablist"
                                    aria-label="Employee lifecycle"
                                >
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={lifecycle === 'onboarding'}
                                        onClick={() => switchLifecycle('onboarding')}
                                        className={`cm-lifecycle-tab ${lifecycle === 'onboarding' ? 'cm-lifecycle-tab--active' : ''}`}
                                    >
                                        <FaSignInAlt className="shrink-0 opacity-80" />
                                        Onboarding
                                        {onboardingCount != null && (
                                            <span className="cm-lifecycle-tab__count">
                                                {onboardingCount} Active
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={lifecycle === 'offboarding'}
                                        onClick={() => switchLifecycle('offboarding')}
                                        className={`cm-lifecycle-tab ${lifecycle === 'offboarding' ? 'cm-lifecycle-tab--active' : ''}`}
                                    >
                                        <FaSignOutAlt className="shrink-0 opacity-80" />
                                        Offboarding
                                        {offboardingCount != null && (
                                            <span className="cm-lifecycle-tab__count cm-lifecycle-tab__count--muted">
                                                {offboardingCount} In-Progress
                                            </span>
                                        )}
                                    </button>
                                    {canAccessEnterprise && (
                                        <button
                                            type="button"
                                            onClick={openReports}
                                            className="cm-lifecycle-tab"
                                        >
                                            <FaChartBar className="shrink-0 opacity-80" />
                                            Analytics
                                        </button>
                                    )}
                                </div>
                                {isHrShell && (
                                    <div className="cm-lifecycle-hero__live">
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="cm-live-dot" aria-hidden />
                                            BGV Gateway Sync: Live
                                        </span>
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="cm-live-dot" aria-hidden />
                                            IT Asset Warehouse: 98% Stocked
                                        </span>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {body}
        </>
    );
};

export default EmployeeLifecycle;
