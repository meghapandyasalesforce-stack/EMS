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
    FaFilePdf,
    FaFileWord,
    FaTimes,
    FaTrash,
    FaSyncAlt,
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios, { fetchDocumentWithFallback, getDocumentDownloadUrl, saveDocumentDownload } from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import logger from '../../utils/logger';
import { canAccessHrDocuments } from '../../utils/managerHelper';
import { ADMIN_DOCUMENTS_ENDPOINT, EMPLOYEE_AUTH_ENDPOINT } from '../../utils/constant';

const DOCUMENT_CATEGORY_OPTIONS = [
    'Employee', 'Company', 'Policy', 'Contract', 'Certificate',
    'Training', 'Compliance', 'Financial', 'Legal', 'Other'
];

/** Employee-owned documents must name their owner (server rejects the upload otherwise). */
const OWNER_REQUIRED_CATEGORY = 'Employee';

/** Matches server parsePagination maxLimit for employee list endpoints. */
const EMPLOYEE_PICKER_PAGE_SIZE = 100;
const EMPLOYEE_PICKER_MAX_PAGES = 50;

function employeeMatchesQuery(employee, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return true;
    const name = formatEmployeeFullName(employee).toLowerCase();
    const email = String(employee?.email || '').toLowerCase();
    const code = String(employee?.employeeId || '').toLowerCase();
    return name.includes(q) || email.includes(q) || code.includes(q);
}

/**
 * Load the full org roster for the owner typeahead (paginated).
 * Admins use /admin/employee; HR users fall back to the employee roster on 401/403.
 */
async function fetchAllEmployeeOptions() {
    const fetchPage = async (page) => {
        const params = { page, limit: EMPLOYEE_PICKER_PAGE_SIZE };
        try {
            const { data } = await axios.get('/v1/admin/employee', { withCredentials: true, params });
            return {
                employees: data?.data || [],
                hasNext: Boolean(data?.pagination?.hasNext),
            };
        } catch (error) {
            if (error.response?.status === 401 || error.response?.status === 403) {
                const { data } = await axios.get(`${EMPLOYEE_AUTH_ENDPOINT}/get-all-employees`, {
                    withCredentials: true,
                    params,
                });
                return {
                    employees: data?.data || data?.employees || [],
                    hasNext: Boolean(data?.pagination?.hasNext),
                };
            }
            throw error;
        }
    };

    const all = [];
    let page = 1;
    let hasNext = true;
    while (hasNext && page <= EMPLOYEE_PICKER_MAX_PAGES) {
        const result = await fetchPage(page);
        all.push(...(result.employees || []));
        hasNext = result.hasNext;
        page += 1;
    }
    return all;
}

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
    // Prefer relatedId (owner) over uploadedBy — HR-issued docs are uploaded by HR, owned by the employee.
    const related =
        doc.relatedTo === 'Employee' && isPopulatedPerson(doc.relatedId) ? doc.relatedId : null;
    const person = related || uploader;

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
    if (c === 'Policy') return 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/70';
    if (c === 'Contract') return 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200/70';
    if (c === 'Certificate') return 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/70';
    if (c === 'Other') return 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200';
    return 'bg-gray-100 text-gray-800 ring-1 ring-inset ring-gray-200';
}

function statusPill(doc) {
    if (doc.requiresApproval && doc.approvalStatus === 'Pending') {
        return { label: 'Pending approval', className: 'bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200/80' };
    }
    if (doc.approvalStatus === 'Withdrawn' &&
        String(doc.rejectionReason || '').toLowerCase().includes('deleted by hr')) {
        return { label: 'Deleted by HR', className: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200' };
    }
    const removedByEmployee =
        doc.approvalStatus === 'Withdrawn' ||
        (doc.approvalStatus === 'Rejected' &&
            String(doc.rejectionReason || '').toLowerCase().includes('removed by employee'));
    if (removedByEmployee) {
        return { label: 'Withdrawn by employee', className: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200' };
    }
    if (doc.approvalStatus === 'Rejected') {
        return { label: 'Rejected', className: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-200/80' };
    }
    return { label: 'Active', className: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/80' };
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

    const [filterEmployee, setFilterEmployee] = useState(null);
    const [filterEmployeeSearch, setFilterEmployeeSearch] = useState('');
    const [filterEmployeeOptions, setFilterEmployeeOptions] = useState([]);
    const [filterEmployeeLoading, setFilterEmployeeLoading] = useState(false);
    const [filterEmployeeOpen, setFilterEmployeeOpen] = useState(false);
    const filterEmployeeRef = useRef(null);

    const filteredFilterEmployees = useMemo(
        () => filterEmployeeOptions.filter((employee) => employeeMatchesQuery(employee, filterEmployeeSearch)),
        [filterEmployeeOptions, filterEmployeeSearch]
    );

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
    const [deleteDoc, setDeleteDoc] = useState(null);

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
    const [uploadOwner, setUploadOwner] = useState(null);
    const [ownerSearchInput, setOwnerSearchInput] = useState('');
    const [ownerOptions, setOwnerOptions] = useState([]);
    const [ownerOptionsLoading, setOwnerOptionsLoading] = useState(false);
    const [ownerPickerOpen, setOwnerPickerOpen] = useState(false);
    const ownerPickerRef = useRef(null);
    const ownerRequired = uploadCategory === OWNER_REQUIRED_CATEGORY;

    const filteredOwnerOptions = useMemo(
        () => ownerOptions.filter((employee) => employeeMatchesQuery(employee, ownerSearchInput)),
        [ownerOptions, ownerSearchInput]
    );

    const [versionDoc, setVersionDoc] = useState(null);
    const [versionFile, setVersionFile] = useState(null);
    const [versionUploading, setVersionUploading] = useState(false);

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
        setUploadOwner(null);
        setOwnerSearchInput('');
        setOwnerOptions([]);
        setOwnerPickerOpen(false);
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
            if (filterEmployee?._id) {
                params.relatedId = filterEmployee._id;
            }

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
    }, [page, selectedCategoryParam, debouncedSearch, accessBucketsParam, filterEmployee?._id]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    useEffect(() => {
        if (isHRUser) fetchPendingDocuments();
    }, [isHRUser, fetchPendingDocuments]);

    useEffect(() => {
        if (!showUploadModal || !ownerRequired) return;
        let cancelled = false;
        setOwnerOptionsLoading(true);
        fetchAllEmployeeOptions()
            .then((employees) => {
                if (!cancelled) setOwnerOptions(employees);
            })
            .catch((error) => {
                if (cancelled) return;
                logger.error('Error fetching employees for document owner:', error);
                setOwnerOptions([]);
                toast.error('Failed to load employees. Please try again.');
            })
            .finally(() => {
                if (!cancelled) setOwnerOptionsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [showUploadModal, ownerRequired]);

    useEffect(() => {
        if (!ownerPickerOpen) return undefined;
        const onPointerDown = (event) => {
            if (ownerPickerRef.current && !ownerPickerRef.current.contains(event.target)) {
                setOwnerPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [ownerPickerOpen]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, accessBucketsParam, filterEmployee?._id]);

    useEffect(() => {
        if (!isHRUser) return;
        let cancelled = false;
        setFilterEmployeeLoading(true);
        fetchAllEmployeeOptions()
            .then((employees) => {
                if (!cancelled) setFilterEmployeeOptions(employees);
            })
            .catch((error) => {
                if (cancelled) return;
                logger.error('Error fetching employees for document filter:', error);
                setFilterEmployeeOptions([]);
            })
            .finally(() => {
                if (!cancelled) setFilterEmployeeLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [isHRUser]);

    useEffect(() => {
        if (!filterEmployeeOpen) return undefined;
        const onPointerDown = (event) => {
            if (filterEmployeeRef.current && !filterEmployeeRef.current.contains(event.target)) {
                setFilterEmployeeOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [filterEmployeeOpen]);

    const clearEmployeeFilter = () => {
        setFilterEmployee(null);
        setFilterEmployeeSearch('');
        setFilterEmployeeOpen(false);
        setPage(1);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadFile) {
            toast.error('Please choose a file');
            return;
        }
        if (ownerRequired && !uploadOwner) {
            toast.error('Select the employee this document belongs to');
            return;
        }
        const name = uploadName.trim() || uploadFile.name;
        const formData = new FormData();
        formData.append('document', uploadFile);
        formData.append('name', name);
        formData.append('category', uploadCategory);
        if (ownerRequired) {
            formData.append('relatedId', uploadOwner._id);
        }
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

    const handleUploadVersion = async (e) => {
        e.preventDefault();
        if (!versionFile || !versionDoc?._id) return;
        const formData = new FormData();
        formData.append('document', versionFile);
        try {
            setVersionUploading(true);
            await axios.post(
                `${ADMIN_DOCUMENTS_ENDPOINT}/${versionDoc._id}/versions`,
                formData,
                { withCredentials: true }
            );
            toast.success('New version uploaded successfully');
            setVersionDoc(null);
            setVersionFile(null);
            await fetchDocuments();
        } catch (error) {
            logger.error('Error uploading version:', error);
            toast.error(error.response?.data?.message || 'Failed to upload new version');
        } finally {
            setVersionUploading(false);
        }
    };

    const handleDeleteDocument = async () => {
        if (!deleteDoc?._id) return;
        const docId = deleteDoc._id;
        setDocActionLoading((prev) => ({ ...prev, [docId]: 'delete' }));
        try {
            await axios.delete(`${ADMIN_DOCUMENTS_ENDPOINT}/${docId}`, { withCredentials: true });
            toast.success('Document deleted successfully');
            setDeleteDoc(null);
            await fetchDocuments();
            if (isHRUser) await fetchPendingDocuments();
        } catch (error) {
            logger.error('Error deleting document:', error);
            toast.error(error.response?.data?.message || 'Failed to delete document');
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
        <div className="page-shell min-h-screen bg-slate-50 transition-all duration-300">
            <div className="page-shell-inner mx-auto max-w-[1600px] space-y-5">
                <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Document management
                        </p>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Documents
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">
                            Manage, approve, and track organization-wide records.
                        </p>
                    </div>
                    {isHRUser && (
                        <button
                            type="button"
                            onClick={openUploadModal}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-theme-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-theme-primary"
                        >
                            <FaUpload className="h-4 w-4" />
                            Upload document
                        </button>
                    )}
                </header>

                {/* Sticky filters */}
                <div className="sticky top-2 z-20 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                            <div className="relative min-w-0 flex-1">
                                <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search by document name…"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>

                            {isHRUser && (
                                <div ref={filterEmployeeRef} className="relative w-full lg:w-80">
                                    <div className="relative">
                                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="search"
                                            value={filterEmployeeSearch}
                                            onChange={(e) => {
                                                setFilterEmployeeSearch(e.target.value);
                                                setFilterEmployeeOpen(true);
                                                if (filterEmployee) setFilterEmployee(null);
                                            }}
                                            onFocus={() => setFilterEmployeeOpen(true)}
                                            autoComplete="off"
                                            placeholder="Filter by employee…"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2.5 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        />
                                        {(filterEmployee || filterEmployeeSearch) && (
                                            <button
                                                type="button"
                                                onClick={clearEmployeeFilter}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                                title="Clear employee filter"
                                            >
                                                <FaTimes className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                    {filterEmployeeOpen && (
                                        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                            {filterEmployeeLoading ? (
                                                <p className="px-3 py-2 text-sm text-slate-500">Loading employees…</p>
                                            ) : filteredFilterEmployees.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-slate-500">No matching employees</p>
                                            ) : (
                                                <ul className="py-1">
                                                    {filteredFilterEmployees.map((option) => (
                                                        <li key={option._id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setFilterEmployee(option);
                                                                    setFilterEmployeeSearch(formatEmployeeFullName(option));
                                                                    setFilterEmployeeOpen(false);
                                                                    setPage(1);
                                                                }}
                                                                className="flex w-full flex-col px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-50"
                                                            >
                                                                <span className="font-medium">{formatEmployeeFullName(option)}</span>
                                                                <span className="text-xs text-slate-500">
                                                                    {[option.employeeId, option.email].filter(Boolean).join(' · ')}
                                                                </span>
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    {filterEmployee && (
                                        <p className="mt-1 text-xs text-emerald-700">
                                            Showing documents for {formatEmployeeFullName(filterEmployee)}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div
                                className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                                role="tablist"
                                aria-label="Document categories"
                            >
                                {CATEGORY_NAV.map((item) => {
                                    const active = sidebarCategoryKey === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => {
                                                setSidebarCategoryKey(item.key);
                                                setPage(1);
                                            }}
                                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                                                active
                                                    ? 'bg-theme-secondary text-white shadow-sm'
                                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                                            }`}
                                        >
                                            <FaFolder className={`h-3 w-3 ${active ? 'text-white/90' : 'text-slate-500'}`} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Access
                                </span>
                                <label
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                        accessPublic
                                            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                            : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={accessPublic}
                                        onChange={(e) => setAccessPublic(e.target.checked)}
                                    />
                                    Public
                                </label>
                                <label
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                        accessRestricted
                                            ? 'bg-violet-50 text-violet-800 ring-1 ring-violet-200'
                                            : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={accessRestricted}
                                        onChange={(e) => setAccessRestricted(e.target.checked)}
                                    />
                                    Restricted
                                </label>
                                <label
                                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                                        accessConfidential
                                            ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                            : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={accessConfidential}
                                        onChange={(e) => setAccessConfidential(e.target.checked)}
                                    />
                                    Confidential
                                </label>
                                <span className="hidden text-[10px] text-slate-400 sm:inline">
                                    (none = all levels)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {isHRUser && (
                    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                            <div className="flex items-center gap-2">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                                    <FaFileAlt className="h-4 w-4" />
                                </span>
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900">Pending approvals</h2>
                                    <p className="text-xs text-slate-500">Review employee submissions</p>
                                </div>
                            </div>
                            {pendingCount > 0 ? (
                                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-800">
                                    {pendingCount} pending
                                </span>
                            ) : (
                                <span className="text-xs font-medium text-emerald-600">All caught up</span>
                            )}
                        </div>

                        <div className="space-y-3 p-4 sm:p-5">
                            {pendingDocuments.length === 0 ? (
                                <p className="py-6 text-center text-sm text-slate-500">
                                    No documents pending HR approval.
                                </p>
                            ) : (
                                pendingDocuments.map((doc) => (
                                    <div
                                        key={doc._id}
                                        className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition hover:border-slate-200 hover:bg-slate-50 xl:flex-row xl:items-stretch"
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

                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Recent documents</h2>
                            <p className="text-xs text-slate-500">
                                {total > 0
                                    ? `${total.toLocaleString()} record${total === 1 ? '' : 's'}`
                                    : 'Filtered list'}
                            </p>
                        </div>
                        <FaFilter className="h-4 w-4 text-slate-400" title="Filters applied above" />
                    </div>

                    <div className="hr-docs-table-scroll overflow-x-auto">
                        <table className="hr-docs-table min-w-[720px] w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/90 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3 sm:px-5">Employee</th>
                                    <th className="px-4 py-3 sm:px-5">Document</th>
                                    <th className="px-4 py-3 sm:px-5">Category</th>
                                    <th className="px-4 py-3 sm:px-5">Version</th>
                                    <th className="px-4 py-3 sm:px-5">Status</th>
                                    <th className="px-4 py-3 sm:px-5">Last modified</th>
                                    <th className="px-4 py-3 text-right sm:px-5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {documents.map((doc) => {
                                    const st = statusPill(doc);
                                    const Icon = fileIcon(doc);
                                    const owner = resolveDocumentEmployee(doc);
                                    return (
                                        <tr
                                            key={doc._id}
                                            className="group transition-colors hover:bg-emerald-50/30"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                                                <div className="flex max-w-[220px] min-w-0 items-center gap-2.5">
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-[10px] font-bold text-slate-700">
                                                        {owner.isOrganizationDoc ? 'ORG' : initialsFromPerson(owner.person)}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <div className="truncate font-semibold text-slate-900">
                                                            {owner.name}
                                                        </div>
                                                        {owner.code ? (
                                                            <div className="truncate text-xs text-slate-500">{owner.code}</div>
                                                        ) : owner.department ? (
                                                            <div className="truncate text-xs text-slate-500">{owner.department}</div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5">
                                                <div className="flex max-w-xs min-w-0 items-center gap-2.5 sm:max-w-md">
                                                    <span className="shrink-0 rounded-xl bg-theme-secondary/10 p-2.5 text-theme-secondary ring-1 ring-theme-secondary/10">
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <div className="min-w-0">
                                                        <span className="block truncate font-medium text-slate-900">
                                                            {documentDisplayTitle(doc)}
                                                        </span>
                                                        {documentDisplaySubtitle(doc) ? (
                                                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                                                                {documentDisplaySubtitle(doc)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 sm:px-5">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryPillClass(doc.category)}`}
                                                >
                                                    {doc.category || 'Other'}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700 sm:px-5">
                                                v{doc.version ?? 1}
                                            </td>
                                            <td className="px-4 py-3.5 sm:px-5">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${st.className}`}
                                                >
                                                    {st.label}
                                                </span>
                                                {doc.approvalStatus === 'Rejected' && doc.rejectionReason &&
                                                    !String(doc.rejectionReason).toLowerCase().includes('removed by employee') && (
                                                    <p className="mt-1 max-w-[180px] truncate text-[11px] text-red-600" title={doc.rejectionReason}>
                                                        {doc.rejectionReason}
                                                    </p>
                                                )}
                                                {doc.approvedBy && (doc.approvalStatus === 'Approved' || doc.approvalStatus === 'Rejected') && (
                                                    <p className="mt-0.5 text-[10px] text-slate-400">
                                                        by {doc.approvedBy.name
                                                            ? `${doc.approvedBy.name}${doc.approvedBy.lastName ? ' ' + doc.approvedBy.lastName : ''}`
                                                            : doc.approvedBy.email || 'HR'}
                                                        {doc.approvedAt ? ` · ${formatRelativeTime(doc.approvedAt)}` : ''}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 sm:px-5">
                                                {doc.updatedAt
                                                    ? `${new Date(doc.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} (${formatRelativeTime(doc.updatedAt)})`
                                                    : formatRelativeTime(doc.createdAt)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                                                <div className="inline-flex items-center justify-end gap-0.5 opacity-90 transition group-hover:opacity-100">
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
                                                        {isHRUser && doc.category !== 'Employee' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => { setVersionDoc(doc); setVersionFile(null); }}
                                                                className="p-2 rounded-lg text-gray-500 hover:bg-violet-50 hover:text-violet-600 transition"
                                                                title="Upload new version"
                                                            >
                                                                <FaSyncAlt className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {isHRUser && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeleteDoc(doc)}
                                                                disabled={docActionLoading[doc._id] === 'delete'}
                                                                className="p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition"
                                                                title="Delete"
                                                            >
                                                                <FaTrash className="w-4 h-4" />
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
                            <div className="py-16 text-center">
                                <FaFolder className="mx-auto mb-3 text-5xl text-slate-300" />
                                <p className="text-sm font-medium text-slate-600">No documents match your filters.</p>
                                <p className="mt-1 text-xs text-slate-400">Try another category or clear access filters.</p>
                            </div>
                        )}

                        {total > 0 && (
                            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:px-5">
                                <span>
                                    Showing {rangeStart}–{rangeEnd} of {total} documents
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={curPage <= 1}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        Previous
                                    </button>
                                    <span className="px-2 text-slate-500">
                                        Page {curPage} of {Math.max(1, pages || 1)}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={curPage >= (pages || 1)}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                </section>
            </div>

            {/* Upload modal */}
            {showUploadModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-slate-900">Upload document</h3>
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
                                    onChange={(ev) => {
                                        const next = ev.target.value;
                                        setUploadCategory(next);
                                        if (next !== OWNER_REQUIRED_CATEGORY) {
                                            setUploadOwner(null);
                                            setOwnerSearchInput('');
                                            setOwnerPickerOpen(false);
                                        }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    {DOCUMENT_CATEGORY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            {ownerRequired && (
                                <div ref={ownerPickerRef} className="relative">
                                    <label htmlFor="upload-owner-search" className="block text-sm font-medium text-gray-700 mb-1">
                                        Employee <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                                        <input
                                            id="upload-owner-search"
                                            type="text"
                                            value={ownerSearchInput}
                                            onChange={(ev) => {
                                                setOwnerSearchInput(ev.target.value);
                                                setOwnerPickerOpen(true);
                                                if (uploadOwner) setUploadOwner(null);
                                            }}
                                            onFocus={() => setOwnerPickerOpen(true)}
                                            autoComplete="off"
                                            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                            placeholder="Search or pick an employee"
                                        />
                                    </div>
                                    {ownerPickerOpen && (
                                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                            {ownerOptionsLoading ? (
                                                <p className="px-3 py-2 text-sm text-slate-500">Loading employees…</p>
                                            ) : filteredOwnerOptions.length === 0 ? (
                                                <p className="px-3 py-2 text-sm text-slate-500">
                                                    {ownerOptions.length === 0
                                                        ? 'No employees found in this organization'
                                                        : 'No matches — try another name, email or ID'}
                                                </p>
                                            ) : (
                                                <ul className="py-1">
                                                    {filteredOwnerOptions.map((option) => {
                                                        const selected = uploadOwner?._id === option._id;
                                                        return (
                                                            <li key={option._id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setUploadOwner(option);
                                                                        setOwnerSearchInput(formatEmployeeFullName(option));
                                                                        setOwnerPickerOpen(false);
                                                                    }}
                                                                    className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                                                        selected ? 'bg-emerald-50 text-emerald-900' : 'text-slate-800'
                                                                    }`}
                                                                >
                                                                    <span className="font-medium">{formatEmployeeFullName(option)}</span>
                                                                    <span className="text-xs text-slate-500">
                                                                        {[option.employeeId, option.email].filter(Boolean).join(' · ')}
                                                                    </span>
                                                                </button>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                    {uploadOwner && (
                                        <p className="mt-1.5 text-xs text-emerald-700">
                                            Selected: {formatEmployeeFullName(uploadOwner)}
                                            {uploadOwner.employeeId ? ` · ${uploadOwner.employeeId}` : ''}
                                        </p>
                                    )}
                                    {!uploadOwner && (
                                        <p className="mt-1 text-xs text-slate-400">
                                            {ownerOptionsLoading
                                                ? 'Loading full employee list…'
                                                : `${ownerOptions.length} employee${ownerOptions.length === 1 ? '' : 's'} available — type to filter or pick from the list.`}
                                        </p>
                                    )}
                                </div>
                            )}
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
                                    disabled={uploading || !uploadFile || (ownerRequired && !uploadOwner)}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50"
                                >
                                    {uploading ? 'Uploading…' : 'Upload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload new version modal */}
            {versionDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-slate-900">Upload new version</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            <span className="font-medium text-slate-700">{versionDoc.name}</span>
                            {' '}· currently v{versionDoc.version ?? 1}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            The current file will be saved to version history. Employees will immediately see the new file.
                        </p>
                        <form onSubmit={handleUploadVersion} className="mt-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New file <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="file"
                                    required
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/*"
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-theme-secondary file:text-white"
                                    onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setVersionDoc(null); setVersionFile(null); }}
                                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={versionUploading || !versionFile}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition disabled:opacity-50 text-sm font-semibold"
                                >
                                    {versionUploading ? 'Uploading…' : `Upload as v${(versionDoc.version ?? 1) + 1}`}
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

            {/* Delete confirmation modal */}
            {deleteDoc && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete document?</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Are you sure you want to delete <strong>{deleteDoc.name || deleteDoc.fileName}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteDoc(null)}
                                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm font-medium text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteDocument}
                                disabled={docActionLoading[deleteDoc._id] === 'delete'}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50"
                            >
                                Delete
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
