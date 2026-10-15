import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaAward, FaHeart, FaPlus, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import { MINT_GRADIENT } from '../Reports/constants';
import {
    RECOGNITION_CATEGORIES,
    recognitionStatusStyle,
    formatRecognitionRecipientLabel,
} from './engagementUtils';

const MINT = '#20C997';
const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#20C997] focus:ring-2 focus:ring-[#20C997]/20';

const personName = (p) => `${p?.name || ''} ${p?.lastName || ''}`.trim() || 'Someone';

const reactionCounts = (reactions = []) =>
    reactions.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
        return acc;
    }, {});

const RecognitionPanel = ({ isManagerUser, onRefresh }) => {
    const [section, setSection] = useState('wall');
    const [wall, setWall] = useState([]);
    const [manageList, setManageList] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [teamSearch, setTeamSearch] = useState('');
    const [settings, setSettings] = useState({ recognitionRequireApproval: false });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [detailItem, setDetailItem] = useState(null);
    const [giveOpen, setGiveOpen] = useState(false);
    const [form, setForm] = useState({
        recipientType: 'Individual',
        recipientId: '',
        recipientIds: [],
        targetDepartment: '',
        teamLabel: '',
        type: 'Teamwork',
        title: '',
        description: '',
        isPublic: true,
    });

    const loadWall = useCallback(async () => {
        const { data } = await axios.get('/v1/both/engagement/recognition?limit=100', {
            withCredentials: true,
        });
        setWall(data?.data || []);
    }, []);

    const loadManage = useCallback(async () => {
        const params = { view: 'manage', limit: 200 };
        if (statusFilter) params.status = statusFilter;
        if (categoryFilter) params.category = categoryFilter;
        const { data } = await axios.get('/v1/both/engagement/recognition', {
            params,
            withCredentials: true,
        });
        setManageList(data?.data || []);
    }, [statusFilter, categoryFilter]);

    const loadAnalytics = useCallback(async () => {
        const { data } = await axios.get('/v1/both/engagement/recognition/analytics', {
            withCredentials: true,
        });
        setAnalytics(data?.data || null);
    }, []);

    const loadSettings = useCallback(async () => {
        try {
            const { data } = await axios.get('/v1/admin/engagement/settings', {
                withCredentials: true,
            });
            setSettings(data?.data || { recognitionRequireApproval: false });
        } catch {
            setSettings({ recognitionRequireApproval: false });
        }
    }, []);

    const loadEmployees = useCallback(async () => {
        try {
            const res = await axios.get('/v1/employee/auth/get-all-employees', {
                params: { limit: 500 },
                withCredentials: true,
            });
            const list = res.data?.data || res.data?.employees || [];
            setEmployees(Array.isArray(list) ? list : []);
        } catch {
            setEmployees([]);
        }
    }, []);

    const loadDepartments = useCallback(async () => {
        try {
            const { data } = await axios.get('/v1/admin/organization/profile', {
                withCredentials: true,
            });
            const depts = data?.data?.departments || data?.departments || [];
            setDepartments(Array.isArray(depts) ? depts.filter(Boolean) : []);
        } catch {
            setDepartments([]);
        }
    }, []);

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            try {
                await loadWall();
                if (isManagerUser) {
                    await Promise.all([loadManage(), loadAnalytics(), loadSettings(), loadEmployees(), loadDepartments()]);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load recognition data');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [isManagerUser, loadWall, loadManage, loadAnalytics, loadSettings, loadEmployees, loadDepartments]);

    useEffect(() => {
        if (isManagerUser && section === 'manage') loadManage();
    }, [isManagerUser, section, loadManage]);

    const pendingCount = useMemo(
        () => manageList.filter((r) => r.status === 'Pending').length,
        [manageList]
    );

    const handleApprove = async (item, status) => {
        try {
            setSaving(true);
            await axios.put(
                `/v1/admin/engagement/recognition/${item._id}`,
                { status },
                { withCredentials: true }
            );
            toast.success(status === 'Approved' ? 'Recognition approved' : 'Recognition rejected');
            setDetailItem(null);
            await Promise.all([loadWall(), loadManage(), loadAnalytics()]);
            onRefresh?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update recognition');
        } finally {
            setSaving(false);
        }
    };

    const handleGiveRecognition = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (form.recipientType === 'Individual' && !form.recipientId) {
            toast.error('Select an employee');
            return;
        }
        if (form.recipientType === 'Team' && form.recipientIds.length < 2) {
            toast.error('Select at least two team members');
            return;
        }
        if (form.recipientType === 'Department' && !form.targetDepartment) {
            toast.error('Select a department');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                recipientType: form.recipientType,
                type: form.type,
                title: form.title,
                description: form.description,
                isPublic: form.isPublic,
            };
            if (form.recipientType === 'Individual') payload.recipientId = form.recipientId;
            if (form.recipientType === 'Team') {
                payload.recipientIds = form.recipientIds;
                if (form.teamLabel) payload.teamLabel = form.teamLabel;
            }
            if (form.recipientType === 'Department') payload.targetDepartment = form.targetDepartment;

            await axios.post('/v1/both/engagement/recognition', payload, { withCredentials: true });
            toast.success('Recognition published');
            setGiveOpen(false);
            setForm({
                recipientType: 'Individual',
                recipientId: '',
                recipientIds: [],
                targetDepartment: '',
                teamLabel: '',
                type: 'Teamwork',
                title: '',
                description: '',
                isPublic: true,
            });
            setTeamSearch('');
            await Promise.all([loadWall(), loadManage(), loadAnalytics()]);
            onRefresh?.();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to give recognition');
        } finally {
            setSaving(false);
        }
    };

    const toggleTeamMember = (empId) => {
        setForm((p) => {
            const ids = p.recipientIds.includes(empId)
                ? p.recipientIds.filter((id) => id !== empId)
                : [...p.recipientIds, empId];
            return { ...p, recipientIds: ids };
        });
    };

    const filteredTeamEmployees = useMemo(() => {
        const q = teamSearch.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter((emp) =>
            [emp.name, emp.lastName, emp.department, emp.email]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(q)
        );
    }, [employees, teamSearch]);

    const toggleApprovalSetting = async () => {
        const next = !settings.recognitionRequireApproval;
        try {
            setSaving(true);
            const { data } = await axios.put(
                '/v1/admin/engagement/settings',
                { recognitionRequireApproval: next },
                { withCredentials: true }
            );
            setSettings(data?.data || { recognitionRequireApproval: next });
            toast.success(
                next
                    ? 'Employee recognition now requires HR approval'
                    : 'Employee recognition publishes immediately'
            );
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    const react = async (id, emoji) => {
        try {
            await axios.post(
                `/v1/both/engagement/recognition/${id}/react`,
                { emoji },
                { withCredentials: true }
            );
            await loadWall();
        } catch {
            toast.error('Could not add reaction');
        }
    };

    const renderCard = (r, { showActions = false } = {}) => {
        const counts = reactionCounts(r.reactions);
        return (
            <article
                key={r._id}
                className="rounded-2xl border border-slate-100 bg-slate-50/40 p-5"
            >
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{personName(r.givenBy)}</span>{' '}
                        recognized{' '}
                        <span className="font-semibold text-slate-900">
                            {formatRecognitionRecipientLabel(r, personName)}
                        </span>
                        {r.recipientType === 'Team' && r.recipientIds?.length > 1 && (
                            <span className="text-slate-500"> ({r.recipientIds.length} members)</span>
                        )}
                    </p>
                    <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recognitionStatusStyle(r.status)}`}
                    >
                        {r.status}
                    </span>
                </div>
                <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
                {r.description && (
                    <p className="mt-1 text-sm text-slate-600">&ldquo;{r.description}&rdquo;</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-[#0d9488] ring-1 ring-[#20C997]/20">
                        {r.type}
                    </span>
                    {r.badge && (
                        <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-100">
                            {r.badge}
                        </span>
                    )}
                    {r.points > 0 && (
                        <span className="text-slate-500">{r.points} pts</span>
                    )}
                    <span className="text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                    </span>
                </div>
                {section === 'wall' && r.status === 'Approved' && r.isPublic && (
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => react(r._id, '❤️')}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-rose-50"
                        >
                            <FaHeart className="text-rose-500" /> {counts['❤️'] || 0}
                        </button>
                        <button
                            type="button"
                            onClick={() => react(r._id, '👏')}
                            className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-amber-50"
                        >
                            👏 {counts['👏'] || 0}
                        </button>
                    </div>
                )}
                {showActions && r.status === 'Pending' && isManagerUser && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleApprove(r, 'Approved')}
                            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                            Approve
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleApprove(r, 'Rejected')}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            onClick={() => setDetailItem(r)}
                            className="text-xs font-semibold text-[#0d9488] hover:underline"
                        >
                            View
                        </button>
                    </div>
                )}
            </article>
        );
    };

    if (loading) {
        return <p className="py-12 text-center text-sm text-slate-500">Loading recognition...</p>;
    }

    return (
        <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'wall', label: 'Recognition Wall' },
                        ...(isManagerUser
                            ? [
                                  { id: 'manage', label: `Manage${pendingCount ? ` (${pendingCount})` : ''}` },
                                  { id: 'analytics', label: 'Analytics' },
                              ]
                            : []),
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSection(tab.id)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                                section === tab.id
                                    ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {isManagerUser && (
                    <button
                        type="button"
                        onClick={() => setGiveOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                        style={{ background: MINT_GRADIENT }}
                    >
                        <FaPlus className="h-3.5 w-3.5" /> Give Recognition
                    </button>
                )}
            </div>

            {isManagerUser && section === 'manage' && (
                <div className="mb-4 space-y-3">
                    <label className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            checked={settings.recognitionRequireApproval}
                            disabled={saving}
                            onChange={toggleApprovalSetting}
                        />
                        Require HR approval for employee-submitted recognition
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <select
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">All statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                        <select
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="">All categories</option>
                            {RECOGNITION_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {section === 'wall' && (
                <div className="space-y-3">
                    {wall.length === 0 ? (
                        <div className="py-8 text-center sm:py-10">
                            <div
                                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                style={{ background: `${MINT}20` }}
                            >
                                <FaAward className="h-8 w-8" style={{ color: MINT }} />
                            </div>
                            <p className="text-sm text-slate-500">No public recognition yet.</p>
                        </div>
                    ) : (
                        wall.map((r) => renderCard(r))
                    )}
                </div>
            )}

            {section === 'manage' && isManagerUser && (
                <div className="space-y-3">
                    {manageList.length === 0 ? (
                        <p className="py-10 text-center text-sm text-slate-500">No recognition records.</p>
                    ) : (
                        manageList.map((r) => renderCard(r, { showActions: true }))
                    )}
                </div>
            )}

            {section === 'analytics' && isManagerUser && (
                <div className="space-y-4">
                    {!analytics ? (
                        <p className="py-10 text-center text-sm text-slate-500">Analytics unavailable.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                {[
                                    { label: 'Total', value: analytics.total },
                                    { label: 'Approved', value: analytics.approved },
                                    { label: 'Pending', value: analytics.pending },
                                    { label: 'Rejected', value: analytics.rejected },
                                ].map((k) => (
                                    <div
                                        key={k.label}
                                        className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                                    >
                                        <p className="text-xs font-semibold uppercase text-slate-500">
                                            {k.label}
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-slate-900">{k.value ?? 0}</p>
                                    </div>
                                ))}
                            </div>
                            {analytics.byCategory?.length > 0 && (
                                <div className="rounded-2xl border border-slate-100 p-4">
                                    <h4 className="text-sm font-semibold text-slate-800">By category</h4>
                                    <ul className="mt-3 space-y-2">
                                        {analytics.byCategory.map((row) => (
                                            <li
                                                key={row.category}
                                                className="flex justify-between text-sm text-slate-700"
                                            >
                                                <span>{row.category}</span>
                                                <strong>{row.count}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {analytics.byDepartment?.length > 0 && (
                                <div className="rounded-2xl border border-slate-100 p-4">
                                    <h4 className="text-sm font-semibold text-slate-800">By department</h4>
                                    <p className="mt-1 text-xs text-slate-500">Aggregate recognition volume — not a ranking</p>
                                    <ul className="mt-3 space-y-2">
                                        {analytics.byDepartment.map((row) => (
                                            <li
                                                key={row.department}
                                                className="flex justify-between text-sm text-slate-700"
                                            >
                                                <span>{row.department}</span>
                                                <strong>{row.count}</strong>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {analytics.trend?.length > 0 && (
                                <div className="rounded-2xl border border-slate-100 p-4">
                                    <h4 className="text-sm font-semibold text-slate-800">Trend</h4>
                                    <ul className="mt-3 space-y-1 text-sm text-slate-600">
                                        {analytics.trend.map((row) => (
                                            <li key={row.period} className="flex justify-between">
                                                <span>{row.period}</span>
                                                <span>{row.count} approved</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {giveOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-900">Give Recognition</h3>
                            <button
                                type="button"
                                onClick={() => setGiveOpen(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        <form onSubmit={handleGiveRecognition} className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {['Individual', 'Team', 'Department'].map((rt) => (
                                    <button
                                        key={rt}
                                        type="button"
                                        onClick={() =>
                                            setForm((p) => ({
                                                ...p,
                                                recipientType: rt,
                                                recipientId: '',
                                                recipientIds: [],
                                                targetDepartment: '',
                                                teamLabel: '',
                                            }))
                                        }
                                        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                                            form.recipientType === rt
                                                ? 'bg-[#20C997]/10 text-[#0d9488] ring-1 ring-[#20C997]/30'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                    >
                                        {rt}
                                    </button>
                                ))}
                            </div>

                            {form.recipientType === 'Individual' && (
                                <select
                                    className={inputClass}
                                    value={form.recipientId}
                                    onChange={(e) => setForm((p) => ({ ...p, recipientId: e.target.value }))}
                                    required
                                >
                                    <option value="">Select employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id} value={emp._id}>
                                            {personName(emp)}
                                            {emp.department ? ` · ${emp.department}` : ''}
                                        </option>
                                    ))}
                                </select>
                            )}

                            {form.recipientType === 'Team' && (
                                <div className="space-y-2">
                                    <input
                                        className={inputClass}
                                        placeholder="Team name (optional)"
                                        value={form.teamLabel}
                                        onChange={(e) => setForm((p) => ({ ...p, teamLabel: e.target.value }))}
                                    />
                                    <input
                                        className={inputClass}
                                        placeholder="Search team members..."
                                        value={teamSearch}
                                        onChange={(e) => setTeamSearch(e.target.value)}
                                    />
                                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2 space-y-1">
                                        {filteredTeamEmployees.map((emp) => (
                                            <label
                                                key={emp._id}
                                                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.recipientIds.includes(emp._id)}
                                                    onChange={() => toggleTeamMember(emp._id)}
                                                />
                                                <span>
                                                    {personName(emp)}
                                                    {emp.department ? ` · ${emp.department}` : ''}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                        {form.recipientIds.length} member(s) selected (min 2)
                                    </p>
                                </div>
                            )}

                            {form.recipientType === 'Department' && (
                                <select
                                    className={inputClass}
                                    value={form.targetDepartment}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, targetDepartment: e.target.value }))
                                    }
                                    required
                                >
                                    <option value="">Select department</option>
                                    {departments.map((dept) => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            )}

                            <select
                                className={inputClass}
                                value={form.type}
                                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                            >
                                {RECOGNITION_CATEGORIES.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                            <input
                                className={inputClass}
                                placeholder="Title"
                                value={form.title}
                                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                required
                            />
                            <textarea
                                className={inputClass}
                                rows={4}
                                placeholder="Message"
                                value={form.description}
                                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={form.isPublic}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, isPublic: e.target.checked }))
                                    }
                                />
                                Show on recognition wall
                            </label>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setGiveOpen(false)}
                                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="rounded-full px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ background: MINT_GRADIENT }}
                                >
                                    {saving ? 'Publishing...' : 'Publish Recognition'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {detailItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <h3 className="text-lg font-semibold text-slate-900">{detailItem.title}</h3>
                            <button
                                type="button"
                                onClick={() => setDetailItem(null)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <FaTimes />
                            </button>
                        </div>
                        {renderCard(detailItem)}
                        {detailItem.status === 'Pending' && (
                            <div className="mt-4 flex gap-2">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleApprove(detailItem, 'Approved')}
                                    className="flex-1 rounded-full bg-emerald-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                >
                                    Approve
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => handleApprove(detailItem, 'Rejected')}
                                    className="flex-1 rounded-full border border-slate-200 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
                                >
                                    Reject
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default RecognitionPanel;
