import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
    FaCheckCircle, FaEye, FaShieldAlt, FaFileAlt, FaGraduationCap,
    FaHistory, FaFileInvoiceDollar, FaUpload, FaSync, FaExternalLinkAlt,
} from 'react-icons/fa';
import { CmBadge, CmButton, statusTone } from '../../components/corporateModern';
import { toast } from 'react-toastify';
import { getUploadUrl, openDocumentPreview } from '../../utils/axios';

function documentCheckLabel(doc) {
    return doc.name || String(doc.documentType || 'Document').replace(/_/g, ' ');
}

function checkIcon(label = '') {
    const l = label.toLowerCase();
    if (/edu|degree|bsc|msc/.test(l)) return FaGraduationCap;
    if (/employ|history|contract/.test(l)) return FaFileInvoiceDollar;
    return FaFileAlt;
}

function mapDocStatus(status) {
    const s = String(status || 'Pending');
    if (s === 'Verified') return { tone: 'done', label: 'Verified' };
    if (s === 'Rejected') return { tone: 'attention', label: 'Rejected' };
    if (s === 'Uploaded') return { tone: 'progress', label: 'In Review' };
    return { tone: 'attention', label: 'Pending' };
}

function docHasFile(doc) {
    return Boolean(doc?.url || doc?.canonicalDocumentId);
}

async function previewOnboardingDocument(doc) {
    const fileName = doc.originalFileName || documentCheckLabel(doc);
    const fileUrl = doc.url ? getUploadUrl(doc.url) : undefined;
    const documentId = doc.canonicalDocumentId;

    if (documentId) {
        await openDocumentPreview(documentId, { fileUrl, fileName });
        return;
    }
    if (fileUrl) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
    }
    throw new Error('No file available to view');
}

function ViewDocumentButton({ doc, className = 'cm-doc-view-btn', label = 'View' }) {
    const [busy, setBusy] = useState(false);
    if (!docHasFile(doc)) return null;

    return (
        <button
            type="button"
            className={className}
            disabled={busy}
            onClick={async () => {
                setBusy(true);
                try {
                    await previewOnboardingDocument(doc);
                } catch (e) {
                    toast.error(e.message || 'Could not open document');
                } finally {
                    setBusy(false);
                }
            }}
        >
            <FaEye aria-hidden />
            {label ? <span>{busy ? 'Opening…' : label}</span> : null}
        </button>
    );
}

export default function OnboardingVerificationTab({
    wf,
    breakdown,
    viewerRole = 'hr',
    navigate,
    onRefresh,
    returnToOnboarding,
}) {
    const documents = wf.documents || [];
    const verifiedCount = documents.filter((d) => d.status === 'Verified').length;
    const totalCount = documents.length;
    const uploadedCount = documents.filter((d) => docHasFile(d)).length;
    const pendingCount = documents.filter((d) => d.status === 'Pending' || d.status === 'Uploaded').length;
    const missingCount = Math.max(0, totalCount - uploadedCount);
    const compliancePct = totalCount > 0
        ? Math.round((verifiedCount / totalCount) * 100)
        : Math.max(0, Math.min(100, Number(breakdown?.documents) || 0));

    const docByKey = useMemo(() => {
        const map = new Map();
        documents.forEach((doc) => {
            map.set(doc._id || doc.documentType, doc);
        });
        return map;
    }, [documents]);

    const rows = useMemo(() => documents.map((doc) => ({
        id: doc._id || doc.documentType,
        checkType: documentCheckLabel(doc),
        status: doc.status,
        verifiedBy: doc.verifiedBy?.name || (doc.verifiedBy ? String(doc.verifiedBy) : null),
        verifiedAt: doc.verifiedAt,
        doc,
    })), [documents]);

    const lastActivity = (wf.activityFeed || [])[0];
    const isHr = viewerRole === 'hr';
    const isEmployee = viewerRole === 'employee';

    const employeeDocumentsPath = useMemo(() => {
        const base = '/employee/documents-id';
        if (!returnToOnboarding) return base;
        return `${base}?returnTo=${encodeURIComponent(returnToOnboarding)}`;
    }, [returnToOnboarding]);

    const goToEmployeeUpload = useCallback(() => {
        if (!navigate) {
            toast.info('Open Documents & ID from the main menu to upload.');
            return;
        }
        navigate(employeeDocumentsPath);
    }, [navigate, employeeDocumentsPath]);

    const goToHrDocuments = useCallback(() => {
        if (!navigate) {
            toast.info('Open Documents from the HR menu.');
            return;
        }
        const emp = wf.employeeId || {};
        const searchHint = [emp.name, emp.lastName].filter(Boolean).join(' ').trim();
        navigate('/documents', searchHint ? { state: { search: searchHint } } : undefined);
    }, [navigate, wf.employeeId]);

    useEffect(() => {
        if (!onRefresh) return undefined;
        const onFocus = () => onRefresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [onRefresh]);

    return (
        <div className="space-y-4">
            <div className="hrms-main-rail">
                <div className="cm-card overflow-visible p-0 sm:overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-[rgba(187,202,193,0.35)] px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
                        <h2 className="cm-title-sm flex items-center gap-2">
                            <FaShieldAlt className="text-[var(--cm-primary-deep)]" />
                            Verification Checklist
                        </h2>
                        <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                            <div className="flex flex-wrap items-center gap-2">
                                {onRefresh && (
                                    <span className="hidden sm:inline-flex">
                                        <button
                                            type="button"
                                            className="cm-icon-btn text-[var(--cm-muted)]"
                                            aria-label="Refresh document status"
                                            onClick={() => onRefresh()}
                                        >
                                            <FaSync />
                                        </button>
                                    </span>
                                )}
                                {isEmployee && (
                                    <CmButton type="button" variant="primary" size="sm" onClick={goToEmployeeUpload}>
                                        <FaUpload className="mr-1" /> Upload documents
                                    </CmButton>
                                )}
                                {isHr && (
                                    <CmButton type="button" variant="secondary" size="sm" onClick={goToHrDocuments}>
                                        <FaExternalLinkAlt className="mr-1" /> Document hub
                                    </CmButton>
                                )}
                            </div>
                            <span className="hidden sm:inline-flex items-center rounded-full bg-[rgba(28,202,155,0.12)] px-3 py-1 text-xs font-semibold text-[var(--cm-primary-deep)] sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm sm:font-semibold sm:pl-0">
                                {totalCount > 0 ? `${verifiedCount} of ${totalCount} Completed` : 'No checks yet'}
                            </span>
                        </div>
                    </div>
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead>
                                <tr>
                                    <th>Check Type</th>
                                    <th>Status</th>
                                    <th>Verified By</th>
                                    <th>Verified Date</th>
                                    <th>View</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-10 text-center text-sm text-[var(--cm-muted)]">
                                            {isEmployee
                                                ? 'Upload required files from Documents & ID; they will appear here after sync.'
                                                : 'Verification checks appear when documents are synced from the employee profile.'}
                                        </td>
                                    </tr>
                                ) : rows.map((row) => {
                                    const st = mapDocStatus(row.status);
                                    const Icon = checkIcon(row.checkType);
                                    const hasFile = docHasFile(row.doc);
                                    return (
                                        <tr key={row.id}>
                                            <td>
                                                <span className="inline-flex items-center gap-2 font-medium">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--cm-surface-low)] text-[var(--cm-primary-deep)]">
                                                        <Icon className="text-sm" />
                                                    </span>
                                                    {row.checkType}
                                                </span>
                                            </td>
                                            <td>
                                                {st.label === 'Verified' ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--cm-primary-deep)]">
                                                        <FaCheckCircle /> Verified
                                                    </span>
                                                ) : (
                                                    <CmBadge tone={statusTone(row.status)} dot={false}>{st.label}</CmBadge>
                                                )}
                                            </td>
                                            <td className="text-sm">{row.verifiedBy || '—'}</td>
                                            <td className="text-sm">
                                                {row.verifiedAt ? format(new Date(row.verifiedAt), 'MMM dd, yyyy') : '—'}
                                            </td>
                                            <td className="text-right">
                                                {hasFile ? (
                                                    <ViewDocumentButton doc={row.doc} />
                                                ) : isEmployee ? (
                                                    <button type="button" className="cm-link cm-link--attention text-sm font-semibold" onClick={goToEmployeeUpload}>
                                                        Upload
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-[var(--cm-muted)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <div className="cm-card cm-compliance-score">
                        <p className="text-sm font-semibold text-[var(--cm-on-variant)]">Overall Compliance Score</p>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-[var(--cm-inverted)]">{compliancePct}%</span>
                            <span className="text-sm font-medium text-[var(--cm-muted)]">
                                {compliancePct >= 80 ? 'Excellent' : compliancePct >= 50 ? 'On track' : 'Needs attention'}
                            </span>
                        </div>
                        <div className="cm-progress mt-4" role="progressbar" aria-valuenow={compliancePct}>
                            <div className="cm-progress__bar" style={{ width: `${compliancePct}%` }} />
                        </div>
                        <p className="mt-4 text-xs italic text-[var(--cm-muted)]">
                            {isEmployee
                                ? 'Upload files on the Documents & ID page. Return here to view status and open uploaded files.'
                                : 'Review and verify files in the document hub. Uploaded files can be viewed on this tab.'}
                        </p>
                        {isEmployee && (
                            <CmButton type="button" variant="primary" size="sm" className="mt-3 w-full" onClick={goToEmployeeUpload}>
                                Go to Documents & ID
                            </CmButton>
                        )}
                    </div>

                    <div className="cm-card">
                        <p className="text-sm font-semibold text-[var(--cm-on-surface)]">Checklist Summary</p>
                        <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-[var(--cm-muted)]">Verified</span>
                                <span className="font-semibold text-[var(--cm-primary-deep)]">{verifiedCount}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-[var(--cm-muted)]">{isHr ? 'Awaiting review' : 'Pending status'}</span>
                                <span className="font-semibold text-[var(--cm-tertiary-deep)]">{pendingCount}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-[var(--cm-muted)]">{isHr ? 'Missing uploads' : 'Files to upload'}</span>
                                <span className="font-semibold text-[var(--cm-on-surface)]">{missingCount}</span>
                            </div>
                        </div>
                    </div>

                    {lastActivity && (
                        <div className="cm-card">
                            <div className="flex items-start gap-3">
                                <FaHistory className="mt-0.5 shrink-0 text-[var(--cm-muted)]" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-[var(--cm-on-surface)]">Recent Activity</p>
                                    <p className="mt-2 text-sm text-[var(--cm-on-variant)]">
                                        <span className="font-semibold text-[var(--cm-on-surface)]">
                                            {lastActivity.actor?.name || lastActivity.actorName || 'System'}
                                        </span>
                                        {' '}
                                        {lastActivity.description || (lastActivity.action || '').replaceAll('_', ' ')}
                                    </p>
                                    {lastActivity.createdAt && (
                                        <p className="mt-2 text-xs text-[var(--cm-muted)]">
                                            {formatDistanceToNow(new Date(lastActivity.createdAt), { addSuffix: true })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            <div className="cm-card">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold text-[var(--cm-on-surface)]">Uploaded Files</h3>
                    <div className="flex items-center gap-2">
                        {isEmployee && (
                            <button type="button" className="cm-link text-sm font-semibold" onClick={goToEmployeeUpload}>
                                Upload more
                            </button>
                        )}
                        {isHr && (
                            <button type="button" className="cm-link text-sm font-semibold" onClick={goToHrDocuments}>
                                Manage in hub
                            </button>
                        )}
                    </div>
                </div>
                {documents.length === 0 ? (
                    <p className="text-sm text-[var(--cm-muted)]">
                        {isEmployee ? 'No files synced yet. Upload from Documents & ID.' : 'No files synced yet.'}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {documents.map((doc) => {
                            const Icon = checkIcon(documentCheckLabel(doc));
                            const dateLabel = doc.uploadedAt
                                ? format(new Date(doc.uploadedAt), 'MMM dd, yyyy')
                                : '—';
                            const fullDoc = docByKey.get(doc._id || doc.documentType) || doc;
                            return (
                                <div key={doc._id || doc.documentType} className="cm-file-card">
                                    <span className="cm-file-card__icon">
                                        <Icon />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">{doc.originalFileName || documentCheckLabel(doc)}</p>
                                        <p className="text-xs text-[var(--cm-muted)]">{dateLabel}</p>
                                    </div>
                                    {docHasFile(fullDoc) ? (
                                        <ViewDocumentButton doc={fullDoc} className="cm-doc-view-btn cm-doc-view-btn--icon" label="" />
                                    ) : isEmployee ? (
                                        <button type="button" className="cm-icon-btn shrink-0 text-[var(--cm-primary-deep)]" aria-label="Upload" onClick={goToEmployeeUpload}>
                                            <FaUpload />
                                        </button>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </div>
    );
}
