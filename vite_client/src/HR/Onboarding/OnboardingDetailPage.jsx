import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, FaCheckCircle, FaClock, FaTasks, FaUser, FaCalendar,
    FaFileAlt, FaSpinner, FaEdit, FaPlus, FaTrash, FaCheck, FaTimes
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { useEmployees } from '../../Hooks/useDashboardData';
import { format } from 'date-fns';

const OnboardingDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [workflow, setWorkflow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const { data: employees = [] } = useEmployees();

    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        category: 'Documentation',
        assignedTo: '',
        dueDate: '',
        priority: 'Medium'
    });

    useEffect(() => {
        fetchWorkflow();
    }, [id]);

    const fetchWorkflow = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/onboarding/onboarding/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setWorkflow(response.data.data);
            } else {
                toast.error('Workflow not found');
                navigate('/onboarding');
            }
        } catch (error) {
            toast.error('Failed to load workflow');
            navigate('/onboarding');
        } finally {
            setLoading(false);
        }
    };

    const updateTaskStatus = async (taskId, status) => {
        try {
            setSubmitting(true);
            await axios.put(
                `/v1/admin/onboarding/onboarding/${id}/tasks/${taskId}`,
                { status },
                { withCredentials: true }
            );
            toast.success('Task updated successfully');
            fetchWorkflow();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update task');
        } finally {
            setSubmitting(false);
        }
    };

    const addTask = async (e) => {
        e.preventDefault();
        
        if (!newTask.title || !newTask.assignedTo) {
            toast.error('Please fill in task title and assignee');
            return;
        }

        try {
            setSubmitting(true);
            // Add new task to workflow
            const updatedTasks = [
                ...(workflow.tasks || []),
                {
                    ...newTask,
                    status: 'Pending'
                }
            ];
            
            await axios.put(
                `/v1/admin/onboarding/onboarding/${id}`,
                { tasks: updatedTasks },
                { withCredentials: true }
            );
            
            toast.success('Task added successfully');
            setShowAddTaskModal(false);
            setNewTask({
                title: '',
                description: '',
                category: 'Documentation',
                assignedTo: '',
                dueDate: '',
                priority: 'Medium'
            });
            fetchWorkflow();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add task');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading workflow details..." />;
    }

    if (!workflow) {
        return null;
    }

    const completedTasks = workflow.tasks?.filter(t => t.status === 'Completed').length || 0;
    const totalTasks = workflow.tasks?.length || 0;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed':
                return 'bg-green-100 text-green-800';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Not Started':
                return 'bg-gray-100 text-gray-800';
            case 'On Hold':
                return 'bg-yellow-100 text-yellow-800';
            case 'Cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getTaskStatusColor = (status) => {
        switch (status) {
            case 'Completed':
                return 'bg-green-100 text-green-800';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Pending':
                return 'bg-gray-100 text-gray-800';
            case 'Overdue':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/onboarding')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <FaArrowLeft /> Back to Workflows
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">
                                {workflow.employeeId?.name || 'Employee'} Onboarding
                            </h1>
                            <p className="text-gray-600 mt-1">
                                {workflow.employeeId?.email || ''}
                            </p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(workflow.status)}`}>
                            {workflow.status}
                        </span>
                    </div>
                </div>

                {/* Progress Overview */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">Progress Overview</h2>
                    <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>Overall Progress</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                                className="bg-blue-600 h-3 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
                            <div className="text-sm text-gray-600">Total Tasks</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
                            <div className="text-sm text-gray-600">Completed</div>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                            <div className="text-2xl font-bold text-yellow-600">{totalTasks - completedTasks}</div>
                            <div className="text-sm text-gray-600">Remaining</div>
                        </div>
                    </div>
                </div>

                {/* Workflow Details */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Tasks Section */}
                        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Tasks</h2>
                                <button
                                    onClick={() => setShowAddTaskModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                                >
                                    <FaPlus /> Add Task
                                </button>
                            </div>
                            
                            {workflow.tasks && workflow.tasks.length > 0 ? (
                                <div className="space-y-4">
                                    {workflow.tasks.map((task, index) => (
                                        <div key={task._id || index} className="border rounded-lg p-4 hover:shadow-md transition">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-gray-800">{task.title}</h3>
                                                    {task.description && (
                                                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Category:</span>
                                                    <span className="ml-1 font-medium">{task.category}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Priority:</span>
                                                    <span className="ml-1 font-medium">{task.priority}</span>
                                                </div>
                                                {task.dueDate && (
                                                    <div>
                                                        <span className="text-gray-500">Due:</span>
                                                        <span className="ml-1 font-medium">
                                                            {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-gray-500">Assigned:</span>
                                                    <span className="ml-1 font-medium">
                                                        {employees.find(e => (e._id || e.id) === task.assignedTo)?.name || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Task Actions */}
                                            {task.status !== 'Completed' && (
                                                <div className="mt-4 flex gap-2">
                                                    {task.status === 'Pending' && (
                                                        <button
                                                            onClick={() => updateTaskStatus(task._id, 'In Progress')}
                                                            disabled={submitting}
                                                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition disabled:opacity-50"
                                                        >
                                                            Start Task
                                                        </button>
                                                    )}
                                                    {task.status === 'In Progress' && (
                                                        <button
                                                            onClick={() => updateTaskStatus(task._id, 'Completed')}
                                                            disabled={submitting}
                                                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-1"
                                                        >
                                                            <FaCheck /> Complete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FaTasks className="mx-auto text-4xl mb-2 text-gray-400" />
                                    <p>No tasks assigned yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Workflow Info */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4">Workflow Information</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-500">Start Date:</span>
                                    <span className="ml-2 font-medium">
                                        {workflow.startDate ? format(new Date(workflow.startDate), 'MMM dd, yyyy') : 'N/A'}
                                    </span>
                                </div>
                                {workflow.expectedCompletionDate && (
                                    <div>
                                        <span className="text-gray-500">Expected Completion:</span>
                                        <span className="ml-2 font-medium">
                                            {format(new Date(workflow.expectedCompletionDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                )}
                                {workflow.actualCompletionDate && (
                                    <div>
                                        <span className="text-gray-500">Actual Completion:</span>
                                        <span className="ml-2 font-medium text-green-600">
                                            {format(new Date(workflow.actualCompletionDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assigned Personnel */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4">Assigned Personnel</h3>
                            <div className="space-y-3 text-sm">
                                {workflow.assignedHR && (
                                    <div>
                                        <span className="text-gray-500">HR:</span>
                                        <span className="ml-2 font-medium">
                                            {employees.find(e => (e._id || e.id) === workflow.assignedHR)?.name || 'N/A'}
                                        </span>
                                    </div>
                                )}
                                {workflow.assignedBuddy && (
                                    <div>
                                        <span className="text-gray-500">Buddy:</span>
                                        <span className="ml-2 font-medium">
                                            {employees.find(e => (e._id || e.id) === workflow.assignedBuddy)?.name || 'N/A'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Welcome Message */}
                        {workflow.welcomeMessage && (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-2">Welcome Message</h3>
                                <p className="text-sm text-gray-600">{workflow.welcomeMessage}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Task Modal */}
            {showAddTaskModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h3 className="text-xl font-semibold mb-4">Add New Task</h3>
                        <form onSubmit={addTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={newTask.category}
                                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Assigned To <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={newTask.assignedTo}
                                    onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.dueDate}
                                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddTaskModal(false);
                                        setNewTask({
                                            title: '',
                                            description: '',
                                            category: 'Documentation',
                                            assignedTo: '',
                                            dueDate: '',
                                            priority: 'Medium'
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Task'
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

export default OnboardingDetailPage;

