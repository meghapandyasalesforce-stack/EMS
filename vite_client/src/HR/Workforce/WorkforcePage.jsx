import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaBalanceScale,
    FaChartLine,
    FaDownload,
    FaPlus,
    FaSearch,
    FaSpinner,
    FaTrash,
    FaUsers,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    WfBadge,
    WfKpiCard,
    WfPanel,
    WfButton,
    WfTable,
    WfEmpty,
    WfModal,
    WfField,
    wfInputClass,
    wfInputReadonlyClass,
    gapTone,
    formatGapValue,
    gapToneFromStatus,
} from './components/workforceUi';

const DEPARTMENT_OPTIONS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration',
];

const JOB_TITLE_OPTIONS = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'HR Manager', 'HR Executive',
    'Financial Analyst', 'Marketing Executive', 'Sales Representative', 'Product Manager',
    'QA Tester', 'Customer Support Specialist', 'UX/UI Designer', 'Project Manager',
    'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer',
];

const PAGE_SIZE = 8;
const STEPS = [
    { status: 'Draft', label: 'Draft' },
    { status: 'Pending Approval', label: 'Submitted' },
    { status: 'Approved', label: 'Approved' },
    { status: 'In Progress', label: 'Confirmed' },
];
const STAGE_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'Draft', label: 'Draft' },
    { key: 'Pending Approval', label: 'Submitted' },
    { key: 'Approved', label: 'Approved' },
    { key: 'In Progress', label: 'Confirmed' },
    { key: 'Rejected', label: 'Rejected' },
    { key: 'Completed', label: 'Completed' },
];

const downloadCsv = (filename, csvContent) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const personName = (person) => {
    if (!person || typeof person === 'string') return '';
    return `${person.name || ''} ${person.lastName || ''}`.trim() || person.email || '';
};

const blankPlan = () => ({
    planName: '',
    planYear: new Date().getFullYear(),
    quarter: 1,
    department: '',
    jobTitle: '',
    priority: 'Medium',
    reason: '',
    currentHeadcount: 0,
    targetHeadcount: 0,
    status: 'Draft',
    budget: { allocated: 0, spent: 0, remaining: 0 },
    hiringPlan: [],
    skillsRequired: [],
    risks: [],
});

const blankForecast = () => ({
    forecastDate: '',
    department: '',
    currentHeadcount: 0,
    projectedHeadcount: 0,
    newHires: 0,
    terminations: 0,
    transfers: 0,
    promotions: 0,
    confidenceLevel: 'Medium',
    factors: [],
});

const WorkforcePage = () => {
    const navigate = useNavigate();
    const org = useSelector((state) => state.organization?.profile);
    const currency = org?.currency || 'USD';
    const orgName = org?.name || org?.companyName || 'Your organization';

    const money = useCallback((value) => {
        const amount = Number(value) || 0;
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency,
                maximumFractionDigits: 0,
            }).format(amount);
        } catch {
            return `${currency} ${amount.toLocaleString()}`;
        }
    }, [currency]);

    const fiscalLabel = useMemo(() => {
        const startMonth = Math.min(12, Math.max(1, Number(org?.financialYearStart) || 4)) - 1;
        const now = new Date();
        const fyStart = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
        return `FY ${fyStart}–${String(fyStart + 1).slice(-2)}`;
    }, [org?.financialYearStart]);

    const [workforcePlans, setWorkforcePlans] = useState([]);
    const [forecasts, setForecasts] = useState([]);
    const [forecastsLoaded, setForecastsLoaded] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [gapAnalysis, setGapAnalysis] = useState(null);
    const [reports, setReports] = useState(null);
    const [openRequirements, setOpenRequirements] = useState([]);
    const [gapGroupBy, setGapGroupBy] = useState('designation');
    const [loading, setLoading] = useState(true);
    const [sectionLoading, setSectionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('plans');
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showCreateForecastModal, setShowCreateForecastModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [workflowBusy, setWorkflowBusy] = useState(false);
    const [fetchingHeadcount, setFetchingHeadcount] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [reqSearch, setReqSearch] = useState('');
    const [reqDepartment, setReqDepartment] = useState('all');
    const [forecastSearch, setForecastSearch] = useState('');
    const [forecastDepartment, setForecastDepartment] = useState('all');
    const [reqFor, setReqFor] = useState(null);
    const [reqForm, setReqForm] = useState({
        position: '',
        department: '',
        jobTitle: '',
        numberOfPositions: 1,
        priority: 'Medium',
    });
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [page, setPage] = useState(1);
    const [rejectFor, setRejectFor] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [planFormData, setPlanFormData] = useState(blankPlan);
    const [forecastFormData, setForecastFormData] = useState(blankForecast);

    const fetchLiveHeadcount = useCallback(async (department, jobTitle) => {
        try {
            setFetchingHeadcount(true);
            const params = {};
            if (department) params.department = department;
            if (jobTitle) params.jobTitle = jobTitle;
            const response = await axios.get('/v1/admin/workforce/live-headcount', {
                params,
                withCredentials: true,
            });
            return response.data?.data?.currentHeadcount ?? 0;
        } catch {
            return null;
        } finally {
            setFetchingHeadcount(false);
        }
    }, []);

    const loadCore = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setLoading(true);
            const [dashRes, planRes, openRes] = await Promise.all([
                axios.get('/v1/admin/workforce/dashboard', { withCredentials: true }),
                axios.get('/v1/admin/workforce/workforce-plans', { withCredentials: true }),
                axios.get('/v1/admin/workforce/open-hiring-requirements', { withCredentials: true }),
            ]);
            setDashboard(dashRes.data?.data || null);
            setWorkforcePlans(planRes.data?.data || []);
            setOpenRequirements(openRes.data?.data || []);
        } catch {
            toast.error('Failed to load workforce planning');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    const loadGap = useCallback(async () => {
        try {
            setSectionLoading(true);
            const response = await axios.get('/v1/admin/workforce/gap-analysis', {
                params: { groupBy: gapGroupBy },
                withCredentials: true,
            });
            setGapAnalysis(response.data?.data || null);
        } catch {
            toast.error('Failed to load gap analysis');
        } finally {
            setSectionLoading(false);
        }
    }, [gapGroupBy]);

    const loadReports = useCallback(async () => {
        try {
            setSectionLoading(true);
            const response = await axios.get('/v1/admin/workforce/reports', { withCredentials: true });
            setReports(response.data?.data || null);
        } catch {
            toast.error('Failed to load reports');
        } finally {
            setSectionLoading(false);
        }
    }, []);

    const loadForecasts = useCallback(async () => {
        try {
            setSectionLoading(true);
            const response = await axios.get('/v1/admin/workforce/headcount-forecasts', { withCredentials: true });
            setForecasts(response.data?.data || []);
            setForecastsLoaded(true);
        } catch {
            toast.error('Failed to load forecasts');
        } finally {
            setSectionLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCore();
    }, [loadCore]);

    useEffect(() => {
        if (activeTab === 'gap') loadGap();
    }, [activeTab, loadGap]);

    useEffect(() => {
        if (activeTab === 'reports' && !reports) loadReports();
    }, [activeTab, reports, loadReports]);

    useEffect(() => {
        if (activeTab === 'forecasts' && !forecastsLoaded) loadForecasts();
    }, [activeTab, forecastsLoaded, loadForecasts]);

    useEffect(() => {
        if (!showCreatePlanModal) return undefined;
        let cancelled = false;
        (async () => {
            const count = await fetchLiveHeadcount(planFormData.department, planFormData.jobTitle);
            if (!cancelled && count != null) {
                setPlanFormData((prev) => ({ ...prev, currentHeadcount: count }));
            }
        })();
        return () => { cancelled = true; };
    }, [showCreatePlanModal, planFormData.department, planFormData.jobTitle, fetchLiveHeadcount]);

    useEffect(() => {
        if (!showCreateForecastModal) return undefined;
        let cancelled = false;
        (async () => {
            const count = await fetchLiveHeadcount(forecastFormData.department, '');
            if (!cancelled && count != null) {
                setForecastFormData((prev) => ({ ...prev, currentHeadcount: count }));
            }
        })();
        return () => { cancelled = true; };
    }, [showCreateForecastModal, forecastFormData.department, fetchLiveHeadcount]);

    const departments = useMemo(() => {
        const set = new Set();
        workforcePlans.forEach((plan) => plan.department && set.add(plan.department));
        (dashboard?.departmentWise || []).forEach((row) => row.department && row.department !== 'Unassigned' && set.add(row.department));
        return [...set].sort();
    }, [workforcePlans, dashboard]);

    const years = useMemo(
        () => [...new Set(workforcePlans.map((plan) => plan.planYear).filter(Boolean))].sort((a, b) => b - a),
        [workforcePlans]
    );

    const plansInScope = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return workforcePlans.filter((plan) => {
            const matchesSearch = !q || [plan.planName, plan.department, plan.jobTitle, plan.designation, personName(plan.createdBy)]
                .join(' ')
                .toLowerCase()
                .includes(q);
            const matchesYear = yearFilter === 'all' || Number(plan.planYear) === Number(yearFilter);
            const matchesQuarter = quarterFilter === 'all' || Number(plan.quarter) === Number(quarterFilter);
            const matchesDept = departmentFilter === 'all' || plan.department === departmentFilter;
            return matchesSearch && matchesYear && matchesQuarter && matchesDept;
        });
    }, [workforcePlans, searchTerm, yearFilter, quarterFilter, departmentFilter]);

    const filteredPlans = useMemo(() => {
        if (statusFilter === 'all') return plansInScope;
        return plansInScope.filter((plan) => plan.status === statusFilter);
    }, [plansInScope, statusFilter]);

    const stageCounts = useMemo(() => {
        const counts = { all: plansInScope.length };
        STAGE_FILTERS.forEach((stage) => {
            if (stage.key === 'all') return;
            counts[stage.key] = plansInScope.filter((plan) => plan.status === stage.key).length;
        });
        return counts;
    }, [plansInScope]);

    const pageCount = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
    const safePage = Math.min(page, pageCount);
    const pagePlans = filteredPlans.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const selectedPlan = useMemo(
        () => filteredPlans.find((plan) => String(plan._id) === String(selectedPlanId)) || filteredPlans[0] || null,
        [filteredPlans, selectedPlanId]
    );

    const selectedOpenings = useMemo(() => {
        if (!selectedPlan) return [];
        return openRequirements.filter((row) => String(row.planId) === String(selectedPlan._id));
    }, [openRequirements, selectedPlan]);

    const signals = useMemo(() => {
        const rows = [...(dashboard?.departmentWise || [])]
            .filter((row) => row.status && row.status !== 'Balanced')
            .sort((a, b) => Math.abs(b.gap || 0) - Math.abs(a.gap || 0));
        return rows.slice(0, 2);
    }, [dashboard]);

    const filteredForecasts = useMemo(() => {
        const q = forecastSearch.trim().toLowerCase();
        return forecasts.filter((forecast) => {
            const matchesSearch = !q || String(forecast.department || '').toLowerCase().includes(q);
            const matchesDept = forecastDepartment === 'all' || forecast.department === forecastDepartment;
            return matchesSearch && matchesDept;
        });
    }, [forecasts, forecastSearch, forecastDepartment]);

    const filteredOpenings = useMemo(() => {
        const q = reqSearch.trim().toLowerCase();
        return openRequirements.filter((row) => {
            const matchesSearch = !q || [row.planName, row.department, row.jobTitle, row.position].join(' ').toLowerCase().includes(q);
            const matchesDept = reqDepartment === 'all' || row.department === reqDepartment;
            return matchesSearch && matchesDept;
        });
    }, [openRequirements, reqSearch, reqDepartment]);

    const resetPlanForm = () => setPlanFormData(blankPlan());
    const resetForecastForm = () => setForecastFormData(blankForecast());

    const handleCreatePlan = async (event) => {
        event.preventDefault();
        if (!planFormData.planName.trim() || planFormData.targetHeadcount < 1) {
            toast.error('Enter a plan name and a target headcount of at least 1');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post('/v1/admin/workforce/workforce-plans', {
                ...planFormData,
                designation: planFormData.jobTitle,
                status: 'Draft',
                budget: {
                    ...planFormData.budget,
                    remaining: planFormData.budget.allocated - planFormData.budget.spent,
                },
            }, { withCredentials: true });
            toast.success('Workforce plan created');
            setShowCreatePlanModal(false);
            resetPlanForm();
            setActiveTab('plans');
            loadCore({ silent: true });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create workforce plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateForecast = async (event) => {
        event.preventDefault();
        if (!forecastFormData.forecastDate || forecastFormData.currentHeadcount < 0) {
            toast.error('Please fill in required fields');
            return;
        }
        try {
            setSubmitting(true);
            await axios.post('/v1/admin/workforce/headcount-forecasts', forecastFormData, { withCredentials: true });
            toast.success('Headcount forecast created');
            setShowCreateForecastModal(false);
            resetForecastForm();
            setForecastsLoaded(false);
            setActiveTab('forecasts');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create headcount forecast');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Delete this workforce plan?')) return;
        try {
            await axios.delete(`/v1/admin/workforce/workforce-plans/${planId}`, { withCredentials: true });
            toast.success('Workforce plan deleted');
            if (String(selectedPlanId) === String(planId)) setSelectedPlanId('');
            loadCore({ silent: true });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete workforce plan');
        }
    };

    const handleDeleteForecast = async (forecastId) => {
        if (!window.confirm('Delete this forecast?')) return;
        try {
            await axios.delete(`/v1/admin/workforce/headcount-forecasts/${forecastId}`, { withCredentials: true });
            toast.success('Forecast deleted');
            setForecasts((prev) => prev.filter((item) => String(item._id) !== String(forecastId)));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete forecast');
        }
    };

    const runWorkflow = async (plan, action, body = {}) => {
        setWorkflowBusy(true);
        try {
            const response = await axios.post(
                `/v1/admin/workforce/workforce-plans/${plan._id}/${action}`,
                body,
                { withCredentials: true }
            );
            const updated = response.data?.data;
            if (updated?._id) {
                setWorkforcePlans((prev) => prev.map((item) => (
                    String(item._id) === String(updated._id) ? { ...item, ...updated } : item
                )));
            }
            toast.success(response.data?.message || 'Status updated');
            loadCore({ silent: true });
            return true;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update plan status');
            return false;
        } finally {
            setWorkflowBusy(false);
        }
    };

    const postRequisition = async (plan, index) => {
        const response = await axios.post(
            `/v1/admin/workforce/workforce-plans/${plan._id}/hiring/${index}/create-job`,
            {},
            { withCredentials: true }
        );
        toast.success(response.data?.message || 'Requisition created');
        setActiveTab('requisitions');
        await loadCore({ silent: true });
    };

    const createRequisition = async (plan) => {
        const lines = plan.hiringPlan || [];
        const index = lines.findIndex((line) => line.status !== 'Filled' && line.status !== 'Cancelled' && !line.recruitmentJobId);
        if (index >= 0) {
            try {
                setWorkflowBusy(true);
                await postRequisition(plan, index);
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to create requisition');
            } finally {
                setWorkflowBusy(false);
            }
            return;
        }
        if (lines.length > 0) {
            toast.info('Requisitions for this plan are already linked.');
            setActiveTab('requisitions');
            return;
        }
        const current = Number(plan.liveCurrentHeadcount ?? plan.currentHeadcount ?? 0);
        const openings = Math.max(1, (Number(plan.targetHeadcount) || 0) - current);
        setReqForm({
            position: plan.jobTitle || plan.designation || '',
            department: plan.department || '',
            jobTitle: plan.jobTitle || plan.designation || '',
            numberOfPositions: openings,
            priority: plan.priority || 'Medium',
        });
        setReqFor(plan);
    };

    const submitRequisitionLine = async (event) => {
        event.preventDefault();
        if (!reqFor) return;
        const position = reqForm.position.trim();
        const department = reqForm.department.trim();
        if (!position || !department) {
            toast.warning('Enter a position and a department.');
            return;
        }
        const line = {
            position,
            department,
            jobTitle: reqForm.jobTitle.trim() || position,
            numberOfPositions: Math.max(1, Number(reqForm.numberOfPositions) || 1),
            filledPositions: 0,
            priority: reqForm.priority || 'Medium',
            status: 'Planned',
            budget: 0,
        };
        try {
            setWorkflowBusy(true);
            const hiringPlan = [...(reqFor.hiringPlan || []), line];
            await axios.put(
                `/v1/admin/workforce/workforce-plans/${reqFor._id}`,
                { hiringPlan },
                { withCredentials: true }
            );
            setReqFor(null);
            await postRequisition(reqFor, hiringPlan.length - 1);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create requisition');
        } finally {
            setWorkflowBusy(false);
        }
    };

    const confirmReject = async (event) => {
        event.preventDefault();
        const reason = rejectReason.trim();
        if (!reason || !rejectFor) {
            toast.warning('Enter a reason for rejection.');
            return;
        }
        const ok = await runWorkflow(rejectFor, 'reject', { reason });
        if (ok) {
            setRejectFor(null);
            setRejectReason('');
        }
    };

    const planGapPreview = Math.abs((planFormData.targetHeadcount || 0) - (planFormData.currentHeadcount || 0));
    const planGapStatus = !planFormData.targetHeadcount
        ? ''
        : (planFormData.currentHeadcount || 0) < (planFormData.targetHeadcount || 0)
            ? 'Shortage'
            : (planFormData.currentHeadcount || 0) > (planFormData.targetHeadcount || 0)
                ? 'Surplus'
                : 'Balanced';
    const planGapHint = planFormData.targetHeadcount > 0
        ? `Gap: ${planGapPreview} (${planGapStatus})`
        : 'Enter the headcount you need';

    if (loading && !dashboard && workforcePlans.length === 0) {
        return <LoadingSpinner message="Loading workforce planning..." />;
    }

    const gapValue = dashboard?.workforceSignedGap ?? dashboard?.workforceGap ?? 0;
    const gapPositive = Number(gapValue) > 0;
    const currentHead = selectedPlan?.liveCurrentHeadcount ?? selectedPlan?.currentHeadcount ?? 0;
    const targetHead = selectedPlan?.targetHeadcount ?? 0;
    const headMax = Math.max(currentHead, targetHead, 1);
    const allocated = Number(selectedPlan?.budget?.allocated) || 0;
    const spent = Number(selectedPlan?.budget?.spent) || 0;
    const budgetPct = allocated > 0 ? Math.min(100, Math.round((spent / allocated) * 100)) : 0;
    const stepIndex = STEPS.findIndex((step) => step.status === selectedPlan?.status);

    return (
        <div className="wf-ui min-h-screen bg-[#F4F7FB]">
            <div className="page-shell">
                <div className="page-shell-inner hrms-stack">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a8f6c]">Workforce planning</p>
                            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0E2B3D] sm:text-3xl">Workforce Planning & Requisition</h1>
                            <p className="mt-1 text-sm text-slate-500">{orgName} · {fiscalLabel} strategic capacity</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => { resetForecastForm(); setShowCreateForecastModal(true); }}
                                className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-semibold text-[#0E2B3D]"
                            >
                                New Forecast
                            </button>
                            <button
                                type="button"
                                onClick={() => { resetPlanForm(); setShowCreatePlanModal(true); }}
                                className="inline-flex items-center gap-2 rounded-xl bg-[#0a8f6c] px-4 py-2 text-sm font-semibold text-white"
                            >
                                <FaPlus /> New Workforce Plan
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <WfKpiCard title="Current headcount" value={dashboard?.totalEmployees ?? '—'} icon={FaUsers} tone="teal" subtitle="Live employees" />
                        <WfKpiCard title="Planned headcount" value={dashboard?.plannedWorkforce ?? '—'} icon={FaChartLine} tone="sky" subtitle="Active plan targets" />
                        <WfKpiCard
                            title="Headcount gap"
                            value={dashboard ? `${Number(gapValue) > 0 ? '+' : Number(gapValue) < 0 ? '−' : ''}${formatGapValue(gapValue)}` : '—'}
                            icon={FaBalanceScale}
                            tone={gapPositive ? 'rose' : 'emerald'}
                            valueClass={gapPositive ? 'text-rose-600' : 'text-emerald-600'}
                            subtitle={dashboard?.workforceGapStatus || 'Shortage when current is below planned'}
                        />
                    </div>

                    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
                        {[
                            { id: 'plans', label: 'Headcount Plans' },
                            { id: 'requisitions', label: 'Open Requisitions', count: openRequirements.length },
                            { id: 'gap', label: 'Gap Analysis' },
                            { id: 'forecasts', label: 'Forecasts', count: forecastsLoaded ? forecasts.length : null },
                            { id: 'reports', label: 'Reports' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => { setActiveTab(tab.id); setPage(1); }}
                                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium ${activeTab === tab.id ? 'bg-[#0E2B3D] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                            >
                                {tab.label}{tab.count != null ? ` (${tab.count})` : ''}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'plans' ? (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-sm md:flex-row">
                                <div className="relative min-w-0 flex-1">
                                    <FaSearch className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                                    <input
                                        className="w-full rounded-xl border border-[#E2E8F0] py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#1CCA9B]"
                                        placeholder="Search plan, department, or owner"
                                        value={searchTerm}
                                        onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }}
                                    />
                                </div>
                                <select className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm" value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setPage(1); }}>
                                    <option value="all">All years</option>
                                    {years.map((year) => <option key={year} value={year}>{year}</option>)}
                                </select>
                                <select className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm" value={quarterFilter} onChange={(event) => { setQuarterFilter(event.target.value); setPage(1); }}>
                                    <option value="all">All quarters</option>
                                    <option value="1">Q1</option>
                                    <option value="2">Q2</option>
                                    <option value="3">Q3</option>
                                    <option value="4">Q4</option>
                                </select>
                                <select className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-sm" value={departmentFilter} onChange={(event) => { setDepartmentFilter(event.target.value); setPage(1); }}>
                                    <option value="all">All departments</option>
                                    {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2 overflow-x-auto">
                                {STAGE_FILTERS.map((stage) => (
                                    <button
                                        key={stage.key}
                                        type="button"
                                        onClick={() => { setStatusFilter(stage.key); setPage(1); }}
                                        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === stage.key ? 'bg-[#0a8f6c] text-white' : 'bg-white text-slate-600'}`}
                                    >
                                        {stage.label} ({stageCounts[stage.key] || 0})
                                    </button>
                                ))}
                            </div>

                            {selectedPlan ? (
                                <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-5">
                                    <div className="flex flex-col gap-4">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h2 className="text-lg font-semibold text-[#0E2B3D]">{selectedPlan.planName}</h2>
                                                <WfBadge status={selectedPlan.status}>{selectedPlan.status === 'Pending Approval' ? 'Submitted' : selectedPlan.status === 'In Progress' ? 'Confirmed' : selectedPlan.status}</WfBadge>
                                                {selectedPlan.priority ? <WfBadge status={selectedPlan.priority}>{selectedPlan.priority}</WfBadge> : null}
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500">
                                                {[selectedPlan.department, selectedPlan.jobTitle || selectedPlan.designation, selectedPlan.quarter ? `Q${selectedPlan.quarter}` : null, selectedPlan.planYear].filter(Boolean).join(' · ')}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedPlan.status === 'Draft' || selectedPlan.status === 'Rejected' ? (
                                                <button type="button" disabled={workflowBusy} onClick={() => runWorkflow(selectedPlan, 'submit')} className="rounded-xl bg-[#0E2B3D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Submit</button>
                                            ) : null}
                                            {selectedPlan.status === 'Pending Approval' ? (
                                                <>
                                                    <button type="button" disabled={workflowBusy} onClick={() => runWorkflow(selectedPlan, 'approve')} className="rounded-xl bg-[#0a8f6c] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Approve</button>
                                                    <button type="button" disabled={workflowBusy} onClick={() => { setRejectReason(''); setRejectFor(selectedPlan); }} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button>
                                                </>
                                            ) : null}
                                            {selectedPlan.status === 'Approved' ? (
                                                <button type="button" disabled={workflowBusy} onClick={() => runWorkflow(selectedPlan, 'start')} className="rounded-xl bg-[#0E2B3D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Confirm</button>
                                            ) : null}
                                            {selectedPlan.status === 'In Progress' ? (
                                                <button type="button" disabled={workflowBusy} onClick={() => runWorkflow(selectedPlan, 'complete')} className="rounded-xl bg-[#0E2B3D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Complete</button>
                                            ) : null}
                                            <button type="button" disabled={workflowBusy} onClick={() => createRequisition(selectedPlan)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#0E2B3D] disabled:opacity-60">Create Requisition</button>
                                            <button type="button" onClick={() => navigate(`/workforce/${selectedPlan._id}`)} className="rounded-xl border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#0a8f6c]">Open plan</button>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {STEPS.map((step, index) => {
                                            const done = stepIndex >= index || selectedPlan.status === 'Completed';
                                            return (
                                                <div key={step.status} className="rounded-xl bg-[#F4F7FB] px-3 py-2">
                                                    <p className={`text-[11px] font-semibold uppercase tracking-wide ${done ? 'text-[#0a8f6c]' : 'text-slate-400'}`}>{step.label}</p>
                                                    <div className={`mt-2 h-1.5 rounded-full ${done ? 'bg-[#1CCA9B]' : 'bg-slate-200'}`} />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Headcount</p>
                                            <p className="mt-2 text-sm text-slate-600">Current {currentHead} · Target {targetHead}</p>
                                            <div className="mt-3 space-y-2">
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div className="h-full bg-[#0E2B3D]" style={{ width: `${Math.round((currentHead / headMax) * 100)}%` }} />
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div className="h-full bg-[#1CCA9B]" style={{ width: `${Math.round((targetHead / headMax) * 100)}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Budget</p>
                                            <p className="mt-2 text-sm font-semibold text-[#0E2B3D]">{money(allocated)} allocated</p>
                                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full bg-[#0a8f6c]" style={{ width: `${budgetPct}%` }} />
                                            </div>
                                            <p className="mt-2 text-xs text-slate-500">Spent {money(spent)} · Remaining {money(selectedPlan.budget?.remaining ?? allocated - spent)}</p>
                                            {(selectedPlan.hiringPlan || []).filter((line) => Number(line.budget) > 0).slice(0, 3).map((line, index) => (
                                                <p key={`${line.position}-${index}`} className="mt-1 truncate text-xs text-slate-600">
                                                    {line.position || line.jobTitle || 'Hiring line'} · {money(line.budget)}
                                                </p>
                                            ))}
                                        </div>
                                        <div className="rounded-xl border border-[#E2E8F0] p-4">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open positions</p>
                                            {selectedOpenings.length === 0 ? (
                                                <p className="mt-2 text-sm text-slate-500">No open hiring lines on this plan.</p>
                                            ) : (
                                                <ul className="mt-2 space-y-2">
                                                    {selectedOpenings.slice(0, 4).map((row) => (
                                                        <li key={`${row.planId}-${row.hiringIndex}`} className="flex items-center justify-between gap-2 text-sm">
                                                            <span className="truncate text-[#0E2B3D]">{row.position || row.jobTitle}</span>
                                                            <span className="shrink-0 text-xs text-slate-500">{row.remainingHiringNeed} open</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            ) : (
                                <WfEmpty
                                    icon={FaUsers}
                                    title="No workforce plans found"
                                    description="Nothing matches this view. Adjust the filters or start a plan for this fiscal year."
                                    action={<WfButton onClick={() => { resetPlanForm(); setShowCreatePlanModal(true); }}><FaPlus /> New Workforce Plan</WfButton>}
                                />
                            )}

                            {signals.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {signals.map((row) => (
                                        <button
                                            key={row.department}
                                            type="button"
                                            onClick={() => setActiveTab('gap')}
                                            className="rounded-2xl border border-[#E2E8F0] bg-white p-4 text-left"
                                        >
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacity signal</p>
                                            <p className="mt-1 font-semibold text-[#0E2B3D]">{row.department}</p>
                                            <p className={`mt-1 text-sm ${gapToneFromStatus(row.status, row.gap)}`}>
                                                {row.status} · gap {formatGapValue(row.gap)} · current {row.current} / required {row.required}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {filteredPlans.length > 0 ? (
                                <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[720px] text-sm">
                                            <thead className="bg-[#F8FAF9] text-left text-[11px] uppercase tracking-wide text-slate-500">
                                                <tr>
                                                    <th className="px-4 py-3">Plan</th>
                                                    <th className="px-4 py-3">Department</th>
                                                    <th className="px-4 py-3">Owner</th>
                                                    <th className="px-4 py-3">Target</th>
                                                    <th className="px-4 py-3">Budget</th>
                                                    <th className="px-4 py-3">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagePlans.map((plan) => {
                                                    const planAllocated = Number(plan.budget?.allocated) || 0;
                                                    const planSpent = Number(plan.budget?.spent) || 0;
                                                    const selected = selectedPlan && String(selectedPlan._id) === String(plan._id);
                                                    return (
                                                        <tr key={plan._id} className={selected ? 'bg-[#1CCA9B]/10' : 'border-t border-[#E2E8F0]'}>
                                                            <td className="px-4 py-3">
                                                                <button type="button" className="text-left font-semibold text-[#0E2B3D]" onClick={() => setSelectedPlanId(plan._id)}>
                                                                    {plan.planName}
                                                                </button>
                                                                <p className="text-xs text-slate-500">{plan.quarter ? `Q${plan.quarter} ` : ''}{plan.planYear}</p>
                                                            </td>
                                                            <td className="px-4 py-3">{plan.department || '—'}</td>
                                                            <td className="px-4 py-3">{personName(plan.createdBy) || '—'}</td>
                                                            <td className="px-4 py-3">{plan.targetHeadcount}</td>
                                                            <td className="px-4 py-3">{planAllocated ? `${money(planSpent)} / ${money(planAllocated)}` : '—'}</td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex gap-2">
                                                                    <button type="button" className="text-xs font-semibold text-[#0a8f6c]" onClick={() => navigate(`/workforce/${plan._id}`)}>View</button>
                                                                    <button type="button" className="text-rose-500" aria-label="Delete plan" onClick={() => handleDeletePlan(plan._id)}><FaTrash /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-sm text-slate-500">
                                        <span>{filteredPlans.length} plan{filteredPlans.length === 1 ? '' : 's'}</span>
                                        <div className="flex items-center gap-2">
                                            <button type="button" disabled={safePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg px-2 py-1 disabled:opacity-40">Prev</button>
                                            <span>{safePage} / {pageCount}</span>
                                            <button type="button" disabled={safePage >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg px-2 py-1 disabled:opacity-40">Next</button>
                                        </div>
                                    </div>
                                </section>
                            ) : null}
                        </div>
                    ) : null}

                    {activeTab === 'requisitions' ? (
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    className={wfInputClass}
                                    placeholder="Search role, plan, or department"
                                    value={reqSearch}
                                    onChange={(event) => setReqSearch(event.target.value)}
                                />
                                <select className={wfInputClass} value={reqDepartment} onChange={(event) => setReqDepartment(event.target.value)}>
                                    <option value="all">All departments</option>
                                    {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </div>
                            <WfPanel title="Open requisitions" subtitle="Hiring lines that still need people. Creating a job does not add a second headcount target." bodyClassName="p-0">
                            <WfTable
                                minWidth="860px"
                                rows={filteredOpenings.map((row) => ({ ...row, _key: `${row.planId}-${row.hiringIndex}` }))}
                                empty="No open hiring lines. Add them on a workforce plan."
                                columns={[
                                    { key: 'position', label: 'Role', render: (row) => <span className="font-medium text-slate-800">{row.position || row.jobTitle}</span> },
                                    { key: 'planName', label: 'Plan', render: (row) => <button type="button" className="text-[#0a8f6c]" onClick={() => navigate(`/workforce/${row.planId}`)}>{row.planName}</button> },
                                    { key: 'department', label: 'Department' },
                                    { key: 'remainingHiringNeed', label: 'Remaining' },
                                    { key: 'priority', label: 'Priority', render: (row) => <WfBadge status={row.priority}>{row.priority}</WfBadge> },
                                    { key: 'hiringStatus', label: 'Status', render: (row) => <WfBadge status={row.hiringStatus}>{row.hiringInProgress ? 'In progress' : row.hiringStatus}</WfBadge> },
                                ]}
                            />
                        </WfPanel>
                        </div>
                    ) : null}

                    {activeTab === 'gap' ? (
                        <WfPanel
                            title="Gap analysis"
                            action={(
                                <select value={gapGroupBy} onChange={(event) => setGapGroupBy(event.target.value)} className={wfInputClass}>
                                    <option value="designation">By designation</option>
                                    <option value="department">By department</option>
                                </select>
                            )}
                            bodyClassName="p-0"
                        >
                            {sectionLoading && !gapAnalysis ? <p className="px-6 py-8 text-sm text-slate-500">Loading gap analysis…</p> : null}
                            {gapAnalysis?.summary ? (
                                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
                                    <WfKpiCard title="Total shortage" value={formatGapValue(gapAnalysis.summary.totalShortage)} tone="rose" />
                                    <WfKpiCard title="Total surplus" value={formatGapValue(gapAnalysis.summary.totalSurplus)} tone="amber" />
                                    <WfKpiCard title="Balanced" value={gapAnalysis.summary.balanced} tone="emerald" />
                                </div>
                            ) : null}
                            <WfTable
                                minWidth="780px"
                                rows={(gapAnalysis?.rows || []).map((row, index) => ({ ...row, _key: `${row.department}-${row.jobTitle || index}` }))}
                                empty="No gap data yet. Create plans with a target headcount."
                                columns={[
                                    { key: 'department', label: 'Department' },
                                    ...(gapGroupBy !== 'department' ? [{ key: 'designation', label: 'Designation', render: (row) => row.designation || row.jobTitle || '—' }] : []),
                                    { key: 'currentHeadcount', label: 'Current' },
                                    { key: 'requiredHeadcount', label: 'Required' },
                                    { key: 'gap', label: 'Gap', render: (row) => <span className={gapToneFromStatus(row.status, row.gap)}>{formatGapValue(row.gap)}</span> },
                                    { key: 'status', label: 'Status', render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge> },
                                ]}
                            />
                        </WfPanel>
                    ) : null}

                    {activeTab === 'forecasts' ? (
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input className={wfInputClass} placeholder="Search by department" value={forecastSearch} onChange={(event) => setForecastSearch(event.target.value)} />
                                <select className={wfInputClass} value={forecastDepartment} onChange={(event) => setForecastDepartment(event.target.value)}>
                                    <option value="all">All departments</option>
                                    {departments.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </div>
                            {sectionLoading && !forecastsLoaded ? <p className="text-sm text-slate-500">Loading forecasts…</p> : (
                                <WfPanel title="Headcount forecasts" bodyClassName="p-0">
                                    <WfTable
                                        minWidth="760px"
                                        rows={filteredForecasts}
                                        empty={forecasts.length === 0 ? 'No headcount forecasts yet.' : 'No forecasts match this filter.'}
                                        columns={[
                                            { key: 'forecastDate', label: 'Date', render: (row) => row.forecastDate ? format(new Date(row.forecastDate), 'MMM d, yyyy') : '—' },
                                            { key: 'department', label: 'Department', render: (row) => row.department || 'All' },
                                            { key: 'currentHeadcount', label: 'Current' },
                                            { key: 'projectedHeadcount', label: 'Projected' },
                                            { key: 'change', label: 'Change', render: (row) => {
                                                const change = (row.projectedHeadcount || 0) - (row.currentHeadcount || 0);
                                                return <span className={change >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{change >= 0 ? '+' : ''}{change}</span>;
                                            } },
                                            { key: 'confidenceLevel', label: 'Confidence', render: (row) => <WfBadge status={row.confidenceLevel}>{row.confidenceLevel}</WfBadge> },
                                            { key: 'actions', label: '', render: (row) => <button type="button" aria-label="Delete forecast" className="text-rose-500" onClick={() => handleDeleteForecast(row._id)}><FaTrash /></button> },
                                        ]}
                                    />
                                </WfPanel>
                            )}
                        </div>
                    ) : null}

                    {activeTab === 'reports' ? (
                        sectionLoading && !reports ? <p className="text-sm text-slate-500">Loading reports…</p> : reports ? (
                            <div className="space-y-4">
                                <WfPanel
                                    title="Current vs required"
                                    action={<WfButton size="sm" onClick={() => downloadCsv('workforce-current-vs-required.csv', reports.exportCsv?.currentVsRequired || '')}><FaDownload /> Export CSV</WfButton>}
                                >
                                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                                        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[11px] uppercase text-slate-500">Current</p><p className="text-2xl font-bold">{reports.currentVsRequired?.currentHeadcount}</p></div>
                                        <div className="rounded-xl bg-teal-50 p-3 text-center"><p className="text-[11px] uppercase text-slate-500">Required</p><p className="text-2xl font-bold text-teal-700">{reports.currentVsRequired?.requiredHeadcount}</p></div>
                                        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[11px] uppercase text-slate-500">Gap</p><p className={`text-2xl font-bold ${gapTone(reports.currentVsRequired?.gap)}`}>{formatGapValue(reports.currentVsRequired?.gap)}</p></div>
                                        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-[11px] uppercase text-slate-500">Status</p><div className="mt-2 flex justify-center"><WfBadge status={reports.currentVsRequired?.status}>{reports.currentVsRequired?.status}</WfBadge></div></div>
                                    </div>
                                </WfPanel>
                                <WfPanel title="Department-wise" bodyClassName="p-0" action={<WfButton variant="ghost" size="sm" onClick={() => downloadCsv('workforce-department-wise.csv', reports.exportCsv?.departmentWise || '')}><FaDownload /> Export</WfButton>}>
                                    <WfTable minWidth="720px" rows={reports.departmentWise || []} columns={[
                                        { key: 'department', label: 'Department' },
                                        { key: 'currentHeadcount', label: 'Current' },
                                        { key: 'requiredHeadcount', label: 'Required' },
                                        { key: 'gap', label: 'Gap', render: (row) => <span className={gapToneFromStatus(row.status, row.gap)}>{formatGapValue(row.gap)}</span> },
                                        { key: 'status', label: 'Status', render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge> },
                                    ]} />
                                </WfPanel>
                                <WfPanel title="Designation-wise" bodyClassName="p-0" action={<WfButton variant="ghost" size="sm" onClick={() => downloadCsv('workforce-designation-wise.csv', reports.exportCsv?.designationWise || '')}><FaDownload /> Export</WfButton>}>
                                    <WfTable
                                        minWidth="720px"
                                        rows={(reports.designationWise || []).map((row, index) => ({ ...row, _key: `${row.department}-${row.jobTitle}-${index}` }))}
                                        columns={[
                                            { key: 'department', label: 'Department' },
                                            { key: 'designation', label: 'Designation' },
                                            { key: 'currentHeadcount', label: 'Current' },
                                            { key: 'requiredHeadcount', label: 'Required' },
                                            { key: 'gap', label: 'Gap', render: (row) => <span className={gapToneFromStatus(row.status, row.gap)}>{formatGapValue(row.gap)}</span> },
                                            { key: 'status', label: 'Status', render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge> },
                                        ]}
                                    />
                                </WfPanel>
                            </div>
                        ) : null
                    ) : null}
                </div>
            </div>

            {showCreatePlanModal ? (
                <WfModal title="Create Workforce Plan" subtitle="Define headcount targets and budget for a planning period" onClose={() => { setShowCreatePlanModal(false); resetPlanForm(); }}>
                    <form onSubmit={handleCreatePlan} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Plan Name" required>
                                <input type="text" required value={planFormData.planName} onChange={(event) => setPlanFormData({ ...planFormData, planName: event.target.value })} className={wfInputClass} />
                            </WfField>
                            <WfField label="Department">
                                <select value={planFormData.department} onChange={(event) => setPlanFormData({ ...planFormData, department: event.target.value })} className={wfInputClass}>
                                    <option value="">All / Select department</option>
                                    {DEPARTMENT_OPTIONS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </WfField>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Designation / Job Title">
                                <select value={planFormData.jobTitle} onChange={(event) => setPlanFormData({ ...planFormData, jobTitle: event.target.value })} className={wfInputClass}>
                                    <option value="">All roles in department</option>
                                    {JOB_TITLE_OPTIONS.map((title) => <option key={title} value={title}>{title}</option>)}
                                </select>
                            </WfField>
                            <WfField label="Priority">
                                <select value={planFormData.priority} onChange={(event) => setPlanFormData({ ...planFormData, priority: event.target.value })} className={wfInputClass}>
                                    {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                                </select>
                            </WfField>
                        </div>
                        <WfField label="Reason">
                            <input type="text" value={planFormData.reason} onChange={(event) => setPlanFormData({ ...planFormData, reason: event.target.value })} className={wfInputClass} placeholder="New project, attrition backfill" />
                        </WfField>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <WfField label="Plan Year">
                                <input type="number" min="2020" max="2100" value={planFormData.planYear} onChange={(event) => setPlanFormData({ ...planFormData, planYear: parseInt(event.target.value, 10) || new Date().getFullYear() })} className={wfInputClass} />
                            </WfField>
                            <WfField label="Quarter">
                                <select value={planFormData.quarter} onChange={(event) => setPlanFormData({ ...planFormData, quarter: parseInt(event.target.value, 10) })} className={wfInputClass}>
                                    <option value={1}>Q1</option>
                                    <option value={2}>Q2</option>
                                    <option value={3}>Q3</option>
                                    <option value={4}>Q4</option>
                                </select>
                            </WfField>
                            <WfField label="Status" hint="New plans always start as Draft">
                                <input type="text" value="Draft" readOnly className={wfInputReadonlyClass} />
                            </WfField>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Current Headcount (Live)" required hint="Auto-calculated from active employees">
                                <div className="relative">
                                    <input type="number" readOnly required min="0" value={planFormData.currentHeadcount} className={wfInputReadonlyClass} />
                                    {fetchingHeadcount ? <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" /> : null}
                                </div>
                            </WfField>
                            <WfField label="Required / Target Headcount" required hint={planGapHint}>
                                <input type="number" required min="1" value={planFormData.targetHeadcount} onChange={(event) => setPlanFormData({ ...planFormData, targetHeadcount: parseInt(event.target.value, 10) || 0 })} className={wfInputClass} />
                            </WfField>
                        </div>
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <h4 className="mb-3 text-sm font-semibold text-slate-800">Budget ({currency})</h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <WfField label="Allocated">
                                    <input type="number" min="0" value={planFormData.budget.allocated} onChange={(event) => setPlanFormData({ ...planFormData, budget: { ...planFormData.budget, allocated: parseFloat(event.target.value) || 0, remaining: (parseFloat(event.target.value) || 0) - (planFormData.budget.spent || 0) } })} className={wfInputClass} />
                                </WfField>
                                <WfField label="Spent">
                                    <input type="number" min="0" value={planFormData.budget.spent} onChange={(event) => setPlanFormData({ ...planFormData, budget: { ...planFormData.budget, spent: parseFloat(event.target.value) || 0, remaining: (planFormData.budget.allocated || 0) - (parseFloat(event.target.value) || 0) } })} className={wfInputClass} />
                                </WfField>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">Remaining: <span className="font-semibold text-teal-700">{money(planFormData.budget.remaining)}</span></p>
                        </div>
                        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:-mx-6 sm:px-6">
                            <WfButton type="button" variant="ghost" onClick={() => { setShowCreatePlanModal(false); resetPlanForm(); }}>Cancel</WfButton>
                            <WfButton type="submit" loading={submitting} disabled={submitting}>{submitting ? 'Creating...' : 'Create Plan'}</WfButton>
                        </div>
                    </form>
                </WfModal>
            ) : null}

            {showCreateForecastModal ? (
                <WfModal title="Create Headcount Forecast" subtitle="Project future headcount changes by department" maxWidth="max-w-2xl" onClose={() => { setShowCreateForecastModal(false); resetForecastForm(); }}>
                    <form onSubmit={handleCreateForecast} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Forecast Date" required>
                                <input type="date" required value={forecastFormData.forecastDate} onChange={(event) => setForecastFormData({ ...forecastFormData, forecastDate: event.target.value })} className={wfInputClass} />
                            </WfField>
                            <WfField label="Department">
                                <select value={forecastFormData.department} onChange={(event) => setForecastFormData({ ...forecastFormData, department: event.target.value })} className={wfInputClass}>
                                    <option value="">All departments</option>
                                    {DEPARTMENT_OPTIONS.map((dept) => <option key={dept} value={dept}>{dept}</option>)}
                                </select>
                            </WfField>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Current Headcount (Live)" required>
                                <input type="number" readOnly required min="0" value={forecastFormData.currentHeadcount} className={wfInputReadonlyClass} />
                            </WfField>
                            <WfField label="Projected Headcount">
                                <input type="number" min="0" value={forecastFormData.projectedHeadcount} onChange={(event) => setForecastFormData({ ...forecastFormData, projectedHeadcount: parseInt(event.target.value, 10) || 0 })} className={wfInputClass} />
                            </WfField>
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {['newHires', 'terminations', 'transfers', 'promotions'].map((field) => (
                                <WfField key={field} label={field.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase())}>
                                    <input type="number" min="0" value={forecastFormData[field]} onChange={(event) => setForecastFormData({ ...forecastFormData, [field]: parseInt(event.target.value, 10) || 0 })} className={wfInputClass} />
                                </WfField>
                            ))}
                        </div>
                        <WfField label="Confidence Level">
                            <select value={forecastFormData.confidenceLevel} onChange={(event) => setForecastFormData({ ...forecastFormData, confidenceLevel: event.target.value })} className={wfInputClass}>
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </WfField>
                        <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-[#E2E8F0] bg-white px-5 py-4 sm:-mx-6 sm:px-6">
                            <WfButton type="button" variant="ghost" onClick={() => { setShowCreateForecastModal(false); resetForecastForm(); }}>Cancel</WfButton>
                            <WfButton type="submit" loading={submitting} disabled={submitting}>{submitting ? 'Creating...' : 'Create Forecast'}</WfButton>
                        </div>
                    </form>
                </WfModal>
            ) : null}

            {rejectFor ? (
                <WfModal title="Reject plan" subtitle={rejectFor.planName} maxWidth="max-w-md" onClose={() => setRejectFor(null)}>
                    <form onSubmit={confirmReject} className="space-y-4">
                        <WfField label="Reason" required>
                            <textarea required rows={3} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className={wfInputClass} placeholder="Why this plan is being rejected" />
                        </WfField>
                        <div className="flex justify-end gap-2">
                            <WfButton type="button" variant="ghost" onClick={() => setRejectFor(null)}>Keep plan</WfButton>
                            <WfButton type="submit" variant="danger" loading={workflowBusy}>Reject</WfButton>
                        </div>
                    </form>
                </WfModal>
            ) : null}

            {reqFor ? (
                <WfModal title="Create requisition" subtitle={reqFor.planName} maxWidth="max-w-lg" onClose={() => setReqFor(null)}>
                    <form onSubmit={submitRequisitionLine} className="space-y-4">
                        <p className="text-sm text-slate-500">This plan has no hiring line yet. Add the role, then a recruitment job is created from it.</p>
                        <WfField label="Position" required>
                            <input className={wfInputClass} required value={reqForm.position} onChange={(event) => setReqForm((prev) => ({ ...prev, position: event.target.value }))} />
                        </WfField>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <WfField label="Department" required>
                                <input className={wfInputClass} required list="wf-req-departments" value={reqForm.department} onChange={(event) => setReqForm((prev) => ({ ...prev, department: event.target.value }))} />
                                <datalist id="wf-req-departments">
                                    {DEPARTMENT_OPTIONS.map((dept) => <option key={dept} value={dept} />)}
                                </datalist>
                            </WfField>
                            <WfField label="Openings">
                                <input className={wfInputClass} type="number" min="1" value={reqForm.numberOfPositions} onChange={(event) => setReqForm((prev) => ({ ...prev, numberOfPositions: parseInt(event.target.value, 10) || 1 }))} />
                            </WfField>
                        </div>
                        <div className="flex justify-end gap-2">
                            <WfButton type="button" variant="ghost" onClick={() => setReqFor(null)}>Cancel</WfButton>
                            <WfButton type="submit" loading={workflowBusy} disabled={workflowBusy}>Create requisition</WfButton>
                        </div>
                    </form>
                </WfModal>
            ) : null}
        </div>
    );
};

export default WorkforcePage;
