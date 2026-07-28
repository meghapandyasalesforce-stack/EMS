import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
    FaComments, FaEnvelope, FaExclamationTriangle, FaGithub, FaLaptop, FaProjectDiagram, FaSync, FaTicketAlt, FaWindows,
} from 'react-icons/fa';
import { MdVpnLock } from 'react-icons/md';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CmBadge, CmButton, CmStat, CmEmpty, statusTone } from '../../components/corporateModern';
import { canAccessLifecycleEnterpriseHub } from '../../utils/managerHelper';

const KNOWN_SYSTEMS = [
    { key: 'laptop', label: 'Laptop Assigned', match: /laptop|device|macbook|hardware/i, icon: FaLaptop },
    { key: 'email', label: 'Email Created', match: /email|outlook|google workspace|gmail/i, icon: FaEnvelope },
    { key: 'vpn', label: 'VPN', match: /vpn/i, icon: MdVpnLock },
    { key: 'github', label: 'GitHub', match: /github/i, icon: FaGithub },
    { key: 'jira', label: 'Jira', match: /jira/i, icon: FaProjectDiagram },
    { key: 'slack', label: 'Slack', match: /slack/i, icon: FaComments },
    { key: 'm365', label: 'Microsoft 365', match: /microsoft|m365|office 365|o365/i, icon: FaWindows },
];

function findSystemRow(bySystem = [], matcher) {
    return (bySystem || []).find((s) => matcher.test(String(s.system || '')));
}

/**
 * IT Provisioning — org inventory (HR) or per-workflow requests.
 * UI-only; reuses /it/inventory, ticketing providers, software-request APIs.
 */
const ItProvisioningPanel = ({ workflowId, softwareRequests: requestsProp = [], isHRView, onUpdated }) => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};
    const canAccessEnterpriseHub = canAccessLifecycleEnterpriseHub(user || employee, permissionFlags, employee);
    const [loading, setLoading] = useState(!requestsProp?.length);
    const [requests, setRequests] = useState(requestsProp);
    const [inventory, setInventory] = useState(null);
    const [providers, setProviders] = useState([]);
    const [error, setError] = useState('');
    const [system, setSystem] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    useEffect(() => {
        setRequests(requestsProp || []);
    }, [requestsProp]);

    const loadInventory = useCallback(async () => {
        if (!canAccessEnterpriseHub || !isHRView || workflowId) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError('');
            const [inv, prov] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/it/inventory`),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/it/ticketing-providers`).catch(() => ({ data: { data: [] } })),
            ]);
            setInventory(inv.data.data || { totals: {}, bySystem: [] });
            setProviders(prov.data.data || []);
            setLastSync(new Date());
        } catch (err) {
            setInventory({ totals: { pending: 0, provisioned: 0, revoked: 0, systems: 0 }, bySystem: [] });
            setError(err.response?.data?.message || 'Could not load IT inventory');
        } finally {
            setLoading(false);
        }
    }, [canAccessEnterpriseHub, isHRView, workflowId]);

    useEffect(() => { loadInventory(); }, [loadInventory]);

    const addRequest = async () => {
        if (!system.trim()) return;
        try {
            setSubmitting(true);
            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests`,
                { system, category: 'application' },
            );
            setRequests(data.data || []);
            toast.success('Software request created');
            setSystem('');
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    const approve = async (requestId, approved) => {
        try {
            setSubmitting(true);
            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${requestId}/approve`,
                { approved },
            );
            const reqItem = data?.data?.request || data?.data;
            if (approved && (reqItem?.status === 'Approved' || reqItem?.notes?.includes('Manual Processing Required'))) {
                toast.success('Approved — Manual Processing Required until IT marks provisioned');
            } else {
                toast.success(approved ? 'Approved & ticket created' : 'Rejected');
            }
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed');
        } finally {
            setSubmitting(false);
        }
    };

    const markProvisioned = async (requestId) => {
        try {
            setSubmitting(true);
            await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/onboarding/${workflowId}/software-requests/${requestId}/provision`,
                {},
            );
            toast.success('Marked as Provisioned');
            onUpdated?.();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark provisioned');
        } finally {
            setSubmitting(false);
        }
    };

    const systemCards = useMemo(() => {
        const bySystem = inventory?.bySystem || [];
        return KNOWN_SYSTEMS.map((def) => {
            const row = findSystemRow(bySystem, def.match);
            const pending = row?.pending || 0;
            const provisioned = row?.provisioned || 0;
            const total = row?.total || 0;
            let status = 'Not tracked';
            let tone = 'gray';
            if (total > 0) {
                if (pending > 0) { status = `${pending} pending`; tone = 'amber'; }
                else if (provisioned > 0) { status = `${provisioned} provisioned`; tone = 'emerald'; }
                else { status = `${total} requests`; tone = 'blue'; }
            }
            return { ...def, pending, provisioned, total, status, tone };
        });
    }, [inventory]);

    const otherSystems = useMemo(() => {
        const bySystem = inventory?.bySystem || [];
        return bySystem.filter((s) => !KNOWN_SYSTEMS.some((k) => k.match.test(String(s.system || ''))));
    }, [inventory]);

    if (!canAccessEnterpriseHub) return null;

    if (loading && !workflowId) {
        return <LoadingSpinner message="Loading IT provisioning..." />;
    }

    // ── Workflow-scoped view (onboarding detail) ──
    // Strictly UI-only gating: employees see the original, unstyled markup;
    // only the HR-facing render path picks up Corporate-Modern classes.
    if (workflowId && isHRView) {
        return (
            <div className="cm-hrms">
                <div className="cm-page">
                    <div className="flex flex-wrap gap-2">
                        <input
                            value={system}
                            onChange={(e) => setSystem(e.target.value)}
                            placeholder="System (e.g. GitHub, Jira, Slack, VPN)"
                            className="cm-input min-w-[160px] flex-1"
                        />
                        <CmButton disabled={submitting} onClick={addRequest}>Request</CmButton>
                    </div>
                    <div className="space-y-2.5">
                        {(requests || []).map((r) => (
                            <div key={r._id} className="cm-card cm-card--inset flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--cm-on-surface)' }}>{r.system}</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <CmBadge tone={statusTone(r.status)}>{r.status}</CmBadge>
                                        <span className="text-xs" style={{ color: 'var(--cm-muted)' }}>{r.approvalStatus}</span>
                                    </div>
                                    {r.ticketUrl && (
                                        <a href={r.ticketUrl} target="_blank" rel="noreferrer" className="cm-link mt-1 block text-xs">
                                            Ticket {r.ticketId}
                                        </a>
                                    )}
                                </div>
                                {r.approvalStatus === 'Pending' && (
                                    <div className="flex gap-2">
                                        <CmButton size="sm" disabled={submitting} onClick={() => approve(r._id, true)}>Approve</CmButton>
                                        <CmButton variant="outline" size="sm" disabled={submitting} onClick={() => approve(r._id, false)} style={{ color: 'var(--cm-error)' }}>Reject</CmButton>
                                    </div>
                                )}
                                {['Approved', 'Ticket Created', 'Assigned', 'In Progress'].includes(r.status) && (
                                    <CmButton variant="secondary" size="sm" disabled={submitting} onClick={() => markProvisioned(r._id)}>
                                        Mark Provisioned
                                    </CmButton>
                                )}
                                {r.notes?.includes('Manual Processing Required') && (
                                    <p className="w-full text-xs" style={{ color: 'var(--cm-tertiary-deep)' }}>Manual Processing Required</p>
                                )}
                            </div>
                        ))}
                        {!requests?.length && <p className="text-sm" style={{ color: 'var(--cm-muted)' }}>No software requests yet.</p>}
                    </div>
                </div>
            </div>
        );
    }

    if (workflowId) {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    <input
                        value={system}
                        onChange={(e) => setSystem(e.target.value)}
                        placeholder="System (e.g. GitHub, Jira, Slack, VPN)"
                        className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={addRequest}
                        className="rounded-lg bg-theme-primary px-3 py-2 text-sm text-white disabled:opacity-50"
                    >
                        Request
                    </button>
                </div>
                <div className="space-y-2">
                    {(requests || []).map((r) => (
                        <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 p-3">
                            <div>
                                <p className="text-sm font-medium">{r.system}</p>
                                <p className="text-xs text-gray-500">{r.status} · {r.approvalStatus}</p>
                                {r.ticketUrl && (
                                    <a href={r.ticketUrl} target="_blank" rel="noreferrer" className="text-xs text-theme-primary underline">
                                        Ticket {r.ticketId}
                                    </a>
                                )}
                            </div>
                            {isHRView && r.approvalStatus === 'Pending' && (
                                <div className="flex gap-2">
                                    <button type="button" disabled={submitting} onClick={() => approve(r._id, true)} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white">Approve</button>
                                    <button type="button" disabled={submitting} onClick={() => approve(r._id, false)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-600">Reject</button>
                                </div>
                            )}
                            {isHRView && ['Approved', 'Ticket Created', 'Assigned', 'In Progress'].includes(r.status) && (
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => markProvisioned(r._id)}
                                    className="rounded bg-sky-600 px-2 py-1 text-xs text-white"
                                >
                                    Mark Provisioned
                                </button>
                            )}
                            {r.notes?.includes('Manual Processing Required') && (
                                <p className="w-full text-xs text-amber-700">Manual Processing Required</p>
                            )}
                        </div>
                    ))}
                    {!requests?.length && <p className="text-sm text-gray-500">No software requests yet.</p>}
                </div>
            </div>
        );
    }

    // ── Enterprise HR inventory view ──
    const totals = inventory?.totals || {};

    if (!isHRView) {
        // Defensive fallback — this view is only ever mounted with isHRView, but
        // keep an unstyled render path in case it's ever reached without it.
        return (
            <div className="space-y-5">
                <p className="text-sm text-gray-500">IT provisioning inventory is only available to HR.</p>
            </div>
        );
    }

    const emailPending = systemCards.find((s) => s.key === 'email')?.pending ?? 0;
    const laptopPending = systemCards.find((s) => s.key === 'laptop')?.pending ?? 0;
    const unconfiguredVendors = systemCards.filter((s) => s.tone === 'gray').length;

    const toneBadge = (tone) => ({ emerald: 'done', amber: 'attention', blue: 'progress', gray: 'neutral' }[tone] || 'neutral');

    return (
        <div className="cm-hrms">
            <div className="cm-page">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="cm-title">IT Provisioning Tracker</p>
                        <p className="cm-subtitle">
                            Live software & access inventory across onboarding workflows
                            {lastSync ? ` · Updated ${lastSync.toLocaleTimeString()}` : ''}
                        </p>
                    </div>
                    <CmButton variant="outline" size="sm" onClick={loadInventory}>
                        <FaSync /> Refresh
                    </CmButton>
                </div>

                {error && (
                    <div className="cm-banner cm-banner--attention">{error}</div>
                )}

                <div className="cm-kpi-row cm-kpi-row--3">
                    <CmStat
                        label="Pending Email Setup"
                        value={emailPending}
                        attention={emailPending > 0}
                        meta={emailPending > 0 ? 'Needs setup today' : 'All accounts provisioned'}
                        metaTone={emailPending > 0 ? 'attention' : 'positive'}
                        icon={<FaEnvelope />}
                        iconAttention={emailPending > 0}
                    />
                    <CmStat
                        label="Pending Asset Handover"
                        value={laptopPending}
                        attention={laptopPending > 0}
                        meta={laptopPending > 0 ? 'Awaiting handover' : 'All assets handed over'}
                        metaTone={laptopPending > 0 ? 'attention' : 'positive'}
                        icon={<FaLaptop />}
                        iconAttention={laptopPending > 0}
                    />
                    <CmStat
                        label="Unconfigured Vendors"
                        value={unconfiguredVendors}
                        attention={unconfiguredVendors > 0}
                        meta={unconfiguredVendors > 0 ? 'ALERT — action required' : 'All vendors configured'}
                        metaTone={unconfiguredVendors > 0 ? 'attention' : 'positive'}
                        icon={<FaExclamationTriangle />}
                        iconAttention={unconfiguredVendors > 0}
                    />
                </div>

                <div className="cm-card">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="cm-title-sm">Provisioning Pipeline</p>
                            <p className="cm-subtitle">Access & asset widgets synced from onboarding software requests</p>
                        </div>
                        <CmButton size="sm">
                            <FaSync className="text-xs" /> New Provisioning Request
                        </CmButton>
                    </div>
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead>
                                <tr>
                                    <th>System</th>
                                    <th>Status</th>
                                    <th>Pending</th>
                                    <th>Provisioned</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {systemCards.map((s) => {
                                    const Icon = s.icon;
                                    return (
                                        <tr key={s.key}>
                                            <td>
                                                <div className="flex items-center gap-2.5">
                                                    <span
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                                                        style={{ background: 'var(--cm-surface-container)', color: 'var(--cm-primary-deep)' }}
                                                    >
                                                        <Icon className="text-sm" />
                                                    </span>
                                                    <span className="text-sm font-semibold" style={{ color: 'var(--cm-on-surface)' }}>{s.label}</span>
                                                </div>
                                            </td>
                                            <td><CmBadge tone={toneBadge(s.tone)}>{s.status}</CmBadge></td>
                                            <td className="text-sm" style={{ color: 'var(--cm-muted)' }}>{s.pending}</td>
                                            <td className="text-sm" style={{ color: 'var(--cm-muted)' }}>{s.provisioned}</td>
                                            <td className="text-sm" style={{ color: 'var(--cm-muted)' }}>{s.total}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="cm-pagination">
                        <span>Showing {systemCards.length} systems{totals.systems ? ` of ${totals.systems} tracked` : ''}</span>
                        <span className="text-xs" style={{ color: 'var(--cm-muted)' }}>
                            {totals.provisioned ?? 0} provisioned · {totals.pending ?? 0} pending · {totals.revoked ?? 0} revoked
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <div className="cm-promo cm-promo--teal">
                        <div>
                            <p className="cm-promo__title">Automate New Hires?</p>
                            <p className="cm-promo__desc">
                                Connect your ticketing and identity providers once to auto-provision email, assets, and
                                system access for every new hire — no manual requests needed.
                            </p>
                        </div>
                        <CmButton className="cm-btn--on-dark">Explore Integrations</CmButton>
                    </div>

                    <div className="cm-promo cm-promo--alert">
                        <p className="cm-promo__title" style={{ fontSize: '1rem' }}>Vendor Alert</p>
                        <p className="text-sm">
                            {unconfiguredVendors} vendor system{unconfiguredVendors === 1 ? '' : 's'} still need ticketing
                            configuration before requests can be auto-routed.
                        </p>
                    </div>
                </div>

                <div className="cm-split">
                    <div className="cm-card">
                        <p className="cm-title-sm mb-3">Pending & Tracked Systems</p>
                        <div className="max-h-64 space-y-2.5 overflow-y-auto">
                            {(inventory?.bySystem || []).length === 0 ? (
                                <CmEmpty icon={<FaLaptop />} title="No software requests yet">
                                    Requests appear here when created on employee onboarding workflows (GitHub, Jira, Slack, email, VPN, etc.).
                                </CmEmpty>
                            ) : (
                                (inventory.bySystem || []).map((row) => (
                                    <div key={row.system} className="cm-card cm-card--inset flex items-center justify-between text-sm">
                                        <div>
                                            <p className="font-semibold" style={{ color: 'var(--cm-on-surface)' }}>{row.system}</p>
                                            <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>{row.total} total requests</p>
                                        </div>
                                        <div className="text-right text-xs">
                                            <p className="font-semibold" style={{ color: 'var(--cm-tertiary-deep)' }}>{row.pending} pending</p>
                                            <p style={{ color: 'var(--cm-primary-deep)' }}>{row.provisioned} provisioned</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {otherSystems.length > 0 && (
                            <p className="mt-2 text-[11px]" style={{ color: 'var(--cm-muted)' }}>
                                Includes custom systems beyond the standard access widgets.
                            </p>
                        )}
                    </div>

                    <div className="cm-card">
                        <p className="cm-label mb-3 flex items-center gap-2">
                            <FaTicketAlt /> Ticketing Integration
                        </p>
                        <p className="mb-3 text-xs" style={{ color: 'var(--cm-muted)' }}>
                            Approving a software request can open a ticket via the configured IT ticketing provider.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {(providers.length ? providers : [{ key: 'manual', label: 'Manual' }]).map((p) => (
                                <CmBadge key={p.key || p.label} tone="neutral" dot={false}>
                                    {p.label || p.key}
                                </CmBadge>
                            ))}
                        </div>
                        <div className="cm-banner cm-banner--info mt-4">
                            <p className="font-semibold" style={{ color: 'var(--cm-primary-deep)' }}>How to provision</p>
                            <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs" style={{ color: 'var(--cm-on-variant)' }}>
                                <li>Open an employee onboarding workflow.</li>
                                <li>Add software / access requests (Email, VPN, GitHub, Jira…).</li>
                                <li>Approve from the workflow — tickets sync here automatically.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItProvisioningPanel;
