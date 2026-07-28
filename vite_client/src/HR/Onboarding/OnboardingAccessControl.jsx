import React, { useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import {
    FaComments, FaEnvelope, FaGithub, FaKey, FaLaptop, FaProjectDiagram,
    FaWindows, FaEdit, FaExternalLinkAlt, FaCheck,
} from 'react-icons/fa';
import { MdVpnLock } from 'react-icons/md';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import { CmButton } from '../../components/corporateModern';

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

/**
 * Tasks-tab Access Control list — system name, status, dates, HR actions.
 */
export default function OnboardingAccessControl({
    workflowId,
    softwareRequests = [],
    viewerRole = 'hr',
    onUpdated,
}) {
    const isHr = viewerRole === 'hr';
    const [busyId, setBusyId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [newSystem, setNewSystem] = useState('');
    const [showAdd, setShowAdd] = useState(false);

    const rows = useMemo(() => softwareRequests || [], [softwareRequests]);

    const summary = useMemo(() => {
        const provisioned = rows.filter((r) => /provision|complet/i.test(String(r.status || ''))).length;
        return { total: rows.length, provisioned, pending: rows.length - provisioned };
    }, [rows]);

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
                { system: newSystem.trim(), category: 'application' },
            );
            toast.success('Access request added');
            setNewSystem('');
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

    const markProvisioned = (requestId) => runAction(requestId, async () => {
        await axios.post(
            `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${requestId}/provision`,
            {},
        );
        toast.success('Marked as provisioned');
    });

    return (
        <div className="cm-card cm-access-card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="cm-title-sm mb-0 flex items-center gap-2 text-base">
                        <FaKey className="text-[var(--cm-primary-deep)]" /> Access Control
                    </h3>
                    {summary.total > 0 && (
                        <p className="mt-1 text-xs text-[var(--cm-muted)]">
                            {summary.provisioned} of {summary.total} provisioned
                            {summary.pending > 0 ? ` · ${summary.pending} pending` : ''}
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
                        <FaEdit className="mr-1" /> {showAdd ? 'Cancel' : 'Add access'}
                    </CmButton>
                )}
            </div>

            {showAdd && isHr && (
                <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-[var(--cm-surface-low)] p-3">
                    <input
                        className="cm-input min-w-[10rem] flex-1"
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
                    <CmButton
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={adding || busyId === 'add'}
                        onClick={addRequest}
                    >
                        Add
                    </CmButton>
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
                                                    <CmButton size="sm" disabled={busy} onClick={() => approve(req._id, true)}>
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
        </div>
    );
}
