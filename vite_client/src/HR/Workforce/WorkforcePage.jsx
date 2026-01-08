import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaChartLine, FaUsers, FaCalendar, FaPlus, FaSpinner, FaSearch, 
    FaFilter, FaEdit, FaTrash, FaEye, FaCheckCircle, FaDollarSign,
    FaExclamationTriangle
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const WorkforcePage = () => {
    const navigate = useNavigate();
    const [workforcePlans, setWorkforcePlans] = useState([]);
    const [forecasts, setForecasts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('plans');
    const [showCreatePlanModal, setShowCreatePlanModal] = useState(false);
    const [showCreateForecastModal, setShowCreateForecastModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');

    const [planFormData, setPlanFormData] = useState({
        planName: '',
        planYear: new Date().getFullYear(),
        quarter: 1,
        department: '',
        currentHeadcount: 0,
        targetHeadcount: 0,
        status: 'Draft',
        budget: {
            allocated: 0,
            spent: 0,
            remaining: 0
        },
        hiringPlan: [],
        skillsRequired: [],
        risks: []
    });

    const [forecastFormData, setForecastFormData] = useState({
        forecastDate: '',
        department: '',
        currentHeadcount: 0,
        projectedHeadcount: 0,
        newHires: 0,
        terminations: 0,
        transfers: 0,
        promotions: 0,
        confidenceLevel: 'Medium',
        factors: []
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        try {
            setLoading(true);
            if (activeTab === 'plans') {
                const response = await axios.get('/v1/admin/workforce/workforce-plans', { withCredentials: true });
                setWorkforcePlans(response.data?.data || []);
            } else {
                const response = await axios.get('/v1/admin/workforce/headcount-forecasts', { withCredentials: true });
                setForecasts(response.data?.data || []);
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
        
        if (!planFormData.planName || planFormData.currentHeadcount < 0 || planFormData.targetHeadcount < 0) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const data = {
                ...planFormData,
                budget: {
                    ...planFormData.budget,
                    remaining: planFormData.budget.allocated - planFormData.budget.spent
                }
            };
            await axios.post('/v1/admin/workforce/workforce-plans', data, { withCredentials: true });
            toast.success('Workforce plan created successfully');
            setShowCreatePlanModal(false);
            resetPlanForm();
            fetchData();
        } catch (error) {
            console.error('Error creating plan:', error);
            toast.error(error.response?.data?.message || 'Failed to create workforce plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateForecast = async (e) => {
        e.preventDefault();
        
        if (!forecastFormData.forecastDate || forecastFormData.currentHeadcount < 0) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            await axios.post('/v1/admin/workforce/headcount-forecasts', forecastFormData, { withCredentials: true });
            toast.success('Headcount forecast created successfully');
            setShowCreateForecastModal(false);
            resetForecastForm();
            fetchData();
        } catch (error) {
            console.error('Error creating forecast:', error);
            toast.error(error.response?.data?.message || 'Failed to create headcount forecast');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this workforce plan?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/workforce/workforce-plans/${planId}`, { withCredentials: true });
            toast.success('Workforce plan deleted successfully');
            fetchData();
        } catch (error) {
            console.error('Error deleting plan:', error);
            toast.error(error.response?.data?.message || 'Failed to delete workforce plan');
        }
    };

    const handleDeleteForecast = async (forecastId) => {
        if (!window.confirm('Are you sure you want to delete this forecast?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/workforce/headcount-forecasts/${forecastId}`, { withCredentials: true });
            toast.success('Forecast deleted successfully');
            fetchData();
        } catch (error) {
            console.error('Error deleting forecast:', error);
            toast.error(error.response?.data?.message || 'Failed to delete forecast');
        }
    };

    const resetPlanForm = () => {
        setPlanFormData({
            planName: '',
            planYear: new Date().getFullYear(),
            quarter: 1,
            department: '',
            currentHeadcount: 0,
            targetHeadcount: 0,
            status: 'Draft',
            budget: {
                allocated: 0,
                spent: 0,
                remaining: 0
            },
            hiringPlan: [],
            skillsRequired: [],
            risks: []
        });
    };

    const resetForecastForm = () => {
        setForecastFormData({
            forecastDate: '',
            department: '',
            currentHeadcount: 0,
            projectedHeadcount: 0,
            newHires: 0,
            terminations: 0,
            transfers: 0,
            promotions: 0,
            confidenceLevel: 'Medium',
            factors: []
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Approved':
                return 'bg-green-100 text-green-800';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Completed':
                return 'bg-purple-100 text-purple-800';
            case 'Draft':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Filter plans
    const filteredPlans = workforcePlans.filter(plan => {
        const matchesSearch = searchTerm === '' || 
            plan.planName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
        const matchesYear = yearFilter === 'all' || plan.planYear === parseInt(yearFilter);
        const matchesDept = departmentFilter === 'all' || plan.department === departmentFilter;
        
        return matchesSearch && matchesStatus && matchesYear && matchesDept;
    });

    // Filter forecasts
    const filteredForecasts = forecasts.filter(forecast => {
        const matchesSearch = searchTerm === '' || 
            forecast.department?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesDept = departmentFilter === 'all' || forecast.department === departmentFilter;
        
        return matchesSearch && matchesDept;
    });

    // Get unique departments and years for filters
    const departments = [...new Set([
        ...workforcePlans.map(p => p.department).filter(Boolean),
        ...forecasts.map(f => f.department).filter(Boolean)
    ])];
    const years = [...new Set(workforcePlans.map(p => p.planYear))].sort((a, b) => b - a);

    if (loading) {
        return <LoadingSpinner message="Loading workforce planning data..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Workforce Planning</h1>
                        <p className="text-gray-600 mt-1">Forecast and plan headcount</p>
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
                                    resetForecastForm();
                                    setShowCreateForecastModal(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                            >
                                <FaPlus />
                                Create Forecast
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
                                setStatusFilter('all');
                                setYearFilter('all');
                                setDepartmentFilter('all');
                            }}
                            className={`px-6 py-3 font-medium ${activeTab === 'plans' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaChartLine className="inline mr-2" />
                            Workforce Plans ({workforcePlans.length})
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('forecasts');
                                setSearchTerm('');
                                setDepartmentFilter('all');
                            }}
                            className={`px-6 py-3 font-medium ${activeTab === 'forecasts' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        >
                            <FaCalendar className="inline mr-2" />
                            Forecasts ({forecasts.length})
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={activeTab === 'plans' ? 'Search by plan name or department...' : 'Search by department...'}
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
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="all">All Status</option>
                                    <option value="Draft">Draft</option>
                                    <option value="Approved">Approved</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div className="relative">
                                <select
                                    value={yearFilter}
                                    onChange={(e) => setYearFilter(e.target.value)}
                                    className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                                >
                                    <option value="all">All Years</option>
                                    {years.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : null}
                    <div className="relative">
                        <select
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                        >
                            <option value="all">All Departments</option>
                            {departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {activeTab === 'plans' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPlans.map((plan) => {
                            const gap = plan.targetHeadcount - plan.currentHeadcount;
                            const gapPercent = plan.currentHeadcount > 0 
                                ? Math.round((gap / plan.currentHeadcount) * 100) 
                                : 0;

                            return (
                                <div key={plan._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-1">{plan.planName}</h3>
                                            <p className="text-sm text-gray-600">
                                                {plan.planYear} Q{plan.quarter} {plan.department ? `• ${plan.department}` : ''}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                                            {plan.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <p className="text-xs text-gray-600 mb-1">Current</p>
                                            <p className="text-2xl font-bold text-gray-800">{plan.currentHeadcount}</p>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-lg">
                                            <p className="text-xs text-gray-600 mb-1">Target</p>
                                            <p className="text-2xl font-bold text-blue-600">{plan.targetHeadcount}</p>
                                        </div>
                                    </div>

                                    {gap !== 0 && (
                                        <div className={`mb-4 p-2 rounded text-sm text-center ${
                                            gap > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {gap > 0 ? '+' : ''}{gap} ({gapPercent > 0 ? '+' : ''}{gapPercent}%)
                                        </div>
                                    )}

                                    {plan.budget && plan.budget.allocated > 0 && (
                                        <div className="mb-4 text-sm">
                                            <div className="flex justify-between text-gray-600 mb-1">
                                                <span>Budget:</span>
                                                <span className="font-medium">${plan.budget.allocated?.toLocaleString() || 0}</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div 
                                                    className="bg-blue-600 h-2 rounded-full"
                                                    style={{ width: `${plan.budget.allocated > 0 ? Math.min((plan.budget.spent / plan.budget.allocated) * 100, 100) : 0}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                ${plan.budget.spent?.toLocaleString() || 0} spent
                                            </div>
                                        </div>
                                    )}

                                    {plan.hiringPlan && plan.hiringPlan.length > 0 && (
                                        <div className="mb-4 text-sm text-gray-600">
                                            <FaUsers className="inline mr-1" />
                                            {plan.hiringPlan.length} position{plan.hiringPlan.length !== 1 ? 's' : ''} planned
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => navigate(`/workforce/${plan._id}`)}
                                            className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center justify-center gap-1"
                                        >
                                            <FaEye /> View
                                        </button>
                                        <button
                                            onClick={() => handleDeletePlan(plan._id)}
                                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredPlans.length === 0 && (
                            <div className="col-span-3 text-center py-12">
                                <FaChartLine className="mx-auto text-gray-400 text-5xl mb-4" />
                                <p className="text-gray-500">
                                    {workforcePlans.length === 0 
                                        ? 'No workforce plans created yet.' 
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Projected</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredForecasts.map((forecast) => {
                                    const change = forecast.projectedHeadcount - forecast.currentHeadcount;
                                    return (
                                        <tr key={forecast._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {forecast.forecastDate ? format(new Date(forecast.forecastDate), 'MMM dd, yyyy') : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">{forecast.department || 'All'}</td>
                                            <td className="px-6 py-4 font-medium">{forecast.currentHeadcount}</td>
                                            <td className="px-6 py-4 font-semibold text-blue-600">{forecast.projectedHeadcount}</td>
                                            <td className={`px-6 py-4 font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {change >= 0 ? '+' : ''}{change}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    forecast.confidenceLevel === 'High' ? 'bg-green-100 text-green-800' :
                                                    forecast.confidenceLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                                    'bg-red-100 text-red-800'
                                                }`}>
                                                    {forecast.confidenceLevel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleDeleteForecast(forecast._id)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredForecasts.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                            <FaCalendar className="mx-auto text-4xl mb-2 text-gray-400" />
                                            <p>
                                                {forecasts.length === 0 
                                                    ? 'No headcount forecasts created yet.' 
                                                    : 'No forecasts match your filters.'}
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
                        <h3 className="text-xl font-semibold mb-4">Create Workforce Plan</h3>
                        <form onSubmit={handleCreatePlan} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Plan Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={planFormData.planName}
                                        onChange={(e) => setPlanFormData({ ...planFormData, planName: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Department
                                    </label>
                                    <input
                                        type="text"
                                        value={planFormData.department}
                                        onChange={(e) => setPlanFormData({ ...planFormData, department: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Year</label>
                                    <input
                                        type="number"
                                        value={planFormData.planYear}
                                        onChange={(e) => setPlanFormData({ ...planFormData, planYear: parseInt(e.target.value) || new Date().getFullYear() })}
                                        className="w-full p-3 border rounded-lg"
                                        min="2020"
                                        max="2100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
                                    <select
                                        value={planFormData.quarter}
                                        onChange={(e) => setPlanFormData({ ...planFormData, quarter: parseInt(e.target.value) })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value={1}>Q1</option>
                                        <option value={2}>Q2</option>
                                        <option value={3}>Q3</option>
                                        <option value={4}>Q4</option>
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
                                        <option value="Approved">Approved</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Current Headcount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={planFormData.currentHeadcount}
                                        onChange={(e) => setPlanFormData({ ...planFormData, currentHeadcount: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Target Headcount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={planFormData.targetHeadcount}
                                        onChange={(e) => setPlanFormData({ ...planFormData, targetHeadcount: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">Budget</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Allocated ($)</label>
                                        <input
                                            type="number"
                                            value={planFormData.budget.allocated}
                                            onChange={(e) => setPlanFormData({
                                                ...planFormData,
                                                budget: {
                                                    ...planFormData.budget,
                                                    allocated: parseFloat(e.target.value) || 0,
                                                    remaining: (parseFloat(e.target.value) || 0) - (planFormData.budget.spent || 0)
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Spent ($)</label>
                                        <input
                                            type="number"
                                            value={planFormData.budget.spent}
                                            onChange={(e) => setPlanFormData({
                                                ...planFormData,
                                                budget: {
                                                    ...planFormData.budget,
                                                    spent: parseFloat(e.target.value) || 0,
                                                    remaining: (planFormData.budget.allocated || 0) - (parseFloat(e.target.value) || 0)
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                {planFormData.budget.remaining !== undefined && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        Remaining: <span className="font-medium">${planFormData.budget.remaining.toLocaleString()}</span>
                                    </div>
                                )}
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

            {/* Create Forecast Modal */}
            {showCreateForecastModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                        <h3 className="text-xl font-semibold mb-4">Create Headcount Forecast</h3>
                        <form onSubmit={handleCreateForecast} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Forecast Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={forecastFormData.forecastDate}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, forecastDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                    <input
                                        type="text"
                                        value={forecastFormData.department}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, department: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        placeholder="Leave empty for all departments"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Current Headcount <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={forecastFormData.currentHeadcount}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, currentHeadcount: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Projected Headcount</label>
                                    <input
                                        type="number"
                                        value={forecastFormData.projectedHeadcount}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, projectedHeadcount: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Hires</label>
                                    <input
                                        type="number"
                                        value={forecastFormData.newHires}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, newHires: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Terminations</label>
                                    <input
                                        type="number"
                                        value={forecastFormData.terminations}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, terminations: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Transfers</label>
                                    <input
                                        type="number"
                                        value={forecastFormData.transfers}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, transfers: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Promotions</label>
                                    <input
                                        type="number"
                                        value={forecastFormData.promotions}
                                        onChange={(e) => setForecastFormData({ ...forecastFormData, promotions: parseInt(e.target.value) || 0 })}
                                        className="w-full p-3 border rounded-lg"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Level</label>
                                <select
                                    value={forecastFormData.confidenceLevel}
                                    onChange={(e) => setForecastFormData({ ...forecastFormData, confidenceLevel: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateForecastModal(false);
                                        resetForecastForm();
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
                                            Creating...
                                        </>
                                    ) : (
                                        'Create Forecast'
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

export default WorkforcePage;
