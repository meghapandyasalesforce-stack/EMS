import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    FaArrowLeft, FaHeart, FaShieldAlt, FaGraduationCap, FaMoneyBillWave,
    FaUsers, FaCalendar, FaDollarSign, FaCheckCircle, FaTimesCircle, FaSpinner
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

const BenefitDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [plan, setPlan] = useState(null);
    const [enrollments, setEnrollments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);

    useEffect(() => {
        fetchPlan();
        fetchEnrollments();
    }, [id]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/v1/admin/benefits/benefit-plans/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setPlan(response.data.data);
            } else {
                toast.error('Benefit plan not found');
                navigate('/benefits');
            }
        } catch (error) {
            console.error('Error fetching plan:', error);
            toast.error('Failed to load benefit plan');
            navigate('/benefits');
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrollments = async () => {
        try {
            setEnrollmentsLoading(true);
            const response = await axios.get(`/v1/admin/benefits/benefit-plans/${id}/enrollments`, { withCredentials: true });
            setEnrollments(response.data?.data || []);
        } catch (error) {
            console.error('Error fetching enrollments:', error);
        } finally {
            setEnrollmentsLoading(false);
        }
    };

    const updateEnrollmentStatus = async (enrollmentId, status) => {
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollmentId}`,
                { status },
                { withCredentials: true }
            );
            toast.success(`Enrollment ${status.toLowerCase()} successfully`);
            fetchEnrollments();
        } catch (error) {
            toast.error('Failed to update enrollment');
        }
    };

    const getIcon = (category) => {
        switch (category) {
            case 'Health Insurance':
            case 'Dental':
            case 'Vision':
                return <FaHeart className="w-8 h-8" />;
            case 'Life Insurance':
                return <FaShieldAlt className="w-8 h-8" />;
            case 'Education':
                return <FaGraduationCap className="w-8 h-8" />;
            default:
                return <FaMoneyBillWave className="w-8 h-8" />;
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

    if (loading) {
        return <LoadingSpinner message="Loading benefit plan..." />;
    }

    if (!plan) {
        return null;
    }

    const activeEnrollments = enrollments.filter(e => e.status === 'Active' || e.status === 'Enrolled').length;
    const pendingEnrollments = enrollments.filter(e => e.status === 'Pending').length;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-5 ml-0 lg:ml-64 transition-all duration-300">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate('/benefits')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                    >
                        <FaArrowLeft /> Back to Benefits
                    </button>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-100 p-4 rounded-lg">
                                {getIcon(plan.category)}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">{plan.name}</h1>
                                <p className="text-gray-600">{plan.category}</p>
                            </div>
                        </div>
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(plan.isActive ? 'Active' : 'Inactive')}`}>
                            {plan.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Plan Details */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4">Plan Details</h2>
                            <div className="space-y-4">
                                {plan.description && (
                                    <div>
                                        <h3 className="font-medium text-gray-700 mb-1">Description</h3>
                                        <p className="text-gray-600">{plan.description}</p>
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-2 gap-4">
                                    {plan.provider && (
                                        <div>
                                            <h3 className="font-medium text-gray-700 mb-1">Provider</h3>
                                            <p className="text-gray-600">{plan.provider}</p>
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-medium text-gray-700 mb-1">Plan Type</h3>
                                        <p className="text-gray-600">{plan.planType}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-700 mb-1">Coverage</h3>
                                        <p className="text-gray-600">{plan.coverage}</p>
                                    </div>
                                </div>

                                {plan.effectiveDate && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="font-medium text-gray-700 mb-1">Effective Date</h3>
                                            <p className="text-gray-600">
                                                {format(new Date(plan.effectiveDate), 'MMM dd, yyyy')}
                                            </p>
                                        </div>
                                        {plan.expiryDate && (
                                            <div>
                                                <h3 className="font-medium text-gray-700 mb-1">Expiry Date</h3>
                                                <p className="text-gray-600">
                                                    {format(new Date(plan.expiryDate), 'MMM dd, yyyy')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Contributions */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold mb-4">Contributions</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-medium text-gray-700 mb-3">Employee Contribution</h3>
                                    <div className="space-y-2">
                                        {plan.employeeContribution?.amount > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Amount:</span>
                                                <span className="font-medium">${plan.employeeContribution.amount}</span>
                                            </div>
                                        )}
                                        {plan.employeeContribution?.percentage > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Percentage:</span>
                                                <span className="font-medium">{plan.employeeContribution.percentage}%</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Frequency:</span>
                                            <span className="font-medium">{plan.employeeContribution?.frequency || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-700 mb-3">Company Contribution</h3>
                                    <div className="space-y-2">
                                        {plan.companyContribution?.amount > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Amount:</span>
                                                <span className="font-medium">${plan.companyContribution.amount}</span>
                                            </div>
                                        )}
                                        {plan.companyContribution?.percentage > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Percentage:</span>
                                                <span className="font-medium">{plan.companyContribution.percentage}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Enrollments */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Enrollments</h2>
                                <div className="flex gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="font-bold text-green-600">{activeEnrollments}</div>
                                        <div className="text-gray-600">Active</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-yellow-600">{pendingEnrollments}</div>
                                        <div className="text-gray-600">Pending</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="font-bold text-gray-600">{enrollments.length}</div>
                                        <div className="text-gray-600">Total</div>
                                    </div>
                                </div>
                            </div>
                            
                            {enrollmentsLoading ? (
                                <LoadingSpinner message="Loading enrollments..." />
                            ) : enrollments.length > 0 ? (
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
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
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
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => updateEnrollmentStatus(enrollment._id, 'Active')}
                                                        className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition flex items-center gap-1"
                                                    >
                                                        <FaCheckCircle /> Approve
                                                    </button>
                                                    <button
                                                        onClick={() => updateEnrollmentStatus(enrollment._id, 'Cancelled')}
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

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Enrollment Stats */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-lg font-semibold mb-4">Enrollment Statistics</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Total Enrollments:</span>
                                    <span className="font-semibold">{enrollments.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Active:</span>
                                    <span className="font-semibold text-green-600">{activeEnrollments}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Pending:</span>
                                    <span className="font-semibold text-yellow-600">{pendingEnrollments}</span>
                                </div>
                            </div>
                        </div>

                        {/* Eligibility */}
                        {plan.eligibility && (
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h3 className="text-lg font-semibold mb-4">Eligibility</h3>
                                <div className="space-y-2 text-sm">
                                    {plan.eligibility.employmentType && plan.eligibility.employmentType.length > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700">Employment Type:</span>
                                            <div className="mt-1">
                                                {plan.eligibility.employmentType.map((type, idx) => (
                                                    <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1">
                                                        {type}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {plan.eligibility.tenure > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700">Minimum Tenure:</span>
                                            <span className="ml-2">{plan.eligibility.tenure} months</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BenefitDetailPage;

