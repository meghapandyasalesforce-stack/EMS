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
        <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
            <button type="button" onClick={() => navigate('/recruitment')} className="mb-4 inline-flex items-center gap-2 text-sm text-gray-600">
                <FaArrowLeft /> Back
            </button>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Job Requisitions</h1>
                    <p className="text-gray-600">Hiring need → approval → job posting</p>
                </div>
                <button type="button" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-lg bg-theme-secondary px-4 py-2 text-white">
                    <FaPlus /> New Requisition
                </button>
            </div>

            {showForm && (
                <form onSubmit={create} className="mb-6 space-y-3 rounded-xl border bg-white p-5 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
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
                        <span className="mb-1 block font-medium">Job description *</span>
                        <textarea required rows={4} className="w-full rounded-lg border px-3 py-2" value={form.jobDescription} onChange={(e) => setForm((p) => ({ ...p, jobDescription: e.target.value }))} />
                    </label>
                    <label className="block text-sm">
                        <span className="mb-1 block font-medium">Business justification</span>
                        <textarea rows={2} className="w-full rounded-lg border px-3 py-2" value={form.justification} onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))} />
                    </label>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2">Cancel</button>
                        <button type="submit" disabled={busy} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">Save Draft</button>
                    </div>
                </form>
            )}

            <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left">Title</th>
                            <th className="px-4 py-3 text-left">Department</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            <th className="px-4 py-3 text-left">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {items.map((r) => (
                            <tr key={r._id}>
                                <td className="px-4 py-3 font-medium">{r.title}</td>
                                <td className="px-4 py-3">{r.department}</td>
                                <td className="px-4 py-3">{r.status}</td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                        {['Draft', 'Rejected'].includes(r.status) && (
                                            <button type="button" disabled={busy} onClick={() => action(r._id, 'submit')} className="text-theme-secondary hover:underline">Submit</button>
                                        )}
                                        {r.status === 'PendingApproval' && (
                                            <>
                                                <button type="button" disabled={busy} onClick={() => action(r._id, 'approve')} className="text-emerald-700 hover:underline">Approve</button>
                                                <button type="button" disabled={busy} onClick={() => {
                                                    const reason = window.prompt('Rejection reason');
                                                    if (reason) action(r._id, 'reject', { reason });
                                                }} className="text-red-600 hover:underline">Reject</button>
                                            </>
                                        )}
                                        {r.status === 'Approved' && (
                                            <button type="button" disabled={busy} onClick={() => action(r._id, 'convert', { status: 'Open' })} className="text-theme-secondary hover:underline">Convert to Job</button>
                                        )}
                                        {r.jobPostingId && (
                                            <button type="button" onClick={() => navigate(`/recruitment/jobs/${r.jobPostingId._id || r.jobPostingId}`)} className="text-gray-600 hover:underline">Open Job</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {items.length === 0 && (
                            <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No requisitions yet</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RequisitionsPage;
