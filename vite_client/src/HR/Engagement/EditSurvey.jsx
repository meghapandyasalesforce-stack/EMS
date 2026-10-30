import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaPlus, FaTrash, FaSave, FaTimes, FaGripVertical } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import EngagementFormShell from './EngagementFormShell';
import SurveyAudienceFields from './SurveyAudienceFields';
import { MINT_GRADIENT } from '../Reports/constants';
import { getStatusHint, toastForSave } from '../../utils/publishStatusUi';

const EditSurvey = () => {
    const navigate = useNavigate();
    const { surveyId } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'Custom',
        questions: [],
        targetAudience: 'All Employees',
        targetDepartments: [],
        targetRoles: [],
        targetEmployees: [],
        startDate: '',
        endDate: '',
        anonymous: false,
        status: 'Draft',
        reminderEnabled: true,
        reminderDaysBefore: 2
    });

    const [newQuestion, setNewQuestion] = useState({
        question: '',
        type: 'Multiple Choice',
        options: [''],
        required: false,
        order: 0
    });

    const [showQuestionForm, setShowQuestionForm] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'targetAudience') {
            setFormData((prev) => ({
                ...prev,
                targetAudience: value,
                targetDepartments: [],
                targetRoles: [],
                targetEmployees: [],
            }));
            return;
        }
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAudienceChange = (patch) => {
        setFormData((prev) => ({ ...prev, ...patch }));
    };

    const validateAudience = () => {
        if (formData.targetAudience === 'Department' && formData.targetDepartments.length === 0) {
            toast.error('Select at least one department');
            return false;
        }
        if (formData.targetAudience === 'Role' && formData.targetRoles.length === 0) {
            toast.error('Select at least one role');
            return false;
        }
        if (
            formData.targetAudience === 'Specific Employees' &&
            formData.targetEmployees.length === 0
        ) {
            toast.error('Select at least one employee');
            return false;
        }
        return true;
    };

    const handleQuestionInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'options') {
            // Handle options separately
            return;
        }
        setNewQuestion(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...newQuestion.options];
        newOptions[index] = value;
        setNewQuestion(prev => ({
            ...prev,
            options: newOptions
        }));
    };

    const addOption = () => {
        setNewQuestion(prev => ({
            ...prev,
            options: [...prev.options, '']
        }));
    };

    const removeOption = (index) => {
        setNewQuestion(prev => ({
            ...prev,
            options: prev.options.filter((_, i) => i !== index)
        }));
    };

    const addQuestion = () => {
        if (!newQuestion.question.trim()) {
            toast.error('Please enter a question');
            return;
        }

        if ((newQuestion.type === 'Multiple Choice' || newQuestion.type === 'Scale') && 
            newQuestion.options.filter(o => o.trim()).length < 2) {
            toast.error('Please add at least 2 options');
            return;
        }

        const question = {
            ...newQuestion,
            order: editingIndex !== null ? editingIndex : formData.questions.length,
            options: newQuestion.options.filter(o => o.trim())
        };

        if (editingIndex !== null) {
            const updatedQuestions = [...formData.questions];
            updatedQuestions[editingIndex] = question;
            setFormData(prev => ({
                ...prev,
                questions: updatedQuestions
            }));
            setEditingIndex(null);
        } else {
            setFormData(prev => ({
                ...prev,
                questions: [...prev.questions, question]
            }));
        }

        setNewQuestion({
            question: '',
            type: 'Multiple Choice',
            options: [''],
            required: false,
            order: 0
        });
        setShowQuestionForm(false);
    };

    const editQuestion = (index) => {
        const question = formData.questions[index];
        setNewQuestion({
            ...question,
            options: question.options && question.options.length > 0 ? question.options : ['']
        });
        setEditingIndex(index);
        setShowQuestionForm(true);
    };

    const removeQuestion = (index) => {
        setFormData(prev => ({
            ...prev,
            questions: prev.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i }))
        }));
    };

    const moveQuestion = (index, direction) => {
        if ((direction === 'up' && index === 0) || 
            (direction === 'down' && index === formData.questions.length - 1)) {
            return;
        }

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const questions = [...formData.questions];
        [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
        
        setFormData(prev => ({
            ...prev,
            questions: questions.map((q, i) => ({ ...q, order: i }))
        }));
    };

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const { data } = await axios.get(`/v1/both/engagement/surveys/${surveyId}`, {
                    withCredentials: true,
                });
                const s = data?.data;
                if (!s) {
                    toast.error('Survey not found');
                    navigate('/engagement');
                    return;
                }
                if ((s.responseCount || 0) > 0) {
                    toast.info('Use metadata edit on the survey detail page when responses exist.');
                    navigate(`/engagement/surveys/${surveyId}`);
                    return;
                }
                setFormData({
                    title: s.title || '',
                    description: s.description || '',
                    type: s.type || 'Custom',
                    questions: s.questions || [],
                    targetAudience: s.targetAudience || 'All Employees',
                    targetDepartments: s.targetDepartments || [],
                    targetRoles: (s.targetRoles || []).map((r) => r?._id || r),
                    targetEmployees: (s.targetEmployees || []).map((e) => e?._id || e),
                    startDate: s.startDate ? new Date(s.startDate).toISOString().slice(0, 16) : '',
                    endDate: s.endDate ? new Date(s.endDate).toISOString().slice(0, 16) : '',
                    anonymous: Boolean(s.anonymous),
                    status: s.status || 'Draft',
                    reminderEnabled: s.reminderEnabled !== false,
                    reminderDaysBefore: s.reminderDaysBefore ?? 2,
                });
            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to load survey');
                navigate('/engagement');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [surveyId, navigate]);

    const handleSubmit = async (e, targetStatus = formData.status) => {
        e.preventDefault();

        if (formData.questions.length === 0) {
            toast.error('Please add at least one question');
            return;
        }

        if (!validateAudience()) return;

        setSaving(true);

        try {
            const payload = {
                ...formData,
                status: targetStatus,
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
                targetDepartments: formData.targetAudience === 'Department' ? formData.targetDepartments : [],
                targetRoles: formData.targetAudience === 'Role' ? formData.targetRoles : [],
                targetEmployees: formData.targetAudience === 'Specific Employees' ? formData.targetEmployees : []
            };

            await axios.put(`/v1/admin/engagement/surveys/${surveyId}`, payload, { withCredentials: true });
            toast.success(toastForSave('Survey', targetStatus, 'survey'));
            navigate(`/engagement/surveys/${surveyId}`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update survey');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="survey-ui survey-ui--loading"><LoadingSpinner message="Loading survey..." /></div>;
    }

    return (
        <EngagementFormShell
            title="Edit Survey"
            subtitle="Update survey details and questions"
            onBack={() => navigate(`/engagement/surveys/${surveyId}`)}
        >
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-gray-800">Survey Information</h2>
                        
                        <div>
                            <label htmlFor="editsurvey-field-1" className="block text-sm font-medium text-gray-700 mb-1">
                                Survey Title <span className="text-red-500">*</span>
                            </label>
                            <input id="editsurvey-field-1"
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div>
                            <label htmlFor="editsurvey-field-2" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea id="editsurvey-field-2"
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="3"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editsurvey-field-3" className="block text-sm font-medium text-gray-700 mb-1">
                                    Survey Type <span className="text-red-500">*</span>
                                </label>
                                <select id="editsurvey-field-3"
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="Pulse">Pulse</option>
                                    <option value="Annual">Annual</option>
                                    <option value="Exit">Exit</option>
                                    <option value="Onboarding">Onboarding</option>
                                    <option value="Custom">Custom</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="editsurvey-field-4" className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select id="editsurvey-field-4"
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Active">Active</option>
                                    <option value="Closed">Closed</option>
                                    <option value="Archived">Archived</option>
                                </select>
                                {getStatusHint(formData.status, 'survey') && (
                                    <p className="mt-1.5 text-xs text-amber-700">{getStatusHint(formData.status, 'survey')}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="editsurvey-field-5" className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date <span className="text-red-500">*</span>
                                </label>
                                <input id="editsurvey-field-5"
                                    type="datetime-local"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>

                            <div>
                                <label htmlFor="editsurvey-field-6" className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date <span className="text-red-500">*</span>
                                </label>
                                <input id="editsurvey-field-6"
                                    type="datetime-local"
                                    name="endDate"
                                    value={formData.endDate}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="editsurvey-field-7" className="block text-sm font-medium text-gray-700 mb-1">
                                Target Audience
                            </label>
                            <select id="editsurvey-field-7"
                                name="targetAudience"
                                value={formData.targetAudience}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            >
                                <option value="All Employees">All Employees</option>
                                <option value="Department">Department</option>
                                <option value="Role">Role</option>
                                <option value="Specific Employees">Specific Employees</option>
                            </select>
                        </div>

                        <SurveyAudienceFields
                            targetAudience={formData.targetAudience}
                            targetDepartments={formData.targetDepartments}
                            targetRoles={formData.targetRoles}
                            targetEmployees={formData.targetEmployees}
                            onChange={handleAudienceChange}
                        />

                        <div className="flex items-center gap-2">
                            <input id="editsurvey-field-8"
                                type="checkbox"
                                name="anonymous"
                                checked={formData.anonymous}
                                onChange={handleInputChange}
                                className="w-4 h-4"
                            />
                            <label htmlFor="editsurvey-field-8" className="text-sm text-gray-700">Anonymous Survey</label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    name="reminderEnabled"
                                    checked={formData.reminderEnabled !== false}
                                    onChange={handleInputChange}
                                    className="w-4 h-4"
                                />
                                Enable reminders / closing notices
                            </label>
                            <div>
                                <label htmlFor="editsurvey-field-9" className="block text-sm font-medium text-gray-700 mb-1">
                                    Reminder days before end
                                </label>
                                <input id="editsurvey-field-9"
                                    type="number"
                                    name="reminderDaysBefore"
                                    min={0}
                                    max={30}
                                    value={formData.reminderDaysBefore ?? 2}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Questions */}
                    <div className="space-y-4">
                        <div className="survey-questions-heading flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-800">
                                Questions ({formData.questions.length})
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowQuestionForm(!showQuestionForm);
                                    setEditingIndex(null);
                                    setNewQuestion({
                                        question: '',
                                        type: 'Multiple Choice',
                                        options: [''],
                                        required: false,
                                        order: 0
                                    });
                                }}
                                className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition flex items-center gap-2"
                            >
                                <FaPlus className="w-4 h-4" />
                                Add Question
                            </button>
                        </div>

                        {showQuestionForm && (
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4 border-2 border-theme-secondary">
                                <div>
                                    <label htmlFor="editsurvey-field-10" className="block text-sm font-medium text-gray-700 mb-1">
                                        Question <span className="text-red-500">*</span>
                                    </label>
                                    <textarea id="editsurvey-field-10"
                                        name="question"
                                        value={newQuestion.question}
                                        onChange={handleQuestionInputChange}
                                        required
                                        rows="2"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        placeholder="Enter your question here..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="editsurvey-field-11" className="block text-sm font-medium text-gray-700 mb-1">
                                            Question Type <span className="text-red-500">*</span>
                                        </label>
                                        <select id="editsurvey-field-11"
                                            name="type"
                                            value={newQuestion.type}
                                            onChange={(e) => {
                                                handleQuestionInputChange(e);
                                                if (e.target.value === 'Text' || e.target.value === 'Yes/No' || e.target.value === 'eNPS') {
                                                    setNewQuestion(prev => ({ ...prev, options: [''] }));
                                                } else if (e.target.value === 'Rating' || e.target.value === 'Scale') {
                                                    setNewQuestion(prev => ({ ...prev, options: ['1', '2', '3', '4', '5'] }));
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                        >
                                            <option value="Multiple Choice">Multiple Choice</option>
                                            <option value="Rating">Rating (1-5)</option>
                                            <option value="Scale">Scale (1-10)</option>
                                            <option value="eNPS">eNPS (0-10)</option>
                                            <option value="Text">Text</option>
                                            <option value="Yes/No">Yes/No</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-2 pt-6">
                                        <input id="editsurvey-field-12"
                                            type="checkbox"
                                            name="required"
                                            checked={newQuestion.required}
                                            onChange={handleQuestionInputChange}
                                            className="w-4 h-4"
                                        />
                                        <label htmlFor="editsurvey-field-12" className="text-sm text-gray-700">Required Question</label>
                                    </div>
                                </div>

                                {(newQuestion.type === 'Multiple Choice' || newQuestion.type === 'Scale') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Options <span className="text-red-500">*</span>
                                        </label>
                                        {newQuestion.options.map((option, index) => (
                                            <div key={index} className="survey-option-row flex gap-2 mb-2">
                                                <input
                                                    type="text"
                                                    value={option}
                                                    onChange={(e) => handleOptionChange(index, e.target.value)}
                                                    placeholder={`Option ${index + 1}`}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                                />
                                                {newQuestion.options.length > 1 && (
                                                    <button aria-label={`Remove option ${index + 1}`}
                                                        type="button"
                                                        onClick={() => removeOption(index)}
                                                        className="px-3 py-2 text-red-500 hover:text-red-700"
                                                    >
                                                        <FaTrash className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={addOption}
                                            className="mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
                                        >
                                            <FaPlus className="w-3 h-3" />
                                            Add Option
                                        </button>
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={addQuestion}
                                        className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition"
                                    >
                                        {editingIndex !== null ? 'Update Question' : 'Add Question'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowQuestionForm(false);
                                            setEditingIndex(null);
                                            setNewQuestion({
                                                question: '',
                                                type: 'Multiple Choice',
                                                options: [''],
                                                required: false,
                                                order: 0
                                            });
                                        }}
                                        className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {formData.questions.length > 0 && (
                            <div className="space-y-3">
                                {formData.questions.map((question, index) => (
                                    <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                        <div className="survey-question-row flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="survey-question-meta flex items-center gap-2 mb-2">
                                                    <FaGripVertical className="text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-500">
                                                        Question {index + 1}
                                                    </span>
                                                    {question.required && (
                                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                            Required
                                                        </span>
                                                    )}
                                                    <span className="text-xs bg-theme-secondary/10 text-theme-secondary px-2 py-1 rounded">
                                                        {question.type}
                                                    </span>
                                                </div>
                                                <p className="text-gray-800 font-medium mb-2">{question.question}</p>
                                                {question.options && question.options.length > 0 && (
                                                    <ul className="list-disc list-inside text-sm text-gray-600 ml-4">
                                                        {question.options.map((opt, optIndex) => (
                                                            <li key={optIndex}>{opt}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {index > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => moveQuestion(index, 'up')}
                                                        className="px-2 py-1 text-theme-secondary hover:text-theme-secondary"
                                                        title="Move Up"
                                                    >
                                                        ↑
                                                    </button>
                                                )}
                                                {index < formData.questions.length - 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => moveQuestion(index, 'down')}
                                                        className="px-2 py-1 text-theme-secondary hover:text-theme-secondary"
                                                        title="Move Down"
                                                    >
                                                        ↓
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => editQuestion(index)}
                                                    className="px-2 py-1 text-green-500 hover:text-theme-primary"
                                                    title="Edit"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeQuestion(index)}
                                                    className="px-2 py-1 text-red-500 hover:text-red-700"
                                                    title="Delete"
                                                >
                                                    <FaTrash className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Submit Buttons */}
                    <div className="survey-form__actions flex flex-wrap justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => navigate('/engagement')}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={(e) => handleSubmit(e, 'Draft')}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-60"
                        >
                            Save as Draft
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={(e) => handleSubmit(e, 'Active')}
                            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaSave className="w-4 h-4" />
                            Publish Survey
                        </button>
                    </div>
                </form>
        </EngagementFormShell>
    );
};

export default EditSurvey;

