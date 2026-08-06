import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaArrowLeft,
    FaEnvelopeOpenText,
    FaSync,
    FaUserPlus,
    FaExclamationTriangle,
    FaCheck,
    FaBriefcase,
    FaTrash,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { normalizeResumeScreening, getScreeningBadgeClasses, formatScreeningDisplayLabel } from '../../utils/resumeScreeningDisplay';

const StatCard = ({ label, value, tone = 'gray' }) => {
    const tones = {
        gray: 'bg-gray-50 text-gray-800 border-gray-200',
        teal: 'bg-teal-50 text-teal-800 border-teal-200',
        amber: 'bg-amber-50 text-amber-800 border-amber-200',
        rose: 'bg-rose-50 text-rose-800 border-rose-200',
        indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    };
    return (
        <div className={`rounded-xl border p-4 ${tones[tone] || tones.gray}`}>
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value ?? 0}</p>
        </div>
    );
};

const statusBadge = (status) => {
    const map = {
        imported: 'bg-teal-100 text-teal-800',
        duplicate: 'bg-amber-100 text-amber-800',
        failed: 'bg-rose-100 text-rose-800',
        pending: 'bg-gray-100 text-gray-700',
        skipped: 'bg-gray-100 text-gray-500',
    };
    return map[status] || map.pending;
};

const getProviderDefaults = (provider) => {
    if (provider === 'gmail') {
        return {
            provider,
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            folder: 'INBOX',
        };
    }
    if (provider === 'outlook') {
        return {
            provider,
            host: 'outlook.office365.com',
            port: 993,
            secure: true,
            folder: 'INBOX',
        };
    }
    return {
        provider,
        host: '',
        port: 993,
        secure: true,
        folder: 'INBOX',
    };
};

const ResumeInboxPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [polling, setPolling] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [stats, setStats] = useState({ unread: 0, importedToday: 0, failed: 0, duplicates: 0, recent: [] });
    const [imports, setImports] = useState([]);
    const [filter, setFilter] = useState('');
    const [jobs, setJobs] = useState([]);
    const [assignFor, setAssignFor] = useState(null);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [showConfig, setShowConfig] = useState(false);
    const [config, setConfig] = useState({
        enabled: false,
        ...getProviderDefaults('gmail'),
        user: '',
        password: '',
        hasPassword: false,
    });

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [statsRes, importsRes, jobsRes] = await Promise.all([
                axios.get('/v1/admin/recruitment/inbox/stats', { withCredentials: true }),
                axios.get('/v1/admin/recruitment/inbox/imports', {
                    withCredentials: true,
                    params: filter ? { status: filter, limit: 50 } : { limit: 50 },
                }),
                axios.get('/v1/admin/recruitment/inbox/jobs', { withCredentials: true }),
            ]);
            const s = statsRes.data?.data || {};
            setStats(s);
            if (s.config) {
                const providerDefaults = getProviderDefaults(s.config.provider || 'gmail');
                setConfig((prev) => ({
                    ...prev,
                    ...providerDefaults,
                    ...s.config,
                    password: '',
                }));
            }
            setImports(importsRes.data?.data || []);
            setJobs(jobsRes.data?.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load Resume Inbox');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePoll = async () => {
        try {
            setPolling(true);
            const res = await axios.post('/v1/admin/recruitment/inbox/poll', {}, { withCredentials: true });
            toast.success(res.data?.message || 'Poll complete');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Poll failed');
        } finally {
            setPolling(false);
        }
    };

    const handleTestConnection = async () => {
        try {
            setTestingConnection(true);
            const res = await axios.post(
                '/v1/admin/recruitment/inbox/test-connection',
                {
                    enabled: config.enabled,
                    provider: config.provider,
                    host: config.host,
                    port: Number(config.port) || 993,
                    secure: config.secure,
                    user: config.user,
                    folder: config.folder || 'INBOX',
                    ...(config.password ? { password: config.password } : {}),
                },
                { withCredentials: true }
            );
            toast.success(res.data?.message || 'IMAP connection successful');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Connection test failed');
            await load();
        } finally {
            setTestingConnection(false);
        }
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            setSavingConfig(true);
            const providerDefaults = getProviderDefaults(config.provider || 'gmail');
            const payload = {
                enabled: config.enabled,
                provider: config.provider,
                host: providerDefaults.host || config.host,
                port: Number(providerDefaults.port || config.port) || 993,
                secure: providerDefaults.secure !== false,
                user: config.user,
                folder: config.folder || 'INBOX',
            };
            if (config.password) payload.password = config.password;
            const res = await axios.put('/v1/admin/recruitment/inbox/config', payload, { withCredentials: true });
            toast.success(res.data?.message || 'Settings saved');
            setConfig((prev) => ({ ...prev, ...(res.data?.data || {}), password: '' }));
            setShowConfig(false);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save settings');
        } finally {
            setSavingConfig(false);
        }
    };

    const handleAssign = async () => {
        if (!assignFor || !selectedJobId) return;
        try {
            await axios.post(
                `/v1/admin/recruitment/inbox/imports/${assignFor}/assign-job`,
                { jobPostingId: selectedJobId },
                { withCredentials: true }
            );
            toast.success('Candidate assigned to job');
            setAssignFor(null);
            setSelectedJobId('');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Assign failed');
        }
    };

    const handleRetry = async (id) => {
        try {
            await axios.post(`/v1/admin/recruitment/inbox/imports/${id}/retry`, {}, { withCredentials: true });
            toast.success('Retry completed');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Retry failed');
        }
    };

    const handleMarkRead = async (id) => {
        try {
            await axios.post(`/v1/admin/recruitment/inbox/imports/${id}/read`, {}, { withCredentials: true });
            await load();
        } catch {
            /* ignore */
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this import from Resume Inbox? The candidate in ATS will not be deleted.')) {
            return;
        }
        try {
            await axios.delete(`/v1/admin/recruitment/inbox/imports/${id}`, { withCredentials: true });
            toast.success('Import deleted');
            await load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed');
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading Resume Inbox..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={() => navigate('/recruitment')}
                        className="mb-2 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-theme-secondary"
                    >
                        <FaArrowLeft /> Back to Recruitment
                    </button>
                    <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-800">
                        <FaEnvelopeOpenText className="text-theme-secondary" />
                        Resume Inbox
                    </h1>
                    <p className="mt-1 text-gray-600">
                        Automatically import resumes emailed to your recruitment mailbox into the ATS
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setShowConfig((v) => !v)}
                        className="rounded-lg border px-3 py-2 text-sm text-gray-700 hover:bg-white"
                    >
                        Mailbox Settings
                    </button>
                    <button
                        type="button"
                        onClick={handlePoll}
                        disabled={polling}
                        className="inline-flex items-center gap-2 rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white hover:bg-theme-primary disabled:opacity-60"
                    >
                        <FaSync className={polling ? 'animate-spin' : ''} />
                        {polling ? 'Polling…' : 'Poll Now'}
                    </button>
                </div>
            </div>

            {showConfig && (
                <form onSubmit={handleSaveConfig} className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <h2 className="mb-3 font-semibold text-gray-800">Recruitment Mailbox (IMAP)</h2>
                    <p className="mb-4 text-sm text-gray-500">
                        Use <strong>Gmail</strong> with a Google App Password for best results.
                        Outlook/Office 365 often blocks password IMAP login. Host fills automatically when you pick a provider.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
                            <input
                                type="checkbox"
                                checked={!!config.enabled}
                                onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
                            />
                            Enable automatic resume import
                        </label>
                        <label className="text-sm">
                            Provider
                            <select
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.provider || ''}
                                onChange={(e) => {
                                    const provider = e.target.value;
                                    const defaults = getProviderDefaults(provider);
                                    setConfig((c) => ({
                                        ...c,
                                        ...defaults,
                                    }));
                                }}
                            >
                                <option value="gmail">Gmail</option>
                                <option value="outlook">Outlook / Office 365</option>
                                <option value="imap">Custom IMAP</option>
                            </select>
                        </label>
                        <label className="text-sm">
                            Host
                            <input
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.host || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
                                placeholder="imap.gmail.com"
                            />
                        </label>
                        <label className="text-sm">
                            Port
                            <input
                                type="number"
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.port || 993}
                                onChange={(e) => setConfig((c) => ({ ...c, port: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm">
                            Mailbox email
                            <input
                                type="email"
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.user || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value }))}
                                placeholder="careers@company.com"
                            />
                        </label>
                        <label className="text-sm">
                            Password / App password {config.hasPassword ? '(saved)' : ''}
                            <input
                                type="password"
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.password || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                                placeholder={config.hasPassword ? '•••••••• (leave blank to keep)' : 'App password'}
                                autoComplete="new-password"
                            />
                            {config.provider === 'gmail' && (
                                <span className="mt-1 block text-xs text-gray-500">
                                    Gmail requires an App Password (Google Account → Security → 2-Step Verification → App passwords).
                                    Enable IMAP under Gmail Settings → Forwarding and POP/IMAP.
                                </span>
                            )}
                        </label>
                        <label className="text-sm">
                            Folder
                            <input
                                className="mt-1 w-full rounded-lg border px-3 py-2"
                                value={config.folder || 'INBOX'}
                                onChange={(e) => setConfig((c) => ({ ...c, folder: e.target.value }))}
                            />
                        </label>
                    </div>
                    {config.lastPollError && (
                        <p className="mt-3 text-sm text-rose-600">Last poll error: {config.lastPollError}</p>
                    )}
                    {config.lastPolledAt && (
                        <p className="mt-1 text-xs text-gray-500">
                            Last polled: {new Date(config.lastPolledAt).toLocaleString()}
                        </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testingConnection || !config.user}
                            className="rounded-lg border border-theme-secondary px-4 py-2 text-sm text-theme-secondary hover:bg-teal-50 disabled:opacity-60"
                        >
                            {testingConnection ? 'Testing…' : 'Test Connection'}
                        </button>
                        <button
                            type="submit"
                            disabled={savingConfig}
                            className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white disabled:opacity-60"
                        >
                            {savingConfig ? 'Saving…' : 'Save Settings'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowConfig(false)}
                            className="rounded-lg border px-4 py-2 text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Unread Imports" value={stats.unread} tone="indigo" />
                <StatCard label="Imported Today" value={stats.importedToday} tone="teal" />
                <StatCard label="Failed Imports" value={stats.failed} tone="rose" />
                <StatCard label="Duplicate Candidates" value={stats.duplicates} tone="amber" />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
                {['', 'imported', 'duplicate', 'failed'].map((s) => (
                    <button
                        key={s || 'all'}
                        type="button"
                        onClick={() => setFilter(s)}
                        className={`rounded-full px-3 py-1 text-sm ${
                            filter === s ? 'bg-theme-secondary text-white' : 'border bg-white text-gray-700'
                        }`}
                    >
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b px-4 py-3">
                    <h2 className="font-semibold text-gray-800">Recently Imported Resumes</h2>
                </div>
                {imports.length === 0 ? (
                    <p className="p-6 text-sm text-gray-500">
                        No imports yet. Enable the mailbox and click Poll Now, or wait for the automatic 5-minute sync.
                    </p>
                ) : (
                    <div className="divide-y">
                        {imports.map((item) => {
                            const name = item.candidateId
                                ? `${item.candidateId.firstName || ''} ${item.candidateId.lastName || ''}`.trim()
                                : item.extracted?.firstName
                                    ? `${item.extracted.firstName} ${item.extracted.lastName || ''}`.trim()
                                    : item.fromName || item.fromAddress;
                            const jobTitle = item.jobPostingId?.jobTitle || 'Unassigned';
                            const isHolding = (item.jobPostingId?.tags || []).includes('__resume_inbox_holding__');
                            const screening = normalizeResumeScreening(item.candidateId?.resumeScreening || {});
                            const isRejected = screening.isRejected;
                            const screeningLabel = formatScreeningDisplayLabel(screening, {
                                isDuplicate: !!item.wasDuplicate,
                            });
                            return (
                                <div
                                    key={item._id}
                                    className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                                        item.isUnread ? 'bg-indigo-50/40' : ''
                                    }`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium text-gray-900">{name || 'Unknown'}</p>
                                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(item.status)}`}>
                                                {item.status}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScreeningBadgeClasses(screening)}`}>
                                                {screeningLabel}
                                            </span>
                                            {item.isUnread && (
                                                <span className="text-xs font-medium text-indigo-600">Unread</span>
                                            )}
                                        </div>
                                        <p className="truncate text-sm text-gray-600">{item.subject || '(no subject)'}</p>
                                        <p className="text-xs text-gray-500">
                                            {item.fromAddress}
                                            {' · '}
                                            {item.receivedAt ? new Date(item.receivedAt).toLocaleString() : ''}
                                            {' · '}
                                            Source: Email
                                            {' · '}
                                            {isHolding ? 'Unassigned' : jobTitle}
                                        </p>
                                        {item.failureReason && (
                                            <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                                                <FaExclamationTriangle /> {item.failureReason}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {item.candidateId?._id && (
                                            <button
                                                type="button"
                                                disabled={isRejected}
                                                title={isRejected ? 'Rejected candidates cannot be opened for recruitment' : 'Open candidate'}
                                                onClick={() => {
                                                    if (isRejected) return;
                                                    handleMarkRead(item._id);
                                                    navigate(`/recruitment/candidates/${item.candidateId._id}`);
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:border-theme-secondary disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <FaUserPlus /> Open Candidate
                                            </button>
                                        )}
                                        {!isRejected && (isHolding || item.status === 'imported' || item.status === 'duplicate') && item.candidateId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAssignFor(item._id);
                                                    setSelectedJobId('');
                                                }}
                                                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:border-theme-secondary"
                                            >
                                                <FaBriefcase /> Assign Job
                                            </button>
                                        )}
                                        {item.status === 'failed' && (
                                            <button
                                                type="button"
                                                onClick={() => handleRetry(item._id)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50"
                                            >
                                                <FaSync /> Retry
                                            </button>
                                        )}
                                        {item.isUnread && (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkRead(item._id)}
                                                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600"
                                            >
                                                <FaCheck /> Mark Read
                                            </button>
                                        )}
                                        {item.resume?.url && (
                                            <a
                                                href={item.resume.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                                            >
                                                Resume
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item._id)}
                                            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:border-rose-300 hover:text-rose-700"
                                        >
                                            <FaTrash /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {assignFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Assign to Job</h3>
                        <p className="mt-1 text-sm text-gray-500">Select an open job posting for this candidate.</p>
                        <select
                            className="mt-4 w-full rounded-lg border px-3 py-2"
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                        >
                            <option value="">Select job…</option>
                            {jobs.map((j) => (
                                <option key={j._id} value={j._id}>
                                    {j.jobTitle} ({j.department}) — {j.status}
                                </option>
                            ))}
                        </select>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setAssignFor(null)}
                                className="rounded-lg border px-4 py-2 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!selectedJobId}
                                onClick={handleAssign}
                                className="rounded-lg bg-theme-secondary px-4 py-2 text-sm text-white disabled:opacity-50"
                            >
                                Assign
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResumeInboxPage;
