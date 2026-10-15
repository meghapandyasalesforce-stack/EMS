import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
    FaArrowLeft, FaHeart, FaShieldAlt, FaGraduationCap, FaMoneyBillWave,
    FaUsers, FaCheckCircle, FaTimesCircle, FaSpinner, FaUserPlus, FaBuilding,
    FaClock, FaInfoCircle
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { isHR, isManager } from '../../utils/managerHelper';

const formatINR = (amount, frequency) => {
    const value = Number(amount || 0);
    const suffix =
        frequency === 'Annual' ? '/year' :
        frequency === 'One-time' ? '' :
        '/month';
    return `₹${value.toLocaleString('en-IN')}${suffix}`;
};

const BenefitDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);
    const [plan, setPlan] = useState(null);
    const [enrollments, setEnrollments] = useState([]);
    const [myEnrollment, setMyEnrollment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
    const [enrolling, setEnrolling] = useState(false);
    const [coverageType, setCoverageType] = useState('Individual');

    const userObj = user || employee;
    const userRole = userObj?.role || 'employee';
    const isPrivilegedView =
        userRole === 'admin' ||
        userRole === 'executive' ||
        isHR(userObj) ||
        isManager(userObj);
    const baseBenefitsEndpoint = isPrivilegedView ? '/v1/admin/benefits' : '/v1/both/benefits';

    useEffect(() => {
        fetchPlan();
        if (isPrivilegedView) {
            fetchEnrollments();
        } else {
            setEnrollments([]);
            fetchMyEnrollment();
        }
    }, [id, isPrivilegedView]);

    useEffect(() => {
        if (!plan) return;
        if (plan.planType === 'Family') setCoverageType('Family');
        else setCoverageType('Individual');
    }, [plan]);

    const fetchPlan = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${baseBenefitsEndpoint}/benefit-plans/${id}`, { withCredentials: true });
            if (response.data?.success && response.data?.data) {
                setPlan(response.data.data);
            } else {
                toast.error('Benefit plan not found');
                navigate('/benefits');
            }
        } catch (error) {
            toast.error('Failed to load benefit plan');
            navigate('/benefits');
        } finally {
            setLoading(false);
        }
    };

    const fetchEnrollments = async () => {
        try {
            setEnrollmentsLoading(true);
            const response = await axios.get(`${baseBenefitsEndpoint}/benefit-plans/${id}/enrollments`, { withCredentials: true });
            setEnrollments(response.data?.data || []);
        } catch (error) {
            // Error handled silently for production
        } finally {
            setEnrollmentsLoading(false);
        }
    };

    const fetchMyEnrollment = async () => {
        try {
            const response = await axios.get('/v1/both/benefits/benefits', { withCredentials: true });
            const list = response.data?.data || [];
            const mine = list.find((item) => {
                const planId = item.benefitPlanId?._id || item.benefitPlanId;
                return String(planId) === String(id) &&
                    ['Pending', 'Active', 'Enrolled'].includes(item.status);
            });
            setMyEnrollment(mine || null);
        } catch (error) {
            setMyEnrollment(null);
        }
    };

    const updateEnrollmentStatus = async (enrollmentId, status) => {
        try {
            if (!isPrivilegedView) return;
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

    const handleEnroll = async () => {
        if (!plan?._id || enrolling) return;
        try {
            setEnrolling(true);
            await axios.post(
                '/v1/both/benefits/benefits/enroll',
                {
                    benefitPlanId: plan._id,
                    coverageType
                },
                { withCredentials: true }
            );
            toast.success('Enrollment request submitted. Waiting for HR approval.');
            await fetchMyEnrollment();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to enroll in this benefit');
        } finally {
            setEnrolling(false);
        }
    };

    const handleCancelEnrollment = async () => {
        if (!myEnrollment?._id) return;
        if (!window.confirm('Withdraw this pending enrollment request?')) return;
        try {
            setEnrolling(true);
            await axios.put(
                `/v1/both/benefits/benefits/${myEnrollment._id}/cancel`,
                {},
                { withCredentials: true }
            );
            toast.success('Enrollment request withdrawn');
            await fetchMyEnrollment();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel enrollment');
        } finally {
            setEnrolling(false);
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
                return 'bg-theme-primary/10 text-theme-primary';
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'Cancelled':
            case 'Expired':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const canSelfEnroll = useMemo(() => {
        if (isPrivilegedView || !plan?.isActive) return false;
        if (myEnrollment) return false;
        if (plan.enrollmentType === 'Automatic') return false;
        return true;
    }, [isPrivilegedView, plan, myEnrollment]);

    const showCoveragePicker = plan?.planType === 'Both';

    if (loading) {
        return <LoadingSpinner message="Loading benefit plan..." />;
    }

    if (!plan) {
        return null;
    }

    const activeEnrollments = enrollments.filter(e => e.status === 'Active' || e.status === 'Enrolled').length;
    const pendingEnrollments = enrollments.filter(e => e.status === 'Pending').length;
    const frequency = plan.employeeContribution?.frequency || 'Monthly';

    return (
        <div className="page-shell bg-gradient-to-b from-slate-50 to-white transition-all duration-300">
            <div className="page-shell-inner hrms-stack">
                <div>
                    <button
                        onClick={() => navigate('/benefits')}
                        className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-800"
                    >
                        <FaArrowLeft /> Back to Benefits
                    </button>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                            <div className="flex items-start gap-4">
                                <div className="bg-theme-primary/10 text-theme-primary p-4 rounded-xl">
                                    {getIcon(plan.category)}
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{plan.name}</h1>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.isActive ? 'Active' : 'Inactive')}`}>
                                            {plan.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        {plan.enrollmentType && (
                                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                {plan.enrollmentType}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-600">{plan.category}</p>
                                    {plan.provider && (
                                        <p className="text-sm text-gray-500 mt-1">Provider: {plan.provider}</p>
                                    )}
                                </div>
                            </div>

                            {!isPrivilegedView && (
                                <div className="w-full sm:w-auto sm:min-w-[240px]">
                                    {myEnrollment ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                            <p className="text-xs uppercase tracking-wide text-gray-500">Your status</p>
                                            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(myEnrollment.status)}`}>
                                                {myEnrollment.status}
                                            </span>
                                            <p className="text-sm text-gray-600">
                                                {myEnrollment.status === 'Pending'
                                                    ? 'Your request is waiting for HR approval.'
                                                    : 'You are enrolled in this benefit.'}
                                            </p>
                                            {myEnrollment.status === 'Pending' && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEnrollment}
                                                    disabled={enrolling}
                                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    {enrolling ? <FaSpinner className="animate-spin" /> : <FaTimesCircle />}
                                                    Withdraw Request
                                                </button>
                                            )}
                                        </div>
                                    ) : plan.enrollmentType === 'Automatic' ? (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                                            <FaInfoCircle className="inline mr-1 text-theme-secondary" />
                                            This plan is assigned automatically by HR.
                                        </div>
                                    ) : canSelfEnroll ? (
                                        <div className="rounded-xl border border-theme-secondary/20 bg-theme-secondary/5 p-4 space-y-3">
                                            {showCoveragePicker && (
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Coverage</label>
                                                    <select
                                                        value={coverageType}
                                                        onChange={(e) => setCoverageType(e.target.value)}
                                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                                                    >
                                                        <option value="Individual">Individual (Self)</option>
                                                        <option value="Family">Family</option>
                                                    </select>
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleEnroll}
                                                disabled={enrolling || !plan.isActive}
                                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-theme-secondary text-white font-semibold hover:bg-theme-primary disabled:opacity-50 transition"
                                            >
                                                {enrolling ? (
                                                    <>
                                                        <FaSpinner className="animate-spin" /> Submitting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <FaUserPlus /> Enroll Now
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-xs text-gray-500 text-center">
                                                Request goes to HR for approval
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-gray-600">
                                            This plan is not open for enrollment.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hrms-main-rail">
                    <div className="min-w-0 space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Plan Details</h2>
                            <div className="space-y-4">
                                {plan.description && (
                                    <div>
                                        <h3 className="font-medium text-gray-700 mb-1">Description</h3>
                                        <p className="text-gray-600">{plan.description}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {plan.provider && (
                                        <div className="rounded-xl bg-slate-50 p-3">
                                            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Provider</h3>
                                            <p className="text-gray-800 font-medium">{plan.provider}</p>
                                        </div>
                                    )}
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Plan Type</h3>
                                        <p className="text-gray-800 font-medium">{plan.planType}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Coverage</h3>
                                        <p className="text-gray-800 font-medium">{plan.coverage}</p>
                                    </div>
                                    {plan.benefitCode && (
                                        <div className="rounded-xl bg-slate-50 p-3">
                                            <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-1">Benefit Code</h3>
                                            <p className="text-gray-800 font-medium">{plan.benefitCode}</p>
                                        </div>
                                    )}
                                </div>

                                {(plan.effectiveDate || plan.expiryDate) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                        {plan.effectiveDate && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <FaClock className="text-theme-secondary" />
                                                <span>
                                                    Effective:{' '}
                                                    <span className="font-medium text-gray-800">
                                                        {format(new Date(plan.effectiveDate), 'MMM dd, yyyy')}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                        {plan.expiryDate && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <FaClock className="text-gray-400" />
                                                <span>
                                                    Expiry:{' '}
                                                    <span className="font-medium text-gray-800">
                                                        {format(new Date(plan.expiryDate), 'MMM dd, yyyy')}
                                                    </span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                            <h2 className="text-xl font-semibold mb-4 text-gray-800">Contributions</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaBuilding className="text-theme-secondary" />
                                        <h3 className="font-medium text-gray-800">Employer Contribution</h3>
                                    </div>
                                    <p className="text-2xl font-semibold text-gray-900">
                                        {formatINR(plan.companyContribution?.amount, frequency)}
                                    </p>
                                    {plan.companyContribution?.percentage > 0 && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            {plan.companyContribution.percentage}% of cost
                                        </p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <FaUserPlus className="text-theme-secondary" />
                                        <h3 className="font-medium text-gray-800">Employee Contribution</h3>
                                    </div>
                                    <p className="text-2xl font-semibold text-gray-900">
                                        {formatINR(plan.employeeContribution?.amount, frequency)}
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Frequency: {frequency}
                                        {plan.employeeContribution?.percentage > 0
                                            ? ` · ${plan.employeeContribution.percentage}%`
                                            : ''}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {isPrivilegedView && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold">Enrollments</h2>
                                    <div className="flex gap-4 text-sm">
                                        <div className="text-center">
                                            <div className="font-bold text-theme-primary">{activeEnrollments}</div>
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
                                                        <span className="font-medium">Enrolled:</span>{' '}
                                                        {enrollment.enrollmentDate
                                                            ? format(new Date(enrollment.enrollmentDate), 'MMM dd, yyyy')
                                                            : 'N/A'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Employee:</span>{' '}
                                                        {formatINR(enrollment.employeeContribution, enrollment.paymentFrequency)}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium">Employer:</span>{' '}
                                                        {formatINR(enrollment.companyContribution, enrollment.paymentFrequency)}
                                                    </div>
                                                </div>
                                                {enrollment.status === 'Pending' && (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => updateEnrollmentStatus(enrollment._id, 'Active')}
                                                            className="px-3 py-1 bg-theme-primary text-white rounded text-sm hover:bg-theme-primary transition flex items-center gap-1"
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
                        )}
                    </div>

                    <div className="min-w-0 space-y-6">
                        {isPrivilegedView && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Enrollment Statistics</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Total Enrollments:</span>
                                        <span className="font-semibold">{enrollments.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Active:</span>
                                        <span className="font-semibold text-theme-primary">{activeEnrollments}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Pending:</span>
                                        <span className="font-semibold text-yellow-600">{pendingEnrollments}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {!isPrivilegedView && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h3 className="text-lg font-semibold mb-3 text-gray-800">How enrollment works</h3>
                                <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                                    <li>Click <span className="font-medium text-gray-800">Enroll Now</span></li>
                                    <li>Your request is marked as <span className="font-medium text-yellow-700">Pending</span></li>
                                    <li>HR reviews and approves it</li>
                                    <li>Once approved, the benefit becomes <span className="font-medium text-theme-primary">Active</span></li>
                                </ol>
                            </div>
                        )}

                        {plan.eligibility && (
                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                                <h3 className="text-lg font-semibold mb-4">Eligibility</h3>
                                <div className="space-y-2 text-sm">
                                    {plan.eligibility.employmentType && plan.eligibility.employmentType.length > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700">Employment Type:</span>
                                            <div className="mt-1">
                                                {plan.eligibility.employmentType.map((type, idx) => (
                                                    <span key={idx} className="inline-block bg-theme-secondary/10 text-theme-secondary px-2 py-1 rounded mr-1 mb-1">
                                                        {type}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {plan.eligibility.departments?.length > 0 && (
                                        <div>
                                            <span className="font-medium text-gray-700">Departments:</span>
                                            <p className="mt-1 text-gray-600">{plan.eligibility.departments.join(', ')}</p>
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
