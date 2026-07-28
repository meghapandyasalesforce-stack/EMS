import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
    FaFileAlt,
    FaDownload,
    FaUpload,
    FaFolder,
    FaHistory,
    FaSearch,
    FaFilter,
    FaEye,
    FaShareAlt,
    FaPlus,
    FaFilePdf,
    FaFileWord,
    FaTimes,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { fetchDocumentWithFallback, getDocumentDownloadUrl, saveDocumentDownload } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import logger from '../../utils/logger';
import { canAccessHrDocuments } from '../../utils/managerHelper';
import { ADMIN_DOCUMENTS_ENDPOINT } from '../../utils/constant';

const DOCUMENT_CATEGORY_OPTIONS = [
    'Employee', 'Company', 'Policy', 'Contract', 'Certificate',
    'Training', 'Compliance', 'Financial', 'Legal', 'Other'
];

/** Sidebar category key → backend `category` enum */
const CATEGORY_NAV = [
    { key: 'all', label: 'All Documents', categoryParam: null },
    { key: 'Policy', label: 'Policies', categoryParam: 'Policy' },
    { key: 'Contract', label: 'Contracts', categoryParam: 'Contract' },
    { key: 'Certificate', label: 'Certificates', categoryParam: 'Certificate' },
    { key: 'Other', label: 'Forms', categoryParam: 'Other' },
];

function formatRelativeTime(iso) {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.round((now - then) / 1000);
    if (sec < 45) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Full name from populated employee (matches org standard: first + last). */
function formatEmployeeFullName(person) {
    if (!person) return 'Unknown';
    const first = String(person.name || '').trim();
    const last = String(person.lastName || '').trim();
    const combined = [first, last].filter(Boolean).join(' ').trim();
    if (combined) return combined;
    const email = String(person.email || '').trim();
    if (email) return email;
    return 'Unknown';
}

/** Which employee this document belongs to (for HR list). */
function resolveDocumentEmployee(doc) {
    const isPopulatedPerson = (value) =>
        value && typeof value === 'object' && (value.name || value.lastName || value.email);

    const uploader = isPopulatedPerson(doc.uploadedBy) ? doc.uploadedBy : null;
    const related =
        doc.relatedTo === 'Employee' && isPopulatedPerson(doc.relatedId) ? doc.relatedId : null;
    const person = uploader || related;

    const orgCategories = new Set(['Company', 'Policy', 'Training', 'Compliance']);
    if (person) {
        return {
            person,
            name: formatEmployeeFullName(person),
            code: person.employeeId || null,
            department: person.department || null,
            isOrganizationDoc: false,
        };
    }

    if (orgCategories.has(doc.category) || doc.relatedTo === 'Policy') {
        return {
            person: null,
            name: 'Organization',
            code: null,
            department: null,
            isOrganizationDoc: true,
        };
    }

    return {
        person: null,
        name: 'Unknown employee',
        code: null,
        department: null,
        isOrganizationDoc: false,
    };
}

function documentDisplayTitle(doc) {
    return doc.name || doc.fileName || 'Untitled document';
}

/** PAN / Aadhar / other ID from job-details upload (new + legacy JSON description) */
function documentDisplayNumber(doc) {
    const fromMeta = doc?.metadata?.documentNumber;
    if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();

    const info = doc?.metadata?.additionalInfo;
    if (info && typeof info === 'object') {
        const n = info.panNumber || info.aadharNumber || info.documentNumber || info.effectiveDate;
        if (n && String(n).trim()) return String(n).trim();
    }

    const desc = doc?.description;
    if (!desc || typeof desc !== 'string') return '';

    // Human-readable: "PAN Number: ABCDE1234F"
    const labelMatch = desc.match(/^(?:PAN Number|Aadhar Number|Effective Date):\s*(.+)$/i);
    if (labelMatch?.[1]) return labelMatch[1].trim();

    // Legacy JSON description
    if (desc.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(desc);
            const n = parsed.panNumber || parsed.aadharNumber || parsed.documentNumber || parsed.effectiveDate;
            if (n) return String(n).trim();
        } catch {
            /* ignore */
        }
    }

    return '';
}

function documentDisplaySubtitle(doc) {
    const number = documentDisplayNumber(doc);
    if (number) return number;
    const desc = doc?.description;
    if (desc && typeof desc === 'string' && !desc.trim().startsWith('{')) {
        return desc;
    }
    return '';
}

function initialsFromPerson(person) {
    const first = String(person?.name || '').trim();
    const last = String(person?.lastName || '').trim();
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    const n = person?.name || person?.email || '?';
    const parts = String(n).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return String(n).slice(0, 2).toUpperCase();
}

function fileIcon(doc) {
    const t = (doc?.type || '').toLowerCase();
    if (t === 'pdf') return FaFilePdf;
    if (t === 'word') return FaFileWord;
    return FaFileAlt;
}

function DocumentFileIcon({ doc, className = 'w-5 h-5' }) {
    const Icon = fileIcon(doc);
    return <Icon className={className} />;
}

function categoryPillClass(cat) {
    const c = String(cat || '');
    if (c === 'Policy') return 'bg-emerald-50 text-emerald-800 border border-emerald-100';
    if (c === 'Contract') return 'bg-violet-50 text-violet-800 border border-violet-100';
    if (c === 'Certificate') return 'bg-amber-50 text-amber-900 border border-amber-100';
    if (c === 'Other') return 'bg-slate-100 text-slate-800 border border-slate-200';
    return 'bg-gray-100 text-gray-800 border border-gray-200';
}

function statusPill(doc) {
    if (doc.requiresApproval && doc.approvalStatus === 'Pending') {
        return { label: 'Pending approval', className: 'bg-amber-50 text-amber-800 border border-amber-200' };
    }
    // Employee delete (new status, or older rows saved as Rejected + this reason)
    const removedByEmployee =
        doc.approvalStatus === 'Withdrawn' ||
        (doc.approvalStatus === 'Rejected' &&
            String(doc.rejectionReason || '').toLowerCase().includes('removed by employee'));
    if (removedByEmployee) {
        return { label: 'Withdrawn by employee', className: 'bg-slate-100 text-slate-700 border border-slate-200' };
    }
    if (doc.approvalStatus === 'Rejected') {
        return { label: 'Rejected', className: 'bg-red-50 text-red-800 border border-red-100' };
    }
    return { label: 'Active', className: 'bg-emerald-50 text-emerald-800 border border-emerald-100' };
}

function useDebouncedValue(value, ms) {
    const [d, setD] = React.useState(value);
    React.useEffect(() => {
        const id = window.setTimeout(() => setD(value), ms);
        return () => window.clearTimeout(id);
    }, [value, ms]);
    return d;
}

const DocumentsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const permissionFlags = useSelector((state) => state.auth.permissionFlags) || {};

    const isHRUser = useMemo(() => {
        return canAccessHrDocuments(user, employee, permissionFlags);
    }, [user, employee, permissionFlags]);

    const [documents, setDocuments] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
    const [pendingDocuments, setPendingDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sidebarCategoryKey, setSidebarCategoryKey] = useState('all');
    const [accessPublic, setAccessPublic] = useState(false);
    const [accessRestricted, setAccessRestricted] = useState(false);
    const [accessConfidential, setAccessConfidential] = useState(false);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 350);

    useEffect(() => {
        const hint = location.state?.search;
        if (typeof hint === 'string' && hint.trim()) {
            setSearchInput(hint.trim());
        }
    }, [location.state?.search]);
    const [pendingNotes, setPendingNotes] = useState({});
    const [rejectingDoc, setRejectingDoc] = useState(null);
    const [docActionLoading, setDocActionLoading] = useState({});
    const [previewDoc, setPreviewDoc] = useState(null);

    const closePreview = useCallback(() => {
        setPreviewDoc((current) => {
            if (current?.url) URL.revokeObjectURL(current.url);
            return null;
        });
    }, []);

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadName, setUploadName] = useState('');
    const [uploadCategory, setUploadCategory] = useState('Company');
    const [uploadDescription, setUploadDescription] = useState('');
    const [uploading, setUploading] = useState(false);

    const PAGE_SIZE = 50;

    const accessBucketsParam = useMemo(() => {
        const buckets = [];
        if (accessPublic) buckets.push('public');
        if (accessRestricted) buckets.push('restricted');
        if (accessConfidential) buckets.push('confidential');
        return buckets.length ? buckets.join(',') : undefined;
    }, [accessPublic, accessRestricted, accessConfidential]);

    const selectedCategoryParam = useMemo(() => {
        const nav = CATEGORY_NAV.find((x) => x.key === sidebarCategoryKey);
        return nav?.categoryParam ?? null;
    }, [sidebarCategoryKey]);

    const resetUploadForm = () => {
        setUploadFile(null);
        setUploadName('');
        setUploadCategory('Company');
        setUploadDescription('');
    };

    const openUploadModal = () => {
        resetUploadForm();
        setShowUploadModal(true);
    };

    const listFetchEverCompleted = useRef(false);

    const fetchPendingDocuments = useCallback(async () => {
        try {
            const response = await axios.get('/v1/admin/documents/pending', { withCredentials: true });
            setPendingDocuments(response.data?.data || []);
        } catch (error) {
            logger.error('Error fetching pending documents:', error);
        }
    }, []);

    const fetchDocuments = useCallback(async () => {
        try {
            if (!listFetchEverCompleted.current) {
                setLoading(true);
            }
            const params = {
                page,
                limit: PAGE_SIZE,
            };
            if (selectedCategoryParam) params.category = selectedCategoryParam;
            if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
            if (accessBucketsParam) params.accessBuckets = accessBucketsParam;

            const response = await axios.get('/v1/both/documents', {
                params,
                withCredentials: true,
            });
            setDocuments(response.data?.data || []);
            const p = response.data?.pagination;
            if (p) {
                setPagination({
                    page: p.page ?? page,
                    limit: p.limit ?? PAGE_SIZE,
                    total: p.total ?? 0,
                    pages: p.pages ?? 0,
                });
            }
        } catch (error) {
            logger.error('Error fetching documents:', error);
            toast.error('Failed to load documents. Please try again.');
        } finally {
            setLoading(false);
            listFetchEverCompleted.current = true;
        }
    }, [page, selectedCategoryParam, debouncedSearch, accessBucketsParam]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    useEffect(() => {
        if (isHRUser) fetchPendingDocuments();
    }, [isHRUser, fetchPendingDocuments]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, accessBucketsParam]);

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            toast.error('Please choose a file');
            return;
        }
        const name = uploadName.trim() || uploadFile.name;
        const formData = new FormData();
        formData.append('document', uploadFile);
        formData.append('name', name);
        formData.append('category', uploadCategory);
        if (uploadDescription.trim()) {
            formData.append('description', uploadDescription.trim());
        }
        try {
            setUploading(true);
            await axios.post(`${ADMIN_DOCUMENTS_ENDPOINT}/upload`, formData, { withCredentials: true });
            toast.success('Document uploaded successfully');
            setShowUploadModal(false);
            resetUploadForm();
            await fetchDocuments();
            if (isHRUser) await fetchPendingDocuments();
        } catch (error) {
            logger.error('Error uploading document:', error);
            toast.error(error.response?.data?.message || 'Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    const handleApprove = async (documentId) => {
        try {
            await axios.post(`/v1/admin/documents/${documentId}/approve`, {}, { withCredentials: true });
            toast.success('Document approved successfully!');
            setPendingNotes((prev) => {
                const next = { ...prev };
                delete next[documentId];
                return next;
            });
            fetchDocuments();
            fetchPendingDocuments();
        } catch (error) {
            logger.error('Error approving document:', error);
            toast.error('Failed to approve document');
        }
    };

    const handleReject = async (doc) => {
        const note = (pendingNotes[doc._id] || '').trim();
        if (!note) {
            toast.error('Please add a reason for rejection');
            return;
        }
        try {
            await axios.post(
                `/v1/admin/documents/${doc._id}/reject`,
                { rejectionReason: note },
                { withCredentials: true }
            );
            toast.success('Document rejected successfully!');
            setPendingNotes((prev) => {
                const next = { ...prev };
                delete next[doc._id];
                return next;
            });
            setRejectingDoc(null);
            fetchDocuments();
            fetchPendingDocuments();
        } catch (error) {
            logger.error('Error rejecting document:', error);
            toast.error('Failed to reject document');
        }
    };

    const copyShareLink = async (doc) => {
        const full = getDocumentDownloadUrl(doc._id);
        if (!full) {
            toast.error('Could not copy link');
            return;
        }
        try {
            await navigator.clipboard.writeText(
                full.startsWith('http') ? full : `${window.location.origin}${full}`
            );
            toast.success('Link copied to clipboard');
        } catch {
            toast.error('Could not copy link');
        }
    };

    const handlePreviewDocument = async (doc) => {
        const docId = doc?._id;
        if (!docId) {
            toast.error('Document id missing');
            return;
        }
        const employeeId = doc.uploadedBy?._id || doc.uploadedBy;
        setDocActionLoading((prev) => ({ ...prev, [docId]: 'preview' }));
        try {
            const blob = await fetchDocumentWithFallback(docId, {
                scope: 'admin',
                fileUrl: doc.fileUrl,
                employeeId,
                inline: true,
            });
            const mimeType =
                blob.type && !blob.type.includes('json') && blob.type !== 'application/octet-stream'
                    ? blob.type
                    : doc.mimeType || 'application/pdf';
            const viewBlob = blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
            const url = URL.createObjectURL(viewBlob);
            setPreviewDoc({
                url,
                title: doc.fileName || doc.name || 'Document',
                mimeType,
            });
        } catch (error) {
            logger.error('Error previewing document:', error);
            toast.error(error?.message || 'Could not open document preview');
        } finally {
            setDocActionLoading((prev) => ({ ...prev, [docId]: null }));
        }
    };

    const handleDownloadDocument = async (doc) => {
        const docId = doc?._id;
        if (!docId) {
            toast.error('Document id missing');
            return;
        }
        const employeeId = doc.uploadedBy?._id || doc.uploadedBy;
        setDocActionLoading((prev) => ({ ...prev, [docId]: 'download' }));
        try {
            await saveDocumentDownload(docId, doc.fileName || doc.name || 'document', {
                scope: 'admin',
                fileUrl: doc.fileUrl,
                employeeId,
            });
            toast.success('Download started');
        } catch (error) {
            logger.error('Error downloading document:', error);
            toast.error(error?.message || 'Failed to download document');
        } finally {
            setDocActionLoading((prev) => ({ ...prev, [docId]: null }));
        }
    };

    const pendingCount = pendingDocuments.length;
    const { page: curPage, total, pages } = pagination;
    const rangeStart = total === 0 ? 0 : (curPage - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(curPage * PAGE_SIZE, total);

    if (!listFetchEverCompleted.current && loading) {
        return <LoadingSpinner message="Loading documents..." />;
    }

    if (!isHRUser) {
        return <Navigate to="/employee/documents-id" replace />;
    }

    return (
        <div className="page-shell min-h-screen bg-[#f4f6f8] transition-all duration-300">
            <div className="page-shell-inner hrms-split">
                {/* Sidebar */}
                <aside className="min-w-0 space-y-6">
                    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Categories</p>
                        <nav className="space-y-1">
                            {CATEGORY_NAV.map((item) => {
                                const active = sidebarCategoryKey === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => {
                                            setSidebarCategoryKey(item.key);
                                            setPage(1);
                                        }}
                                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition ${
                                            active
                                                ? 'bg-theme-secondary/12 text-theme-secondary'
                                                : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                    >
                                        <FaFolder className={`w-4 h-4 shrink-0 ${active ? 'text-theme-secondary' : 'text-gray-400'}`} />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Access level</p>
                        <div className="space-y-2 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={accessPublic}
                                    onChange={(e) => setAccessPublic(e.target.checked)}
                                    className="rounded border-gray-300 text-theme-secondary focus:ring-theme-secondary"
                                />
                                Public
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={accessRestricted}
                                    onChange={(e) => setAccessRestricted(e.target.checked)}
                                    className="rounded border-gray-300 text-theme-secondary focus:ring-theme-secondary"
                                />
                                Restricted
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={accessConfidential}
                                    onChange={(e) => setAccessConfidential(e.target.checked)}
                                    className="rounded border-gray-300 text-theme-secondary focus:ring-theme-secondary"
                                />
                                Confidential
                            </label>
                        </div>
                        <p className="text-xs text-gray-400 mt-3">
                            Leave unchecked to show all access levels.
                        </p>
                    </div>

                    {isHRUser && (
                        <button
                            type="button"
                            onClick={openUploadModal}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-theme-secondary text-white font-medium shadow-sm hover:bg-theme-primary transition"
                        >
                            <FaPlus className="w-4 h-4" />
                            Upload Document
                        </button>
                    )}
                </aside>

                {/* Main */}
                <main className="min-w-0 space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Documents</h1>
                            <p className="text-gray-600 mt-1">
                                Manage, approve, and track organization-wide records.
                            </p>
                        </div>
                        {isHRUser && (
                            <button
                                type="button"
                                onClick={openUploadModal}
                                className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-secondary text-white font-medium hover:bg-theme-primary transition shadow-sm"
                            >
                                <FaPlus className="w-4 h-4" />
                                Upload Document
                            </button>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative max-w-xl">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                            type="search"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search documents…"
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                        />
                    </div>

                    {/* Pending approvals */}
                    {isHRUser && (
                        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <FaFileAlt className="w-5 h-5 text-gray-600" />
                                    <h2 className="text-lg font-semibold text-gray-900">Pending Approvals</h2>
                                    {pendingCount > 0 ? (
                                        <span className="text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-orange-50 text-orange-800 border border-orange-100">
                                            {pendingCount} action required
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-500">All caught up</span>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 space-y-4">
                                {pendingDocuments.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-8">
                                        No documents pending HR approval.
                                    </p>
                                ) : (
                                    pendingDocuments.map((doc) => (
                                        <div
                                            key={doc._id}
                                            className="flex flex-col xl:flex-row xl:items-stretch gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition"
                                        >
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="shrink-0 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                                                    <DocumentFileIcon doc={doc} className="w-8 h-8 text-theme-secondary" />
                                                </div>
                                                <div className="min-w-0">
                                                    {(() => {
                                                        const owner = resolveDocumentEmployee(doc);
                                                        return (
                                                            <>
                                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                                                    <span className="font-semibold text-gray-900">
                                                                        {owner.name}
                                                                    </span>
                                                                    {owner.code ? (
                                                                        <span className="text-xs font-medium text-gray-500">
                                                                            {owner.code}
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="mt-1 flex items-center gap-2 min-w-0">
                                                                    <DocumentFileIcon doc={doc} className="w-4 h-4 text-theme-secondary shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <span className="text-sm text-gray-700 block truncate">
                                                                            {documentDisplayTitle(doc)}
                                                                        </span>
                                                                        {documentDisplaySubtitle(doc) ? (
                                                                            <span className="text-xs font-medium text-gray-500 block truncate mt-0.5">
                                                                                {documentDisplaySubtitle(doc)}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    Submitted {formatRelativeTime(doc.createdAt)}
                                                                    {owner.isOrganizationDoc ? ' · Company document' : ''}
                                                                </p>
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handlePreviewDocument(doc)}
                                                                        disabled={!!docActionLoading[doc._id]}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-theme-secondary transition disabled:opacity-50"
                                                                    >
                                                                        <FaEye className="w-3.5 h-3.5" />
                                                                        {docActionLoading[doc._id] === 'preview' ? 'Opening…' : 'Preview'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDownloadDocument(doc)}
                                                                        disabled={!!docActionLoading[doc._id]}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-theme-secondary transition disabled:opacity-50"
                                                                    >
                                                                        <FaDownload className="w-3.5 h-3.5" />
                                                                        {docActionLoading[doc._id] === 'download' ? 'Downloading…' : 'Download'}
                                                                    </button>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex min-w-0 flex-col gap-2 xl:min-w-[min(100%,20rem)] xl:max-w-[min(100%,24rem)] xl:shrink-0">
                                                <label className="sr-only" htmlFor={`note-${doc._id}`}>Review note</label>
                                                <textarea
                                                    id={`note-${doc._id}`}
                                                    rows={2}
                                                    value={pendingNotes[doc._id] || ''}
                                                    onChange={(e) =>
                                                        setPendingNotes((prev) => ({ ...prev, [doc._id]: e.target.value }))
                                                    }
                                                    placeholder="Add a reason for your decision…"
                                                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent resize-y min-h-[2.75rem]"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprove(doc._id)}
                                                        className="flex-1 py-2 rounded-lg bg-theme-secondary text-white text-sm font-medium hover:bg-theme-primary transition"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReject(doc)}
                                                        className="flex-1 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 transition"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    )}

                    {/* Recent documents table */}
                    <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Recent Documents</h2>
                            <FaFilter className="w-4 h-4 text-gray-400" title="Filtered by sidebar" />
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-[720px] w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 bg-gray-50/80">
                                        <th className="px-5 py-3">Employee</th>
                                        <th className="px-5 py-3">Document</th>
                                        <th className="px-5 py-3">Category</th>
                                        <th className="px-5 py-3">Version</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Last Modified</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {documents.map((doc) => {
                                        const st = statusPill(doc);
                                        const Icon = fileIcon(doc);
                                        const owner = resolveDocumentEmployee(doc);
                                        return (
                                            <tr key={doc._id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
                                                        <span className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold flex items-center justify-center shrink-0">
                                                            {owner.isOrganizationDoc ? 'ORG' : initialsFromPerson(owner.person)}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="font-semibold text-gray-900 truncate">
                                                                {owner.name}
                                                            </div>
                                                            {owner.code ? (
                                                                <div className="text-xs text-gray-500 truncate">{owner.code}</div>
                                                            ) : owner.department ? (
                                                                <div className="text-xs text-gray-500 truncate">{owner.department}</div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2 min-w-0 max-w-xs sm:max-w-md">
                                                        <span className="shrink-0 p-2 rounded-lg bg-theme-secondary/10 text-theme-secondary">
                                                            <Icon className="w-4 h-4" />
                                                        </span>
                                                        <div className="min-w-0">
                                                            <span className="font-medium text-gray-900 block truncate">
                                                                {documentDisplayTitle(doc)}
                                                            </span>
                                                            {documentDisplaySubtitle(doc) ? (
                                                                <span className="text-xs text-gray-500 block truncate mt-0.5">
                                                                    {documentDisplaySubtitle(doc)}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryPillClass(doc.category)}`}
                                                    >
                                                        {doc.category || 'Other'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-gray-700">
                                                    v{doc.version ?? 1}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${st.className}`}>
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-gray-600">
                                                    {doc.updatedAt
                                                        ? `${new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${formatRelativeTime(doc.updatedAt)})`
                                                        : formatRelativeTime(doc.createdAt)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1 justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePreviewDocument(doc)}
                                                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-theme-secondary transition"
                                                            title="View"
                                                        >
                                                            <FaEye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDownloadDocument(doc)}
                                                            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-theme-secondary transition"
                                                            title="Download"
                                                        >
                                                            <FaDownload className="w-4 h-4" />
                                                        </button>
                                                        {isHRUser && (
                                                            <button
                                                                type="button"
                                                                onClick={() => copyShareLink(doc)}
                                                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-theme-secondary transition"
                                                                title="Copy link"
                                                            >
                                                                <FaShareAlt className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {doc.version > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(`/documents/${doc._id}/versions`)}
                                                                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-violet-600 transition"
                                                                title="Version history"
                                                            >
                                                                <FaHistory className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isHRUser && doc.requiresApproval && doc.approvalStatus === 'Pending' && (
                                                        <div className="flex gap-1 mt-2 justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(doc._id)}
                                                                className="text-xs px-2 py-1 rounded bg-theme-primary text-white hover:opacity-90"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRejectingDoc(doc)}
                                                                className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {documents.length === 0 && !loading && (
                            <div className="text-center py-16">
                                <FaFolder className="mx-auto text-gray-300 text-5xl mb-3" />
                                <p className="text-gray-500">No documents match your filters.</p>
                            </div>
                        )}

                        {total > 0 && (
                            <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
                                <span>
                                    Showing {rangeStart}–{rangeEnd} of {total} documents
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={curPage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-gray-500 px-2">
                                        Page {curPage} of {Math.max(1, pages || 1)}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={curPage >= (pages || 1)}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </main>
            </div>

            {/* Upload modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Upload document</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            PDF, Word, PNG or JPEG up to 5 MB. HR uploads are approved automatically.
                        </p>
                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="upload-file" className="block text-sm font-medium text-gray-700 mb-1">
                                    File <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="upload-file"
                                    type="file"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/*"
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-theme-secondary file:text-white"
                                    onChange={(ev) => {
                                        const f = ev.target.files?.[0];
                                        setUploadFile(f || null);
                                        if (f) {
                                            setUploadName((prev) =>
                                                prev.trim() ? prev : f.name.replace(/\.[^/.]+$/, '')
                                            );
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <label htmlFor="upload-name" className="block text-sm font-medium text-gray-700 mb-1">
                                    Display name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="upload-name"
                                    type="text"
                                    value={uploadName}
                                    onChange={(ev) => setUploadName(ev.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    placeholder="e.g. Employee handbook 2025"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="upload-category" className="block text-sm font-medium text-gray-700 mb-1">
                                    Category
                                </label>
                                <select
                                    id="upload-category"
                                    value={uploadCategory}
                                    onChange={(ev) => setUploadCategory(ev.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="upload-description" className="block text-sm font-medium text-gray-700 mb-1">
                                    Description (optional)
                                </label>
                                <textarea
                                    id="upload-description"
                                    value={uploadDescription}
                                    onChange={(ev) => setUploadDescription(ev.target.value)}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                    placeholder="Short summary"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowUploadModal(false);
                                        resetUploadForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading || !uploadFile}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50"
                                >
                                    {uploading ? 'Uploading…' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reject from table row */}
            {rejectingDoc && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Reject document</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{rejectingDoc.name}</strong>
                        </p>
                        <textarea
                            value={pendingNotes[rejectingDoc._id] || ''}
                            onChange={(e) =>
                                setPendingNotes((prev) => ({ ...prev, [rejectingDoc._id]: e.target.value }))
                            }
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] mb-4"
                            placeholder="Rejection reason…"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRejectingDoc(null)}
                                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReject(rejectingDoc)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* In-page document preview (same tab) */}
            {previewDoc && (
                <div className="fixed inset-0 z-[110] flex flex-col bg-slate-900/90">
                    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
                        <h3 className="font-semibold text-gray-800 truncate">{previewDoc.title}</h3>
                        <button
                            type="button"
                            onClick={closePreview}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                        >
                            <FaTimes className="w-3.5 h-3.5" />
                            Close
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 bg-gray-100">
                        {previewDoc.mimeType?.startsWith('image/') ? (
                            <div className="flex items-center justify-center w-full h-full p-4">
                                <img
                                    src={previewDoc.url}
                                    alt={previewDoc.title}
                                    className="max-w-full max-h-full object-contain shadow-lg"
                                />
                            </div>
                        ) : (
                            <iframe
                                src={previewDoc.url}
                                title={previewDoc.title}
                                className="w-full h-full border-0 bg-white"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DocumentsPage;
