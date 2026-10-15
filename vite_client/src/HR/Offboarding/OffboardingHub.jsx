import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaBoxOpen, FaCalendarAlt, FaClipboardCheck,
    FaClock, FaExchangeAlt, FaFileAlt, FaKey,
    FaMoneyCheckAlt, FaPlus, FaSignOutAlt, FaStickyNote, FaTasks, FaUserFriends,
    FaTrash,
} from 'react-icons/fa';
import axios, { openDocumentPreview } from '../../utils/axios';
import {
    ADMIN_OFFBOARDING_ENDPOINT,
    BOTH_OFFBOARDING_ENDPOINT,
    ADMIN_LIFECYCLE_ENDPOINT,
} from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';
import { useEmployees } from '../../Hooks/useDashboardData';
import { getTokenFromCookie } from '../../utils/authHelper';
import { getSocketIOUrl } from '../../utils/socketUrl';
import ExitInterviewWorkflowPanel from './ExitInterviewWorkflowPanel';
import OffboardingLettersPanel from './OffboardingLettersPanel';
import OffboardingAlumniPanel from './OffboardingAlumniPanel';
import useLifecycleFeatures from '../../Hooks/useLifecycleFeatures';
import { filterHrAssignees } from '../../utils/hrAssignees';
import { filterManagerCandidates } from '../../utils/managerAssignees';
import { CmBadge, CmButton, CmSearch, CmStat, CmPerson, CmRing, CmEmpty, statusTone } from '../../components/corporateModern';

const OFFBOARDING_STATUSES = [
    'Draft', 'Scheduled', 'Initiated', 'In Progress', 'Paused', 'Completed', 'Cancelled', 'Overdue',
];

const STATUS_COLORS = {
    Draft: 'bg-slate-100 text-slate-700',
    Scheduled: 'bg-indigo-100 text-indigo-700',
    Initiated: 'bg-amber-100 text-amber-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Paused: 'bg-amber-100 text-amber-800',
    Completed: 'bg-emerald-100 text-emerald-800',
    Cancelled: 'bg-gray-200 text-gray-600',
    Overdue: 'bg-red-100 text-red-800',
};

const ProgressRing = ({ value = 0, label }) => {
    const progress = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div className="text-center">
            <div className="relative mx-auto h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                        cx="18" cy="18" r="15.9" fill="none" stroke="var(--color-primary)"
                        strokeWidth="3" strokeDasharray={`${progress} 100`} strokeLinecap="round"
                    />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{progress}%</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{label}</p>
        </div>
    );
};

const Section = ({ id, icon, title, subtitle, children }) => (
    <section id={id} className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <span className="text-theme-secondary">{icon}</span> {title}
            </h3>
            {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {children}
    </section>
);

const EmptyItems = ({ children = 'No items are required.' }) => (
    <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
        {children}
    </p>
);

const OffboardingHub = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const userObj = user || employee;
    const isAdmin = user?.role === 'admin';
    const isHRView = isAdmin || isHR(userObj);
    const { isEnabled: isFeatureEnabled, filterByFeature } = useLifecycleFeatures({ admin: isHRView, showAll: true });
    const workflowIdParam = searchParams.get('id') || '';
    const viewParam = searchParams.get('view') || '';
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dashboard, setDashboard] = useState({ workflows: [], stats: {}, role: {} });
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [newNote, setNewNote] = useState('');
    const [experienceLetterFile, setExperienceLetterFile] = useState(null);
    const [buyoutDays, setBuyoutDays] = useState('');
    const [leaveAdjustmentDays, setLeaveAdjustmentDays] = useState('');
    const [fnfForm, setFnfForm] = useState({
        leaveBalanceDays: '',
        pendingDues: '',
        recoveries: '',
        bonusAmount: '',
        gratuityEstimate: '',
        taxDeduction: '',
    });
    const experienceLetterInputRef = useRef(null);
    const fetchInFlight = useRef(false);
    const workflowIdRef = useRef(workflowIdParam);
    workflowIdRef.current = workflowIdParam;
    const { data: employeeData = { employees: [] } } = useEmployees();
    const employees = employeeData?.employees || [];
    const hrAssignees = useMemo(() => filterHrAssignees(employees), [employees]);
    const [createForm, setCreateForm] = useState({
        employeeId: '',
        lastWorkingDate: '',
        resignationDate: '',
        reason: 'Resignation',
        reasonDetails: '',
        assignedHR: '',
        assignedManager: '',
        saveAsDraft: false,
    });
    const managerCandidates = useMemo(
        () => filterManagerCandidates(employees, createForm.employeeId),
        [employees, createForm.employeeId],
    );

    const fetchDashboard = useCallback(async ({ soft = false } = {}) => {
        if (fetchInFlight.current) return;
        fetchInFlight.current = true;
        if (!soft) setLoading(true);
        try {
            let data;
            if (isHRView) {
                const [dashboardResponse, analyticsResponse] = await Promise.all([
                    axios.get(`${ADMIN_OFFBOARDING_ENDPOINT}/dashboard`, { withCredentials: true }),
                    axios.get(`${ADMIN_OFFBOARDING_ENDPOINT}/analytics`, { withCredentials: true }),
                ]);
                data = {
                    ...(dashboardResponse.data?.data || {}),
                    analytics: analyticsResponse.data?.data || {},
                };
            } else {
                const viewQs = viewParam === 'team' ? '?view=team' : '';
                const response = await axios.get(`${BOTH_OFFBOARDING_ENDPOINT}/dashboard${viewQs}`, { withCredentials: true });
                data = response.data?.data || { workflows: [], stats: {}, role: {} };
                const role = data.role || {};
                const wantsTeam = viewParam === 'team' && (role.canViewTeam || role.hasDirectReports);
                if (!wantsTeam) {
                    try {
                        const mine = await axios.get(`${BOTH_OFFBOARDING_ENDPOINT}/my-workflow`, { withCredentials: true });
                        if (mine.data?.data) data = { ...data, workflows: [mine.data.data] };
                    } catch (err) {
                        if (err.response?.status !== 404) throw err;
                        data = { ...data, workflows: [] };
                    }
                }
            }
            const workflows = data.workflows || [];
            setDashboard(data);
            setSelectedWorkflow((previous) => {
                const preferredId = workflowIdRef.current || previous?._id;
                if (!preferredId) {
                    if (isHRView || viewParam === 'team') return null;
                    return workflows[0] || null;
                }
                return workflows.find((workflow) => workflow._id === preferredId) || null;
            });
        } catch (error) {
            if (!isHRView && error.response?.status === 404) {
                setDashboard({ workflows: [], stats: {}, role: {} });
                setSelectedWorkflow(null);
            } else {
                toast.error(error.response?.data?.message || 'Failed to load offboarding data');
            }
        } finally {
            setLoading(false);
            fetchInFlight.current = false;
        }
    }, [isHRView, viewParam]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    useEffect(() => {
        const socketUrl = getSocketIOUrl();
        if (!socketUrl) return undefined;
        const token = getTokenFromCookie();
        const socket = io(socketUrl, {
            path: '/socket.io',
            withCredentials: true,
            auth: token ? { token } : {},
            transports: ['websocket', 'polling'],
        });
        let timer;
        const refresh = () => {
            clearTimeout(timer);
            timer = setTimeout(() => fetchDashboard({ soft: true }), 400);
        };
        socket.on('offboarding:changed', refresh);
        return () => {
            clearTimeout(timer);
            socket.off('offboarding:changed', refresh);
            socket.disconnect();
        };
    }, [fetchDashboard]);

    useEffect(() => {
        if (!workflowIdParam) return;
        const found = dashboard.workflows?.find((workflow) => workflow._id === workflowIdParam);
        if (found) setSelectedWorkflow(found);
    }, [workflowIdParam, dashboard.workflows]);

    const workflow = selectedWorkflow;
    const role = dashboard.role || {};
    const canViewSelf = !isHRView && Boolean(role.canViewSelf ?? true);
    const canViewTeam = !isHRView && Boolean(role.canViewTeam || role.hasDirectReports);
    const showRoleToggles = canViewTeam;
    const isManagerView = !isHRView && viewParam === 'team' && canViewTeam;
    const isPersonalView = !isHRView && !isManagerView;
    const isWorkQueueView = isManagerView;

    const setLifecycleView = (nextView) => {
        const next = new URLSearchParams(searchParams);
        next.set('lifecycle', 'offboarding');
        next.delete('id');
        if (nextView && nextView !== 'self') next.set('view', nextView);
        else next.delete('view');
        setSearchParams(next);
        setSelectedWorkflow(null);
    };

    useEffect(() => {
        if (isHRView) return;
        if (viewParam === 'tasks') setLifecycleView('self');
        else if (viewParam === 'team' && !canViewTeam) setLifecycleView('self');
    }, [isHRView, viewParam, canViewTeam]);

    const myEmployeeId = (employee?._id || employee?.id || user?.employeeId)?.toString();
    const workflowEmployeeId = (workflow?.employeeId?._id || workflow?.employeeId)?.toString();
    const isWorkflowEmployee = Boolean(myEmployeeId && workflowEmployeeId === myEmployeeId);

    const filteredWorkflows = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        return (dashboard.workflows || []).filter((item) => {
            const name = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''} ${item.employeeId?.email || ''}`.toLowerCase();
            return (!search || name.includes(search))
                && (statusFilter === 'all' || item.status === statusFilter);
        });
    }, [dashboard.workflows, searchTerm, statusFilter]);

    const openWorkflow = (item) => {
        setSelectedWorkflow(item);
        const next = new URLSearchParams(searchParams);
        next.set('lifecycle', 'offboarding');
        next.set('id', item._id);
        setSearchParams(next);
    };

    const closeWorkflow = () => {
        setSelectedWorkflow(null);
        const next = new URLSearchParams(searchParams);
        next.delete('id');
        setSearchParams(next);
    };

    const mutation = async (request, successMessage) => {
        setSubmitting(true);
        try {
            const response = await request();
            if (response.data?.data) setSelectedWorkflow(response.data.data);
            toast.success(successMessage);
            await fetchDashboard({ soft: true });
            return response;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to update offboarding workflow');
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    const itemBase = (id) => isHRView
        ? `${ADMIN_OFFBOARDING_ENDPOINT}/${id}`
        : `${BOTH_OFFBOARDING_ENDPOINT}/workflow/${id}`;

    const createWorkflow = async (event) => {
        event.preventDefault();
        const response = await mutation(
            () => axios.post(ADMIN_OFFBOARDING_ENDPOINT, createForm, { withCredentials: true }),
            createForm.saveAsDraft ? 'Offboarding draft saved' : 'Offboarding workflow initiated',
        );
        if (response) {
            setShowCreateModal(false);
            setCreateForm({
                employeeId: '', lastWorkingDate: '', resignationDate: '', reason: 'Resignation',
                reasonDetails: '', assignedHR: '', assignedManager: '', saveAsDraft: false,
            });
            openWorkflow(response.data.data);
        }
    };

    const updateTask = (task, status) => mutation(
        () => axios.put(`${itemBase(workflow._id)}/tasks/${task._id}`, { status }, { withCredentials: true }),
        'Task updated',
    );

    const updateChecklist = (item) => mutation(
        () => axios.put(
            `${itemBase(workflow._id)}/checklist/${item._id}`,
            { completed: !item.completed },
            { withCredentials: true },
        ),
        'Clearance checklist updated',
    );

    const updateKnowledgeTransfer = (item, status) => mutation(
        () => axios.put(
            `${itemBase(workflow._id)}/knowledge-transfer/${item._id}`,
            { status },
            { withCredentials: true },
        ),
        'Knowledge transfer updated',
    );

    const uploadExperienceLetter = async () => {
        if (!experienceLetterFile) {
            toast.error('Please choose an experience letter file');
            return;
        }
        const formData = new FormData();
        formData.append('document', experienceLetterFile);
        const response = await mutation(
            () => axios.post(
                `${ADMIN_OFFBOARDING_ENDPOINT}/${workflow._id}/experience-letter`,
                formData,
                { withCredentials: true },
            ),
            'Experience letter uploaded and issued to the employee',
        );
        if (response) {
            setExperienceLetterFile(null);
            if (experienceLetterInputRef.current) experienceLetterInputRef.current.value = '';
        }
    };

    const previewExperienceLetter = async () => {
        const letter = workflow.experienceLetter;
        if (!letter?.canonicalDocumentId) return;
        try {
            await openDocumentPreview(letter.canonicalDocumentId, {
                scope: isHRView ? 'admin' : 'both',
                fileUrl: letter.fileUrl,
                fileName: letter.fileName || letter.name,
                mimeType: letter.mimeType,
            });
        } catch (error) {
            toast.error(error?.message || 'Could not open experience letter');
        }
    };

    const updateWorkflowItem = (path, body, message) => mutation(
        () => axios.put(`${itemBase(workflow._id)}/${path}`, body, { withCredentials: true }),
        message,
    );

    const workflowAction = (action) => mutation(
        () => axios.post(
            `${ADMIN_OFFBOARDING_ENDPOINT}/${workflow._id}/actions/${action}`,
            {},
            { withCredentials: true },
        ),
        'Workflow updated',
    );

    const lifecycleMutation = async (request, successMessage) => {
        if (!isHRView || !workflow?._id) return null;
        setSubmitting(true);
        try {
            const response = await request();
            toast.success(successMessage);
            await fetchDashboard({ soft: true });
            return response;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Lifecycle action failed');
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    const approveNoticeBuyout = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/notice-period/buyout`,
            { buyoutDays: Number(buyoutDays) },
            { withCredentials: true },
        ),
        'Notice buyout approved',
    );

    const saveLeaveAdjustment = () => lifecycleMutation(
        () => axios.patch(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/notice-period/leave-adjustment`,
            { leaveAdjustmentDays: Number(leaveAdjustmentDays || 0) },
            { withCredentials: true },
        ),
        'Leave adjustment saved',
    );

    const calculateFnf = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/fnf/calculate`,
            {
                leaveBalanceDays: Number(fnfForm.leaveBalanceDays || 0),
                pendingDues: fnfForm.pendingDues !== '' ? Number(fnfForm.pendingDues) : undefined,
                recoveries: fnfForm.recoveries !== '' ? Number(fnfForm.recoveries) : undefined,
                bonusAmount: fnfForm.bonusAmount !== '' ? Number(fnfForm.bonusAmount) : undefined,
                gratuityEstimate: fnfForm.gratuityEstimate !== '' ? Number(fnfForm.gratuityEstimate) : undefined,
                taxDeduction: fnfForm.taxDeduction !== '' ? Number(fnfForm.taxDeduction) : undefined,
            },
            { withCredentials: true },
        ),
        'F&F settlement calculated',
    );

    const submitFnfApproval = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/fnf/submit-approval`,
            {},
            { withCredentials: true },
        ),
        'F&F submitted for approval',
    );

    const generateFnfPdf = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/fnf/pdf`,
            {},
            { withCredentials: true },
        ),
        'F&F PDF generated',
    );

    const autoRevokeAccess = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/access/auto-revoke`,
            {},
            { withCredentials: true },
        ),
        'Auto access revocation triggered',
    );

    const createFnfPayrollRun = () => lifecycleMutation(
        () => axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/offboarding/${workflow._id}/fnf/payroll-bridge`,
            {},
            { withCredentials: true },
        ),
        'F&F payroll run created',
    );

    const deleteWorkflow = async (item) => {
        const response = await mutation(
            () => axios.delete(`${ADMIN_OFFBOARDING_ENDPOINT}/${item._id}`, { withCredentials: true }),
            'Offboarding workflow deleted',
        );
        if (response) {
            setPendingDelete(null);
            closeWorkflow();
        }
    };

    const addNote = async () => {
        const note = newNote.trim();
        if (!note) return;
        const response = await mutation(
            () => axios.post(
                `${ADMIN_OFFBOARDING_ENDPOINT}/${workflow._id}/notes`,
                { note, visibility: 'internal' },
                { withCredentials: true },
            ),
            'Note added',
        );
        if (response) setNewNote('');
    };

    const canActOnTask = (task) => {
        if (isHRView) return true;
        const assignedTo = (task.assignedTo?._id || task.assignedTo)?.toString();
        if (assignedTo && assignedTo === myEmployeeId) return true;
        if (task.assigneeRole === 'employee') return isWorkflowEmployee;
        if (task.assigneeRole === 'manager') {
            return (workflow.assignedManager?._id || workflow.assignedManager)?.toString() === myEmployeeId;
        }
        return false;
    };

    const canActOnChecklist = (item) => {
        if (isHRView) return true;
        if (item.assignedRole === 'employee') return isWorkflowEmployee;
        if (item.assignedRole === 'manager') {
            return (workflow.assignedManager?._id || workflow.assignedManager)?.toString() === myEmployeeId;
        }
        if (item.assignedRole === 'it') return Boolean(role.isIT);
        if (item.assignedRole === 'payroll') return Boolean(role.isPayroll);
        return false;
    };

    if (loading) return <LoadingSpinner message="Loading offboarding..." />;

    if (!isHRView && isPersonalView && !workflow) {
        return (
            <div className="page-shell hrms-lifecycle bg-gray-50">
                <div className="page-shell-inner space-y-4">
                    {showRoleToggles && (
                        <div className="flex justify-end">
                            <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Offboarding view">
                                <button type="button" role="tab" aria-selected className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-theme-primary shadow-sm sm:text-sm"
                                    onClick={() => setLifecycleView('self')}>Self</button>
                                {canViewTeam && (
                                    <button type="button" role="tab" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 sm:text-sm"
                                        onClick={() => setLifecycleView('team')}>My Team</button>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="rounded-xl bg-white p-6 text-center shadow-md">
                        <FaSignOutAlt className="mx-auto mb-4 text-6xl text-gray-300" />
                        <h2 className="mb-2 text-2xl font-bold text-gray-800">No Offboarding Workflow</h2>
                        <p className="text-gray-500">There is no active offboarding process assigned to you.</p>
                    </div>
                </div>
            </div>
        );
    }

    const breakdown = workflow?.progressBreakdown || {};

    return (
        <div className="page-shell hrms-lifecycle cm-hrms bg-gray-50">
            <div className="page-shell-inner hrms-stack pb-6">
                {!workflow && (
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-theme-secondary">
                            {isHRView
                                ? 'HR & Administration'
                                : isManagerView
                                    ? 'My Team'
                                    : 'Employee'}
                        </p>
                        <h1 className="mt-1 text-2xl font-bold leading-tight text-gray-800 sm:text-3xl">
                            {isHRView
                                ? 'Offboarding Hub'
                                : isManagerView
                                    ? 'My Team'
                                    : 'My Offboarding'}
                        </h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
                            {isManagerView
                                ? 'Direct reports who are currently offboarding.'
                                : isHRView
                                    ? 'Plan and track every exit journey notice, clearance, and settlement in one place'
                                    : 'Coordinate your exit, handovers, and clearances in one place.'}
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                        {!isHRView && showRoleToggles && (
                            <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Offboarding view">
                                <button type="button" role="tab" aria-selected={isPersonalView}
                                    onClick={() => setLifecycleView('self')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                                        isPersonalView ? 'bg-white text-theme-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                    }`}>Self</button>
                                {canViewTeam && (
                                    <button type="button" role="tab" aria-selected={isManagerView}
                                        onClick={() => setLifecycleView('team')}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                                            isManagerView ? 'bg-white text-theme-primary shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                        }`}>My Team</button>
                                )}
                            </div>
                        )}
                        {isHRView && (
                            <CmButton variant="inverted" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
                                <FaPlus className="shrink-0 text-base" />
                                <span>Offboard Employee</span>
                            </CmButton>
                        )}
                    </div>
                </header>
                )}

                {!workflow && (isHRView || isWorkQueueView) && dashboard.stats && (
                    <div className="cm-kpi-row cm-kpi-row--3">
                        <CmStat
                            label="Active Separations"
                            value={dashboard.stats.active ?? 0}
                            attention={(dashboard.stats.overdue ?? 0) > 0}
                            meta={`${dashboard.stats.overdue ?? 0} overdue · ${dashboard.stats.upcoming ?? 0} upcoming`}
                        />
                        <CmStat
                            label="Pending Clearances"
                            value={(dashboard.stats.pendingClearances ?? 0) + (dashboard.stats.pendingAssets ?? 0)}
                            attention={((dashboard.stats.pendingClearances ?? 0) + (dashboard.stats.pendingAssets ?? 0)) > 0}
                            meta={`${dashboard.stats.pendingClearances ?? 0} clearances · ${dashboard.stats.pendingAssets ?? 0} assets`}
                        />
                        <CmStat
                            label="Average Progress"
                            value={`${dashboard.stats.averageProgress || 0}%`}
                            meta={`${dashboard.stats.totalSeparations ?? 0} total separations`}
                        />
                    </div>
                )}

                {!workflow && isHRView && dashboard.analytics && (
                    <div className="cm-kpi-row cm-kpi-row--3">
                        <CmStat
                            label="Completion Rate"
                            value={`${dashboard.analytics.completionRate || 0}%`}
                            meta="Exit workflows completed"
                        />
                        <CmStat
                            label="Completed"
                            value={dashboard.analytics.completed || 0}
                            meta="Finished separations"
                        />
                        <CmStat
                            label="Top Reasons"
                            value={(dashboard.analytics.byReason || []).slice(0, 1).map((e) => e._id || 'Other')[0] || '—'}
                            meta={(dashboard.analytics.byReason || []).slice(0, 3).map((e) => `${e._id || 'Other'}: ${e.count}`).join(' · ') || 'No reason data yet'}
                        />
                    </div>
                )}

                {!workflow && (isHRView || isWorkQueueView) && (
                    <>
                    <div className="rounded-xl bg-white p-5 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex-1">
                                <CmSearch
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search by employee name or email..."
                                />
                            </div>
                            <div className="hrms-chip-scroll">
                                <div className="hrms-chip-scroll-track" aria-label="Filter workflows by status">
                                    {['all', ...OFFBOARDING_STATUSES].map((status) => (
                                        <div key={status} className="hrms-chip-scroll-item">
                                            <button
                                                type="button"
                                                onClick={() => setStatusFilter(status)}
                                                className={`cm-chip ${statusFilter === status ? 'cm-chip--active' : ''}`}
                                            >
                                                {status === 'all' ? 'All' : status}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {filteredWorkflows.length === 0 ? (
                            <CmEmpty title="No offboarding workflows found">
                                {isHRView ? 'Create one to get started.' : 'No matching workflows in this view.'}
                            </CmEmpty>
                        ) : (
                            <>
                                <div className="space-y-3 sm:hidden">
                                    {filteredWorkflows.map((item) => {
                                        const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
                                        const fullName = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''}`.trim();
                                        const completed = item.tasks?.filter((task) => task.status === 'Completed').length || 0;
                                        const total = item.tasks?.length || 0;
                                        return (
                                            <article
                                                key={item._id}
                                                onClick={() => openWorkflow(item)}
                                                className="cursor-pointer rounded-2xl border border-[rgba(187,202,193,0.35)] bg-white p-4 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <CmPerson
                                                        name={fullName}
                                                        meta={item.employeeId?.jobTitle || item.employeeId?.department || item.reason || ''}
                                                    />
                                                    <CmBadge tone={statusTone(item.status)} dot={false}>{item.status}</CmBadge>
                                                </div>
                                                <div className="mt-4 flex items-center gap-3">
                                                    <CmRing value={progress} size={42} attention={item.status === 'Overdue'} />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-[var(--cm-on-surface)]">Progress</p>
                                                        <p className="text-xs text-[var(--cm-muted)]">{completed}/{total} tasks completed</p>
                                                    </div>
                                                </div>
                                                <div className="mt-4 text-sm">
                                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Last working day</p>
                                                    <p className="text-[var(--cm-on-surface)]">
                                                        {item.lastWorkingDate ? format(new Date(item.lastWorkingDate), 'MMM dd, yyyy') : '—'}
                                                    </p>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between gap-3">
                                                    <CmButton variant="secondary" size="sm" onClick={(event) => { event.stopPropagation(); openWorkflow(item); }}>
                                                        View details
                                                    </CmButton>
                                                    {isHRView && (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => { event.stopPropagation(); setPendingDelete(item); }}
                                                            aria-label="Delete workflow"
                                                            className="cm-link cm-link--attention"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>

                                <div className="hidden sm:block cm-table-wrap">
                                    <table className="cm-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Status</th>
                                                <th>Progress</th>
                                                <th>Reason</th>
                                                <th>Actions</th>
                                                <th>Last working day</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredWorkflows.map((item) => {
                                                const progress = Math.max(0, Math.min(100, Number(item.progress) || 0));
                                                const fullName = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''}`.trim();
                                                const isSelected = workflow?._id === item._id;
                                                return (
                                                    <tr
                                                        key={item._id}
                                                        onClick={() => openWorkflow(item)}
                                                        className={`cursor-pointer ${isSelected ? 'bg-[rgba(28,202,155,0.06)]' : ''}`}
                                                    >
                                                        <td>
                                                            <CmPerson
                                                                name={fullName}
                                                                meta={item.employeeId?.jobTitle || item.employeeId?.department || ''}
                                                            />
                                                        </td>
                                                        <td>
                                                            <CmBadge tone={statusTone(item.status)}>{item.status}</CmBadge>
                                                        </td>
                                                        <td>
                                                            <div className="flex items-center gap-3">
                                                                <CmRing value={progress} size={36} attention={item.status === 'Overdue'} />
                                                                <span className="text-xs text-[var(--cm-muted)]">
                                                                    {item.tasks?.filter((task) => task.status === 'Completed').length || 0}/{item.tasks?.length || 0} tasks
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="text-sm">{item.reason || '—'}</td>
                                                        <td onClick={(event) => event.stopPropagation()}>
                                                            {isHRView ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPendingDelete(item)}
                                                                    aria-label="Delete workflow"
                                                                    className="cm-link cm-link--attention"
                                                                >
                                                                    <FaTrash />
                                                                </button>
                                                            ) : (
                                                                <CmButton variant="secondary" size="sm" onClick={() => openWorkflow(item)}>
                                                                    View
                                                                </CmButton>
                                                            )}
                                                        </td>
                                                        <td className="text-sm">
                                                            {item.lastWorkingDate ? format(new Date(item.lastWorkingDate), 'MMM dd, yyyy') : '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}

                        {filteredWorkflows.length > 0 && (
                            <div className="cm-pagination">
                                <span>
                                    Showing {filteredWorkflows.length} of {dashboard?.stats?.totalSeparations ?? filteredWorkflows.length} separations
                                </span>
                                <div className="flex items-center gap-1">
                                    <button type="button" className="cm-icon-btn" aria-label="Previous page" disabled>‹</button>
                                    <button type="button" className="cm-icon-btn" aria-label="Next page" disabled>›</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isHRView && (isFeatureEnabled('alumniManagement') || isFeatureEnabled('rehireEligibility')) && (
                        <Section id="offboarding-alumni" icon={<FaUserFriends />} title="Alumni Database">
                            <OffboardingAlumniPanel isHRView={isHRView} />
                        </Section>
                    )}
                    </>
                )}

                {workflow && (
                    <>
                        {(isHRView || isWorkQueueView) && (
                            <button
                                type="button"
                                onClick={closeWorkflow}
                                className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-theme-primary"
                            >
                                <FaArrowLeft /> Back to all employees
                            </button>
                        )}

                        <section className="rounded-xl bg-white p-6 shadow-md">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">
                                        {workflow.employeeId?.name} {workflow.employeeId?.lastName}
                                    </h3>
                                    <p className="text-sm text-gray-500">{workflow.employeeId?.email}</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                        <span className={`rounded-full px-3 py-1 font-medium ${STATUS_COLORS[workflow.status] || STATUS_COLORS.Draft}`}>
                                            {workflow.status}
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-gray-600">
                                            <FaCalendarAlt />
                                            Last working day: {format(new Date(workflow.lastWorkingDate), 'MMM dd, yyyy')}
                                        </span>
                                        {workflow.reason && <span className="text-gray-600">Reason: {workflow.reason}</span>}
                                    </div>
                                    {isHRView && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {workflow.status === 'Draft' && (
                                                <button onClick={() => workflowAction('publish')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Publish</button>
                                            )}
                                            {['Scheduled', 'Initiated', 'In Progress', 'Overdue'].includes(workflow.status) && (
                                                <button onClick={() => workflowAction('pause')} className="rounded-lg bg-amber-500 px-3 py-2 text-sm text-white">Pause</button>
                                            )}
                                            {['Paused', 'On Hold'].includes(workflow.status) && (
                                                <button onClick={() => workflowAction('resume')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">Resume</button>
                                            )}
                                            {!['Completed', 'Cancelled'].includes(workflow.status) && (
                                                <button onClick={() => workflowAction('cancel')} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white">Cancel</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap justify-center gap-4">
                                    <ProgressRing value={workflow.progress} label="Overall" />
                                    <ProgressRing value={breakdown.tasks} label="Tasks" />
                                    <ProgressRing value={breakdown.checklist} label="Clearance" />
                                    <ProgressRing value={breakdown.assets} label="Assets" />
                                    <ProgressRing value={breakdown.knowledgeTransfer} label="Handover" />
                                    <ProgressRing value={breakdown.accessRevocation} label="Access" />
                                </div>
                            </div>
                        </section>

                        <Section id="offboarding-tasks" icon={<FaTasks />} title="Role-based Tasks">
                            <div className="space-y-3">
                                {filterByFeature(workflow.tasks || []).map((task) => (
                                    <div key={task._id} className="flex flex-col justify-between gap-3 rounded-lg border border-gray-100 p-4 md:flex-row md:items-center">
                                        <div>
                                            <h4 className="font-medium text-gray-800">{task.title}</h4>
                                            <p className="text-sm text-gray-500">{task.description}</p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {task.assigneeRole} · {task.assignedTo?.name || 'Role queue'}
                                                {task.dueDate ? ` · Due ${format(new Date(task.dueDate), 'MMM dd')}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-700'}`}>
                                                {task.status}
                                            </span>
                                            {canActOnTask(task) && task.status !== 'Completed' && (
                                                <>
                                                    {task.status !== 'In Progress' && (
                                                        <button disabled={submitting} onClick={() => updateTask(task, 'In Progress')} className="rounded border px-3 py-1 text-xs">Start</button>
                                                    )}
                                                    <button disabled={submitting} onClick={() => updateTask(task, 'Completed')} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">Complete</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {!filterByFeature(workflow.tasks || []).length && <EmptyItems />}
                            </div>
                        </Section>

                        <Section id="offboarding-clearance" icon={<FaClipboardCheck />} title="Clearance Checklist">
                            {(isFeatureEnabled('clearance') || isFeatureEnabled('hrClearance')) ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {(workflow.clearanceChecklist || []).map((item) => (
                                        <label key={item._id} className="flex items-start gap-3 rounded-lg border border-gray-100 p-3">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(item.completed)}
                                                disabled={submitting || !canActOnChecklist(item)}
                                                onChange={() => updateChecklist(item)}
                                                className="mt-1 h-4 w-4"
                                            />
                                            <span>
                                                <span className={item.completed ? 'text-gray-500 line-through' : 'text-gray-800'}>{item.item}</span>
                                                <span className="block text-xs text-gray-500">{item.category} · {item.assignedRole}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <EmptyItems>Clearance checklist is disabled in Configure.</EmptyItems>
                            )}
                        </Section>

                        <div className="grid gap-5 xl:grid-cols-2">
                            {isFeatureEnabled('assetReturn') && (
                            <Section id="offboarding-assets" icon={<FaBoxOpen />} title="Asset Return">
                                <div className="space-y-3">
                                    {(workflow.assets || []).map((asset) => (
                                        <div key={asset._id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                            <div>
                                                <p className="font-medium">{asset.assetName || asset.assetType}</p>
                                                <p className="text-xs text-gray-500">{asset.assetId || 'No serial number'}</p>
                                            </div>
                                            {(isHRView || role.isIT) ? (
                                                <select
                                                    value={asset.status}
                                                    disabled={submitting}
                                                    onChange={(event) => updateWorkflowItem(
                                                        `assets/${asset._id}`,
                                                        { status: event.target.value },
                                                        'Asset return updated',
                                                    )}
                                                    className="rounded-lg border px-2 py-1 text-sm"
                                                >
                                                    {['Pending', 'Returned', 'Damaged', 'Lost', 'Waived'].map((status) => <option key={status}>{status}</option>)}
                                                </select>
                                            ) : (
                                                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{asset.status}</span>
                                            )}
                                        </div>
                                    ))}
                                    {!workflow.assets?.length && <EmptyItems>No assigned onboarding assets found.</EmptyItems>}
                                </div>
                            </Section>
                            )}

                            {(isFeatureEnabled('accessRevocation') || isFeatureEnabled('emailAccessRemoval')) && (
                            <Section id="offboarding-access" icon={<FaKey />} title="Access Revocation">
                                {isHRView && (
                                    <div className="mb-3">
                                        <button
                                            type="button"
                                            disabled={submitting}
                                            onClick={autoRevokeAccess}
                                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                                        >
                                            Auto-revoke all mandatory access
                                        </button>
                                        <p className="mt-1 text-xs text-gray-500">
                                            Calls configured adapters (Azure AD, Google Workspace, Okta, etc.) when credentials are set.
                                        </p>
                                    </div>
                                )}
                                <div className="space-y-3">
                                    {(workflow.accessRevocation || []).map((item) => (
                                        <div key={item._id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                            <div><p className="font-medium">{item.system}</p><p className="text-xs text-gray-500">{item.accessType}</p></div>
                                            {(isHRView || role.isIT) ? (
                                                <select
                                                    value={item.status}
                                                    disabled={submitting}
                                                    onChange={(event) => updateWorkflowItem(
                                                        `access-revocation/${item._id}`,
                                                        { status: event.target.value },
                                                        'Access revocation updated',
                                                    )}
                                                    className="rounded-lg border px-2 py-1 text-sm"
                                                >
                                                    {['Pending', 'Completed', 'Waived'].map((status) => <option key={status}>{status}</option>)}
                                                </select>
                                            ) : <span className="text-xs">{item.status}</span>}
                                        </div>
                                    ))}
                                </div>
                            </Section>
                            )}
                        </div>

                        {isFeatureEnabled('noticePeriod') && (
                        <Section id="offboarding-notice-period" icon={<FaClock />} title="Notice Period">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg border p-4">
                                    <p className="text-sm text-gray-500">Policy days</p>
                                    <p className="text-xl font-semibold">{workflow.noticePeriod?.policyDays ?? '—'}</p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-sm text-gray-500">Served / Remaining</p>
                                    <p className="text-xl font-semibold">
                                        {workflow.noticePeriod?.servedDays ?? 0} / {workflow.noticePeriod?.remainingDays ?? '—'}
                                    </p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-sm text-gray-500">Status</p>
                                    <p className="text-xl font-semibold">{workflow.noticePeriod?.status || 'Not Applicable'}</p>
                                </div>
                                <div className="rounded-lg border p-4">
                                    <p className="text-sm text-gray-500">Last working day</p>
                                    <p className="text-xl font-semibold">
                                        {workflow.lastWorkingDate ? format(new Date(workflow.lastWorkingDate), 'dd MMM yyyy') : '—'}
                                    </p>
                                </div>
                            </div>
                            {isHRView && workflow.noticePeriod?.status === 'Active' && (
                                <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-4">
                                    <label className="text-sm text-gray-600">
                                        Buyout days
                                        <input
                                            type="number"
                                            min="1"
                                            value={buyoutDays}
                                            onChange={(e) => setBuyoutDays(e.target.value)}
                                            className="mt-1 block w-28 rounded-lg border px-2 py-1.5 text-sm"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        disabled={submitting || !buyoutDays}
                                        onClick={approveNoticeBuyout}
                                        className="rounded-lg bg-theme-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                                    >
                                        Approve buyout
                                    </button>
                                    {isFeatureEnabled('leaveAdjustmentNotice') && (
                                        <>
                                            <label className="text-sm text-gray-600">
                                                Leave adjustment (days)
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={leaveAdjustmentDays}
                                                    onChange={(e) => setLeaveAdjustmentDays(e.target.value)}
                                                    className="mt-1 block w-28 rounded-lg border px-2 py-1.5 text-sm"
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                disabled={submitting}
                                                onClick={saveLeaveAdjustment}
                                                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-60"
                                            >
                                                Save adjustment
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </Section>
                        )}

                        {(isFeatureEnabled('knowledgeTransfer') || isFeatureEnabled('projectHandover')) && (
                        <Section id="offboarding-knowledge" icon={<FaExchangeAlt />} title="Knowledge Transfer">
                            <div className="space-y-3">
                                {(workflow.knowledgeTransfer || []).map((item) => {
                                    const owner = (item.transferredBy?._id || item.transferredBy)?.toString();
                                    const recipient = (item.transferredTo?._id || item.transferredTo)?.toString();
                                    const canUpdate = isHRView || owner === myEmployeeId || recipient === myEmployeeId;
                                    return (
                                        <div key={item._id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 md:flex-row md:items-center">
                                            <div>
                                                <p className="font-medium">{item.topic}</p>
                                                <p className="text-sm text-gray-500">{item.description}</p>
                                                <p className="text-xs text-gray-500">To: {item.transferredTo?.name || 'Manager not assigned'}</p>
                                            </div>
                                            {canUpdate ? (
                                                <select value={item.status} disabled={submitting} onChange={(event) => updateKnowledgeTransfer(item, event.target.value)} className="rounded-lg border px-2 py-1 text-sm">
                                                    {['Pending', 'In Progress', 'Completed', ...(isHRView ? ['Waived'] : [])].map((status) => <option key={status}>{status}</option>)}
                                                </select>
                                            ) : <span className="text-sm">{item.status}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                        )}

                        {isFeatureEnabled('fnfSettlement') && (
                        <Section id="offboarding-payroll" icon={<FaMoneyCheckAlt />} title="Full & Final Settlement">
                            <p className="mb-3 text-sm text-gray-500">
                                Calculate settlement components here. Payment execution remains in Payroll.
                            </p>
                            {workflow.finalSettlement?.calculatedAt && (
                                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        ['Leave encashment', workflow.finalSettlement.leaveEncashment],
                                        ['Pending dues', workflow.finalSettlement.pendingDues],
                                        ['Bonus', workflow.finalSettlement.bonusAmount],
                                        ['Gratuity (est.)', workflow.finalSettlement.gratuityEstimate],
                                        ['Recoveries', workflow.finalSettlement.recoveries],
                                        ['Tax deduction', workflow.finalSettlement.taxDeduction],
                                        ['Net settlement', workflow.finalSettlement.finalAmount],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-lg border bg-gray-50/80 p-3">
                                            <p className="text-xs text-gray-500">{label}</p>
                                            <p className="font-semibold text-gray-800">Rs {Number(value || 0).toLocaleString('en-IN')}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(isHRView || role.isPayroll) && isHRView && (
                                <div className="mb-4 grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        ['leaveBalanceDays', 'Leave balance (days)'],
                                        ['pendingDues', 'Pending dues'],
                                        ['bonusAmount', 'Bonus'],
                                        ['gratuityEstimate', 'Gratuity estimate'],
                                        ['recoveries', 'Recoveries'],
                                        ['taxDeduction', 'Tax deduction'],
                                    ].map(([key, label]) => (
                                        <label key={key} className="text-sm text-gray-600">
                                            {label}
                                            <input
                                                type="number"
                                                min="0"
                                                value={fnfForm[key]}
                                                onChange={(e) => setFnfForm((prev) => ({ ...prev, [key]: e.target.value }))}
                                                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                                            />
                                        </label>
                                    ))}
                                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
                                        <button type="button" disabled={submitting} onClick={calculateFnf} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60">Calculate F&F</button>
                                        <button type="button" disabled={submitting} onClick={submitFnfApproval} className="rounded-lg bg-theme-primary px-4 py-2 text-sm text-white disabled:opacity-60">Submit for approval</button>
                                        <button type="button" disabled={submitting} onClick={generateFnfPdf} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-60">Generate PDF</button>
                                        <button type="button" disabled={submitting} onClick={createFnfPayrollRun} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-60">Create Payroll Run</button>
                                        {workflow.finalSettlement?.pdfUrl && (
                                            <a href={workflow.finalSettlement.pdfUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-4 py-2 text-sm text-theme-primary">View PDF</a>
                                        )}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <p className="font-medium">Payroll clearance status</p>
                                    <p className="text-sm text-gray-500">{workflow.finalSettlement?.calculationNotes || workflow.finalSettlement?.notes || 'No clearance note'}</p>
                                </div>
                                {(isHRView || role.isPayroll) ? (
                                    <select
                                        value={workflow.finalSettlement?.status || 'Pending'}
                                        disabled={submitting}
                                        onChange={(event) => updateWorkflowItem(
                                            'payroll-clearance',
                                            { status: event.target.value },
                                            'Payroll clearance updated',
                                        )}
                                        className="rounded-lg border px-2 py-1 text-sm"
                                    >
                                        {['Pending', 'In Review', 'Calculated', 'Pending Approval', 'Approved', 'Cleared', 'Waived'].map((status) => <option key={status}>{status}</option>)}
                                    </select>
                                ) : <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{workflow.finalSettlement?.status}</span>}
                            </div>
                        </Section>
                        )}

                        {isFeatureEnabled('exitInterview') && (
                        <Section id="offboarding-exit-interview" icon={<FaUserFriends />} title="Exit Interview">
                            <ExitInterviewWorkflowPanel
                                workflowId={workflow._id}
                                isHRView={isHRView}
                                onUpdated={() => fetchDashboard({ soft: true })}
                            />
                        </Section>
                        )}

                        {(isFeatureEnabled('experienceLetter') || isFeatureEnabled('relievingLetter') || isFeatureEnabled('serviceCertificate')) && (
                        <Section id="offboarding-generated-letters" icon={<FaFileAlt />} title="Auto-Generated Letters">
                            <OffboardingLettersPanel workflowId={workflow._id} />
                        </Section>
                        )}

                        {isFeatureEnabled('experienceLetter') && (
                        <Section id="offboarding-experience-letter" icon={<FaFileAlt />} title="Experience Letter">
                            <div className={`rounded-xl border p-4 sm:p-5 ${
                                workflow.experienceLetter?.status === 'Issued'
                                    ? 'border-emerald-100 bg-emerald-50/50'
                                    : 'border-gray-200 bg-gray-50/60'
                            }`}>
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                            workflow.experienceLetter?.status === 'Issued'
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-gray-200/70 text-gray-500'
                                        }`}>
                                            <FaFileAlt />
                                        </span>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="min-w-0 break-words font-semibold text-gray-800">
                                                    {workflow.experienceLetter?.status === 'Issued'
                                                        ? workflow.experienceLetter.fileName || 'Experience Letter'
                                                        : 'Not issued yet'}
                                                </p>
                                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                                                    workflow.experienceLetter?.status === 'Issued'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {workflow.experienceLetter?.status === 'Issued' ? 'Issued' : 'Pending'}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm leading-relaxed text-gray-500">
                                                {isHRView
                                                    ? 'Upload the employee experience letter. It will be securely available to this employee.'
                                                    : workflow.experienceLetter?.status === 'Issued'
                                                        ? 'Your experience letter has been issued by HR.'
                                                        : 'HR will upload your experience letter here.'}
                                            </p>
                                            {workflow.experienceLetter?.uploadedAt && (
                                                <p className="mt-1.5 text-xs font-medium text-gray-400">
                                                    Issued on {format(new Date(workflow.experienceLetter.uploadedAt), 'MMM dd, yyyy')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center md:shrink-0 md:justify-end">
                                        {workflow.experienceLetter?.status === 'Issued' && (
                                            <button
                                                type="button"
                                                onClick={previewExperienceLetter}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme-secondary bg-white px-4 py-2 text-sm font-medium text-theme-secondary transition hover:bg-theme-secondary hover:text-white"
                                            >
                                                <FaFileAlt className="shrink-0" /> View Letter
                                            </button>
                                        )}
                                        {isHRView && (
                                            <>
                                                <input
                                                    ref={experienceLetterInputRef}
                                                    type="file"
                                                    accept=".pdf,.doc,.docx"
                                                    onChange={(event) => setExperienceLetterFile(event.target.files?.[0] || null)}
                                                    className="hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => experienceLetterInputRef.current?.click()}
                                                    className="inline-flex min-w-0 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-theme-secondary hover:text-theme-secondary"
                                                >
                                                    <FaPlus className="shrink-0 text-xs" />
                                                    <span className="truncate">
                                                        {experienceLetterFile ? experienceLetterFile.name : 'Choose file (PDF, DOC)'}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={submitting || !experienceLetterFile}
                                                    onClick={uploadExperienceLetter}
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-theme-secondary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-theme-primary disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    {workflow.experienceLetter?.status === 'Issued' ? 'Replace Letter' : 'Upload Letter'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Section>
                        )}

                        <div className="grid gap-5 xl:grid-cols-2">
                            <Section
                                id="offboarding-timeline"
                                icon={<FaClock />}
                                title="Recent Activity"
                                subtitle={
                                    workflow.employeeId
                                        ? `Activity for ${workflow.employeeId?.name || ''} ${workflow.employeeId?.lastName || ''}`.trim()
                                        : 'Selected employee'
                                }
                            >
                                <div className="max-h-80 space-y-3 overflow-y-auto">
                                    {(workflow.activityFeed || []).map((entry) => {
                                        const employeeName = `${workflow.employeeId?.name || ''} ${workflow.employeeId?.lastName || ''}`.trim();
                                        const description = entry.description || (entry.action || 'Activity').replaceAll('_', ' ');
                                        const showsEmployee = employeeName
                                            && description.toLowerCase().includes(employeeName.toLowerCase());
                                        return (
                                            <div key={entry._id} className="rounded-lg border border-gray-50 px-3 py-2.5 border-l-2 border-l-theme-primary">
                                                {!showsEmployee && employeeName ? (
                                                    <p className="text-xs font-semibold text-theme-secondary">{employeeName}</p>
                                                ) : null}
                                                <p className="text-sm text-gray-800">{description}</p>
                                                <p className="text-xs text-gray-500">
                                                    {entry.actor?.name || entry.actorName || 'System'} · {entry.createdAt ? format(new Date(entry.createdAt), 'MMM dd, yyyy HH:mm') : ''}
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {!workflow.activityFeed?.length && (
                                        <EmptyItems>No activity recorded yet for this employee.</EmptyItems>
                                    )}
                                </div>
                            </Section>

                            {isHRView && (
                                <Section id="offboarding-notes" icon={<FaStickyNote />} title="Internal Notes">
                                    <div className="mb-3 flex gap-2">
                                        <textarea
                                            value={newNote}
                                            onChange={(event) => setNewNote(event.target.value)}
                                            rows={2}
                                            placeholder="Add an internal HR note..."
                                            className="flex-1 rounded-lg border p-2 text-sm"
                                        />
                                        <button disabled={submitting || !newNote.trim()} onClick={addNote} className="rounded-lg bg-theme-secondary px-4 text-white">Add</button>
                                    </div>
                                    <div className="max-h-56 space-y-2 overflow-y-auto">
                                        {(workflow.notes || []).map((note) => (
                                            <div key={note._id} className="rounded-lg bg-gray-50 p-3 text-sm">
                                                <p>{note.note}</p>
                                                <p className="mt-1 text-xs text-gray-500">{note.addedBy?.name || 'HR'}</p>
                                            </div>
                                        ))}
                                    </div>
                                </Section>
                            )}
                        </div>
                    </>
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <form onSubmit={createWorkflow} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
                        <div className="mb-5 flex items-center justify-between">
                            <div><h3 className="text-xl font-bold">Initiate Offboarding</h3><p className="text-sm text-gray-500">Create an independent employee separation workflow.</p></div>
                            <button type="button" onClick={() => setShowCreateModal(false)} className="text-2xl text-gray-500">×</button>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="text-sm">Employee *
                                <select
                                    required
                                    value={createForm.employeeId}
                                    onChange={(event) => {
                                        const employeeId = event.target.value;
                                        const emp = employees.find((row) => String(row._id) === String(employeeId));
                                        const managerId = emp?.managerId?._id || emp?.managerId || '';
                                        let assignedManager = managerId ? String(managerId) : '';
                                        if (!assignedManager && emp?.manager) {
                                            const managerName = String(emp.manager).trim().toLowerCase();
                                            const matched = employees.find((row) => {
                                                const full = `${row.name || ''} ${row.lastName || ''}`.trim().toLowerCase();
                                                const first = String(row.name || '').trim().toLowerCase();
                                                return full === managerName || first === managerName;
                                            });
                                            if (matched) assignedManager = String(matched._id);
                                        }
                                        setCreateForm((prev) => {
                                            const allowedManagers = new Set(
                                                filterManagerCandidates(employees, employeeId).map((e) => String(e._id || e.id)),
                                            );
                                            const nextManager = String(assignedManager || '');
                                            return {
                                                ...prev,
                                                employeeId,
                                                assignedManager: nextManager && allowedManagers.has(nextManager) ? nextManager : '',
                                            };
                                        });
                                    }}
                                    className="mt-1 w-full rounded-lg border p-2"
                                >
                                    <option value="">Select employee</option>
                                    {employees.map((item) => <option key={item._id} value={item._id}>{item.name} {item.lastName} ({item.email})</option>)}
                                </select>
                            </label>
                            <label className="text-sm">Last working date *
                                <input required type="date" value={createForm.lastWorkingDate} onChange={(event) => setCreateForm({ ...createForm, lastWorkingDate: event.target.value })} className="mt-1 w-full rounded-lg border p-2" />
                            </label>
                            <label className="text-sm">Resignation date
                                <input type="date" value={createForm.resignationDate} onChange={(event) => setCreateForm({ ...createForm, resignationDate: event.target.value })} className="mt-1 w-full rounded-lg border p-2" />
                            </label>
                            <label className="text-sm">Reason
                                <select value={createForm.reason} onChange={(event) => setCreateForm({ ...createForm, reason: event.target.value })} className="mt-1 w-full rounded-lg border p-2">
                                    {['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other'].map((reason) => <option key={reason}>{reason}</option>)}
                                </select>
                            </label>
                            <label className="text-sm">Assigned HR
                                <select value={createForm.assignedHR} onChange={(event) => setCreateForm({ ...createForm, assignedHR: event.target.value })} className="mt-1 w-full rounded-lg border p-2">
                                    <option value="">Auto assign</option>
                                    {hrAssignees.map((item) => (
                                        <option key={item._id} value={item._id}>
                                            {item.name} {item.lastName || ''}
                                            {item.jobTitle ? ` (${item.jobTitle})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {!hrAssignees.length && (
                                    <p className="mt-1 text-xs text-gray-500">No HR Manager / HR Executive found. Use Auto assign.</p>
                                )}
                            </label>
                            <label className="text-sm">Assigned manager
                                <select value={createForm.assignedManager} onChange={(event) => setCreateForm({ ...createForm, assignedManager: event.target.value })} className="mt-1 w-full rounded-lg border p-2">
                                    <option value="">Employee manager</option>
                                    {managerCandidates.map((item) => (
                                        <option key={item._id} value={item._id}>
                                            {item.name} {item.lastName || ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm md:col-span-2">Details
                                <textarea value={createForm.reasonDetails} onChange={(event) => setCreateForm({ ...createForm, reasonDetails: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border p-2" />
                            </label>
                        </div>
                        <label className="mt-4 flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={createForm.saveAsDraft} onChange={(event) => setCreateForm({ ...createForm, saveAsDraft: event.target.checked })} />
                            Save as draft
                        </label>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg border px-4 py-2">Cancel</button>
                            <button disabled={submitting} type="submit" className="rounded-lg bg-theme-secondary px-4 py-2 text-white">
                                {submitting ? 'Saving...' : createForm.saveAsDraft ? 'Save Draft' : 'Initiate Workflow'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {pendingDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-800">Delete offboarding workflow?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will delete the workflow for {pendingDelete.employeeId?.name || 'this employee'}.
                            Existing employee, document, asset and payroll records will not be deleted.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setPendingDelete(null)} className="rounded-lg border px-4 py-2">
                                Keep Workflow
                            </button>
                            <button
                                type="button"
                                disabled={submitting}
                                onClick={() => deleteWorkflow(pendingDelete)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OffboardingHub;

