import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    FaArrowLeft, FaUsers, FaDollarSign,
    FaExclamationTriangle, FaPlus, FaBriefcase, FaLink
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
    WfEmpty,
    WfModal,
    WfField,
    wfInputClass,
    gapTone,
} from './components/workforceUi';

const WorkforceDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [creatingJobIndex, setCreatingJobIndex] = useState(null);
    const [updatingFillIndex, setUpdatingFillIndex] = useState(null);
    const [showAddHiringModal, setShowAddHiringModal] = useState(false);
    const [showAddRiskModal, setShowAddRiskModal] = useState(false);

    const [hiringForm, setHiringForm] = useState({
        position: '',
        department: '',
        jobTitle: '',
        numberOfPositions: 1,
        filledPositions: 0,
        priority: 'Medium',
        expectedStartDate: '',
        budget: 0,
        reason: '',
        status: 'Planned'
    });

    const [riskForm, setRiskForm] = useState({
        risk: '',
        impact: 'Medium',
        mitigation: ''
    });

    useEffect(() => {
        fetchPlan();
    }, [id]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/workforce/workforce-plans/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setPlan(response.data.data);
            } else {
                toast.error('Workforce plan not found');
                navigate('/workforce');
            }
        } catch (error) {
            toast.error('Failed to load workforce plan');
            navigate('/workforce');
        } finally {
            setLoading(false);
        }
    };

    const resetHiringForm = () => {
        setHiringForm({
            position: '',
            department: plan?.department || '',
            jobTitle: plan?.jobTitle || '',
            numberOfPositions: 1,
            filledPositions: 0,
            priority: plan?.priority || 'Medium',
            expectedStartDate: '',
            budget: 0,
            reason: '',
            status: 'Planned'
        });
    };

    const addHiringPosition = async (e) => {
        e.preventDefault();

        if (!hiringForm.position || !hiringForm.department) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const updatedHiringPlan = [
                ...(plan.hiringPlan || []),
                hiringForm
            ];

            await axios.put(
                `/v1/admin/workforce/workforce-plans/${id}`,
                { hiringPlan: updatedHiringPlan },
                { withCredentials: true }
            );

            toast.success('Hiring position added successfully');
            setShowAddHiringModal(false);
            resetHiringForm();
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add hiring position');
        } finally {
            setSubmitting(false);
        }
    };

    const createRecruitmentJob = async (hiringIndex) => {
        try {
            setCreatingJobIndex(hiringIndex);
            const response = await axios.post(
                `/v1/admin/workforce/workforce-plans/${id}/hiring/${hiringIndex}/create-job`,
                {},
                { withCredentials: true }
            );
            if (response.data?.data?.plan) {
                setPlan(response.data.data.plan);
            } else {
                await fetchPlan();
            }
            const jobId = response.data?.data?.jobPosting?._id;
            toast.success(response.data?.message || 'Recruitment job created');
            if (jobId) {
                navigate(`/recruitment/jobs/${jobId}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create recruitment job');
        } finally {
            setCreatingJobIndex(null);
        }
    };

    const updateFillCount = async (hiringIndex, filledPositions) => {
        try {
            setUpdatingFillIndex(hiringIndex);
            const response = await axios.put(
                `/v1/admin/workforce/workforce-plans/${id}/hiring/${hiringIndex}/fill`,
                { filledPositions: Math.max(0, parseInt(filledPositions, 10) || 0) },
                { withCredentials: true }
            );
            if (response.data?.data) {
                setPlan(response.data.data);
            } else {
                await fetchPlan();
            }
            toast.success('Fill tracking updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update fill tracking');
        } finally {
            setUpdatingFillIndex(null);
        }
    };

    const addRisk = async (e) => {
        e.preventDefault();

        if (!riskForm.risk || !riskForm.mitigation) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const updatedRisks = [
                ...(plan.risks || []),
                riskForm
            ];

            await axios.put(
                `/v1/admin/workforce/workforce-plans/${id}`,
                { risks: updatedRisks },
                { withCredentials: true }
            );

            toast.success('Risk added successfully');
            setShowAddRiskModal(false);
            setRiskForm({
                risk: '',
                impact: 'Medium',
                mitigation: ''
            });
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add risk');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading workforce plan..." />;
    }

    if (!plan) {
        return null;
    }

    const gap = (plan.gap != null)
        ? plan.gap
        : plan.targetHeadcount - (plan.liveCurrentHeadcount ?? plan.currentHeadcount);
    const currentHeadcount = plan.liveCurrentHeadcount ?? plan.currentHeadcount;
    const gapPercent = currentHeadcount > 0
        ? Math.round((gap / currentHeadcount) * 100)
        : 0;
    const totalHiringBudget = plan.hiringPlan?.reduce((sum, h) => sum + (h.budget || 0), 0) || 0;
    const filledPositions = plan.fillTracking?.filled
        ?? plan.hiringPlan?.reduce((sum, h) => sum + (h.filledPositions || 0), 0)
        ?? 0;
    const requiredPositions = plan.fillTracking?.required
        ?? plan.hiringPlan?.reduce((sum, h) => sum + (h.numberOfPositions || 0), 0)
        ?? 0;
    const remainingPositions = plan.fillTracking?.remaining
        ?? Math.max(requiredPositions - filledPositions, 0);
    const fillPct = requiredPositions > 0
        ? Math.min((filledPositions / requiredPositions) * 100, 100)
        : 0;
    const maxHead = Math.max(currentHeadcount || 0, plan.targetHeadcount || 0, 1);
    const budgetPct = plan.budget?.allocated > 0
        ? Math.min(((plan.budget.spent || 0) / plan.budget.allocated) * 100, 100)
        : 0;

    const infoRows = [
        { label: 'Year', value: plan.planYear },
        { label: 'Quarter', value: `Q${plan.quarter}` },
        plan.department && { label: 'Department', value: plan.department },
        (plan.jobTitle || plan.designation) && {
            label: 'Designation',
            value: plan.jobTitle || plan.designation,
        },
        plan.priority && { label: 'Priority', value: plan.priority, badge: true },
        plan.reason && { label: 'Reason', value: plan.reason },
        plan.createdBy && { label: 'Created By', value: plan.createdBy.name || 'N/A' },
        plan.approvedBy && { label: 'Approved By', value: plan.approvedBy.name || 'N/A' },
        plan.approvedAt && {
            label: 'Approved At',
            value: format(new Date(plan.approvedAt), 'MMM dd, yyyy'),
        },
    ].filter(Boolean);

    return (
        <div className="min-h-screen transition-all duration-300" style={{ backgroundColor: '#F5F7FB' }}>
            <div className="page-shell">
            <div className="page-shell-inner hrms-stack">
                <WfButton
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/workforce')}
                    className="-mb-2 w-fit"
                >
                    <FaArrowLeft /> Back to Workforce Planning
                </WfButton>

                <WfPageHeader
                    eyebrow="Workforce Plan"
                    title={plan.planName}
                    subtitle={`${plan.planYear} Q${plan.quarter}${plan.department ? ` · ${plan.department}` : ''}${plan.jobTitle ? ` · ${plan.jobTitle}` : ''}`}
                    actions={<WfBadge status={plan.status} className="px-3 py-1 text-sm">{plan.status}</WfBadge>}
                />

                <div className="hrms-main-rail">
                    <div className="min-w-0 space-y-5">
                        <WfPanel title="Headcount Overview" subtitle="Live current vs required target">
                            <div className="mb-5 grid grid-cols-2 gap-4">
                                <div className="rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-100">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current (Live)</p>
                                    <p className="mt-2 text-3xl font-bold text-slate-900">{currentHeadcount}</p>
                                </div>
                                <div className="rounded-2xl bg-teal-50 p-5 text-center ring-1 ring-teal-100">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Required / Target</p>
                                    <p className="mt-2 text-3xl font-bold text-teal-700">{plan.targetHeadcount}</p>
                                </div>
                            </div>

                            <div className="mb-4">
                                <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                                    <span>Coverage</span>
                                    <span>{currentHeadcount} of {plan.targetHeadcount}</span>
                                </div>
                                <div className="flex h-3 gap-1 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="rounded-full bg-slate-400"
                                        style={{ width: `${(currentHeadcount / maxHead) * 100}%` }}
                                    />
                                    <div
                                        className="rounded-full bg-teal-500"
                                        style={{ width: `${(plan.targetHeadcount / maxHead) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {gap !== 0 && (
                                <div className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                                    gap > 0
                                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                                        : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                                }`}>
                                    {gap > 0 ? 'Shortage ' : 'Surplus '}
                                    {gap > 0 ? '+' : ''}{gap}
                                    {gapPercent !== 0 && ` (${gapPercent > 0 ? '+' : ''}${gapPercent}%)`}
                                    {plan.gapStatus && ` · ${plan.gapStatus}`}
                                </div>
                            )}

                            {requiredPositions > 0 && (
                                <div className="mt-5">
                                    <div className="mb-3 grid grid-cols-3 gap-3">
                                        <WfKpiCard title="Required" value={requiredPositions} tone="slate" />
                                        <WfKpiCard title="Filled" value={filledPositions} tone="emerald" valueClass="text-emerald-600" />
                                        <WfKpiCard title="Remaining" value={remainingPositions} tone="amber" />
                                    </div>
                                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                                            style={{ width: `${fillPct}%` }}
                                        />
                                    </div>
                                    <p className="mt-1.5 text-xs text-slate-500">{Math.round(fillPct)}% of hiring positions filled</p>
                                </div>
                            )}
                        </WfPanel>

                        {plan.budget && plan.budget.allocated > 0 && (
                            <WfPanel
                                title="Budget"
                                subtitle="Allocated vs spent"
                                action={<FaDollarSign className="text-emerald-500" />}
                            >
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Allocated</span>
                                        <span className="font-semibold text-slate-800">
                                            ${plan.budget.allocated?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Spent</span>
                                        <span className="font-semibold text-slate-800">
                                            ${plan.budget.spent?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-teal-500"
                                            style={{ width: `${budgetPct}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Remaining</span>
                                        <span className="font-semibold text-emerald-600">
                                            ${plan.budget.remaining?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                </div>
                            </WfPanel>
                        )}

                        <WfPanel
                            title={`Hiring Plan (${plan.hiringPlan?.length || 0})`}
                            subtitle="Requirements, fill tracking, and recruitment handoff"
                            action={
                                <WfButton
                                    size="sm"
                                    onClick={() => {
                                        resetHiringForm();
                                        setShowAddHiringModal(true);
                                    }}
                                >
                                    <FaPlus /> Add Position
                                </WfButton>
                            }
                        >
                            {plan.hiringPlan && plan.hiringPlan.length > 0 ? (
                                <div className="space-y-4">
                                    {plan.hiringPlan.map((position, index) => {
                                        const required = Number(position.numberOfPositions) || 0;
                                        const filled = Number(position.filledPositions) || 0;
                                        const remaining = position.remainingPositions != null
                                            ? position.remainingPositions
                                            : Math.max(required - filled, 0);
                                        const lineFillPct = required > 0
                                            ? Math.min((filled / required) * 100, 100)
                                            : 0;

                                        return (
                                            <div
                                                key={position._id || index}
                                                className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 ring-1 ring-slate-50 transition hover:border-teal-100 hover:bg-white"
                                            >
                                                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <h3 className="font-semibold text-slate-900">{position.position}</h3>
                                                        <p className="mt-0.5 text-sm text-slate-500">
                                                            {position.department} · {position.jobTitle || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <WfBadge status={position.priority}>{position.priority}</WfBadge>
                                                        <WfBadge status={position.status}>{position.status}</WfBadge>
                                                    </div>
                                                </div>

                                                <div className="mb-3 grid grid-cols-2 gap-2 text-sm text-slate-600 md:grid-cols-4">
                                                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Required</p>
                                                        <p className="font-semibold text-slate-800">{required}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Filled</p>
                                                        <p className="font-semibold text-emerald-600">{filled}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">Remaining</p>
                                                        <p className="font-semibold text-slate-800">{remaining}</p>
                                                    </div>
                                                    {position.expectedStartDate ? (
                                                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Start</p>
                                                            <p className="font-semibold text-slate-800">
                                                                {format(new Date(position.expectedStartDate), 'MMM dd, yyyy')}
                                                            </p>
                                                        </div>
                                                    ) : position.budget > 0 ? (
                                                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Budget</p>
                                                            <p className="font-semibold text-slate-800">
                                                                ${position.budget.toLocaleString()}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                                            <p className="text-[10px] uppercase tracking-wider text-slate-400">Progress</p>
                                                            <p className="font-semibold text-teal-700">{Math.round(lineFillPct)}%</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mb-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400"
                                                        style={{ width: `${lineFillPct}%` }}
                                                    />
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2">
                                                    <label className="text-xs font-medium text-slate-500">Update filled</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={required || 999}
                                                        defaultValue={filled}
                                                        key={`fill-${index}-${filled}`}
                                                        onBlur={(e) => {
                                                            const val = parseInt(e.target.value, 10) || 0;
                                                            if (val !== filled) updateFillCount(index, val);
                                                        }}
                                                        className={`${wfInputClass} w-20 py-1.5`}
                                                        disabled={updatingFillIndex === index}
                                                    />
                                                    {position.recruitmentJobId ? (
                                                        <WfButton
                                                            variant="soft"
                                                            size="sm"
                                                            onClick={() => navigate(`/recruitment/jobs/${position.recruitmentJobId}`)}
                                                        >
                                                            <FaLink /> View Job
                                                        </WfButton>
                                                    ) : position.status !== 'Cancelled' && position.status !== 'Filled' ? (
                                                        <WfButton
                                                            size="sm"
                                                            loading={creatingJobIndex === index}
                                                            onClick={() => createRecruitmentJob(index)}
                                                        >
                                                            <FaBriefcase /> Create Job Opening
                                                        </WfButton>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="rounded-2xl bg-teal-50/80 p-4 text-sm ring-1 ring-teal-100">
                                        <div className="flex justify-between">
                                            <span className="text-slate-600">Total Positions</span>
                                            <span className="font-semibold text-slate-900">{requiredPositions}</span>
                                        </div>
                                        <div className="mt-1.5 flex justify-between">
                                            <span className="text-slate-600">Filled</span>
                                            <span className="font-semibold text-emerald-700">{filledPositions}</span>
                                        </div>
                                        <div className="mt-1.5 flex justify-between">
                                            <span className="text-slate-600">Remaining</span>
                                            <span className="font-semibold text-slate-900">{remainingPositions}</span>
                                        </div>
                                        {totalHiringBudget > 0 && (
                                            <div className="mt-1.5 flex justify-between">
                                                <span className="text-slate-600">Total Budget</span>
                                                <span className="font-semibold text-slate-900">
                                                    ${totalHiringBudget.toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <WfEmpty
                                    icon={FaUsers}
                                    title="No hiring positions yet"
                                    description="Add a position to track requirements and create recruitment openings."
                                    action={
                                        <WfButton
                                            size="sm"
                                            onClick={() => {
                                                resetHiringForm();
                                                setShowAddHiringModal(true);
                                            }}
                                        >
                                            <FaPlus /> Add Position
                                        </WfButton>
                                    }
                                />
                            )}
                        </WfPanel>

                        <WfPanel
                            title={`Risks (${plan.risks?.length || 0})`}
                            subtitle="Identify and mitigate planning risks"
                            action={
                                <WfButton variant="amber" size="sm" onClick={() => setShowAddRiskModal(true)}>
                                    <FaPlus /> Add Risk
                                </WfButton>
                            }
                        >
                            {plan.risks && plan.risks.length > 0 ? (
                                <div className="space-y-3">
                                    {plan.risks.map((risk, index) => (
                                        <div
                                            key={index}
                                            className="rounded-2xl border border-slate-100 bg-white p-4 ring-1 ring-slate-50"
                                        >
                                            <div className="mb-2 flex items-start justify-between gap-2">
                                                <h3 className="font-semibold text-slate-900">{risk.risk}</h3>
                                                <WfBadge status={risk.impact}>{risk.impact} Impact</WfBadge>
                                            </div>
                                            {risk.mitigation && (
                                                <p className="text-sm text-slate-600">
                                                    <span className="font-medium text-slate-700">Mitigation:</span>{' '}
                                                    {risk.mitigation}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <WfEmpty
                                    icon={FaExclamationTriangle}
                                    title="No risks identified"
                                    description="Document risks that could affect this workforce plan."
                                    action={
                                        <WfButton variant="amber" size="sm" onClick={() => setShowAddRiskModal(true)}>
                                            <FaPlus /> Add Risk
                                        </WfButton>
                                    }
                                />
                            )}
                        </WfPanel>
                    </div>

                    <div className="min-w-0 space-y-5">
                        <WfPanel title="Plan Information">
                            <dl className="space-y-3">
                                {infoRows.map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-start justify-between gap-3 border-b border-slate-50 pb-3 last:border-0 last:pb-0"
                                    >
                                        <dt className="text-sm text-slate-500">{row.label}</dt>
                                        <dd className="text-right text-sm font-medium text-slate-800">
                                            {row.badge ? (
                                                <WfBadge status={row.value}>{row.value}</WfBadge>
                                            ) : (
                                                row.value
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </WfPanel>

                        {gap !== 0 && (
                            <div className={`rounded-2xl border p-5 shadow-sm ${
                                gap > 0
                                    ? 'border-rose-100 bg-rose-50/60'
                                    : 'border-amber-100 bg-amber-50/60'
                            }`}>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                    Workforce Gap
                                </p>
                                <p className={`mt-1 text-3xl font-bold ${gapTone(gap)}`}>
                                    {gap > 0 ? '+' : ''}{gap}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                    {gap > 0
                                        ? 'Additional headcount needed to reach target'
                                        : 'Current headcount exceeds planned target'}
                                </p>
                            </div>
                        )}

                        {plan.skillsRequired && plan.skillsRequired.length > 0 && (
                            <WfPanel title="Skills Required">
                                <div className="space-y-3">
                                    {plan.skillsRequired.map((skill, index) => (
                                        <div
                                            key={index}
                                            className="rounded-xl border border-slate-100 bg-slate-50/50 p-3"
                                        >
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span className="font-medium text-slate-800">{skill.skill}</span>
                                                {skill.gap !== undefined && (
                                                    <WfBadge status={skill.gap > 0 ? 'Shortage' : 'Balanced'}>
                                                        Gap: {skill.gap}
                                                    </WfBadge>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                                                <div>Current: {skill.currentCount || 0}</div>
                                                <div>Required: {skill.requiredCount || 0}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </WfPanel>
                        )}
                    </div>
                </div>
            </div>

            {showAddHiringModal && (
                <WfModal
                    title="Add Hiring Position"
                    subtitle="Define a workforce requirement for this plan"
                    maxWidth="max-w-2xl"
                    onClose={() => {
                        setShowAddHiringModal(false);
                        resetHiringForm();
                    }}
                >
                    <form onSubmit={addHiringPosition} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Position" required>
                                <input
                                    type="text"
                                    value={hiringForm.position}
                                    onChange={(e) => setHiringForm({ ...hiringForm, position: e.target.value })}
                                    className={wfInputClass}
                                    required
                                />
                            </WfField>
                            <WfField label="Department" required>
                                <input
                                    type="text"
                                    value={hiringForm.department}
                                    onChange={(e) => setHiringForm({ ...hiringForm, department: e.target.value })}
                                    className={wfInputClass}
                                    required
                                />
                            </WfField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <WfField label="Job Title">
                                <input
                                    type="text"
                                    value={hiringForm.jobTitle}
                                    onChange={(e) => setHiringForm({ ...hiringForm, jobTitle: e.target.value })}
                                    className={wfInputClass}
                                />
                            </WfField>
                            <WfField label="Number of Positions">
                                <input
                                    type="number"
                                    value={hiringForm.numberOfPositions}
                                    onChange={(e) => setHiringForm({
                                        ...hiringForm,
                                        numberOfPositions: parseInt(e.target.value, 10) || 1,
                                    })}
                                    className={wfInputClass}
                                    min="1"
                                />
                            </WfField>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <WfField label="Priority">
                                <select
                                    value={hiringForm.priority}
                                    onChange={(e) => setHiringForm({ ...hiringForm, priority: e.target.value })}
                                    className={wfInputClass}
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </WfField>
                            <WfField label="Expected Start Date">
                                <input
                                    type="date"
                                    value={hiringForm.expectedStartDate}
                                    onChange={(e) => setHiringForm({
                                        ...hiringForm,
                                        expectedStartDate: e.target.value,
                                    })}
                                    className={wfInputClass}
                                />
                            </WfField>
                            <WfField label="Budget ($)">
                                <input
                                    type="number"
                                    value={hiringForm.budget}
                                    onChange={(e) => setHiringForm({
                                        ...hiringForm,
                                        budget: parseFloat(e.target.value) || 0,
                                    })}
                                    className={wfInputClass}
                                    min="0"
                                />
                            </WfField>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <WfButton
                                variant="secondary"
                                onClick={() => {
                                    setShowAddHiringModal(false);
                                    resetHiringForm();
                                }}
                            >
                                Cancel
                            </WfButton>
                            <WfButton type="submit" loading={submitting}>
                                Add Position
                            </WfButton>
                        </div>
                    </form>
                </WfModal>
            )}

            {showAddRiskModal && (
                <WfModal
                    title="Add Risk"
                    subtitle="Capture impact and mitigation for this plan"
                    maxWidth="max-w-2xl"
                    onClose={() => {
                        setShowAddRiskModal(false);
                        setRiskForm({ risk: '', impact: 'Medium', mitigation: '' });
                    }}
                >
                    <form onSubmit={addRisk} className="space-y-4">
                        <WfField label="Risk Description" required>
                            <input
                                type="text"
                                value={riskForm.risk}
                                onChange={(e) => setRiskForm({ ...riskForm, risk: e.target.value })}
                                className={wfInputClass}
                                required
                            />
                        </WfField>

                        <WfField label="Impact">
                            <select
                                value={riskForm.impact}
                                onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })}
                                className={wfInputClass}
                            >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                            </select>
                        </WfField>

                        <WfField label="Mitigation Strategy" required>
                            <textarea
                                value={riskForm.mitigation}
                                onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })}
                                className={wfInputClass}
                                rows="4"
                                required
                            />
                        </WfField>

                        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                            <WfButton
                                variant="secondary"
                                onClick={() => {
                                    setShowAddRiskModal(false);
                                    setRiskForm({ risk: '', impact: 'Medium', mitigation: '' });
                                }}
                            >
                                Cancel
                            </WfButton>
                            <WfButton type="submit" variant="amber" loading={submitting}>
                                Add Risk
                            </WfButton>
                        </div>
                    </form>
                </WfModal>
            )}
            </div>
        </div>
    );
};

export default WorkforceDetailPage;
