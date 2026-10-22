import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaClipboardList, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    SelectWithOther,
    loadJobFormOptions,
    resolveSelectValue,
    OTHER_OPTION,
} from '../../components/recruitment/SelectWithOther';
import { AtsPage, AtsPageHeader, AtsBadge, AtsEmpty, CmButton } from '../../components/recruitment/atsUi';

const formatRequisitionStatus = (status = '') => {
    const labels = {
        Draft: 'Draft',
        PendingApproval: 'Pending Approval',
        Approved: 'Approved',
        Rejected: 'Rejected',
    };
    return labels[status] || String(status || '—').replace(/([a-z])([A-Z])/g, '$1 $2');
};

const EMPTY = {
    jobDescription: '',
    employmentType: 'Full-time',
    numberOfPositions: 1,
    priority: 'Medium',
    justification: '',
};

const EMPTY_SELECTS = { title: '', department: '', position: '', location: '' };
const EMPTY_CUSTOMS = { title: '', department: '', position: '', location: '' };

const STATUS_FILTERS = [
    { id: '', label: 'All' },
    { id: 'Draft', label: 'Draft' },
    { id: 'PendingApproval', label: 'Pending' },
    { id: 'Approved', label: 'Approved' },
    { id: 'Rejected', label: 'Rejected' },
];

const RequisitionsPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [selects, setSelects] = useState(EMPTY_SELECTS);
    const [customs, setCustoms] = useState(EMPTY_CUSTOMS);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [options, setOptions] = useState({
        titles: [],
        departments: [],
        positions: [],
        locations: [],
    });
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('/v1/admin/recruitment/requisitions', { withCredentials: true });
            setItems(data.data || []);
        } catch {
            toast.error('Failed to load requisitions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        let cancelled = false;
        loadJobFormOptions(axios).then((opts) => {
            if (!cancelled) setOptions(opts);
        });
        return () => { cancelled = true; };
    }, []);

    const counts = useMemo(() => {
        const base = { total: items.length, Draft: 0, PendingApproval: 0, Approved: 0, Rejected: 0 };
        items.forEach((r) => {
            if (base[r.status] != null) base[r.status] += 1;
        });
        return base;
    }, [items]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((r) => {
            if (statusFilter && r.status !== statusFilter) return false;
            if (!q) return true;
            const hay = `${r.title || ''} ${r.department || ''} ${r.position || ''} ${r.location || ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [items, search, statusFilter]);

    const setSelect = (key, value) => {
        setSelects((prev) => ({ ...prev, [key]: value }));
        if (value !== OTHER_OPTION) {
            setCustoms((prev) => ({ ...prev, [key]: '' }));
        }
    };

    const resetForm = () => {
        setForm(EMPTY);
        setSelects(EMPTY_SELECTS);
        setCustoms(EMPTY_CUSTOMS);
        setShowForm(false);
    };

    const openForm = () => {
        setShowForm(true);
        window.requestAnimationFrame(() => {
            document.getElementById('req-new-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    };

    const create = async (e) => {
        e.preventDefault();
        const title = resolveSelectValue(selects.title, customs.title);
        const department = resolveSelectValue(selects.department, customs.department);
        const position = resolveSelectValue(selects.position, customs.position);
        const location = resolveSelectValue(selects.location, customs.location);
        if (!title || !department || !position || !location || !form.jobDescription.trim()) {
            toast.error('Please fill all required fields');
            return;
        }
        try {
            setBusy(true);
            await axios.post('/v1/admin/recruitment/requisitions', {
                ...form,
                title,
                department,
                position,
                location,
            }, { withCredentials: true });
            toast.success('Requisition created');
            resetForm();
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Create failed');
        } finally {
            setBusy(false);
        }
    };

    const action = async (id, path, body = {}) => {
        try {
            setBusy(true);
            const { data } = await axios.post(`/v1/admin/recruitment/requisitions/${id}/${path}`, body, { withCredentials: true });
            toast.success(data.message || 'Done');
            if (path === 'convert' && data.data?.job?._id) {
                navigate(`/recruitment/jobs/${data.data.job._id}`);
                return;
            }
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Action failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading requisitions…" />;

    return (
        <AtsPage className="rec-hub ats-requisitions-page">
            <div className="rec-hub__crumb">
                <span>Recruitment</span>
                <span className="rec-hub__crumb-sep">/</span>
                <span className="rec-hub__crumb-current">Requisitions</span>
            </div>

            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back to Recruitment
            </button>

            <AtsPageHeader
                eyebrow="Talent acquisition"
                title="Job Requisitions"
                subtitle="Hiring need → approval → job posting"
                actions={(
                    <button type="button" className="rec-hub__btn rec-hub__btn--primary" onClick={openForm}>
                        <FaPlus className="h-3.5 w-3.5" /> New Requisition
                    </button>
                )}
            />

            <div className="ats-req-kpis">
                <div className="ats-req-kpi">
                    <p className="ats-req-kpi__label">Total</p>
                    <p className="ats-req-kpi__value">{counts.total}</p>
                </div>
                <div className="ats-req-kpi">
                    <p className="ats-req-kpi__label">Draft</p>
                    <p className="ats-req-kpi__value">{counts.Draft}</p>
                </div>
                <div className="ats-req-kpi">
                    <p className="ats-req-kpi__label">Pending approval</p>
                    <p className="ats-req-kpi__value">{counts.PendingApproval}</p>
                </div>
                <div className="ats-req-kpi">
                    <p className="ats-req-kpi__label">Approved</p>
                    <p className="ats-req-kpi__value">{counts.Approved}</p>
                </div>
            </div>

            {showForm ? (
                <form id="req-new-form" onSubmit={create} className="ats-req-form cm-card">
                    <div className="ats-req-form__head">
                        <div>
                            <p className="ats-eyebrow">New hiring need</p>
                            <h2 className="ats-req-form__title">Create requisition</h2>
                            <p className="ats-req-form__sub">Capture role basics for approval before posting a job.</p>
                        </div>
                        <button type="button" className="rec-hub__btn" onClick={resetForm} aria-label="Close form">
                            <FaTimes className="h-3.5 w-3.5" /> Cancel
                        </button>
                    </div>

                    <div className="ats-req-form__section">
                        <h3 className="ats-req-form__section-title">1. Role basics</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SelectWithOther
                                label="Title"
                                required
                                options={options.titles}
                                selectValue={selects.title}
                                customValue={customs.title}
                                onSelectChange={(v) => setSelect('title', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, title: v }))}
                            />
                            <SelectWithOther
                                label="Department"
                                required
                                options={options.departments}
                                selectValue={selects.department}
                                customValue={customs.department}
                                onSelectChange={(v) => setSelect('department', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, department: v }))}
                            />
                            <SelectWithOther
                                label="Position"
                                required
                                options={options.positions}
                                selectValue={selects.position}
                                customValue={customs.position}
                                onSelectChange={(v) => setSelect('position', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, position: v }))}
                            />
                            <SelectWithOther
                                label="Location"
                                required
                                options={options.locations}
                                selectValue={selects.location}
                                customValue={customs.location}
                                onSelectChange={(v) => setSelect('location', v)}
                                onCustomChange={(v) => setCustoms((p) => ({ ...p, location: v }))}
                            />
                            <label className="block text-sm">
                                <span className="ats-form-label">Employment type</span>
                                <select
                                    className="cm-select mt-1 w-full"
                                    value={form.employmentType}
                                    onChange={(e) => setForm((p) => ({ ...p, employmentType: e.target.value }))}
                                >
                                    {['Full-time', 'Part-time', 'Contract', 'Internship'].map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-sm">
                                <span className="ats-form-label">Openings</span>
                                <input
                                    type="number"
                                    min={1}
                                    className="cm-input mt-1 w-full"
                                    value={form.numberOfPositions}
                                    onChange={(e) => setForm((p) => ({ ...p, numberOfPositions: Number(e.target.value) || 1 }))}
                                />
                            </label>
                            <label className="block text-sm sm:col-span-2">
                                <span className="ats-form-label">Priority</span>
                                <div className="ats-segment ats-segment--urgency mt-1">
                                    {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            className={`ats-segment__btn${form.priority === p ? ' ats-segment__btn--active' : ''}`}
                                            onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="ats-req-form__section">
                        <h3 className="ats-req-form__section-title">2. Description &amp; justification</h3>
                        <label className="block text-sm">
                            <span className="ats-form-label">Job description *</span>
                            <textarea
                                required
                                rows={4}
                                className="cm-input mt-1 w-full"
                                value={form.jobDescription}
                                onChange={(e) => setForm((p) => ({ ...p, jobDescription: e.target.value }))}
                                placeholder="Summarize the role, responsibilities, and impact…"
                            />
                        </label>
                        <label className="mt-4 block text-sm">
                            <span className="ats-form-label">Business justification</span>
                            <textarea
                                rows={2}
                                className="cm-input mt-1 w-full"
                                value={form.justification}
                                onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))}
                                placeholder="Why is this hire needed now?"
                            />
                        </label>
                    </div>

                    <div className="ats-req-form__footer">
                        <CmButton type="button" variant="outline" onClick={resetForm}>Discard</CmButton>
                        <CmButton type="submit" disabled={busy}>
                            {busy ? 'Saving…' : 'Save Draft'}
                        </CmButton>
                    </div>
                </form>
            ) : null}

            {items.length === 0 && !showForm ? (
                <div className="ats-req-empty-card">
                    <AtsEmpty
                        icon={FaClipboardList}
                        title="No requisitions yet"
                        hint="Start with a hiring need. Once approved, convert it into a job posting."
                    />
                    <div className="ats-req-empty-card__cta">
                        <button type="button" className="rec-hub__btn rec-hub__btn--primary" onClick={openForm}>
                            <FaPlus className="h-3.5 w-3.5" /> New Requisition
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="ats-req-toolbar">
                        <div className="ats-req-search">
                            <FaSearch className="ats-req-search__icon" aria-hidden="true" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search title, department, position…"
                                aria-label="Search requisitions"
                            />
                        </div>
                        <div className="ats-filter-pills">
                            {STATUS_FILTERS.map((f) => (
                                <button
                                    key={f.id || 'all'}
                                    type="button"
                                    onClick={() => setStatusFilter(f.id)}
                                    className={`ats-filter-pill${statusFilter === f.id ? ' ats-filter-pill--active' : ''}`}
                                >
                                    {f.label}
                                    {f.id === '' ? (
                                        <span className="ats-filter-pill__count">{counts.total}</span>
                                    ) : (
                                        <span className="ats-filter-pill__count">{counts[f.id] || 0}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="ats-table-wrap ats-requisitions-table">
                        <div className="ats-table-scroll">
                            <table className="ats-table ats-table--actions ats-requisitions-table__grid">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Department</th>
                                        <th>Openings</th>
                                        <th>Priority</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((r) => (
                                        <tr key={r._id}>
                                            <td>
                                                <p className="ats-req-row__title">{r.title}</p>
                                                <p className="ats-req-row__meta">{r.position || '—'} · {r.location || '—'}</p>
                                            </td>
                                            <td>{r.department}</td>
                                            <td>{r.numberOfPositions || 1}</td>
                                            <td>
                                                <span className={`ats-chip ats-chip--neutral ats-req-priority ats-req-priority--${String(r.priority || 'medium').toLowerCase()}`}>
                                                    {r.priority || 'Medium'}
                                                </span>
                                            </td>
                                            <td>
                                                <AtsBadge status={r.status}>{formatRequisitionStatus(r.status)}</AtsBadge>
                                            </td>
                                            <td className="ats-table-actions-cell">
                                                <div className="ats-table-actions ats-table-actions--requisitions">
                                                    {['Draft', 'Rejected'].includes(r.status) && (
                                                        <button type="button" disabled={busy} onClick={() => action(r._id, 'submit')} className="ats-table-actions__btn">Submit</button>
                                                    )}
                                                    {r.status === 'PendingApproval' && (
                                                        <>
                                                            <button type="button" disabled={busy} onClick={() => action(r._id, 'approve')} className="ats-table-actions__btn ats-table-actions__btn--success">Approve</button>
                                                            <button
                                                                type="button"
                                                                disabled={busy}
                                                                onClick={() => {
                                                                    const reason = window.prompt('Rejection reason');
                                                                    if (reason) action(r._id, 'reject', { reason });
                                                                }}
                                                                className="ats-table-actions__btn ats-table-actions__btn--danger"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {r.status === 'Approved' && (
                                                        <button type="button" disabled={busy} onClick={() => action(r._id, 'convert', { status: 'Open' })} className="ats-table-actions__btn">Convert to Job</button>
                                                    )}
                                                    {r.jobPostingId && (
                                                        <>
                                                            <button type="button" onClick={() => navigate(`/recruitment/jobs/${r.jobPostingId._id || r.jobPostingId}`)} className="ats-table-actions__btn">Open Job</button>
                                                            <button type="button" onClick={() => navigate(`/recruitment/jobs/${r.jobPostingId._id || r.jobPostingId}/edit`)} className="ats-table-actions__btn">Edit Job</button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="ats-req-table-empty">
                                                No requisitions match your filters.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </AtsPage>
    );
};

export default RequisitionsPage;
