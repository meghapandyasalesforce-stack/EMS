import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
    FaPlus, FaBook, FaYoutube, FaFilePdf, FaLink, FaVideo, 
    FaTrash, FaEdit, FaSpinner, FaTimesCircle,
    FaGraduationCap
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { filterEmployeesByManager, isManager } from '../../utils/managerHelper';
import { formatStatusLabel } from '../../utils/textFormat.js';
import './TeamLearningPage.css';

const TeamLearningPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Check if user is Manager
    const isManagerUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isManager(userObj);
    }, [user, employee]);
    const currentEmployeeId =
        employee?._id || user?.employeeProfileId || user?._id || user?.id;
    const [learnings, setLearnings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedLearning, setSelectedLearning] = useState(null);
    const [filterCategory, setFilterCategory] = useState('all');
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: 'Other',
        resourceType: 'Document',
        resources: [],
        assignedTo: [],
        tags: [],
        priority: 'Medium',
        dueDate: ''
    });

    const [newResource, setNewResource] = useState({
        type: 'Document',
        title: '',
        url: '',
        description: ''
    });

    const overallStats = useMemo(
        () =>
            learnings.reduce(
                (totals, learning) => {
                    const stats = learning.completionStats || {};
                    totals.totalAssigned += stats.totalAssigned || 0;
                    totals.completed += stats.completed || 0;
                    totals.inProgress += stats.inProgress || 0;
                    totals.notStarted += stats.notStarted || 0;
                    return totals;
                },
                { totalAssigned: 0, completed: 0, inProgress: 0, notStarted: 0 }
            ),
        [learnings]
    );

    useEffect(() => {
        fetchLearnings();
        fetchEmployees();
    }, [filterCategory]);

    const fetchLearnings = async () => {
        try {
            setLoading(true);
            const params = filterCategory !== 'all' ? { category: filterCategory } : {};
            const response = await axios.get('/v1/both/team-learning', {
                params,
                withCredentials: true
            });
            setLearnings(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load learning resources');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('/v1/employee/auth/get-all-employees', {
                withCredentials: true
            });
            const allEmployees = response.data?.employees || [];
            // Filter by manager if user is a manager
            const teamMembers = filterEmployeesByManager(allEmployees, user);
            setEmployees(teamMembers);
        } catch (error) {
            // Error handled silently for production
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.title || !formData.description || formData.resources.length === 0) {
            toast.warning('Please fill in all required fields and add at least one resource');
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                ...formData,
                assignedTo: formData.assignedTo.length > 0 ? formData.assignedTo : [],
                dueDate: formData.dueDate || undefined
            };

            if (selectedLearning) {
                await axios.put(`/v1/both/team-learning/${selectedLearning._id}`, payload, {
                    withCredentials: true
                });
                toast.success('Learning resource updated successfully');
            } else {
                await axios.post('/v1/both/team-learning', payload, {
                    withCredentials: true
                });
                toast.success('Learning resource created successfully');
            }
            
            setShowCreateModal(false);
            setSelectedLearning(null);
            resetForm();
            fetchLearnings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save learning resource');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this learning resource?')) {
            return;
        }

        try {
            await axios.delete(`/v1/both/team-learning/${id}`, {
                withCredentials: true
            });
            toast.success('Learning resource deleted successfully');
            fetchLearnings();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete learning resource');
        }
    };

    const addResource = () => {
        if (!newResource.title || (!newResource.url && newResource.type !== 'Document')) {
            toast.warning('Please fill in resource title and URL');
            return;
        }

        setFormData({
            ...formData,
            resources: [...formData.resources, {
                ...newResource,
                order: formData.resources.length
            }]
        });

        setNewResource({
            type: 'Document',
            title: '',
            url: '',
            description: ''
        });
    };

    const removeResource = (index) => {
        setFormData({
            ...formData,
            resources: formData.resources.filter((_, i) => i !== index)
        });
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            category: 'Other',
            resourceType: 'Document',
            resources: [],
            assignedTo: [],
            tags: [],
            priority: 'Medium',
            dueDate: ''
        });
        setNewResource({
            type: 'Document',
            title: '',
            url: '',
            description: ''
        });
    };

    const getResourceIcon = (type) => {
        const icons = {
            'YouTube Link': FaYoutube,
            'Document': FaFilePdf,
            'Article': FaLink,
            'Video': FaVideo,
            'PDF': FaFilePdf,
            'Course': FaBook,
            'Other': FaLink
        };
        return icons[type] || FaLink;
    };

    const getProgressStatusColor = (status) => {
        const colors = {
            'Completed': 'bg-green-100 text-green-800',
            'In Progress': 'bg-blue-100 text-blue-800',
            'Not Started': 'bg-gray-100 text-gray-700'
        };
        return colors[status] || colors['Not Started'];
    };

    const getCategoryColor = (category) => {
        const colors = {
            'MERN': 'bg-purple-100 text-purple-800',
            'Technical': 'bg-theme-primary/10 text-theme-primary',
            'Soft Skills': 'bg-theme-primary/10 text-theme-primary',
            'Leadership': 'bg-yellow-100 text-yellow-800',
            'Other': 'bg-gray-100 text-gray-800'
        };
        return colors[category] || colors.Other;
    };

    if (loading) {
        return <LoadingSpinner message="Loading team learning resources..." />;
    }

    return (
        <div className="page-shell team-learning-page">
            <div className="page-shell-inner team-learning-workspace">
                <header className="team-learning-header">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-lg text-theme-primary">
                                <FaGraduationCap />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Team Learning</h1>
                                <p className="mt-1 text-sm text-slate-500">Share learning materials and track team completion</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/employee/benefits-learning?tab=learning')}
                                className="team-learning-action inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                <FaGraduationCap />
                                My Learning
                            </button>
                            {isManagerUser && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedLearning(null);
                                        resetForm();
                                        setShowCreateModal(true);
                                    }}
                                    className="team-learning-action inline-flex items-center gap-2 rounded-lg bg-theme-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-95"
                                >
                                    <FaPlus />
                                    Create Resource
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                    {isManagerUser && overallStats.totalAssigned > 0 && (
                        <dl className="team-learning-stats">
                            {[
                                { label: 'Total assignments', value: overallStats.totalAssigned },
                                { label: 'Completed', value: overallStats.completed },
                                { label: 'In progress', value: overallStats.inProgress },
                                { label: 'Not started', value: overallStats.notStarted }
                            ].map((stat) => (
                                <div key={stat.label}>
                                    <dt className="text-xs text-slate-500">{stat.label}</dt>
                                    <dd className="mt-1 text-lg font-semibold text-slate-900">{stat.value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    <nav className="team-learning-filters" aria-label="Learning categories">
                        <div className="flex gap-5">
                            {['all', 'MERN', 'Technical', 'Soft Skills', 'Leadership', 'Other'].map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    aria-pressed={filterCategory === category}
                                    onClick={() => setFilterCategory(category)}
                                    className={`team-learning-filter ${
                                        filterCategory === category
                                            ? 'team-learning-filter--active'
                                            : ''
                                    }`}
                                >
                                    {category === 'all' ? 'All' : category}
                                </button>
                            ))}
                        </div>
                    </nav>

                    {learnings.length === 0 ? (
                        <div className="team-learning-empty">
                            <div className="team-learning-empty-icon bg-theme-primary/10 text-theme-primary">
                                <FaBook className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">{filterCategory === 'all' ? 'Build your team’s learning library' : `No ${filterCategory} resources yet`}</h2>
                                <p className="mt-1 text-sm leading-6 text-slate-500">
                                    {isManagerUser ? 'Use Create Resource to share a guide, video, or course with your team.' : 'Learning materials shared with your team will appear here.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="team-learning-resources">
                            {learnings.map((learning) => {
                                const stats = learning.completionStats || {};
                                const isAssignedToMe = (learning.assignedTo || []).some(
                                    (assignee) => String(assignee?._id || assignee) === String(currentEmployeeId)
                                );
                                return (
                                <div
                                    key={learning._id}
                                    className="team-learning-resource"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-800 mb-2">{learning.title}</h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-block px-2 py-1 rounded text-xs ${getCategoryColor(learning.category)}`}>
                                                    {learning.category}
                                                </span>
                                                {isAssignedToMe && (
                                                    <span className={`inline-block px-2 py-1 rounded text-xs ${getProgressStatusColor(learning.progressStatus)}`}>
                                                        You: {formatStatusLabel(learning.progressStatus || 'Not Started')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {isManagerUser && (
                                            <div className="flex gap-2">
                                                <button
                                                    aria-label={`Edit ${learning.title}`}
                                                    onClick={() => {
                                                        setSelectedLearning(learning);
                                                        setFormData({
                                                            title: learning.title,
                                                            description: learning.description,
                                                            category: learning.category,
                                                            resourceType: learning.resourceType,
                                                            resources: learning.resources || [],
                                                            assignedTo: learning.assignedTo?.map(e => e._id || e) || [],
                                                            tags: learning.tags || [],
                                                            priority: learning.priority,
                                                            dueDate: learning.dueDate ? format(new Date(learning.dueDate), 'yyyy-MM-dd') : ''
                                                        });
                                                        setShowCreateModal(true);
                                                    }}
                                                    className="p-2 text-theme-primary hover:bg-theme-primary/10 rounded"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    aria-label={`Delete ${learning.title}`}
                                                    onClick={() => handleDelete(learning._id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{learning.description}</p>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <FaBook />
                                        <span>{learning.resources?.length || 0} resources</span>
                                    </div>
                                    {learning.dueDate && (
                                        <div className="mt-2 text-xs text-gray-500">
                                            Due: {format(new Date(learning.dueDate), 'MMM dd, yyyy')}
                                        </div>
                                    )}
                                    {isManagerUser && stats.totalAssigned > 0 && (
                                        <div className="mt-3 border-t pt-3">
                                            <div className="flex items-center justify-between text-xs font-medium text-gray-700">
                                                <span>Team completion</span>
                                                <span>
                                                    {stats.completed}/{stats.totalAssigned} ({stats.completionRate}%)
                                                </span>
                                            </div>
                                            <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                                                <div
                                                    className="h-2 rounded-full bg-theme-primary transition-all"
                                                    style={{ width: `${stats.completionRate}%` }}
                                                />
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">
                                                    {stats.completed} completed
                                                </span>
                                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">
                                                    {stats.inProgress} in progress
                                                </span>
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                                                    {stats.notStarted} not started
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    )}
            </div>

            {showCreateModal && isManagerUser && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
                    <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl">
                        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
                            <h3 className="text-lg font-bold text-slate-900">
                                {selectedLearning ? 'Edit Learning Resource' : 'Create Learning Resource'}
                            </h3>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                    placeholder="e.g., MERN Stack Development Guide"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                    required
                                    placeholder="Describe what employees will learn..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="MERN">MERN</option>
                                        <option value="Technical">Technical</option>
                                        <option value="Soft Skills">Soft Skills</option>
                                        <option value="Leadership">Leadership</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Due Date (Optional)
                                </label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>

                            {/* Add Resources Section */}
                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">Learning Resources</h4>
                                
                                {/* Add New Resource */}
                                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                            <select
                                                value={newResource.type}
                                                onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
                                                className="w-full p-2 border rounded text-sm"
                                            >
                                                <option value="Document">Document</option>
                                                <option value="YouTube Link">YouTube Link</option>
                                                <option value="Article">Article</option>
                                                <option value="Video">Video</option>
                                                <option value="PDF">PDF</option>
                                                <option value="Course">Course</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                                            <input
                                                type="text"
                                                value={newResource.title}
                                                onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                                                className="w-full p-2 border rounded text-sm"
                                                placeholder="Resource title"
                                            />
                                        </div>
                                    </div>
                                    {newResource.type !== 'Document' && (
                                        <div className="mb-3">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
                                            <input
                                                type="url"
                                                value={newResource.url}
                                                onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
                                                className="w-full p-2 border rounded text-sm"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    )}
                                    <div className="mb-3">
                                        <label className="block text-xs font-medium text-gray-700 mb-1">Description (Optional)</label>
                                        <input
                                            type="text"
                                            value={newResource.description}
                                            onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
                                            className="w-full p-2 border rounded text-sm"
                                            placeholder="Brief description"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addResource}
                                        className="flex items-center gap-2 px-3 py-2 bg-theme-primary text-white rounded text-sm hover:bg-theme-primary"
                                    >
                                        <FaPlus />
                                        Add Resource
                                    </button>
                                </div>

                                {/* Resources List */}
                                {formData.resources.length > 0 && (
                                    <div className="space-y-2">
                                        {formData.resources.map((resource, index) => {
                                            const Icon = getResourceIcon(resource.type);
                                            return (
                                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                                    <div className="flex items-center gap-3">
                                                        <Icon className="text-theme-primary" />
                                                        <div>
                                                            <p className="font-medium text-sm">{resource.title}</p>
                                                            <p className="text-xs text-gray-500">{resource.type}</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeResource(index)}
                                                        className="text-red-500 hover:bg-red-50 p-2 rounded"
                                                    >
                                                        <FaTimesCircle />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Assign To */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assign To (Leave empty for all team members)
                                </label>
                                <select
                                    multiple
                                    value={formData.assignedTo}
                                    onChange={(e) => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setFormData({ ...formData, assignedTo: selected });
                                    }}
                                    className="w-full p-3 border rounded-lg"
                                    size="5"
                                >
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                            </div>

                            <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedLearning(null);
                                        resetForm();
                                    }}
                                    className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="rounded-xl bg-theme-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-theme-primary disabled:opacity-50"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin inline mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        selectedLearning ? 'Update' : 'Create'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamLearningPage;

