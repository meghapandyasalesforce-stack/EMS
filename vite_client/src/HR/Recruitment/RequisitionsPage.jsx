import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft, FaPlus } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    SelectWithOther,
    loadJobFormOptions,
    resolveSelectValue,
    OTHER_OPTION,
} from '../../components/recruitment/SelectWithOther';
import { AtsPage, AtsPageHeader, AtsBadge, CmButton } from '../../components/recruitment/atsUi';

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

const RequisitionsPage = () => {
    const navigate = useNavigate();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [selects, setSelects] = useState(EMPTY_SELECTS);
    const [customs, setCustoms] = useState(EMPTY_CUSTOMS);
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
        <AtsPage className="ats-requisitions-page">
            <button type="button" onClick={() => navigate('/recruitment')} className="ats-back">
                <FaArrowLeft className="h-3 w-3" /> Back
            </button>

            <AtsPageHeader
                eyebrow="Recruitment"
                title="Job Requisitions"
                subtitle="Hiring need → approval → job posting"
                actions={(
                    <CmButton onClick={() => setShowForm(true)}>
                        <FaPlus className="h-3.5 w-3.5" /> New Requisition
                    </CmButton>
                )}
            />

            {showForm && (
                <form onSubmit={create} className="cm-card ats-hire-form space-y-4">
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
                    </div>
                    <label className="block text-sm">
                        <span className="ats-form-label">Job description *</span>
                        <textarea required rows={4} className="cm-input mt-1 w-full" value={form.jobDescription} onChange={(e) => setForm((p) => ({ ...p, jobDescription: e.target.value }))} />
                    </label>
                    <label className="block text-sm">
                        <span className="ats-form-label">Business justification</span>
                        <textarea rows={2} className="cm-input mt-1 w-full" value={form.justification} onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))} />
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <CmButton type="button" variant="outline" onClick={resetForm}>Cancel</CmButton>
                        <CmButton type="submit" disabled={busy}>Save Draft</CmButton>
                    </div>
                </form>
            )}

            <div className="ats-table-wrap ats-requisitions-table">
                <div className="ats-table-scroll">
                    <table className="ats-table ats-table--actions ats-requisitions-table__grid">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((r) => (
                                <tr key={r._id}>
                                    <td className="font-semibold">{r.title}</td>
                                    <td>{r.department}</td>
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
                                                    <button type="button" disabled={busy} onClick={() => {
                                                        const reason = window.prompt('Rejection reason');
                                                        if (reason) action(r._id, 'reject', { reason });
                                                    }} className="ats-table-actions__btn ats-table-actions__btn--danger">Reject</button>
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
                            {items.length === 0 && (
                                <tr><td colSpan={4} className="py-8 text-center" style={{ color: 'rgba(15,45,38,0.5)' }}>No requisitions yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AtsPage>
    );
};

export default RequisitionsPage;
