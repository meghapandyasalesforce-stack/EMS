import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, FaChartLine, FaUsers, FaDollarSign, FaCalendar,
    FaCheckCircle, FaExclamationTriangle, FaPlus, FaTrash, FaSpinner
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const WorkforceDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showAddHiringModal, setShowAddHiringModal] = useState(false);
    const [showAddRiskModal, setShowAddRiskModal] = useState(false);

    const [hiringForm, setHiringForm] = useState({
        position: '',
        department: '',
        jobTitle: '',
        numberOfPositions: 1,
        priority: 'Medium',
        expectedStartDate: '',
        budget: 0,
        status: 'Planned'
    });

    const [riskForm, setRiskForm] = useState({
        risk: '',
        impact: 'Medium',
        mitigation: ''
    });

    useEffect(() => {
        fetchPlan();
    }, [id]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/workforce/workforce-plans/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setPlan(response.data.data);
            } else {
                toast.error('Workforce plan not found');
                navigate('/workforce');
            }
        } catch (error) {
            toast.error('Failed to load workforce plan');
            navigate('/workforce');
        } finally {
            setLoading(false);
        }
    };

    const addHiringPosition = async (e) => {
        e.preventDefault();
        
        if (!hiringForm.position || !hiringForm.department) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const updatedHiringPlan = [
                ...(plan.hiringPlan || []),
                hiringForm
            ];
            
            await axios.put(
                `/v1/admin/workforce/workforce-plans/${id}`,
                { hiringPlan: updatedHiringPlan },
                { withCredentials: true }
            );
            
            toast.success('Hiring position added successfully');
            setShowAddHiringModal(false);
            setHiringForm({
                position: '',
                department: '',
                jobTitle: '',
                numberOfPositions: 1,
                priority: 'Medium',
                expectedStartDate: '',
                budget: 0,
                status: 'Planned'
            });
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add hiring position');
        } finally {
            setSubmitting(false);
        }
    };

    const addRisk = async (e) => {
        e.preventDefault();
        
        if (!riskForm.risk || !riskForm.mitigation) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const updatedRisks = [
                ...(plan.risks || []),
                riskForm
            ];
            
            await axios.put(
                `/v1/admin/workforce/workforce-plans/${id}`,
                { risks: updatedRisks },
                { withCredentials: true }
            );
            
            toast.success('Risk added successfully');
            setShowAddRiskModal(false);
            setRiskForm({
                risk: '',
                impact: 'Medium',
                mitigation: ''
            });
            fetchPlan();
        } catch (error) {
            toast.error('Failed to add risk');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved':
            case 'Filled':
                return 'bg-green-100 text-green-800';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Planned':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Critical':
                return 'bg-red-100 text-red-800';
            case 'High':
                return 'bg-orange-100 text-orange-800';
            case 'Medium':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-green-100 text-green-800';
        }
    };

    const getImpactColor = (impact) => {
        switch (impact) {
            case 'High':
                return 'bg-red-100 text-red-800';
            case 'Medium':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-green-100 text-green-800';
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading workforce plan..." />;
    }

    if (!plan) {
        return null;
    }

    const gap = plan.targetHeadcount - plan.currentHeadcount;
    const gapPercent = plan.currentHeadcount > 0 
        ? Math.round((gap / plan.currentHeadcount) * 100) 
        : 0;
    const totalHiringBudget = plan.hiringPlan?.reduce((sum, h) => sum + (h.budget || 0), 0) || 0;
    const filledPositions = plan.hiringPlan?.filter(h => h.status === 'Filled').length || 0;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/workforce')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <FaArrowLeft /> Back to Workforce Planning
                    </button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{plan.planName}</h1>
                            <p className="text-gray-600">
                                {plan.planYear} Q{plan.quarter} {plan.department ? `• ${plan.department}` : ''}
                            </p>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(plan.status)}`}>
                            {plan.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Headcount Overview */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4">Headcount Overview</h2>
                            <div className="grid grid-cols-2 gap-6 mb-4">
                                <div className="bg-gray-50 p-4 rounded-lg text-center">
                                    <p className="text-sm text-gray-600 mb-1">Current</p>
                                    <p className="text-3xl font-bold text-gray-800">{plan.currentHeadcount}</p>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-lg text-center">
                                    <p className="text-sm text-gray-600 mb-1">Target</p>
                                    <p className="text-3xl font-bold text-blue-600">{plan.targetHeadcount}</p>
                                </div>
                            </div>
                            {gap !== 0 && (
                                <div className={`p-3 rounded text-center ${
                                    gap > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                    <span className="font-semibold">
                                        {gap > 0 ? '+' : ''}{gap} ({gapPercent > 0 ? '+' : ''}{gapPercent}%)
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Budget */}
                        {plan.budget && plan.budget.allocated > 0 && (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <FaDollarSign className="text-green-500" />
                                    Budget
                                </h2>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Allocated:</span>
                                        <span className="font-semibold">${plan.budget.allocated?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Spent:</span>
                                        <span className="font-semibold">${plan.budget.spent?.toLocaleString() || 0}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                        <div 
                                            className="bg-blue-600 h-3 rounded-full"
                                            style={{ width: `${plan.budget.allocated > 0 ? Math.min((plan.budget.spent / plan.budget.allocated) * 100, 100) : 0}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Remaining:</span>
                                        <span className="font-semibold text-green-600">
                                            ${plan.budget.remaining?.toLocaleString() || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Hiring Plan */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">
                                    Hiring Plan ({plan.hiringPlan?.length || 0})
                                </h2>
                                <button
                                    onClick={() => setShowAddHiringModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                                >
                                    <FaPlus /> Add Position
                                </button>
                            </div>
                            
                            {plan.hiringPlan && plan.hiringPlan.length > 0 ? (
                                <div className="space-y-4">
                                    {plan.hiringPlan.map((position, index) => (
                                        <div key={index} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800">{position.position}</h3>
                                                    <p className="text-sm text-gray-600">
                                                        {position.department} • {position.jobTitle || 'N/A'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(position.priority)}`}>
                                                        {position.priority}
                                                    </span>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(position.status)}`}>
                                                        {position.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                                                <div>
                                                    <span className="font-medium">Positions:</span> {position.numberOfPositions}
                                                </div>
                                                {position.expectedStartDate && (
                                                    <div>
                                                        <span className="font-medium">Start:</span> {format(new Date(position.expectedStartDate), 'MMM dd, yyyy')}
                                                    </div>
                                                )}
                                                {position.budget > 0 && (
                                                    <div>
                                                        <span className="font-medium">Budget:</span> ${position.budget.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Total Positions:</span>
                                            <span className="font-semibold">{plan.hiringPlan.reduce((sum, p) => sum + (p.numberOfPositions || 0), 0)}</span>
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span className="text-gray-600">Filled:</span>
                                            <span className="font-semibold">{filledPositions}</span>
                                        </div>
                                        {totalHiringBudget > 0 && (
                                            <div className="flex justify-between mt-1">
                                                <span className="text-gray-600">Total Budget:</span>
                                                <span className="font-semibold">${totalHiringBudget.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FaUsers className="mx-auto text-4xl mb-2 text-gray-400" />
                                    <p>No hiring positions planned yet</p>
                                </div>
                            )}
                        </div>

                        {/* Risks */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold flex items-center gap-2">
                                    <FaExclamationTriangle className="text-orange-500" />
                                    Risks ({plan.risks?.length || 0})
                                </h2>
                                <button
                                    onClick={() => setShowAddRiskModal(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition text-sm"
                                >
                                    <FaPlus /> Add Risk
                                </button>
                            </div>
                            
                            {plan.risks && plan.risks.length > 0 ? (
                                <div className="space-y-3">
                                    {plan.risks.map((risk, index) => (
                                        <div key={index} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-gray-800">{risk.risk}</h3>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getImpactColor(risk.impact)}`}>
                                                    {risk.impact} Impact
                                                </span>
                                            </div>
                                            {risk.mitigation && (
                                                <p className="text-sm text-gray-600 mt-2">
                                                    <span className="font-medium">Mitigation:</span> {risk.mitigation}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500">
                                    <FaExclamationTriangle className="mx-auto text-4xl mb-2 text-gray-400" />
                                    <p>No risks identified yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Plan Info */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4">Plan Information</h3>
                            <div className="space-y-3 text-sm">
                                <div>
                                    <span className="text-gray-500">Year:</span>
                                    <span className="ml-2 font-medium">{plan.planYear}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500">Quarter:</span>
                                    <span className="ml-2 font-medium">Q{plan.quarter}</span>
                                </div>
                                {plan.department && (
                                    <div>
                                        <span className="text-gray-500">Department:</span>
                                        <span className="ml-2 font-medium">{plan.department}</span>
                                    </div>
                                )}
                                {plan.createdBy && (
                                    <div>
                                        <span className="text-gray-500">Created By:</span>
                                        <span className="ml-2 font-medium">{plan.createdBy.name || 'N/A'}</span>
                                    </div>
                                )}
                                {plan.approvedBy && (
                                    <div>
                                        <span className="text-gray-500">Approved By:</span>
                                        <span className="ml-2 font-medium">{plan.approvedBy.name || 'N/A'}</span>
                                    </div>
                                )}
                                {plan.approvedAt && (
                                    <div>
                                        <span className="text-gray-500">Approved At:</span>
                                        <span className="ml-2 font-medium">
                                            {format(new Date(plan.approvedAt), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Skills Required */}
                        {plan.skillsRequired && plan.skillsRequired.length > 0 && (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-4">Skills Required</h3>
                                <div className="space-y-3">
                                    {plan.skillsRequired.map((skill, index) => (
                                        <div key={index} className="border rounded-lg p-3">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="font-medium">{skill.skill}</span>
                                                {skill.gap !== undefined && (
                                                    <span className={`px-2 py-1 rounded text-xs ${
                                                        skill.gap > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                    }`}>
                                                        Gap: {skill.gap}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                <div>Current: {skill.currentCount || 0}</div>
                                                <div>Required: {skill.requiredCount || 0}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Hiring Position Modal */}
            {showAddHiringModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h3 className="text-xl font-semibold mb-4">Add Hiring Position</h3>
                        <form onSubmit={addHiringPosition} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Position <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hiringForm.position}
                                        onChange={(e) => setHiringForm({ ...hiringForm, position: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Department <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={hiringForm.department}
                                        onChange={(e) => setHiringForm({ ...hiringForm, department: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                    <input
                                        type="text"
                                        value={hiringForm.jobTitle}
                                        onChange={(e) => setHiringForm({ ...hiringForm, jobTitle: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Positions</label>
                                    <input
                                        type="number"
                                        value={hiringForm.numberOfPositions}
                                        onChange={(e) => setHiringForm({ ...hiringForm, numberOfPositions: parseInt(e.target.value) || 1 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                    <select
                                        value={hiringForm.priority}
                                        onChange={(e) => setHiringForm({ ...hiringForm, priority: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Start Date</label>
                                    <input
                                        type="date"
                                        value={hiringForm.expectedStartDate}
                                        onChange={(e) => setHiringForm({ ...hiringForm, expectedStartDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Budget ($)</label>
                                    <input
                                        type="number"
                                        value={hiringForm.budget}
                                        onChange={(e) => setHiringForm({ ...hiringForm, budget: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddHiringModal(false);
                                        setHiringForm({
                                            position: '',
                                            department: '',
                                            jobTitle: '',
                                            numberOfPositions: 1,
                                            priority: 'Medium',
                                            expectedStartDate: '',
                                            budget: 0,
                                            status: 'Planned'
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
                                        'Add Position'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Risk Modal */}
            {showAddRiskModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h3 className="text-xl font-semibold mb-4">Add Risk</h3>
                        <form onSubmit={addRisk} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Risk Description <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={riskForm.risk}
                                    onChange={(e) => setRiskForm({ ...riskForm, risk: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
                                <select
                                    value={riskForm.impact}
                                    onChange={(e) => setRiskForm({ ...riskForm, impact: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mitigation Strategy <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={riskForm.mitigation}
                                    onChange={(e) => setRiskForm({ ...riskForm, mitigation: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="4"
                                    required
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddRiskModal(false);
                                        setRiskForm({
                                            risk: '',
                                            impact: 'Medium',
                                            mitigation: ''
                                        });
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Risk'
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

export default WorkforceDetailPage;

