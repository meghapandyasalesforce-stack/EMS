import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, isValid } from 'date-fns';
import {
    FaFileAlt, FaGraduationCap, FaFileInvoiceDollar, FaUpload, FaSync,
    FaExclamationCircle,
} from 'react-icons/fa';
import { CmButton } from '../../components/corporateModern';
import { toast } from 'react-toastify';
import { getUploadUrl, openDocumentPreview } from '../../utils/axios';

const PAGE_SIZE = 5;

/** Always listed on the dossier Documents tab (employee pending / uploaded). */
const REQUIRED_DOSSIER_DOC_TYPES = [
    { key: 'PASSPORT', label: 'PASSPORT' },
    { key: 'DEGREE', label: 'DEGREE' },
    { key: 'EXPERIENCE', label: 'EXPERIENCE' },
    { key: 'RESUME', label: 'RESUME' },
    { key: 'OFFER_ACK', label: 'OFFER_ACK' },
    { key: 'NDA', label: 'NDA' },
    { key: 'PHOTO', label: 'PHOTO' },
    { key: 'BANK_DETAILS', label: 'BANK_DETAILS' },
    { key: 'OTHER', label: 'OTHER' },
];

function placeholderDoc(type) {
    return {
        _id: `placeholder-${type.key}`,
        documentType: type.key,
        name: type.label,
        status: 'Pending',
        mandatory: true,
        __placeholder: true,
    };
}

/** Merge workflow docs with the fixed required types so all rows always appear. */
function buildEmployeeDocumentRows(workflowDocs = []) {
    const byType = new Map();
    workflowDocs.forEach((doc) => {
        const key = String(doc.documentType || '').toUpperCase();
        if (!key) return;
        if (!byType.has(key)) byType.set(key, doc);
    });

    const rows = REQUIRED_DOSSIER_DOC_TYPES.map((type) => {
        const existing = byType.get(type.key);
        if (existing) {
            return {
                ...existing,
                name: existing.name || type.label,
                documentType: existing.documentType || type.key,
            };
        }
        return placeholderDoc(type);
    });

    // Keep any extra workflow docs that are not in the fixed list (still employee-facing).
    workflowDocs.forEach((doc) => {
        const key = String(doc.documentType || '').toUpperCase();
        if (key && REQUIRED_DOSSIER_DOC_TYPES.some((t) => t.key === key)) return;
        rows.push(doc);
    });

    return rows;
}

/** Employee still needs to upload (or re-upload after reject). */
function isPendingByEmployee(doc) {
    const s = String(doc?.status || 'Pending');
    if (s === 'Verified') return false;
    if (s === 'Rejected') return true;
    return !docHasFile(doc);
}

/** Employee has uploaded (includes verified so every required type stays listed). */
function isUploadedByEmployee(doc) {
    const s = String(doc?.status || 'Pending');
    if (s === 'Rejected') return false;
    if (s === 'Verified') return true;
    return docHasFile(doc);
}

function documentCheckLabel(doc) {
    const typeKey = String(doc.documentType || '').toUpperCase();
    const fromList = REQUIRED_DOSSIER_DOC_TYPES.find((t) => t.key === typeKey);
    if (fromList) return fromList.label;
    return doc.name || String(doc.documentType || 'Document').replace(/_/g, ' ');
}

function checkIcon(label = '') {
    const l = label.toLowerCase();
    if (/edu|degree|bsc|msc/.test(l)) return FaGraduationCap;
    if (/employ|history|contract|salary|slip|reliev/.test(l)) return FaFileInvoiceDollar;
    return FaFileAlt;
}

function docHasFile(doc) {
    return Boolean(doc?.url || doc?.canonicalDocumentId);
}

function formatUploadDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (!isValid(date)) return null;
    return format(date, 'dd MMM yyyy');
}

function fileMetaLine(doc) {
    const name = doc.originalFileName || doc.fileName;
    if (!name) {
        return docHasFile(doc) ? 'File on record' : 'Awaiting employee upload';
    }
    const size = doc.fileSize || doc.size;
    if (size && Number(size) > 0) {
        const kb = Number(size) / 1024;
        const label = kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
        return `${name} (${label})`;
    }
    return name;
}

function sourceLabel(doc) {
    if (doc.source || doc.sourceRef) return doc.source || doc.sourceRef;
    if (docHasFile(doc)) return 'Uploaded by employee';
    return 'Pending by employee';
}

function statusBadge(doc) {
    const s = String(doc.status || 'Pending');
    if (s === 'Verified') {
        return {
            className: 'cm-dossier-docs__badge cm-dossier-docs__badge--verified',
            label: 'Verified by HR',
            Icon: null,
        };
    }
    if (s === 'Rejected') {
        return {
            className: 'cm-dossier-docs__badge cm-dossier-docs__badge--missing',
            label: 'Rejected — re-upload needed',
            Icon: FaExclamationCircle,
        };
    }
    if (docHasFile(doc)) {
        return {
            className: 'cm-dossier-docs__badge cm-dossier-docs__badge--pending',
            label: 'Uploaded — awaiting HR verify',
            Icon: null,
        };
    }
    return {
        className: 'cm-dossier-docs__badge cm-dossier-docs__badge--missing',
        label: 'Pending by employee',
        Icon: FaExclamationCircle,
    };
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

function ViewDocumentButton({ doc, label = 'View PDF' }) {
    const [busy, setBusy] = useState(false);
    if (!docHasFile(doc)) return null;

    return (
        <button
            type="button"
            className="cm-dossier-docs__link"
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
            {busy ? 'Opening…' : label}
        </button>
    );
}

/**
 * Documents tab — employee pending + employee uploaded only.
 * Employees upload; HR reviews uploaded files for verification.
 */
export default function OnboardingVerificationTab({
    wf,
    viewerRole = 'hr',
    navigate,
    onRefresh,
    returnToOnboarding,
}) {
    const isEmployee = viewerRole === 'employee';
    const [filter, setFilter] = useState('pending');
    const [page, setPage] = useState(1);

    const employeeDocumentsPath = useMemo(() => {
        const base = '/employee/documents-id';
        if (!returnToOnboarding) return base;
        return `${base}?returnTo=${encodeURIComponent(returnToOnboarding)}`;
    }, [returnToOnboarding]);

    const goToEmployeeUpload = useCallback(() => {
        if (!navigate) {
            toast.info('Open Documents & ID to upload required files.');
            return;
        }
        navigate(employeeDocumentsPath);
    }, [navigate, employeeDocumentsPath]);

    const goToHrVerify = useCallback(() => {
        if (!navigate) {
            toast.info('Open Documents from the HR menu to verify.');
            return;
        }
        const emp = wf.employeeId || {};
        const searchHint = [emp.name, emp.lastName].filter(Boolean).join(' ').trim();
        navigate('/documents', searchHint ? { state: { search: searchHint } } : undefined);
    }, [navigate, wf.employeeId]);

    const allEmployeeDocs = useMemo(
        () => buildEmployeeDocumentRows(wf.documents || []),
        [wf.documents],
    );

    const pendingByEmployee = useMemo(
        () => allEmployeeDocs.filter(isPendingByEmployee),
        [allEmployeeDocs],
    );
    const uploadedByEmployee = useMemo(
        () => allEmployeeDocs.filter(isUploadedByEmployee),
        [allEmployeeDocs],
    );

    const filteredDocs = filter === 'uploaded' ? uploadedByEmployee : pendingByEmployee;
    const totalPages = Math.max(1, Math.ceil(filteredDocs.length / PAGE_SIZE));

    useEffect(() => {
        setPage(1);
    }, [filter, wf._id]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const pageDocs = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredDocs.slice(start, start + PAGE_SIZE);
    }, [filteredDocs, page]);

    useEffect(() => {
        if (!onRefresh) return undefined;
        const onFocus = () => onRefresh();
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [onRefresh]);

    const filters = [
        { id: 'pending', label: 'Pending by employee', count: pendingByEmployee.length },
        { id: 'uploaded', label: 'Uploaded by employee', count: uploadedByEmployee.length },
    ];

    return (
        <div className="cm-dossier-docs">
            <div className="cm-card cm-dossier-docs__panel">
                <div className="cm-dossier-docs__header">
                    <div className="min-w-0">
                        <h2 className="cm-dossier-docs__title">
                            Mandatory Compliance &amp; Dossier Documents
                        </h2>
                        <p className="cm-dossier-docs__subtitle">
                            Employees upload documents here for HR verification. Lists only pending and uploaded employee files.
                        </p>
                    </div>
                    <div className="cm-dossier-docs__header-actions">
                        {onRefresh && (
                            <button
                                type="button"
                                className="cm-icon-btn text-[var(--cm-muted)]"
                                aria-label="Refresh document status"
                                onClick={() => onRefresh()}
                            >
                                <FaSync />
                            </button>
                        )}
                        {isEmployee && (
                            <button
                                type="button"
                                className="cm-dossier-docs__upload-btn"
                                onClick={goToEmployeeUpload}
                            >
                                <FaUpload aria-hidden />
                                Upload Document
                            </button>
                        )}
                    </div>
                </div>

                <div className="cm-dossier-docs__toolbar" role="group" aria-label="Employee document filters">
                    {filters.map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            className={`cm-dossier-docs__filter${filter === f.id ? ' cm-dossier-docs__filter--active' : ''}`}
                            aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}
                        >
                            {f.label}
                            <span className="cm-dossier-docs__filter-count">{f.count}</span>
                        </button>
                    ))}
                </div>

                <div className="cm-dossier-docs__table-wrap">
                    <table className="cm-dossier-docs__table">
                        <thead>
                            <tr>
                                <th>Document Name</th>
                                <th>Source / Ref</th>
                                <th>Uploaded Date</th>
                                <th>Status</th>
                                <th className="cm-dossier-docs__th-actions">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageDocs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="cm-dossier-docs__empty">
                                        {filter === 'uploaded'
                                            ? 'No documents uploaded by the employee yet.'
                                            : isEmployee
                                                ? 'No pending documents. Upload required files from Documents & ID.'
                                                : 'No pending employee documents. Waiting for the employee to upload.'}
                                    </td>
                                </tr>
                            ) : pageDocs.map((doc) => {
                                const label = documentCheckLabel(doc);
                                const Icon = checkIcon(label);
                                const badge = statusBadge(doc);
                                const BadgeIcon = badge.Icon;
                                const uploadedLabel = formatUploadDate(doc.uploadedAt || doc.createdAt);
                                const hasFile = docHasFile(doc);

                                return (
                                    <tr key={doc._id || doc.documentType}>
                                        <td>
                                            <div className="cm-dossier-docs__name-cell">
                                                <span className="cm-dossier-docs__doc-icon" aria-hidden>
                                                    <Icon />
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="cm-dossier-docs__name">{label}</p>
                                                    <p className="cm-dossier-docs__filemeta">{fileMetaLine(doc)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="cm-dossier-docs__muted">{sourceLabel(doc)}</td>
                                        <td className="cm-dossier-docs__muted">
                                            {uploadedLabel || '—'}
                                        </td>
                                        <td>
                                            <span className={badge.className}>
                                                {BadgeIcon ? <BadgeIcon aria-hidden /> : null}
                                                {badge.label}
                                            </span>
                                        </td>
                                        <td className="cm-dossier-docs__actions">
                                            {hasFile ? (
                                                <>
                                                    <ViewDocumentButton doc={doc} />
                                                    {!isEmployee && String(doc.status) !== 'Verified' && (
                                                        <button
                                                            type="button"
                                                            className="cm-dossier-docs__link"
                                                            onClick={goToHrVerify}
                                                        >
                                                            Verify
                                                        </button>
                                                    )}
                                                </>
                                            ) : isEmployee ? (
                                                <button
                                                    type="button"
                                                    className="cm-dossier-docs__upload-for"
                                                    onClick={goToEmployeeUpload}
                                                >
                                                    <FaUpload aria-hidden /> Upload
                                                </button>
                                            ) : (
                                                <span className="cm-dossier-docs__muted text-xs">
                                                    Waiting for employee
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {filteredDocs.length > 0 && (
                    <div className="cm-dossier-docs__pager">
                        <p className="cm-dossier-docs__pager-meta">
                            Showing {(page - 1) * PAGE_SIZE + 1}
                            –
                            {Math.min(page * PAGE_SIZE, filteredDocs.length)}
                            {' '}of {filteredDocs.length}
                        </p>
                        <div className="cm-dossier-docs__pager-controls">
                            <CmButton
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </CmButton>
                            <span className="cm-dossier-docs__pager-page">
                                Page {page} of {totalPages}
                            </span>
                            <CmButton
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </CmButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
