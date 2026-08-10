import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaCheckCircle, FaClock, FaCopy, FaEye, FaFilePdf, FaPaperPlane, FaRedo, FaTrash,
} from 'react-icons/fa';
import axios from '../../utils/axios';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../LoadingSpinner';
import { CmBadge, CmButton, CmStat, statusTone } from '../corporateModern';
import OfferLetterHtmlPreview, { OfferMissingFieldsAlert } from './OfferLetterHtmlPreview';

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
    const [createPreview, setCreatePreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    /** Inline revise salary after counter — keyed by offer id (no prompt/modal). */
    const [reviseSalaryByOffer, setReviseSalaryByOffer] = useState({});
    const [form, setForm] = useState({
        templateType: 'html',
        templateId: '',
        position: '',
        department: '',
        salary: '',
        startDate: '',
        expiryDate: '',
        benefits: '',
        probationPeriod: '',
        noticePeriod: '',
        workingHours: '',
        annualCTCInWords: '',
        employeeESI: '',
        gratuity: '',
    });

    const htmlTemplates = useMemo(
        () => templates.filter((t) => t.isActive !== false && (t.templateType || 'html') === 'html'),
        [templates],
    );
    const pdfTemplates = useMemo(
        () => templates.filter((t) => t.isActive !== false && t.templateType === 'pdf'),
        [templates],
    );
    const filteredTemplates = form.templateType === 'pdf' ? pdfTemplates : htmlTemplates;

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
            templateType: 'html',
            templateId: htmlTemplates.find((t) => t.isDefault)?._id || htmlTemplates[0]?._id || '',
            position: candidate?.offerDetails?.position || candidate?.jobPostingId?.jobTitle || '',
            department: candidate?.jobPostingId?.department || '',
            salary: candidate?.offerDetails?.salary || '',
            startDate: candidate?.offerDetails?.startDate
                ? format(new Date(candidate.offerDetails.startDate), 'yyyy-MM-dd') : '',
            expiryDate: format(expiry, 'yyyy-MM-dd'),
            benefits: (candidate?.offerDetails?.benefits || []).join(', '),
            probationPeriod: candidate?.offerDetails?.probationPeriod || '',
            noticePeriod: '',
            workingHours: '',
            annualCTCInWords: '',
            employeeESI: '',
            gratuity: '',
        });
        setCreatePreview(null);
    }, [showCreate, htmlTemplates, candidate, defaultExpiryDays]);

    const buildOfferPayload = () => ({
        candidateId,
        templateId: form.templateId || undefined,
        position: form.position,
        department: form.department,
        salary: form.salary ? Number(form.salary) : undefined,
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        benefits: form.benefits ? form.benefits.split(',').map((b) => b.trim()).filter(Boolean) : [],
        probationPeriod: form.probationPeriod || undefined,
        noticePeriod: form.noticePeriod || undefined,
        workingHours: form.workingHours || undefined,
        annualCTCInWords: form.annualCTCInWords || undefined,
        salaryWords: form.annualCTCInWords || undefined,
        employeeESI: form.employeeESI || undefined,
        gratuity: form.gratuity || undefined,
    });

    const previewCreateOffer = async () => {
        try {
            setPreviewLoading(true);
            const { data } = await axios.post(
                `${ADMIN_LIFECYCLE_ENDPOINT}/offers/preview`,
                buildOfferPayload(),
                { withCredentials: true },
            );
            if (!data.success) throw new Error(data.message);
            setCreatePreview(data.data);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Preview failed');
        } finally {
            setPreviewLoading(false);
        }
    };

    const runAction = async (request, message) => {
        try {
            setSubmitting(true);
            const response = await request();
            toast.success(message);
            await load();
            onRefresh?.();
            return response?.data?.data;
        } catch (error) {
            const missingFields = error.response?.data?.missingFields;
            if (missingFields?.length) {
                toast.error('Missing offer information — see preview for details');
                setCreatePreview({
                    templateType: form.templateType,
                    renderedHtml: error.response?.data?.renderedHtml || '',
                    previewPdfUrl: error.response?.data?.previewPdfUrl || null,
                    isValid: false,
                    missingFields,
                });
            } else {
                toast.error(error.response?.data?.message || 'Action failed');
            }
            return null;
        } finally {
            setSubmitting(false);
        }
    };

    const createOffer = async (event) => {
        event.preventDefault();
        const created = await runAction(
            () => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers`, buildOfferPayload(), { withCredentials: true }),
            'Offer letter generated',
        );
        if (created) {
            setShowCreate(false);
            setCreatePreview(null);
        }
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

    const deleteOffer = (offer) => {
        const label = `${offer.position || 'Offer'} — v${offer.version}`;
        if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
        runAction(
            () => axios.delete(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/${offer._id}`, { withCredentials: true }),
            'Offer letter deleted',
        );
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
        { key: 'viewed', label: 'Viewed / Countered', statuses: ['Viewed', 'Accepted', 'Declined', 'Countered', 'Expired', 'Cancelled'] },
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
                                            <CmButton variant="outline" size="sm" onClick={() => setPreviewOffer((current) => (current?._id === offer._id ? null : offer))}>
                                                <FaEye className="text-xs" /> {previewOffer?._id === offer._id ? 'Hide preview' : 'Preview'}
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
                                            {['Approved', 'Draft', 'Sent', 'Viewed', 'Countered'].includes(offer.status) && (
                                                <CmButton
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => runAction(() => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/${offer._id}/send`, {}, { withCredentials: true }), offer.status === 'Sent' || offer.status === 'Viewed' ? 'Offer resent' : 'Offer sent')}
                                                >
                                                    {offer.status === 'Sent' || offer.status === 'Viewed' ? <><FaRedo className="text-xs" /> Resend</> : <><FaPaperPlane className="text-xs" /> Send</>}
                                                </CmButton>
                                            )}
                                            {offer.status === 'Countered' && (
                                                <CmButton
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => {
                                                        const salaryRaw = reviseSalaryByOffer[offer._id];
                                                        const salary = salaryRaw != null && salaryRaw !== ''
                                                            ? salaryRaw
                                                            : (offer.salary ?? '');
                                                        if (salary === '' || Number.isNaN(Number(salary))) {
                                                            toast.error('Enter a revised salary');
                                                            return;
                                                        }
                                                        runAction(
                                                            () => axios.post(`${ADMIN_LIFECYCLE_ENDPOINT}/offers/${offer._id}/revise`, {
                                                                salary: Number(salary),
                                                                notes: 'Revised after candidate counter',
                                                            }, { withCredentials: true }),
                                                            'Offer revised — submit for approval'
                                                        );
                                                    }}
                                                >
                                                    Revise after counter
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
                                            {['Draft', 'PendingApproval'].includes(offer.status) && (
                                                <CmButton
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={submitting}
                                                    onClick={() => deleteOffer(offer)}
                                                    style={{ color: 'var(--cm-error)' }}
                                                >
                                                    <FaTrash className="text-xs" /> Delete
                                                </CmButton>
                                            )}
                                        </div>

                                        {previewOffer?._id === offer._id && (
                                            <div
                                                className="mb-3 rounded-lg p-3"
                                                style={{
                                                    background: 'var(--cm-surface-low)',
                                                    border: '1px solid rgba(113,121,116,0.15)',
                                                }}
                                            >
                                                <p className="cm-label mb-2">Offer preview — v{offer.version}</p>
                                                {(offer.templateType === 'pdf' || (!offer.bodyHtml && offer.pdfUrl)) ? (
                                                    <iframe title="Offer PDF preview" src={offer.pdfUrl} className="h-[420px] w-full rounded-lg border bg-white" />
                                                ) : (
                                                    <OfferLetterHtmlPreview html={offer.bodyHtml} />
                                                )}
                                            </div>
                                        )}

                                        {offer.status === 'Countered' && (() => {
                                            const counter = getCounterDetails(offer);
                                            const reviseValue = reviseSalaryByOffer[offer._id] != null
                                                ? reviseSalaryByOffer[offer._id]
                                                : String(offer.salary ?? counter.salary ?? '');
                                            return (
                                                <div
                                                    className="mb-3 rounded-lg p-3 text-sm"
                                                    style={{
                                                        background: 'var(--cm-surface-low)',
                                                        border: '1px solid rgba(113,121,116,0.15)',
                                                    }}
                                                >
                                                    <p className="cm-label mb-2">Counter details</p>
                                                    <div className="grid gap-1.5 text-xs sm:grid-cols-2" style={{ color: 'var(--cm-on-surface)' }}>
                                                        <p>
                                                            <span style={{ color: 'var(--cm-muted)' }}>Proposed CTC: </span>
                                                            {counter.salary != null && counter.salary !== ''
                                                                ? `Rs ${Number(counter.salary).toLocaleString('en-IN')}`
                                                                : (offer.salary ? `Rs ${Number(offer.salary).toLocaleString('en-IN')}` : '—')}
                                                        </p>
                                                        <p>
                                                            <span style={{ color: 'var(--cm-muted)' }}>Preferred joining: </span>
                                                            {counter.startDate
                                                                ? format(new Date(counter.startDate), 'dd MMM yyyy')
                                                                : (offer.startDate ? format(new Date(offer.startDate), 'dd MMM yyyy') : '—')}
                                                        </p>
                                                        {counter.notes ? (
                                                            <p className="sm:col-span-2">
                                                                <span style={{ color: 'var(--cm-muted)' }}>Notes: </span>
                                                                {counter.notes}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                    <label className="mt-3 block text-xs" style={{ color: 'var(--cm-muted)' }}>
                                                        Revised salary (INR)
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="cm-input mt-1 w-full"
                                                            value={reviseValue}
                                                            onChange={(e) => setReviseSalaryByOffer((prev) => ({
                                                                ...prev,
                                                                [offer._id]: e.target.value,
                                                            }))}
                                                            placeholder="Enter revised CTC"
                                                        />
                                                    </label>
                                                </div>
                                            );
                                        })()}

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
                                    <span className="cm-label mb-1 block">Template type</span>
                                    <select
                                        value={form.templateType}
                                        onChange={(e) => {
                                            const templateType = e.target.value;
                                            const pool = templateType === 'pdf' ? pdfTemplates : htmlTemplates;
                                            setForm((p) => ({
                                                ...p,
                                                templateType,
                                                templateId: pool.find((t) => t.isDefault)?._id || pool[0]?._id || '',
                                            }));
                                            setCreatePreview(null);
                                        }}
                                        className="cm-select w-full"
                                    >
                                        <option value="html">HTML Template</option>
                                        <option value="pdf">PDF Template</option>
                                    </select>
                                </label>
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Template</span>
                                    <select value={form.templateId} onChange={(e) => { setForm((p) => ({ ...p, templateId: e.target.value })); setCreatePreview(null); }} className="cm-select w-full">
                                        {filteredTemplates.length === 0 ? (
                                            <option value="">No {form.templateType === 'pdf' ? 'PDF' : 'HTML'} templates available</option>
                                        ) : filteredTemplates.map((t) => (
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
                                <label className="block text-sm">
                                    <span className="cm-label mb-1 block">Annual CTC in words</span>
                                    <input
                                        value={form.annualCTCInWords}
                                        onChange={(e) => setForm((p) => ({ ...p, annualCTCInWords: e.target.value }))}
                                        className="cm-input w-full"
                                        placeholder="Auto from CTC if blank (e.g. Five Lakh Rupees Only)"
                                    />
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Employee ESI</span>
                                        <input
                                            value={form.employeeESI}
                                            onChange={(e) => setForm((p) => ({ ...p, employeeESI: e.target.value }))}
                                            className="cm-input w-full"
                                            placeholder="Auto from CTC if blank"
                                        />
                                    </label>
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Gratuity</span>
                                        <input
                                            value={form.gratuity}
                                            onChange={(e) => setForm((p) => ({ ...p, gratuity: e.target.value }))}
                                            className="cm-input w-full"
                                            placeholder="Auto from CTC if blank"
                                        />
                                    </label>
                                </div>
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
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Probation period</span>
                                        <input value={form.probationPeriod} onChange={(e) => setForm((p) => ({ ...p, probationPeriod: e.target.value }))} className="cm-input w-full" placeholder="e.g. 6 months" />
                                    </label>
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Notice period</span>
                                        <input value={form.noticePeriod} onChange={(e) => setForm((p) => ({ ...p, noticePeriod: e.target.value }))} className="cm-input w-full" placeholder="From policy if blank" />
                                    </label>
                                    <label className="block text-sm">
                                        <span className="cm-label mb-1 block">Working hours</span>
                                        <input value={form.workingHours} onChange={(e) => setForm((p) => ({ ...p, workingHours: e.target.value }))} className="cm-input w-full" placeholder="From org if blank" />
                                    </label>
                                </div>
                                {createPreview && (
                                    <div className="space-y-3 rounded-xl p-4" style={{ background: 'var(--cm-surface-low)', border: '1px solid rgba(113,121,116,0.12)' }}>
                                        <OfferMissingFieldsAlert missingFields={createPreview.missingFields} />
                                        {(createPreview.templateType === 'pdf' || form.templateType === 'pdf') && createPreview.previewPdfUrl ? (
                                            <iframe title="Offer PDF preview" src={createPreview.previewPdfUrl} className="h-[480px] w-full rounded-lg border bg-white" />
                                        ) : createPreview.renderedHtml ? (
                                            <OfferLetterHtmlPreview html={createPreview.renderedHtml} />
                                        ) : null}
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid rgba(113,121,116,0.12)' }}>
                                    <CmButton variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</CmButton>
                                    <CmButton variant="outline" type="button" disabled={previewLoading || submitting} onClick={previewCreateOffer}>
                                        {previewLoading ? 'Previewing...' : 'Preview'}
                                    </CmButton>
                                    <CmButton type="submit" disabled={submitting || (createPreview && !createPreview.isValid)}>
                                        {submitting ? 'Generating...' : 'Generate'}
                                    </CmButton>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

/** Pull latest counter-offer fields from activity feed (display only). */
function getCounterDetails(offer) {
    const feed = [...(offer?.activityFeed || [])].reverse();
    const entry = feed.find((a) => a?.action === 'offer_countered' || /counter/i.test(a?.description || ''));
    const meta = entry?.metadata || {};
    return {
        salary: meta.salary != null ? meta.salary : undefined,
        startDate: meta.startDate || undefined,
        notes: meta.notes || offer?.responseNotes || entry?.description || '',
    };
}

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
