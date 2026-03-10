import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaCheckCircle, FaClock, FaTasks, FaUser, FaCalendar,
    FaFileAlt, FaSpinner, FaCheck, FaTimes, FaArrowLeft
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const MyOnboardingPage = () => {
    const navigate = useNavigate();
    const [workflow, setWorkflow] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchMyWorkflow();
    }, []);

    const fetchMyWorkflow = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/onboarding/my-workflow', { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setWorkflow(response.data.data);
            } else {
                // No workflow found - show empty state
                setWorkflow(null);
            }
        } catch (error) {
            if (error.response?.status === 404) {
                // No workflow found
                setWorkflow(null);
            } else {
                toast.error('Failed to load onboarding workflow');
            }
        } finally {
            setLoading(false);
        }
    };

    const updateTaskStatus = async (workflowId, taskId, status) => {
        try {
            setSubmitting(true);
            await axios.put(
                `/v1/both/onboarding/workflow/${workflowId}/tasks/${taskId}`,
                { status },
                { withCredentials: true }
            );
            toast.success('Task updated successfully');
            fetchMyWorkflow();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update task');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading your onboarding workflow..." />;
    }

    if (!workflow) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white rounded-lg shadow-md p-8 text-center">
                        <FaTasks className="mx-auto text-6xl text-gray-400 mb-4" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Onboarding Workflow</h2>
                        <p className="text-gray-600 mb-6">
                            You don't have an active onboarding workflow. Please contact HR if you believe this is an error.
                        </p>
                        <button
                            onClick={() => navigate('/dashboard-employee')}
                            className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
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
                        onClick={() => navigate('/dashboard-employee')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <FaArrowLeft /> Back to Dashboard
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">My Onboarding</h1>
                            <p className="text-gray-600 mt-1">Track your onboarding progress</p>
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

                {/* Tasks Section */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold mb-4">My Tasks</h2>
                    
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
                                        {task.assignedTo && (
                                            <div>
                                                <span className="text-gray-500">Assigned To:</span>
                                                <span className="ml-1 font-medium">You</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Task Actions */}
                                    {task.status !== 'Completed' && (
                                        <div className="mt-4 flex gap-2">
                                            {task.status === 'Pending' && (
                                                <button
                                                    onClick={() => updateTaskStatus(workflow._id, task._id, 'In Progress')}
                                                    disabled={submitting}
                                                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    <FaCheck /> Start Task
                                                </button>
                                            )}
                                            {task.status === 'In Progress' && (
                                                <button
                                                    onClick={() => updateTaskStatus(workflow._id, task._id, 'Completed')}
                                                    disabled={submitting}
                                                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    <FaCheckCircle /> Complete
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

                {/* Workflow Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                    <span className="text-gray-500">Completed:</span>
                                    <span className="ml-2 font-medium text-green-600">
                                        {format(new Date(workflow.actualCompletionDate), 'MMM dd, yyyy')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Assigned Personnel */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-semibold mb-4">Support Contacts</h3>
                        <div className="space-y-3 text-sm">
                            {workflow.assignedHR && (
                                <div>
                                    <span className="text-gray-500">HR Contact:</span>
                                    <span className="ml-2 font-medium">
                                        {workflow.assignedHR?.name || 'N/A'}
                                    </span>
                                    {workflow.assignedHR?.email && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {workflow.assignedHR.email}
                                        </div>
                                    )}
                                </div>
                            )}
                            {workflow.assignedBuddy && (
                                <div>
                                    <span className="text-gray-500">Buddy:</span>
                                    <span className="ml-2 font-medium">
                                        {workflow.assignedBuddy?.name || 'N/A'}
                                    </span>
                                    {workflow.assignedBuddy?.email && (
                                        <div className="text-xs text-gray-500 mt-1">
                                            {workflow.assignedBuddy.email}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Welcome Message */}
                {workflow.welcomeMessage && (
                    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
                        <h3 className="text-lg font-semibold mb-2">Welcome Message</h3>
                        <p className="text-sm text-gray-600">{workflow.welcomeMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyOnboardingPage;

