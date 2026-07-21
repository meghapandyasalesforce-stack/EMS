import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import {
    ADMIN_ONBOARDING_ENDPOINT, BOTH_ONBOARDING_ENDPOINT, BOTH_DOCUMENTS_ENDPOINT,
} from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isHR } from '../../utils/managerHelper';
import { useEmployees } from '../../Hooks/useDashboardData';
import {
    ONBOARDING_DOCUMENT_TYPES, TIMELINE_PHASES, ONBOARDING_TIMELINE_ROADMAP,
    TASK_STATUS_COLORS, DOC_STATUS_COLORS, WORKFLOW_STATUSES, TASK_GROUPS_BY_ROLE,
    ASSET_STATUSES, getTaskCompletionBlockers, canCompleteTask,
} from '../../constants/onboardingConstants';
import {
    FaUserPlus, FaCheckCircle, FaTasks, FaFileAlt, FaClock, FaLaptop,
    FaUser, FaChartLine, FaHistory, FaStickyNote, FaUpload, FaGraduationCap,
    FaCheck, FaTimes, FaSpinner, FaSearch, FaPen, FaCalendarAlt,
} from 'react-icons/fa';

const ProgressRing = ({ value, label, color = 'var(--color-primary)' }) => (
    <div className="text-center">
        <div className="relative w-20 h-20 mx-auto">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={color} strokeWidth="3"
                    strokeDasharray={`${value} 100`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{value}%</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
);

const OnboardingHub = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((s) => s.auth.user);
    const employee = useSelector((s) => s.employeeDetails.employee);
    const userObj = user || employee;
    const isAdmin = user?.role === 'admin';
    const userIsHR = isHR(userObj);
    const isManagerView = searchParams.get('view') === 'team';
    const isBuddyView = searchParams.get('view') === 'buddy';
    const isHRView = isAdmin || userIsHR;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dashboard, setDashboard] = useState(null);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDocId, setRejectDocId] = useState(null);

    const { data: employeeData = { employees: [] } } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const [createForm, setCreateForm] = useState({
        employeeId: '', templateId: '', assignedHR: '', assignedBuddy: '',
        assignedManager: '', welcomeMessage: '', joiningDate: '', scheduledStartDate: '',
        saveAsDraft: false,
    });

    const templates = dashboard?.templates || [];

    const apiBase = isHRView ? ADMIN_ONBOARDING_ENDPOINT : BOTH_ONBOARDING_ENDPOINT;

    const fetchDashboard = useCallback(async () => {
        try {
            setLoading(true);

            if (!isHRView) {
                try {
                    const res = await axios.get(`${BOTH_ONBOARDING_ENDPOINT}/my-workflow`, { withCredentials: true });
                    if (res.data?.data) {
                        setSelectedWorkflow(res.data.data);
                        setDashboard({ workflows: [res.data.data], stats: {} });
                        return;
                    }
                } catch (err) {
                    if (err.response?.status === 404) {
                        setDashboard({ workflows: [], stats: {} });
                        setSelectedWorkflow(null);
                        return;
                    }
                    throw err;
                }
            }

            const view = isHRView ? (isManagerView ? 'team' : 'all') : undefined;
            const url = isHRView
                ? `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/dashboard${view ? `?view=${view}` : ''}`
                : `${BOTH_ONBOARDING_ENDPOINT}/dashboard`;
            const res = await axios.get(url, { withCredentials: true });
            const data = res.data?.data;
            setDashboard(data);

            const workflowId = searchParams.get('id');
            if (workflowId && data?.workflows) {
                const found = data.workflows.find((w) => w._id === workflowId);
                if (found) setSelectedWorkflow(found);
            } else if (!isHRView && data?.workflows?.length === 1) {
                setSelectedWorkflow(data.workflows[0]);
            } else if (isHRView && data?.workflows?.length && !selectedWorkflow) {
                setSelectedWorkflow(data.workflows[0]);
            }
        } catch (err) {
            if (!isHRView && err.response?.status === 404) {
                setDashboard({ workflows: [], stats: {} });
            } else {
                toast.error('Failed to load onboarding data');
            }
        } finally {
            setLoading(false);
        }
    }, [isHRView, isManagerView, searchParams]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

    const refreshWorkflow = async (id) => {
        if (isHRView) {
            const res = await axios.get(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${id}`, { withCredentials: true });
            if (res.data?.data) {
                setSelectedWorkflow(res.data.data);
                setDashboard((prev) => ({
                    ...prev,
                    workflows: (prev?.workflows || []).map((w) => w._id === id ? res.data.data : w),
                }));
            }
        } else {
            const res = await axios.get(`${BOTH_ONBOARDING_ENDPOINT}/my-workflow`, { withCredentials: true });
            if (res.data?.data) {
                setSelectedWorkflow(res.data.data);
                setDashboard({ workflows: [res.data.data], stats: {} });
            }
        }
    };

    const wf = selectedWorkflow;
    const breakdown = wf?.progressBreakdown || {};
    const myEmployeeId = (employee?._id || employee?.id || user?.employeeId)?.toString();
    const workflowEmployeeId = wf?.employeeId?._id?.toString() || wf?.employeeId?.toString();
    const isOnboardingEmployee = Boolean(workflowEmployeeId && myEmployeeId && workflowEmployeeId === myEmployeeId);

    const canActOnTask = (task) => {
        const assigneeId = task.assignedTo?._id?.toString() || task.assignedTo?.toString();
        if (isHRView) {
            return assigneeId && myEmployeeId && assigneeId === myEmployeeId;
        }
        return true;
    };

    const visibleTasks = useMemo(() => {
        if (!wf?.tasks) return [];
        if (isHRView) return wf.tasks;
        return wf.tasks.filter((t) => {
            const assigneeId = t.assignedTo?._id?.toString() || t.assignedTo?.toString();
            return assigneeId === myEmployeeId || t.assigneeRole === 'employee';
        });
    }, [wf, isHRView, myEmployeeId]);

    const useEmployeeOnboardingApi = !isHRView || isOnboardingEmployee;

    const updateTask = async (taskId, status) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            const base = useEmployeeOnboardingApi ? BOTH_ONBOARDING_ENDPOINT : ADMIN_ONBOARDING_ENDPOINT;
            const path = useEmployeeOnboardingApi
                ? `${base}/workflow/${wf._id}/tasks/${taskId}`
                : `${base}/onboarding/${wf._id}/tasks/${taskId}`;
            await axios.put(path, { status }, { withCredentials: true });
            toast.success(status === 'In Progress' ? 'Task started' : status === 'Completed' ? 'Task completed' : 'Task updated');
            await refreshWorkflow(wf._id);
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

    const uploadDocument = async (documentType, file) => {
        if (!wf || !file) return;
        try {
            setSubmitting(true);
            const docMeta = ONBOARDING_DOCUMENT_TYPES.find((d) => d.key === documentType);
            const fd = new FormData();
            fd.append('document', file);
            fd.append('name', docMeta?.label || documentType);
            fd.append('category', 'Employee');
            // Map onboarding keys to job-details types when supported
            const jobTypeMap = {
                AADHAAR: 'AADHAR_CARD',
                PAN: 'PAN_CARD',
                DEGREE: 'DEGREE_CERTIFICATE',
                OFFER_ACK: 'OFFER_LETTER',
                OTHER: 'OTHER',
            };
            if (jobTypeMap[documentType]) {
                fd.append('documentType', jobTypeMap[documentType]);
            }
            const uploadRes = await axios.post(`${BOTH_DOCUMENTS_ENDPOINT}/upload`, fd, {
                withCredentials: true,
            });
            const uploaded = uploadRes.data?.data || uploadRes.data?.document;
            const docUrl = uploaded?.fileUrl || uploadRes.data?.fileUrl;
            if (!docUrl) {
                toast.error('Upload succeeded but file URL missing — contact support');
                return;
            }
            const base = useEmployeeOnboardingApi ? BOTH_ONBOARDING_ENDPOINT : ADMIN_ONBOARDING_ENDPOINT;
            const path = useEmployeeOnboardingApi
                ? `${base}/workflow/${wf._id}/documents`
                : `${base}/onboarding/${wf._id}/documents`;
            await axios.post(path, { documentType, name: file.name, url: docUrl }, { withCredentials: true });
            toast.success('Document uploaded');
            await refreshWorkflow(wf._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setSubmitting(false);
        }
    };

    const verifyDocument = async (docId, status, rejectionReason = '') => {
        if (!wf) return;
        try {
            setSubmitting(true);
            await axios.put(
                `${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/documents/${docId}/verify`,
                { status, rejectionReason },
                { withCredentials: true }
            );
            toast.success(status === 'Rejected' ? 'Document rejected' : 'Document verified');
            setRejectDocId(null);
            await refreshWorkflow(wf._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to verify document');
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
            await refreshWorkflow(wf._id);
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
            await refreshWorkflow(wf._id);
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
        return matchSearch && matchStatus;
    });

    const roleLabel = isHRView ? 'HR Dashboard' : isManagerView ? 'Manager View' : isBuddyView ? 'Buddy View' : 'My Onboarding';

    const tasksByRole = useMemo(() => {
        if (!wf?.tasks) return {};
        const groups = {};
        for (const g of TASK_GROUPS_BY_ROLE) {
            groups[g.key] = wf.tasks.filter((t) => (t.assigneeRole || 'employee') === g.key);
        }
        return groups;
    }, [wf]);

    const updateAsset = async (assetId, payload) => {
        if (!wf) return;
        try {
            setSubmitting(true);
            await axios.put(`${ADMIN_ONBOARDING_ENDPOINT}/onboarding/${wf._id}/assets/${assetId}`, payload, { withCredentials: true });
            toast.success('Asset updated');
            await refreshWorkflow(wf._id);
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
            await axios.put(path, { status: 'Completed', score: 100 }, { withCredentials: true });
            toast.success('Training marked complete');
            await refreshWorkflow(wf._id);
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
            await refreshWorkflow(wf._id);
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
            await refreshWorkflow(wf._id);
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
            await refreshWorkflow(wf._id);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update action');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading onboarding..." />;

    /* ── Employee with no workflow or scheduled ── */
    if (!isHRView && !loading && (!wf || wf?.status === 'Scheduled' || wf?.status === 'Draft')) {
        const scheduledDate = wf?.scheduledStartDate || wf?.joiningDate;
        return (
            <div className="page-shell min-h-screen bg-gray-50">
                <div className="page-shell-inner">
                    <div className="bg-white rounded-xl shadow-md p-10 text-center">
                        <FaCalendarAlt className="mx-auto text-6xl text-indigo-300 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {!wf ? 'No Onboarding Workflow' : 'Onboarding Scheduled'}
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {!wf
                                ? 'Your HR team will set up onboarding before your joining date. Contact HR if you have questions.'
                                : scheduledDate
                                    ? `Your onboarding will begin on ${format(new Date(scheduledDate), 'MMMM dd, yyyy')}.`
                                    : 'Your onboarding is scheduled and will begin on your joining date.'}
                        </p>
                        <button onClick={() => navigate('/dashboard-employee')}
                            className="px-6 py-2 bg-theme-secondary text-white rounded-lg">Go to Dashboard</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-shell min-h-screen bg-gray-50">
            <div className="page-shell-inner hrms-stack pb-10">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <p className="text-sm text-theme-secondary font-medium">{roleLabel}</p>
                        <h1 className="text-3xl font-bold text-gray-800">
                            {isHRView ? 'Employee Onboarding' : 'My Onboarding Journey'}
                        </h1>
                        {wf && !isHRView && (
                            <p className="text-gray-500 mt-1">
                                Welcome, {wf.employeeId?.name}! Track your joining progress below.
                            </p>
                        )}
                    </div>
                    {isHRView && (
                        <button onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary">
                            <FaUserPlus /> Create Workflow
                        </button>
                    )}
                </div>

                {/* ── HR Enhanced Dashboard ── */}
                {isHRView && dashboard?.stats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                        {[
                            { label: "Today's Joinings", value: dashboard.stats.todaysJoinings, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            // { label: 'Upcoming', value: dashboard.stats.upcomingJoinings, color: 'text-purple-600', bg: 'bg-purple-50' },
                            // { label: 'Scheduled', value: dashboard.stats.scheduled, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                            { label: 'Active', value: dashboard.stats.active, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Pending Docs', value: dashboard.stats.pendingDocuments, color: 'text-amber-600', bg: 'bg-amber-50' },
                            // { label: 'Pending HR', value: dashboard.stats.pendingHrTasks, color: 'text-orange-600', bg: 'bg-orange-50' },
                            // { label: 'Pending IT', value: dashboard.stats.pendingItSetup, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                            { label: 'Delayed', value: dashboard.stats.delayedEmployees ?? dashboard.stats.delayed, color: 'text-red-600', bg: 'bg-red-50' },
                            { label: 'Completed (Month)', value: dashboard.stats.completedThisMonth, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                        ].map((s) => (
                            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                                <div className={`text-2xl font-bold ${s.color}`}>{s.value ?? 0}</div>
                                <div className="text-xs text-gray-600">{s.label}</div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── HR Workflow Selector ── */}
                {isHRView && (
                    <div className="bg-white rounded-xl shadow-md p-4">
                        <div className="flex flex-col sm:flex-row gap-3 mb-4">
                            <div className="relative flex-1">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input placeholder="Search employee..." value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg" />
                            </div>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 border rounded-lg">
                                <option value="all">All Status</option>
                                {WORKFLOW_STATUSES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {filteredWorkflows.map((w) => (
                                <button key={w._id} onClick={() => { setSelectedWorkflow(w); setSearchParams({ id: w._id }); }}
                                    className={`shrink-0 px-4 py-2 rounded-lg border text-sm transition ${selectedWorkflow?._id === w._id ? 'border-theme-primary bg-theme-primary/10 text-theme-primary' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <div className="font-medium">{w.employeeId?.name || 'Employee'}</div>
                                    <div className="text-xs text-gray-500">{w.status} · {w.progress || 0}%</div>
                                </button>
                            ))}
                            {filteredWorkflows.length === 0 && (
                                <p className="text-gray-500 text-sm py-2">No workflows found. Create one to get started.</p>
                            )}
                        </div>
                    </div>
                )}

                {wf && (
                    <>
                        {/* ── Welcome & Progress ── */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="flex flex-col lg:flex-row justify-between gap-6">
                                <div className="flex-1">
                                    {isHRView && (
                                        <h2 className="text-xl font-bold text-gray-800 mb-1">
                                            {wf.employeeId?.name} {wf.employeeId?.lastName}
                                        </h2>
                                    )}
                                    {wf.welcomeMessage && (
                                        <p className="text-gray-600 text-sm mb-4">{wf.welcomeMessage}</p>
                                    )}
                                    <div className="flex flex-wrap gap-4 text-sm">
                                        <span className={`px-3 py-1 rounded-full font-medium ${wf.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {wf.status}
                                        </span>
                                        {wf.joiningDate && (
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <FaClock /> Joining: {format(new Date(wf.joiningDate), 'MMM dd, yyyy')}
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                                        {wf.assignedHR && (
                                            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                <FaUser className="text-theme-secondary" />
                                                <div><div className="text-gray-500 text-xs">HR Contact</div>
                                                    <div className="font-medium">{wf.assignedHR?.name || 'HR'}</div></div>
                                            </div>
                                        )}
                                        {wf.assignedManager && (
                                            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                <FaUser className="text-theme-secondary" />
                                                <div><div className="text-gray-500 text-xs">Manager</div>
                                                    <div className="font-medium">{wf.assignedManager?.name || 'Manager'}</div></div>
                                            </div>
                                        )}
                                        {wf.assignedBuddy && (
                                            <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                <FaUser className="text-theme-secondary" />
                                                <div><div className="text-gray-500 text-xs">Buddy</div>
                                                    <div className="font-medium">{wf.assignedBuddy?.name || 'Buddy'}</div></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-4 flex-wrap">
                                    <ProgressRing value={wf.progress || 0} label="Overall" />
                                    <ProgressRing value={breakdown.tasks || 0} label="Tasks" color="#2563eb" />
                                    <ProgressRing value={breakdown.documents || 0} label="Documents" color="#7c3aed" />
                                    <ProgressRing value={breakdown.checklist || 0} label="Checklist" color="#059669" />
                                    <ProgressRing value={breakdown.training || 0} label="Training" color="#d97706" />
                                </div>
                                {breakdown.byRole && isHRView && (
                                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                        {TASK_GROUPS_BY_ROLE.map((g) => (
                                            <div key={g.key} className="bg-gray-50 rounded-lg px-3 py-2">
                                                <span className="text-gray-500">{g.label}</span>
                                                <span className="float-right font-bold">{breakdown.byRole[g.key] ?? 0}%</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Tasks by Role ── */}
                        <section className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                <FaTasks className="text-theme-secondary" /> Tasks
                            </h2>
                            {(isHRView ? TASK_GROUPS_BY_ROLE : [{ key: '_all', label: 'My Tasks' }]).map((group) => {
                                const groupTasks = isHRView
                                    ? (tasksByRole[group.key] || [])
                                    : visibleTasks;
                                if (!groupTasks.length) return null;
                                const done = groupTasks.filter((t) => t.status === 'Completed').length;
                                return (
                                    <div key={group.key} className="mb-6 last:mb-0">
                                        <div className="flex justify-between items-center mb-3">
                                            <h3 className="font-semibold text-gray-700">{group.label}</h3>
                                            <span className="text-sm text-gray-500">{done}/{groupTasks.length} done · {breakdown.byRole?.[group.key] ?? 0}%</span>
                                        </div>
                                        <div className="space-y-3">
                                            {groupTasks.map((task) => {
                                                const blockers = getTaskCompletionBlockers(wf, task);
                                                const readyToComplete = canCompleteTask(wf, task);
                                                return (
                                                    <div key={task._id} className="border rounded-lg p-4 hover:shadow-sm transition">
                                                        <div className="flex justify-between items-start gap-3">
                                                            <div>
                                                                <h4 className="font-semibold">{task.title}</h4>
                                                                {task.description && <p className="text-sm text-gray-500 mt-1">{task.description}</p>}
                                                                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                                                                    <span>{task.category}</span>
                                                                    <span>{task.priority} priority</span>
                                                                    {task.phase && <span>{task.phase}</span>}
                                                                    {task.dueDate && <span>Due: {format(new Date(task.dueDate), 'MMM dd')}</span>}
                                                                </div>
                                                            </div>
                                                            <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${TASK_STATUS_COLORS[task.status] || 'bg-gray-100'}`}>
                                                                {task.status}
                                                            </span>
                                                        </div>
                                                        {task.status !== 'Completed' && canActOnTask(task) && (
                                                            <div className="mt-3 flex gap-2 flex-wrap items-center">
                                                                {task.status === 'Pending' && (
                                                                    <button type="button" onClick={() => updateTask(task._id, 'In Progress')} disabled={submitting}
                                                                        className="px-3 py-1 bg-theme-secondary text-white rounded text-sm disabled:opacity-50">Start</button>
                                                                )}
                                                                {task.status === 'In Progress' && (
                                                                    <button type="button" onClick={() => updateTask(task._id, 'Completed')}
                                                                        disabled={submitting || !readyToComplete}
                                                                        className="px-3 py-1 bg-theme-primary text-white rounded text-sm disabled:opacity-50 flex items-center gap-1">
                                                                        <FaCheckCircle /> Mark Complete
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {task.status === 'In Progress' && canActOnTask(task) && blockers.length > 0 && (
                                                            <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                                                                <p className="font-medium">Before you can mark this complete:</p>
                                                                <ul className="mt-1 list-disc list-inside">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </section>

                        {/* ── Documents ── */}
                        <section className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                <FaFileAlt className="text-theme-secondary" /> Documents
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(wf.documents?.length ? wf.documents : ONBOARDING_DOCUMENT_TYPES.map(d => ({
                                    documentType: d.key, name: d.label, mandatory: d.required, status: 'Pending',
                                }))).map((doc, idx) => {
                                    const docId = doc._id;
                                    const meta = ONBOARDING_DOCUMENT_TYPES.find(d => d.key === doc.documentType);
                                    return (
                                        <div key={docId || doc.documentType || idx} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-medium">{meta?.label || doc.name || doc.documentType}</h3>
                                                    {doc.mandatory && <span className="text-xs text-red-500">Required</span>}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${DOC_STATUS_COLORS[doc.status] || 'bg-gray-100'}`}>
                                                    {doc.status}
                                                </span>
                                            </div>
                                            {doc.rejectionReason && (
                                                <p className="text-xs text-red-600 mt-1">Rejected: {doc.rejectionReason}</p>
                                            )}
                                            <div className="mt-3 flex gap-2 flex-wrap">
                                                {(isOnboardingEmployee || !isHRView) && doc.status !== 'Verified' && (
                                                    <label className="cursor-pointer px-3 py-1 bg-theme-secondary text-white rounded text-sm flex items-center gap-1">
                                                        <FaUpload />
                                                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                            onChange={(e) => uploadDocument(doc.documentType, e.target.files[0])} />
                                                        Upload
                                                    </label>
                                                )}
                                                {doc.url && (
                                                    <a href={doc.url} target="_blank" rel="noreferrer"
                                                        className="px-3 py-1 border rounded text-sm hover:bg-gray-50">View</a>
                                                )}
                                                {isHRView && doc.status === 'Uploaded' && docId && (
                                                    <>
                                                        <button onClick={() => verifyDocument(docId, 'Verified')} disabled={submitting}
                                                            className="px-3 py-1 bg-emerald-600 text-white rounded text-sm flex items-center gap-1">
                                                            <FaCheck /> Verify
                                                        </button>
                                                        <button onClick={() => setRejectDocId(docId)} disabled={submitting}
                                                            className="px-3 py-1 bg-red-500 text-white rounded text-sm flex items-center gap-1">
                                                            <FaTimes /> Reject
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                            {rejectDocId === docId && (
                                                <div className="mt-2 flex gap-2">
                                                    <input placeholder="Rejection reason" value={rejectReason}
                                                        onChange={(e) => setRejectReason(e.target.value)}
                                                        className="flex-1 p-1 border rounded text-sm" />
                                                    <button onClick={() => verifyDocument(docId, 'Rejected', rejectReason)}
                                                        className="px-2 py-1 bg-red-500 text-white rounded text-sm">Confirm</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ── Checklist ── */}
                        <section className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                <FaCheckCircle className="text-theme-secondary" /> Checklist
                            </h2>
                            <div className="space-y-2">
                                {(wf.checklist || []).map((item) => (
                                    <label key={item._id} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input type="checkbox" checked={item.completed}
                                            onChange={(e) => toggleChecklist(item._id, e.target.checked)}
                                            disabled={submitting} className="w-4 h-4 accent-theme-primary" />
                                        <div className="flex-1">
                                            <span className={item.completed ? 'line-through text-gray-400' : 'font-medium'}>{item.item}</span>
                                            <div className="text-xs text-gray-500">{item.category} · {item.phase}{item.mandatory ? ' · Required' : ''}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </section>

                        {/* ── Equipment / Assets ── */}
                        {(wf.assets?.length > 0) && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <FaLaptop className="text-theme-secondary" /> Equipment & Assets
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {wf.assets.map((asset) => (
                                        <div key={asset._id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-medium">{asset.name || asset.assetType}</h4>
                                                    {asset.serialNumber && <p className="text-xs text-gray-500">SN: {asset.serialNumber}</p>}
                                                </div>
                                                {isHRView ? (
                                                    <select value={asset.status} disabled={submitting}
                                                        onChange={(e) => updateAsset(asset._id, { status: e.target.value })}
                                                        className="text-xs border rounded px-2 py-1">
                                                        {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">{asset.status}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── Training ── */}
                        {(wf.trainingModules?.length > 0) && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <FaGraduationCap className="text-theme-secondary" /> Training
                                </h2>
                                <div className="space-y-3">
                                    {wf.trainingModules.map((mod) => (
                                        <div key={mod._id} className="border rounded-lg p-4 flex justify-between items-center gap-3">
                                            <div>
                                                <h4 className="font-medium">{mod.title}</h4>
                                                <p className="text-sm text-gray-500">{mod.description}</p>
                                                <span className="text-xs text-gray-400">{mod.type} · {mod.phase}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-1 rounded ${mod.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100'}`}>
                                                    {mod.status}{mod.score != null ? ` (${mod.score}%)` : ''}
                                                </span>
                                                {(isOnboardingEmployee || !isHRView) && mod.status !== 'Completed' && (
                                                    <button type="button" onClick={() => completeTraining(mod._id)} disabled={submitting}
                                                        className="px-3 py-1 bg-theme-secondary text-white rounded text-sm">Complete</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── Digital Signatures ── */}
                        {(wf.policySignatures?.length > 0) && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <FaPen className="text-theme-secondary" /> Policy Signatures
                                </h2>
                                <div className="space-y-2">
                                    {wf.policySignatures.map((sig) => (
                                        <div key={sig._id} className="flex justify-between items-center border rounded-lg p-3">
                                            <span className="font-medium">{sig.title}</span>
                                            {sig.status === 'Signed' ? (
                                                <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                                    Signed {sig.signedAt ? format(new Date(sig.signedAt), 'MMM dd') : ''}
                                                </span>
                                            ) : (isOnboardingEmployee || !isHRView) ? (
                                                <button type="button" onClick={() => signPolicy(sig._id)} disabled={submitting}
                                                    className="px-3 py-1 bg-theme-primary text-white rounded text-sm flex items-center gap-1">
                                                    <FaPen /> Sign
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-500">Pending employee signature</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── Buddy Dashboard ── */}
                        {(isBuddyView || (isHRView && wf.buddyCheckins?.length)) && wf.buddyCheckins?.length > 0 && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold mb-4">Buddy Check-ins</h2>
                                <div className="space-y-3">
                                    {wf.buddyCheckins.map((c) => (
                                        <div key={c._id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-center">
                                                <h4 className="font-medium">{c.title}</h4>
                                                <select value={c.status} disabled={submitting}
                                                    onChange={(e) => updateCheckin(c._id, { status: e.target.value, ...(e.target.value === 'Completed' ? { completedDate: new Date() } : {}) })}
                                                    className="text-xs border rounded px-2 py-1">
                                                    {['Pending', 'Scheduled', 'Completed'].map((s) => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── Manager Dashboard ── */}
                        {(isManagerView || (isHRView && wf.managerActions?.length)) && wf.managerActions?.length > 0 && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold mb-4">Manager Actions</h2>
                                <div className="space-y-3">
                                    {wf.managerActions.map((a) => (
                                        <div key={a._id} className="border rounded-lg p-4 flex justify-between items-center">
                                            <span className="font-medium">{a.title}</span>
                                            <select value={a.status} disabled={submitting}
                                                onChange={(e) => updateManagerActionItem(a._id, { status: e.target.value })}
                                                className="text-xs border rounded px-2 py-1">
                                                {['Pending', 'In Progress', 'Completed'].map((s) => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── Timeline Roadmap ── */}
                        <section className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                <FaChartLine className="text-theme-secondary" /> Onboarding Roadmap
                            </h2>
                            <div className="space-y-6">
                                {ONBOARDING_TIMELINE_ROADMAP.map((milestone) => {
                                    const phaseTasks = (wf.tasks || []).filter((t) => t.phase === milestone.phase);
                                    const phaseChecklist = (wf.checklist || []).filter((c) => c.phase === milestone.phase);
                                    const phaseDone = phaseTasks.filter((t) => t.status === 'Completed').length
                                        + phaseChecklist.filter((c) => c.completed).length;
                                    const phaseTotal = phaseTasks.length + phaseChecklist.length;
                                    const pct = phaseTotal ? Math.round((phaseDone / phaseTotal) * 100) : 0;
                                    return (
                                        <div key={milestone.phase} className="relative pl-6 border-l-2 border-theme-primary/40">
                                            <div className="absolute -left-2 top-1 w-4 h-4 rounded-full bg-theme-primary" />
                                            <div className="flex justify-between items-start gap-4">
                                                <div>
                                                    <p className="text-xs text-theme-secondary font-medium">{milestone.phase}</p>
                                                    <h3 className="font-bold text-gray-800">{milestone.title}</h3>
                                                    <p className="text-sm text-gray-500">{milestone.description}</p>
                                                </div>
                                                <span className="text-sm font-bold text-theme-primary shrink-0">{pct}%</span>
                                            </div>
                                            {(phaseTasks.length > 0 || phaseChecklist.length > 0) && (
                                                <div className="mt-2 space-y-1">
                                                    {[...phaseTasks, ...phaseChecklist.map((c) => ({ title: c.item, status: c.completed ? 'Completed' : 'Pending' }))].slice(0, 5).map((item, i) => (
                                                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                                                            <div className={`w-2 h-2 rounded-full ${item.status === 'Completed' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                            <span className={item.status === 'Completed' ? 'line-through text-gray-400' : ''}>{item.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {/* ── Activity Feed ── */}
                        <section className="bg-white rounded-xl shadow-md p-6">
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                <FaHistory className="text-theme-secondary" /> Recent Activity
                            </h2>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {(wf.activityFeed || []).slice(0, 20).map((act, i) => (
                                    <div key={act._id || i} className="flex gap-3 text-sm">
                                        <div className="w-2 h-2 rounded-full bg-theme-primary mt-1.5 shrink-0" />
                                        <div>
                                            <p>{act.description}</p>
                                            <p className="text-xs text-gray-400">
                                                {act.actorName} · {act.createdAt ? format(new Date(act.createdAt), 'MMM dd, HH:mm') : ''}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {!wf.activityFeed?.length && <p className="text-gray-500 text-sm">No activity yet.</p>}
                            </div>
                        </section>

                        {/* ── Notes (HR only) ── */}
                        {isHRView && (
                            <section className="bg-white rounded-xl shadow-md p-6">
                                <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                                    <FaStickyNote className="text-theme-secondary" /> Internal Notes
                                </h2>
                                <div className="flex gap-2 mb-4">
                                    <input value={newNote} onChange={(e) => setNewNote(e.target.value)}
                                        placeholder="Add an internal note..." className="flex-1 p-2 border rounded-lg" />
                                    <button onClick={addNote} className="px-4 py-2 bg-theme-secondary text-white rounded-lg">Add</button>
                                </div>
                                <div className="space-y-2">
                                    {(wf.notes || []).map((n, i) => (
                                        <div key={n._id || i} className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm">
                                            <p>{n.note}</p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {n.addedBy?.name || 'HR'} · {n.addedAt ? format(new Date(n.addedAt), 'MMM dd, yyyy') : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
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
                                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}>
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
                                        onChange={(e) => setCreateForm({ ...createForm, joiningDate: e.target.value, scheduledStartDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Start Date</label>
                                    <input type="date" className="w-full p-2 border rounded-lg mt-1"
                                        value={createForm.scheduledStartDate}
                                        onChange={(e) => setCreateForm({ ...createForm, scheduledStartDate: e.target.value })} />
                                </div>
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
        </div>
    );
};

export default OnboardingHub;
