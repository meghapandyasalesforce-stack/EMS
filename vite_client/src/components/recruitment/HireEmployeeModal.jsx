import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';

/**
 * Hire → Employee conversion form.
 * Calls POST /candidates/:id/hire which creates employee + login + onboarding.
 */
const HireEmployeeModal = ({ candidateId, open, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [enums, setEnums] = useState({});
    const [managers, setManagers] = useState([]);
    const [form, setForm] = useState({});
    const [result, setResult] = useState(null);

    useEffect(() => {
        if (!open || !candidateId) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setResult(null);
                const [defaultsRes, empRes] = await Promise.all([
                    axios.get(`/v1/admin/recruitment/candidates/${candidateId}/hire-defaults`, { withCredentials: true }),
                    axios.get('/v1/admin/employee/managers?limit=500', { withCredentials: true }).catch(() => ({ data: {} })),
                ]);
                if (cancelled) return;
                const d = defaultsRes.data?.data || {};
                setEnums(d.enums || {});
                setForm({
                    ...(d.defaults || {}),
                    joiningDate: d.defaults?.joiningDate
                        ? new Date(d.defaults.joiningDate).toISOString().slice(0, 10)
                        : new Date().toISOString().slice(0, 10),
                    createEmployee: true,
                });
                const list = empRes.data?.data || empRes.data?.managers || empRes.data || [];
                setManagers(Array.isArray(list) ? list : []);
            } catch (err) {
                toast.error(err.response?.data?.message || 'Failed to load hire form');
                onClose?.();
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [open, candidateId, onClose]);

    const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));

    const submit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const payload = {
                createEmployee: true,
                name: form.name,
                lastName: form.lastName,
                email: form.email,
                phone: form.phone,
                department: form.department,
                jobTitle: form.jobTitle,
                position: form.position,
                jobCategory: form.jobCategory,
                salary: Number(form.salary),
                managerId: form.managerId || undefined,
                joiningDate: form.joiningDate,
            };
            const { data } = await axios.post(
                `/v1/admin/recruitment/candidates/${candidateId}/hire`,
                payload,
                { withCredentials: true }
            );
            if (!data.success) {
                toast.error(data.message || 'Hire failed');
                return;
            }
            setResult(data.data);
            toast.success(data.message || 'Employee created');
            onSuccess?.(data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Hire conversion failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900">Hire → Create Employee</h2>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800">✕</button>
                </div>

                {loading ? (
                    <p className="text-sm text-gray-500">Loading…</p>
                ) : result ? (
                    <div className="space-y-3 text-sm">
                        <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                            Employee <strong>{result.employee?.employeeId}</strong> created
                            {result.onboarding ? ' and onboarding started.' : '.'}
                        </p>
                        {result.temporaryPassword && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="font-medium text-amber-900">Temporary password (copy now)</p>
                                <code className="mt-1 block break-all text-amber-900">{result.temporaryPassword}</code>
                                <p className="mt-1 text-xs text-amber-700">A welcome email with credentials was also queued.</p>
                            </div>
                        )}
                        {result.onboardingError && (
                            <p className="text-amber-700">Onboarding note: {result.onboardingError}</p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={onClose} className="rounded-lg bg-theme-secondary px-4 py-2 text-white">Done</button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3 text-sm">
                        <p className="text-gray-600">
                            Creates employee ID, login, assigns role/department/manager, queues welcome email, and starts onboarding.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="mb-1 block font-medium">First name *</span>
                                <input required className="w-full rounded-lg border px-3 py-2" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Last name *</span>
                                <input required className="w-full rounded-lg border px-3 py-2" value={form.lastName || ''} onChange={(e) => set('lastName', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Email *</span>
                                <input type="email" required className="w-full rounded-lg border px-3 py-2" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Phone</span>
                                <input className="w-full rounded-lg border px-3 py-2" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Department *</span>
                                <select required className="w-full rounded-lg border px-3 py-2" value={form.department || ''} onChange={(e) => set('department', e.target.value)}>
                                    {(enums.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Job title *</span>
                                <select required className="w-full rounded-lg border px-3 py-2" value={form.jobTitle || ''} onChange={(e) => set('jobTitle', e.target.value)}>
                                    {(enums.jobTitles || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Position *</span>
                                <select required className="w-full rounded-lg border px-3 py-2" value={form.position || ''} onChange={(e) => set('position', e.target.value)}>
                                    {(enums.positions || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Job category *</span>
                                <select required className="w-full rounded-lg border px-3 py-2" value={form.jobCategory || ''} onChange={(e) => set('jobCategory', e.target.value)}>
                                    {(enums.jobCategories || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Salary *</span>
                                <input type="number" required min="1" className="w-full rounded-lg border px-3 py-2" value={form.salary || ''} onChange={(e) => set('salary', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="mb-1 block font-medium">Joining date</span>
                                <input type="date" className="w-full rounded-lg border px-3 py-2" value={form.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="mb-1 block font-medium">Reporting manager *</span>
                                <select required={managers.length > 0} className="w-full rounded-lg border px-3 py-2" value={form.managerId || ''} onChange={(e) => set('managerId', e.target.value)}>
                                    <option value="">Select manager</option>
                                    {managers.map((m) => (
                                        <option key={m._id} value={m._id}>
                                            {m.name} {m.lastName} ({m.employeeId || m.email})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t pt-4">
                            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
                            <button type="submit" disabled={submitting} className="rounded-lg bg-theme-secondary px-4 py-2 text-white disabled:opacity-60">
                                {submitting ? 'Creating…' : 'Create Employee & Start Onboarding'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default HireEmployeeModal;
