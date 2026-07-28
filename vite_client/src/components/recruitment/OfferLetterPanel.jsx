import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaCheckCircle, FaClock, FaCopy, FaEye, FaFilePdf, FaPaperPlane, FaRedo,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../LoadingSpinner';
import { CmBadge, CmButton, CmStat, statusTone } from '../corporateModern';

/**
 * Offer Management — Corporate-Modern HR/recruitment view. Admin/HR-only
 * (never rendered on the public candidate portal). UI-only restyle; all
 * data loading and action handlers are unchanged.
 */
const OfferLetterPanel = ({ candidateId, candidate, onRefresh }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [offers, setOffers] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [settings, setSettings] = useState(null);
    const [auditLogs, setAuditLogs] = useState([]);
    const [showCreate, setShowCreate] = useState(false);
    const [previewOffer, setPreviewOffer] = useState(null);
    const [form, setForm] = useState({
        templateId: '',
        position: '',
        department: '',
        salary: '',
        startDate: '',
        expiryDate: '',
        benefits: '',
    });

    const defaultExpiryDays = settings?.offerPolicy?.defaultExpiryDays ?? 7;

    const load = useCallback(async () => {
        if (!candidateId) return;
        try {
            setLoading(true);
            const [offersRes, templatesRes, registryRes] = await Promise.all([
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/candidate/${candidateId}`, { withCredentials: true }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/templates`, { withCredentials: true }),
                axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/registry`, { withCredentials: true }),
            ]);
            if (offersRes.data?.success) setOffers(offersRes.data.data || []);
            if (templatesRes.data?.success) setTemplates(templatesRes.data.data || []);
            if (registryRes.data?.success) setSettings(registryRes.data.data?.settings || null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load offer data');
        } finally {
            setLoading(false);
        }
    }, [candidateId]);

    useEffect(() => { load(); }, [load]);

    const activeOffer = useMemo(() => offers[0] || null, [offers]);

    useEffect(() => {
        if (!activeOffer?._id) {
            setAuditLogs([]);
            return;
        }
        axios.get(`/v1/admin/audit-logs/entity/Offer/${activeOffer._id}`, { withCredentials: true })
            .then((res) => {
                const payload = res.data?.data;
                const logs = Array.isArray(payload) ? payload : (payload?.items || payload?.logs || []);
                setAuditLogs(logs);
            })
            .catch(() => setAuditLogs([]));
    }, [activeOffer?._id]);

    useEffect(() => {
        if (!showCreate) return;
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + Number(defaultExpiryDays || 7));
        setForm({
            templateId: templates.find((t) => t.isDefault)?._id || templates[0]?._id || '',
            position: candidate?.offerDetails?.position || candidate?.jobPostingId?.jobTitle || '',
            department: candidate?.jobPostingId?.department || '',
            salary: candidate?.offerDetails?.salary || '',
            startDate: candidate?.offerDetails?.startDate
                ? format(new Date(candidate.offerDetails.startDate), 'yyyy-MM-dd') : '',
            expiryDate: format(expiry, 'yyyy-MM-dd'),
            benefits: (candidate?.offerDetails?.benefits || []).join(', '),
        });
    }, [showCreate, templates, candidate, defaultExpiryDays]);

    const runAction = async (request, message) => {
        try {
            setSubmitting(true);
            const response = await request();
            toast.success(message);
            await load();
            onRefresh?.();
            return response?.data?.data;
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    const createOffer = async (event) => {
        event.preventDefault();
        const payload = {
            candidateId,
            templateId: form.templateId || undefined,
            position: form.position,
            department: form.department,
            salary: form.salary ? Number(form.salary) : undefined,
            startDate: form.startDate || undefined,
            expiryDate: form.expiryDate || undefined,
            benefits: form.benefits ? form.benefits.split(',').map((b) => b.trim()).filter(Boolean) : [],
        };
        const created = await runAction(
            () => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers`, payload, { withCredentials: true }),
            'Offer letter generated',
        );
        if (created) setShowCreate(false);
    };

    const portalUrl = (offer) => {
        if (!offer?.portalToken) return null;
        return `${window.location.origin}/offer/${offer.portalToken}`;
    };

    const copyPortalLink = (offer) => {
        const url = portalUrl(offer);
        if (!url) {
            toast.error('Portal link not available — send the offer first');
            return;
        }
        navigator.clipboard.writeText(url).then(() => toast.success('Portal link copied'));
    };

    if (loading) return <LoadingSpinner message="Loading offers..." />;

    // ── KPI strip + pipeline grouping (derived, read-only) ──
    const totalOffers = offers.length;
    const acceptedCount = offers.filter((o) => o.status === 'Accepted').length;
    const sentLikeCount = offers.filter((o) => ['Sent', 'Viewed', 'Accepted', 'Declined'].includes(o.status)).length;
    const acceptanceRate = sentLikeCount > 0 ? Math.round((acceptedCount / sentLikeCount) * 100) : 0;
    const avgResponseDays = (() => {
        const responded = offers.filter((o) => o.sentAt && (o.acceptedAt || o.declinedAt));
        if (!responded.length) return null;
        const totalDays = responded.reduce((sum, o) => {
            const days = (new Date(o.acceptedAt || o.declinedAt) - new Date(o.sentAt)) / (1000 * 60 * 60 * 24);
            return sum + days;
        }, 0);
        return Math.round((totalDays / responded.length) * 10) / 10;
    })();

    const pipelineColumns = [
        { key: 'draft', label: 'Draft', statuses: ['Draft', 'PendingApproval'] },
        { key: 'sent', label: 'Sent', statuses: ['Approved', 'Sent'] },
        { key: 'viewed', label: 'Viewed', statuses: ['Viewed', 'Accepted', 'Declined', 'Expired', 'Cancelled'] },
    ].map((col) => ({ ...col, offers: offers.filter((o) => col.statuses.includes(o.status)) }));

    return (
        <div className="cm-hrms">
            <div className="cm-page">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="cm-title">Offer Management</p>
                        <p className="cm-subtitle">Generate, approve, and send offers to this candidate</p>
                    </div>
                    <CmButton onClick={() => setShowCreate(true)} disabled={submitting}>
                        + New Offer
                    </CmButton>
                </div>

                <div className="cm-kpi-row cm-kpi-row--3">
                    <CmStat label="Offers Sent" value={sentLikeCount} icon={<FaPaperPlane />} />
                    <CmStat
                        label="Acceptance Rate"
                        value={`${acceptanceRate}%`}
                        meta={`${acceptedCount} of ${sentLikeCount} responded`}
                        icon={<FaCheckCircle />}
                    />
                    <CmStat
                        label="Avg Time-to-Accept"
                        value={avgResponseDays != null ? `${avgResponseDays}d` : '—'}
                        icon={<FaClock />}
                        iconAttention={avgResponseDays != null && avgResponseDays > 5}
                    />
                </div>

                {offers.length === 0 ? (
                    <div className="cm-empty">No offer letters yet for this candidate.</div>
                ) : (
                    <div className="cm-kanban">
                        {pipelineColumns.map((col) => (
                            <div key={col.key} className="cm-kanban__col">
                                <div className="cm-kanban__header">
                                    <span>{col.label}</span>
                                    <CmBadge tone="neutral" dot={false}>{col.offers.length}</CmBadge>
                                </div>
                                {col.offers.length === 0 ? (
                                    <div className="cm-card cm-card--dashed text-center text-sm" style={{ color: 'var(--cm-muted)' }}>
                                        No offers here
                                    </div>
                                ) : col.offers.map((offer) => (
                                    <div key={offer._id} className="cm-card">
                                        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-bold" style={{ color: 'var(--cm-on-surface)' }}>
                                                    {offer.position || 'Offer'} — v{offer.version}
                                                </p>
                                                <p className="mt-1 text-xs" style={{ color: 'var(--cm-muted)' }}>
                                                    CTC: {offer.salary ? `Rs ${Number(offer.salary).toLocaleString('en-IN')}` : '—'}
                                                    {offer.startDate && ` · Joins ${format(new Date(offer.startDate), 'dd MMM yyyy')}`}
                                                    {offer.expiryDate && ` · Expires ${format(new Date(offer.expiryDate), 'dd MMM yyyy')}`}
                                                </p>
                                            </div>
                                            <CmBadge tone={statusTone(offer.status)}>{offer.status}</CmBadge>
                                        </div>

                                        <div className="mb-3 flex flex-wrap gap-2">
                                            <CmButton variant="outline" size="sm" onClick={() => setPreviewOffer(offer)}>
                                                <FaEye className="text-xs" /> Preview
                                            </CmButton>
                                            {offer.pdfUrl && (
                                                <a href={offer.pdfUrl} target="_blank" rel="noopener noreferrer" className="cm-btn cm-btn--outline cm-btn--sm">
                                                    <FaFilePdf className="text-xs" /> PDF
                                                </a>
                                            )}
                                            {['Draft', 'PendingApproval'].includes(offer.status) && (
                                                <CmButton
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => runAction(() => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/${offer._id}/submit-approval`, {}, { withCredentials: true }), 'Submitted for approval')}
                                                >
                                                    Submit for approval
                                                </CmButton>
                                            )}
                                            {['Approved', 'Draft', 'Sent', 'Viewed'].includes(offer.status) && (
                                                <CmButton
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => runAction(() => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/${offer._id}/send`, {}, { withCredentials: true }), offer.status === 'Sent' || offer.status === 'Viewed' ? 'Offer resent' : 'Offer sent')}
                                                >
                                                    {offer.status === 'Sent' || offer.status === 'Viewed' ? <><FaRedo className="text-xs" /> Resend</> : <><FaPaperPlane className="text-xs" /> Send</>}
                                                </CmButton>
                                            )}
                                            {portalUrl(offer) && (
                                                <CmButton variant="outline" size="sm" onClick={() => copyPortalLink(offer)}>
                                                    <FaCopy className="text-xs" /> Portal link
                                                </CmButton>
                                            )}
                                            {offer.status === 'PendingApproval' && (
                                                <Link to="/admin/pending-approvals" className="cm-btn cm-btn--secondary cm-btn--sm">
                                                    Review approvals
                                                </Link>
                                            )}
                                        </div>

                                        <div className="grid gap-3">
                                            <ActivityTimeline activities={offer.activityFeed || []} />
                                            {offer._id === activeOffer?._id && <AuditTimeline logs={auditLogs} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {showCreate && (
                    <div className="cm-modal-overlay" onClick={() => setShowCreate(false)}>
                        <div className="cm-modal" style={{ maxWidth: '32rem' }} onClick={(e) => e.stopPropagation()}>
                            <p className="cm-title-sm mb-4">Generate Offer Letter</p>
                            <form onSubmit={createOffer} className="space-y-3.5">
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Template</span>
                                    <select value={form.templateId} onChange={(e) => setForm((p) => ({ ...p, templateId: e.target.value }))} className="cm-select w-full">
                                        <option value="">Default template</option>
                                        {templates.filter((t) => t.isActive !== false).map((t) => (
                                            <option key={t._id} value={t._id}>{t.name}{t.isDefault ? ' (Default)' : ''}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Position</span>
                                    <input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} className="cm-input w-full" required />
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Department</span>
                                    <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} className="cm-input w-full" />
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Annual CTC (INR)</span>
                                    <input type="number" min="0" value={form.salary} onChange={(e) => setForm((p) => ({ ...p, salary: e.target.value }))} className="cm-input w-full" />
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Start date</span>
                                        <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} className="cm-input w-full" />
                                    </label>
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Expiry date</span>
                                        <input type="date" value={form.expiryDate} onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))} className="cm-input w-full" required />
                                    </label>
                                </div>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Benefits (comma-separated)</span>
                                    <input value={form.benefits} onChange={(e) => setForm((p) => ({ ...p, benefits: e.target.value }))} className="cm-input w-full" />
                                </label>
                                <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(113,121,116,0.12)' }}>
                                    <CmButton variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</CmButton>
                                    <CmButton type="submit" disabled={submitting}>{submitting ? 'Generating...' : 'Generate'}</CmButton>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {previewOffer && (
                    <div className="cm-modal-overlay" onClick={() => setPreviewOffer(null)}>
                        <div className="cm-modal" style={{ maxWidth: '48rem' }} onClick={(e) => e.stopPropagation()}>
                            <div className="mb-4 flex items-center justify-between">
                                <p className="cm-title-sm">Offer Preview — v{previewOffer.version}</p>
                                <button type="button" onClick={() => setPreviewOffer(null)} className="cm-link text-sm">Close</button>
                            </div>
                            <div
                                className="prose prose-sm max-w-none rounded-xl p-4"
                                style={{ background: 'var(--cm-surface-low)', border: '1px solid rgba(113,121,116,0.12)' }}
                                dangerouslySetInnerHTML={{ __html: previewOffer.bodyHtml || '<p>No preview content</p>' }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function ActivityTimeline({ activities }) {
    const items = [...(activities || [])].reverse();
    return (
        <div>
            <p className="cm-label mb-2 flex items-center gap-2"><FaClock /> Activity Timeline</p>
            {!items.length ? <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>No activity yet.</p> : (
                <ol className="space-y-2 pl-4" style={{ borderLeft: '2px solid rgba(113,121,116,0.15)' }}>
                    {items.map((item, index) => (
                        <li key={index} className="relative text-sm">
                            <span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full" style={{ background: 'var(--cm-primary)' }} />
                            <p className="font-medium" style={{ color: 'var(--cm-on-surface)' }}>{item.description || item.action}</p>
                            <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>{item.createdAt ? format(new Date(item.createdAt), 'dd MMM yyyy HH:mm') : ''}</p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

function AuditTimeline({ logs }) {
    return (
        <div>
            <p className="cm-label mb-2 flex items-center gap-2"><FaCheckCircle /> Audit Log</p>
            {!logs.length ? <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>No audit entries.</p> : (
                <ol className="space-y-2 pl-4" style={{ borderLeft: '2px solid rgba(113,121,116,0.15)' }}>
                    {logs.slice(0, 8).map((log) => (
                        <li key={log._id} className="relative text-sm">
                            <span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full" style={{ background: 'var(--cm-primary-deep)' }} />
                            <p className="font-medium" style={{ color: 'var(--cm-on-surface)' }}>{log.action} — {log.entityName || log.entityType}</p>
                            <p className="text-xs" style={{ color: 'var(--cm-muted)' }}>{(log.createdAt || log.timestamp) ? format(new Date(log.createdAt || log.timestamp), 'dd MMM yyyy HH:mm') : ''}</p>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}

export default OfferLetterPanel;
