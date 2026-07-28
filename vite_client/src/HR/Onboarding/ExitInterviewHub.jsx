import React, { useCallback, useEffect, useState } from 'react';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { FaChartBar, FaClipboardList, FaCog, FaDownload, FaPlus, FaUsers } from 'react-icons/fa';
import { ADMIN_LIFECYCLE_ENDPOINT } from '../../utils/constant';
import LoadingSpinner from '../../components/LoadingSpinner';

const TABS = [
    { id: 'settings', label: 'Configuration' },
    { id: 'templates', label: 'Templates' },
    { id: 'sessions', label: 'Interviews' },
    { id: 'analytics', label: 'Analytics' },
];

const INTERVIEW_TYPES = [
    { value: 'employee_self', label: 'Employee Self' },
    { value: 'hr', label: 'HR Interview' },
    { value: 'manager', label: 'Manager Interview' },
    { value: 'skip_level', label: 'Skip-Level' },
    { value: 'leadership', label: 'Leadership' },
];

const STATUS_BADGE = {
    Draft: 'bg-gray-100 text-gray-700',
    Scheduled: 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-amber-100 text-amber-800',
    Submitted: 'bg-emerald-100 text-emerald-800',
    'Pending Approval': 'bg-purple-100 text-purple-800',
    Approved: 'bg-emerald-100 text-emerald-800',
    Closed: 'bg-slate-200 text-slate-700',
    Cancelled: 'bg-gray-200 text-gray-600',
    Overdue: 'bg-red-100 text-red-800',
};

const ExitInterviewHub = () => {
    const base = `${ADMIN_LIFECYCLE_ENDPOINT}/exit-interviews`;
    const [tab, setTab] = useState('settings');
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({});
    const [templates, setTemplates] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [forms, setForms] = useState([]);
    const [saving, setSaving] = useState(false);
    const [tplForm, setTplForm] = useState({
        name: '', interviewType: 'employee_self', formDefinitionId: '', mandatory: true,
        anonymousAllowed: false, approvalRequired: false,
    });

    const loadSettings = useCallback(async () => {
        const { data } = await axios.get(`${base}/settings`, { withCredentials: true });
        setSettings(data.data || {});
    }, [base]);

    const loadTemplates = useCallback(async () => {
        const { data } = await axios.get(`${base}/templates`, { withCredentials: true });
        setTemplates(data.data || []);
    }, [base]);

    const loadSessions = useCallback(async () => {
        const { data } = await axios.get(`${base}/sessions`, { withCredentials: true });
        setSessions(data.data || []);
    }, [base]);

    const loadAnalytics = useCallback(async () => {
        const { data } = await axios.get(`${base}/analytics`, { withCredentials: true });
        setAnalytics(data.data);
    }, [base]);

    const loadForms = useCallback(async () => {
        const { data } = await axios.get(`${ADMIN_LIFECYCLE_ENDPOINT}/forms`, {
            params: { category: 'exit_interview', status: 'Published' },
            withCredentials: true,
        });
        setForms(data.data || []);
    }, []);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            await loadSettings();
            if (tab === 'templates') await Promise.all([loadTemplates(), loadForms()]);
            if (tab === 'sessions') await loadSessions();
            if (tab === 'analytics') await loadAnalytics();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load exit interview hub');
        } finally {
            setLoading(false);
        }
    }, [tab, loadSettings, loadTemplates, loadSessions, loadAnalytics, loadForms]);

    useEffect(() => { load(); }, [load]);

    const saveSettings = async () => {
        try {
            setSaving(true);
            await axios.patch(`${base}/settings`, settings, { withCredentials: true });
            toast.success('Settings saved');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const createTemplate = async () => {
        if (!tplForm.name?.trim()) return toast.error('Template name required');
        try {
            await axios.post(`${base}/templates`, tplForm, { withCredentials: true });
            toast.success('Template created');
            setTplForm({ name: '', interviewType: 'employee_self', formDefinitionId: '', mandatory: true, anonymousAllowed: false, approvalRequired: false });
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Create failed');
        }
    };

    const publishTemplate = async (id) => {
        try {
            await axios.post(`${base}/templates/${id}/publish`, {}, { withCredentials: true });
            toast.success('Template published');
            await loadTemplates();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Publish failed');
        }
    };

    const exportAnalytics = async () => {
        try {
            const { data } = await axios.get(`${base}/analytics/export`, { withCredentials: true, responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'exit-interview-analytics.csv');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch {
            toast.error('Export failed');
        }
    };

    if (loading && tab === 'settings' && !Object.keys(settings).length) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Exit Interview & Exit Management</h2>
                    <p className="text-sm text-gray-500">Configure templates, track interviews, and analyze attrition feedback.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {TABS.map((t) => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t.id ? 'bg-theme-primary text-white' : 'border border-gray-200 hover:bg-gray-50'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'settings' && (
                <div className="border rounded-lg p-5 bg-white space-y-4 max-w-2xl">
                    <h3 className="font-semibold flex items-center gap-2"><FaCog /> Configuration</h3>
                    {[
                        ['enabled', 'Enable Exit Interview'],
                        ['mandatory', 'Mandatory for all exits'],
                        ['anonymousAllowed', 'Allow anonymous employee responses'],
                        ['autoSchedule', 'Auto-schedule interviews'],
                        ['approvalRequired', 'Require approval before closing'],
                    ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={!!settings[key]} onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))} />
                            {label}
                        </label>
                    ))}
                    <label className="block text-sm">
                        Days before last working day to schedule
                        <input type="number" value={settings.autoScheduleDaysBeforeLwd ?? 7}
                            onChange={(e) => setSettings((s) => ({ ...s, autoScheduleDaysBeforeLwd: Number(e.target.value) }))}
                            className="mt-1 w-full rounded border px-3 py-2" />
                    </label>
                    <div>
                        <p className="text-sm font-medium mb-2">Feedback areas (configurable)</p>
                        <div className="flex flex-wrap gap-1">
                            {(settings.feedbackAreas || []).map((area, i) => (
                                <span key={area} className="text-xs px-2 py-1 bg-gray-100 rounded flex items-center gap-1">
                                    {area}
                                    <button type="button" onClick={() => setSettings((s) => ({ ...s, feedbackAreas: s.feedbackAreas.filter((_, j) => j !== i) }))} className="text-red-500">×</button>
                                </span>
                            ))}
                        </div>
                        <button type="button" onClick={() => {
                            const area = window.prompt('Feedback area name');
                            if (area) setSettings((s) => ({ ...s, feedbackAreas: [...(s.feedbackAreas || []), area] }));
                        }} className="mt-2 text-xs text-blue-600">+ Add area</button>
                    </div>
                    <button type="button" onClick={saveSettings} disabled={saving}
                        className="px-4 py-2 bg-theme-primary text-white rounded-lg text-sm">Save Settings</button>
                </div>
            )}

            {tab === 'templates' && (
                <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-white grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <input value={tplForm.name} onChange={(e) => setTplForm((f) => ({ ...f, name: e.target.value }))} placeholder="Template name" className="rounded border px-3 py-2 text-sm" />
                        <select value={tplForm.interviewType} onChange={(e) => setTplForm((f) => ({ ...f, interviewType: e.target.value }))} className="rounded border px-3 py-2 text-sm">
                            {INTERVIEW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <select value={tplForm.formDefinitionId} onChange={(e) => setTplForm((f) => ({ ...f, formDefinitionId: e.target.value }))} className="rounded border px-3 py-2 text-sm">
                            <option value="">Link Form Builder questionnaire</option>
                            {forms.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tplForm.mandatory} onChange={(e) => setTplForm((f) => ({ ...f, mandatory: e.target.checked }))} /> Mandatory</label>
                        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tplForm.anonymousAllowed} onChange={(e) => setTplForm((f) => ({ ...f, anonymousAllowed: e.target.checked }))} /> Anonymous</label>
                        <button type="button" onClick={createTemplate} className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm justify-center"><FaPlus /> Create Template</button>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50"><tr>
                                <th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Type</th>
                                <th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actions</th>
                            </tr></thead>
                            <tbody>
                                {templates.map((t) => (
                                    <tr key={t._id} className="border-t">
                                        <td className="px-3 py-2 font-medium">{t.name}</td>
                                        <td className="px-3 py-2">{t.interviewType}</td>
                                        <td className="px-3 py-2">{t.status}</td>
                                        <td className="px-3 py-2">
                                            {t.status !== 'Published' && (
                                                <button type="button" onClick={() => publishTemplate(t._id)} className="text-xs text-blue-600 hover:underline">Publish</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {!templates.length && <tr><td colSpan={4} className="px-3 py-8 text-center text-gray-500">No templates yet. Create exit interview forms in Form Builder (category: Exit Interview) first.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'sessions' && (
                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50"><tr>
                            <th className="px-3 py-2 text-left">Employee</th><th className="px-3 py-2 text-left">Type</th>
                            <th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Scheduled</th>
                            <th className="px-3 py-2 text-left">Rating</th>
                        </tr></thead>
                        <tbody>
                            {sessions.map((s) => (
                                <tr key={s._id} className="border-t">
                                    <td className="px-3 py-2">{s.employeeId?.firstName} {s.employeeId?.lastName}</td>
                                    <td className="px-3 py-2">{s.interviewType}</td>
                                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-xs ${STATUS_BADGE[s.status] || 'bg-gray-100'}`}>{s.status}</span></td>
                                    <td className="px-3 py-2 text-xs">{s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : '—'}</td>
                                    <td className="px-3 py-2">{s.rating ?? '—'}</td>
                                </tr>
                            ))}
                            {!sessions.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-500">No exit interview sessions yet</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {tab === 'analytics' && analytics && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <button type="button" onClick={exportAnalytics} className="flex items-center gap-1 px-3 py-1.5 border rounded text-sm"><FaDownload /> Export CSV</button>
                    </div>
                    <div className="grid sm:grid-cols-4 gap-3">
                        <Stat icon={FaUsers} label="Total Sessions" value={analytics.total} />
                        <Stat icon={FaClipboardList} label="Completed" value={analytics.completed} />
                        <Stat icon={FaChartBar} label="Completion Rate" value={`${analytics.completionRate}%`} />
                        <Stat label="Avg Rating" value={analytics.avgRating ?? '—'} />
                    </div>
                    {analytics.attritionReasons && Object.keys(analytics.attritionReasons).length > 0 && (
                        <div className="border rounded-lg p-4 bg-white">
                            <h4 className="font-semibold text-sm mb-3">Attrition Reasons</h4>
                            <div className="space-y-2">
                                {Object.entries(analytics.attritionReasons).map(([reason, count]) => (
                                    <div key={reason} className="flex justify-between text-sm">
                                        <span>{reason}</span><span className="font-medium">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="text-sm text-gray-500">Open action items: {analytics.openActionItems ?? 0}</div>
                </div>
            )}
        </div>
    );
};

function Stat({ icon: Icon, label, value }) {
    return (
        <div className="p-4 border rounded-lg bg-white">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">{Icon && <Icon />}{label}</div>
            <p className="text-2xl font-semibold">{value}</p>
        </div>
    );
}

export default ExitInterviewHub;
