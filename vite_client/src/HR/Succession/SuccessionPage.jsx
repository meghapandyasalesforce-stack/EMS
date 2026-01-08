import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaUserTie, FaChartLine, FaUsers, FaPlus, FaSpinner, FaSearch, 
    FaFilter, FaEdit, FaTrash, FaEye, FaCheckCircle, FaTimesCircle,
    FaExclamationTriangle, FaUserCheck
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { useEmployees } from '../../Hooks/useDashboardData';
import { format } from 'date-fns';

const SuccessionPage = () => {
    const navigate = useNavigate();
    const [successionPlans, setSuccessionPlans] = useState([]);
    const [talentPool, setTalentPool] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('plans');
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showAddTalentModal, setShowAddTalentModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [riskFilter, setRiskFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [potentialFilter, setPotentialFilter] = useState('all');
    const { data: employees = [] } = useEmployees();

    const [planFormData, setPlanFormData] = useState({
        positionName: '',
        department: '',
        positionId: '',
        currentIncumbent: '',
        riskLevel: 'Medium',
        criticality: 'Medium',
        status: 'Draft',
        successors: [],
        developmentActivities: []
    });

    const [talentFormData, setTalentFormData] = useState({
        employeeId: '',
        potentialLevel: 'Medium Potential',
        currentRole: '',
        strengths: [],
        developmentAreas: [],
        careerAspirations: '',
        performanceRating: 0
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'plans') {
                const response = await axios.get('/v1/admin/succession/succession-plans', { withCredentials: true });
                setSuccessionPlans(response.data?.data || []);
            } else {
                const response = await axios.get('/v1/admin/succession/talent-pool', { withCredentials: true });
                setTalentPool(response.data?.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePlan = async (e) => {
        e.preventDefault();
        
        if (!planFormData.positionName || !planFormData.department) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post('/v1/admin/succession/succession-plans', planFormData, { withCredentials: true });
            toast.success('Succession plan created successfully');
            setShowCreatePlanModal(false);
            resetPlanForm();
            fetchData();
        } catch (error) {
            console.error('Error creating plan:', error);
            toast.error(error.response?.data?.message || 'Failed to create succession plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddTalent = async (e) => {
        e.preventDefault();
        
        if (!talentFormData.employeeId) {
            toast.error('Please select an employee');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post('/v1/admin/succession/talent-pool', talentFormData, { withCredentials: true });
            toast.success('Added to talent pool successfully');
            setShowAddTalentModal(false);
            resetTalentForm();
            fetchData();
        } catch (error) {
            console.error('Error adding talent:', error);
            toast.error(error.response?.data?.message || 'Failed to add to talent pool');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this succession plan?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/succession/succession-plans/${planId}`, { withCredentials: true });
            toast.success('Succession plan deleted successfully');
            fetchData();
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast.error(error.response?.data?.message || 'Failed to delete succession plan');
        }
    };

    const handleDeleteTalent = async (talentId) => {
        if (!window.confirm('Are you sure you want to remove this employee from talent pool?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/succession/talent-pool/${talentId}`, { withCredentials: true });
            toast.success('Removed from talent pool successfully');
            fetchData();
        } catch (error) {
            console.error('Error deleting talent:', error);
            toast.error(error.response?.data?.message || 'Failed to remove from talent pool');
        }
    };

    const resetPlanForm = () => {
        setPlanFormData({
            positionName: '',
            department: '',
            positionId: '',
            currentIncumbent: '',
            riskLevel: 'Medium',
            criticality: 'Medium',
            status: 'Draft',
            successors: [],
            developmentActivities: []
        });
    };

    const resetTalentForm = () => {
        setTalentFormData({
            employeeId: '',
            potentialLevel: 'Medium Potential',
            currentRole: '',
            strengths: [],
            developmentAreas: [],
            careerAspirations: '',
            performanceRating: 0
        });
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
                return 'bg-green-100 text-green-800';
        }
    };

    const getPotentialColor = (potential) => {
        switch (potential) {
            case 'High Potential':
                return 'bg-blue-100 text-blue-800';
            case 'Medium Potential':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-green-100 text-green-800';
        }
    };

    // Filter plans
    const filteredPlans = successionPlans.filter(plan => {
        const matchesSearch = searchTerm === '' || 
            plan.positionName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesRisk = riskFilter === 'all' || plan.riskLevel === riskFilter;
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
        
        return matchesSearch && matchesRisk && matchesStatus;
    });

    // Filter talent pool
    const filteredTalent = talentPool.filter(talent => {
        const matchesSearch = searchTerm === '' || 
            talent.employeeId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            talent.employeeId?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesPotential = potentialFilter === 'all' || talent.potentialLevel === potentialFilter;
        
        return matchesSearch && matchesPotential;
    });

    if (loading) {
        return <LoadingSpinner message="Loading succession planning data..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Succession Planning</h1>
                        <p className="text-gray-600 mt-1">Plan for key positions and manage talent pool</p>
                    </div>
                    <div className="flex gap-2">
                        {activeTab === 'plans' ? (
                            <button
                                onClick={() => {
                                    resetPlanForm();
                                    setShowCreatePlanModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                            >
                                <FaPlus />
                                Create Plan
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    resetTalentForm();
                                    setShowAddTalentModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                            >
                                <FaPlus />
                                Add Talent
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-md mb-6">
                    <div className="flex border-b">
                        <button
                            onClick={() => {
                                setActiveTab('plans');
                                setSearchTerm('');
                                setRiskFilter('all');
                                setStatusFilter('all');
                            }}
                            className={`px-6 py-3 font-medium ${activeTab === 'plans' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaUserTie className="inline mr-2" />
                            Succession Plans ({successionPlans.length})
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('talent');
                                setSearchTerm('');
                                setPotentialFilter('all');
                            }}
                            className={`px-6 py-3 font-medium ${activeTab === 'talent' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaUsers className="inline mr-2" />
                            Talent Pool ({talentPool.length})
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'plans' ? 'Search by position or department...' : 'Search by employee name or email...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    {activeTab === 'plans' ? (
                        <>
                            <div className="relative">
                                <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <select
                                    value={riskFilter}
                                    onChange={(e) => setRiskFilter(e.target.value)}
                                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="all">All Risk Levels</option>
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Critical">Critical</option>
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="all">All Status</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Active">Active</option>
                                    <option value="On Hold">On Hold</option>
                                    <option value="Archived">Archived</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <div className="relative">
                            <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <select
                                value={potentialFilter}
                                onChange={(e) => setPotentialFilter(e.target.value)}
                                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                            >
                                <option value="all">All Potential</option>
                                <option value="High Potential">High Potential</option>
                                <option value="Medium Potential">Medium Potential</option>
                                <option value="Emerging Talent">Emerging Talent</option>
                            </select>
                        </div>
                    )}
                </div>

                {activeTab === 'plans' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPlans.map((plan) => (
                            <div key={plan._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-1">{plan.positionName}</h3>
                                        <p className="text-sm text-gray-600">{plan.department}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(plan.riskLevel)}`}>
                                        {plan.riskLevel}
                                    </span>
                                </div>
                                
                                {plan.currentIncumbent && (
                                    <div className="mb-3 text-sm">
                                        <span className="text-gray-600">Current:</span>
                                        <span className="ml-2 font-medium">{plan.currentIncumbent.name || plan.currentIncumbent}</span>
                                    </div>
                                )}

                                <div className="mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                                        <FaUsers className="text-blue-500" />
                                        <span>Successors: {plan.successors?.length || 0}</span>
                                    </div>
                                    {plan.developmentActivities && plan.developmentActivities.length > 0 && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <FaCheckCircle className="text-green-500" />
                                            <span>Activities: {plan.developmentActivities.filter(a => a.status === 'Completed').length}/{plan.developmentActivities.length}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                        plan.status === 'Active' ? 'bg-green-100 text-green-800' :
                                        plan.status === 'Draft' ? 'bg-gray-100 text-gray-800' :
                                        plan.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {plan.status}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate(`/succession/${plan._id}`)}
                                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition"
                                        >
                                            <FaEye />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePlan(plan._id)}
                                            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredPlans.length === 0 && (
                            <div className="col-span-3 text-center py-12">
                                <FaUserTie className="mx-auto text-gray-400 text-5xl mb-4" />
                                <p className="text-gray-500">
                                    {successionPlans.length === 0 
                                        ? 'No succession plans created yet.' 
                                        : 'No plans match your filters.'}
                                </p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Potential</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredTalent.map((talent) => (
                                    <tr key={talent._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {talent.employeeId?.name || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {talent.employeeId?.email || ''}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPotentialColor(talent.potentialLevel)}`}>
                                                {talent.potentialLevel}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {talent.currentRole?.name || talent.employeeId?.position || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {talent.performanceRating ? (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-medium">{talent.performanceRating}</span>
                                                    <span className="text-gray-400">/5</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleDeleteTalent(talent._id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTalent.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                            <FaUsers className="mx-auto text-4xl mb-2 text-gray-400" />
                                            <p>
                                                {talentPool.length === 0 
                                                    ? 'No employees in talent pool yet.' 
                                                    : 'No employees match your filters.'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Plan Modal */}
            {showCreatePlanModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">Create Succession Plan</h3>
                        <form onSubmit={handleCreatePlan} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Position Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={planFormData.positionName}
                                        onChange={(e) => setPlanFormData({ ...planFormData, positionName: e.target.value })}
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
                                        value={planFormData.department}
                                        onChange={(e) => setPlanFormData({ ...planFormData, department: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Current Incumbent</label>
                                <select
                                    value={planFormData.currentIncumbent}
                                    onChange={(e) => setPlanFormData({ ...planFormData, currentIncumbent: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp._id || emp.id} value={emp._id || emp.id}>
                                            {emp.name} {emp.lastName || ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level</label>
                                    <select
                                        value={planFormData.riskLevel}
                                        onChange={(e) => setPlanFormData({ ...planFormData, riskLevel: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
                                    <select
                                        value={planFormData.criticality}
                                        onChange={(e) => setPlanFormData({ ...planFormData, criticality: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select
                                        value={planFormData.status}
                                        onChange={(e) => setPlanFormData({ ...planFormData, status: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Draft">Draft</option>
                                        <option value="Active">Active</option>
                                        <option value="On Hold">On Hold</option>
                                        <option value="Archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreatePlanModal(false);
                                        resetPlanForm();
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
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Plan'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Talent Modal */}
            {showAddTalentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h3 className="text-xl font-semibold mb-4">Add to Talent Pool</h3>
                        <form onSubmit={handleAddTalent} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={talentFormData.employeeId}
                                    onChange={(e) => setTalentFormData({ ...talentFormData, employeeId: e.target.value })}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Potential Level</label>
                                    <select
                                        value={talentFormData.potentialLevel}
                                        onChange={(e) => setTalentFormData({ ...talentFormData, potentialLevel: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="High Potential">High Potential</option>
                                        <option value="Medium Potential">Medium Potential</option>
                                        <option value="Emerging Talent">Emerging Talent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Performance Rating</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="5"
                                        step="0.1"
                                        value={talentFormData.performanceRating}
                                        onChange={(e) => setTalentFormData({ ...talentFormData, performanceRating: parseFloat(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Career Aspirations</label>
                                <textarea
                                    value={talentFormData.careerAspirations}
                                    onChange={(e) => setTalentFormData({ ...talentFormData, careerAspirations: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                    placeholder="Employee's career goals and aspirations..."
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAddTalentModal(false);
                                        resetTalentForm();
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        'Add Talent'
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

export default SuccessionPage;
