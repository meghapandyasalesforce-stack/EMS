import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import {
    FaArrowLeft, FaBoxOpen, FaCalendarAlt, FaClipboardCheck,
    FaClock, FaEllipsisV, FaExchangeAlt, FaFileAlt, FaKey,
    FaMoneyCheckAlt, FaPlus, FaRedo, FaSignOutAlt, FaStickyNote, FaTasks, FaUserFriends,
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
import { CmBadge, CmButton, CmSearch, CmPerson, CmEmpty, statusTone } from '../../components/corporateModern';

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

function checklistByCategory(item, category) {
    return (item.clearanceChecklist || []).filter((row) => String(row.category || '').toLowerCase() === category);
}

function clearanceTone(kind) {
    if (kind === 'ok') return 'cm-offboard-pill cm-offboard-pill--ok';
    if (kind === 'warn') return 'cm-offboard-pill cm-offboard-pill--warn';
    return 'cm-offboard-pill cm-offboard-pill--muted';
}

/** Map real offboarding fields → ZIP-style IT / Finance / HR clearance labels. */
function deriveClearancePills(item) {
    const assets = item.assets || [];
    const itItems = checklistByCategory(item, 'it');
    const hrItems = checklistByCategory(item, 'hr');
    const financeItems = checklistByCategory(item, 'finance');
    const access = item.accessRevocation || [];
    const kt = item.knowledgeTransfer || [];
    const fnf = item.finalSettlement?.status || 'Pending';
    const letter = item.experienceLetter?.status || 'Pending';

    let it = { label: 'Not Started', tone: 'muted' };
    if (assets.length) {
        const allReturned = assets.every((a) => a.returned || a.status === 'Returned' || a.status === 'Waived');
        const anyReturned = assets.some((a) => a.returned || a.status === 'Returned');
        if (allReturned) it = { label: 'Assets Returned', tone: 'ok' };
        else if (anyReturned || assets.some((a) => a.status === 'Pending')) it = { label: 'Pending Device Handover', tone: 'warn' };
    } else if (itItems.length) {
        const done = itItems.every((r) => r.completed);
        const some = itItems.some((r) => r.completed);
        if (done) it = { label: 'Assets Returned', tone: 'ok' };
        else if (some) it = { label: 'Pending Device Handover', tone: 'warn' };
        else if (['Scheduled', 'Initiated'].includes(item.status)) it = { label: 'Scheduled', tone: 'muted' };
    } else if (access.length) {
        const done = access.every((a) => a.status === 'Completed' || a.status === 'Waived');
        if (done) it = { label: 'Assets Returned', tone: 'ok' };
        else if (['Scheduled', 'Initiated'].includes(item.status)) it = { label: 'Scheduled', tone: 'muted' };
        else it = { label: 'Pending Device Handover', tone: 'warn' };
    } else if (['Scheduled', 'Initiated'].includes(item.status)) {
        it = { label: 'Scheduled', tone: 'muted' };
    }

    let finance = { label: 'Pending Invoices', tone: 'muted' };
    if (['Paid', 'Cleared', 'Approved'].includes(fnf)) {
        finance = { label: fnf === 'Cleared' ? 'Cleared' : 'Full & Final Done', tone: 'ok' };
    } else if (['In Review', 'Calculated', 'Pending Approval'].includes(fnf)) {
        finance = { label: 'Audit in Queue', tone: 'muted' };
    } else if (financeItems.length) {
        const done = financeItems.every((r) => r.completed);
        finance = done
            ? { label: 'Cleared', tone: 'ok' }
            : { label: 'Pending Invoices', tone: 'muted' };
    }

    let hr = { label: 'Draft Issued', tone: 'muted' };
    const ktPending = kt.some((k) => !['Completed', 'Waived'].includes(k.status));
    if (hrItems.length && hrItems.every((r) => r.completed) && letter === 'Issued') {
        hr = { label: 'Completed', tone: 'ok' };
    } else if (ktPending || (hrItems.length && hrItems.some((r) => !r.completed))) {
        hr = { label: 'IP Signoff Pending', tone: 'warn' };
    } else if (letter === 'Issued' || (hrItems.length && hrItems.every((r) => r.completed))) {
        hr = { label: 'Completed', tone: 'ok' };
    } else if (letter === 'Pending' || item.status === 'Draft') {
        hr = { label: 'Draft Issued', tone: 'muted' };
    }

    const ei = item.exitInterview || {};
    let exitLabel = 'Not Scheduled';
    if (ei.status === 'Completed' || ei.conductedDate) {
        const when = ei.conductedDate ? format(new Date(ei.conductedDate), 'd MMM') : null;
        exitLabel = when ? `Completed (${when})` : 'Completed';
    } else if (ei.status === 'Scheduled' || ei.scheduledDate) {
        const when = ei.scheduledDate ? format(new Date(ei.scheduledDate), 'd MMM, h a') : null;
        exitLabel = when ? `Scheduled (${when})` : 'Scheduled';
    } else if (ei.status && ei.status !== 'Not Scheduled') {
        exitLabel = ei.status;
    }

    return { it, finance, hr, exitLabel };
}

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
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('all');
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
    const {
        data: employeeData = { employees: [] },
        isLoading: employeesLoading,
        isFetching: employeesFetching,
        refetch: refetchEmployees,
    } = useEmployees();
    const employees = useMemo(() => {
        const list = Array.isArray(employeeData?.employees)
            ? employeeData.employees
            : Array.isArray(employeeData)
                ? employeeData
                : [];
        return [...list].sort((a, b) => {
            const an = `${a?.name || ''} ${a?.lastName || ''}`.trim().toLowerCase();
            const bn = `${b?.name || ''} ${b?.lastName || ''}`.trim().toLowerCase();
            return an.localeCompare(bn);
        });
    }, [employeeData]);
    const selectableEmployees = useMemo(
        () => employees.filter((emp) => {
            const id = String(emp._id || emp.id || '');
            if (!id) return false;
            const status = String(emp.status || '').toLowerCase();
            return !(emp.active === false || ['inactive', 'terminated', 'suspended'].includes(status));
        }),
        [employees],
    );
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

    useEffect(() => {
        if (!showCreateModal) return undefined;
        refetchEmployees();
        return undefined;
    }, [showCreateModal, refetchEmployees]);

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

    const departmentOptions = useMemo(() => {
        const set = new Set();
        (dashboard.workflows || []).forEach((w) => {
            const d = w.employeeId?.department;
            if (d) set.add(d);
        });
        return Array.from(set).sort();
    }, [dashboard.workflows]);

    const locationOptions = useMemo(() => {
        const set = new Set();
        (dashboard.workflows || []).forEach((w) => {
            const loc = w.employeeId?.workLocation || w.employeeId?.location;
            if (loc) set.add(loc);
        });
        return Array.from(set).sort();
    }, [dashboard.workflows]);

    const filteredWorkflows = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        return (dashboard.workflows || []).filter((item) => {
            const name = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''}`.toLowerCase();
            const email = (item.employeeId?.email || '').toLowerCase();
            const role = (item.employeeId?.jobTitle || item.employeeId?.position || '').toLowerCase();
            const empCode = String(item.employeeId?.employeeCode || item.employeeId?.employeeId || '').toLowerCase();
            const dept = item.employeeId?.department || '';
            const loc = item.employeeId?.workLocation || item.employeeId?.location || '';
            const matchSearch = !search
                || name.includes(search)
                || email.includes(search)
                || role.includes(search)
                || empCode.includes(search);
            const matchStatus = statusFilter === 'all' || item.status === statusFilter;
            const matchDept = departmentFilter === 'all' || dept === departmentFilter;
            const matchLoc = locationFilter === 'all' || loc === locationFilter;
            return matchSearch && matchStatus && matchDept && matchLoc;
        });
    }, [dashboard.workflows, searchTerm, statusFilter, departmentFilter, locationFilter]);

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
            <div className="page-shell hrms-lifecycle bg-transparent">
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
                    <div className="rounded-xl bg-white p-10 text-center shadow-md">
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
        <div className="page-shell hrms-lifecycle cm-hrms bg-transparent">
            <div className="page-shell-inner hrms-stack pb-10">
                {!workflow && (
                <header className="cm-offboard-hero">
                    <div className="min-w-0">
                        {!isHRView && (
                            <p className="text-sm font-medium text-theme-secondary">
                                {isManagerView ? 'My Team' : 'Employee'}
                            </p>
                        )}
                        <h1 className="cm-offboard-hero__title">
                            {isHRView
                                ? 'Employee Exit & Separation Protocol'
                                : isManagerView
                                    ? 'My Team'
                                    : 'My Offboarding'}
                        </h1>
                        <p className="cm-offboard-hero__subtitle">
                            {isManagerView
                                ? 'Direct reports who are currently offboarding.'
                                : isHRView
                                    ? 'Asset recovery, knowledge handover sign-offs, and compliance garden leave management.'
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
                                <FaSignOutAlt className="shrink-0 text-base" />
                                <span>Initiate Exit Protocol</span>
                            </CmButton>
                        )}
                    </div>
                </header>
                )}

                {!workflow && (isHRView || isWorkQueueView) && (
                    <>
                    <div className="cm-offboard-board">
                        <div className="cm-roster-toolbar">
                            <div className="cm-roster-toolbar__search">
                                <CmSearch
                                    value={searchTerm}
                                    onChange={(event) => setSearchTerm(event.target.value)}
                                    placeholder="Search by candidate name, role, email, or employee ID..."
                                    className="cm-search--toolbar"
                                />
                            </div>
                            <div className="cm-roster-toolbar__filters">
                                <select
                                    className="cm-roster-toolbar__select"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    aria-label="Filter by status"
                                >
                                    <option value="all">All Statuses</option>
                                    {OFFBOARDING_STATUSES.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                                <select
                                    className="cm-roster-toolbar__select"
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    aria-label="Filter by department"
                                >
                                    <option value="all">All Departments</option>
                                    {departmentOptions.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                                <select
                                    className="cm-roster-toolbar__select"
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                    aria-label="Filter by location"
                                >
                                    <option value="all">All Locations</option>
                                    {locationOptions.map((loc) => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="cm-roster-toolbar__reset"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setStatusFilter('all');
                                        setDepartmentFilter('all');
                                        setLocationFilter('all');
                                    }}
                                    aria-label="Reset filters"
                                >
                                    <FaRedo className="text-[11px]" />
                                    Reset
                                </button>
                            </div>
                        </div>

                        {filteredWorkflows.length === 0 ? (
                            <div className="p-6">
                                <CmEmpty title="No offboarding workflows found">
                                    {isHRView ? 'Initiate an exit protocol to get started.' : 'No matching workflows in this view.'}
                                </CmEmpty>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3 p-4 sm:hidden">
                                    {filteredWorkflows.map((item) => {
                                        const fullName = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''}`.trim();
                                        const pills = deriveClearancePills(item);
                                        const empCode = item.employeeId?.employeeCode || item.employeeId?.employeeId || '';
                                        const title = item.employeeId?.jobTitle || item.employeeId?.designation || '';
                                        return (
                                            <article
                                                key={item._id}
                                                onClick={() => openWorkflow(item)}
                                                className="cm-offboard-card"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <CmPerson
                                                        name={fullName || 'Employee'}
                                                        meta={[empCode, title].filter(Boolean).join(' • ') || item.reason || ''}
                                                        photo={item.employeeId?.profileImage || item.employeeId?.avatar}
                                                    />
                                                    <CmBadge tone={statusTone(item.status)} dot={false}>{item.status}</CmBadge>
                                                </div>
                                                <p className="mt-3 text-sm font-medium text-[var(--cm-on-surface)]">
                                                    {item.employeeId?.department || '—'}
                                                </p>
                                                <p className="text-xs text-[var(--cm-muted)]">
                                                    LWD: {item.lastWorkingDate ? format(new Date(item.lastWorkingDate), 'd MMM yyyy') : '—'}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-1.5">
                                                    <span className={clearanceTone(pills.it.tone)}>{pills.it.label}</span>
                                                    <span className={clearanceTone(pills.finance.tone)}>{pills.finance.label}</span>
                                                    <span className={clearanceTone(pills.hr.tone)}>{pills.hr.label}</span>
                                                </div>
                                                <p className="mt-2 text-xs text-[var(--cm-muted)]">{pills.exitLabel}</p>
                                                <div className="mt-3 flex items-center justify-between gap-3">
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

                                <div className="hidden sm:block cm-offboard-table-wrap">
                                    <table className="cm-offboard-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Department &amp; LWD</th>
                                                <th>IT Clearance</th>
                                                <th>Finance Clearance</th>
                                                <th>HR &amp; NDAs</th>
                                                <th>Exit Interview</th>
                                                <th className="text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredWorkflows.map((item) => {
                                                const fullName = `${item.employeeId?.name || ''} ${item.employeeId?.lastName || ''}`.trim();
                                                const pills = deriveClearancePills(item);
                                                const empCode = item.employeeId?.employeeCode || item.employeeId?.employeeId || '';
                                                const title = item.employeeId?.jobTitle || item.employeeId?.designation || '';
                                                const photo = item.employeeId?.profileImage || item.employeeId?.avatar;
                                                const initials = (fullName || '?')
                                                    .split(/\s+/)
                                                    .filter(Boolean)
                                                    .slice(0, 2)
                                                    .map((p) => p[0]?.toUpperCase())
                                                    .join('');
                                                return (
                                                    <tr
                                                        key={item._id}
                                                        onClick={() => openWorkflow(item)}
                                                    >
                                                        <td>
                                                            <div className="cm-offboard-emp">
                                                                {photo ? (
                                                                    <img src={photo} alt="" className="cm-offboard-emp__avatar" />
                                                                ) : (
                                                                    <span className="cm-offboard-emp__avatar cm-offboard-emp__avatar--initials" aria-hidden>
                                                                        {initials || '?'}
                                                                    </span>
                                                                )}
                                                                <div className="min-w-0">
                                                                    <p className="cm-offboard-emp__name">{fullName || 'Employee'}</p>
                                                                    <p className="cm-offboard-emp__meta">
                                                                        {[empCode, title].filter(Boolean).join(' • ') || item.reason || '—'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <p className="cm-offboard-dept">{item.employeeId?.department || '—'}</p>
                                                            <p className="cm-offboard-lwd">
                                                                LWD: {item.lastWorkingDate ? format(new Date(item.lastWorkingDate), 'd MMM yyyy') : '—'}
                                                            </p>
                                                        </td>
                                                        <td>
                                                            <span className={clearanceTone(pills.it.tone)}>{pills.it.label}</span>
                                                        </td>
                                                        <td>
                                                            <span className={clearanceTone(pills.finance.tone)}>{pills.finance.label}</span>
                                                        </td>
                                                        <td>
                                                            <span className={clearanceTone(pills.hr.tone)}>{pills.hr.label}</span>
                                                        </td>
                                                        <td>
                                                            <span className="cm-offboard-exit">{pills.exitLabel}</span>
                                                        </td>
                                                        <td className="text-right" onClick={(event) => event.stopPropagation()}>
                                                            <div className="cm-offboard-actions">
                                                                <button
                                                                    type="button"
                                                                    className="cm-offboard-more"
                                                                    aria-label="Open workflow"
                                                                    onClick={() => openWorkflow(item)}
                                                                >
                                                                    <FaEllipsisV />
                                                                </button>
                                                                {isHRView && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPendingDelete(item)}
                                                                        aria-label="Delete workflow"
                                                                        className="cm-link cm-link--attention"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                )}
                                                            </div>
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
                            <div className="cm-offboard-board__foot">
                                <span>
                                    Showing {filteredWorkflows.length} of {dashboard?.stats?.totalSeparations ?? filteredWorkflows.length} separations
                                </span>
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
                                    disabled={employeesLoading || employeesFetching}
                                    onChange={(event) => {
                                        const employeeId = event.target.value;
                                        const emp = employees.find((row) => String(row._id || row.id) === String(employeeId));
                                        const managerId = emp?.managerId?._id || emp?.managerId || '';
                                        let assignedManager = managerId ? String(managerId) : '';
                                        if (!assignedManager && emp?.manager) {
                                            const managerName = String(emp.manager).trim().toLowerCase();
                                            const matched = employees.find((row) => {
                                                const full = `${row.name || ''} ${row.lastName || ''}`.trim().toLowerCase();
                                                const first = String(row.name || '').trim().toLowerCase();
                                                return full === managerName || first === managerName;
                                            });
                                            if (matched) assignedManager = String(matched._id || matched.id);
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
                                    <option value="">
                                        {employeesLoading || employeesFetching ? 'Loading employees…' : 'Select employee'}
                                    </option>
                                    {selectableEmployees.map((item) => {
                                        const id = item._id || item.id;
                                        return (
                                            <option key={id} value={id}>
                                                {item.name} {item.lastName || ''}
                                                {item.email ? ` (${item.email})` : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                {!employeesLoading && !employeesFetching && selectableEmployees.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-700">
                                        No active employees found. Check employee access permissions or refresh and try again.
                                        <button
                                            type="button"
                                            className="ml-1 font-semibold underline"
                                            onClick={() => refetchEmployees()}
                                        >
                                            Retry
                                        </button>
                                    </p>
                                )}
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

