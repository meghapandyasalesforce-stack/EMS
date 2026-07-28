import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from '../../utils/axios';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
    FaUserFriends, FaTasks, FaCheckCircle, FaClock, FaCalendarAlt,
    FaFileUpload, FaComment, FaStar, FaHandshake, FaPlus, FaEye,
    FaArrowLeft, FaFilter, FaSearch,
} from 'react-icons/fa';

const BuddyDashboard = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useSelector((s) => s.auth.user);
    const employee = useSelector((s) => s.employeeDetails.employee);
    const userObj = user || employee;
    const employeeId = employee?._id || user?.employeeId;

    const [loading, setLoading] = useState(true);
    const [dashboard, setDashboard] = useState(null);
    const [workflows, setWorkflows] = useState([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showCheckinModal, setShowCheckinModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchDashboard = useCallback(async () => {
        if (!employeeId) return;
        try {
            setLoading(true);
            const response = await axios.get('/api/v1/both/lifecycle/buddy/dashboard');
            setDashboard(response.data.data);
            setWorkflows(response.data.data.recentWorkflows || []);
        } catch (error) {
            console.error('Failed to fetch buddy dashboard:', error);
            toast.error('Failed to load buddy dashboard');
        } finally {
            setLoading(false);
        }
    }, [employeeId]);

    const fetchWorkflows = useCallback(async () => {
        if (!employeeId) return;
        try {
            const response = await axios.get('/api/v1/both/lifecycle/buddy/workflows');
            setWorkflows(response.data.data);
        } catch (error) {
            console.error('Failed to fetch buddy workflows:', error);
        }
    }, [employeeId]);

    const fetchWorkflowDetail = useCallback(async (workflowId) => {
        try {
            const response = await axios.get(`/api/v1/both/lifecycle/buddy/workflows/${workflowId}`);
            setSelectedWorkflow(response.data.data);
        } catch (error) {
            console.error('Failed to fetch workflow detail:', error);
            toast.error('Failed to load workflow details');
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
        fetchWorkflows();
    }, [fetchDashboard, fetchWorkflows]);

    const handleCompleteTask = async (taskId, completionNotes, rating, meetingDate) => {
        if (!selectedWorkflow) return;
        try {
            await axios.post(
                `/api/v1/both/lifecycle/buddy/workflows/${selectedWorkflow.workflow._id}/tasks/${taskId}/complete`,
                { completionNotes, rating, meetingScheduledDate: meetingDate }
            );
            toast.success('Task completed successfully');
            setShowTaskModal(false);
            fetchWorkflowDetail(selectedWorkflow.workflow._id);
            fetchDashboard();
        } catch (error) {
            console.error('Failed to complete task:', error);
            toast.error(error.response?.data?.message || 'Failed to complete task');
        }
    };

    const handleAddCheckin = async (notes, meetingDate, topicsDiscussed, concerns) => {
        if (!selectedWorkflow) return;
        try {
            await axios.post(
                `/api/v1/both/lifecycle/buddy/workflows/${selectedWorkflow.workflow._id}/checkin`,
                { notes, meetingDate, topicsDiscussed, concerns }
            );
            toast.success('Check-in added successfully');
            setShowCheckinModal(false);
            fetchWorkflowDetail(selectedWorkflow.workflow._id);
        } catch (error) {
            console.error('Failed to add check-in:', error);
            toast.error(error.response?.data?.message || 'Failed to add check-in');
        }
    };

    const handleMarkInductionComplete = async (feedback, rating, suggestions) => {
        if (!selectedWorkflow) return;
        try {
            await axios.post(
                `/api/v1/both/lifecycle/buddy/workflows/${selectedWorkflow.workflow._id}/induction/complete`,
                { feedback, rating, suggestions }
            );
            toast.success('Induction marked as complete');
            setShowFeedbackModal(false);
            fetchWorkflowDetail(selectedWorkflow.workflow._id);
        } catch (error) {
            console.error('Failed to mark induction complete:', error);
            toast.error(error.response?.data?.message || 'Failed to mark induction complete');
        }
    };

    const handleUploadDocument = async (documentType, fileName, fileUrl, notes) => {
        if (!selectedWorkflow) return;
        try {
            await axios.post(
                `/api/v1/both/lifecycle/buddy/workflows/${selectedWorkflow.workflow._id}/documents`,
                { documentType, fileName, fileUrl, notes }
            );
            toast.success('Document uploaded successfully');
            setShowDocumentModal(false);
            fetchWorkflowDetail(selectedWorkflow.workflow._id);
        } catch (error) {
            console.error('Failed to upload document:', error);
            toast.error(error.response?.data?.message || 'Failed to upload document');
        }
    };

    const handleWorkflowClick = (workflow) => {
        setSelectedWorkflow(null);
        fetchWorkflowDetail(workflow._id);
        setSearchParams({ id: workflow._id }, { replace: true });
    };

    const handleBackToDashboard = () => {
        setSelectedWorkflow(null);
        setSearchParams({}, { replace: true });
    };

    const filteredWorkflows = workflows.filter((wf) => {
        const matchesSearch = !searchTerm || 
            wf.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            wf.employeeId?.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || wf.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <LoadingSpinner />
            </div>
        );
    }

    if (selectedWorkflow) {
        return (
            <div className="p-6 max-w-7xl mx-auto">
                <div className="mb-6">
                    <button
                        onClick={handleBackToDashboard}
                        className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <FaArrowLeft className="mr-2" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-gray-800">
                        {selectedWorkflow.workflow.employeeId?.name}'s Onboarding
                    </h1>
                    <p className="text-gray-600 mt-1">
                        {selectedWorkflow.workflow.employeeId?.department} • {selectedWorkflow.workflow.employeeId?.jobTitle}
                    </p>
                </div>

                <BuddyWorkflowDetail
                    workflow={selectedWorkflow.workflow}
                    buddyTasks={selectedWorkflow.buddyTasks}
                    isAssignedBuddy={selectedWorkflow.isAssignedBuddy}
                    onCompleteTask={handleCompleteTask}
                    onAddCheckin={handleAddCheckin}
                    onMarkInductionComplete={handleMarkInductionComplete}
                    onUploadDocument={handleUploadDocument}
                    onShowTaskModal={() => setShowTaskModal(true)}
                    onShowCheckinModal={() => setShowCheckinModal(true)}
                    onShowFeedbackModal={() => setShowFeedbackModal(true)}
                    onShowDocumentModal={() => setShowDocumentModal(true)}
                />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <FaUserFriends className="mr-3 text-blue-600" />
                    Buddy Dashboard
                </h1>
                <p className="text-gray-600 mt-2">Manage your buddy assignments and help new hires succeed</p>
            </div>

            {/* Dashboard Stats */}
            {dashboard && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        icon={FaUserFriends}
                        label="Total Assignments"
                        value={dashboard.total}
                        color="blue"
                    />
                    <StatCard
                        icon={FaClock}
                        label="Active Onboarding"
                        value={dashboard.active}
                        color="green"
                    />
                    <StatCard
                        icon={FaTasks}
                        label="Tasks Completed"
                        value={`${dashboard.taskCompletionRate}%`}
                        color="purple"
                    />
                    <StatCard
                        icon={FaCheckCircle}
                        label="Completed Onboarding"
                        value={dashboard.completed}
                        color="emerald"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or department..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="all">All Status</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Scheduled">Scheduled</option>
                    </select>
                </div>
            </div>

            {/* Workflows List */}
            <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">Assigned New Hires</h2>
                </div>
                {filteredWorkflows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FaUserFriends className="mx-auto mb-4 text-4xl text-gray-300" />
                        <p>No buddy assignments found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {filteredWorkflows.map((workflow) => (
                            <WorkflowCard
                                key={workflow._id}
                                workflow={workflow}
                                onClick={() => handleWorkflowClick(workflow)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showTaskModal && (
                <CompleteTaskModal
                    onClose={() => setShowTaskModal(false)}
                    onComplete={handleCompleteTask}
                />
            )}
            {showCheckinModal && (
                <AddCheckinModal
                    onClose={() => setShowCheckinModal(false)}
                    onSubmit={handleAddCheckin}
                />
            )}
            {showFeedbackModal && (
                <InductionFeedbackModal
                    onClose={() => setShowFeedbackModal(false)}
                    onSubmit={handleMarkInductionComplete}
                />
            )}
            {showDocumentModal && (
                <UploadDocumentModal
                    onClose={() => setShowDocumentModal(false)}
                    onUpload={handleUploadDocument}
                />
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color }) => {
    const colorClasses = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        purple: 'bg-purple-500',
        emerald: 'bg-emerald-500',
    };

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-600 text-sm">{label}</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-full ${colorClasses[color]} text-white`}>
                    <Icon className="text-xl" />
                </div>
            </div>
        </div>
    );
};

const WorkflowCard = ({ workflow, onClick }) => {
    const statusColors = {
        'In Progress': 'bg-blue-100 text-blue-800',
        'Completed': 'bg-green-100 text-green-800',
        'Scheduled': 'bg-yellow-100 text-yellow-800',
        'Not Started': 'bg-gray-100 text-gray-800',
    };

    return (
        <div
            onClick={onClick}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <FaUserFriends className="text-blue-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">
                            {workflow.employeeId?.name} {workflow.employeeId?.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">
                            {workflow.employeeId?.department} • {workflow.employeeId?.jobTitle}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            Joined: {workflow.joiningDate ? format(new Date(workflow.joiningDate), 'MMM dd, yyyy') : 'Not set'}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[workflow.status] || 'bg-gray-100 text-gray-800'}`}>
                        {workflow.status}
                    </span>
                    <p className="text-sm text-gray-600 mt-2">{workflow.progress}% complete</p>
                </div>
            </div>
        </div>
    );
};

const BuddyWorkflowDetail = ({
    workflow,
    buddyTasks,
    isAssignedBuddy,
    onCompleteTask,
    onAddCheckin,
    onMarkInductionComplete,
    onUploadDocument,
    onShowTaskModal,
    onShowCheckinModal,
    onShowFeedbackModal,
    onShowDocumentModal,
}) => {
    const [selectedTask, setSelectedTask] = useState(null);

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        onShowTaskModal();
    };

    return (
        <div className="space-y-6">
            {/* Progress Overview */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Onboarding Progress</h2>
                <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                        className="bg-blue-600 h-4 rounded-full transition-all"
                        style={{ width: `${workflow.progress}%` }}
                    />
                </div>
                <p className="text-sm text-gray-600 mt-2">{workflow.progress}% Complete</p>
            </div>

            {/* Buddy Tasks */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Buddy Tasks</h2>
                    {isAssignedBuddy && (
                        <button
                            onClick={onShowCheckinModal}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <FaPlus className="mr-2" />
                            Add Check-in
                        </button>
                    )}
                </div>
                {buddyTasks.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No buddy tasks assigned</p>
                ) : (
                    <div className="space-y-3">
                        {buddyTasks.map((task) => (
                            <TaskItem
                                key={task._id || task.taskType}
                                task={task}
                                onClick={() => handleTaskClick(task)}
                                isAssignedBuddy={isAssignedBuddy}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Induction Status */}
            <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Induction Status</h2>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-gray-600">
                            Status: <span className="font-medium">{workflow.induction?.status || 'Not Started'}</span>
                        </p>
                        {workflow.induction?.buddyCompletion?.completedAt && (
                            <p className="text-sm text-gray-500 mt-1">
                                Buddy completed: {format(new Date(workflow.induction.buddyCompletion.completedAt), 'MMM dd, yyyy')}
                            </p>
                        )}
                    </div>
                    {isAssignedBuddy && workflow.induction?.status !== 'Completed' && (
                        <button
                            onClick={onShowFeedbackModal}
                            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            <FaCheckCircle className="mr-2" />
                            Mark Complete
                        </button>
                    )}
                </div>
            </div>

            {/* Buddy Documents */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-800">Documents</h2>
                    {isAssignedBuddy && (
                        <button
                            onClick={onShowDocumentModal}
                            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                            <FaFileUpload className="mr-2" />
                            Upload Document
                        </button>
                    )}
                </div>
                {workflow.buddyDocuments?.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No documents uploaded</p>
                ) : (
                    <div className="space-y-2">
                        {workflow.buddyDocuments.map((doc, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-800">{doc.fileName}</p>
                                    <p className="text-sm text-gray-600">{doc.documentType}</p>
                                </div>
                                <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    <FaEye />
                                </a>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Buddy Check-ins */}
            {workflow.buddyCheckins?.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Check-in History</h2>
                    <div className="space-y-3">
                        {workflow.buddyCheckins.map((checkin, index) => (
                            <div key={index} className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium text-gray-800">
                                        {checkin.buddyName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {checkin.date ? format(new Date(checkin.date), 'MMM dd, yyyy') : 'No date'}
                                    </p>
                                </div>
                                <p className="text-gray-600 text-sm">{checkin.notes}</p>
                                {checkin.topicsDiscussed?.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500 mb-1">Topics discussed:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {checkin.topicsDiscussed.map((topic, i) => (
                                                <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const TaskItem = ({ task, onClick, isAssignedBuddy }) => {
    const statusColors = {
        'Pending': 'bg-yellow-100 text-yellow-800',
        'In Progress': 'bg-blue-100 text-blue-800',
        'Completed': 'bg-green-100 text-green-800',
        'Overdue': 'bg-red-100 text-red-800',
    };

    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed';

    return (
        <div
            onClick={isAssignedBuddy ? onClick : undefined}
            className={`p-4 border rounded-lg ${isAssignedBuddy ? 'hover:bg-gray-50 cursor-pointer' : ''} ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium text-gray-800">{task.title}</h3>
                    {task.description && (
                        <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                    )}
                    {task.dueDate && (
                        <p className="text-xs text-gray-500 mt-1">
                            Due: {format(new Date(task.dueDate), 'MMM dd, yyyy')}
                            {isOverdue && ' (Overdue)'}
                        </p>
                    )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[task.status] || 'bg-gray-100 text-gray-800'}`}>
                    {task.status}
                </span>
            </div>
        </div>
    );
};

// Modal Components (simplified versions)
const CompleteTaskModal = ({ onClose, onComplete }) => {
    const [notes, setNotes] = useState('');
    const [rating, setRating] = useState(0);
    const [meetingDate, setMeetingDate] = useState('');

    const handleSubmit = () => {
        onComplete(notes, rating, meetingDate);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Complete Task</h2>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add completion notes..."
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={3}
                />
                <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Complete</button>
                </div>
            </div>
        </div>
    );
};

const AddCheckinModal = ({ onClose, onSubmit }) => {
    const [notes, setNotes] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [topics, setTopics] = useState('');

    const handleSubmit = () => {
        onSubmit(notes, meetingDate, topics.split(',').map(t => t.trim()), '');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Add Check-in</h2>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Check-in notes..."
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={3}
                />
                <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <input
                    type="text"
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    placeholder="Topics discussed (comma-separated)"
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Add</button>
                </div>
            </div>
        </div>
    );
};

const InductionFeedbackModal = ({ onClose, onSubmit }) => {
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [suggestions, setSuggestions] = useState('');

    const handleSubmit = () => {
        onSubmit(feedback, rating, suggestions);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Induction Feedback</h2>
                <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Your feedback on the induction process..."
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={3}
                />
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Rating (1-5)</label>
                    <input
                        type="number"
                        min="1"
                        max="5"
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                        className="w-full p-2 border rounded-lg"
                    />
                </div>
                <textarea
                    value={suggestions}
                    onChange={(e) => setSuggestions(e.target.value)}
                    placeholder="Suggestions for improvement..."
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={2}
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-green-600 text-white rounded-lg">Submit</button>
                </div>
            </div>
        </div>
    );
};

const UploadDocumentModal = ({ onClose, onUpload }) => {
    const [documentType, setDocumentType] = useState('');
    const [fileName, setFileName] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = () => {
        onUpload(documentType, fileName, fileUrl, notes);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Upload Document</h2>
                <input
                    type="text"
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    placeholder="Document type"
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="File name"
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <input
                    type="text"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="File URL"
                    className="w-full p-2 border rounded-lg mb-4"
                />
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes..."
                    className="w-full p-2 border rounded-lg mb-4"
                    rows={2}
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Upload</button>
                </div>
            </div>
        </div>
    );
};

export default BuddyDashboard;
