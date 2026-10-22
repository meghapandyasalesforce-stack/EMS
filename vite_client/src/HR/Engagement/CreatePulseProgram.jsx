import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave, FaTimes, FaGripVertical } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EngagementFormShell from './EngagementFormShell';
import SurveyAudienceFields from './SurveyAudienceFields';

const FREQUENCIES = ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'];
const QUESTION_TYPES = ['Multiple Choice', 'Rating', 'Scale', 'eNPS', 'Text', 'Yes/No'];

const CreatePulseProgram = () => {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [endMode, setEndMode] = useState('endDate'); // 'endDate' | 'maxOccurrences' | 'none'

    const [form, setForm] = useState({
        name: '',
        description: '',
        frequency: 'Monthly',
        startDate: '',
        endDate: '',
        maxOccurrences: '',
        targetAudience: 'All Employees',
        targetDepartments: [],
        targetRoles: [],
        targetEmployees: [],
        anonymous: false,
        reminderEnabled: true,
        reminderDaysBefore: 2,
        openDurationDays: 7,
        questions: []
    });

    const [newQ, setNewQ] = useState({ question: '', type: 'Rating', options: [''], required: false });
    const [showQForm, setShowQForm] = useState(false);
    const [editIdx, setEditIdx] = useState(null);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'targetAudience') {
            setForm((p) => ({ ...p, targetAudience: value, targetDepartments: [], targetRoles: [], targetEmployees: [] }));
            return;
        }
        setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleAudienceChange = (patch) => setForm((p) => ({ ...p, ...patch }));

    // --- question builder (reuses same pattern as CreateSurvey) ---
    const handleQChange = (e) => {
        const { name, value, type, checked } = e.target;
        setNewQ((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };
    const handleOptChange = (idx, val) => {
        const opts = [...newQ.options];
        opts[idx] = val;
        setNewQ((p) => ({ ...p, options: opts }));
    };
    const addOpt = () => setNewQ((p) => ({ ...p, options: [...p.options, ''] }));
    const removeOpt = (idx) => setNewQ((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));
    const addQuestion = () => {
        if (!newQ.question.trim()) return toast.error('Question text is required');
        if (['Multiple Choice'].includes(newQ.type) && newQ.options.filter(Boolean).length < 2) {
            return toast.error('Provide at least 2 options');
        }
        const q = { ...newQ, order: editIdx !== null ? editIdx : form.questions.length };
        if (editIdx !== null) {
            const qs = [...form.questions];
            qs[editIdx] = q;
            setForm((p) => ({ ...p, questions: qs }));
        } else {
            setForm((p) => ({ ...p, questions: [...p.questions, q] }));
        }
        setNewQ({ question: '', type: 'Rating', options: [''], required: false });
        setShowQForm(false);
        setEditIdx(null);
    };
    const removeQuestion = (idx) => setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));
    const editQuestion = (idx) => {
        setNewQ({ ...form.questions[idx] });
        setEditIdx(idx);
        setShowQForm(true);
    };
    const moveQuestion = (idx, dir) => {
        const qs = [...form.questions];
        const swap = dir === 'up' ? idx - 1 : idx + 1;
        [qs[idx], qs[swap]] = [qs[swap], qs[idx]];
        setForm((p) => ({ ...p, questions: qs }));
    };

    // --- validation ---
    const validate = () => {
        if (!form.name.trim()) { toast.error('Program name is required'); return false; }
        if (!form.startDate) { toast.error('Start date is required'); return false; }
        if (form.questions.length === 0) { toast.error('Add at least one question'); return false; }
        if (form.targetAudience === 'Department' && form.targetDepartments.length === 0) { toast.error('Select at least one department'); return false; }
        if (form.targetAudience === 'Role' && form.targetRoles.length === 0) { toast.error('Select at least one role'); return false; }
        if (form.targetAudience === 'Specific Employees' && form.targetEmployees.length === 0) { toast.error('Select at least one employee'); return false; }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {
                ...form,
                endDate: endMode === 'endDate' ? form.endDate || undefined : undefined,
                maxOccurrences: endMode === 'maxOccurrences' ? Number(form.maxOccurrences) || undefined : undefined
            };
            await axios.post('/v1/admin/engagement/pulse-programs', payload);
            toast.success('Pulse program created');
            navigate('/engagement', { state: { tab: 'pulse' } });
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to create pulse program');
        } finally {
            setSaving(false);
        }
    };

    return (
        <EngagementFormShell
            title="Create Pulse Program"
            subtitle="Set up a recurring pulse survey"
            onBack={() => navigate('/engagement')}
        >
            <form onSubmit={handleSubmit} className="space-y-8">
                {/* A. Basic Details */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Basic Details</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Program Name <span className="text-red-500">*</span>
                        </label>
                        <input name="name" value={form.name} onChange={handleChange} required
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]"
                            placeholder="e.g. Monthly Employee Pulse" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea name="description" value={form.description} onChange={handleChange} rows="2"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]"
                            placeholder="Optional description" />
                    </div>
                </div>

                {/* B. Frequency */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Frequency</h2>
                    <div className="flex flex-wrap gap-3">
                        {FREQUENCIES.map((f) => (
                            <button key={f} type="button"
                                onClick={() => setForm((p) => ({ ...p, frequency: f }))}
                                className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${
                                    form.frequency === f
                                        ? 'border-[#0E9370] bg-[#0E9370]/10 text-[#0d9488]'
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* C. Schedule */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Schedule</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                            <input type="date" name="startDate" value={form.startDate} onChange={handleChange} required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Condition</label>
                            <select value={endMode} onChange={(e) => setEndMode(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                                <option value="endDate">End Date</option>
                                <option value="maxOccurrences">Max Occurrences</option>
                                <option value="none">No Limit (manual stop)</option>
                            </select>
                        </div>
                    </div>
                    {endMode === 'endDate' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                            <input type="date" name="endDate" value={form.endDate} onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                        </div>
                    )}
                    {endMode === 'maxOccurrences' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Occurrences</label>
                            <input type="number" name="maxOccurrences" value={form.maxOccurrences} onChange={handleChange}
                                min="1" max="200"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Survey open duration (days)</label>
                        <input type="number" name="openDurationDays" value={form.openDurationDays} onChange={handleChange}
                            min="1" max="90"
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                    </div>
                </div>

                {/* D. Audience */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Audience</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                        <select name="targetAudience" value={form.targetAudience} onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                            <option value="All Employees">All Employees</option>
                            <option value="Department">Department</option>
                            <option value="Role">Role</option>
                            <option value="Specific Employees">Specific Employees</option>
                        </select>
                    </div>
                    <SurveyAudienceFields
                        targetAudience={form.targetAudience}
                        targetDepartments={form.targetDepartments}
                        targetRoles={form.targetRoles}
                        targetEmployees={form.targetEmployees}
                        onChange={handleAudienceChange}
                    />
                </div>

                {/* F. Privacy */}
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-gray-800">Privacy</h2>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="anonymous" checked={form.anonymous} onChange={handleChange} className="w-4 h-4" />
                        Anonymous Pulse Survey
                    </label>
                </div>

                {/* G. Reminders */}
                <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                    <h2 className="text-lg font-semibold text-gray-800">Reminders</h2>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="reminderEnabled" checked={form.reminderEnabled} onChange={handleChange} className="w-4 h-4" />
                        Enable reminders & closing notices
                    </label>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Reminder days before end</label>
                        <input type="number" name="reminderDaysBefore" min={0} max={30} value={form.reminderDaysBefore} onChange={handleChange}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                    </div>
                </div>

                {/* E. Questions */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">
                            Questions ({form.questions.length})
                        </h2>
                        <button type="button"
                            onClick={() => { setShowQForm(true); setEditIdx(null); setNewQ({ question: '', type: 'Rating', options: [''], required: false }); }}
                            className="px-4 py-2 bg-[#0E9370] text-white rounded-lg hover:bg-[#0d9488] transition flex items-center gap-2">
                            <FaPlus className="w-4 h-4" /> Add Question
                        </button>
                    </div>

                    {showQForm && (
                        <div className="bg-gray-50 p-4 rounded-lg space-y-4 border-2 border-[#0E9370]">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Question <span className="text-red-500">*</span></label>
                                <textarea name="question" value={newQ.question} onChange={handleQChange} rows="2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]"
                                    placeholder="Enter your question" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                                    <select name="type" value={newQ.type} onChange={(e) => {
                                        handleQChange(e);
                                        if (['Text', 'Yes/No', 'eNPS'].includes(e.target.value)) setNewQ((p) => ({ ...p, options: [''] }));
                                        else if (['Rating', 'Scale'].includes(e.target.value)) setNewQ((p) => ({ ...p, options: ['1', '2', '3', '4', '5'] }));
                                    }}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                                        {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <label className="flex items-center gap-2 pt-6 text-sm text-gray-700">
                                    <input type="checkbox" name="required" checked={newQ.required} onChange={handleQChange} className="w-4 h-4" />
                                    Required
                                </label>
                            </div>
                            {['Multiple Choice', 'Scale'].includes(newQ.type) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Options <span className="text-red-500">*</span></label>
                                    {newQ.options.map((o, i) => (
                                        <div key={i} className="flex gap-2 mb-2">
                                            <input value={o} onChange={(e) => handleOptChange(i, e.target.value)} placeholder={`Option ${i + 1}`}
                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                                            {newQ.options.length > 1 && (
                                                <button type="button" onClick={() => removeOpt(i)} className="px-3 py-2 text-red-500 hover:text-red-700"><FaTrash className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addOpt} className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2">
                                        <FaPlus className="w-3 h-3" /> Add Option
                                    </button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button type="button" onClick={addQuestion} className="px-4 py-2 bg-[#0E9370] text-white rounded-lg hover:bg-[#0d9488]">
                                    {editIdx !== null ? 'Update Question' : 'Add Question'}
                                </button>
                                <button type="button" onClick={() => { setShowQForm(false); setEditIdx(null); }}
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">Cancel</button>
                            </div>
                        </div>
                    )}

                    {form.questions.length > 0 && (
                        <div className="space-y-3">
                            {form.questions.map((q, idx) => (
                                <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FaGripVertical className="text-gray-400" />
                                                <span className="text-sm font-medium text-gray-500">Q{idx + 1}</span>
                                                {q.required && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Required</span>}
                                                <span className="text-xs bg-[#0E9370]/10 text-[#0d9488] px-2 py-0.5 rounded">{q.type}</span>
                                            </div>
                                            <p className="text-gray-800 font-medium">{q.question}</p>
                                            {q.options?.filter(Boolean).length > 0 && !['Text', 'Yes/No', 'eNPS', 'Rating'].includes(q.type) && (
                                                <ul className="list-disc list-inside text-sm text-gray-600 ml-4 mt-1">
                                                    {q.options.map((o, oi) => <li key={oi}>{o}</li>)}
                                                </ul>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {idx > 0 && <button type="button" onClick={() => moveQuestion(idx, 'up')} className="px-2 py-1 text-[#0d9488]">↑</button>}
                                            {idx < form.questions.length - 1 && <button type="button" onClick={() => moveQuestion(idx, 'down')} className="px-2 py-1 text-[#0d9488]">↓</button>}
                                            <button type="button" onClick={() => editQuestion(idx)} className="px-2 py-1 text-green-500 hover:text-green-700">Edit</button>
                                            <button type="button" onClick={() => removeQuestion(idx)} className="px-2 py-1 text-red-500 hover:text-red-700"><FaTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Summary */}
                {form.name && form.startDate && form.questions.length > 0 && (
                    <div className="rounded-xl border border-[#0E9370]/30 bg-[#0E9370]/5 p-5 space-y-2">
                        <h3 className="font-semibold text-[#0d9488]">Summary</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
                            <span className="font-medium">Pulse:</span><span>{form.name}</span>
                            <span className="font-medium">Frequency:</span><span>{form.frequency}</span>
                            <span className="font-medium">Audience:</span><span>{form.targetAudience}</span>
                            <span className="font-medium">Start:</span><span>{form.startDate}</span>
                            {endMode === 'endDate' && form.endDate && <><span className="font-medium">End:</span><span>{form.endDate}</span></>}
                            {endMode === 'maxOccurrences' && form.maxOccurrences && <><span className="font-medium">Max Occurrences:</span><span>{form.maxOccurrences}</span></>}
                            <span className="font-medium">Anonymous:</span><span>{form.anonymous ? 'Yes' : 'No'}</span>
                            <span className="font-medium">Questions:</span><span>{form.questions.length}</span>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={saving}
                        className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ background: '#0E9370' }}>
                        {saving ? <LoadingSpinner small /> : <FaSave className="h-4 w-4" />}
                        Save as Draft
                    </button>
                    <button type="button" onClick={() => navigate('/engagement')}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <FaTimes className="h-4 w-4" /> Cancel
                    </button>
                </div>
            </form>
        </EngagementFormShell>
    );
};

export default CreatePulseProgram;
