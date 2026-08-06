import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import {
    ADMIN_ONBOARDING_ENDPOINT, BOTH_ONBOARDING_ENDPOINT,
} from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { canAccessLifecycleEnterprise } from '../../utils/managerHelper';
import { useEmployees } from '../../Hooks/useDashboardData';
import {
    TASK_STATUS_COLORS, WORKFLOW_STATUSES, TASK_GROUPS_BY_ROLE,
    ASSET_STATUSES, getTaskCompletionBlockers, canCompleteTask,
} from '../../constants/onboardingConstants';
import { getTokenFromCookie } from '../../utils/authHelper';
import { getSocketIOUrl } from '../../utils/socketUrl';
import {
    FaUserPlus, FaCheckCircle, FaTasks, FaFileAlt, FaClock, FaLaptop,
    FaUser, FaChartLine, FaHistory, FaStickyNote, FaGraduationCap,
    FaSpinner, FaSearch, FaPen, FaCalendarAlt, FaTrash, FaFilter, FaArrowLeft,
    FaShieldAlt, FaFlagCheckered, FaChevronDown, FaChevronUp,
} from 'react-icons/fa';
import OnboardingHrDetailView from './OnboardingHrDetailView';
import OnboardingBgvPanel from './OnboardingBgvPanel';
import OnboardingMilestonesPanel from './OnboardingMilestonesPanel';
import OnboardingFormsPanel from './OnboardingFormsPanel';
import OnboardingGoalsPanel from './OnboardingGoalsPanel';
import ItProvisioningPanel from './ItProvisioningPanel';
import LmsDashboard from './LmsDashboard';
import useLifecycleFeatures from '../../Hooks/useLifecycleFeatures';
import { CmBadge, CmButton, CmSearch, CmStat, CmPerson, CmRing, CmEmpty, statusTone } from '../../components/corporateModern';

const PROGRESS_RING_SPECS = [
    { key: 'overall', label: 'Overall', getValue: (wf, b) => wf?.progress || 0, color: 'var(--cm-primary)' },
    { key: 'tasks', label: 'Tasks', getValue: (_wf, b) => b.tasks || 0, color: '#2563eb' },
    { key: 'documents', label: 'Documents', getValue: (_wf, b) => b.documents || 0, color: '#7c3aed' },
    { key: 'checklist', label: 'Checklist', getValue: (_wf, b) => b.checklist || 0, color: '#059669' },
    { key: 'training', label: 'Training', getValue: (_wf, b) => b.training || 0, color: '#d97706' },
    { key: 'policies', label: 'Policies', getValue: (_wf, b) => b.policies || 0, color: '#db2777' },
    { key: 'assets', label: 'Assets', getValue: (_wf, b) => b.assets || 0, color: '#0891b2' },
];

const TASK_ACTION_SECTIONS = {
    'Assign laptop and equipment': 'onboarding-assets',
    'Manager induction session': 'onboarding-manager-actions',
    'Buddy welcome meeting': 'onboarding-buddy-checkins',
};

const TASK_ACTION_ROUTES = {
    'Upload identity documents': '/job-details',
    'Upload bank details': '/financial-details',
    'Verify employee documents': '/documents',
};

const WORKFLOW_STATUS_COLORS = {
    Draft: 'bg-slate-100 text-slate-700',
    Scheduled: 'bg-indigo-100 text-indigo-800',
    'Not Started': 'bg-gray-100 text-gray-700',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-emerald-100 text-emerald-800',
    Paused: 'bg-amber-100 text-amber-800',
    Cancelled: 'bg-gray-200 text-gray-600',
    Overdue: 'bg-red-100 text-red-800',
};

const OnboardingHub = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((s) => s.auth.user);
    const employee = useSelector((s) => s.employeeDetails.employee);
    const permissionFlags = useSelector((s) => s.auth.permissionFlags) || {};
    const permissions = useSelector((s) => s.auth.permissions) || [];
    const userObj = user || employee;
    const isAdmin = user?.role === 'admin';
    // Use enterprise lifecycle access (HR flags/permissions), not loose department/title matching,
    // so regular employees are never routed to the admin onboarding API.
    const userIsHR = canAccessLifecycleEnterprise(userObj, permissionFlags, permissions);
    const viewParam = searchParams.get('view') || '';
    const workflowIdParam = searchParams.get('id') || '';
    const detailTab = searchParams.get('detailTab') || 'overview';
    const isHRView = isAdmin || userIsHR;
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [expandedTaskGroups, setExpandedTaskGroups] = useState(() => new Set(['it']));
    const [newNote, setNewNote] = useState('');
    const fetchInFlightRef = React.useRef(false);
    const hasLoadedRef = React.useRef(false);
    const detailSectionRef = React.useRef(null);
    const workflowIdRef = React.useRef(workflowIdParam);
    workflowIdRef.current = workflowIdParam;

    const { isEnabled: isFeatureEnabled, filterByFeature } = useLifecycleFeatures({ admin: isHRView });

    const roleFromApi = dashboard?.role;
    const myEmployeeId = (employee?._id || employee?.id || user?.employeeId || roleFromApi?.employeeId)?.toString();
    const canViewTeam = !isHRView && Boolean(roleFromApi?.canViewTeam || roleFromApi?.hasDirectReports);
    const showRoleToggles = canViewTeam;

    const isManagerView = !isHRView && viewParam === 'team' && canViewTeam;
    const isPersonalView = !isHRView && !isManagerView;
    const viewerRole = isHRView ? 'hr' : isManagerView ? 'manager' : 'employee';

    const setLifecycleView = (nextView) => {
        const next = new URLSearchParams(searchParams);
        next.delete('id');
        if (nextView && nextView !== 'self') next.set('view', nextView);
        else next.delete('view');
        setSearchParams(next, { replace: false });
        setSelectedWorkflow(null);
    };

    // Drop stale / removed view params (buddy & tasks toggles removed).
    useEffect(() => {
        if (isHRView || !roleFromApi) return;
        if (viewParam === 'tasks' || viewParam === 'buddy') setLifecycleView('self');
        else if (viewParam === 'team' && !canViewTeam) setLifecycleView('self');
    }, [isHRView, roleFromApi, viewParam, canViewTeam]);

    const { data: employeeData = { employees: [] } } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const [createForm, setCreateForm] = useState({
        employeeId: '', templateId: '', assignedHR: '', assignedBuddy: '',
        assignedManager: '', welcomeMessage: '', joiningDate: '', scheduledStartDate: '',
        expectedCompletionDate: '',
        saveAsDraft: false,
    });

    const templates = dashboard?.templates || [];

    const pickWorkflow = (workflows, preferredId, { fallbackToFirst = false } = {}) => {
        if (!workflows?.length) return null;
        if (preferredId) {
            const found = workflows.find((w) => w._id === preferredId);
            if (found) return found;
            if (!fallbackToFirst) return null;
        }
        return workflows[0];
    };

    const fetchDashboard = useCallback(async ({ soft = false } = {}) => {
        if (fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        try {
            // Full-page spinner only on first load — soft refresh avoids blink
            if (!soft && !hasLoadedRef.current) setLoading(true);

            if (isHRView) {
                const view = viewParam === 'team' ? 'team' : 'all';
                const url = `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/dashboard${view !== 'all' ? `?view=${view}` : ''}`;
                const res = await axios.get(url, { withCredentials: true });
                const data = res.data?.data;
                const workflows = data?.workflows || [];
                setDashboard(data || { workflows: [], stats: {}, templates: [] });
                setSelectedWorkflow((prev) => {
                    const preferredId = workflowIdRef.current || prev?._id;
                    return preferredId ? pickWorkflow(workflows, preferredId) : null;
                });
                return;
            }

            const wantsTeam = viewParam === 'team';
            const viewQs = wantsTeam ? '?view=team' : '';
            const res = await axios.get(`${BOTH_ONBOARDING_ENDPOINT}/dashboard${viewQs}`, { withCredentials: true });
            const data = res.data?.data || { workflows: [], stats: {}, role: {} };
            const role = data.role || {};
            let workflows = data.workflows || [];
            const canTeam = Boolean(role.canViewTeam || role.hasDirectReports);
            const personalMode = !(wantsTeam && canTeam);

            if (personalMode) {
                try {
                    const mine = await axios.get(`${BOTH_ONBOARDING_ENDPOINT}/my-workflow`, { withCredentials: true });
                    if (mine.data?.data) workflows = [mine.data.data];
                } catch (err) {
                    if (err.response?.status !== 404) throw err;
                    workflows = [];
                }
            }

            setDashboard({ ...data, workflows, role });
            setSelectedWorkflow((prev) => {
                const preferredId = workflowIdRef.current || prev?._id;
                if (!personalMode) {
                    return preferredId ? pickWorkflow(workflows, preferredId) : null;
                }
                // Always show the employee's own workflow even if URL id is stale.
                return pickWorkflow(workflows, preferredId, { fallbackToFirst: true });
            });
        } catch (err) {
            if (!isHRView && err.response?.status === 404) {
                setDashboard({ workflows: [], stats: {}, role: {} });
                setSelectedWorkflow(null);
            } else {
                toast.error('Failed to load onboarding data');
            }
        } finally {
            hasLoadedRef.current = true;
            setLoading(false);
            fetchInFlightRef.current = false;
        }
    }, [isHRView, viewParam]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    // Selecting a chip only switches local selection — no refetch / no blink
    useEffect(() => {
        if (!workflowIdParam || !dashboard?.workflows?.length) return;
        setSelectedWorkflow((prev) => {
            if (prev?._id === workflowIdParam) return prev;
            return dashboard.workflows.find((w) => w._id === workflowIdParam) || prev;
        });
    }, [workflowIdParam, dashboard]);

    const refreshWorkflow = useCallback(async () => {
        await fetchDashboard({ soft: true });
    }, [fetchDashboard]);

    const updateWorkflowSchedule = useCallback(async (workflowId, payload) => {
        try {
            setSubmitting(true);
            const res = await axios.put(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${workflowId}`,
                payload,
                { withCredentials: true },
            );
            if (res.data?.data) {
                setSelectedWorkflow(res.data.data);
                setDashboard((prev) => {
                    if (!prev?.workflows) return prev;
                    return {
                        ...prev,
                        workflows: prev.workflows.map((w) => (
                            w._id === workflowId ? res.data.data : w
                        )),
                    };
                });
            } else {
                await refreshWorkflow();
            }
            toast.success('Schedule updated');
            return true;
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update schedule');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [refreshWorkflow]);

    const wf = selectedWorkflow;
    const breakdown = wf?.progressBreakdown || {};

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

        let debounceTimer;
        const handleOnboardingChanged = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchDashboard({ soft: true }), 400);
        };
        socket.on('onboarding:changed', handleOnboardingChanged);

        return () => {
            clearTimeout(debounceTimer);
            socket.off('onboarding:changed', handleOnboardingChanged);
            socket.disconnect();
        };
    }, [fetchDashboard]);

    const workflowEmployeeId = wf?.employeeId?._id?.toString() || wf?.employeeId?.toString();
    const isOnboardingEmployee = Boolean(workflowEmployeeId && myEmployeeId && workflowEmployeeId === myEmployeeId);

    const canActOnTask = (task) => {
        const assigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        if (isHRView) return true;
        if (assigneeId && myEmployeeId && assigneeId === myEmployeeId) return true;
        if (task.assigneeRole === 'employee' && isOnboardingEmployee) return true;
        if (task.assigneeRole === 'manager') {
            return wf?.assignedManager?._id?.toString() === myEmployeeId;
        }
        if (task.assigneeRole === 'buddy') {
            return wf?.assignedBuddy?._id?.toString() === myEmployeeId;
        }
        return false;
    };

    const canActOnChecklist = (item) => {
        if (isHRView) return true;
        const role = item.assignedRole || 'employee';
        if (role === 'employee') return isOnboardingEmployee;
        if (role === 'manager') {
            return wf?.assignedManager?._id?.toString() === myEmployeeId;
        }
        if (role === 'buddy') {
            return wf?.assignedBuddy?._id?.toString() === myEmployeeId;
        }
        return (wf?.tasks || []).some((task) => {
            const assigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
            return task.assigneeRole === role && assigneeId === myEmployeeId;
        });
    };

    const visibleTasks = useMemo(() => {
        if (!wf?.tasks) return [];
        const gated = filterByFeature(wf.tasks);
        if (isHRView) return gated;
        return gated.filter((t) => {
            const assigneeId = t.assignedTo?._id?.toString() || t.assignedTo?.toString();
            return assigneeId === myEmployeeId || t.assigneeRole === 'employee';
        });
    }, [wf, isHRView, myEmployeeId, filterByFeature]);

    const useEmployeeOnboardingApi = !isHRView || isOnboardingEmployee;

    const openTaskAction = (task) => {
        const route = TASK_ACTION_ROUTES[task?.title];
        if (route) {
            navigate(route);
            return;
        }
        const sectionId = TASK_ACTION_SECTIONS[task?.title];
        if (!sectionId) return;
        requestAnimationFrame(() => {
            document.getElementById(sectionId)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        });
    };

    const updateTask = async (taskId, status) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = useEmployeeOnboardingApi ? BOTH_ONBOARDING_ENDPOINT : ADMIN_ONBOARDING_ENDPOINT;
            const path = useEmployeeOnboardingApi
                ? `${base}/workflow/${wf._id}/tasks/${taskId}`
                : `${base}/onboarding/${wf._id}/tasks/${taskId}`;
            const response = await axios.put(path, { status }, { withCredentials: true });
            const updatedWorkflow = response.data?.data;
            if (updatedWorkflow) {
                setSelectedWorkflow(updatedWorkflow);
                setDashboard((previous) => ({
                    ...previous,
                    workflows: (previous?.workflows || []).map((workflow) =>
                        workflow._id === updatedWorkflow._id ? updatedWorkflow : workflow),
                }));
            }
            toast.success(status === 'In Progress' ? 'Task started' : status === 'Completed' ? 'Task completed' : 'Task updated');
            if (status === 'In Progress') {
                const task = (updatedWorkflow?.tasks || wf.tasks || []).find((item) => item._id === taskId);
                openTaskAction(task);
            }
        } catch (err) {
            const blockers = err.response?.data?.blockers;
            if (blockers?.length) {
                toast.error(blockers.join(' · '));
            } else {
                toast.error(err.response?.data?.message || 'Failed to update task');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const performWorkflowAction = async (action) => {
        if (!wf || !isHRView) return;
        try {
            setSubmitting(true);
            const response = await axios.post(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/actions/${action}`,
                {},
                { withCredentials: true }
            );
            const updatedWorkflow = response.data?.data;
            if (updatedWorkflow) {
                setSelectedWorkflow(updatedWorkflow);
                setDashboard((previous) => ({
                    ...previous,
                    workflows: (previous?.workflows || []).map((workflow) =>
                        workflow._id === updatedWorkflow._id ? updatedWorkflow : workflow),
                }));
            }
            toast.success(response.data?.message || `Workflow ${action}d`);
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to ${action} workflow`);
        } finally {
            setSubmitting(false);
        }
    };

    const toggleChecklist = async (itemId, completed) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = useEmployeeOnboardingApi ? BOTH_ONBOARDING_ENDPOINT : ADMIN_ONBOARDING_ENDPOINT;
            const path = useEmployeeOnboardingApi
                ? `${base}/workflow/${wf._id}/checklist/${itemId}`
                : `${base}/onboarding/${wf._id}/checklist/${itemId}`;
            await axios.put(path, { completed }, { withCredentials: true });
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update checklist');
        } finally {
            setSubmitting(false);
        }
    };

    const addNote = async () => {
        if (!wf || !newNote.trim()) return;
        try {
            await axios.post(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/notes`,
                { note: newNote, visibility: 'internal' }, { withCredentials: true });
            setNewNote('');
            toast.success('Note added');
            await refreshWorkflow();
        } catch {
            toast.error('Failed to add note');
        }
    };

    const createWorkflow = async (e) => {
        e.preventDefault();
        if (!createForm.employeeId) return toast.error('Select an employee');
        try {
            setSubmitting(true);
            const res = await axios.post(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding`, createForm, { withCredentials: true });
            toast.success(res.data?.updated ? 'Workflow updated successfully' : 'Workflow created successfully');
            setShowCreateModal(false);
            setCreateForm({
                employeeId: '', templateId: '', assignedHR: '', assignedBuddy: '',
                assignedManager: '', welcomeMessage: '', joiningDate: '', scheduledStartDate: '',
                expectedCompletionDate: '',
                saveAsDraft: false,
            });
            await fetchDashboard();
            if (res.data?.data) setSelectedWorkflow(res.data.data);
        } catch (err) {
            const msg = err.response?.data?.message;
            if (err.response?.status === 503 || err.code === 'SERVICE_UNAVAILABLE') {
                toast.error('Backend unavailable — ensure the server is running on port 10000');
            } else {
                toast.error(msg || 'Failed to create workflow');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const filteredWorkflows = (dashboard?.workflows || []).filter((w) => {
        const name = w.employeeId?.name?.toLowerCase() || '';
        const email = w.employeeId?.email?.toLowerCase() || '';
        const matchSearch = !searchTerm || name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'all' || w.status === statusFilter;
        return Boolean(w.employeeId?.name) && matchSearch && matchStatus;
    });

    const offerAcceptanceRate = dashboard?.stats?.totalJoinings
        ? Math.round(((dashboard.stats.active ?? 0) / dashboard.stats.totalJoinings) * 100)
        : 0;

    const avgOnboardingDays = useMemo(() => {
        const completed = (dashboard?.workflows || []).filter((w) =>
            w.status === 'Completed' && w.actualCompletionDate && w.createdAt);
        if (!completed.length) return null;
        const totalDays = completed.reduce((sum, w) => {
            const days = (new Date(w.actualCompletionDate) - new Date(w.createdAt)) / 86400000;
            return sum + Math.max(days, 0);
        }, 0);
        return (totalDays / completed.length).toFixed(1);
    }, [dashboard]);

    const openWorkflow = (workflow) => {
        setSelectedWorkflow(workflow);
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('id', workflow._id);
            return next;
        });
        requestAnimationFrame(() => {
            detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const closeWorkflow = () => {
        setSelectedWorkflow(null);
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.delete('id');
            return next;
        });
    };

    const deleteWorkflow = async (workflow) => {
        const employeeName = [workflow.employeeId?.name, workflow.employeeId?.lastName]
            .filter(Boolean).join(' ') || 'this employee';
        // Confirmation prevents accidental permanent workflow deletion.
        // eslint-disable-next-line no-alert
        if (!window.confirm(`Delete onboarding workflow for ${employeeName}? This cannot be undone.`)) return;

        try {
            setSubmitting(true);
            await axios.delete(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${workflow._id}`,
                { withCredentials: true }
            );

            setDashboard((prev) => ({
                ...prev,
                workflows: (prev?.workflows || []).filter((item) => item._id !== workflow._id),
            }));
            if (selectedWorkflow?._id === workflow._id) {
                setSelectedWorkflow(null);
            }
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                if (next.get('id') === workflow._id) next.delete('id');
                return next;
            });
            toast.success('Onboarding workflow deleted');
            await fetchDashboard({ soft: true });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete workflow');
        } finally {
            setSubmitting(false);
        }
    };

    const roleLabel = isHRView
        ? 'HR Dashboard'
        : isManagerView
            ? 'My Team'
            : 'My Onboarding';
    const sectionCardClass = isHRView ? 'cm-card' : 'bg-white rounded-xl shadow-md p-6';
    const sectionTitleClass = isHRView
        ? 'cm-title-sm mb-4 flex items-center gap-2'
        : 'text-lg font-bold flex items-center gap-2 mb-4';

    const resolveAssigneeName = (field) => {
        if (!field) return null;
        if (typeof field === 'object' && field.name) {
            return [field.name, field.lastName].filter(Boolean).join(' ').trim() || field.name;
        }
        const id = field._id || field;
        const match = employees.find((e) => (e._id || e.id)?.toString() === id?.toString());
        return match ? [match.name, match.lastName].filter(Boolean).join(' ').trim() : null;
    };

    const toggleTaskGroup = (key) => {
        setExpandedTaskGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setDetailTab = (tabId) => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            if (tabId && tabId !== 'overview') next.set('detailTab', tabId);
            else next.delete('detailTab');
            return next;
        });
    };

    const tasksByRole = useMemo(() => {
        if (!wf?.tasks) return {};
        const gated = filterByFeature(wf.tasks);
        const groups = {};
        for (const g of TASK_GROUPS_BY_ROLE) {
            groups[g.key] = gated.filter((t) => (t.assigneeRole || 'employee') === g.key);
        }
        return groups;
    }, [wf, filterByFeature]);

    useEffect(() => {
        if (!wf) return;
        if (viewerRole === 'employee') {
            setExpandedTaskGroups(new Set(['_all']));
            return;
        }
        const gated = filterByFeature(wf.tasks || []);
        const firstWithTasks = TASK_GROUPS_BY_ROLE.find((g) =>
            gated.some((t) => (t.assigneeRole || 'employee') === g.key));
        setExpandedTaskGroups(new Set([firstWithTasks?.key || 'employee']));
    }, [wf?._id, viewerRole, wf?.tasks?.length, filterByFeature]);

    const updateAsset = async (assetId, payload) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            await axios.put(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/assets/${assetId}`, payload, { withCredentials: true });
            toast.success('Asset updated');
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update asset');
        } finally {
            setSubmitting(false);
        }
    };

    const completeTraining = async (trainingId) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = useEmployeeOnboardingApi ? BOTH_ONBOARDING_ENDPOINT : ADMIN_ONBOARDING_ENDPOINT;
            const path = useEmployeeOnboardingApi
                ? `${base}/workflow/${wf._id}/training/${trainingId}`
                : `${base}/onboarding/${wf._id}/training/${trainingId}`;
            await axios.put(path, { status: 'Completed' }, { withCredentials: true });
            toast.success('Training marked complete');
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update training');
        } finally {
            setSubmitting(false);
        }
    };

    const signPolicy = async (signatureId) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            await axios.post(`${BOTH_ONBOARDING_ENDPOINT}/workflow/${wf._id}/signatures/${signatureId}/sign`,
                { acknowledgment: `Signed by ${employee?.name || user?.name || 'Employee'} on ${new Date().toISOString()}` },
                { withCredentials: true });
            toast.success('Policy signed');
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to sign policy');
        } finally {
            setSubmitting(false);
        }
    };

    const updateCheckin = async (checkinId, payload) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = isHRView ? ADMIN_ONBOARDING_ENDPOINT : BOTH_ONBOARDING_ENDPOINT;
            const path = isHRView
                ? `${base}/onboarding/${wf._id}/buddy-checkins/${checkinId}`
                : `${base}/workflow/${wf._id}/buddy-checkins/${checkinId}`;
            await axios.put(path, payload, { withCredentials: true });
            toast.success('Check-in updated');
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update check-in');
        } finally {
            setSubmitting(false);
        }
    };

    const updateManagerActionItem = async (actionId, payload) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = isHRView ? ADMIN_ONBOARDING_ENDPOINT : BOTH_ONBOARDING_ENDPOINT;
            const path = isHRView
                ? `${base}/onboarding/${wf._id}/manager-actions/${actionId}`
                : `${base}/workflow/${wf._id}/manager-actions/${actionId}`;
            await axios.put(path, payload, { withCredentials: true });
            toast.success('Action updated');
            await refreshWorkflow();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update action');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading onboarding..." />;

    /* ── Employee with no workflow, or unpublished draft only ── */
    if (!isHRView && !isManagerView && !loading && (!wf || wf?.status === 'Draft')) {
        return (
            <div className="page-shell min-h-screen bg-gray-50">
                <div className="page-shell-inner space-y-4">
                    {showRoleToggles && (
                        <div className="flex justify-end">
                            <div className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1" role="tablist" aria-label="Onboarding view">
                                <button type="button" role="tab" aria-selected onClick={() => setLifecycleView('self')}
                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-theme-primary shadow-sm sm:text-sm">
                                    Self
                                </button>
                                {canViewTeam && (
                                    <button type="button" role="tab" onClick={() => setLifecycleView('team')}
                                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 sm:text-sm">
                                        My Team
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="bg-white rounded-xl shadow-md p-10 text-center">
                        <FaCalendarAlt className="mx-auto text-6xl text-indigo-300 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {!wf ? 'No Onboarding Workflow' : 'Onboarding Being Prepared'}
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {!wf
                                ? 'Your HR team will set up onboarding before your joining date. Contact HR if you have questions.'
                                : 'HR is still preparing your onboarding. It will appear here once published.'}
                        </p>
                        <button onClick={() => navigate('/dashboard-employee')}
                            className="px-6 py-2 bg-theme-secondary text-white rounded-lg">Go to Dashboard</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`page-shell min-h-screen bg-gray-50 ${(isHRView || wf) ? 'cm-hrms' : ''}`}>
            <div className="page-shell-inner hrms-stack pb-10">

                {/* ── Header ── */}
                {!wf && (
                <header className={isHRView ? 'cm-card flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between' : 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'}>
                    <div className="min-w-0">
                        <p className={isHRView ? 'cm-label' : 'text-sm font-medium text-theme-secondary'}>{roleLabel}</p>
                        <h1 className={isHRView ? 'cm-title mt-1' : 'mt-1 text-2xl font-bold leading-tight text-gray-800 sm:text-3xl'}>
                            {isHRView
                                ? 'Onboarding Hub'
                                : isManagerView
                                    ? 'My Team'
                                    : 'My Onboarding Journey'}
                        </h1>
                        {isManagerView && !wf && (
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 sm:text-base">
                                Direct reports who are currently onboarding.
                            </p>
                        )}
                        {isHRView && !wf && (
                            <p className="cm-subtitle mt-2 max-w-2xl sm:text-base">
                                Plan and track every new hire&apos;s onboarding journey in one place
                            </p>
                        )}
                        {wf && isPersonalView && (
                            <p className="mt-2 text-sm leading-relaxed text-gray-500 sm:text-base">
                                Welcome, {wf.employeeId?.name}! Track your joining progress below
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:items-end">
                        {!isHRView && showRoleToggles && (
                            <div
                                className="inline-flex flex-wrap rounded-xl bg-gray-100 p-1"
                                role="tablist"
                                aria-label="Onboarding view"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isPersonalView}
                                    onClick={() => setLifecycleView('self')}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                                        isPersonalView
                                            ? 'bg-white text-theme-primary shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    Self
                                </button>
                                {canViewTeam && (
                                    <button
                                        type="button"
                                        role="tab"
                                        aria-selected={isManagerView}
                                        onClick={() => setLifecycleView('team')}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                                            isManagerView
                                                ? 'bg-white text-theme-primary shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        My Team
                                    </button>
                                )}
                            </div>
                        )}
                        {isHRView && !wf && (
                            <CmButton variant="inverted" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
                                <FaUserPlus className="shrink-0 text-base" />
                                <span>Onboard New Employee</span>
                            </CmButton>
                        )}
                    </div>
                </header>
                )}

                {!wf && !isHRView && isManagerView && dashboard?.stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Assigned Employees', value: dashboard.stats.assignedEmployees },
                            { label: 'Pending Reviews', value: dashboard.stats.pendingReviews },
                            { label: 'Pending Induction', value: dashboard.stats.pendingInduction },
                            { label: 'Pending Goals', value: dashboard.stats.pendingGoals },
                            { label: 'Team Progress', value: `${dashboard.stats.teamAverageProgress ?? 0}%` },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-xl bg-indigo-50 p-3 text-center">
                                <div className="text-2xl font-bold text-indigo-600">{stat.value ?? 0}</div>
                                <div className="text-xs text-gray-600">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Employee Workflow Table (HR — Onboarding Hub list) ── */}
                {!wf && isHRView && (
                    <div className="space-y-4">
                        {/* <div className="cm-banner cm-banner--attention">
                            Pre-boarding portal covers offer-accept only — document/bank/forms upload requires full portal (P0 gap)
                        </div> */}

                        {dashboard?.stats && (
                            <div className="cm-kpi-row cm-kpi-row--3">
                                <CmStat
                                    label="Pending Actions"
                                    value={(dashboard.stats.pendingDocuments ?? 0) + (dashboard.stats.pendingVerifications ?? 0)}
                                    attention={((dashboard.stats.pendingDocuments ?? 0) + (dashboard.stats.pendingVerifications ?? 0)) > 0}
                                    meta={`${dashboard.stats.pendingDocuments ?? 0} docs · ${dashboard.stats.pendingVerifications ?? 0} verifications`}
                                />
                                <CmStat
                                    label="Offer Acceptance Rate"
                                    value={`${offerAcceptanceRate}%`}
                                    meta={`${dashboard.stats.upcomingJoinings ?? 0} upcoming joiners`}
                                />
                                <CmStat
                                    label="Avg. Onboarding Time"
                                    value={avgOnboardingDays != null ? `${avgOnboardingDays} Days` : '—'}
                                    meta={`${dashboard.stats.completedThisMonth ?? 0} completed this month`}
                                />
                            </div>
                        )}

                        <div className="cm-card">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-5">
                                <div className="flex-1">
                                    <CmSearch
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by employee name or email..."
                                    />
                                </div>
                                <div className="hrms-chip-scroll">
                                    <div className="hrms-chip-scroll-track" aria-label="Filter workflows by status">
                                        {['all', ...WORKFLOW_STATUSES].map((status) => (
                                            <div key={status} className="hrms-chip-scroll-item">
                                                <button type="button" onClick={() => setStatusFilter(status)}
                                                    className={`cm-chip ${statusFilter === status ? 'cm-chip--active' : ''}`}>
                                                    {status === 'all' ? 'All' : status}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {filteredWorkflows.length === 0 ? (
                                <CmEmpty title="No workflows found">Create one to get started.</CmEmpty>
                            ) : (
                                <>
                                    <div className="space-y-3 sm:hidden">
                                        {filteredWorkflows.map((w) => {
                                            const progress = Math.max(0, Math.min(100, Number(w.progress) || 0));
                                            const fullName = `${w.employeeId?.name || ''} ${w.employeeId?.lastName || ''}`.trim();
                                            const bankTask = (w.tasks || []).find((t) => /bank/i.test(t.title || ''));
                                            const bgvTask = (w.tasks || []).find((t) => /bgv|background.?verif/i.test(`${t.title || ''} ${t.category || ''}`));
                                            const bankTone = bankTask ? statusTone(bankTask.status) : 'neutral';
                                            const bankLabel = bankTask ? (bankTask.status === 'Completed' ? 'Completed' : bankTask.status) : 'Pending';
                                            const bgvTone = bgvTask ? statusTone(bgvTask.status) : 'neutral';
                                            const bgvLabel = bgvTask ? (bgvTask.status === 'Completed' ? 'Completed' : bgvTask.status) : 'Pending';
                                            const completedCount = w.tasks?.filter((task) => task.status === 'Completed').length || 0;
                                            const totalCount = w.tasks?.length || 0;
                                            return (
                                                <article
                                                    key={w._id}
                                                    onClick={() => openWorkflow(w)}
                                                    className="rounded-2xl border border-[rgba(187,202,193,0.35)] bg-white p-4 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <CmPerson
                                                            name={fullName}
                                                            meta={w.employeeId?.jobTitle || w.employeeId?.department || ''}
                                                        />
                                                        <CmBadge tone={statusTone(w.status)} dot={false}>{w.status}</CmBadge>
                                                    </div>
                                                    <div className="mt-4 flex items-center gap-3">
                                                        <CmRing value={progress} size={42} attention={w.status === 'Overdue'} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-[var(--cm-on-surface)]">Progress</p>
                                                            <p className="text-xs text-[var(--cm-muted)]">{completedCount}/{totalCount} tasks completed</p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                                        <div>
                                                            <p className="cm-label mb-1">Banking</p>
                                                            <CmBadge tone={bankTone}>{bankLabel}</CmBadge>
                                                        </div>
                                                        <div>
                                                            <p className="cm-label mb-1">Verification</p>
                                                            <CmBadge tone={bgvTone}>{bgvLabel}</CmBadge>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <p className="cm-label mb-1">Join date</p>
                                                            <p className="text-sm text-[var(--cm-on-surface)]">
                                                                {w.joiningDate ? format(new Date(w.joiningDate), 'MMM dd, yyyy') : '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex items-center justify-between gap-3">
                                                        <CmButton variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); openWorkflow(w); }}>
                                                            View details
                                                        </CmButton>
                                                        <button type="button"
                                                            onClick={(e) => { e.stopPropagation(); deleteWorkflow(w); }}
                                                            disabled={submitting}
                                                            aria-label={`Delete ${w.employeeId?.name || 'employee'} workflow`}
                                                            className="cm-link cm-link--attention">
                                                            <FaTrash />
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>

                                    <div className="hidden sm:block cm-table-wrap">
                                        <table className="cm-table">
                                            <thead>
                                                <tr>
                                                    <th>Candidate</th>
                                                    <th>Status</th>
                                                    <th>Progress</th>
                                                    <th>Banking</th>
                                                    <th>Verification</th>
                                                    <th>Actions</th>
                                                    <th>Join date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredWorkflows.map((w) => {
                                                    const progress = Math.max(0, Math.min(100, Number(w.progress) || 0));
                                                    const isSelected = selectedWorkflow?._id === w._id;
                                                    const fullName = `${w.employeeId?.name || ''} ${w.employeeId?.lastName || ''}`.trim();
                                                    const bankTask = (w.tasks || []).find((t) => /bank/i.test(t.title || ''));
                                                    const bgvTask = (w.tasks || []).find((t) => /bgv|background.?verif/i.test(`${t.title || ''} ${t.category || ''}`));
                                                    const bankTone = bankTask ? statusTone(bankTask.status) : 'neutral';
                                                    const bankLabel = bankTask ? (bankTask.status === 'Completed' ? 'Completed' : bankTask.status) : 'Pending';
                                                    const bgvTone = bgvTask ? statusTone(bgvTask.status) : 'neutral';
                                                    const bgvLabel = bgvTask ? (bgvTask.status === 'Completed' ? 'Completed' : bgvTask.status) : 'Pending';
                                                    return (
                                                        <tr
                                                            key={w._id}
                                                            onClick={() => openWorkflow(w)}
                                                            className={`cursor-pointer ${isSelected ? 'bg-[rgba(28,202,155,0.06)]' : ''}`}
                                                        >
                                                            <td>
                                                                <CmPerson name={fullName} meta={w.employeeId?.jobTitle || w.employeeId?.department || ''} />
                                                            </td>
                                                            <td>
                                                                <CmBadge tone={statusTone(w.status)}>{w.status}</CmBadge>
                                                            </td>
                                                            <td>
                                                                <div className="flex items-center gap-3">
                                                                    <CmRing value={progress} size={36} attention={w.status === 'Overdue'} />
                                                                    <span className="text-xs text-[var(--cm-muted)]">
                                                                        {w.tasks?.filter((task) => task.status === 'Completed').length || 0}/{w.tasks?.length || 0} tasks
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <CmBadge tone={bankTone}>{bankLabel}</CmBadge>
                                                            </td>
                                                            <td>
                                                                <CmBadge tone={bgvTone}>{bgvLabel}</CmBadge>
                                                            </td>
                                                            <td onClick={(e) => e.stopPropagation()}>
                                                                <button type="button"
                                                                    onClick={() => deleteWorkflow(w)}
                                                                    disabled={submitting}
                                                                    aria-label={`Delete ${w.employeeId?.name || 'employee'} workflow`}
                                                                    className="cm-link cm-link--attention">
                                                                    <FaTrash />
                                                                </button>
                                                            </td>
                                                            <td className="text-sm">
                                                                {w.joiningDate ? format(new Date(w.joiningDate), 'MMM dd, yyyy') : '—'}
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
                                        Showing {filteredWorkflows.length} of {dashboard?.stats?.totalJoinings ?? filteredWorkflows.length} candidates
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button type="button" className="cm-icon-btn" aria-label="Previous page" disabled>‹</button>
                                        <button type="button" className="cm-icon-btn" aria-label="Next page" disabled>›</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Employee Workflow Cards (Manager team view) ── */}
                {!wf && !isHRView && isManagerView && (
                    <div>
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="relative flex-1">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input placeholder="Search by employee name or email..." value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white shadow-sm" />
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                                <FaFilter className="shrink-0 text-gray-400" />
                                <div className="hrms-chip-scroll">
                                    <div className="hrms-chip-scroll-track" aria-label="Filter workflows by status">
                                        {['all', ...WORKFLOW_STATUSES].map((status) => (
                                            <div key={status} className="hrms-chip-scroll-item">
                                                <button type="button" onClick={() => setStatusFilter(status)}
                                                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                                                        statusFilter === status
                                                            ? 'border-theme-primary bg-theme-primary text-white shadow-sm'
                                                            : 'border-gray-200 bg-white text-gray-600 hover:border-theme-primary'
                                                    }`}>
                                                    {status === 'all' ? 'All' : status}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredWorkflows.map((w) => {
                                const totalTasks = w.tasks?.length || 0;
                                const completedTasks = w.tasks?.filter((task) => task.status === 'Completed').length || 0;
                                const progress = Math.max(0, Math.min(100, Number(w.progress) || 0));
                                const isSelected = selectedWorkflow?._id === w._id;
                                const statusClass = w.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : w.status === 'Overdue'
                                        ? 'bg-red-50 text-red-700'
                                        : w.status === 'In Progress'
                                            ? 'bg-blue-50 text-blue-700'
                                            : w.status === 'Scheduled'
                                                ? 'bg-indigo-50 text-indigo-700'
                                                : 'bg-amber-50 text-amber-700';
                                const progressBarClass = w.status === 'Completed'
                                    ? 'bg-emerald-500'
                                    : w.status === 'Overdue'
                                        ? 'bg-red-500'
                                        : 'bg-theme-primary';

                                return (
                                    <article key={w._id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openWorkflow(w)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                openWorkflow(w);
                                            }
                                        }}
                                        className={`rounded-xl border bg-white p-5 shadow-sm transition hover:shadow-md cursor-pointer ${
                                            isSelected ? 'border-theme-primary ring-2 ring-theme-primary/20' : 'border-gray-100'
                                        }`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="truncate font-semibold text-gray-800">
                                                {w.employeeId?.name} {w.employeeId?.lastName || ''}
                                            </h3>
                                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}>
                                                {w.status}
                                            </span>
                                        </div>

                                        <div className="mt-4">
                                            <div className="mb-1.5 flex justify-between text-xs text-gray-500">
                                                <span>Progress</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                                                <div className={`h-full rounded-full transition-all ${progressBarClass}`}
                                                    style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                            <FaTasks className="text-gray-400" />
                                            <span>{completedTasks}/{totalTasks} Tasks</span>
                                        </div>

                                        <div className="mt-4 flex gap-2">
                                            <button type="button"
                                                onClick={(e) => { e.stopPropagation(); openWorkflow(w); }}
                                                className="flex-1 rounded-lg bg-theme-secondary px-3 py-2.5 text-sm font-medium text-white hover:bg-theme-primary">
                                                View Details
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                            {filteredWorkflows.length === 0 && (
                                <p className="col-span-full py-10 text-center text-sm text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                                    No direct reports are currently onboarding.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {wf && (
                    <OnboardingHrDetailView
                        wf={wf}
                        breakdown={breakdown}
                        tasksByRole={tasksByRole}
                        visibleTasks={visibleTasks}
                        viewerRole={viewerRole}
                        isManagerView={isManagerView}
                        detailTab={detailTab}
                        onDetailTabChange={setDetailTab}
                        detailSectionRef={detailSectionRef}
                        closeWorkflow={closeWorkflow}
                        performWorkflowAction={performWorkflowAction}
                        setShowCancelConfirm={setShowCancelConfirm}
                        submitting={submitting}
                        expandedTaskGroups={expandedTaskGroups}
                        toggleTaskGroup={toggleTaskGroup}
                        updateTask={updateTask}
                        canActOnTask={canActOnTask}
                        openTaskAction={openTaskAction}
                        updateAsset={updateAsset}
                        newNote={newNote}
                        setNewNote={setNewNote}
                        addNote={addNote}
                        navigate={navigate}
                        isFeatureEnabled={isFeatureEnabled}
                        filterByFeature={filterByFeature}
                        refreshWorkflow={refreshWorkflow}
                        updateWorkflowSchedule={updateWorkflowSchedule}
                                isOnboardingEmployee={isOnboardingEmployee}
                        completeTraining={completeTraining}
                    />
                )}
            </div>

            {/* Create Workflow Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-1">Start Employee Onboarding</h3>
                        <p className="text-sm text-gray-500 mb-4">Select employee, template, assignees, and joining date. Workflow stays Scheduled until joining date.</p>
                        <form onSubmit={createWorkflow} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Employee *</label>
                                <select required className="w-full p-2 border rounded-lg mt-1" value={createForm.employeeId}
                                    onChange={(e) => {
                                        const employeeId = e.target.value;
                                        const emp = employees.find((row) => String(row._id || row.id) === String(employeeId));
                                        const rawJoin = emp?.joiningDate || emp?.dateOfJoining || null;
                                        let joiningDate = '';
                                        if (rawJoin) {
                                            const parsed = new Date(rawJoin);
                                            if (!Number.isNaN(parsed.getTime())) {
                                                joiningDate = format(parsed, 'yyyy-MM-dd');
                                            }
                                        }
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
                                        setCreateForm((prev) => ({
                                            ...prev,
                                            employeeId,
                                            // Autofill only joining date + manager from employee profile
                                            joiningDate,
                                            assignedManager,
                                        }));
                                    }}>
                                    <option value="">Select employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName} ({emp.email})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Onboarding Template</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={createForm.templateId}
                                    onChange={(e) => setCreateForm({ ...createForm, templateId: e.target.value })}>
                                    <option value="">Default template</option>
                                    {templates.map((t) => (
                                        <option key={t._id} value={t._id}>{t.name}{t.isDefault ? ' (Default)' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">Joining Date *</label>
                                    <input type="date" required className="w-full p-2 border rounded-lg mt-1"
                                        value={createForm.joiningDate}
                                        onChange={(e) => {
                                            const joiningDate = e.target.value;
                                            const base = joiningDate ? new Date(joiningDate) : null;
                                            let expectedCompletionDate = createForm.expectedCompletionDate;
                                            if (base && !Number.isNaN(base.getTime())) {
                                                const suggested = new Date(base);
                                                suggested.setDate(suggested.getDate() + 30);
                                                expectedCompletionDate = suggested.toISOString().slice(0, 10);
                                            }
                                            setCreateForm({
                                                ...createForm,
                                                joiningDate,
                                                scheduledStartDate: createForm.scheduledStartDate || joiningDate,
                                                expectedCompletionDate,
                                            });
                                        }} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Start Date</label>
                                    <input type="date" className="w-full p-2 border rounded-lg mt-1"
                                        value={createForm.scheduledStartDate}
                                        onChange={(e) => setCreateForm({ ...createForm, scheduledStartDate: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Task completion date</label>
                                <p className="text-xs text-gray-500 mt-0.5 mb-1">Target date for finishing all onboarding tasks.</p>
                                <input
                                    type="date"
                                    className="w-full p-2 border rounded-lg"
                                    value={createForm.expectedCompletionDate}
                                    onChange={(e) => setCreateForm({ ...createForm, expectedCompletionDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Assigned Manager</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={createForm.assignedManager}
                                    onChange={(e) => setCreateForm({ ...createForm, assignedManager: e.target.value })}>
                                    <option value="">From employee profile</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Assigned HR</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={createForm.assignedHR}
                                    onChange={(e) => setCreateForm({ ...createForm, assignedHR: e.target.value })}>
                                    <option value="">Auto-assign</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Buddy</label>
                                <select className="w-full p-2 border rounded-lg mt-1" value={createForm.assignedBuddy}
                                    onChange={(e) => setCreateForm({ ...createForm, assignedBuddy: e.target.value })}>
                                    <option value="">None</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Welcome Message</label>
                                <textarea className="w-full p-2 border rounded-lg mt-1" rows={2}
                                    value={createForm.welcomeMessage}
                                    onChange={(e) => setCreateForm({ ...createForm, welcomeMessage: e.target.value })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={createForm.saveAsDraft}
                                    onChange={(e) => setCreateForm({ ...createForm, saveAsDraft: e.target.checked })} />
                                Save as draft (don&apos;t notify yet)
                            </label>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 border rounded-lg">Cancel</button>
                                <button type="submit" disabled={submitting}
                                    className="px-4 py-2 bg-theme-primary text-white rounded-lg disabled:opacity-50">
                                    {submitting ? 'Creating...' : createForm.saveAsDraft ? 'Save Draft' : 'Create Workflow'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showCancelConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-gray-900">Cancel onboarding workflow?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This stops the workflow permanently. Completed workflows cannot be restored from this action.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowCancelConfirm(false)}
                                className="rounded-lg border px-4 py-2 text-sm">Keep Workflow</button>
                            <button type="button" disabled={submitting}
                                onClick={async () => {
                                    await performWorkflowAction('cancel');
                                    setShowCancelConfirm(false);
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                                Cancel Workflow
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OnboardingHub;
