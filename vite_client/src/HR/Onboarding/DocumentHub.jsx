import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import {
    FaCheck, FaClock, FaDownload, FaExclamationTriangle, FaFolderOpen, FaTimes,
    FaFileAlt, FaThLarge, FaList, FaCloudUploadAlt, FaArrowLeft, FaHistory,
} from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CmBadge, CmButton, CmSearch, CmStat, CmPerson, CmEmpty, statusTone } from '../../components/corporateModern';

const TABS = [
    { id: 'library', label: 'Employee Documents' },
    { id: 'pending', label: 'Pending Verification' },
    { id: 'expiry', label: 'Expiry Dashboard' },
    { id: 'categories', label: 'Policy Acknowledgment' },
    { id: 'reports', label: 'Reports' },
];

const DocumentHub = () => {
    const [tab, setTab] = useState('library');
    const [loading, setLoading] = useState(true);
    const [documents, setDocuments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [catalog, setCatalog] = useState({ categories: {}, entries: [] });
    const [expiry, setExpiry] = useState(null);
    const [reports, setReports] = useState(null);
    const [selected, setSelected] = useState(new Set());
    const [filters, setFilters] = useState({ search: '', hubCategory: '', verificationStatus: '' });
    const [departmentFilter, setDepartmentFilter] = useState('');
    const [libraryView, setLibraryView] = useState('grid');
    const [selectedFolderKey, setSelectedFolderKey] = useState(null);

    const hubBase = `${ADMIN_LIFECYCLE_ENDPOINT}/document-hub`;

    const loadCategories = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/categories`, { withCredentials: true });
        setCategories(data.data || []);
    }, [hubBase]);

    const loadLibrary = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/library`, {
            params: {
                search: filters.search || undefined,
                hubCategory: filters.hubCategory || undefined,
                verificationStatus: filters.verificationStatus || undefined,
            },
            withCredentials: true,
        });
        setDocuments(data.data || []);
    }, [hubBase, filters]);

    const loadPending = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/pending`, { withCredentials: true });
        setDocuments(data.data || []);
    }, [hubBase]);

    const loadExpiry = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/expiry`, { withCredentials: true });
        setExpiry(data.data);
    }, [hubBase]);

    const loadCatalog = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/catalog`, { withCredentials: true });
        setCatalog(data.data || { categories: {}, entries: [] });
    }, [hubBase]);

    const loadReports = useCallback(async () => {
        const { data } = await axios.get(`${hubBase}/reports`, { withCredentials: true });
        setReports(data.data);
    }, [hubBase]);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            await loadCategories();
            if (tab === 'library') {
                await Promise.all([loadLibrary(), loadReports()]);
            } else if (tab === 'pending') await loadPending();
            else if (tab === 'expiry') await loadExpiry();
            else if (tab === 'categories') await loadCatalog();
            else if (tab === 'reports') await loadReports();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load document hub');
        } finally {
            setLoading(false);
        }
    }, [tab, loadLibrary, loadPending, loadExpiry, loadCatalog, loadReports, loadCategories]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        setSelectedFolderKey(null);
    }, [tab, filters.hubCategory, filters.verificationStatus]);

    const toggleSelect = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const verifyDoc = async (id, status) => {
        const remarks = status === 'Rejected' ? window.prompt('Rejection reason:') : '';
        if (status === 'Rejected' && remarks === null) return;
        try {
            await axios.post(`${hubBase}/${id}/verify`, { status, remarks }, { withCredentials: true });
            toast.success(`Document ${status.toLowerCase()}`);
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        }
    };

    const bulkVerify = async (status) => {
        if (!selected.size) return toast.warn('Select documents first');
        try {
            await axios.post(`${hubBase}/bulk/verify`, {
                documentIds: [...selected],
                status,
                remarks: status === 'Rejected' ? 'Bulk rejected' : undefined,
            }, { withCredentials: true });
            toast.success(`Bulk ${status.toLowerCase()} complete`);
            setSelected(new Set());
            await load();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Bulk action failed');
        }
    };

    const bulkRemind = async () => {
        if (!selected.size) return toast.warn('Select documents first');
        try {
            await axios.post(`${hubBase}/bulk/remind`, { documentIds: [...selected] }, { withCredentials: true });
            toast.success('Reminders sent');
            setSelected(new Set());
        } catch (error) {
            toast.error(error.response?.data?.message || 'Reminder failed');
        }
    };

    const exportCsv = async () => {
        try {
            const { data } = await axios.get(`${hubBase}/library/export`, {
                withCredentials: true,
                responseType: 'blob',
                params: filters,
            });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'document-hub-export.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error('Export failed');
        }
    };

    const employeeFolders = useMemo(() => {
        if (tab !== 'library') return [];
        const map = new Map();
        documents.forEach((doc) => {
            const emp = doc.uploadedBy;
            const key = (emp?._id || emp?.id || 'unassigned').toString();
            if (!map.has(key)) {
                const name = emp?.firstName
                    ? `${emp.firstName} ${emp.lastName || ''}`.trim()
                    : emp?.name || 'Unassigned';
                const jobTitle = emp?.jobTitle || emp?.designation || '';
                const department = emp?.department || '—';
                map.set(key, {
                    key,
                    name,
                    jobTitle,
                    department,
                    documents: [],
                });
            }
            map.get(key).documents.push(doc);
        });
        return Array.from(map.values()).map((folder) => {
            const total = folder.documents.length;
            const approved = folder.documents.filter((d) =>
                (d.verificationStatus || d.approvalStatus) === 'Approved').length;
            return { ...folder, total, compliance: total ? Math.round((approved / total) * 100) : 0 };
        });
    }, [documents, tab]);

    const departmentOptions = useMemo(() => (
        [...new Set(employeeFolders.map((f) => f.department).filter((d) => d && d !== '—'))].sort()
    ), [employeeFolders]);

    const filteredEmployeeFolders = useMemo(() => {
        let list = employeeFolders;
        if (departmentFilter) {
            list = list.filter((f) => f.department === departmentFilter);
        }
        const q = (filters.search || '').trim().toLowerCase();
        if (q) {
            list = list.filter((f) =>
                f.name.toLowerCase().includes(q)
                || f.department.toLowerCase().includes(q)
                || (f.jobTitle || '').toLowerCase().includes(q));
        }
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }, [employeeFolders, departmentFilter, filters.search]);

    const selectedFolder = useMemo(() => (
        selectedFolderKey
            ? employeeFolders.find((f) => f.key === selectedFolderKey) || null
            : null
    ), [employeeFolders, selectedFolderKey]);

    const folderDocuments = selectedFolder?.documents || [];

    const complianceStats = useMemo(() => {
        if (reports?.byDepartment?.length) {
            const total = reports.byDepartment.reduce((sum, d) => sum + (d.count || 0), 0);
            const pending = reports.byDepartment.reduce((sum, d) => sum + (d.pending || 0), 0);
            return { total, pending, rate: total ? Math.round(((total - pending) / total) * 100) : 0 };
        }
        if (documents.length) {
            const approved = documents.filter((d) =>
                (d.verificationStatus || d.approvalStatus) === 'Approved').length;
            const pending = documents.filter((d) =>
                (d.verificationStatus || d.approvalStatus) === 'Pending').length;
            return {
                total: documents.length,
                pending,
                rate: Math.round((approved / documents.length) * 100),
            };
        }
        return null;
    }, [reports, documents]);

    if (loading && !documents.length && !expiry && !reports) return <LoadingSpinner />;

    const pendingAlertCount = reports?.pending ?? expiry?.expiringSoon ?? null;

    return (
        <div className="cm-hrms">
            <div className="cm-page">
                {/* ── Top compliance bar ── */}
                <div className="cm-card">
                    <div className="rounded-[1.75rem] bg-[var(--cm-surface-low)] px-4 py-4 sm:px-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(220px,0.9fr)] lg:items-center">
                            <div className="min-w-0">
                                <p className="cm-label">Organization Compliance</p>
                                <div className="mt-1 flex items-center gap-3">
                                    <span className="text-[2rem] font-bold leading-none text-[var(--cm-primary-deep)]">
                                        {complianceStats ? `${complianceStats.rate}%` : '—'}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="cm-progress">
                                            <div className="cm-progress__bar" style={{ width: `${complianceStats?.rate ?? 0}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-l-0 lg:border-l lg:border-[rgba(187,202,193,0.45)] lg:pl-6">
                                <p className="text-sm font-medium text-[var(--cm-on-surface)]">Mandatory Docs</p>
                                <p className="cm-subtitle mt-0">Completion</p>
                            </div>

                            <div className="border-l-0 lg:border-l lg:border-[rgba(187,202,193,0.45)] lg:pl-6">
                                <p className="cm-label">Active Alerts</p>
                                <p className="mt-1 text-sm font-semibold text-[var(--cm-tertiary-deep)]">
                                    {(reports?.pending ?? 0) > 0 ? `${reports?.pending ?? 0} Pending Policies` : 'No pending policies'}
                                </p>
                            </div>

                            <div className="flex items-center gap-3 lg:justify-end">
                                <span className="cm-label whitespace-nowrap">Filter by:</span>
                                <select
                                    value={departmentFilter}
                                    onChange={(e) => setDepartmentFilter(e.target.value)}
                                    className="cm-select min-w-[180px] rounded-full"
                                    aria-label="Filter by department"
                                >
                                    <option value="">All Departments</option>
                                    {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="cm-tabs mt-5">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`cm-tab ${tab === t.id ? 'cm-tab--active' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {pendingAlertCount != null && pendingAlertCount > 0 && (
                        <div className="cm-banner cm-banner--attention mt-4">
                            {pendingAlertCount} document{pendingAlertCount === 1 ? '' : 's'} need attention. Check the Pending Verification or Expiry Dashboard tabs.
                        </div>
                    )}
                </div>

                {(tab === 'library' || tab === 'pending') && !selectedFolderKey && (
                    <div className="cm-card">
                        <div className="flex flex-wrap items-center gap-3">
                            {tab === 'library' && (
                                <>
                                    <div className="min-w-[220px] max-w-sm flex-1">
                                        <CmSearch
                                            value={filters.search}
                                            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                            placeholder="Search employees..."
                                        />
                                    </div>
                                    <select
                                        value={filters.hubCategory}
                                        onChange={(e) => setFilters((f) => ({ ...f, hubCategory: e.target.value }))}
                                        className="cm-select"
                                    >
                                        <option value="">All document types</option>
                                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <select
                                        value={filters.verificationStatus}
                                        onChange={(e) => setFilters((f) => ({ ...f, verificationStatus: e.target.value }))}
                                        className="cm-select"
                                    >
                                        <option value="">All statuses</option>
                                        {['Pending', 'Approved', 'Rejected', 'Expired', 'Renewal Pending'].map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    <CmButton variant="outline" size="sm" onClick={loadLibrary}>Apply filters</CmButton>
                                    <CmButton variant="secondary" size="sm" onClick={exportCsv}>
                                        <FaDownload /> CSV
                                    </CmButton>
                                </>
                            )}
                            {selected.size > 0 && (
                                <div className="ml-auto flex flex-wrap gap-2">
                                    <CmButton variant="primary" size="sm" onClick={() => bulkVerify('Approved')}>
                                        Approve ({selected.size})
                                    </CmButton>
                                    <CmButton variant="tertiary" size="sm" onClick={() => bulkVerify('Rejected')}>Reject</CmButton>
                                    <CmButton variant="outline" size="sm" onClick={bulkRemind}>Remind</CmButton>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'expiry' && expiry && (
                    <div className="cm-kpi-row cm-kpi-row--4">
                        <CmStat label="Expired" value={expiry.expired ?? 0} attention icon={<FaExclamationTriangle />} iconAttention />
                        <CmStat label="Expiring (30d)" value={expiry.expiringSoon ?? 0} icon={<FaClock />} />
                        <CmStat label="Expiring (7d)" value={expiry.expiringWeek ?? 0} attention icon={<FaClock />} iconAttention />
                        <CmStat label="Renewal Pending" value={expiry.renewalPending ?? 0} icon={<FaFolderOpen />} />
                    </div>
                )}

                {tab === 'reports' && reports && (
                    <div className="cm-kpi-row cm-kpi-row--4">
                        <CmStat label="Pending Verification" value={reports.pending ?? 0} attention={reports.pending > 0} />
                        <CmStat label="Rejected" value={reports.rejected ?? 0} />
                        <CmStat label="Expired" value={reports.expired ?? 0} attention={reports.expired > 0} />
                        <CmStat label="Expiring Soon" value={reports.expiring ?? 0} />
                    </div>
                )}

                {tab === 'library' && selectedFolder && (
                    <div className="cm-split">
                        <div className="cm-card space-y-4">
                            <button
                                type="button"
                                onClick={() => { setSelectedFolderKey(null); setSelected(new Set()); }}
                                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cm-primary-deep)] hover:underline"
                            >
                                <FaArrowLeft /> Employee Folders
                            </button>
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(187,202,193,0.35)] pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(0,108,81,0.1)] text-2xl text-[var(--cm-primary-deep)]">
                                        <FaFolderOpen />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--cm-on-surface)]">{selectedFolder.name}</h3>
                                        <p className="cm-subtitle mt-0.5">
                                            {[selectedFolder.jobTitle, selectedFolder.department].filter(Boolean).join(' · ')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <CmBadge tone="neutral">{selectedFolder.total} document{selectedFolder.total === 1 ? '' : 's'}</CmBadge>
                                    <CmBadge tone={selectedFolder.compliance >= 80 ? 'done' : 'attention'}>
                                        {selectedFolder.compliance}% compliance
                                    </CmBadge>
                                </div>
                            </div>
                            {selected.size > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <CmButton variant="primary" size="sm" onClick={() => bulkVerify('Approved')}>
                                        Approve ({selected.size})
                                    </CmButton>
                                    <CmButton variant="tertiary" size="sm" onClick={() => bulkVerify('Rejected')}>Reject</CmButton>
                                    <CmButton variant="outline" size="sm" onClick={bulkRemind}>Remind</CmButton>
                                </div>
                            )}
                            <DocumentTable
                                documents={folderDocuments}
                                selected={selected}
                                onToggle={toggleSelect}
                                onVerify={verifyDoc}
                                showSelect
                                showEmployeeColumn={false}
                            />
                        </div>
                        <div className="cm-card">
                            <h3 className="cm-title-sm mb-3">Recent Activity</h3>
                            <EmployeeActivityFeed documents={folderDocuments} />
                        </div>
                    </div>
                )}

                {tab === 'library' && !selectedFolder && (
                    <div className="cm-split cm-split--wide-side">
                        <div className="cm-card">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <h3 className="cm-title-sm mb-0">Employee Folders</h3>
                                <div className="inline-flex items-center gap-1 rounded-full bg-[var(--cm-surface-low)] p-1">
                                    <button
                                        type="button"
                                        onClick={() => setLibraryView('grid')}
                                        aria-label="Grid view"
                                        aria-pressed={libraryView === 'grid'}
                                        className={`cm-icon-btn ${libraryView === 'grid' ? 'bg-white text-[var(--cm-primary-deep)] shadow-sm' : ''}`}
                                    >
                                        <FaThLarge />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setLibraryView('list')}
                                        aria-label="List view"
                                        aria-pressed={libraryView === 'list'}
                                        className={`cm-icon-btn ${libraryView === 'list' ? 'bg-white text-[var(--cm-primary-deep)] shadow-sm' : ''}`}
                                    >
                                        <FaList />
                                    </button>
                                </div>
                            </div>

                            {libraryView === 'grid' ? (
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {filteredEmployeeFolders.map((folder) => (
                                        <button
                                            key={folder.key}
                                            type="button"
                                            onClick={() => setSelectedFolderKey(folder.key)}
                                            className="relative w-full max-w-[13rem] rounded-[1.75rem] border border-[rgba(187,202,193,0.45)] bg-white px-4 py-5 text-left shadow-sm transition hover:shadow-md hover:ring-1 hover:ring-[rgba(0,108,81,0.15)]"
                                        >
                                            <FaHistory className="absolute right-4 top-4 text-xs text-[var(--cm-muted)]" aria-hidden />
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(0,108,81,0.08)]">
                                                <FaFolderOpen className="text-xl text-[var(--cm-primary-deep)]" />
                                            </div>
                                            <p className="mt-5 truncate text-xl font-semibold text-[var(--cm-on-surface)]">{folder.name}</p>
                                            <p className="cm-subtitle mt-1 truncate">
                                                {[folder.jobTitle, folder.department].filter(Boolean).join(' · ') || folder.department}
                                            </p>
                                            <div className="mt-6 flex items-end justify-between gap-3">
                                                <span className="rounded-full bg-[var(--cm-surface-low)] px-3 py-1.5 text-xs font-medium text-[var(--cm-on-surface)]">
                                                    {folder.total} Documents
                                                </span>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${folder.compliance >= 80 ? 'text-[var(--cm-primary-deep)]' : 'text-[var(--cm-tertiary-deep)]'}`}>
                                                        {folder.compliance}%
                                                    </p>
                                                    <p className="text-xs text-[var(--cm-muted)]">Compliance</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {!filteredEmployeeFolders.length && (
                                        <div className="col-span-full">
                                            <CmEmpty title="No employee folders">Try another department or search term.</CmEmpty>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="cm-table-wrap">
                                    <table className="cm-table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Role / Department</th>
                                                <th>Documents</th>
                                                <th>Compliance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredEmployeeFolders.map((folder) => (
                                                <tr
                                                    key={folder.key}
                                                    className="cursor-pointer"
                                                    onClick={() => setSelectedFolderKey(folder.key)}
                                                >
                                                    <td>
                                                        <CmPerson name={folder.name} />
                                                    </td>
                                                    <td className="text-sm text-[var(--cm-muted)]">
                                                        {[folder.jobTitle, folder.department].filter(Boolean).join(' · ') || '—'}
                                                    </td>
                                                    <td>{folder.total}</td>
                                                    <td>
                                                        <CmBadge tone={folder.compliance >= 80 ? 'done' : 'attention'} dot={false}>
                                                            {folder.compliance}%
                                                        </CmBadge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {!filteredEmployeeFolders.length && (
                                        <CmEmpty title="No employee folders">Try another department or search term.</CmEmpty>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="cm-card cm-card--dashed flex min-h-[13rem] flex-col items-center justify-center gap-3 text-center text-[var(--cm-muted)]">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--cm-surface-low)]">
                                    <FaCloudUploadAlt className="text-2xl text-[var(--cm-primary-deep)] opacity-80" />
                                </div>
                                <span className="text-xl font-semibold text-[var(--cm-on-surface)]">Upload Policy</span>
                                <span className="max-w-[12rem] text-sm">Drag and drop or click to upload</span>
                            </div>
                            <div className="cm-card">
                                <h3 className="cm-title-sm mb-3">Recent Activity</h3>
                                <EmployeeActivityFeed documents={documents} />
                                <button type="button" className="mt-5 text-sm font-semibold text-[var(--cm-primary-deep)] hover:underline">
                                    View All Notifications
                                </button>
                            </div>
                            <div className="overflow-hidden rounded-[1.5rem] border border-[rgba(187,202,193,0.45)] bg-[linear-gradient(135deg,rgba(0,108,81,0.12),rgba(28,202,155,0.05))] p-4">
                                <div className="h-24 rounded-[1rem] bg-[rgba(255,255,255,0.55)]" />
                                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--cm-muted)]">Secure Server</p>
                                <p className="text-sm text-[var(--cm-on-surface)]">Lifecycle document storage remains protected and auditable.</p>
                            </div>
                        </div>
                    </div>
                )}

                {(tab === 'pending' || tab === 'expiry') && (
                    <div className="cm-card">
                        <DocumentTable
                            documents={tab === 'expiry' ? (expiry?.expiringList || []) : documents}
                            selected={selected}
                            onToggle={toggleSelect}
                            onVerify={verifyDoc}
                            showSelect={tab !== 'expiry'}
                        />
                    </div>
                )}

                {tab === 'categories' && (
                    <div className="cm-card space-y-6">
                        {categories.map((cat) => (
                            <div key={cat}>
                                <h3 className="cm-title-sm mb-3">{cat}</h3>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(catalog.categories?.[cat] || []).map((entry) => (
                                        <div key={entry.key || entry.catalogKey} className="cm-card cm-card--inset">
                                            <p className="font-semibold text-[var(--cm-on-surface)]">{entry.label}</p>
                                            <p className="cm-subtitle mt-0.5">{entry.key || entry.catalogKey}</p>
                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                {entry.mandatory && <CmBadge tone="attention">Required</CmBadge>}
                                                {entry.approvalRequired && <CmBadge tone="progress">Approval</CmBadge>}
                                                {entry.expiryDays && <CmBadge tone="neutral">{entry.expiryDays}d expiry</CmBadge>}
                                                {entry.indiaCompliance && <CmBadge tone="done">India</CmBadge>}
                                            </div>
                                        </div>
                                    ))}
                                    {!(catalog.categories?.[cat] || []).length && (
                                        <p className="text-sm text-[var(--cm-muted)] col-span-full">No documents in this category.</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'reports' && reports?.byDepartment?.length > 0 && (
                    <div className="cm-card">
                        <h3 className="cm-title-sm mb-3">By Department</h3>
                        <div className="cm-table-wrap">
                            <table className="cm-table">
                                <thead>
                                    <tr>
                                        <th>Department</th>
                                        <th>Total</th>
                                        <th>Pending</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.byDepartment.map((row) => (
                                        <tr key={row._id || 'unknown'}>
                                            <td>{row._id || 'Unassigned'}</td>
                                            <td>{row.count}</td>
                                            <td>{row.pending}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function EmployeeActivityFeed({ documents }) {
    const items = useMemo(() => (
        [...documents]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
            .slice(0, 6)
    ), [documents]);

    if (!items.length) {
        return <p className="text-sm text-[var(--cm-muted)]">No recent activity.</p>;
    }

    return (
        <div className="space-y-3">
            {items.map((doc) => {
                const empName = doc.uploadedBy?.firstName
                    ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName || ''}`.trim()
                    : doc.uploadedBy?.name || 'Unknown';
                const when = doc.updatedAt || doc.createdAt;
                const status = doc.verificationStatus || doc.approvalStatus;
                return (
                    <div key={doc._id} className="flex items-start gap-2.5 text-sm">
                        <FaFileAlt className="mt-0.5 shrink-0 text-[var(--cm-muted)]" />
                        <div className="min-w-0">
                            <p className="truncate text-[var(--cm-on-surface)]">{doc.name}</p>
                            <p className="cm-subtitle mt-0">
                                {empName}
                                {status ? ` · ${status}` : ''}
                                {when ? ` · ${new Date(when).toLocaleDateString()}` : ''}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DocumentTable({ documents, selected, onToggle, onVerify, showSelect, showEmployeeColumn = true }) {
    const openDoc = (doc) => {
        const url = doc.fileUrl || doc.url || doc.documentUrl || doc.previewUrl;
        if (!url) {
            toast.error('No file available to preview');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    if (!documents.length) {
        return <CmEmpty title="No documents found">Try adjusting your search or filters.</CmEmpty>;
    }

    return (
        <div className="cm-table-wrap">
            <table className="cm-table">
                <thead>
                    <tr>
                        {showSelect && <th className="w-8" />}
                        <th>Document</th>
                        {showEmployeeColumn && <th>Employee</th>}
                        <th>Status</th>
                        <th>Expiry</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {documents.map((doc) => {
                        const employeeName = doc.uploadedBy?.firstName
                            ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName || ''}`.trim()
                            : doc.uploadedBy?.name || '—';
                        const status = doc.verificationStatus || doc.approvalStatus;
                        return (
                            <tr key={doc._id}>
                                {showSelect && (
                                    <td>
                                        <input type="checkbox" checked={selected.has(doc._id)} onChange={() => onToggle(doc._id)} />
                                    </td>
                                )}
                                <td>
                                    <p className="font-semibold text-[var(--cm-on-surface)]">{doc.name}</p>
                                    <p className="cm-subtitle mt-0">{doc.hubCategory || doc.category || doc.catalogKey || '—'}</p>
                                </td>
                                {showEmployeeColumn && (
                                    <td>
                                        <CmPerson name={employeeName} />
                                    </td>
                                )}
                                <td>
                                    <CmBadge tone={statusTone(status)}>{status}</CmBadge>
                                </td>
                                <td className="text-sm">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '—'}</td>
                                <td>
                                    <div className="flex flex-wrap gap-3">
                                        <button type="button" onClick={() => openDoc(doc)} className="cm-link flex items-center gap-1 text-xs">
                                            <FaDownload /> View
                                        </button>
                                        {(doc.verificationStatus === 'Pending' || doc.approvalStatus === 'Pending') && (
                                            <>
                                                <button type="button" onClick={() => onVerify(doc._id, 'Approved')} className="cm-link flex items-center gap-1 text-xs">
                                                    <FaCheck /> Approve
                                                </button>
                                                <button type="button" onClick={() => onVerify(doc._id, 'Rejected')} className="cm-link cm-link--attention flex items-center gap-1 text-xs">
                                                    <FaTimes /> Reject
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default DocumentHub;
