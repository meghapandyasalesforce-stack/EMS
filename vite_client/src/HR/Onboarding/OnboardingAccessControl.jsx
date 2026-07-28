import React, { useEffect, useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import { useSelector } from 'react-redux';
import {
    FaComments, FaEnvelope, FaGithub, FaKey, FaLaptop, FaProjectDiagram,
    FaWindows, FaEdit, FaExternalLinkAlt, FaCheck, FaPlus, FaShieldAlt, FaTimes,
} from 'react-icons/fa';
import { MdVpnLock } from 'react-icons/md';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { CmButton } from '../../components/corporateModern';
import { canAccessLifecycleEnterpriseHub } from '../../utils/managerHelper';

const SYSTEM_ICONS = [
    { match: /laptop|device|macbook|hardware/i, icon: FaLaptop },
    { match: /email|outlook|gmail|workspace/i, icon: FaEnvelope },
    { match: /vpn/i, icon: MdVpnLock },
    { match: /github/i, icon: FaGithub },
    { match: /jira|asana|linear|project/i, icon: FaProjectDiagram },
    { match: /slack|teams|chat/i, icon: FaComments },
    { match: /microsoft|m365|office|o365/i, icon: FaWindows },
];

const CATEGORY_LABEL = {
    scm: 'Source control',
    communication: 'Communication',
    project: 'Project tools',
    application: 'Application',
    email: 'Email',
    vpn: 'Network',
    other: 'Other',
};

const CATEGORY_OPTIONS = [
    { value: 'application', label: 'Application' },
    { value: 'communication', label: 'Communication' },
    { value: 'scm', label: 'Source control' },
    { value: 'project', label: 'Project tools' },
    { value: 'email', label: 'Email' },
    { value: 'vpn', label: 'Network' },
    { value: 'other', label: 'Other' },
];

const QUICK_ACCESS_SYSTEMS = ['Slack', 'GitHub', 'Jira', 'Outlook', 'VPN'];

function systemIcon(name = '') {
    const found = SYSTEM_ICONS.find((s) => s.match.test(name));
    return found?.icon || FaKey;
}

function accessStatusMeta(req) {
    const status = String(req?.status || 'Pending');
    const approval = String(req?.approvalStatus || '');
    const s = status.toLowerCase();

    if (/provision|complet/.test(s)) {
        return { tone: 'done', label: 'PROVISIONED', className: 'cm-access-pill cm-access-pill--done' };
    }
    if (s === 'rejected' || approval === 'Rejected') {
        return { tone: 'attention', label: 'REJECTED', className: 'cm-access-pill cm-access-pill--reject' };
    }
    if (s === 'revoked') {
        return { tone: 'attention', label: 'REVOKED', className: 'cm-access-pill cm-access-pill--reject' };
    }
    if (/ticket|assigned|progress|approved/.test(s)) {
        return { tone: 'progress', label: status.toUpperCase(), className: 'cm-access-pill cm-access-pill--progress' };
    }
    if (approval === 'Pending' || /pending|request/.test(s)) {
        return { tone: 'neutral', label: 'AWAITING SSO', className: 'cm-access-pill cm-access-pill--wait' };
    }
    return { tone: 'neutral', label: status.toUpperCase(), className: 'cm-access-pill cm-access-pill--wait' };
}

function formatDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (!isValid(date)) return null;
    return format(date, 'MMM d, yyyy');
}

function employeeStatusCopy(req) {
    const status = String(req?.status || 'Pending').toLowerCase();
    const approval = String(req?.approvalStatus || '').toLowerCase();
    if (/provision|complet/.test(status)) return 'Ready to use';
    if (status === 'rejected' || approval === 'rejected') return 'Not approved yet';
    if (/ticket|assigned|progress|approved/.test(status)) return 'Being provisioned by HR / IT';
    return 'Requested for your onboarding';
}

function parseProvisioningNotes(notes) {
    if (!notes) return {
        legacyNotes: '', details: {}, timeline: [], assignedByName: '', assignedOn: null, approvedDate: null, systemNote: '',
    };
    const [jsonPart, ...textTail] = String(notes).split(' | ');
    try {
        const parsed = JSON.parse(jsonPart);
        if (parsed?.__accessProvisioning) {
            return {
                legacyNotes: parsed.legacyNotes || '',
                details: parsed.details || {},
                timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
                assignedByName: parsed.assignedByName || '',
                assignedOn: parsed.assignedOn || null,
                approvedDate: parsed.approvedDate || null,
                systemNote: parsed.systemNote || textTail.join(' | ') || '',
            };
        }
    } catch {
        // legacy plain text notes
    }
    return {
        legacyNotes: notes, details: {}, timeline: [], assignedByName: '', assignedOn: null, approvedDate: null, systemNote: '',
    };
}

/**
 * Tasks-tab Access Control list — system name, status, dates, HR actions.
 */
export default function OnboardingAccessControl({
    workflowId,
    softwareRequests = [],
    viewerRole = 'hr',
    onUpdated,
}) {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const canAccessEnterpriseHub = canAccessLifecycleEnterpriseHub(user || employee, permissionFlags, employee);
    const isHr = viewerRole === 'hr' && canAccessEnterpriseHub;
    const isEmployee = viewerRole === 'employee';
    const [busyId, setBusyId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [newSystem, setNewSystem] = useState('');
    const [newCategory, setNewCategory] = useState('application');
    const [newMandatory, setNewMandatory] = useState(true);
    const [newNotes, setNewNotes] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [catalog, setCatalog] = useState([]);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewValues, setReviewValues] = useState({});
    const [reviewRemarks, setReviewRemarks] = useState('');

    const rows = useMemo(() => softwareRequests || [], [softwareRequests]);

    const summary = useMemo(() => {
        const provisioned = rows.filter((r) => /provision|complet/i.test(String(r.status || ''))).length;
        return { total: rows.length, provisioned, pending: rows.length - provisioned };
    }, [rows]);

    useEffect(() => {
        let active = true;
        if (!canAccessEnterpriseHub) {
            setCatalog([]);
            return () => { active = false; };
        }
        const loadCatalog = async () => {
            try {
                setLoadingCatalog(true);
                const res = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/it/access-provisioning-catalog`);
                if (active) setCatalog(res.data?.data || []);
            } catch {
                if (active) setCatalog([]);
            } finally {
                if (active) setLoadingCatalog(false);
            }
        };
        loadCatalog();
        return () => { active = false; };
    }, [canAccessEnterpriseHub]);

    const getTemplate = (systemName) => {
        const normalized = String(systemName || '').trim().toLowerCase();
        const exact = catalog.find((item) => (item.match || []).some((alias) => String(alias).toLowerCase() === normalized));
        const partial = exact || catalog.find((item) => (item.match || []).some((alias) =>
            normalized.includes(String(alias).toLowerCase()) || String(alias).toLowerCase().includes(normalized)));
        return partial || {
            key: 'generic-access',
            label: systemName || 'Access',
            fields: [
                { key: 'accountId', label: 'Account ID / Email', type: 'text', required: true },
                { key: 'role', label: 'Role', type: 'text', required: false },
                { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
            ],
        };
    };

    const runAction = async (id, fn) => {
        try {
            setBusyId(id || 'add');
            await fn();
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setBusyId(null);
        }
    };

    const addRequest = () => runAction('add', async () => {
        if (!newSystem.trim()) {
            toast.error('Enter a system name');
            return;
        }
        setAdding(true);
        try {
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests`,
                {
                    system: newSystem.trim(),
                    category: newCategory,
                    mandatory: newMandatory,
                    notes: newNotes.trim() || undefined,
                },
            );
            toast.success('Access added to this onboarding');
            setNewSystem('');
            setNewCategory('application');
            setNewMandatory(true);
            setNewNotes('');
            setShowAdd(false);
        } finally {
            setAdding(false);
        }
    });

    const approve = (requestId, approved) => runAction(requestId, async () => {
        await axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${requestId}/approve`,
            { approved },
        );
        toast.success(approved ? 'Approved' : 'Rejected');
    });

    const submitProvisionReview = () => runAction(reviewTarget?._id, async () => {
        if (!reviewTarget) return;
        const template = getTemplate(reviewTarget.system || reviewTarget.softwareName || reviewTarget.name);
        for (const field of template.fields || []) {
            if (field.required && !String(reviewValues[field.key] || '').trim()) {
                toast.error(`${field.label} is required`);
                return;
            }
        }
        await axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${reviewTarget._id}/approve`,
            {
                approved: true,
                notes: reviewRemarks,
                provisioningDetails: reviewValues,
            },
        );
        toast.success('Access reviewed and approved');
        setReviewTarget(null);
        setReviewValues({});
        setReviewRemarks('');
    });

    const markProvisioned = (requestId) => runAction(requestId, async () => {
        await axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${requestId}/provision`,
            {},
        );
        toast.success('Marked as provisioned');
    });

    if (!canAccessEnterpriseHub) return null;

    return (
        <div className="cm-card cm-access-card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="cm-title-sm mb-0 flex items-center gap-2 text-base">
                        <FaKey className="text-[var(--cm-primary-deep)]" /> Access Control
                    </h3>
                    {summary.total > 0 ? (
                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                            {isEmployee ? 'Visible access for this onboarding' : `${summary.provisioned} of ${summary.total} provisioned`}
                            {summary.pending > 0 ? ` · ${summary.pending} pending` : ''}
                        </p>
                    ) : (
                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                            {isEmployee ? 'Access provided by HR will appear here.' : 'Provide apps, email, network, and tool access from here.'}
                        </p>
                    )}
                </div>
                {isHr && workflowId && (
                    <CmButton
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAdd((v) => !v)}
                    >
                        {showAdd ? <FaEdit className="mr-1" /> : <FaPlus className="mr-1" />}
                        {showAdd ? 'Cancel' : 'Add access'}
                    </CmButton>
                )}
            </div>

            {showAdd && isHr && (
                <div className="cm-access-form">
                    <div className="cm-access-form__grid">
                        <div className="cm-access-form__field cm-access-form__field--wide">
                            <label className="cm-label">System</label>
                            <input
                                className="cm-input mt-1 w-full"
                                placeholder="System (e.g. Slack, GitHub, VPN)"
                                value={newSystem}
                                onChange={(e) => setNewSystem(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addRequest();
                                    }
                                }}
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                                {QUICK_ACCESS_SYSTEMS.map((system) => (
                                    <button
                                        key={system}
                                        type="button"
                                        className="cm-chip"
                                        onClick={() => setNewSystem(system)}
                                    >
                                        {system}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="cm-access-form__field">
                            <label className="cm-label">Category</label>
                            <select
                                className="cm-select mt-1 w-full"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            >
                                {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="cm-access-form__field">
                            <label className="cm-label">Day-1 access</label>
                            <label className="mt-2 inline-flex items-center gap-2 text-sm text-[var(--cm-on-surface)]">
                                <input
                                    type="checkbox"
                                    checked={newMandatory}
                                    onChange={(e) => setNewMandatory(e.target.checked)}
                                />
                                Required for onboarding
                            </label>
                        </div>
                        <div className="cm-access-form__field cm-access-form__field--wide">
                            <label className="cm-label">Notes</label>
                            <textarea
                                className="cm-input mt-1 min-h-[5rem] w-full rounded-2xl"
                                placeholder="Optional note for IT or approver"
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                        <CmButton
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={adding || busyId === 'add'}
                            onClick={addRequest}
                        >
                            Provide access
                        </CmButton>
                    </div>
                </div>
            )}

            {rows.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--cm-muted)]">
                    No software access requests yet.
                    {isHr ? ' Use Add access to request tools for this hire.' : ''}
                </p>
            ) : (
                <ul className="cm-access-list">
                    {rows.map((req) => {
                        const name = req.system || req.softwareName || req.name || 'Software';
                        const Icon = systemIcon(name);
                        const st = accessStatusMeta(req);
                        const provisioning = parseProvisioningNotes(req.notes);
                        const doneDate = formatDate(req.provisionedAt);
                        const category = CATEGORY_LABEL[req.category] || CATEGORY_LABEL.application;
                        const busy = busyId === req._id;
                        const canApprove = isHr && req.approvalStatus === 'Pending';
                        const canProvision = isHr && ['Approved', 'Ticket Created', 'Assigned', 'In Progress'].includes(req.status);

                        return (
                            <li key={req._id || name} className="cm-access-row">
                                <span className="cm-access-row__icon" aria-hidden>
                                    <Icon />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-semibold text-[var(--cm-on-surface)]">
                                            {name}
                                        </p>
                                        {req.mandatory && (
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--cm-tertiary)]">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-xs text-[var(--cm-muted)]">
                                        {category}
                                        {doneDate ? ` · Provisioned ${doneDate}` : ''}
                                        {!doneDate && req.ticketId ? ` · Ticket ${req.ticketId}` : ''}
                                    </p>
                                    {isEmployee && (
                                        <p className="mt-1 text-xs font-medium text-[var(--cm-on-variant)]">
                                            {employeeStatusCopy(req)}
                                        </p>
                                    )}
                                    {provisioning.legacyNotes && (
                                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                                            {provisioning.legacyNotes}
                                        </p>
                                    )}
                                    {provisioning.systemNote && (
                                        <div className="mt-2 rounded-lg bg-[var(--cm-surface-low)] px-3 py-2 text-xs text-[var(--cm-on-variant)]">
                                            {isEmployee
                                                ? (String(provisioning.systemNote).toLowerCase().includes('manual')
                                                    ? 'HR has approved this access. IT will finish provisioning and update the status here.'
                                                    : provisioning.systemNote)
                                                : provisioning.systemNote}
                                        </div>
                                    )}
                                    {Object.keys(provisioning.details || {}).length > 0 && (
                                        <div className="mt-3 rounded-xl bg-[var(--cm-surface-low)] p-3">
                                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--cm-muted)]">
                                                {isEmployee ? 'Access details' : 'Provisioning details'}
                                            </p>
                                            <dl className="cm-access-details">
                                                {Object.entries(provisioning.details).map(([key, value]) => (
                                                    value ? (
                                                        <div key={key}>
                                                            <dt>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</dt>
                                                            <dd>{String(value)}</dd>
                                                        </div>
                                                    ) : null
                                                ))}
                                                {provisioning.assignedByName && (
                                                    <>
                                                        <div>
                                                            <dt>Assigned By</dt>
                                                            <dd>{provisioning.assignedByName}</dd>
                                                        </div>
                                                        <div>
                                                            <dt>Assigned On</dt>
                                                            <dd>{formatDate(provisioning.assignedOn) || '—'}</dd>
                                                        </div>
                                                    </>
                                                )}
                                            </dl>
                                        </div>
                                    )}
                                    {provisioning.timeline?.length > 0 && (
                                        <div className="mt-3">
                                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--cm-muted)]">Timeline</p>
                                            <ul className="cm-access-timeline">
                                                {provisioning.timeline.map((entry, index) => (
                                                    <li key={`${entry.type}-${entry.at || index}`}>
                                                        <span className="cm-access-timeline__dot" aria-hidden />
                                                        <div>
                                                            <p className="text-xs font-semibold text-[var(--cm-on-surface)]">{entry.label}</p>
                                                            <p className="text-[11px] text-[var(--cm-muted)]">
                                                                {entry.by || 'System'}
                                                                {entry.at ? ` · ${formatDate(entry.at)}` : ''}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {req.ticketUrl && (
                                        <a
                                            href={req.ticketUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="cm-link mt-1 inline-flex items-center gap-1 text-xs font-semibold"
                                        >
                                            Open ticket <FaExternalLinkAlt className="text-[9px]" />
                                        </a>
                                    )}
                                    {(canApprove || canProvision) && (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {canApprove && (
                                                <>
                                                    <CmButton
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() => {
                                                            const template = getTemplate(name);
                                                            const initial = {};
                                                            (template.fields || []).forEach((field) => {
                                                                if (field.key !== 'remarks') initial[field.key] = provisioning.details?.[field.key] || '';
                                                            });
                                                            setReviewTarget(req);
                                                            setReviewValues(initial);
                                                            setReviewRemarks(provisioning.legacyNotes || provisioning.details?.remarks || '');
                                                        }}
                                                    >
                                                        Approve
                                                    </CmButton>
                                                    <CmButton variant="outline" size="sm" disabled={busy} onClick={() => approve(req._id, false)}>
                                                        Reject
                                                    </CmButton>
                                                </>
                                            )}
                                            {canProvision && (
                                                <CmButton variant="secondary" size="sm" disabled={busy} onClick={() => markProvisioned(req._id)}>
                                                    <FaCheck className="mr-1" /> Mark provisioned
                                                </CmButton>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className={st.className}>{st.label}</span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {reviewTarget && (
                <div className="cm-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="access-review-title">
                    <div className="cm-modal">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 id="access-review-title" className="cm-title-sm mb-1">Review &amp; Provision</h3>
                                <p className="text-sm text-[var(--cm-muted)]">
                                    Provide access details for {reviewTarget.system || reviewTarget.name}.
                                </p>
                            </div>
                            <button type="button" className="cm-icon-btn" onClick={() => setReviewTarget(null)} aria-label="Close review modal">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {(getTemplate(reviewTarget.system || reviewTarget.name).fields || []).map((field) => (
                                field.key === 'remarks' ? null : (
                                    <div key={field.key}>
                                        <label className="cm-label">
                                            {field.label}{field.required ? ' *' : ''}
                                        </label>
                                        <input
                                            type={field.type === 'email' ? 'email' : 'text'}
                                            className="cm-input mt-1 w-full"
                                            value={reviewValues[field.key] || ''}
                                            onChange={(e) => setReviewValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        />
                                    </div>
                                )
                            ))}
                            <div>
                                <label className="cm-label">Remarks</label>
                                <textarea
                                    className="cm-input mt-1 min-h-[5rem] w-full rounded-2xl"
                                    value={reviewRemarks}
                                    onChange={(e) => setReviewRemarks(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <CmButton type="button" variant="outline" onClick={() => setReviewTarget(null)}>
                                Cancel
                            </CmButton>
                            <CmButton type="button" variant="primary" disabled={busyId === reviewTarget._id || loadingCatalog} onClick={submitProvisionReview}>
                                Submit
                            </CmButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
