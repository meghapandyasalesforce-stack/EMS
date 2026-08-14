import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { CmButton } from './atsUi';

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
        <div className="cm-hrms ats-ui fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,45,38,0.45)' }}>
            <div className="cm-card max-h-[90vh] w-full max-w-2xl overflow-y-auto !p-6" style={{ boxShadow: 'var(--ats-shadow-md)' }}>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="m-0 text-lg font-semibold text-gray-800">Hire → Create Employee</h2>
                    <button type="button" onClick={onClose} className="ats-link text-lg leading-none" aria-label="Close">✕</button>
                </div>

                {loading ? (
                    <p className="text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>Loading…</p>
                ) : result ? (
                    <div className="space-y-3 text-sm">
                        <p className="rounded-lg px-3 py-3" style={{ background: 'rgba(28,202,155,0.12)', color: '#006c51' }}>
                            Employee <strong>{result.employee?.employeeId}</strong> created
                            {result.onboarding ? ' and onboarding started.' : '.'}
                        </p>
                        {result.temporaryPassword && (
                            <div className="rounded-lg px-3 py-3" style={{ background: 'rgba(255,127,80,0.12)', color: '#7f2700' }}>
                                <p className="font-medium">Temporary password (copy now)</p>
                                <code className="mt-1 block break-all">{result.temporaryPassword}</code>
                                <p className="mt-1 text-xs opacity-80">A welcome email with credentials was also queued.</p>
                            </div>
                        )}
                        {result.onboardingError && (
                            <p style={{ color: '#c45a2a' }}>Onboarding note: {result.onboardingError}</p>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <CmButton onClick={onClose}>Done</CmButton>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-3 text-sm">
                        <p style={{ color: 'rgba(15,45,38,0.65)' }}>
                            Creates employee ID, login, assigns role/department/manager, queues welcome email, and starts onboarding.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block">
                                <span className="ats-form-label">First name *</span>
                                <input required className="cm-input w-full" value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Last name *</span>
                                <input required className="cm-input w-full" value={form.lastName || ''} onChange={(e) => set('lastName', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Email *</span>
                                <input type="email" required className="cm-input w-full" value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Phone</span>
                                <input className="cm-input w-full" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Department *</span>
                                <select required className="cm-select w-full" value={form.department || ''} onChange={(e) => set('department', e.target.value)}>
                                    {(enums.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Job title *</span>
                                <select required className="cm-select w-full" value={form.jobTitle || ''} onChange={(e) => set('jobTitle', e.target.value)}>
                                    {(enums.jobTitles || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Position *</span>
                                <select required className="cm-select w-full" value={form.position || ''} onChange={(e) => set('position', e.target.value)}>
                                    {(enums.positions || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Job category *</span>
                                <select required className="cm-select w-full" value={form.jobCategory || ''} onChange={(e) => set('jobCategory', e.target.value)}>
                                    {(enums.jobCategories || []).map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Salary *</span>
                                <input type="number" required min="1" className="cm-input w-full" value={form.salary || ''} onChange={(e) => set('salary', e.target.value)} />
                            </label>
                            <label className="block">
                                <span className="ats-form-label">Joining date</span>
                                <input type="date" className="cm-input w-full" value={form.joiningDate || ''} onChange={(e) => set('joiningDate', e.target.value)} />
                            </label>
                            <label className="block sm:col-span-2">
                                <span className="ats-form-label">Reporting manager *</span>
                                <select required={managers.length > 0} className="cm-select w-full" value={form.managerId || ''} onChange={(e) => set('managerId', e.target.value)}>
                                    <option value="">Select manager</option>
                                    {managers.map((m) => (
                                        <option key={m._id} value={m._id}>
                                            {m.name} {m.lastName} ({m.employeeId || m.email})
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[rgba(15,45,38,0.08)] pt-4">
                            <CmButton type="button" variant="outline" onClick={onClose}>Cancel</CmButton>
                            <CmButton type="submit" disabled={submitting}>
                                {submitting ? 'Creating…' : 'Create Employee & Start Onboarding'}
                            </CmButton>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default HireEmployeeModal;
