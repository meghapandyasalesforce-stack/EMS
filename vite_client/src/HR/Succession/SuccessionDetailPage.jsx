import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, FaUserTie, FaUsers, FaCheckCircle, FaClock, FaSpinner,
    FaExclamationTriangle, FaPlus, FaTrash, FaEdit
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { useEmployees } from '../../Hooks/useDashboardData';

const SuccessionDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddSuccessorModal, setShowAddSuccessorModal] = useState(false);
    const [showAddActivityModal, setShowAddActivityModal] = useState(false);
    const { data: employeeData = { employees: [], total: 0 } } = useEmployees();
    const employees = employeeData?.employees ?? [];

    const [successorForm, setSuccessorForm] = useState({
        employeeId: '',
        readinessLevel: 'Ready in 1-2 Years',
        strengths: [],
        gaps: [],
        notes: ''
    });

    const [activityForm, setActivityForm] = useState({
        activity: '',
        assignedTo: '',
        dueDate: '',
        status: 'Not Started'
    });

    useEffect(() => {
        fetchPlan();
    }, [id]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/succession/succession-plans/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setPlan(response.data.data);
            } else {
                toast.error('Succession plan not found');
                navigate('/succession');
            }
        } catch (error) {
            toast.error('Failed to load succession plan');
            navigate('/succession');
        } finally {
            setLoading(false);
        }
    };

    const addSuccessor = async (e) => {
        e.preventDefault();
        
        if (!successorForm.employeeId) {
            toast.error('Please select an employee');
            return;
        }

        try {
            setSubmitting(true);
            const updatedSuccessors = [
                ...(plan.successors || []),
                {
                    ...successorForm,
                    strengths: successorForm.strengths.filter(s => s.trim()),
                    gaps: successorForm.gaps.filter(g => g.trim())
                }
            ];
            
            await axios.put(
                `/v1/admin/succession/succession-plans/${id}`,
                { successors: updatedSuccessors },
                { withCredentials: true }
            );
            
            toast.success('Successor added successfully');
            setShowAddSuccessorModal(false);
            setSuccessorForm({
                employeeId: '',
                readinessLevel: 'Ready in 1-2 Years',
                strengths: [],
                gaps: [],
                notes: ''
            });
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add successor');
        } finally {
            setSubmitting(false);
        }
    };

    const addActivity = async (e) => {
        e.preventDefault();
        
        if (!activityForm.activity || !activityForm.assignedTo) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const updatedActivities = [
                ...(plan.developmentActivities || []),
                activityForm
            ];
            
            await axios.put(
                `/v1/admin/succession/succession-plans/${id}`,
                { developmentActivities: updatedActivities },
                { withCredentials: true }
            );
            
            toast.success('Development activity added successfully');
            setShowAddActivityModal(false);
            setActivityForm({
                activity: '',
                assignedTo: '',
                dueDate: '',
                status: 'Not Started'
            });
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add activity');
        } finally {
            setSubmitting(false);
        }
    };

    const updateActivityStatus = async (activityIndex, status) => {
        try {
            const updatedActivities = [...plan.developmentActivities];
            updatedActivities[activityIndex].status = status;
            
            await axios.put(
                `/v1/admin/succession/succession-plans/${id}`,
                { developmentActivities: updatedActivities },
                { withCredentials: true }
            );
            
            toast.success('Activity status updated');
            fetchPlan();
        } catch (error) {
            toast.error('Failed to update activity');
        }
    };

    const getRiskColor = (risk) => {
        switch (risk) {
            case 'Critical':
                return 'bg-red-100 text-red-800';
            case 'High':
                return 'bg-orange-100 text-orange-800';
            case 'Medium':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-theme-primary/10 text-theme-primary';
        }
    };

    const getReadinessColor = (readiness) => {
        if (readiness === 'Ready Now') return 'bg-theme-primary/10 text-theme-primary';
        if (readiness.includes('1-2')) return 'bg-theme-secondary/10 text-theme-secondary';
        if (readiness.includes('3-5')) return 'bg-yellow-100 text-yellow-800';
        return 'bg-gray-100 text-gray-800';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed':
                return 'bg-theme-primary/10 text-theme-primary';
            case 'In Progress':
                return 'bg-theme-secondary/10 text-theme-secondary';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading succession plan..." />;
    }

    if (!plan) {
        return null;
    }

    return (
        <div className="page-shell min-h-screen bg-transparent transition-all duration-300">
            <div className="page-shell-inner hrms-stack">
                {/* Header */}
                <div>
                    <button
                        onClick={() => navigate('/succession')}
                        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800"
                    >
                        <FaArrowLeft /> Back to Succession Planning
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{plan.positionName}</h1>
                            <p className="text-gray-600">{plan.department}</p>
                        </div>
                        <div className="flex gap-2">
                            <span className={`px-4 py-2 rounded-full text-sm font-medium ${getRiskColor(plan.riskLevel)}`}>
                                {plan.riskLevel} Risk
                            </span>
                            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                                plan.status === 'Active' ? 'bg-theme-primary/10 text-theme-primary' :
                                plan.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                                'bg-yellow-100 text-yellow-800'
                            }`}>
                                {plan.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="hrms-main-rail">
                    {/* Main Content */}
                    <div className="min-w-0 space-y-6">
                        {/* Current Incumbent */}
                        {plan.currentIncumbent && (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold mb-4">Current Incumbent</h2>
                                <div className="flex items-center gap-4">
                                    <div className="bg-theme-secondary/10 p-3 rounded-lg">
                                        <FaUserTie className="w-6 h-6 text-theme-secondary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">
                                            {plan.currentIncumbent.name || plan.currentIncumbent}
                                        </h3>
                                        {plan.currentIncumbent.email && (
                                            <p className="text-sm text-gray-600">{plan.currentIncumbent.email}</p>
                                        )}
                                        {plan.currentIncumbent.department && (
                                            <p className="text-sm text-gray-600">{plan.currentIncumbent.department}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Successors */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Successors ({plan.successors?.length || 0})</h2>
                                <button
                                    onClick={() => setShowAddSuccessorModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition text-sm"
                                >
                                    <FaPlus /> Add Successor
                                </button>
                            </div>
                            
                            {plan.successors && plan.successors.length > 0 ? (
                                <div className="space-y-4">
                                    {plan.successors.map((successor, index) => (
                                        <div key={index} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800">
                                                        {successor.employeeId?.name || 'Employee'}
                                                    </h3>
                                                    {successor.employeeId?.email && (
                                                        <p className="text-sm text-gray-600">{successor.employeeId.email}</p>
                                                    )}
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReadinessColor(successor.readinessLevel)}`}>
                                                    {successor.readinessLevel}
                                                </span>
                                            </div>
                                            
                                            {successor.strengths && successor.strengths.length > 0 && (
                                                <div className="mb-2">
                                                    <span className="text-xs font-medium text-gray-600">Strengths: </span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {successor.strengths.map((strength, idx) => (
                                                            <span key={idx} className="px-2 py-1 bg-theme-primary/10 text-theme-primary rounded text-xs">
                                                                {strength}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {successor.gaps && successor.gaps.length > 0 && (
                                                <div className="mb-2">
                                                    <span className="text-xs font-medium text-gray-600">Gaps: </span>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {successor.gaps.map((gap, idx) => (
                                                            <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                                                {gap}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {successor.notes && (
                                                <p className="text-sm text-gray-600 mt-2">{successor.notes}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FaUsers className="mx-auto text-4xl mb-2 text-gray-400" />
                                    <p>No successors identified yet</p>
                                </div>
                            )}
                        </div>

                        {/* Development Activities */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">
                                    Development Activities ({plan.developmentActivities?.length || 0})
                                </h2>
                                <button
                                    onClick={() => setShowAddActivityModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition text-sm"
                                >
                                    <FaPlus /> Add Activity
                                </button>
                            </div>
                            
                            {plan.developmentActivities && plan.developmentActivities.length > 0 ? (
                                <div className="space-y-3">
                                    {plan.developmentActivities.map((activity, index) => (
                                        <div key={index} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-800">{activity.activity}</h3>
                                                    {activity.assignedTo && (
                                                        <p className="text-sm text-gray-600 mt-1">
                                                            Assigned to: {employees.find(e => (e._id || e.id) === activity.assignedTo)?.name || 'N/A'}
                                                        </p>
                                                    )}
                                                    {activity.dueDate && (
                                                        <p className="text-sm text-gray-600">
                                                            Due: {format(new Date(activity.dueDate), 'MMM dd, yyyy')}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                                                    {activity.status}
                                                </span>
                                            </div>
                                            
                                            {activity.status !== 'Completed' && (
                                                <div className="mt-3 flex gap-2">
                                                    {activity.status === 'Not Started' && (
                                                        <button
                                                            onClick={() => updateActivityStatus(index, 'In Progress')}
                                                            className="px-3 py-1 bg-theme-secondary text-white rounded text-sm hover:bg-theme-primary transition"
                                                        >
                                                            Start
                                                        </button>
                                                    )}
                                                    {activity.status === 'In Progress' && (
                                                        <button
                                                            onClick={() => updateActivityStatus(index, 'Completed')}
                                                            className="px-3 py-1 bg-theme-primary text-white rounded text-sm hover:bg-theme-primary transition flex items-center gap-1"
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
                                    <FaCheckCircle className="mx-auto text-4xl mb-2 text-gray-400" />
                                    <p>No development activities yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="min-w-0 space-y-6">
                        {/* Plan Info */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4">Plan Information</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-500">Criticality:</span>
                                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getRiskColor(plan.criticality)}`}>
                                        {plan.criticality}
                                    </span>
                                </div>
                                {plan.lastReviewDate && (
                                    <div>
                                        <span className="text-gray-500">Last Review:</span>
                                        <span className="ml-2 font-medium">
                                            {format(new Date(plan.lastReviewDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                )}
                                {plan.nextReviewDate && (
                                    <div>
                                        <span className="text-gray-500">Next Review:</span>
                                        <span className="ml-2 font-medium">
                                            {format(new Date(plan.nextReviewDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Risk Assessment */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FaExclamationTriangle className="text-orange-500" />
                                Risk Assessment
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Risk Level:</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(plan.riskLevel)}`}>
                                        {plan.riskLevel}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Successors:</span>
                                    <span className="font-medium">{plan.successors?.length || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Activities:</span>
                                    <span className="font-medium">
                                        {plan.developmentActivities?.filter(a => a.status === 'Completed').length || 0}/
                                        {plan.developmentActivities?.length || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Successor Modal */}
            {showAddSuccessorModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">Add Successor</h3>
                        <form onSubmit={addSuccessor} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={successorForm.employeeId}
                                    onChange={(e) => setSuccessorForm({ ...successorForm, employeeId: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName || ''} ({emp.email})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Readiness Level</label>
                                <select
                                    value={successorForm.readinessLevel}
                                    onChange={(e) => setSuccessorForm({ ...successorForm, readinessLevel: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="Ready Now">Ready Now</option>
                                    <option value="Ready in 1-2 Years">Ready in 1-2 Years</option>
                                    <option value="Ready in 3-5 Years">Ready in 3-5 Years</option>
                                    <option value="Long-term Potential">Long-term Potential</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Strengths (comma-separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Leadership, Technical Skills, Communication"
                                    onChange={(e) => setSuccessorForm({
                                        ...successorForm,
                                        strengths: e.target.value.split(',').map(s => s.trim())
                                    })}
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Gaps (comma-separated)</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Experience, Training, Certification"
                                    onChange={(e) => setSuccessorForm({
                                        ...successorForm,
                                        gaps: e.target.value.split(',').map(g => g.trim())
                                    })}
                                    className="w-full p-3 border rounded-lg"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    value={successorForm.notes}
                                    onChange={(e) => setSuccessorForm({ ...successorForm, notes: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddSuccessorModal(false);
                                        setSuccessorForm({
                                            employeeId: '',
                                            readinessLevel: 'Ready in 1-2 Years',
                                            strengths: [],
                                            gaps: [],
                                            notes: ''
                                        });
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
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Successor'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Activity Modal */}
            {showAddActivityModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">Add Development Activity</h3>
                        <form onSubmit={addActivity} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Activity <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={activityForm.activity}
                                    onChange={(e) => setActivityForm({ ...activityForm, activity: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Assigned To <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={activityForm.assignedTo}
                                        onChange={(e) => setActivityForm({ ...activityForm, assignedTo: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    >
                                        <option value="">Select Employee</option>
                                        {employees.map((emp) => (
                                            <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                                {emp.name} {emp.lastName || ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={activityForm.dueDate}
                                        onChange={(e) => setActivityForm({ ...activityForm, dueDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddActivityModal(false);
                                        setActivityForm({
                                            activity: '',
                                            assignedTo: '',
                                            dueDate: '',
                                            status: 'Not Started'
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Activity'
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

export default SuccessionDetailPage;

