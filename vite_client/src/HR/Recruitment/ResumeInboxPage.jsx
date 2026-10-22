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
import { normalizeResumeScreening, formatScreeningDisplayLabel } from '../../utils/resumeScreeningDisplay';
import { AtsPage, AtsPageHeader, AtsEmpty, AtsBadge, CmButton } from '../../components/recruitment/atsUi';

const StatCard = ({ label, value, tone }) => (
    <div className="cm-stat">
        <p className="cm-stat__label">{label}</p>
        <p className={`cm-stat__value ${tone === 'attention' ? 'cm-stat__value--attention' : ''}`}>{value ?? 0}</p>
    </div>
);

const STATUS_TONE = {
    imported: 'success',
    duplicate: 'pending',
    failed: 'error',
    pending: 'neutral',
    skipped: 'neutral',
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
        <AtsPage className="rec-hub ats-inbox-page">
            <div className="rec-hub__crumb">
                <span>Recruitment</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Resume Inbox</span>
            </div>

            <button
                type="button"
                onClick={() => navigate('/recruitment')}
                className="ats-back"
            >
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <AtsPageHeader
                eyebrow="Talent acquisition"
                title={(
                    <span className="inline-flex items-center gap-2">
                        <FaEnvelopeOpenText style={{ color: 'var(--ats-primary)' }} />
                        Resume Inbox
                    </span>
                )}
                subtitle="Automatically import resumes emailed to your recruitment mailbox into the ATS"
                actions={
                    <>
                        <CmButton variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)}>
                            Mailbox Settings
                        </CmButton>
                        <CmButton size="sm" onClick={handlePoll} disabled={polling}>
                            <FaSync className={polling ? 'animate-spin' : ''} />
                            {polling ? 'Polling…' : 'Poll Now'}
                        </CmButton>
                    </>
                }
            />

            {showConfig && (
                <form onSubmit={handleSaveConfig} className="cm-card ats-hire-form">
                    <h2 className="mb-3 font-semibold" style={{ color: 'var(--ats-secondary)' }}>Recruitment Mailbox (IMAP)</h2>
                    <p className="mb-4 text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>
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
                            <span className="ats-form-label">Provider</span>
                            <select
                                className="cm-select w-full"
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
                            <span className="ats-form-label">Host</span>
                            <input
                                className="cm-input w-full"
                                value={config.host || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
                                placeholder="imap.gmail.com"
                            />
                        </label>
                        <label className="text-sm">
                            <span className="ats-form-label">Port</span>
                            <input
                                type="number"
                                className="cm-input w-full"
                                value={config.port || 993}
                                onChange={(e) => setConfig((c) => ({ ...c, port: e.target.value }))}
                            />
                        </label>
                        <label className="text-sm">
                            <span className="ats-form-label">Mailbox email</span>
                            <input
                                type="email"
                                className="cm-input w-full"
                                value={config.user || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, user: e.target.value }))}
                                placeholder="careers@company.com"
                            />
                        </label>
                        <label className="text-sm">
                            <span className="ats-form-label">Password / App password {config.hasPassword ? '(saved)' : ''}</span>
                            <input
                                type="password"
                                className="cm-input w-full"
                                value={config.password || ''}
                                onChange={(e) => setConfig((c) => ({ ...c, password: e.target.value }))}
                                placeholder={config.hasPassword ? '•••••••• (leave blank to keep)' : 'App password'}
                                autoComplete="new-password"
                            />
                            {config.provider === 'gmail' && (
                                <span className="ats-field-hint block">
                                    Gmail requires an App Password (Google Account → Security → 2-Step Verification → App passwords).
                                    Enable IMAP under Gmail Settings → Forwarding and POP/IMAP.
                                </span>
                            )}
                        </label>
                        <label className="text-sm">
                            <span className="ats-form-label">Folder</span>
                            <input
                                className="cm-input w-full"
                                value={config.folder || 'INBOX'}
                                onChange={(e) => setConfig((c) => ({ ...c, folder: e.target.value }))}
                            />
                        </label>
                    </div>
                    {config.lastPollError && (
                        <p className="mt-3 text-sm" style={{ color: 'var(--ats-error)' }}>Last poll error: {config.lastPollError}</p>
                    )}
                    {config.lastPolledAt && (
                        <p className="mt-1 text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                            Last polled: {new Date(config.lastPolledAt).toLocaleString()}
                        </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <CmButton
                            type="button"
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={testingConnection || !config.user}
                        >
                            {testingConnection ? 'Testing…' : 'Test Connection'}
                        </CmButton>
                        <CmButton type="submit" disabled={savingConfig}>
                            {savingConfig ? 'Saving…' : 'Save Settings'}
                        </CmButton>
                        <CmButton type="button" variant="outline" onClick={() => setShowConfig(false)}>
                            Cancel
                        </CmButton>
                    </div>
                </form>
            )}

            <div className="ats-stat-grid">
                <StatCard label="Unread Imports" value={stats.unread} />
                <StatCard label="Imported Today" value={stats.importedToday} />
                <StatCard label="Failed Imports" value={stats.failed} tone="attention" />
                <StatCard label="Duplicate Candidates" value={stats.duplicates} tone="attention" />
            </div>

            <div className="ats-filter-pills">
                {['', 'imported', 'duplicate', 'failed'].map((s) => (
                    <button
                        key={s || 'all'}
                        type="button"
                        onClick={() => setFilter(s)}
                        className={`ats-filter-pill ${filter === s ? 'ats-filter-pill--active' : ''}`}
                    >
                        {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
                    </button>
                ))}
            </div>

            <div className="ats-table-wrap">
                <div className="border-b border-[rgba(15,45,38,0.08)] px-5 py-4">
                    <h2 className="font-semibold" style={{ color: 'var(--ats-secondary)' }}>Recently Imported Resumes</h2>
                </div>
                {imports.length === 0 ? (
                    <p className="p-6 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>
                        No imports yet. Enable the mailbox and click Poll Now, or wait for the automatic 5-minute sync.
                    </p>
                ) : (
                    <div className="divide-y divide-[rgba(15,45,38,0.06)]">
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
                                    className={`ats-inbox-row${item.isUnread ? ' is-unread' : ''}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-medium" style={{ color: 'var(--ats-secondary)' }}>{name || 'Unknown'}</p>
                                            <AtsBadge tone={STATUS_TONE[item.status] || 'neutral'}>{item.status}</AtsBadge>
                                            <AtsBadge status={screeningLabel}>{screeningLabel}</AtsBadge>
                                            {item.isUnread && (
                                                <span className="text-xs font-medium" style={{ color: '#1a5aa8' }}>Unread</span>
                                            )}
                                        </div>
                                        <p className="truncate text-sm" style={{ color: 'rgba(15,45,38,0.65)' }}>{item.subject || '(no subject)'}</p>
                                        <p className="text-xs" style={{ color: 'rgba(15,45,38,0.5)' }}>
                                            {item.fromAddress}
                                            {' · '}
                                            {item.receivedAt ? new Date(item.receivedAt).toLocaleString() : ''}
                                            {' · '}
                                            Source: Email
                                            {' · '}
                                            {isHolding ? 'Unassigned' : jobTitle}
                                        </p>
                                        {item.failureReason && (
                                            <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--ats-error)' }}>
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
                                                className="cm-btn cm-btn--outline cm-btn--sm disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <FaUserPlus className="h-3 w-3" /> Open Candidate
                                            </button>
                                        )}
                                        {!isRejected && (isHolding || item.status === 'imported' || item.status === 'duplicate') && item.candidateId && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAssignFor(item._id);
                                                    setSelectedJobId('');
                                                }}
                                                className="cm-btn cm-btn--outline cm-btn--sm"
                                            >
                                                <FaBriefcase className="h-3 w-3" /> Assign Job
                                            </button>
                                        )}
                                        {item.status === 'failed' && (
                                            <button
                                                type="button"
                                                onClick={() => handleRetry(item._id)}
                                                className="cm-btn cm-btn--outline cm-btn--sm"
                                                style={{ color: 'var(--ats-error)', borderColor: 'rgba(229,62,62,0.35)' }}
                                            >
                                                <FaSync className="h-3 w-3" /> Retry
                                            </button>
                                        )}
                                        {item.isUnread && (
                                            <button
                                                type="button"
                                                onClick={() => handleMarkRead(item._id)}
                                                className="cm-btn cm-btn--outline cm-btn--sm"
                                            >
                                                <FaCheck className="h-3 w-3" /> Mark Read
                                            </button>
                                        )}
                                        {item.resume?.url && (
                                            <a
                                                href={item.resume.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="cm-btn cm-btn--outline cm-btn--sm"
                                            >
                                                Resume
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item._id)}
                                            className="cm-btn cm-btn--outline cm-btn--sm"
                                        >
                                            <FaTrash className="h-3 w-3" /> Delete
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
                    <div className="ats-inbox-modal">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--ats-secondary)' }}>Assign to Job</h3>
                        <p className="mt-1 text-sm" style={{ color: 'rgba(15,45,38,0.5)' }}>Select an open job posting for this candidate.</p>
                        <select
                            className="cm-select mt-4 w-full"
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
                            <CmButton type="button" variant="outline" onClick={() => setAssignFor(null)}>
                                Cancel
                            </CmButton>
                            <CmButton type="button" disabled={!selectedJobId} onClick={handleAssign}>
                                Assign
                            </CmButton>
                        </div>
                    </div>
                </div>
            )}
        </AtsPage>
    );
};

export default ResumeInboxPage;
