import React, { useCallback, useEffect, useState } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';

const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20';

const statusStyle = (s) => {
    if (s === 'Completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'In Progress') return 'bg-[#20C997]/10 text-[#0d9488]';
    if (s === 'Cancelled') return 'bg-slate-100 text-slate-500';
    return 'bg-amber-100 text-amber-700';
};

const personName = (p) => `${p?.name || ''} ${p?.lastName || ''}`.trim() || 'Unassigned';

const ActionPlansPanel = ({ canCreate = false }) => {
    const [plans, setPlans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({
        title: '',
        description: '',
        sourceType: 'Manual',
        owner: '',
        priority: 'Medium',
        dueDate: '',
        department: '',
    });

    const loadPlans = useCallback(async () => {
        const params = { limit: 100 };
        if (statusFilter) params.status = statusFilter;
        const { data } = await axios.get('/v1/both/engagement/action-plans', { params, withCredentials: true });
        setPlans(data?.data || []);
    }, [statusFilter]);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                await loadPlans();
                if (canCreate) {
                    const res = await axios.get('/v1/employee/auth/get-all-employees', {
                        params: { limit: 500 },
                        withCredentials: true,
                    });
                    const list = res.data?.data || res.data?.employees || [];
                    setEmployees(Array.isArray(list) ? list : []);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load action plans');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [canCreate, loadPlans]);

    const createPlan = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.owner) {
            toast.error('Title and owner are required');
            return;
        }
        try {
            setSaving(true);
            await axios.post('/v1/admin/engagement/action-plans', form, { withCredentials: true });
            toast.success('Action plan created');
            setCreateOpen(false);
            setForm({ title: '', description: '', sourceType: 'Manual', owner: '', priority: 'Medium', dueDate: '', department: '' });
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create action plan');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (plan, status) => {
        try {
            setSaving(true);
            await axios.put(`/v1/both/engagement/action-plans/${plan._id}`, { status }, { withCredentials: true });
            toast.success('Action plan updated');
            await loadPlans();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update action plan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p className="py-12 text-center text-sm text-slate-500">Loading action plans...</p>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">All statuses</option>
                    {['Open', 'In Progress', 'Completed', 'Cancelled'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
                {canCreate && (
                    <button
                        type="button"
                        onClick={() => setCreateOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: MINT_GRADIENT }}
                    >
                        <FaPlus className="h-3.5 w-3.5" /> New action plan
                    </button>
                )}
            </div>

            {plans.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-500">No action plans yet.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                                <th className="py-3 pr-4">Title</th>
                                <th className="py-3 pr-4">Owner</th>
                                <th className="py-3 pr-4">Priority</th>
                                <th className="py-3 pr-4">Due</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plans.map((p) => (
                                <tr key={p._id} className="border-b border-slate-50">
                                    <td className="py-3 pr-4">
                                        <p className="font-semibold text-slate-900">{p.title}</p>
                                        <p className="text-xs text-slate-500">
                                            {p.insightDetail || p.sourceType}
                                            {p.department ? ` · ${p.department}` : ''}
                                            {p.isOverdue ? ' · Overdue' : ''}
                                        </p>
                                    </td>
                                    <td className="py-3 pr-4 text-slate-700">{personName(p.owner)}</td>
                                    <td className="py-3 pr-4">{p.priority}</td>
                                    <td className="py-3 pr-4 text-slate-600">
                                        <span className={p.isOverdue ? 'font-semibold text-amber-700' : undefined}>
                                            {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4">
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyle(p.status)}`}>
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        {p.status !== 'Completed' && p.status !== 'Cancelled' && (
                                            <div className="flex flex-wrap gap-1">
                                                {p.status === 'Open' && (
                                                    <button type="button" disabled={saving} onClick={() => updateStatus(p, 'In Progress')} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold">Start</button>
                                                )}
                                                <button type="button" disabled={saving} onClick={() => updateStatus(p, 'Completed')} className="rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Complete</button>
                                                <button type="button" disabled={saving} onClick={() => updateStatus(p, 'Cancelled')} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold">Cancel</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">New action plan</h3>
                            <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FaTimes /></button>
                        </div>
                        <form onSubmit={createPlan} className="space-y-3">
                            <input className={inputClass} placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
                            <textarea className={inputClass} rows={3} placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                            <select className={inputClass} value={form.sourceType} onChange={(e) => setForm((p) => ({ ...p, sourceType: e.target.value }))}>
                                {['Manual', 'Survey', 'Pulse', 'Feedback', 'Suggestion'].map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select className={inputClass} value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} required>
                                <option value="">Assign owner</option>
                                {employees.map((emp) => (
                                    <option key={emp._id} value={emp._id}>{personName(emp)}{emp.department ? ` · ${emp.department}` : ''}</option>
                                ))}
                            </select>
                            <div className="grid grid-cols-2 gap-3">
                                <select className={inputClass} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                                    {['Low', 'Medium', 'High'].map((p) => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
                            </div>
                            <input className={inputClass} placeholder="Department (optional)" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel</button>
                                <button type="submit" disabled={saving} className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: MINT_GRADIENT }}>
                                    {saving ? 'Saving...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActionPlansPanel;
