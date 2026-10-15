import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
    FaMoneyBillWave, FaPlus, FaSpinner, FaSearch, FaEdit, FaTrash, FaEye,
    FaCheckCircle, FaTimesCircle, FaDownload, FaTimes
} from 'react-icons/fa';
import axios from '../../utils/axios';
import LoadingSpinner from '../../components/LoadingSpinner';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { isHR } from '../../utils/managerHelper';
import { exportToExcel } from '../../utils/exportUtils';

const emptyForm = () => ({
    name: '',
    benefitCode: '',
    category: 'Health Insurance',
    description: '',
    provider: '',
    planType: 'Both',
    coverage: 'Full',
    enrollmentType: 'Optional',
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
        positionLevels: [],
        locations: [],
        roles: []
    },
    enrollmentPeriod: {
        startDate: '',
        endDate: '',
        isOpen: true
    },
    effectiveDate: '',
    expiryDate: '',
    isActive: true
});

const formatContribution = (amount, frequency = 'Monthly') => {
    const value = Number(amount || 0);
    const suffix =
        frequency === 'Annual' ? '/year' :
        frequency === 'One-time' ? '' :
        '/month';
    return `₹${value.toLocaleString('en-IN')}${suffix}`;
};

const formatEligibility = (plan) => {
    const depts = plan.eligibility?.departments?.filter(Boolean);
    if (depts?.length) return depts.join(', ');
    const types = plan.eligibility?.employmentType;
    if (types?.length) return types.join(', ');
    return 'All Employees';
};

const toDateInput = (value) => {
    if (!value) return '';
    try {
        return format(new Date(value), 'yyyy-MM-dd');
    } catch {
        return '';
    }
};

const BenefitsPage = () => {
    const user = useSelector((state) => state.auth.user);
    const employee = useSelector((state) => state.employeeDetails.employee);

    const isHRUser = useMemo(() => {
        const userRole = user?.role || employee?.role;
        if (userRole === 'admin') return true;
        return isHR(user || employee);
    }, [user, employee]);

    const [activeSection, setActiveSection] = useState('plans');
    const [benefitPlans, setBenefitPlans] = useState([]);
    const [employeeOverview, setEmployeeOverview] = useState([]);
    const [allEnrollments, setAllEnrollments] = useState([]);
    const [reportSummary, setReportSummary] = useState({
        totalPlans: 0,
        activePlans: 0,
        activeEnrollments: 0,
        pendingEnrollments: 0,
        expiringBenefits: 0
    });
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [formData, setFormData] = useState(emptyForm());

    // Employee Benefits filters / drawer
    const [empSearch, setEmpSearch] = useState('');
    const [empDepartment, setEmpDepartment] = useState('all');
    const [empStatus, setEmpStatus] = useState('all');
    const [empBenefit, setEmpBenefit] = useState('all');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTab, setDrawerTab] = useState('overview');
    const [selectedEmployeeRow, setSelectedEmployeeRow] = useState(null);
    const [dependentForm, setDependentForm] = useState({ name: '', relationship: 'Spouse', dateOfBirth: '' });
    const [addingDependentFor, setAddingDependentFor] = useState(null);

    // Reports filters
    const [reportBenefit, setReportBenefit] = useState('all');
    const [reportDepartment, setReportDepartment] = useState('all');
    const [reportStatus, setReportStatus] = useState('all');
    const [reportType, setReportType] = useState('enrollment');
    const [hrEnrollPlanId, setHrEnrollPlanId] = useState('');
    const [hrEnrollCoverage, setHrEnrollCoverage] = useState('Individual');
    const [hrEnrolling, setHrEnrolling] = useState(false);
    const [employeeDirectory, setEmployeeDirectory] = useState([]);
    const [assignEmployeeId, setAssignEmployeeId] = useState('');
    const [assignPlanId, setAssignPlanId] = useState('');
    const [assignCoverage, setAssignCoverage] = useState('Individual');
    const [assignActivate, setAssignActivate] = useState(true);
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        fetchBenefits();
        if (isHRUser) {
            fetchEmployeeOverview();
            fetchReportSummary();
            fetchAllEnrollments();
        }
    }, [isHRUser]);

    useEffect(() => {
        if (isHRUser) {
            fetchEmployeeDirectory();
        }
    }, [isHRUser, employeeOverview]);

    // Close Benefits overlays with Escape so they cannot block navbar clicks
    useEffect(() => {
        if (!showCreateModal && !drawerOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return;
            setShowCreateModal(false);
            setDrawerOpen(false);
            setSelectedPlan(null);
            setAddingDependentFor(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showCreateModal, drawerOpen]);

    // Ensure body scroll lock is cleared if overlays unmount unexpectedly
    useEffect(() => {
        if (showCreateModal || drawerOpen) {
            const previous = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = previous || '';
            };
        }
        return undefined;
    }, [showCreateModal, drawerOpen]);

    const fetchEmployeeDirectory = async () => {
        try {
            const allEmployees = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 20) {
                const response = await axios.get('/v1/employee/auth/get-all-employees', {
                    params: { page, limit: 100 },
                    withCredentials: true
                });
                const body = response.data;
                const batch = Array.isArray(body)
                    ? body
                    : Array.isArray(body?.data)
                        ? body.data
                        : Array.isArray(body?.employees)
                            ? body.employees
                            : [];

                allEmployees.push(...batch);
                const pagination = body?.pagination;
                hasMore = pagination?.hasNext === true || (batch.length === 100 && !pagination);
                page += 1;
            }

            // Fallback: employees already present in benefits overview
            if (allEmployees.length === 0) {
                const fromOverview = (employeeOverview || [])
                    .map((row) => row.employee)
                    .filter(Boolean);
                allEmployees.push(...fromOverview);
            }

            const unique = [];
            const seen = new Set();
            allEmployees.forEach((emp) => {
                const id = String(emp?._id || '');
                if (!id || seen.has(id)) return;
                seen.add(id);
                unique.push(emp);
            });

            unique.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            setEmployeeDirectory(unique);
        } catch (error) {
            toast.error('Failed to load employees for assignment');
            setEmployeeDirectory([]);
        }
    };

    const fetchBenefits = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/v1/both/benefits/benefit-plans', { withCredentials: true });
            setBenefitPlans(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load benefit plans');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployeeOverview = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/employee-overview', { withCredentials: true });
            setEmployeeOverview(response.data?.data || []);
        } catch (error) {
            toast.error('Failed to load employee benefits');
        }
    };

    const fetchReportSummary = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/reports/summary', { withCredentials: true });
            setReportSummary(response.data?.data || reportSummary);
        } catch (error) {
            // Keep zeros if summary fails
        }
    };

    const fetchAllEnrollments = async () => {
        try {
            const response = await axios.get('/v1/admin/benefits/enrollments', { withCredentials: true });
            setAllEnrollments(response.data?.data || []);
        } catch (error) {
            // optional for reports
        }
    };

    const refreshOperationalData = async () => {
        await Promise.all([fetchEmployeeOverview(), fetchReportSummary(), fetchAllEnrollments()]);
    };

    const openCreateModal = () => {
        setSelectedPlan(null);
        setFormData(emptyForm());
        setShowCreateModal(true);
    };

    const openEditModal = (plan) => {
        setSelectedPlan(plan);
        setFormData({
            name: plan.name || '',
            benefitCode: plan.benefitCode || '',
            category: plan.category || 'Health Insurance',
            description: plan.description || '',
            provider: plan.provider || '',
            planType: plan.planType || 'Both',
            coverage: plan.coverage || 'Full',
            enrollmentType: plan.enrollmentType || 'Optional',
            employeeContribution: {
                amount: plan.employeeContribution?.amount || 0,
                percentage: plan.employeeContribution?.percentage || 0,
                frequency: plan.employeeContribution?.frequency || 'Monthly'
            },
            companyContribution: {
                amount: plan.companyContribution?.amount || 0,
                percentage: plan.companyContribution?.percentage || 0
            },
            eligibility: {
                employmentType: plan.eligibility?.employmentType?.length
                    ? plan.eligibility.employmentType
                    : ['Full-time'],
                tenure: plan.eligibility?.tenure || 0,
                departments: plan.eligibility?.departments || [],
                positionLevels: plan.eligibility?.positionLevels || [],
                locations: plan.eligibility?.locations || [],
                roles: plan.eligibility?.roles || []
            },
            enrollmentPeriod: {
                startDate: toDateInput(plan.enrollmentPeriod?.startDate),
                endDate: toDateInput(plan.enrollmentPeriod?.endDate),
                isOpen: plan.enrollmentPeriod?.isOpen || false
            },
            effectiveDate: toDateInput(plan.effectiveDate),
            expiryDate: toDateInput(plan.expiryDate),
            isActive: plan.isActive !== false
        });
        setShowCreateModal(true);
    };

    const handleSaveBenefit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.category) {
            toast.error('Please fill in required fields');
            return;
        }

        const payload = {
            ...formData,
            enrollmentPeriod: {
                ...formData.enrollmentPeriod,
                startDate: formData.enrollmentPeriod.startDate || undefined,
                endDate: formData.enrollmentPeriod.endDate || undefined
            },
            effectiveDate: formData.effectiveDate || undefined,
            expiryDate: formData.expiryDate || undefined
        };

        try {
            setSubmitting(true);
            if (selectedPlan?._id) {
                await axios.put(`/v1/admin/benefits/benefit-plans/${selectedPlan._id}`, payload, { withCredentials: true });
                toast.success('Benefit plan updated successfully');
            } else {
                await axios.post('/v1/admin/benefits/benefit-plans', payload, { withCredentials: true });
                toast.success('Benefit plan created successfully');
            }
            setShowCreateModal(false);
            setSelectedPlan(null);
            setFormData(emptyForm());
            fetchBenefits();
            fetchReportSummary();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save benefit plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteBenefit = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this benefit plan?')) return;

        try {
            await axios.delete(`/v1/admin/benefits/benefit-plans/${planId}`, { withCredentials: true });
            toast.success('Benefit plan deleted successfully');
            fetchBenefits();
            fetchReportSummary();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete benefit plan');
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

    const filteredPlans = benefitPlans.filter((plan) => {
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && plan.isActive) ||
            (statusFilter === 'inactive' && !plan.isActive);
        return matchesStatus;
    });

    const departments = useMemo(() => {
        const set = new Set();
        employeeOverview.forEach((row) => {
            if (row.employee?.department) set.add(row.employee.department);
        });
        allEnrollments.forEach((e) => {
            if (e.employeeId?.department) set.add(e.employeeId.department);
        });
        return Array.from(set).sort();
    }, [employeeOverview, allEnrollments]);

    const filteredEmployees = useMemo(() => {
        return employeeOverview.filter((row) => {
            const emp = row.employee || {};
            const matchesSearch =
                !empSearch ||
                `${emp.name || ''} ${emp.email || ''} ${emp.employeeId || ''}`
                    .toLowerCase()
                    .includes(empSearch.toLowerCase());
            const matchesDept = empDepartment === 'all' || emp.department === empDepartment;
            const matchesBenefit =
                empBenefit === 'all' ||
                row.enrollments?.some((e) => e.benefitPlanId?._id === empBenefit || e.benefitPlanId === empBenefit);
            const matchesStatus =
                empStatus === 'all' ||
                row.enrollments?.some((e) => e.status === empStatus) ||
                (empStatus === 'Active' && row.activeCount > 0) ||
                (empStatus === 'Pending' && row.pendingCount > 0);
            return matchesSearch && matchesDept && matchesBenefit && matchesStatus;
        });
    }, [employeeOverview, empSearch, empDepartment, empBenefit, empStatus]);

    const openEmployeeDrawer = (row) => {
        setSelectedEmployeeRow(row);
        setDrawerTab('overview');
        setDrawerOpen(true);
        setAddingDependentFor(null);
        setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
    };

    const refreshSelectedEmployee = async (employeeId) => {
        const response = await axios.get('/v1/admin/benefits/employee-overview', { withCredentials: true });
        const rows = response.data?.data || [];
        setEmployeeOverview(rows);
        const updated = rows.find((r) => String(r.employee?._id) === String(employeeId));
        if (updated) setSelectedEmployeeRow(updated);
        await Promise.all([fetchReportSummary(), fetchAllEnrollments()]);
    };

    const handleEnrollmentAction = async (enrollmentId, status) => {
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollmentId}`,
                { status },
                { withCredentials: true }
            );
            toast.success(status === 'Active' ? 'Enrollment approved' : 'Enrollment rejected');
            if (selectedEmployeeRow?.employee?._id) {
                await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
            } else {
                await refreshOperationalData();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update enrollment');
        }
    };

    const supportsDependents = (enrollment) => {
        const planType = enrollment.benefitPlanId?.planType;
        return planType === 'Family' || planType === 'Both' || (enrollment.dependents?.length > 0);
    };

    const handleAddDependent = async (enrollment) => {
        if (!dependentForm.name.trim()) {
            toast.error('Dependent name is required');
            return;
        }
        const next = [
            ...(enrollment.dependents || []),
            {
                name: dependentForm.name.trim(),
                relationship: dependentForm.relationship,
                dateOfBirth: dependentForm.dateOfBirth || undefined
            }
        ];
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollment._id}/dependents`,
                { dependents: next },
                { withCredentials: true }
            );
            toast.success('Dependent added');
            setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
            setAddingDependentFor(null);
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add dependent');
        }
    };

    const handleRemoveDependent = async (enrollment, index) => {
        const next = (enrollment.dependents || []).filter((_, i) => i !== index);
        try {
            await axios.put(
                `/v1/admin/benefits/enrollments/${enrollment._id}/dependents`,
                { dependents: next },
                { withCredentials: true }
            );
            toast.success('Dependent removed');
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to remove dependent');
        }
    };

    const filteredReportRows = useMemo(() => {
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        return allEnrollments.filter((e) => {
            const matchesBenefit =
                reportBenefit === 'all' ||
                e.benefitPlanId?._id === reportBenefit ||
                e.benefitPlanId === reportBenefit;
            const matchesDept =
                reportDepartment === 'all' || e.employeeId?.department === reportDepartment;
            const matchesStatus = reportStatus === 'all' || e.status === reportStatus;

            if (!(matchesBenefit && matchesDept && matchesStatus)) return false;

            if (reportType === 'expiring') {
                if (!e.expiryDate) return false;
                const exp = new Date(e.expiryDate);
                return exp >= now && exp <= in30Days && ['Active', 'Enrolled'].includes(e.status);
            }
            if (reportType === 'contribution') {
                return ['Active', 'Enrolled', 'Pending'].includes(e.status);
            }
            if (reportType === 'department') {
                return Boolean(e.employeeId?.department);
            }
            return true;
        });
    }, [allEnrollments, reportBenefit, reportDepartment, reportStatus, reportType]);

    const handleExport = () => {
        let rows = filteredReportRows.map((e) => ({
            ReportType: reportType,
            Employee: e.employeeId?.name || '',
            EmployeeID: e.employeeId?.employeeId || '',
            Department: e.employeeId?.department || '',
            Benefit: e.benefitPlanId?.name || '',
            Category: e.benefitPlanId?.category || '',
            Status: e.status || '',
            Coverage: e.coverageType || '',
            'Employer Contribution': e.companyContribution ?? 0,
            'Employee Contribution': e.employeeContribution ?? 0,
            EnrollmentDate: e.enrollmentDate ? format(new Date(e.enrollmentDate), 'yyyy-MM-dd') : '',
            ExpiryDate: e.expiryDate ? format(new Date(e.expiryDate), 'yyyy-MM-dd') : ''
        }));

        // If no enrollments yet, still allow exporting configured benefit plans
        if (rows.length === 0 && reportType === 'enrollment') {
            rows = benefitPlans.map((plan) => ({
                ReportType: 'plans',
                Benefit: plan.name || '',
                Code: plan.benefitCode || '',
                Category: plan.category || '',
                Status: plan.isActive ? 'Active' : 'Inactive',
                EnrollmentType: plan.enrollmentType || 'Optional',
                'Employer Contribution': plan.companyContribution?.amount ?? 0,
                'Employee Contribution': plan.employeeContribution?.amount ?? 0,
                Provider: plan.provider || ''
            }));
        }

        if (rows.length === 0) {
            toast.error('No data to export for the selected report filters');
            return;
        }

        exportToExcel(rows, `benefits-${reportType}-report.csv`);
        toast.success(`Exported ${rows.length} row(s)`);
    };

    const handleHrEnrollForEmployee = async () => {
        if (!selectedEmployeeRow?.employee?._id || !hrEnrollPlanId) {
            toast.error('Select a benefit plan');
            return;
        }
        try {
            setHrEnrolling(true);
            await axios.post(
                '/v1/admin/benefits/enrollments',
                {
                    employeeId: selectedEmployeeRow.employee._id,
                    benefitPlanId: hrEnrollPlanId,
                    coverageType: hrEnrollCoverage,
                    activateImmediately: benefitPlans.find((p) => p._id === hrEnrollPlanId)?.enrollmentType === 'Automatic'
                },
                { withCredentials: true }
            );
            toast.success('Employee enrolled successfully');
            setHrEnrollPlanId('');
            await refreshSelectedEmployee(selectedEmployeeRow.employee._id);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to enroll employee');
        } finally {
            setHrEnrolling(false);
        }
    };

    const handleAssignFromSettings = async () => {
        if (!assignEmployeeId || !assignPlanId) {
            toast.error('Select employee and benefit plan');
            return;
        }
        try {
            setAssigning(true);
            await axios.post(
                '/v1/admin/benefits/enrollments',
                {
                    employeeId: assignEmployeeId,
                    benefitPlanId: assignPlanId,
                    coverageType: assignCoverage,
                    activateImmediately: assignActivate
                },
                { withCredentials: true }
            );
            toast.success('Benefit assigned successfully');
            setAssignEmployeeId('');
            setAssignPlanId('');
            await refreshOperationalData();
            fetchBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign benefit');
        } finally {
            setAssigning(false);
        }
    };

    const toggleEnrollmentOpen = async (plan) => {
        try {
            const nextOpen = !plan.enrollmentPeriod?.isOpen;
            await axios.put(
                `/v1/admin/benefits/benefit-plans/${plan._id}`,
                {
                    enrollmentPeriod: {
                        ...(plan.enrollmentPeriod || {}),
                        isOpen: nextOpen
                    }
                },
                { withCredentials: true }
            );
            toast.success(nextOpen ? 'Enrollment opened' : 'Enrollment closed');
            fetchBenefits();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update enrollment window');
        }
    };

    const drawerHistory = useMemo(() => {
        if (!selectedEmployeeRow?.enrollments) return [];
        const events = [];
        selectedEmployeeRow.enrollments.forEach((enrollment) => {
            (enrollment.history || []).forEach((h) => {
                events.push({
                    ...h,
                    planName: enrollment.benefitPlanId?.name
                });
            });
            if (!enrollment.history?.length && enrollment.enrollmentDate) {
                events.push({
                    type: 'Enrollment Created',
                    message: `${enrollment.benefitPlanId?.name || 'Benefit'} enrollment`,
                    createdAt: enrollment.enrollmentDate,
                    planName: enrollment.benefitPlanId?.name
                });
            }
        });
        return events.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [selectedEmployeeRow]);

    const sectionTabs = [
        { id: 'plans', label: 'Benefit Plans' },
        { id: 'employees', label: 'Employee Benefits' },
        { id: 'reports', label: 'Reports & Settings' }
    ];

    if (loading) {
        return <LoadingSpinner message="Loading benefits..." />;
    }

    return (
        <div className="bg-gray-50 transition-all duration-300">
            <div className="page-shell">
                <div className="page-shell-inner">
                    <div className="hrms-stack">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-800">Benefits Administration</h1>
                                <p className="text-gray-600 mt-1">Manage employee benefits and enrollments</p>
                            </div>
                            {isHRUser && activeSection === 'plans' && (
                                <button
                                    onClick={openCreateModal}
                                    className="flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition"
                                >
                                    <FaPlus />
                                    Add Benefit
                                </button>
                            )}
                        </div>

                        {/* In-page sections — same navbar tab */}
                        <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-0">
                            {sectionTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        setActiveSection(tab.id);
                                        if (tab.id === 'reports' && isHRUser) {
                                            fetchAllEnrollments();
                                            fetchReportSummary();
                                            fetchEmployeeDirectory();
                                        }
                                        if (tab.id === 'employees' && isHRUser) {
                                            fetchEmployeeOverview();
                                        }
                                    }}
                                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                                        activeSection === tab.id
                                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* ========== Benefit Plans ========== */}
                        {activeSection === 'plans' && (
                            <>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'active', label: 'Active' },
                                        { id: 'inactive', label: 'Inactive' }
                                    ].map((chip) => (
                                        <button
                                            key={chip.id}
                                            type="button"
                                            onClick={() => setStatusFilter(chip.id)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                                statusFilter === chip.id
                                                    ? 'bg-theme-secondary text-white'
                                                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {chip.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-left text-gray-600">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Benefit</th>
                                                    <th className="px-4 py-3 font-medium">Category</th>
                                                    <th className="px-4 py-3 font-medium">Eligibility</th>
                                                    <th className="px-4 py-3 font-medium">Employer Contribution</th>
                                                    <th className="px-4 py-3 font-medium">Employee Contribution</th>
                                                    <th className="px-4 py-3 font-medium">Status</th>
                                                    <th className="px-4 py-3 font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredPlans.map((plan) => (
                                                    <tr key={plan._id} className="border-t border-gray-100 hover:bg-gray-50/80">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-800">{plan.name}</div>
                                                            {plan.benefitCode && (
                                                                <div className="text-xs text-gray-500">{plan.benefitCode}</div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">{plan.category}</td>
                                                        <td className="px-4 py-3 text-gray-600">{formatEligibility(plan)}</td>
                                                        <td className="px-4 py-3 text-gray-700">
                                                            {formatContribution(
                                                                plan.companyContribution?.amount,
                                                                plan.employeeContribution?.frequency
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-700">
                                                            {formatContribution(
                                                                plan.employeeContribution?.amount,
                                                                plan.employeeContribution?.frequency
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.isActive ? 'Active' : 'Cancelled')}`}>
                                                                {plan.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex gap-2">
                                                                {isHRUser && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEditModal(plan)}
                                                                            className="px-2.5 py-1.5 text-theme-secondary hover:bg-theme-secondary/10 rounded transition"
                                                                            title="Edit"
                                                                        >
                                                                            <FaEdit />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteBenefit(plan._id)}
                                                                            className="px-2.5 py-1.5 text-red-500 hover:bg-red-50 rounded transition"
                                                                            title="Delete"
                                                                        >
                                                                            <FaTrash />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredPlans.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                                                            <FaMoneyBillWave className="mx-auto text-gray-400 text-4xl mb-3" />
                                                            {benefitPlans.length === 0
                                                                ? 'No benefit plans configured yet.'
                                                                : 'No benefit plans match your filters.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ========== Employee Benefits ========== */}
                        {activeSection === 'employees' && isHRUser && (
                            <>
                                <div className="flex flex-col lg:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search Employee"
                                            value={empSearch}
                                            onChange={(e) => setEmpSearch(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                        />
                                    </div>
                                    <select
                                        value={empDepartment}
                                        onChange={(e) => setEmpDepartment(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Department</option>
                                        {departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={empStatus}
                                        onChange={(e) => setEmpStatus(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Status</option>
                                        <option value="Active">Active</option>
                                        <option value="Pending">Pending</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <select
                                        value={empBenefit}
                                        onChange={(e) => setEmpBenefit(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white"
                                    >
                                        <option value="all">Benefit</option>
                                        {benefitPlans.map((p) => (
                                            <option key={p._id} value={p._id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-left text-gray-600">
                                                <tr>
                                                    <th className="px-4 py-3 font-medium">Employee</th>
                                                    <th className="px-4 py-3 font-medium">Benefits</th>
                                                    <th className="px-4 py-3 font-medium">Active</th>
                                                    <th className="px-4 py-3 font-medium">Pending</th>
                                                    <th className="px-4 py-3 font-medium">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredEmployees.map((row) => (
                                                    <tr key={row.employee._id} className="border-t border-gray-100 hover:bg-gray-50/80">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-gray-800">{row.employee.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                {row.employee.employeeId || row.employee.department || ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            {row.benefitNames?.join(', ') || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">{row.activeCount}</td>
                                                        <td className="px-4 py-3">{row.pendingCount}</td>
                                                        <td className="px-4 py-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEmployeeDrawer(row)}
                                                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition text-sm"
                                                            >
                                                                <FaEye /> View
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredEmployees.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                                                            No employee benefits found.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === 'employees' && !isHRUser && (
                            <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-gray-100">
                                Employee benefits management is available to HR and Admin.
                            </div>
                        )}

                        {/* ========== Reports & Settings ========== */}
                        {activeSection === 'reports' && isHRUser && (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    {[
                                        { label: 'Total Benefit Plans', value: reportSummary.totalPlans },
                                        { label: 'Active Plans', value: reportSummary.activePlans },
                                        { label: 'Active Enrollments', value: reportSummary.activeEnrollments },
                                        { label: 'Pending Enrollments', value: reportSummary.pendingEnrollments },
                                        { label: 'Expiring Soon', value: reportSummary.expiringBenefits }
                                    ].map((card) => (
                                        <div key={card.label} className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">{card.label}</p>
                                            <p className="text-2xl font-semibold text-gray-800 mt-1">{card.value}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm space-y-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-800">Reports</h3>
                                            <p className="text-sm text-gray-500 mt-0.5">
                                                Preview enrollments, then export to Excel
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleExport}
                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary transition shrink-0"
                                        >
                                            <FaDownload /> Export Excel
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        <select
                                            value={reportType}
                                            onChange={(e) => setReportType(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            aria-label="Report type"
                                        >
                                            <option value="enrollment">Benefit Enrollment Report</option>
                                            <option value="department">Department-wise Report</option>
                                            <option value="contribution">Contribution Report</option>
                                            <option value="expiring">Expiring Benefits</option>
                                        </select>
                                        <select
                                            value={reportBenefit}
                                            onChange={(e) => setReportBenefit(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            aria-label="Benefit filter"
                                        >
                                            <option value="all">Benefit: All</option>
                                            {benefitPlans.map((p) => (
                                                <option key={p._id} value={p._id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={reportDepartment}
                                            onChange={(e) => setReportDepartment(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            aria-label="Department filter"
                                        >
                                            <option value="all">Department: All</option>
                                            {departments.map((d) => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={reportStatus}
                                            onChange={(e) => setReportStatus(e.target.value)}
                                            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            aria-label="Status filter"
                                        >
                                            <option value="all">Status: All</option>
                                            <option value="Active">Active</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Cancelled">Cancelled</option>
                                            <option value="Expired">Expired</option>
                                        </select>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {filteredReportRows.length} enrollment record{filteredReportRows.length === 1 ? '' : 's'} match the current filters
                                        {allEnrollments.length === 0
                                            ? ' (no enrollments yet — Export will download benefit plans list).'
                                            : '.'}
                                    </p>

                                    <div className="overflow-x-auto border border-gray-100 rounded-lg">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 text-left text-gray-600">
                                                <tr>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Employee Name</th>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Department</th>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Benefit</th>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">Status</th>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">Employer Contrib. (₹)</th>
                                                    <th className="px-3 py-2.5 font-medium whitespace-nowrap text-right">Employee Contrib. (₹)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredReportRows.slice(0, 50).map((e) => (
                                                    <tr key={e._id} className="border-t border-gray-100 hover:bg-gray-50/80">
                                                        <td className="px-3 py-2.5 font-medium text-gray-800">{e.employeeId?.name || '—'}</td>
                                                        <td className="px-3 py-2.5 text-gray-600">{e.employeeId?.department || '—'}</td>
                                                        <td className="px-3 py-2.5 text-gray-800">{e.benefitPlanId?.name || '—'}</td>
                                                        <td className="px-3 py-2.5">
                                                            <span
                                                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                                                    e.status === 'Active'
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : e.status === 'Pending'
                                                                            ? 'bg-amber-50 text-amber-700'
                                                                            : e.status === 'Cancelled'
                                                                                ? 'bg-red-50 text-red-600'
                                                                                : 'bg-gray-100 text-gray-600'
                                                                }`}
                                                            >
                                                                {e.status || '—'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                                                            {Number(e.companyContribution || 0).toLocaleString('en-IN')}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                                                            {Number(e.employeeContribution || 0).toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {filteredReportRows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                                                            No enrollment rows for these filters.
                                                            {allEnrollments.length === 0
                                                                ? ' Create enrollments from Employee Benefits or wait for employee requests.'
                                                                : ' Try Status: All and Report: Benefit Enrollment Report.'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Settings</h3>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            Manage enrollment windows and assign benefits on behalf of employees
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-medium text-gray-700">Enrollment windows</h4>
                                        <p className="text-sm text-gray-600">Open or close enrollment for each plan.</p>
                                        {benefitPlans.map((plan) => (
                                            <div key={plan._id} className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 rounded-lg px-3 py-2.5">
                                                <div>
                                                    <p className="font-medium text-gray-800">{plan.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {plan.enrollmentType || 'Optional'} · {plan.enrollmentPeriod?.isOpen === false ? 'Closed' : 'Open'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleEnrollmentOpen(plan)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                                                        plan.enrollmentPeriod?.isOpen === false
                                                            ? 'bg-theme-secondary/10 text-theme-secondary'
                                                            : 'bg-red-50 text-red-600'
                                                    }`}
                                                >
                                                    {plan.enrollmentPeriod?.isOpen === false ? 'Open Enrollment' : 'Close Enrollment'}
                                                </button>
                                            </div>
                                        ))}
                                        {benefitPlans.length === 0 && (
                                            <p className="text-sm text-gray-500 py-2">No benefit plans yet. Add plans from Benefit Plans.</p>
                                        )}
                                    </div>

                                    <div className="border-t border-gray-100 pt-4 space-y-3">
                                        <h4 className="text-sm font-medium text-gray-700">Assign benefit to employee</h4>
                                        <p className="text-xs text-gray-500">
                                            {employeeDirectory.length} employee{employeeDirectory.length === 1 ? '' : 's'} loaded
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <select
                                                value={assignEmployeeId}
                                                onChange={(e) => setAssignEmployeeId(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            >
                                                <option value="">
                                                    {employeeDirectory.length === 0 ? 'No employees found' : 'Select employee'}
                                                </option>
                                                {employeeDirectory.map((emp) => (
                                                    <option key={emp._id} value={emp._id}>
                                                        {emp.name || 'Employee'}
                                                        {emp.lastName ? ` ${emp.lastName}` : ''}
                                                        {emp.employeeId ? ` (${emp.employeeId})` : ''}
                                                        {emp.department ? ` — ${emp.department}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={assignPlanId}
                                                onChange={(e) => setAssignPlanId(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            >
                                                <option value="">Select benefit plan</option>
                                                {benefitPlans.filter((p) => p.isActive).map((p) => (
                                                    <option key={p._id} value={p._id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={assignCoverage}
                                                onChange={(e) => setAssignCoverage(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                            >
                                                <option value="Individual">Individual</option>
                                                <option value="Family">Family</option>
                                            </select>
                                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 px-1">
                                                <input
                                                    type="checkbox"
                                                    checked={assignActivate}
                                                    onChange={(e) => setAssignActivate(e.target.checked)}
                                                    className="rounded border-gray-300"
                                                />
                                                Activate immediately
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAssignFromSettings}
                                            disabled={assigning || employeeDirectory.length === 0}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-theme-secondary text-white rounded-lg hover:bg-theme-primary disabled:opacity-50"
                                        >
                                            {assigning ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                                            Assign Benefit
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeSection === 'reports' && !isHRUser && (
                            <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-gray-100">
                                Reports are available to HR and Admin.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create/Edit Modal */}
            {showCreateModal && isHRUser && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 lg:left-64"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowCreateModal(false);
                            setFormData(emptyForm());
                            setSelectedPlan(null);
                        }
                    }}
                >
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-semibold mb-4">
                            {selectedPlan ? 'Edit Benefit Plan' : 'Add Benefit'}
                        </h3>
                        <form onSubmit={handleSaveBenefit} className="space-y-6">
                            <section className="space-y-4">
                                <h4 className="font-medium text-gray-800 border-b pb-2">Basic Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Benefit Name <span className="text-red-500">*</span>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Code</label>
                                        <input
                                            type="text"
                                            value={formData.benefitCode}
                                            onChange={(e) => setFormData({ ...formData, benefitCode: e.target.value })}
                                            className="w-full p-3 border rounded-lg"
                                            placeholder="e.g. HEALTH-001"
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
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                                        <input
                                            type="text"
                                            value={formData.provider}
                                            onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                            className="w-full p-3 border rounded-lg"
                                        />
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            </section>

                            <section className="space-y-4">
                                <h4 className="font-medium text-gray-800 border-b pb-2">Contribution</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employer Contribution (₹)</label>
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employee Contribution (₹)</label>
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
                            </section>

                            <section className="space-y-4">
                                <h4 className="font-medium text-gray-800 border-b pb-2">Eligibility</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                                        <select
                                            value={formData.eligibility.employmentType[0] || 'Full-time'}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                eligibility: {
                                                    ...formData.eligibility,
                                                    employmentType: [e.target.value]
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Department (comma-separated)</label>
                                        <input
                                            type="text"
                                            value={(formData.eligibility.departments || []).join(', ')}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                eligibility: {
                                                    ...formData.eligibility,
                                                    departments: e.target.value
                                                        .split(',')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                            placeholder="Leave blank for all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Tenure (months)</label>
                                        <input
                                            type="number"
                                            value={formData.eligibility.tenure}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                eligibility: {
                                                    ...formData.eligibility,
                                                    tenure: parseInt(e.target.value, 10) || 0
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Position Level (comma-separated)</label>
                                        <input
                                            type="text"
                                            value={(formData.eligibility.positionLevels || []).join(', ')}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                eligibility: {
                                                    ...formData.eligibility,
                                                    positionLevels: e.target.value
                                                        .split(',')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                            placeholder="e.g. Junior, Senior"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Location (comma-separated)</label>
                                        <input
                                            type="text"
                                            value={(formData.eligibility.locations || []).join(', ')}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                eligibility: {
                                                    ...formData.eligibility,
                                                    locations: e.target.value
                                                        .split(',')
                                                        .map((s) => s.trim())
                                                        .filter(Boolean)
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                            placeholder="Matches employee city"
                                        />
                                    </div>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h4 className="font-medium text-gray-800 border-b pb-2">Enrollment</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Type</label>
                                        <select
                                            value={formData.enrollmentType}
                                            onChange={(e) => setFormData({ ...formData, enrollmentType: e.target.value })}
                                            className="w-full p-3 border rounded-lg"
                                        >
                                            <option value="Optional">Optional</option>
                                            <option value="Required">Required</option>
                                            <option value="Automatic">Automatic</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
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
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment Start Date</label>
                                        <input
                                            type="date"
                                            value={formData.enrollmentPeriod.startDate}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                enrollmentPeriod: {
                                                    ...formData.enrollmentPeriod,
                                                    startDate: e.target.value
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Enrollment End Date</label>
                                        <input
                                            type="date"
                                            value={formData.enrollmentPeriod.endDate}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                enrollmentPeriod: {
                                                    ...formData.enrollmentPeriod,
                                                    endDate: e.target.value
                                                }
                                            })}
                                            className="w-full p-3 border rounded-lg"
                                        />
                                    </div>
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
                            </section>

                            <div className="flex gap-2 justify-end pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setFormData(emptyForm());
                                        setSelectedPlan(null);
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
                                            Saving...
                                        </>
                                    ) : (
                                        selectedPlan ? 'Update Plan' : 'Create Plan'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Employee Benefit Drawer */}
            {drawerOpen && selectedEmployeeRow && (
                <div className="fixed inset-0 z-50 flex justify-end lg:left-64">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setDrawerOpen(false)}
                    />
                    <div className="relative w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-start justify-between z-10">
                            <div>
                                <h3 className="text-xl font-semibold text-gray-800">
                                    {selectedEmployeeRow.employee.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Employee ID: {selectedEmployeeRow.employee.employeeId || '—'}
                                </p>
                                <p className="text-sm text-gray-500">
                                    Department: {selectedEmployeeRow.employee.department || '—'}
                                    {selectedEmployeeRow.employee.position
                                        ? ` · Position: ${selectedEmployeeRow.employee.position}`
                                        : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDrawerOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <FaTimes className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-5 pt-3 flex gap-2 border-b border-gray-100">
                            {[
                                { id: 'overview', label: 'Overview' },
                                { id: 'enrollments', label: 'Enrollments' },
                                { id: 'dependents', label: 'Dependents' },
                                { id: 'history', label: 'History' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setDrawerTab(tab.id)}
                                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                                        drawerTab === tab.id
                                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                            : 'border-transparent text-gray-500'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 space-y-4">
                            {drawerTab === 'overview' && (
                                <>
                                    <h4 className="font-medium text-gray-800">Active Benefits</h4>
                                    {selectedEmployeeRow.enrollments
                                        .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                        .map((e) => (
                                            <div key={e._id} className="flex justify-between items-center border rounded-lg px-3 py-2">
                                                <span className="text-gray-800">{e.benefitPlanId?.name || 'Benefit'}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`}>
                                                    {e.status}
                                                </span>
                                            </div>
                                        ))}
                                    {selectedEmployeeRow.enrollments.filter((e) => ['Active', 'Enrolled'].includes(e.status)).length === 0 && (
                                        <p className="text-sm text-gray-500">No active benefits.</p>
                                    )}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500">Employer Contribution</p>
                                            <p className="font-semibold text-gray-800">
                                                ₹{selectedEmployeeRow.enrollments
                                                    .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                                    .reduce((sum, e) => sum + (Number(e.companyContribution) || 0), 0)
                                                    .toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-xs text-gray-500">Employee Contribution</p>
                                            <p className="font-semibold text-gray-800">
                                                ₹{selectedEmployeeRow.enrollments
                                                    .filter((e) => ['Active', 'Enrolled'].includes(e.status))
                                                    .reduce((sum, e) => sum + (Number(e.employeeContribution) || 0), 0)
                                                    .toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {drawerTab === 'enrollments' && (
                                <div className="space-y-3">
                                    <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                                        <h5 className="font-medium text-gray-800">Enroll employee in a benefit</h5>
                                        <select
                                            value={hrEnrollPlanId}
                                            onChange={(e) => setHrEnrollPlanId(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                        >
                                            <option value="">Select benefit plan</option>
                                            {benefitPlans.filter((p) => p.isActive).map((p) => (
                                                <option key={p._id} value={p._id}>
                                                    {p.name} ({p.enrollmentType || 'Optional'})
                                                </option>
                                            ))}
                                        </select>
                                        <select
                                            value={hrEnrollCoverage}
                                            onChange={(e) => setHrEnrollCoverage(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                                        >
                                            <option value="Individual">Individual</option>
                                            <option value="Family">Family</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleHrEnrollForEmployee}
                                            disabled={hrEnrolling || !hrEnrollPlanId}
                                            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-theme-secondary text-white rounded-lg text-sm disabled:opacity-50"
                                        >
                                            {hrEnrolling ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                                            Enroll Employee
                                        </button>
                                    </div>

                                    {selectedEmployeeRow.enrollments.map((e) => (
                                        <div key={e._id} className="border rounded-lg p-4 space-y-2">
                                            <div className="flex justify-between items-start">
                                                <h5 className="font-medium text-gray-800">{e.benefitPlanId?.name}</h5>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(e.status)}`}>
                                                    {e.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600">Coverage: {e.coverageType}</p>
                                            <p className="text-sm text-gray-600">
                                                Employer Contribution: {formatContribution(e.companyContribution, e.paymentFrequency)}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Employee Contribution: {formatContribution(e.employeeContribution, e.paymentFrequency)}
                                            </p>
                                            {e.status === 'Pending' && (
                                                <div className="flex gap-2 pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEnrollmentAction(e._id, 'Active')}
                                                        className="px-3 py-1.5 bg-theme-primary text-white rounded text-sm inline-flex items-center gap-1"
                                                    >
                                                        <FaCheckCircle /> Approve
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEnrollmentAction(e._id, 'Cancelled')}
                                                        className="px-3 py-1.5 bg-red-500 text-white rounded text-sm inline-flex items-center gap-1"
                                                    >
                                                        <FaTimesCircle /> Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {selectedEmployeeRow.enrollments.length === 0 && (
                                        <p className="text-sm text-gray-500">No enrollments.</p>
                                    )}
                                </div>
                            )}

                            {drawerTab === 'dependents' && (
                                <div className="space-y-4">
                                    {selectedEmployeeRow.enrollments.filter(supportsDependents).length === 0 && (
                                        <p className="text-sm text-gray-500">
                                            No benefits that support dependents for this employee.
                                        </p>
                                    )}
                                    {selectedEmployeeRow.enrollments.filter(supportsDependents).map((enrollment) => (
                                        <div key={enrollment._id} className="border rounded-lg p-4 space-y-3">
                                            <h5 className="font-medium text-gray-800">
                                                {enrollment.benefitPlanId?.name}
                                            </h5>
                                            {(enrollment.dependents || []).length === 0 && (
                                                <p className="text-sm text-gray-500">No dependents added.</p>
                                            )}
                                            {(enrollment.dependents || []).map((dep, idx) => (
                                                <div key={`${dep.name}-${idx}`} className="flex justify-between items-center text-sm">
                                                    <span>
                                                        <span className="text-gray-500">{dep.relationship}</span>
                                                        {' · '}
                                                        <span className="text-gray-800">{dep.name}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveDependent(enrollment, idx)}
                                                        className="text-red-500 text-xs hover:underline"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ))}
                                            {addingDependentFor === enrollment._id ? (
                                                <div className="space-y-2 pt-2 border-t">
                                                    <input
                                                        type="text"
                                                        placeholder="Dependent name"
                                                        value={dependentForm.name}
                                                        onChange={(e) => setDependentForm({ ...dependentForm, name: e.target.value })}
                                                        className="w-full p-2 border rounded-lg text-sm"
                                                    />
                                                    <select
                                                        value={dependentForm.relationship}
                                                        onChange={(e) => setDependentForm({ ...dependentForm, relationship: e.target.value })}
                                                        className="w-full p-2 border rounded-lg text-sm"
                                                    >
                                                        <option value="Spouse">Spouse</option>
                                                        <option value="Child">Child</option>
                                                        <option value="Parent">Parent</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddDependent(enrollment)}
                                                            className="px-3 py-1.5 bg-theme-secondary text-white rounded text-sm"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setAddingDependentFor(null)}
                                                            className="px-3 py-1.5 text-gray-600 text-sm"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAddingDependentFor(enrollment._id);
                                                        setDependentForm({ name: '', relationship: 'Spouse', dateOfBirth: '' });
                                                    }}
                                                    className="inline-flex items-center gap-1 text-sm text-theme-secondary hover:underline"
                                                >
                                                    <FaPlus className="text-xs" /> Add Dependent
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {drawerTab === 'history' && (
                                <div className="space-y-3">
                                    {drawerHistory.length === 0 && (
                                        <p className="text-sm text-gray-500">No history yet.</p>
                                    )}
                                    {drawerHistory.map((event, idx) => (
                                        <div key={`${event.type}-${idx}`} className="border-l-2 border-theme-secondary/40 pl-3 py-1">
                                            <p className="text-xs text-gray-500">
                                                {event.createdAt
                                                    ? format(new Date(event.createdAt), 'dd MMM yyyy')
                                                    : '—'}
                                            </p>
                                            <p className="text-sm font-medium text-gray-800">{event.type}</p>
                                            <p className="text-sm text-gray-600">
                                                {event.message || event.planName || ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BenefitsPage;
