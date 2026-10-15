import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaChartLine, FaUsers, FaCalendar, FaPlus, FaSpinner, FaSearch, 
    FaFilter, FaTrash, FaEye, FaDownload, FaBriefcase, FaUserPlus,
    FaBalanceScale, FaClipboardList
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import {
    WfBadge,
    WfKpiCard,
    WfPanel,
    WfPageHeader,
    WfButton,
    WfTabs,
    WfTable,
    WfEmpty,
    WfModal,
    WfField,
    wfInputClass,
    wfInputReadonlyClass,
    gapTone,
    formatGapValue,
    gapToneFromStatus,
    PLAN_STATUS_OPTIONS,
    formatPlanStatus,
} from './components/workforceUi';

const DEPARTMENT_OPTIONS = [
    'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations',
    'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration'
];

const JOB_TITLE_OPTIONS = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'HR Manager', 'HR Executive',
    'Financial Analyst', 'Marketing Executive', 'Sales Representative', 'Product Manager',
    'QA Tester', 'Customer Support Specialist', 'UX/UI Designer', 'Project Manager',
    'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer'
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

const WorkforcePage = () => {
    const navigate = useNavigate();
    const [workforcePlans, setWorkforcePlans] = useState([]);
    const [forecasts, setForecasts] = useState([]);
    const [dashboard, setDashboard] = useState(null);
    const [gapAnalysis, setGapAnalysis] = useState(null);
    const [reports, setReports] = useState(null);
    const [gapGroupBy, setGapGroupBy] = useState('designation');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showCreateForecastModal, setShowCreateForecastModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fetchingHeadcount, setFetchingHeadcount] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');

    const [planFormData, setPlanFormData] = useState({
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
        budget: {
            allocated: 0,
            spent: 0,
            remaining: 0
        },
        hiringPlan: [],
        skillsRequired: [],
        risks: []
    });

    const [forecastFormData, setForecastFormData] = useState({
        forecastDate: '',
        department: '',
        currentHeadcount: 0,
        projectedHeadcount: 0,
        newHires: 0,
        terminations: 0,
        transfers: 0,
        promotions: 0,
        confidenceLevel: 'Medium',
        factors: []
    });

    const fetchLiveHeadcount = useCallback(async (department, jobTitle) => {
        try {
            setFetchingHeadcount(true);
            const params = {};
            if (department) params.department = department;
            if (jobTitle) params.jobTitle = jobTitle;
            const response = await axios.get('/v1/admin/workforce/live-headcount', {
                params,
                withCredentials: true
            });
            return response.data?.data?.currentHeadcount ?? 0;
        } catch {
            return null;
        } finally {
            setFetchingHeadcount(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [activeTab, gapGroupBy]);

    // Auto-fill live headcount when department / job title changes in plan form
    useEffect(() => {
        if (!showCreatePlanModal) return;
        let cancelled = false;
        (async () => {
            const count = await fetchLiveHeadcount(planFormData.department, planFormData.jobTitle);
            if (!cancelled && count != null) {
                setPlanFormData((prev) => ({ ...prev, currentHeadcount: count }));
            }
        })();
        return () => { cancelled = true; };
    }, [showCreatePlanModal, planFormData.department, planFormData.jobTitle, fetchLiveHeadcount]);

    // Auto-fill forecast current headcount from live data
    useEffect(() => {
        if (!showCreateForecastModal) return;
        let cancelled = false;
        (async () => {
            const count = await fetchLiveHeadcount(forecastFormData.department, '');
            if (!cancelled && count != null) {
                setForecastFormData((prev) => ({ ...prev, currentHeadcount: count }));
            }
        })();
        return () => { cancelled = true; };
    }, [showCreateForecastModal, forecastFormData.department, fetchLiveHeadcount]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'dashboard') {
                const response = await axios.get('/v1/admin/workforce/dashboard', { withCredentials: true });
                setDashboard(response.data?.data || null);
            } else if (activeTab === 'gap') {
                const response = await axios.get('/v1/admin/workforce/gap-analysis', {
                    params: { groupBy: gapGroupBy },
                    withCredentials: true
                });
                setGapAnalysis(response.data?.data || null);
            } else if (activeTab === 'reports') {
                const response = await axios.get('/v1/admin/workforce/reports', { withCredentials: true });
                setReports(response.data?.data || null);
            } else if (activeTab === 'plans') {
                const response = await axios.get('/v1/admin/workforce/workforce-plans', { withCredentials: true });
                setWorkforcePlans(response.data?.data || []);
            } else {
                const response = await axios.get('/v1/admin/workforce/headcount-forecasts', { withCredentials: true });
                setForecasts(response.data?.data || []);
            }
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        
        if (!planFormData.planName || planFormData.currentHeadcount < 0 || planFormData.targetHeadcount < 0) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const data = {
                ...planFormData,
                designation: planFormData.jobTitle,
                status: 'Draft',
                budget: {
                    ...planFormData.budget,
                    remaining: planFormData.budget.allocated - planFormData.budget.spent
                }
            };
            await axios.post('/v1/admin/workforce/workforce-plans', data, { withCredentials: true });
            toast.success('Workforce plan created successfully');
            setShowCreatePlanModal(false);
            resetPlanForm();
            setActiveTab('plans');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create workforce plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateForecast = async (e) => {
        e.preventDefault();
        
        if (!forecastFormData.forecastDate || forecastFormData.currentHeadcount < 0) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post('/v1/admin/workforce/headcount-forecasts', forecastFormData, { withCredentials: true });
            toast.success('Headcount forecast created successfully');
            setShowCreateForecastModal(false);
            resetForecastForm();
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create headcount forecast');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this workforce plan?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/workforce/workforce-plans/${planId}`, { withCredentials: true });
            toast.success('Workforce plan deleted successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete workforce plan');
        }
    };

    const handleDeleteForecast = async (forecastId) => {
        if (!window.confirm('Are you sure you want to delete this forecast?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/workforce/headcount-forecasts/${forecastId}`, { withCredentials: true });
            toast.success('Forecast deleted successfully');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete forecast');
        }
    };

    const resetPlanForm = () => {
        setPlanFormData({
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
            budget: {
                allocated: 0,
                spent: 0,
                remaining: 0
            },
            hiringPlan: [],
            skillsRequired: [],
            risks: []
        });
    };

    const resetForecastForm = () => {
        setForecastFormData({
            forecastDate: '',
            department: '',
            currentHeadcount: 0,
            projectedHeadcount: 0,
            newHires: 0,
            terminations: 0,
            transfers: 0,
            promotions: 0,
            confidenceLevel: 'Medium',
            factors: []
        });
    };

    const filteredPlans = workforcePlans.filter(plan => {
        const matchesSearch = searchTerm === '' || 
            plan.planName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
        const matchesYear = yearFilter === 'all' || plan.planYear === parseInt(yearFilter);
        const matchesDept = departmentFilter === 'all' || plan.department === departmentFilter;
        
        return matchesSearch && matchesStatus && matchesYear && matchesDept;
    });

    const filteredForecasts = forecasts.filter(forecast => {
        const matchesSearch = searchTerm === '' || 
            forecast.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesDept = departmentFilter === 'all' || forecast.department === departmentFilter;
        
        return matchesSearch && matchesDept;
    });

    const departments = [...new Set([
        ...workforcePlans.map(p => p.department).filter(Boolean),
        ...forecasts.map(f => f.department).filter(Boolean),
        ...(dashboard?.departmentWise || []).map(d => d.department).filter(Boolean)
    ])];
    const years = [...new Set(workforcePlans.map(p => p.planYear))].sort((a, b) => b - a);

    const switchTab = (tab) => {
        setActiveTab(tab);
        setSearchTerm('');
        setStatusFilter('all');
        setYearFilter('all');
        setDepartmentFilter('all');
    };

    if (loading) {
        return <LoadingSpinner message="Loading workforce planning data..." />;
    }

    const planGapPreview = Math.abs((planFormData.targetHeadcount || 0) - (planFormData.currentHeadcount || 0));
    const planGapStatus =
        (planFormData.currentHeadcount || 0) < (planFormData.targetHeadcount || 0)
            ? 'Shortage'
            : (planFormData.currentHeadcount || 0) > (planFormData.targetHeadcount || 0)
              ? 'Surplus'
              : 'Balanced';

    return (
        <div className="wf-ui min-w-0 overflow-x-hidden transition-all duration-300" style={{ backgroundColor: '#F5F7FB' }}>
            <div className="page-shell min-w-0">
            <div className="page-shell-inner min-w-0">
            <div className="hrms-stack min-w-0">
                <WfPageHeader
                    eyebrow="Workforce Planning"
                    title="Workforce Planning"
                    subtitle="Forecast and plan headcount across departments and roles"
                    actions={
                        <>
                            {(activeTab === 'plans' || activeTab === 'dashboard') && (
                                <WfButton
                                    onClick={() => {
                                        resetPlanForm();
                                        setShowCreatePlanModal(true);
                                    }}
                                >
                                    <FaPlus />
                                    Create Plan
                                </WfButton>
                            )}
                            {activeTab === 'forecasts' && (
                                <WfButton
                                    onClick={() => {
                                        resetForecastForm();
                                        setShowCreateForecastModal(true);
                                    }}
                                >
                                    <FaPlus />
                                    Create Forecast
                                </WfButton>
                            )}
                        </>
                    }
                />

                <WfTabs
                    activeId={activeTab}
                    onChange={switchTab}
                    tabs={[
                        { id: 'dashboard', label: 'Dashboard', icon: FaClipboardList },
                        { id: 'gap', label: 'Gap Analysis', icon: FaBalanceScale },
                        { id: 'plans', label: 'Workforce Plans', icon: FaChartLine, count: workforcePlans.length },
                        { id: 'forecasts', label: 'Forecasts', icon: FaCalendar, count: forecasts.length },
                        { id: 'reports', label: 'Reports', icon: FaDownload },
                    ]}
                />

                {/* Dashboard */}
                {activeTab === 'dashboard' && dashboard && (
                    <div className="min-w-0 max-w-full space-y-3 sm:space-y-4 lg:space-y-5">
                        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-3">
                            <WfKpiCard title="Total Employees" value={dashboard.totalEmployees} icon={FaUsers} tone="teal" />
                            <WfKpiCard title="Planned Workforce" value={dashboard.plannedWorkforce} icon={FaBriefcase} tone="violet" />
                            <WfKpiCard
                                title="Workforce Gap"
                                value={formatGapValue(dashboard.workforceGap)}
                                icon={FaBalanceScale}
                                tone={
                                    dashboard.workforceGapStatus === 'Shortage' || dashboard.workforceSignedGap > 0
                                        ? 'rose'
                                        : dashboard.workforceGapStatus === 'Surplus' || dashboard.workforceSignedGap < 0
                                          ? 'amber'
                                          : 'emerald'
                                }
                                valueClass={gapToneFromStatus(
                                    dashboard.workforceGapStatus,
                                    dashboard.workforceSignedGap ?? dashboard.workforceGap
                                )}
                            />
                            <WfKpiCard title="Open Positions" value={dashboard.openPositions} icon={FaUserPlus} tone="sky" />
                            <WfKpiCard
                                title="Hiring In Progress"
                                value={dashboard.hiringInProgress ?? 0}
                                icon={FaClipboardList}
                                tone="amber"
                            />
                            <WfKpiCard
                                title="Remaining Hiring Need"
                                value={dashboard.remainingHiringNeed ?? dashboard.openPositions ?? 0}
                                icon={FaBriefcase}
                                tone="violet"
                            />
                            <WfKpiCard title="Upcoming Hiring" value={dashboard.upcomingHiringCount} icon={FaCalendar} tone="amber" />
                            <WfKpiCard title="Active Plans" value={dashboard.activePlansCount} icon={FaChartLine} tone="emerald" />
                        </div>

                        <WfPanel title="Department-wise Workforce" bodyClassName="p-0 sm:p-0">
                            <WfTable
                                minWidth="720px"
                                columns={[
                                    { key: 'department', label: 'Department', render: (row) => <span className="font-medium text-slate-800">{row.department}</span> },
                                    { key: 'current', label: 'Current' },
                                    { key: 'required', label: 'Required' },
                                    {
                                        key: 'gap',
                                        label: 'Gap',
                                        render: (row) => (
                                            <span className={`font-semibold ${gapToneFromStatus(row.status, row.gap)}`}>
                                                {formatGapValue(row.gap)}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge>,
                                    },
                                ]}
                                rows={dashboard.departmentWise || []}
                                empty="No department data available"
                            />
                        </WfPanel>

                        {(dashboard.upcomingHiring || []).length > 0 && (
                            <WfPanel title="Upcoming Hiring" bodyClassName="p-0 sm:p-0">
                                <WfTable
                                    minWidth="960px"
                                    columns={[
                                        {
                                            key: 'position',
                                            label: 'Position',
                                            render: (h) => (
                                                <div>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/workforce/${h.planId}`)}
                                                        className="h-auto p-0 font-medium text-teal-700 hover:underline"
                                                    >
                                                        {h.position || h.jobTitle || 'Position'}
                                                    </button>
                                                    <p className="text-xs text-slate-500">{h.planName}</p>
                                                </div>
                                            ),
                                        },
                                        { key: 'department', label: 'Department', render: (h) => h.department || '—' },
                                        { key: 'numberOfPositions', label: 'Required' },
                                        { key: 'filledPositions', label: 'Filled' },
                                        { key: 'remainingPositions', label: 'Remaining' },
                                        {
                                            key: 'hiringInProgress',
                                            label: 'Pipeline',
                                            render: (h) => (h.hiringInProgress ? 'In progress' : 'Not started'),
                                        },
                                        { key: 'priority', label: 'Priority', render: (h) => h.priority || '—' },
                                        {
                                            key: 'expectedStartDate',
                                            label: 'Start',
                                            render: (h) =>
                                                h.expectedStartDate
                                                    ? format(new Date(h.expectedStartDate), 'MMM dd, yyyy')
                                                    : 'TBD',
                                        },
                                    ]}
                                    rows={(dashboard.upcomingHiring || []).map((h, idx) => ({
                                        ...h,
                                        _key: `${h.planId}-${idx}`,
                                    }))}
                                />
                            </WfPanel>
                        )}
                    </div>
                )}

                {/* Gap Analysis */}
                {activeTab === 'gap' && (
                    <div className="min-w-0 max-w-full space-y-4">
                        <WfPanel
                            title="Gap Analysis"
                    
                            action={
                                <select
                                    value={gapGroupBy}
                                    onChange={(e) => setGapGroupBy(e.target.value)}
                                    className={wfInputClass}
                                >
                                    <option value="designation">By Designation</option>
                                    <option value="department">By Department</option>
                                </select>
                            }
                            bodyClassName="p-0"
                        >
                            {gapAnalysis?.summary && (
                                <div className="grid grid-cols-1 gap-2.5 border-b border-slate-100 px-3 py-3 sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5 md:px-7">
                                    <WfKpiCard
                                        title="Total Shortage"
                                        value={formatGapValue(gapAnalysis.summary.totalShortage)}
                                        tone="rose"
                                        valueClass="text-rose-600"
                                    />
                                    <WfKpiCard
                                        title="Total Surplus"
                                        value={formatGapValue(gapAnalysis.summary.totalSurplus)}
                                        tone="amber"
                                        valueClass="text-amber-600"
                                    />
                                    <WfKpiCard
                                        title="Balanced"
                                        value={gapAnalysis.summary.balanced}
                                        tone="emerald"
                                        valueClass="text-emerald-600"
                                    />
                                </div>
                            )}
                            <WfTable
                                minWidth="780px"
                                columns={[
                                    {
                                        key: 'department',
                                        label: 'Department',
                                        render: (row) => <span className="font-medium text-slate-800">{row.department}</span>,
                                    },
                                    ...(gapGroupBy !== 'department'
                                        ? [{
                                            key: 'designation',
                                            label: 'Designation',
                                            render: (row) => row.designation || row.jobTitle || '—',
                                        }]
                                        : []),
                                    { key: 'currentHeadcount', label: 'Current' },
                                    { key: 'requiredHeadcount', label: 'Required' },
                                    {
                                        key: 'gap',
                                        label: 'Gap',
                                        render: (row) => (
                                            <span className={`font-semibold ${gapToneFromStatus(row.status, row.gap)}`}>
                                                {formatGapValue(row.gap)}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge>,
                                    },
                                ]}
                                rows={(gapAnalysis?.rows || []).map((row, idx) => ({
                                    ...row,
                                    _key: `${row.department}-${row.jobTitle || idx}`,
                                }))}
                                empty="No gap data yet. Create workforce plans with target headcount to see shortages and surplus."
                            />
                        </WfPanel>
                    </div>
                )}

                {/* Reports */}
                {activeTab === 'reports' && reports && (
                    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
                        <WfPanel
                            title="Current vs Required"
                            subtitle="Overall workforce position"
                            action={
                                <WfButton
                                    size="sm"
                                    onClick={() =>
                                        downloadCsv(
                                            'workforce-current-vs-required.csv',
                                            reports.exportCsv?.currentVsRequired || ''
                                        )
                                    }
                                >
                                    <FaDownload /> Export CSV
                                </WfButton>
                            }
                        >
                            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4">
                                <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-100 sm:p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current</p>
                                    <p className="mt-1.5 text-xl font-bold text-slate-900 sm:mt-2 sm:text-2xl">{reports.currentVsRequired?.currentHeadcount}</p>
                                </div>
                                <div className="rounded-xl bg-teal-50 p-3 text-center ring-1 ring-teal-100 sm:p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Required</p>
                                    <p className="mt-1.5 text-xl font-bold text-teal-700 sm:mt-2 sm:text-2xl">{reports.currentVsRequired?.requiredHeadcount}</p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-100 sm:p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Gap</p>
                                    <p className={`mt-1.5 text-xl font-bold sm:mt-2 sm:text-2xl ${gapToneFromStatus(reports.currentVsRequired?.status, reports.currentVsRequired?.gap)}`}>
                                        {formatGapValue(reports.currentVsRequired?.gap)}
                                    </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-100 sm:p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</p>
                                    <div className="mt-1.5 flex justify-center sm:mt-2">
                                        <WfBadge status={reports.currentVsRequired?.status}>
                                            {reports.currentVsRequired?.status}
                                        </WfBadge>
                                    </div>
                                </div>
                            </div>
                        </WfPanel>

                        <WfPanel
                            title="Department-wise"
                            action={
                                <WfButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        downloadCsv(
                                            'workforce-department-wise.csv',
                                            reports.exportCsv?.departmentWise || ''
                                        )
                                    }
                                >
                                    <FaDownload /> Export
                                </WfButton>
                            }
                            bodyClassName="p-0 sm:p-0"
                        >
                            <WfTable
                                minWidth="720px"
                                columns={[
                                    { key: 'department', label: 'Department' },
                                    { key: 'currentHeadcount', label: 'Current' },
                                    { key: 'requiredHeadcount', label: 'Required' },
                                    {
                                        key: 'gap',
                                        label: 'Gap',
                                        render: (row) => (
                                            <span className={gapToneFromStatus(row.status, row.gap)}>
                                                {formatGapValue(row.gap)}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge>,
                                    },
                                ]}
                                rows={reports.departmentWise || []}
                            />
                        </WfPanel>

                        <WfPanel
                            title="Designation-wise"
                            action={
                                <WfButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        downloadCsv(
                                            'workforce-designation-wise.csv',
                                            reports.exportCsv?.designationWise || ''
                                        )
                                    }
                                >
                                    <FaDownload /> Export
                                </WfButton>
                            }
                            bodyClassName="p-0 sm:p-0"
                        >
                            <WfTable
                                minWidth="720px"
                                columns={[
                                    { key: 'department', label: 'Department' },
                                    { key: 'designation', label: 'Designation' },
                                    { key: 'currentHeadcount', label: 'Current' },
                                    { key: 'requiredHeadcount', label: 'Required' },
                                    {
                                        key: 'gap',
                                        label: 'Gap',
                                        render: (row) => (
                                            <span className={gapToneFromStatus(row.status, row.gap)}>
                                                {formatGapValue(row.gap)}
                                            </span>
                                        ),
                                    },
                                    {
                                        key: 'status',
                                        label: 'Status',
                                        render: (row) => <WfBadge status={row.status}>{row.status}</WfBadge>,
                                    },
                                ]}
                                rows={(reports.designationWise || []).map((row, idx) => ({
                                    ...row,
                                    _key: `${row.department}-${row.jobTitle}-${idx}`,
                                }))}
                            />
                        </WfPanel>
                    </div>
                )}

                {/* Filters for plans / forecasts */}
                {(activeTab === 'plans' || activeTab === 'forecasts') && (
                <div className="flex min-w-0 max-w-full flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'plans' ? 'Search by plan name, department or role...' : 'Search by department...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`${wfInputClass} pl-10`}
                        />
                    </div>
                    {activeTab === 'plans' ? (
                        <>
                            <div className="relative">
                                <FaFilter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className={`${wfInputClass} appearance-none pl-10 pr-8`}
                                >
                                    <option value="all">All Status</option>
                                    {PLAN_STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>{formatPlanStatus(status)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={yearFilter}
                                    onChange={(e) => setYearFilter(e.target.value)}
                                    className={`${wfInputClass} appearance-none pr-8`}
                                >
                                    <option value="all">All Years</option>
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : null}
                    <div className="relative">
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className={`${wfInputClass} appearance-none pr-8`}
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                </div>
                )}

                {activeTab === 'plans' && (
                    <div className="grid min-w-0 max-w-full grid-cols-1 items-start gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {filteredPlans.map((plan) => {
                            const current = plan.liveCurrentHeadcount ?? plan.currentHeadcount;
                            const gapStatus = plan.gapStatus || (
                                current < plan.targetHeadcount ? 'Shortage'
                                    : current > plan.targetHeadcount ? 'Surplus' : 'Balanced'
                            );
                            const gap = plan.gap != null
                                ? formatGapValue(plan.gap)
                                : formatGapValue((plan.targetHeadcount || 0) - (current || 0));
                            const fillRequired = plan.fillTracking?.required || 0;
                            const fillFilled = plan.fillTracking?.filled || 0;
                            const fillPct = fillRequired > 0
                                ? Math.min((fillFilled / fillRequired) * 100, 100)
                                : 0;
                            const maxHead = Math.max(current || 0, plan.targetHeadcount || 0, 1);

                            return (
                                <div
                                    key={plan._id}
                                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:border-teal-100 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between gap-3 border-b border-slate-50 px-5 py-4">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-base font-semibold text-slate-900">{plan.planName}</h3>
                                            <p className="mt-0.5 text-sm text-slate-500">
                                                {plan.planYear} Q{plan.quarter}
                                                {plan.department ? ` · ${plan.department}` : ''}
                                                {plan.jobTitle ? ` · ${plan.jobTitle}` : ''}
                                            </p>
                                        </div>
                                        <WfBadge status={plan.status}>{formatPlanStatus(plan.status)}</WfBadge>
                                    </div>

                                    <div className="flex-1 space-y-4 px-5 py-4">
                                        {plan.status === 'Rejected' && plan.rejectionReason && (
                                            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800 ring-1 ring-rose-100">
                                                <span className="font-semibold">Rejected:</span> {plan.rejectionReason}
                                            </div>
                                        )}
                                        <div className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-100">
                                            <div className="mb-2 flex items-end justify-between text-xs text-slate-500">
                                                <span>Live headcount</span>
                                                <span className="font-semibold text-slate-700">
                                                    {current} / {plan.targetHeadcount}
                                                </span>
                                            </div>
                                            <div className="flex h-2.5 gap-1 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                                                <div
                                                    className="rounded-full bg-slate-400/80"
                                                    style={{ width: `${(current / maxHead) * 100}%` }}
                                                    title="Current"
                                                />
                                                <div
                                                    className="rounded-full bg-teal-500"
                                                    style={{ width: `${(plan.targetHeadcount / maxHead) * 100}%` }}
                                                    title="Target"
                                                />
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Current</p>
                                                    <p className="font-bold text-slate-800">{current}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Target</p>
                                                    <p className="font-bold text-teal-700">{plan.targetHeadcount}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {gap !== 0 && (
                                            <div className={`rounded-xl px-3 py-2 text-center text-sm font-semibold ${
                                                gapStatus === 'Shortage'
                                                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                                    : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                            }`}>
                                                {gapStatus} {gap}
                                            </div>
                                        )}

                                        {fillRequired > 0 && (
                                            <div>
                                                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                                                    <span>Hiring fill</span>
                                                    <span>
                                                        {fillFilled}/{fillRequired}
                                                        {plan.fillTracking?.remaining != null && (
                                                            <> · {plan.fillTracking.remaining} left</>
                                                        )}
                                                    </span>
                                                </div>
                                                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all"
                                                        style={{ width: `${fillPct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {plan.budget && plan.budget.allocated > 0 && (
                                            <div className="text-sm">
                                                <div className="mb-1 flex justify-between text-slate-600">
                                                    <span>Budget</span>
                                                    <span className="font-medium">${plan.budget.allocated?.toLocaleString() || 0}</span>
                                                </div>
                                                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                                    <div
                                                        className="h-full rounded-full bg-teal-500"
                                                        style={{
                                                            width: `${plan.budget.allocated > 0
                                                                ? Math.min((plan.budget.spent / plan.budget.allocated) * 100, 100)
                                                                : 0}%`,
                                                        }}
                                                    />
                                                </div>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    ${plan.budget.spent?.toLocaleString() || 0} spent
                                                </p>
                                            </div>
                                        )}

                                        {plan.hiringPlan && plan.hiringPlan.length > 0 && (
                                            <p className="flex items-center gap-1.5 text-sm text-slate-500">
                                                <FaUsers className="text-teal-600" />
                                                {plan.hiringPlan.length} position{plan.hiringPlan.length !== 1 ? 's' : ''} planned
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2 border-t border-slate-50 px-5 py-3">
                                        <WfButton
                                            className="flex-1"
                                            size="sm"
                                            onClick={() => navigate(`/workforce/${plan._id}`)}
                                        >
                                            <FaEye /> View
                                        </WfButton>
                                        <WfButton
                                            variant="danger"
                                            size="sm"
                                            onClick={() => handleDeletePlan(plan._id)}
                                            aria-label="Delete plan"
                                        >
                                            <FaTrash />
                                        </WfButton>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredPlans.length === 0 && (
                            <div className="col-span-full">
                                <WfEmpty
                                    icon={FaChartLine}
                                    title={workforcePlans.length === 0
                                        ? 'No workforce plans yet'
                                        : 'No plans match your filters'}
                                    description={workforcePlans.length === 0
                                        ? 'Create a plan to start forecasting headcount needs.'
                                        : 'Try adjusting search or filters.'}
                                    action={
                                        workforcePlans.length === 0 ? (
                                            <WfButton
                                                onClick={() => {
                                                    resetPlanForm();
                                                    setShowCreatePlanModal(true);
                                                }}
                                            >
                                                <FaPlus /> Create Plan
                                            </WfButton>
                                        ) : null
                                    }
                                />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'forecasts' && (
                    <div className="min-w-0 max-w-full">
                    <WfPanel title="Headcount Forecasts" bodyClassName="p-0 sm:p-0">
                        <WfTable
                            minWidth="720px"
                            columns={[
                                {
                                    key: 'forecastDate',
                                    label: 'Date',
                                    render: (f) =>
                                        f.forecastDate
                                            ? format(new Date(f.forecastDate), 'MMM dd, yyyy')
                                            : 'N/A',
                                },
                                {
                                    key: 'department',
                                    label: 'Department',
                                    render: (f) => f.department || 'All',
                                },
                                {
                                    key: 'currentHeadcount',
                                    label: 'Current',
                                    render: (f) => <span className="font-medium">{f.currentHeadcount}</span>,
                                },
                                {
                                    key: 'projectedHeadcount',
                                    label: 'Projected',
                                    render: (f) => (
                                        <span className="font-semibold text-teal-700">{f.projectedHeadcount}</span>
                                    ),
                                },
                                {
                                    key: 'change',
                                    label: 'Change',
                                    render: (f) => {
                                        const change = f.projectedHeadcount - f.currentHeadcount;
                                        return (
                                            <span className={`font-medium ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {change >= 0 ? '+' : ''}{change}
                                            </span>
                                        );
                                    },
                                },
                                {
                                    key: 'confidenceLevel',
                                    label: 'Confidence',
                                    render: (f) => (
                                        <WfBadge status={f.confidenceLevel}>{f.confidenceLevel}</WfBadge>
                                    ),
                                },
                                {
                                    key: 'actions',
                                    label: 'Actions',
                                    render: (f) => (
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteForecast(f._id)}
                                            className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                                            aria-label="Delete forecast"
                                        >
                                            <FaTrash />
                                        </button>
                                    ),
                                },
                            ]}
                            rows={filteredForecasts}
                            empty={
                                forecasts.length === 0
                                    ? 'No headcount forecasts created yet.'
                                    : 'No forecasts match your filters.'
                            }
                        />
                    </WfPanel>
                    </div>
                )}
            </div>

            {/* Create Plan Modal */}
            {showCreatePlanModal && (
                <WfModal
                    title="Create Workforce Plan"
                    subtitle="Define headcount targets and budget for a planning period"
                    onClose={() => {
                        setShowCreatePlanModal(false);
                        resetPlanForm();
                    }}
                >
                    <form onSubmit={handleCreatePlan} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Plan Name" required>
                                <input
                                    type="text"
                                    value={planFormData.planName}
                                    onChange={(e) => setPlanFormData({ ...planFormData, planName: e.target.value })}
                                    className={wfInputClass}
                                    required
                                />
                            </WfField>
                            <WfField label="Department">
                                <select
                                    value={planFormData.department}
                                    onChange={(e) => setPlanFormData({ ...planFormData, department: e.target.value })}
                                    className={wfInputClass}
                                >
                                    <option value="">All / Select department</option>
                                    {DEPARTMENT_OPTIONS.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </WfField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Designation / Job Title">
                                <select
                                    value={planFormData.jobTitle}
                                    onChange={(e) => setPlanFormData({ ...planFormData, jobTitle: e.target.value })}
                                    className={wfInputClass}
                                >
                                    <option value="">All roles in department</option>
                                    {JOB_TITLE_OPTIONS.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </WfField>
                            <WfField label="Priority">
                                <select
                                    value={planFormData.priority}
                                    onChange={(e) => setPlanFormData({ ...planFormData, priority: e.target.value })}
                                    className={wfInputClass}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </WfField>
                        </div>

                        <WfField label="Reason">
                            <input
                                type="text"
                                value={planFormData.reason}
                                onChange={(e) => setPlanFormData({ ...planFormData, reason: e.target.value })}
                                className={wfInputClass}
                                placeholder="e.g. New project, attrition backfill"
                            />
                        </WfField>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <WfField label="Plan Year">
                                <input
                                    type="number"
                                    value={planFormData.planYear}
                                    onChange={(e) => setPlanFormData({ ...planFormData, planYear: parseInt(e.target.value) || new Date().getFullYear() })}
                                    className={wfInputClass}
                                    min="2020"
                                    max="2100"
                                />
                            </WfField>
                            <WfField label="Quarter">
                                <select
                                    value={planFormData.quarter}
                                    onChange={(e) => setPlanFormData({ ...planFormData, quarter: parseInt(e.target.value) })}
                                    className={wfInputClass}
                                >
                                    <option value={1}>Q1</option>
                                    <option value={2}>Q2</option>
                                    <option value={3}>Q3</option>
                                    <option value={4}>Q4</option>
                                </select>
                            </WfField>
                            <WfField label="Status" hint="New plans always start as Draft">
                                <input
                                    type="text"
                                    value="Draft"
                                    readOnly
                                    className={wfInputReadonlyClass}
                                />
                            </WfField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Current Headcount (Live)" required hint="Auto-calculated from active employees">
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={planFormData.currentHeadcount}
                                        readOnly
                                        className={wfInputReadonlyClass}
                                        min="0"
                                        required
                                    />
                                    {fetchingHeadcount && (
                                        <FaSpinner className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                                    )}
                                </div>
                            </WfField>
                            <WfField
                                label="Required / Target Headcount"
                                required
                                hint={`Gap: ${planGapPreview} (${planGapStatus})`}
                            >
                                <input
                                    type="number"
                                    value={planFormData.targetHeadcount}
                                    onChange={(e) => setPlanFormData({ ...planFormData, targetHeadcount: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                    required
                                />
                            </WfField>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <h4 className="mb-3 text-sm font-semibold text-slate-800">Budget</h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <WfField label="Allocated ($)">
                                    <input
                                        type="number"
                                        value={planFormData.budget.allocated}
                                        onChange={(e) => setPlanFormData({
                                            ...planFormData,
                                            budget: {
                                                ...planFormData.budget,
                                                allocated: parseFloat(e.target.value) || 0,
                                                remaining: (parseFloat(e.target.value) || 0) - (planFormData.budget.spent || 0)
                                            }
                                        })}
                                        className={wfInputClass}
                                        min="0"
                                    />
                                </WfField>
                                <WfField label="Spent ($)">
                                    <input
                                        type="number"
                                        value={planFormData.budget.spent}
                                        onChange={(e) => setPlanFormData({
                                            ...planFormData,
                                            budget: {
                                                ...planFormData.budget,
                                                spent: parseFloat(e.target.value) || 0,
                                                remaining: (planFormData.budget.allocated || 0) - (parseFloat(e.target.value) || 0)
                                            }
                                        })}
                                        className={wfInputClass}
                                        min="0"
                                    />
                                </WfField>
                            </div>
                            {planFormData.budget.remaining !== undefined && (
                                <p className="mt-2 text-sm text-slate-600">
                                    Remaining:{' '}
                                    <span className="font-semibold text-teal-700">
                                        ${planFormData.budget.remaining.toLocaleString()}
                                    </span>
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <WfButton
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setShowCreatePlanModal(false);
                                    resetPlanForm();
                                }}
                            >
                                Cancel
                            </WfButton>
                            <WfButton type="submit" loading={submitting} disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Plan'}
                            </WfButton>
                        </div>
                    </form>
                </WfModal>
            )}

            {/* Create Forecast Modal */}
            {showCreateForecastModal && (
                <WfModal
                    title="Create Headcount Forecast"
                    subtitle="Project future headcount changes by department"
                    maxWidth="max-w-2xl"
                    onClose={() => {
                        setShowCreateForecastModal(false);
                        resetForecastForm();
                    }}
                >
                    <form onSubmit={handleCreateForecast} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Forecast Date" required>
                                <input
                                    type="date"
                                    value={forecastFormData.forecastDate}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, forecastDate: e.target.value })}
                                    className={wfInputClass}
                                    required
                                />
                            </WfField>
                            <WfField label="Department">
                                <select
                                    value={forecastFormData.department}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, department: e.target.value })}
                                    className={wfInputClass}
                                >
                                    <option value="">All departments</option>
                                    {DEPARTMENT_OPTIONS.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </WfField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Current Headcount (Live)" required>
                                <input
                                    type="number"
                                    value={forecastFormData.currentHeadcount}
                                    readOnly
                                    className={wfInputReadonlyClass}
                                    min="0"
                                    required
                                />
                            </WfField>
                            <WfField label="Projected Headcount">
                                <input
                                    type="number"
                                    value={forecastFormData.projectedHeadcount}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, projectedHeadcount: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                        </div>

                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <WfField label="New Hires">
                                <input
                                    type="number"
                                    value={forecastFormData.newHires}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, newHires: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                            <WfField label="Terminations">
                                <input
                                    type="number"
                                    value={forecastFormData.terminations}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, terminations: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                            <WfField label="Transfers">
                                <input
                                    type="number"
                                    value={forecastFormData.transfers}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, transfers: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                            <WfField label="Promotions">
                                <input
                                    type="number"
                                    value={forecastFormData.promotions}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, promotions: parseInt(e.target.value) || 0 })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                        </div>

                        <WfField label="Confidence Level">
                            <select
                                value={forecastFormData.confidenceLevel}
                                onChange={(e) => setForecastFormData({ ...forecastFormData, confidenceLevel: e.target.value })}
                                className={wfInputClass}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </WfField>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <WfButton
                                type="button"
                                variant="ghost"
                                onClick={() => {
                                    setShowCreateForecastModal(false);
                                    resetForecastForm();
                                }}
                            >
                                Cancel
                            </WfButton>
                            <WfButton type="submit" loading={submitting} disabled={submitting}>
                                {submitting ? 'Creating...' : 'Create Forecast'}
                            </WfButton>
                        </div>
                    </form>
                </WfModal>
            )}
        </div>
        </div>
        </div>
    );
};

export default WorkforcePage;
