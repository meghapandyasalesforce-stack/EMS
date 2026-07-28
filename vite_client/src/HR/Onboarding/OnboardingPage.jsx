import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaCheckCircle, FaClock, FaTasks, FaPlus, FaSpinner, FaSearch, FaFilter } from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { useEmployees } from '../../Hooks/useDashboardData';

const OnboardingPage = () => {
    const navigate = useNavigate();
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const { data: employeeData = { employees: [], total: 0 }, isLoading: employeesLoading } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const [formData, setFormData] = useState({
        employeeId: '',
        expectedCompletionDate: '',
        welcomeMessage: '',
        assignedHR: '',
        assignedBuddy: '',
        tasks: [
            {
                title: '',
                description: '',
                category: 'Documentation',
                assignedTo: '',
                dueDate: '',
                priority: 'Medium'
            }
        ]
    });

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/admin/onboarding/onboarding', { withCredentials: true });
            setWorkflows(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load onboarding workflows');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateWorkflow = async (e) => {
        e.preventDefault();
        
        // Validate form
        if (!formData.employeeId) {
            toast.error('Please select an employee');
            return;
        }

        if (formData.tasks.length === 0 || formData.tasks.some(t => !t.title || !t.assignedTo)) {
            toast.error('Please add at least one task with title and assignee');
            return;
        }

        try {
            setSubmitting(true);
            const response = await axios.post('/v1/admin/onboarding/onboarding', formData, { withCredentials: true });
            toast.success('Onboarding workflow created successfully');
            setShowCreateModal(false);
            resetForm();
            fetchWorkflows();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create onboarding workflow');
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            employeeId: '',
            expectedCompletionDate: '',
            welcomeMessage: '',
            assignedHR: '',
            assignedBuddy: '',
            tasks: [
                {
                    title: '',
                    description: '',
                    category: 'Documentation',
                    assignedTo: '',
                    dueDate: '',
                    priority: 'Medium'
                }
            ]
        });
    };

    const addTask = () => {
        setFormData({
            ...formData,
            tasks: [
                ...formData.tasks,
                {
                    title: '',
                    description: '',
                    category: 'Documentation',
                    assignedTo: '',
                    dueDate: '',
                    priority: 'Medium'
                }
            ]
        });
    };

    const removeTask = (index) => {
        setFormData({
            ...formData,
            tasks: formData.tasks.filter((_, i) => i !== index)
        });
    };

    const updateTask = (index, field, value) => {
        const updatedTasks = [...formData.tasks];
        updatedTasks[index] = { ...updatedTasks[index], [field]: value };
        setFormData({ ...formData, tasks: updatedTasks });
    };

    // Filter workflows
    const filteredWorkflows = workflows.filter(workflow => {
        const matchesSearch = searchTerm === '' || 
            workflow.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            workflow.employeeId?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return <LoadingSpinner message="Loading onboarding workflows..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 transition-all duration-300">
            <div className="page-shell">
            <div className="page-shell-inner">
            <div className="hrms-stack">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Onboarding Management</h1>
                        <p className="text-gray-600 mt-1">Manage new employee onboarding workflows</p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                    >
                        <FaPlus />
                        Create Workflow
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by employee name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent appearance-none bg-white"
                        >
                            <option value="all">All Status</option>
                            <option value="Not Started">Not Started</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredWorkflows.map((workflow) => {
                        const completedTasks = workflow.tasks?.filter(t => t.status === 'Completed').length || 0;
                        const totalTasks = workflow.tasks?.length || 0;
                        const progress = Number(workflow.progress) || 0;

                        return (
                            <div key={workflow._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        {workflow.employeeId?.name || 'Employee'}
                                    </h3>
                                    <span className={`px-3 py-1 rounded-full text-sm ${
                                        workflow.status === 'Completed' ? 'bg-theme-primary/10 text-theme-primary' :
                                        workflow.status === 'In Progress' ? 'bg-theme-secondary/10 text-theme-secondary' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {workflow.status}
                                    </span>
                                </div>
                                
                                <div className="mb-4">
                                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Progress</span>
                                        <span>{progress}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div 
                                            className="bg-theme-primary h-2 rounded-full transition-all"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span><FaTasks className="inline mr-1" /> {completedTasks}/{totalTasks} Tasks</span>
                                </div>

                                <button
                                    onClick={() => navigate(`/onboarding/${workflow._id}`)}
                                    className="mt-4 w-full bg-theme-secondary text-white py-2 rounded-lg hover:bg-theme-primary transition"
                                >
                                    View Details
                                </button>
                            </div>
                        );
                    })}
                    {filteredWorkflows.length === 0 && (
                        <div className="col-span-3 text-center py-8 sm:py-10">
                            <FaUserPlus className="mx-auto text-gray-400 text-5xl mb-4" />
                            <p className="text-gray-500">
                                {workflows.length === 0 
                                    ? 'No onboarding workflows yet.' 
                                    : 'No workflows match your filters.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Workflow Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">Create Onboarding Workflow</h3>
                        <form onSubmit={handleCreateWorkflow} className="space-y-4">
                            {/* Employee Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.employeeId}
                                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                    disabled={employeesLoading}
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName || ''} ({emp.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Expected Completion Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Expected Completion Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.expectedCompletionDate}
                                    onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>

                            {/* Assigned HR */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assigned HR
                                </label>
                                <select
                                    value={formData.assignedHR}
                                    onChange={(e) => setFormData({ ...formData, assignedHR: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="">Select HR</option>
                                    {employees.filter(emp => 
                                        emp.department?.toLowerCase().includes('hr') ||
                                        emp.jobTitle?.toLowerCase().includes('hr')
                                    ).map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Assigned Buddy */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assigned Buddy
                                </label>
                                <select
                                    value={formData.assignedBuddy}
                                    onChange={(e) => setFormData({ ...formData, assignedBuddy: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="">Select Buddy</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Welcome Message */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Welcome Message
                                </label>
                                <textarea
                                    value={formData.welcomeMessage}
                                    onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                    placeholder="Welcome message for the new employee..."
                                />
                            </div>

                            {/* Tasks */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Tasks <span className="text-red-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addTask}
                                        className="text-theme-secondary hover:text-theme-secondary flex items-center gap-1"
                                    >
                                        <FaPlus /> Add Task
                                    </button>
                                </div>
                                {formData.tasks.map((task, index) => (
                                    <div key={index} className="border rounded-lg p-4 mb-4 bg-gray-50">
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="font-medium text-gray-700">Task {index + 1}</h4>
                                            {formData.tasks.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeTask(index)}
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Title *</label>
                                                <input
                                                    type="text"
                                                    value={task.title}
                                                    onChange={(e) => updateTask(index, 'title', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Category *</label>
                                                <select
                                                    value={task.category}
                                                    onChange={(e) => updateTask(index, 'category', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                    required
                                                >
                                                    <option value="Documentation">Documentation</option>
                                                    <option value="IT Setup">IT Setup</option>
                                                    <option value="HR Paperwork">HR Paperwork</option>
                                                    <option value="Training">Training</option>
                                                    <option value="Orientation">Orientation</option>
                                                    <option value="Equipment">Equipment</option>
                                                    <option value="Access">Access</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Assigned To *</label>
                                                <select
                                                    value={task.assignedTo}
                                                    onChange={(e) => updateTask(index, 'assignedTo', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                    required
                                                >
                                                    <option value="">Select Assignee</option>
                                                    {employees.map((emp) => (
                                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                                            {emp.name} {emp.lastName || ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Priority</label>
                                                <select
                                                    value={task.priority}
                                                    onChange={(e) => updateTask(index, 'priority', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                >
                                                    <option value="Low">Low</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="High">High</option>
                                                    <option value="Critical">Critical</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-xs text-gray-600 mb-1">Description</label>
                                                <textarea
                                                    value={task.description}
                                                    onChange={(e) => updateTask(index, 'description', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                    rows="2"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Due Date</label>
                                                <input
                                                    type="date"
                                                    value={task.dueDate}
                                                    onChange={(e) => updateTask(index, 'dueDate', e.target.value)}
                                                    className="w-full p-2 border rounded"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Workflow'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </div>
        </div>
    );
};

export default OnboardingPage;

