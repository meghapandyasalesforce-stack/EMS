import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { 
    FaPlus, FaBook, FaYoutube, FaFilePdf, FaLink, FaVideo, 
    FaTrash, FaEdit, FaEye, FaSpinner, FaCheckCircle, FaTimesCircle,
    FaUpload, FaTag
} from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import { filterEmployeesByManager, isManager } from '../../utils/managerHelper';

const TeamLearningPage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Check if user is Manager
    const isManagerUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isManager(userObj);
    }, [user, employee]);
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

    const getCategoryColor = (category) => {
        const colors = {
            'MERN': 'bg-purple-100 text-purple-800',
            'Technical': 'bg-theme-secondary/10 text-theme-secondary',
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
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Team Learning Resources</h1>
                            <p className="text-gray-600 mt-1">Share learning materials with your team</p>
                        </div>
                        {isManagerUser && (
                            <button
                                onClick={() => {
                                    setSelectedLearning(null);
                                    resetForm();
                                    setShowCreateModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                            >
                                <FaPlus />
                                Create Learning Resource
                            </button>
                        )}
                    </div>

                    {/* Filter */}
                    <div className="mb-6">
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="px-4 py-2 border rounded-lg"
                        >
                            <option value="all">All Categories</option>
                            <option value="MERN">MERN</option>
                            <option value="Technical">Technical</option>
                            <option value="Soft Skills">Soft Skills</option>
                            <option value="Leadership">Leadership</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    {/* Learning Resources List */}
                    {learnings.length === 0 ? (
                        <div className="text-center py-12">
                            <FaBook className="mx-auto text-gray-400 text-4xl mb-4" />
                            <p className="text-gray-600 mb-4">No learning resources found</p>
                            {isManagerUser && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                                >
                                    Create Your First Resource
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {learnings.map((learning) => (
                                <div
                                    key={learning._id}
                                    className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-800 mb-2">{learning.title}</h3>
                                            <span className={`inline-block px-2 py-1 rounded text-xs ${getCategoryColor(learning.category)}`}>
                                                {learning.category}
                                            </span>
                                        </div>
                                        {isManagerUser && (
                                            <div className="flex gap-2">
                                                <button
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
                                                    className="p-2 text-theme-secondary hover:bg-theme-secondary/10 rounded"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && isManagerUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4">
                            {selectedLearning ? 'Edit Learning Resource' : 'Create Learning Resource'}
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
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

                            <div className="grid grid-cols-2 gap-4">
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
                                                        <Icon className="text-theme-secondary" />
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

                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setSelectedLearning(null);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed transition"
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

