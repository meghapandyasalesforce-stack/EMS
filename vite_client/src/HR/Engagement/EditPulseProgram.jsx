import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave, FaTimes, FaGripVertical, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EngagementFormShell from './EngagementFormShell';
import SurveyAudienceFields from './SurveyAudienceFields';

const FREQUENCIES = ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'];
const QUESTION_TYPES = ['Multiple Choice', 'Rating', 'Scale', 'eNPS', 'Text', 'Yes/No'];

const EditPulseProgram = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDraft, setIsDraft] = useState(true);
    const [endMode, setEndMode] = useState('endDate');

    const [form, setForm] = useState({
        name: '', description: '', frequency: 'Monthly', startDate: '', endDate: '',
        maxOccurrences: '', targetAudience: 'All Employees', targetDepartments: [],
        targetRoles: [], targetEmployees: [], anonymous: false, reminderEnabled: true,
        reminderDaysBefore: 2, openDurationDays: 7, questions: []
    });

    const [newQ, setNewQ] = useState({ question: '', type: 'Rating', options: [''], required: false });
    const [showQForm, setShowQForm] = useState(false);
    const [editIdx, setEditIdx] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axios.get(`/v1/admin/engagement/pulse-programs/${id}`);
                const p = data.data;
                setIsDraft(p.status === 'Draft');
                setForm({
                    name: p.name || '', description: p.description || '',
                    frequency: p.frequency || 'Monthly',
                    startDate: p.startDate ? new Date(p.startDate).toISOString().slice(0, 10) : '',
                    endDate: p.endDate ? new Date(p.endDate).toISOString().slice(0, 10) : '',
                    maxOccurrences: p.maxOccurrences || '',
                    targetAudience: p.targetAudience || 'All Employees',
                    targetDepartments: p.targetDepartments || [],
                    targetRoles: (p.targetRoles || []).map((r) => r?._id || r),
                    targetEmployees: (p.targetEmployees || []).map((e) => e?._id || e),
                    anonymous: Boolean(p.anonymous),
                    reminderEnabled: p.reminderEnabled !== false,
                    reminderDaysBefore: p.reminderDaysBefore ?? 2,
                    openDurationDays: p.openDurationDays ?? 7,
                    questions: p.questions || []
                });
                setEndMode(p.maxOccurrences ? 'maxOccurrences' : p.endDate ? 'endDate' : 'none');
            } catch {
                toast.error('Failed to load pulse program');
                navigate('/engagement');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, navigate]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'targetAudience') {
            setForm((p) => ({ ...p, targetAudience: value, targetDepartments: [], targetRoles: [], targetEmployees: [] }));
            return;
        }
        setForm((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
    };
    const handleAudienceChange = (patch) => setForm((p) => ({ ...p, ...patch }));

    // Question builder (same as Create)
    const handleQChange = (e) => { const { name, value, type, checked } = e.target; setNewQ((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value })); };
    const handleOptChange = (idx, val) => { const opts = [...newQ.options]; opts[idx] = val; setNewQ((p) => ({ ...p, options: opts })); };
    const addOpt = () => setNewQ((p) => ({ ...p, options: [...p.options, ''] }));
    const removeOpt = (idx) => setNewQ((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));
    const addQuestion = () => {
        if (!newQ.question.trim()) return toast.error('Question text is required');
        if (['Multiple Choice'].includes(newQ.type) && newQ.options.filter(Boolean).length < 2) return toast.error('Provide at least 2 options');
        const q = { ...newQ, order: editIdx !== null ? editIdx : form.questions.length };
        if (editIdx !== null) { const qs = [...form.questions]; qs[editIdx] = q; setForm((p) => ({ ...p, questions: qs })); }
        else { setForm((p) => ({ ...p, questions: [...p.questions, q] })); }
        setNewQ({ question: '', type: 'Rating', options: [''], required: false }); setShowQForm(false); setEditIdx(null);
    };
    const removeQuestion = (idx) => setForm((p) => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));
    const editQuestion = (idx) => { setNewQ({ ...form.questions[idx] }); setEditIdx(idx); setShowQForm(true); };
    const moveQuestion = (idx, dir) => { const qs = [...form.questions]; const swap = dir === 'up' ? idx - 1 : idx + 1; [qs[idx], qs[swap]] = [qs[swap], qs[idx]]; setForm((p) => ({ ...p, questions: qs })); };

    const validate = () => {
        if (!form.name.trim()) { toast.error('Program name is required'); return false; }
        if (isDraft && !form.startDate) { toast.error('Start date is required'); return false; }
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
            await axios.put(`/v1/admin/engagement/pulse-programs/${id}`, payload);
            toast.success('Pulse program updated');
            navigate(`/engagement/pulse/${id}`);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="survey-ui survey-ui--loading flex items-center justify-center bg-transparent"><LoadingSpinner /></div>;

    return (
        <EngagementFormShell title="Edit Pulse Program" subtitle={isDraft ? 'Full editing available' : 'Some fields are locked for active programs'} onBack={() => navigate(`/engagement/pulse/${id}`)}>
            <form onSubmit={handleSubmit} className="space-y-8">
                {!isDraft && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        This program has been activated. Frequency, start date, and audience type changes are restricted. Template/question changes will only affect future occurrences.
                    </div>
                )}

                {/* Basic */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Basic Details</h2>
                    <div>
                        <label htmlFor="editpulseprogram-field-1" className="block text-sm font-medium text-gray-700 mb-1">Program Name <span className="text-red-500">*</span></label>
                        <input id="editpulseprogram-field-1" name="name" value={form.name} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                    </div>
                    <div>
                        <label htmlFor="editpulseprogram-field-2" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea id="editpulseprogram-field-2" name="description" value={form.description} onChange={handleChange} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                    </div>
                </div>

                {/* Frequency (only draft) */}
                {isDraft && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Frequency</h2>
                        <div className="flex flex-wrap gap-3">
                            {FREQUENCIES.map((f) => (
                                <button key={f} type="button" onClick={() => setForm((p) => ({ ...p, frequency: f }))}
                                    className={`rounded-full border px-5 py-2 text-sm font-semibold transition ${form.frequency === f ? 'border-[#0E9370] bg-[#0E9370]/10 text-[#0d9488]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Schedule */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-800">Schedule</h2>
                    {isDraft && (
                        <div>
                            <label htmlFor="editpulseprogram-field-3" className="block text-sm font-medium text-gray-700 mb-1">Start Date <span className="text-red-500">*</span></label>
                            <input id="editpulseprogram-field-3" type="date" name="startDate" value={form.startDate} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="editpulseprogram-field-4" className="block text-sm font-medium text-gray-700 mb-1">End Condition</label>
                            <select id="editpulseprogram-field-4" value={endMode} onChange={(e) => setEndMode(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                                <option value="endDate">End Date</option>
                                <option value="maxOccurrences">Max Occurrences</option>
                                <option value="none">No Limit</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="editpulseprogram-field-5" className="block text-sm font-medium text-gray-700 mb-1">Survey open duration (days)</label>
                            <input id="editpulseprogram-field-5" type="number" name="openDurationDays" value={form.openDurationDays} onChange={handleChange} min="1" max="90" className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                        </div>
                    </div>
                    {endMode === 'endDate' && <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />}
                    {endMode === 'maxOccurrences' && <input type="number" name="maxOccurrences" value={form.maxOccurrences} onChange={handleChange} min="1" max="200" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" placeholder="Maximum occurrences" />}
                </div>

                {/* Audience */}
                {isDraft && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Audience</h2>
                        <select name="targetAudience" value={form.targetAudience} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                            <option value="All Employees">All Employees</option>
                            <option value="Department">Department</option>
                            <option value="Role">Role</option>
                            <option value="Specific Employees">Specific Employees</option>
                        </select>
                        <SurveyAudienceFields targetAudience={form.targetAudience} targetDepartments={form.targetDepartments} targetRoles={form.targetRoles} targetEmployees={form.targetEmployees} onChange={handleAudienceChange} />
                    </div>
                )}

                {/* Privacy */}
                {isDraft && (
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="anonymous" checked={form.anonymous} onChange={handleChange} className="w-4 h-4" />
                        Anonymous Pulse Survey
                    </label>
                )}

                {/* Reminders */}
                <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                    <h2 className="text-lg font-semibold text-gray-800">Reminders</h2>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" name="reminderEnabled" checked={form.reminderEnabled} onChange={handleChange} className="w-4 h-4" />
                        Enable reminders
                    </label>
                    <div>
                        <label htmlFor="editpulseprogram-field-6" className="block text-sm font-medium text-gray-700 mb-1">Reminder days before end</label>
                        <input id="editpulseprogram-field-6" type="number" name="reminderDaysBefore" min={0} max={30} value={form.reminderDaysBefore} onChange={handleChange} className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                    </div>
                </div>

                {/* Questions */}
                <div className="space-y-4">
                    <div className="survey-questions-heading flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">Questions ({form.questions.length})</h2>
                        <button type="button" onClick={() => { setShowQForm(true); setEditIdx(null); setNewQ({ question: '', type: 'Rating', options: [''], required: false }); }}
                            className="px-4 py-2 bg-[#0E9370] text-white rounded-lg hover:bg-[#0d9488] flex items-center gap-2">
                            <FaPlus className="w-4 h-4" /> Add Question
                        </button>
                    </div>
                    {!isDraft && <p className="text-xs text-amber-600">Question changes affect future occurrences only.</p>}

                    {showQForm && (
                        <div className="bg-gray-50 p-4 rounded-lg space-y-4 border-2 border-[#0E9370]">
                            <textarea aria-label="Question" name="question" value={newQ.question} onChange={handleQChange} rows="2" placeholder="Enter your question"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <select aria-label="Question type" name="type" value={newQ.type} onChange={(e) => { handleQChange(e); if (['Text', 'Yes/No', 'eNPS'].includes(e.target.value)) setNewQ((p) => ({ ...p, options: [''] })); else if (['Rating', 'Scale'].includes(e.target.value)) setNewQ((p) => ({ ...p, options: ['1', '2', '3', '4', '5'] })); }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0E9370]">
                                    {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" name="required" checked={newQ.required} onChange={handleQChange} className="w-4 h-4" />Required</label>
                            </div>
                            {['Multiple Choice', 'Scale'].includes(newQ.type) && (
                                <div>
                                    {newQ.options.map((o, i) => (
                                        <div key={i} className="survey-option-row flex gap-2 mb-2">
                                            <input value={o} onChange={(e) => handleOptChange(i, e.target.value)} placeholder={`Option ${i + 1}`} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" />
                                            {newQ.options.length > 1 && <button aria-label={`Remove option ${i + 1}`} type="button" onClick={() => removeOpt(i)} className="text-red-500"><FaTrash className="w-4 h-4" /></button>}
                                        </div>
                                    ))}
                                    <button type="button" onClick={addOpt} className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2"><FaPlus className="w-3 h-3" />Add Option</button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button type="button" onClick={addQuestion} className="px-4 py-2 bg-[#0E9370] text-white rounded-lg">{editIdx !== null ? 'Update' : 'Add'}</button>
                                <button type="button" onClick={() => { setShowQForm(false); setEditIdx(null); }} className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg">Cancel</button>
                            </div>
                        </div>
                    )}

                    {form.questions.length > 0 && (
                        <div className="space-y-3">
                            {form.questions.map((q, idx) => (
                                <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="survey-question-row flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="survey-question-meta flex items-center gap-2 mb-1">
                                                <FaGripVertical className="text-gray-400" />
                                                <span className="text-sm font-medium text-gray-500">Q{idx + 1}</span>
                                                {q.required && <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Required</span>}
                                                <span className="text-xs bg-[#0E9370]/10 text-[#0d9488] px-2 py-0.5 rounded">{q.type}</span>
                                            </div>
                                            <p className="text-gray-800 font-medium">{q.question}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            {idx > 0 && <button type="button" aria-label={`Move question ${idx + 1} up`} onClick={() => moveQuestion(idx, 'up')} className="px-2 py-1 text-[#0d9488]">↑</button>}
                                            {idx < form.questions.length - 1 && <button type="button" aria-label={`Move question ${idx + 1} down`} onClick={() => moveQuestion(idx, 'down')} className="px-2 py-1 text-[#0d9488]">↓</button>}
                                            <button type="button" onClick={() => editQuestion(idx)} className="px-2 py-1 text-green-500">Edit</button>
                                            <button type="button" aria-label={`Delete question ${idx + 1}`} onClick={() => removeQuestion(idx)} className="px-2 py-1 text-red-500"><FaTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="survey-form__actions flex gap-3 pt-2">
                    <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ background: '#0E9370' }}>
                        {saving ? <FaSpinner className="h-4 w-4 animate-spin" aria-label="Saving" /> : <FaSave className="h-4 w-4" />} Save Changes
                    </button>
                    <button type="button" onClick={() => navigate(`/engagement/pulse/${id}`)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <FaTimes className="h-4 w-4" /> Cancel
                    </button>
                </div>
            </form>
        </EngagementFormShell>
    );
};

export default EditPulseProgram;
