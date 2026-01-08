import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    FaMoneyBillWave, FaHeart, FaShieldAlt, FaGraduationCap, FaPlus, 
    FaSpinner, FaSearch, FaFilter, FaEdit, FaTrash, FaEye, FaUsers,
    FaCheckCircle, FaTimesCircle, FaClock
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { isHR } from '../../utils/managerHelper';

const BenefitsPage = () => {
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    
    // Check if user is HR or Admin
    const isHRUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        const userObj = user || employee;
        return isHR(userObj);
    }, [user, employee]);
    const [benefitPlans, setBenefitPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showEnrollments, setShowEnrollments] = useState(false);
    const [enrollments, setEnrollments] = useState([]);

    const [formData, setFormData] = useState({
        name: '',
        category: 'Health Insurance',
        description: '',
        provider: '',
        planType: 'Both',
        coverage: 'Full',
        employeeContribution: {
            amount: 0,
            percentage: 0,
            frequency: 'Monthly'
        },
        companyContribution: {
            amount: 0,
            percentage: 0
        },
        eligibility: {
            employmentType: ['Full-time'],
            tenure: 0,
            departments: [],
            roles: []
        },
        enrollmentPeriod: {
            startDate: '',
            endDate: '',
            isOpen: false
        },
        effectiveDate: '',
        expiryDate: '',
        isActive: true
    });

    useEffect(() => {
        fetchBenefits();
    }, []);

    const fetchBenefits = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/benefits/benefit-plans', { withCredentials: true });
            setBenefitPlans(response.data?.data || []);
        } catch (error) {
            console.error('Error fetching benefits:', error);
            toast.error('Failed to load benefit plans');
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrollments = async (planId) => {
        try {
            const response = await axios.get(`/v1/admin/benefits/benefit-plans/${planId}/enrollments`, { withCredentials: true });
            setEnrollments(response.data?.data || []);
        } catch (error) {
            console.error('Error fetching enrollments:', error);
            toast.error('Failed to load enrollments');
        }
    };

    const handleCreateBenefit = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.category) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            setSubmitting(true);
            const response = await axios.post('/v1/admin/benefits/benefit-plans', formData, { withCredentials: true });
            toast.success('Benefit plan created successfully');
            setShowCreateModal(false);
            resetForm();
            fetchBenefits();
        } catch (error) {
            console.error('Error creating benefit:', error);
            toast.error(error.response?.data?.message || 'Failed to create benefit plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteBenefit = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this benefit plan?')) {
            return;
        }

        try {
            await axios.delete(`/v1/admin/benefits/benefit-plans/${planId}`, { withCredentials: true });
            toast.success('Benefit plan deleted successfully');
            fetchBenefits();
        } catch (error) {
            console.error('Error deleting benefit:', error);
            toast.error(error.response?.data?.message || 'Failed to delete benefit plan');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            category: 'Health Insurance',
            description: '',
            provider: '',
            planType: 'Both',
            coverage: 'Full',
            employeeContribution: {
                amount: 0,
                percentage: 0,
                frequency: 'Monthly'
            },
            companyContribution: {
                amount: 0,
                percentage: 0
            },
            eligibility: {
                employmentType: ['Full-time'],
                tenure: 0,
                departments: [],
                roles: []
            },
            enrollmentPeriod: {
                startDate: '',
                endDate: '',
                isOpen: false
            },
            effectiveDate: '',
            expiryDate: '',
            isActive: true
        });
    };

    const getIcon = (category) => {
        switch (category) {
            case 'Health Insurance':
            case 'Dental':
            case 'Vision':
                return <FaHeart className="w-6 h-6" />;
            case 'Life Insurance':
                return <FaShieldAlt className="w-6 h-6" />;
            case 'Education':
                return <FaGraduationCap className="w-6 h-6" />;
            default:
                return <FaMoneyBillWave className="w-6 h-6" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active':
            case 'Enrolled':
                return 'bg-green-100 text-green-800';
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'Cancelled':
            case 'Expired':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Filter benefits
    const filteredPlans = benefitPlans.filter(plan => {
        const matchesSearch = searchTerm === '' || 
            plan.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            plan.provider?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCategory = categoryFilter === 'all' || plan.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'active' && plan.isActive) ||
            (statusFilter === 'inactive' && !plan.isActive);
        
        return matchesSearch && matchesCategory && matchesStatus;
    });

    if (loading) {
        return <LoadingSpinner message="Loading benefits..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Benefits Administration</h1>
                        <p className="text-gray-600 mt-1">Manage employee benefits and enrollments</p>
                    </div>
                    {isHRUser && (
                        <button
                            onClick={() => {
                                setSelectedPlan(null);
                                resetForm();
                                setShowCreateModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                        >
                            <FaPlus />
                            Create Benefit Plan
                        </button>
                    )}
                </div>

                {/* Filters */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, description, or provider..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="relative">
                        <FaFilter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                        >
                            <option value="all">All Categories</option>
                            <option value="Health Insurance">Health Insurance</option>
                            <option value="Dental">Dental</option>
                            <option value="Vision">Vision</option>
                            <option value="Life Insurance">Life Insurance</option>
                            <option value="Retirement">Retirement</option>
                            <option value="Wellness">Wellness</option>
                            <option value="Education">Education</option>
                            <option value="Transportation">Transportation</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div className="relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPlans.map((plan) => (
                        <div key={plan._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-green-100 p-3 rounded-lg">
                                    {getIcon(plan.category)}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-800">{plan.name}</h3>
                                    <p className="text-sm text-gray-600">{plan.category}</p>
                                </div>
                            </div>
                            <p className="text-gray-600 mb-4 text-sm line-clamp-2">{plan.description}</p>
                            
                            {plan.provider && (
                                <p className="text-xs text-gray-500 mb-2">Provider: {plan.provider}</p>
                            )}
                            
                            <div className="flex items-center justify-between mb-4">
                                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(plan.isActive ? 'Active' : 'Inactive')}`}>
                                    {plan.isActive ? 'Active' : 'Inactive'}
                                </span>
                                {plan.coverage && (
                                    <span className="text-xs text-gray-500">{plan.coverage} Coverage</span>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/benefits/${plan._id}`)}
                                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center justify-center gap-1"
                                >
                                    <FaEye /> View
                                </button>
                                {isHRUser && (
                                    <>
                                        <button
                                            onClick={() => {
                                                setSelectedPlan(plan);
                                                fetchEnrollments(plan._id);
                                                setShowEnrollments(true);
                                            }}
                                            className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm flex items-center justify-center gap-1"
                                        >
                                            <FaUsers />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBenefit(plan._id)}
                                            className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                                        >
                                            <FaTrash />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredPlans.length === 0 && (
                        <div className="col-span-3 text-center py-12">
                            <FaMoneyBillWave className="mx-auto text-gray-400 text-5xl mb-4" />
                            <p className="text-gray-500">
                                {benefitPlans.length === 0 
                                    ? 'No benefit plans configured yet.' 
                                    : 'No benefit plans match your filters.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && isHRUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">
                            {selectedPlan ? 'Edit Benefit Plan' : 'Create Benefit Plan'}
                        </h3>
                        <form onSubmit={handleCreateBenefit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Plan Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                        required
                                    >
                                        <option value="Health Insurance">Health Insurance</option>
                                        <option value="Dental">Dental</option>
                                        <option value="Vision">Vision</option>
                                        <option value="Life Insurance">Life Insurance</option>
                                        <option value="Retirement">Retirement</option>
                                        <option value="Wellness">Wellness</option>
                                        <option value="Education">Education</option>
                                        <option value="Transportation">Transportation</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full p-3 border rounded-lg"
                                    rows="3"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                    <input
                                        type="text"
                                        value={formData.provider}
                                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan Type</label>
                                    <select
                                        value={formData.planType}
                                        onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Individual">Individual</option>
                                        <option value="Family">Family</option>
                                        <option value="Both">Both</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Coverage</label>
                                    <select
                                        value={formData.coverage}
                                        onChange={(e) => setFormData({ ...formData, coverage: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    >
                                        <option value="Full">Full</option>
                                        <option value="Partial">Partial</option>
                                        <option value="Employee Contribution">Employee Contribution</option>
                                    </select>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">Employee Contribution</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                                        <input
                                            type="number"
                                            value={formData.employeeContribution.amount}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                employeeContribution: {
                                                    ...formData.employeeContribution,
                                                    amount: parseFloat(e.target.value) || 0
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Percentage (%)</label>
                                        <input
                                            type="number"
                                            value={formData.employeeContribution.percentage}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                employeeContribution: {
                                                    ...formData.employeeContribution,
                                                    percentage: parseFloat(e.target.value) || 0
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                        <select
                                            value={formData.employeeContribution.frequency}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                employeeContribution: {
                                                    ...formData.employeeContribution,
                                                    frequency: e.target.value
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        >
                                            <option value="Monthly">Monthly</option>
                                            <option value="Annual">Annual</option>
                                            <option value="One-time">One-time</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-medium mb-3">Company Contribution</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                                        <input
                                            type="number"
                                            value={formData.companyContribution.amount}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                companyContribution: {
                                                    ...formData.companyContribution,
                                                    amount: parseFloat(e.target.value) || 0
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Percentage (%)</label>
                                        <input
                                            type="number"
                                            value={formData.companyContribution.percentage}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                companyContribution: {
                                                    ...formData.companyContribution,
                                                    percentage: parseFloat(e.target.value) || 0
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                                    <input
                                        type="date"
                                        value={formData.effectiveDate}
                                        onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                    <input
                                        type="date"
                                        value={formData.expiryDate}
                                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full p-3 border rounded-lg"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4"
                                />
                                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                                    Active Plan
                                </label>
                            </div>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        resetForm();
                                        setSelectedPlan(null);
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

            {/* Enrollments Modal */}
            {showEnrollments && selectedPlan && isHRUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold">
                                Enrollments - {selectedPlan.name}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowEnrollments(false);
                                    setSelectedPlan(null);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <FaTimesCircle className="w-6 h-6" />
                            </button>
                        </div>
                        
                        {enrollments.length > 0 ? (
                            <div className="space-y-4">
                                {enrollments.map((enrollment) => (
                                    <div key={enrollment._id} className="border rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-semibold">
                                                    {enrollment.employeeId?.name || 'Employee'}
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    {enrollment.employeeId?.email || ''}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(enrollment.status)}`}>
                                                {enrollment.status}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600">
                                            <div>
                                                <span className="font-medium">Coverage:</span> {enrollment.coverageType}
                                            </div>
                                            <div>
                                                <span className="font-medium">Enrolled:</span> {enrollment.enrollmentDate ? format(new Date(enrollment.enrollmentDate), 'MMM dd, yyyy') : 'N/A'}
                                            </div>
                                            <div>
                                                <span className="font-medium">Employee:</span> ${enrollment.employeeContribution || 0}
                                            </div>
                                            <div>
                                                <span className="font-medium">Company:</span> ${enrollment.companyContribution || 0}
                                            </div>
                                        </div>
                                        {enrollment.status === 'Pending' && (
                                            <div className="mt-3 flex gap-2">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await axios.put(
                                                                `/v1/admin/benefits/enrollments/${enrollment._id}`,
                                                                { status: 'Active' },
                                                                { withCredentials: true }
                                                            );
                                                            toast.success('Enrollment approved');
                                                            fetchEnrollments(selectedPlan._id);
                                                        } catch (error) {
                                                            toast.error('Failed to update enrollment');
                                                        }
                                                    }}
                                                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition flex items-center gap-1"
                                                >
                                                    <FaCheckCircle /> Approve
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await axios.put(
                                                                `/v1/admin/benefits/enrollments/${enrollment._id}`,
                                                                { status: 'Cancelled' },
                                                                { withCredentials: true }
                                                            );
                                                            toast.success('Enrollment cancelled');
                                                            fetchEnrollments(selectedPlan._id);
                                                        } catch (error) {
                                                            toast.error('Failed to update enrollment');
                                                        }
                                                    }}
                                                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition flex items-center gap-1"
                                                >
                                                    <FaTimesCircle /> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                <FaUsers className="mx-auto text-4xl mb-2 text-gray-400" />
                                <p>No enrollments yet</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BenefitsPage;
